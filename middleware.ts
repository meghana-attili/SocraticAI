import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

const isPublicRoute = createRouteMatcher([
    '/landing(.*)',
    '/login(.*)',
    '/sign-up(.*)',
    '/api(.*)',
])

export default clerkMiddleware(async (auth, request) => {
    if (!isPublicRoute(request)) {
        const { userId } = await auth()
        if (!userId) {
            return NextResponse.redirect(new URL('/landing', request.url))
        }
    }
})

export const config = {
    matcher: [
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        '/(api|trpc)(.*)',
    ],
}
