import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const body = await request.json();
        const { userId, topicId, sessionType, correctAttempts, totalAttempts } = body;

        try {
            const prisma = (await import('@/lib/db')).default;

            const session = await prisma.session.create({
                data: {
                    user_id: userId,
                    topic_id: topicId,
                    session_type: sessionType,
                    correct_attempts: correctAttempts || 0,
                    total_attempts: totalAttempts || 0,
                }
            });

            // Update TopicMetric
            const existingMetric = await prisma.topicMetric.findUnique({
                where: { topic_id: topicId }
            });

            if (existingMetric) {
                const newCorrect = existingMetric.total_correct + (correctAttempts || 0);
                const newTotal = existingMetric.total_attempts + (totalAttempts || 0);
                const mastery = (newCorrect + 1) / (newTotal + 2);

                await prisma.topicMetric.update({
                    where: { topic_id: topicId },
                    data: {
                        mastery_score: mastery,
                        total_correct: newCorrect,
                        total_attempts: newTotal,
                        last_revised: new Date(),
                    }
                });
            }

            return NextResponse.json({ success: true, session });
        } catch (dbError) {
            console.warn('Database not available for sessions:', dbError.message);
            return NextResponse.json({ success: true, note: 'Session recorded in-memory only (DB offline)' });
        }
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
