import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// GET — Load all mastery data for the current user
export async function GET() {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        try {
            const prisma = (await import('@/lib/db')).default;

            const user = await prisma.user.findUnique({
                where: { clerk_id: clerkId },
                include: {
                    subjects: {
                        include: {
                            topics: {
                                include: { metric: true },
                            },
                        },
                    },
                },
            });

            if (!user) {
                return NextResponse.json({ mastery: {}, subjects: [] });
            }

            // Convert DB structure → frontend mastery map { topicTitle: { correct, total, sources, ... } }
            const mastery = {};
            const subjects = [];

            for (const subject of user.subjects) {
                subjects.push({ id: subject.id, name: subject.name, examDate: subject.exam_date });

                for (const topic of subject.topics) {
                    const m = topic.metric;
                    if (m) {
                        mastery[topic.title] = {
                            correct: m.correct_attempts,
                            total: m.total_attempts,
                            sources: {},  // We don't store per-source in DB yet — can add later
                            manualOverride: null,
                            subject: subject.name,
                        };
                    }
                }
            }

            return NextResponse.json({ mastery, subjects });
        } catch (dbError) {
            console.warn('DB not available for mastery load:', dbError.message);
            return NextResponse.json({ mastery: {}, subjects: [], note: 'DB offline' });
        }
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// POST — Save mastery data for the current user
export async function POST(request) {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { mastery } = await request.json();
        if (!mastery || typeof mastery !== 'object') {
            return NextResponse.json({ error: 'Invalid mastery data' }, { status: 400 });
        }

        try {
            const prisma = (await import('@/lib/db')).default;

            const user = await prisma.user.findUnique({ where: { clerk_id: clerkId } });
            if (!user) {
                return NextResponse.json({ error: 'User not found' }, { status: 404 });
            }

            // Group by subject
            const bySubject = {};
            for (const [topicTitle, data] of Object.entries(mastery)) {
                const subjectName = data.subject || 'General';
                if (!bySubject[subjectName]) bySubject[subjectName] = [];
                bySubject[subjectName].push({ title: topicTitle, ...data });
            }

            for (const [subjectName, topics] of Object.entries(bySubject)) {
                // Upsert subject
                let subject = await prisma.subject.findFirst({
                    where: { user_id: user.id, name: subjectName },
                });
                if (!subject) {
                    subject = await prisma.subject.create({
                        data: { user_id: user.id, name: subjectName },
                    });
                }

                for (const topicData of topics) {
                    // Upsert topic
                    let topic = await prisma.topic.findFirst({
                        where: { subject_id: subject.id, title: topicData.title },
                    });
                    if (!topic) {
                        topic = await prisma.topic.create({
                            data: { subject_id: subject.id, title: topicData.title },
                        });
                    }

                    // Upsert metric
                    await prisma.topicMetric.upsert({
                        where: { topic_id: topic.id },
                        create: {
                            topic_id: topic.id,
                            correct_attempts: topicData.correct || 0,
                            total_attempts: topicData.total || 0,
                            mastery_score: topicData.total > 0
                                ? (topicData.correct + 1) / (topicData.total + 2)
                                : 0,
                            last_revised: new Date(),
                        },
                        update: {
                            correct_attempts: topicData.correct || 0,
                            total_attempts: topicData.total || 0,
                            mastery_score: topicData.total > 0
                                ? (topicData.correct + 1) / (topicData.total + 2)
                                : 0,
                            last_revised: new Date(),
                        },
                    });
                }
            }

            return NextResponse.json({ success: true });
        } catch (dbError) {
            console.warn('DB not available for mastery save:', dbError.message);
            return NextResponse.json({ success: true, note: 'DB offline — data in memory only' });
        }
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
