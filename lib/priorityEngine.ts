import prisma from './db';
import neo4jDriver from './neo4j';

/**
 * 3. PRIORITY CALCULATION ENGINE
 * Must run server-side only.
 * 
 * Target Formula:
 * priority_score = 
 *   0.30 * ExamImportance + 
 *   0.25 * (1 - MasteryScore) + 
 *   0.20 * ForgettingRisk + 
 *   0.15 * DependencyWeakness + 
 *   0.10 * user_priority
 */
export async function recalculateTopicPriority(topicId: string) {
    // 1. Fetch Metric and Topic data
    const topic = await prisma.topic.findUnique({
        where: { id: topicId },
        include: {
            metric: true,
            subject: {
                include: { user: true }
            }
        }
    });

    if (!topic || !topic.metric) return null;

    const metric = topic.metric;
    const user = topic.subject.user;

    // 3.1 Mastery Score
    // Formula: M = (correct_attempts + 1) / (total_attempts + 2)
    const masteryScore = (metric.correct_attempts + 1) / (metric.total_attempts + 2);

    // 3.2 Forgetting Risk
    // Retention = exp(-λ * daysSinceRevision)
    // ForgettingRisk = 1 - Retention
    const lambda = user.memory_decay_constant; // Default 0.12

    let daysSinceRevision = 0;
    if (metric.last_revised) {
        const msDiff = Date.now() - metric.last_revised.getTime();
        daysSinceRevision = msDiff / (1000 * 60 * 60 * 24);
    } else if (metric.updated_at) {
        const msDiff = Date.now() - metric.updated_at.getTime();
        daysSinceRevision = msDiff / (1000 * 60 * 60 * 24);
    }

    const retention = Math.exp(-lambda * daysSinceRevision);
    const forgettingRisk = 1 - retention;

    // 3.3 Dependency Weakness (Query Neo4j)
    let dependencyWeakness = 0;
    const session = neo4jDriver.session();
    try {
        const result = await session.run(
            `
      MATCH (t:Topic {topicId: $topicId})-[:PREREQUISITE]->(child:Topic)
      RETURN child.topicId AS childId
      `,
            { topicId: topic.id }
        );

        const childIds = result.records.map(r => r.get('childId') as string);
        if (childIds.length > 0) {
            // Fetch mastery from postgres for children
            const childrenMetrics = await prisma.topicMetric.findMany({
                where: { topic_id: { in: childIds } },
                select: { mastery_score: true }
            });

            const totalWeakness = childrenMetrics.reduce((sum, cm) => sum + (1 - cm.mastery_score), 0);
            dependencyWeakness = totalWeakness / childrenMetrics.length;
        }
    } catch (error) {
        console.error('Error calculating Dependency Weakness:', error);
    } finally {
        await session.close();
    }

    // 3.4 Exam Importance
    let examImportance = topic.base_exam_weight;
    if (topic.subject.exam_date) {
        const msRemaining = topic.subject.exam_date.getTime() - Date.now();
        const daysRemaining = Math.max(0, msRemaining / (1000 * 60 * 60 * 24));
        const examUrgencyFactor = Math.exp(-0.05 * daysRemaining);
        examImportance = topic.base_exam_weight * examUrgencyFactor;
    }

    // 3.5 Final Priority Score
    const priorityScore =
        (0.30 * examImportance) +
        (0.25 * (1 - masteryScore)) +
        (0.20 * forgettingRisk) +
        (0.15 * dependencyWeakness) +
        (0.10 * topic.user_priority);

    // Update Postgres Metric
    const updatedMetric = await prisma.topicMetric.update({
        where: { id: metric.id },
        data: {
            mastery_score: masteryScore,
            forgetting_risk: forgettingRisk,
            dependency_weakness: dependencyWeakness,
            priority_score: priorityScore,
        }
    });

    return updatedMetric;
}
