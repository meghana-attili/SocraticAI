import prisma from './db';
import neo4jDriver from './neo4j';
import { recalculateTopicPriority } from './priorityEngine';

const GROQ_API_URL = 'https://api.groq.com/openai/v1/embeddings';

/**
 * Uses Groq to generate a 1536-dimensional embedding map for a given text.
 * Note: Groq's `llama-3.3-70b-versatile` does not natively support an embeddings endpoint,
 * but typical OpenAI-compatible endpoints or specialized embedding models are used here.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is missing");

    // Replace this block with actual API call to an embedding model provider.
    // For now, returning a mock 1536-dimensional vector for local compile testing.
    const mockVector = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);
    return mockVector;
}

/**
 * Handles the creation of a new topic, generating an embedding, creating the default metrics,
 * creating the Neo4j Node, and forming Vector Similarity edges.
 */
export async function createTopicWithEmbeddings(subjectId: string, title: string) {
    // 1. Generate text embedding
    const embedding = await generateEmbedding(title);

    // 2. Insert into PostgreSQL using raw query to insert the pgvector
    // Because Prisma doesn't natively support mapping arrays to `Unsupported("vector")` on inserts
    // we use $executeRaw.
    const topicId = crypto.randomUUID();
    const vectorString = `[${embedding.join(',')}]`;

    await prisma.$executeRaw`
    INSERT INTO topics (id, subject_id, title, embedding, created_at)
    VALUES (
      ${topicId}::uuid, 
      ${subjectId}::uuid, 
      ${title}, 
      ${vectorString}::vector, 
      now()
    )
  `;

    // Provide initial blank Metric tracking
    await prisma.topicMetric.create({
        data: { topic_id: topicId }
    });

    // Calculate default Priority
    await recalculateTopicPriority(topicId);

    // 3. Vector Similarity Matching
    // Find topics with Cosine Similarity > 0.75
    const similarTopics = await prisma.$queryRaw<{ id: string, similarity: number }[]>`
    SELECT id, 1 - (embedding <=> ${vectorString}::vector) AS similarity
    FROM topics
    WHERE id != ${topicId}::uuid
      AND 1 - (embedding <=> ${vectorString}::vector) > 0.75;
  `;

    // 4. Update Neo4j Graph
    const session = neo4jDriver.session();
    try {
        // 4a. Create the Topic Node
        await session.run(
            `
      MERGE (t:Topic {topicId: $topicId})
      SET t.title = $title,
          t.subjectId = $subjectId,
          t.difficulty_level = 1
      `,
            { topicId, title, subjectId }
        );

        // 4b. Insert Similarity Edges
        if (similarTopics.length > 0) {
            const edgeQuery = similarTopics.map((target, idx) => `
        MATCH (newTopic:Topic {topicId: $topicId})
        MATCH (targetTopic:Topic {topicId: $targetId${idx}})
        MERGE (newTopic)-[:SIMILARITY {score: $score${idx}}]->(targetTopic)
      `).join('\n');

            const params: Record<string, any> = { topicId };
            similarTopics.forEach((target, idx) => {
                params[`targetId${idx}`] = target.id;
                params[`score${idx}`] = target.similarity;
            });

            await session.run(edgeQuery, params);
        }
    } catch (error) {
        console.error('Neo4j Node/Edge creation failed:', error);
    } finally {
        await session.close();
    }

    return topicId;
}
