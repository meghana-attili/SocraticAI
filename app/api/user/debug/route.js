import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// Debug endpoint — shows exactly what's happening with DB connection and user sync
export async function GET() {
    const result = { steps: [] };

    // Step 1: Check Clerk auth
    try {
        const { userId: clerkId } = await auth();
        result.steps.push({ step: 'clerk_auth', clerkId, ok: !!clerkId });
        if (!clerkId) {
            return NextResponse.json({ error: 'Not logged in', result });
        }
        result.clerkId = clerkId;
    } catch (e) {
        result.steps.push({ step: 'clerk_auth', error: e.message, ok: false });
        return NextResponse.json(result);
    }

    // Step 2: Check DB connection
    try {
        const prisma = (await import('@/lib/db')).default;
        result.steps.push({ step: 'prisma_import', ok: true });

        // Step 3: Try a simple query
        const count = await prisma.user.count();
        result.steps.push({ step: 'db_query', userCount: count, ok: true });

        // Step 4: Try to find/create user
        const user = await prisma.user.findUnique({ where: { clerk_id: result.clerkId } });
        result.steps.push({ step: 'find_user', found: !!user, userId: user?.id, ok: true });

    } catch (e) {
        result.steps.push({ step: 'db_error', error: e.message, ok: false });
    }

    return NextResponse.json(result);
}
