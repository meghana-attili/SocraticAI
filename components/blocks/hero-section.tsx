"use client";

import { Button } from "@/components/ui/button";
import { Glow } from "@/components/ui/glow";
import { cn } from "@/lib/utils";

interface HeroAction {
    text: string;
    onClick?: () => void;
    icon?: React.ReactNode;
    variant?: "default" | "glow" | "outline" | "secondary" | "ghost" | "link";
}

interface HeroProps {
    title: React.ReactNode;
    description: string;
    actions: HeroAction[];
}

export function HeroSection({
    title,
    description,
    actions,
}: HeroProps) {

    return (
        <section
            className={cn(
                "bg-background text-foreground relative",
                "flex flex-col items-center justify-center min-h-screen px-4",
                "overflow-hidden"
            )}
        >
            {/* Glow Background */}
            <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center">
                <Glow variant="center" className="animate-appear-zoom opacity-0 delay-500" />
            </div>

            <div className="relative z-10 mx-auto flex max-w-container flex-col gap-8 sm:gap-12">
                <div className="flex flex-col items-center gap-6 text-center sm:gap-10">

                    {/* Title */}
                    <h1 className="animate-appear bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent drop-shadow-2xl font-normal leading-none" style={{ fontSize: "clamp(60px, 12vw, 150px)", fontFamily: "'Instrument Serif', serif", letterSpacing: "-0.02em" }}>
                        {title}
                    </h1>

                    {/* Description */}
                    <p className="text-md max-w-[600px] animate-appear font-medium text-muted-foreground opacity-0 delay-100 sm:text-lg">
                        {description}
                    </p>

                    {/* Actions */}
                    <div className="flex animate-appear justify-center gap-4 opacity-0 delay-300 mt-4">
                        {actions.map((action, index) => (
                            <Button key={index} variant={action.variant} size="lg" onClick={action.onClick} className="text-base font-semibold px-8 py-6 rounded-xl">
                                {action.icon}
                                {action.text}
                            </Button>
                        ))}
                    </div>

                </div>
            </div>
        </section>
    );
}
