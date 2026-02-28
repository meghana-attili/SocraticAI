import { NextResponse } from 'next/server';

const SYSTEM_PROMPT = `You are a curriculum designer. Generate a knowledge path graph from a START node to a GOAL node.

Respond ONLY with valid JSON (no markdown, no backticks):
{
  "subject": "...",
  "tip": "One sentence: recommended learning path strategy for this level",
  "nodes": [
    {
      "id": "start",
      "label": "My Starting Point",
      "description": "Student's current knowledge state",
      "type": "start",
      "connections": ["c1","c2"],
      "estimatedHours": 0
    },
    {
      "id": "c1",
      "label": "Concept Name",
      "description": "One sentence what this concept is",
      "type": "concept",
      "connections": ["c3"],
      "estimatedHours": 4
    },
    {
      "id": "goal",
      "label": "My Goal",
      "description": "Student's target outcome",
      "type": "goal",
      "connections": [],
      "estimatedHours": 0
    }
  ]
}

Rules:
- ALWAYS include exactly one node with id "start" and one with id "goal"
- Generate 8-12 concept nodes between start and goal
- connections = list of node ids this node points TO (directed graph)
- Every concept node must have at least one incoming and one outgoing connection
- start node connects to 1-3 first concepts; final concepts connect to goal
- Concepts can branch and merge — not strictly linear
- Keep labels short (2-4 words)
- estimatedHours 1-8 per concept
- tip should be specific to the subject and student level`;

export async function POST(request) {
    try {
        const { subject, level, goal, syllabus, deadline, hoursPerWeek } = await request.json();
        const apiKey = process.env.GROQ_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 });
        }

        const userPrompt = `Subject: ${subject}
Current Level: ${level}
Target Goal: ${goal}
${syllabus ? `Syllabus/Curriculum:\n${syllabus}` : ''}
${deadline ? `Deadline: ${deadline}` : ''}
${hoursPerWeek ? `Hours available per week: ${hoursPerWeek}` : ''}

Generate the knowledge constellation map for this student.`;

        const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: userPrompt },
                ],
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json({ error: data?.error?.message || 'Groq API error' }, { status: res.status });
        }

        const raw = data.choices?.[0]?.message?.content || "";
        const clean = raw.replace(/```json|```/gi, "").trim();

        try {
            const parsed = JSON.parse(clean);
            return NextResponse.json({
                nodes: parsed.nodes || [],
                tip: parsed.tip || '',
                subject: parsed.subject || subject,
            });
        } catch (parseErr) {
            return NextResponse.json({ error: 'Failed to parse AI response', raw }, { status: 500 });
        }
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
