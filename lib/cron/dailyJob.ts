import cron from 'node-cron';
import prisma from '../db';
import { redis } from '../redis';
import { recalculateTopicPriority } from '../priorityEngine';

/**
 * Requirement 7. CRON JOBS
 * Run Daily at 3AM: Recompute forgetting risk and recompute priority
 */
export function initCronJobs() {
    console.log('Initializing SocraticAI 2.0 Cron schedules...');

    // 0 3 * * * = "At 03:00 AM every day"
    cron.schedule('0 3 * * *', async () => {
        console.log('Running daily 3AM priority and forgetting risk recalculation...');

        try {
            const allMetrics = await prisma.topicMetric.findMany({ select: { topic_id: true } });

            let processed = 0;
            for (const m of allMetrics) {
                // Requirement 8: Priority calculation < 30ms per topic
                const start = performance.now();
                await recalculateTopicPriority(m.topic_id);
                const end = performance.now();

                // Benchmarking logging logic could intercept here (Phase 5)
                if (end - start > 30) {
                    console.warn(`WARNING: Recalculate exceeded 30ms threshold: ${end - start}ms for topic ${m.topic_id}`);
                }
                processed++;
            }

            // Clear Redis Cache so the next graph fetch uses the updated priorities
            await redis.del('graph_data');

            console.log(`Cron job complete. Reprocessed ${processed} topics and cleared cache.`);
        } catch (error) {
            console.error('Error executing daily priority recalculation cron:', error);
        }
    });
}
