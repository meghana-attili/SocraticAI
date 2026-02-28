import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';

export async function POST() {
    try {
        const { userId: clerkId } = await auth();
        if (!clerkId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const clerkUser = await currentUser();
        const email = clerkUser?.emailAddresses?.[0]?.emailAddress || `${clerkId}@clerk.local`;
        const name = clerkUser?.firstName
            ? `${clerkUser.firstName}${clerkUser.lastName ? ' ' + clerkUser.lastName : ''}`
            : null;

        try {
            const prisma = (await import('@/lib/db')).default;

            // Find or create user by clerk_id
            let user = await prisma.user.findUnique({ where: { clerk_id: clerkId } });

            if (!user) {
                user = await prisma.user.create({
                    data: {
                        clerk_id: clerkId,
                        email,
                        name,
                    },
                });
            } else if (user.email !== email || (name && user.name !== name)) {
                // Sync email/name if changed in Clerk
                user = await prisma.user.update({
                    where: { clerk_id: clerkId },
                    data: { email, name: name || user.name },
                });
            }

            return NextResponse.json({ success: true, userId: user.id, clerkId });
        } catch (dbError) {
            console.warn('DB not available for user sync:', dbError.message);
            return NextResponse.json({ success: true, userId: null, clerkId, note: 'DB offline' });
        }
    } catch (error) {
        console.error('User sync error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
