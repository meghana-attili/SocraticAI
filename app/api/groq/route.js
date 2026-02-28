import { NextResponse } from 'next/server';

export async function POST(request) {
    try {
        const { messages, systemPrompt, maxTokens = 600 } = await request.json();
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'GROQ_API_KEY not set in .env' }, { status: 500 });
        }

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [{ role: "system", content: systemPrompt }, ...messages],
                temperature: 0.75,
                max_tokens: maxTokens,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({ error: data?.error?.message || 'Groq API error' }, { status: res.status });
        }

        return NextResponse.json({ content: data.choices?.[0]?.message?.content || "" });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
