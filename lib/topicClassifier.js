/**
 * Ontology-Driven Topic Classifier
 * 
 * 3-tier classification pipeline:
 *   Tier 1: Exact match (free)
 *   Tier 2: Token similarity scoring (free)
 *   Tier 3: LLM fallback via Groq (1 API call)
 * 
 * Never creates new labels — always maps to an existing canonical node.
 */

// ─── Tier 1: Exact Match ─────────────────────────
function exactMatch(inputText, canonicalNodes) {
    const lower = inputText.toLowerCase().trim();
    for (const node of canonicalNodes) {
        if (!node.label) continue;
        if (node.label.toLowerCase() === lower) {
            return { nodeId: node.id, nodeLabel: node.label, confidence: 1.0, tier: 1 };
        }
    }
    return null;
}

// ─── Tier 2: Token Similarity Scoring ────────────
function tokenize(text) {
    return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/).filter(w => w.length > 2);
}

function tokenSimilarity(inputText, canonicalNodes) {
    const inputTokens = tokenize(inputText);
    if (inputTokens.length === 0) return null;

    let bestNode = null;
    let bestScore = 0;

    for (const node of canonicalNodes) {
        if (!node.label) continue;
        let score = 0;

        // Match against node label (weighted heavily)
        const labelTokens = tokenize(node.label);
        for (const lt of labelTokens) {
            for (const it of inputTokens) {
                if (it === lt) score += 4;
                else if (it.includes(lt) || lt.includes(it)) score += 2;
            }
        }

        // Match against node description
        if (node.description) {
            const descTokens = tokenize(node.description);
            for (const dt of descTokens) {
                if (dt.length < 4) continue; // skip short description words
                for (const it of inputTokens) {
                    if (it === dt) score += 1;
                    else if (it.includes(dt) || dt.includes(it)) score += 0.5;
                }
            }
        }

        // Bonus: if the full node label appears as a substring in the input
        if (inputText.toLowerCase().includes(node.label.toLowerCase())) {
            score += 6;
        }

        if (score > bestScore) {
            bestScore = score;
            bestNode = node;
        }
    }

    if (bestNode && bestScore >= 2) {
        // Normalize confidence: cap at 1.0
        const confidence = Math.min(1.0, bestScore / 10);
        return { nodeId: bestNode.id, nodeLabel: bestNode.label, confidence, tier: 2 };
    }

    return null;
}

// ─── Tier 3: LLM Classification via Groq ─────────
async function llmClassify(inputText, canonicalNodes) {
    const nodeList = canonicalNodes
        .filter(n => n.label)
        .map((n, i) => `${i + 1}. "${n.label}"${n.description ? ` — ${n.description}` : ''}`)
        .join('\n');

    const prompt = `You are a topic classifier. Given the input text and a list of canonical topics, respond with ONLY the exact topic name that best matches. If none match well, pick the closest one.

CANONICAL TOPICS:
${nodeList}

INPUT: "${inputText}"

Respond with ONLY the exact topic name from the list above, nothing else.`;

    try {
        const res = await fetch('/api/groq', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                messages: [{ role: 'user', content: prompt }],
                systemPrompt: 'You are a precise topic classifier. Respond with only the exact topic name.',
                maxTokens: 50,
            }),
        });
        const data = await res.json();
        if (!res.ok) return null;

        const response = (data.content || '').trim().replace(/^["']|["']$/g, '');

        // Find matching node
        for (const node of canonicalNodes) {
            if (!node.label) continue;
            if (node.label.toLowerCase() === response.toLowerCase()) {
                return { nodeId: node.id, nodeLabel: node.label, confidence: 0.85, tier: 3 };
            }
        }

        // Fuzzy fallback: check if response contains or is contained by a node label
        for (const node of canonicalNodes) {
            if (!node.label) continue;
            if (response.toLowerCase().includes(node.label.toLowerCase()) ||
                node.label.toLowerCase().includes(response.toLowerCase())) {
                return { nodeId: node.id, nodeLabel: node.label, confidence: 0.7, tier: 3 };
            }
        }
    } catch {
        // LLM failed — fall through
    }
    return null;
}

// ─── Public API ──────────────────────────────────

/**
 * Synchronous classification (Tier 1 + Tier 2 only).
 * Use this in the hot path — no API calls.
 */
export function classifyTopic(inputText, canonicalNodes) {
    if (!inputText || !canonicalNodes || canonicalNodes.length === 0) {
        return { nodeId: null, nodeLabel: inputText, confidence: 0, tier: 0 };
    }

    // Only use concept nodes (not start/goal type nodes)
    const concepts = canonicalNodes.filter(n => n.type === 'concept' || !n.type);

    // Tier 1: Exact match
    const exact = exactMatch(inputText, concepts);
    if (exact) return exact;

    // Tier 2: Token similarity
    const similar = tokenSimilarity(inputText, concepts);
    if (similar) return similar;

    // No match — return the input as-is with zero confidence
    // The caller can optionally invoke classifyTopicWithLLM for tier 3
    return { nodeId: null, nodeLabel: inputText, confidence: 0, tier: 0 };
}

/**
 * Async classification with LLM fallback (Tier 1 + 2 + 3).
 * Use when accuracy matters more than speed.
 */
export async function classifyTopicWithLLM(inputText, canonicalNodes) {
    if (!inputText || !canonicalNodes || canonicalNodes.length === 0) {
        return { nodeId: null, nodeLabel: inputText, confidence: 0, tier: 0 };
    }

    const concepts = canonicalNodes.filter(n => n.type === 'concept' || !n.type);

    // Tier 1 + 2 first
    const syncResult = classifyTopic(inputText, concepts);
    if (syncResult.confidence >= 0.5) return syncResult;

    // Tier 3: LLM fallback
    const llmResult = await llmClassify(inputText, concepts);
    if (llmResult) return llmResult;

    // Absolute fallback: assign to first concept node
    if (concepts.length > 0) {
        return { nodeId: concepts[0].id, nodeLabel: concepts[0].label, confidence: 0.3, tier: 0 };
    }

    return syncResult;
}

/**
 * Compute strength level from mastery data.
 */
export function getStrength(data) {
    if (!data) return 'weak';
    const pct = data.manualOverride != null
        ? data.manualOverride
        : data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
    if (pct >= 70) return 'strong';
    if (pct >= 40) return 'medium';
    return 'weak';
}

export const STRENGTH_COLORS = {
    weak: '#f05c7a',
    medium: '#f6a430',
    strong: '#22d3a0',
};
