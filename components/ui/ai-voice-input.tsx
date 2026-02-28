"use client";

import { Mic, Square } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";

interface AIVoiceInputProps {
    onTranscript?: (text: string) => void;
    onStart?: () => void;
    onStop?: (duration: number) => void;
    visualizerBars?: number;
    accentColor?: string;
}

export function AIVoiceInput({
    onTranscript,
    onStart,
    onStop,
    visualizerBars = 32,
    accentColor = "#7c6bff",
}: AIVoiceInputProps) {
    const [listening, setListening] = useState(false);
    const [time, setTime] = useState(0);
    const [barHeights, setBarHeights] = useState<number[]>([]);
    const [supported, setSupported] = useState(true);
    const recognitionRef = useRef<any>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const animRef = useRef<NodeJS.Timeout | null>(null);

    // Check browser support
    useEffect(() => {
        const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SR) {
            setSupported(false);
            return;
        }
        const recognition = new SR();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";

        recognition.onresult = (event: any) => {
            let finalTranscript = "";
            for (let i = event.resultIndex; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }
            if (finalTranscript && onTranscript) {
                onTranscript(finalTranscript);
            }
        };

        recognition.onerror = () => {
            setListening(false);
        };

        recognition.onend = () => {
            setListening(false);
        };

        recognitionRef.current = recognition;
    }, [onTranscript]);

    // Timer
    useEffect(() => {
        if (listening) {
            timerRef.current = setInterval(() => setTime((t) => t + 1), 1000);
        } else {
            if (timerRef.current) clearInterval(timerRef.current);
            setTime(0);
        }
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [listening]);

    // Visualizer animation
    useEffect(() => {
        if (listening) {
            const animate = () => {
                setBarHeights(
                    Array.from({ length: visualizerBars }, () => 15 + Math.random() * 85)
                );
                animRef.current = setTimeout(animate, 120);
            };
            animate();
        } else {
            if (animRef.current) clearTimeout(animRef.current);
            setBarHeights(Array.from({ length: visualizerBars }, () => 8));
        }
        return () => {
            if (animRef.current) clearTimeout(animRef.current);
        };
    }, [listening, visualizerBars]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    };

    const toggle = useCallback(() => {
        if (!recognitionRef.current) return;
        if (listening) {
            recognitionRef.current.stop();
            setListening(false);
            onStop?.(time);
        } else {
            try {
                recognitionRef.current.start();
                setListening(true);
                onStart?.();
            } catch {
                // already started
            }
        }
    }, [listening, time, onStart, onStop]);

    if (!supported) return null;

    return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "8px 0" }}>
            {/* Mic button */}
            <button
                type="button"
                onClick={toggle}
                style={{
                    width: 48,
                    height: 48,
                    borderRadius: 14,
                    border: "none",
                    background: listening ? `${accentColor}22` : "transparent",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all .2s",
                    outline: listening ? `2px solid ${accentColor}` : "none",
                    outlineOffset: 2,
                }}
                title={listening ? "Stop recording" : "Voice input"}
            >
                {listening ? (
                    <Square
                        size={18}
                        style={{
                            color: accentColor,
                            animation: "spin 3s linear infinite",
                        }}
                    />
                ) : (
                    <Mic size={20} style={{ color: "rgba(255,255,255,0.55)" }} />
                )}
            </button>

            {/* Timer */}
            <span
                style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    color: listening ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.25)",
                    transition: "color .3s",
                }}
            >
                {formatTime(time)}
            </span>

            {/* Visualizer bars */}
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 1.5,
                    height: 20,
                    width: 180,
                }}
            >
                {barHeights.map((h, i) => (
                    <div
                        key={i}
                        style={{
                            width: 2,
                            borderRadius: 2,
                            transition: "height .12s ease, background .3s",
                            height: `${listening ? h : 8}%`,
                            background: listening
                                ? `${accentColor}88`
                                : "rgba(255,255,255,0.08)",
                        }}
                    />
                ))}
            </div>

            {/* Label */}
            <p
                style={{
                    fontSize: 11,
                    color: listening ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.3)",
                    margin: 0,
                    height: 16,
                }}
            >
                {listening ? "Listening..." : "Click to speak"}
            </p>

            {/* CSS for spin animation */}
            <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
        </div>
    );
}
