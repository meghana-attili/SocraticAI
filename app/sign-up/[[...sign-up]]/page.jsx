"use client";

import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { FONTS } from "@/lib/theme";

export default function SignUpPage() {
    return (
        <div style={{
            minHeight: "100vh",
            background: "#07070f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'Syne', sans-serif",
            position: "relative",
            overflow: "hidden",
        }}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Instrument+Serif:ital@0;1&display=swap');
            `}</style>

            {/* Background glow */}
            <div style={{
                position: "absolute", top: "30%", left: "50%", transform: "translate(-50%, -50%)",
                width: 500, height: 500, borderRadius: "50%",
                background: "radial-gradient(circle, rgba(124,107,255,0.10) 0%, transparent 70%)",
                filter: "blur(80px)", pointerEvents: "none",
            }} />

            <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                gap: 24, position: "relative", zIndex: 1,
            }}>
                {/* Logo — uses Instrument Serif, no sparkle icon */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontFamily: FONTS.title, fontSize: 28, color: "rgba(255,255,255,0.92)", letterSpacing: -0.5 }}>
                        Socratic<span style={{ fontStyle: "italic", color: "#7c6bff" }}>AI</span>
                    </span>
                </div>

                {/* Clerk SignUp component */}
                <SignUp
                    appearance={{
                        baseTheme: dark,
                        variables: {
                            colorPrimary: "#7c6bff",
                            colorBackground: "#0d0d1a",
                            colorInputBackground: "rgba(255,255,255,0.04)",
                            colorInputText: "rgba(255,255,255,0.88)",
                            borderRadius: "12px",
                            fontFamily: "'Syne', sans-serif",
                        },
                        elements: {
                            card: {
                                border: "1px solid rgba(255,255,255,0.07)",
                                boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
                            },
                        },
                    }}
                    routing="path"
                    path="/sign-up"
                    signInUrl="/login"
                    forceRedirectUrl="/"
                />
            </div>
        </div>
    );
}
