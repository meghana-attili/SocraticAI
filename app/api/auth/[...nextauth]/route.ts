import NextAuth from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"

const handler = NextAuth({
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" }
            },
            async authorize(credentials) {
                if (!credentials?.email || !credentials?.password) {
                    return null;
                }

                try {
                    const prisma = (await import("@/lib/db")).default;
                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email }
                    });

                    if (!user) {
                        const newUser = await prisma.user.create({
                            data: {
                                clerk_id: `legacy_${credentials.email}`,
                                email: credentials.email,
                                name: credentials.email.split('@')[0],
                            }
                        });
                        return { id: newUser.id, email: newUser.email, name: newUser.name };
                    }

                    return { id: user.id, email: user.email, name: user.name };
                } catch (err) {
                    console.warn("Auth DB not available:", err.message);
                    // Fallback demo user when database isn't running
                    return { id: "demo-user", email: credentials.email, name: credentials.email.split('@')[0] };
                }
            }
        })
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                (session.user as any).id = token.id as string;
            }
            return session;
        }
    },
    session: {
        strategy: "jwt"
    },
    pages: {
        signIn: '/api/auth/signin',
    }
});

export { handler as GET, handler as POST }
