import { NextResponse } from 'next/server';

const ANALYSIS_PROMPT = `You are an intelligent document analysis engine called InsightCanvas.
The user has selected a region from a document. Analyze the content and respond with structured JSON (no markdown, no backticks):

{
  "contentType": "text" | "equation" | "diagram" | "graph" | "code",
  "explanation": "Clear, comprehensive explanation of what this content represents",
  "keyConcepts": ["concept1", "concept2", "concept3"],
  "steps": [
    { "step": 1, "title": "Step title", "detail": "Step explanation" }
  ],
  "commonMisconceptions": ["misconception1"],
  "latex": "Full LaTeX representation if this is a mathematical equation, otherwise null",
  "whyItMatters": "Brief explanation of why this concept/content is important",
  "visualParts": [
    { "partLatex": "LaTeX of this component", "label": "Short name", "color": "#hex", "explanation": "What this part means" }
  ]
}

Rules:
- If it's a mathematical equation, ALWAYS extract the full LaTeX representation in the "latex" field
- If it's a mathematical equation, ALWAYS provide "visualParts" — break the equation into 3-6 key visual components
  - Each visualPart should have valid LaTeX in "partLatex"
  - Use these colors: "#7c6bff" (purple), "#22d3a0" (green), "#f6a430" (amber), "#f05c7a" (red), "#60a5fa" (blue)
  - "label" should be 1-3 words (e.g. "Integral", "Denominator", "Sine function")
- If NOT an equation, set visualParts to null
- steps should break down the concept or equation into digestible parts
- keyConcepts should be 3-5 key terms extracted from the content
- Be thorough but concise
- Respond ONLY with valid JSON`;

export async function POST(request) {
    try {
        const { type, content, context } = await request.json();
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 });
        }

        let messages;
        let model;

        if (type === 'image') {
            // Use vision model for image/region selections
            model = 'meta-llama/llama-4-scout-17b-16e-instruct';
            messages = [
                { role: 'system', content: ANALYSIS_PROMPT },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: `Analyze this selected document region.${context ? ` Context: ${context}` : ''}` },
                        { type: 'image_url', image_url: { url: content } },
                    ],
                },
            ];
        } else {
            // Text selection — use standard text model
            model = 'llama-3.3-70b-versatile';
            messages = [
                { role: 'system', content: ANALYSIS_PROMPT },
                {
                    role: 'user',
                    content: `Analyze this selected text from a document:\n\n"${content}"${context ? `\n\nAdditional context: ${context}` : ''}`,
                },
            ];
        }

        const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                messages,
                temperature: 0.5,
                max_tokens: 2000,
                response_format: { type: 'json_object' },
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({ error: data?.error?.message || 'Groq API error' }, { status: res.status });
        }

        const raw = data.choices?.[0]?.message?.content || '';
        try {
            // Strip markdown code fences and any surrounding text
            let clean = raw.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

            // If the response has text before/after the JSON, extract just the JSON object
            const jsonStart = clean.indexOf('{');
            const jsonEnd = clean.lastIndexOf('}');
            if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
                clean = clean.slice(jsonStart, jsonEnd + 1);
            }

            const parsed = JSON.parse(clean);

            // Validate expected fields exist
            return NextResponse.json({
                contentType: parsed.contentType || (type === 'image' ? 'unknown' : 'text'),
                explanation: parsed.explanation || 'No explanation provided.',
                keyConcepts: Array.isArray(parsed.keyConcepts) ? parsed.keyConcepts : [],
                steps: Array.isArray(parsed.steps) ? parsed.steps : [],
                commonMisconceptions: Array.isArray(parsed.commonMisconceptions) ? parsed.commonMisconceptions : [],
                latex: parsed.latex || null,
                whyItMatters: parsed.whyItMatters || '',
                visualParts: Array.isArray(parsed.visualParts) ? parsed.visualParts : null,
            });
        } catch {
            // If JSON parsing fails, return raw text as explanation
            return NextResponse.json({
                contentType: type === 'image' ? 'unknown' : 'text',
                explanation: raw,
                keyConcepts: [],
                steps: [],
                latex: null,
                whyItMatters: '',
                visualParts: null,
            });
        }
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
