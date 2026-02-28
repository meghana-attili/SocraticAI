"use client";

import { useRouter } from "next/navigation";
import { HeroSection } from "@/components/blocks/hero-section";

export default function LandingPage() {
    const router = useRouter();

    return (
        <main className="bg-background min-h-screen font-['Syne',sans-serif]">
            <HeroSection
                title={
                    <>
                        Socratic<span className="italic text-brand">AI</span>
                    </>
                }
                description="Learn deeply through AI-driven Socratic dialogue. Question everything. Understand anything."
                actions={[
                    {
                        text: "Get Started",
                        variant: "glow",
                        onClick: () => router.push("/login"),
                    }
                ]}
            />
        </main>
    );
}
