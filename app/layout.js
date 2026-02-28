import {
  ClerkProvider,
} from '@clerk/nextjs'
import { dark } from '@clerk/themes'
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Socratic AI",
  description: "AI-powered Socratic learning platform",
};

export default function RootLayout({ children }) {
  const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const hasValidKey = clerkKey && !clerkKey.includes("REPLACE_ME");

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        {hasValidKey ? (
          <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/landing" appearance={{ baseTheme: dark, variables: { colorPrimary: '#7c6bff' } }}>
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
