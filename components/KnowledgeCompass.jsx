'use client';

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { ShootingStars } from "@/components/ui/shooting-stars";
import { C, FONTS } from "@/lib/theme";
import {
    computeMastery, computePriority, computeForgettingRisk,
    getTopicState, getNodeVisuals, sessionCascade, isUnlocked,
    computeExpansionRadius, STATES,
} from '@/lib/ldagEngine';

// ─── Theme handled in @/lib/theme ───

const LEVEL_COLORS = {
    foundation: '#22d3a0', core: '#7c6bff', advanced: '#f6a430',
};

function Badge({ children, color = C.accent }) {
    return (
        <span style={{
            background: `${color}22`, border: `1px solid ${color}44`,
            borderRadius: 100, padding: "2px 10px", fontSize: 11,
            color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
        }}>{children}</span>
    );
}

function Card({ children, style = {}, glow }) {
    return (
        <div style={{
            background: C.surface, border: `1px solid ${glow ? C.accentBorder : C.border}`,
            borderRadius: 16, padding: 20,
            boxShadow: glow ? "0 0 32px rgba(124,107,255,0.12)" : "none",
            ...style,
        }}>{children}</div>
    );
}

function Btn({ children, onClick, variant = "primary", disabled, style = {}, small }) {
    const base = {
        border: "none", cursor: disabled ? "not-allowed" : "pointer",
        borderRadius: 10, fontFamily: "inherit", fontWeight: 600,
        fontSize: small ? 12 : 14, transition: "all .18s",
        padding: small ? "6px 14px" : "10px 20px",
        opacity: disabled ? 0.45 : 1, ...style,
    };
    if (variant === "primary") return <button onClick={onClick} disabled={disabled} style={{ ...base, background: "linear-gradient(135deg,#7c6bff,#a78bfa)", color: "#fff" }}>{children}</button>;
    if (variant === "ghost") return <button onClick={onClick} disabled={disabled} style={{ ...base, background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>{children}</button>;
    return <button onClick={onClick} disabled={disabled} style={{ ...base, background: "linear-gradient(135deg,#22d3a0,#059669)", color: "#fff" }}>{children}</button>;
}

function Spinner() {
    return (
        <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "8px 0" }}>
            {[0, .2, .4].map((d, i) => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: C.accent, animation: `blink 1.4s ${d}s infinite` }} />
            ))}
        </div>
    );
}

// ─── Graph prompt — generates branching nodes ────
const COMPASS_PROMPT = `You are a curriculum designer. Generate a knowledge path graph from a START node to a GOAL node.

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

const LEVEL_TIPS = {
    "complete beginner": "Start at the leftmost stars and work right. Don't skip — every connection matters.",
    "beginner": "Follow the brightest path from Start to Goal. Tackle foundation nodes before branching.",
    "intermediate": "You can tackle some nodes in parallel. Look for branches you can work on simultaneously.",
    "advanced": "Focus on the nodes closest to Goal first — fill gaps rather than rebuilding from scratch.",
};

// ─── Graph layout: BFS layers ────────────────────
function computeLayout(nodes) {
    if (!nodes.length) return {};
    const W = 780, H = 400;
    const pos = {};
    const startNode = nodes.find(n => n.type === "start") || nodes[0];
    const layers = {};
    const visited = new Set();
    const queue = [{ id: startNode.id, layer: 0 }];

    while (queue.length) {
        const { id, layer } = queue.shift();
        if (visited.has(id)) continue;
        visited.add(id);
        if (!layers[layer]) layers[layer] = [];
        layers[layer].push(id);
        const node = nodes.find(n => n.id === id);
        (node?.connections || []).forEach(cid => {
            if (!visited.has(cid)) queue.push({ id: cid, layer: layer + 1 });
        });
    }

    nodes.forEach(n => {
        if (!visited.has(n.id)) {
            const maxLayer = Math.max(...Object.keys(layers).map(Number), 0);
            if (!layers[maxLayer + 1]) layers[maxLayer + 1] = [];
            layers[maxLayer + 1].push(n.id);
        }
    });

    const layerCount = Object.keys(layers).length;
    Object.entries(layers).forEach(([layer, ids]) => {
        const lNum = parseInt(layer);
        const x = layerCount <= 1 ? W / 2 : (lNum / (layerCount - 1)) * (W - 120) + 60;
        ids.forEach((id, i) => {
            const y = (H / (ids.length + 1)) * (i + 1);
            const node = nodes.find(n => n.id === id);
            const jitter = node?.type === "concept" ? (Math.random() * 20 - 10) : 0;
            pos[id] = { x, y: y + jitter };
        });
    });

    return pos;
}

// ─── Constellation Canvas (SVG graph) ────────────
function ConstellationCanvas({ nodes, masteryData, onNodeClick, selectedId, focusTopicId }) {
    const [hoverId, setHoverId] = useState(null);
    const [positions, setPositions] = useState({});
    const [allMapped, setAllMapped] = useState(false);
    const [showCelebration, setShowCelebration] = useState(false);
    const prevAllMapped = useRef(false);

    useEffect(() => {
        if (!nodes.length) return;
        setPositions(computeLayout(nodes));
    }, [nodes]);

    const getNodeState = useCallback((node) => {
        if (!node || !node.label) return "dim";
        if (node.type === "start") return "start";
        if (node.type === "goal") return "goal";

        // Manual score (slider) always takes visual precedence when set — ephemeral, never persisted
        if (node.manualScore != null && node.manualScore > 0) {
            if (node.manualScore >= 70) return "green";
            if (node.manualScore >= 40) return "amber";
            return "red";
        }

        // Fall back to real mastery data from master tracker (the source of truth)
        const label = node.label.toLowerCase();
        const ms = Object.entries(masteryData).find(([k]) =>
            k.toLowerCase() === label || k.toLowerCase().includes(label) || label.includes(k.toLowerCase())
        );
        if (ms && ms[1].total > 0) {
            const pct = ms[1].manualOverride != null ? ms[1].manualOverride / 100 : ms[1].correct / ms[1].total;
            if (pct >= 0.7) return "green";
            if (pct >= 0.4) return "amber";
            return "red";
        }
        return "dim";
    }, [masteryData]);

    const conceptNodes = nodes.filter(n => n.type === "concept");

    useEffect(() => {
        if (!conceptNodes.length) return;
        const allGreen = conceptNodes.every(n => getNodeState(n) === "green");
        if (allGreen && !prevAllMapped.current) {
            prevAllMapped.current = true;
            setAllMapped(true);
            setTimeout(() => setShowCelebration(true), 500);
        } else if (!allGreen && prevAllMapped.current) {
            prevAllMapped.current = false;
            setAllMapped(false);
            setShowCelebration(false);
        }
    });

    if (!nodes.length || !Object.keys(positions).length) return null;

    // Edges renderer
    const renderEdges = () => {
        const edges = [];
        nodes.forEach(node => {
            (node.connections || []).forEach(targetId => {
                const from = positions[node.id];
                const to = positions[targetId];
                if (!from || !to) return;
                const targetNode = nodes.find(n => n.id === targetId);
                if (!targetNode) return;
                const fromState = getNodeState(node);
                const toState = getNodeState(targetNode);
                const bothLit = (fromState === "green" || fromState === "start") && (toState === "green" || toState === "goal");
                edges.push(
                    <line key={`${node.id}-${targetId}`}
                        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                        stroke={bothLit ? "rgba(34,211,160,0.55)" : "rgba(255,255,255,0.06)"}
                        strokeWidth={bothLit ? 2 : 1}
                        strokeDasharray={bothLit ? "none" : "4 3"}
                        style={{ transition: "all 0.8s ease" }} />
                );
            });
        });
        return edges;
    };

    return (
        <div style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: 20 }}>
            <div style={{
                background: allMapped
                    ? "radial-gradient(ellipse at 50% 50%, rgba(34,211,160,0.08) 0%, rgba(124,107,255,0.05) 50%, transparent 70%), #07070f"
                    : "radial-gradient(ellipse at 25% 50%, rgba(124,107,255,0.06) 0%, transparent 60%), #07070f",
                border: `1px solid ${allMapped ? "rgba(34,211,160,0.3)" : "rgba(255,255,255,0.06)"}`,
                padding: "20px", position: "relative", aspectRatio: "780 / 420", transition: "all 0.8s ease"
            }}>
                {allMapped && (
                    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0 }}>
                        <div style={{
                            position: "absolute", inset: 0, opacity: 0.5,
                            backgroundImage: "radial-gradient(2px 2px at 20px 30px, #eee, rgba(0,0,0,0)), radial-gradient(2px 2px at 40px 70px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 50px 160px, #ddd, rgba(0,0,0,0)), radial-gradient(2px 2px at 90px 40px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 130px 80px, #fff, rgba(0,0,0,0)), radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0))",
                            backgroundRepeat: "repeat", backgroundSize: "200px 200px",
                            animation: "twinkle 5s ease-in-out infinite"
                        }} />
                        <ShootingStars starColor="#9E00FF" trailColor="#2EB9DF" minSpeed={15} maxSpeed={35} minDelay={500} maxDelay={1500} />
                        <ShootingStars starColor="#FF0099" trailColor="#FFB800" minSpeed={10} maxSpeed={25} minDelay={1000} maxDelay={2000} />
                        <ShootingStars starColor="#00FF9E" trailColor="#00B8FF" minSpeed={20} maxSpeed={40} minDelay={800} maxDelay={1800} />
                    </div>
                )}
                <style>{`
                    @keyframes twinkle {
                        0% { opacity: 0.5; }
                        50% { opacity: 0.8; }
                        100% { opacity: 0.5; }
                    }
                `}</style>
                <svg viewBox="0 0 780 400" preserveAspectRatio="xMidYMid meet" style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", zIndex: 1 }}>
                    {/* Starfield */}
                    {Array.from({ length: 22 }).map((_, i) =>
                        Array.from({ length: 11 }).map((__, j) => (
                            <circle key={`${i}-${j}`} cx={i * 36} cy={j * 38 + 10} r={0.7} fill="rgba(255,255,255,0.04)" />
                        ))
                    )}
                    {/* Edges */}
                    {renderEdges()}
                    {/* Nodes */}
                    {nodes.map(node => {
                        const pos = positions[node.id];
                        if (!pos) return null;
                        const state = getNodeState(node);
                        const isSelected = selectedId === node.id;
                        const isHover = hoverId === node.id;
                        const isStart = node.type === "start";
                        const isGoal = node.type === "goal";
                        const isGreen = state === "green";
                        const isAmber = state === "amber";
                        const isRed = state === "red";
                        const focused = focusTopicId && (node.id === focusTopicId || node.label?.toLowerCase().includes(focusTopicId?.toLowerCase()));

                        const r = isGoal ? 18 : isStart ? 16 : focused ? 14 : 11;
                        const fill = isStart ? "#7c6bff"
                            : isGoal ? (allMapped ? "#22d3a0" : "#a78bfa")
                                : isGreen ? "#22d3a0" : isAmber ? "#f6a430"
                                    : isRed ? "#f05c7a"
                                        : "rgba(255,255,255,0.13)";
                        const glowColor = isStart ? "rgba(124,107,255,0.7)"
                            : isGoal ? "rgba(167,139,250,0.7)"
                                : isGreen ? "rgba(34,211,160,0.7)" : isAmber ? "rgba(246,164,48,0.5)"
                                    : isRed ? "rgba(240,92,122,0.5)" : "none";

                        return (
                            <g key={node.id} style={{ cursor: "pointer" }}
                                onClick={() => onNodeClick(node)}
                                onMouseEnter={() => setHoverId(node.id)}
                                onMouseLeave={() => setHoverId(null)}>
                                {(isStart || isGoal || isGreen) && (
                                    <circle cx={pos.x} cy={pos.y} r={r + 14}
                                        fill={isStart ? "rgba(124,107,255,0.07)" : isGoal ? "rgba(167,139,250,0.07)" : "rgba(34,211,160,0.06)"}
                                        style={{ animation: "pulse 2.5s ease-in-out infinite" }} />
                                )}
                                {(isSelected || isHover || focused) && (
                                    <circle cx={pos.x} cy={pos.y} r={r + 6} fill="none"
                                        stroke={focused ? "#fff" : isSelected ? "#7c6bff" : "rgba(255,255,255,0.3)"} strokeWidth={focused ? 2 : 1.5} />
                                )}
                                {isGoal && (
                                    <circle cx={pos.x} cy={pos.y} r={r + 4} fill="none"
                                        stroke={allMapped ? "rgba(34,211,160,0.5)" : "rgba(167,139,250,0.3)"}
                                        strokeWidth={1} strokeDasharray={allMapped ? "none" : "4 3"} />
                                )}
                                <circle cx={pos.x} cy={pos.y} r={r} fill={focused ? "#fff" : fill}
                                    style={{
                                        filter: (isStart || isGoal || isGreen || isAmber || isRed || focused) ? `drop-shadow(0 0 ${isGoal || isStart ? 10 : isGreen ? 8 : 4}px ${focused ? "rgba(255,255,255,0.7)" : glowColor})` : "none",
                                        transition: "fill 0.7s ease, filter 0.7s ease",
                                    }} />
                                {isStart && <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={7} fontFamily="'JetBrains Mono',monospace" fontWeight={700}>START</text>}
                                {isGoal && <text x={pos.x} y={pos.y + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={7} fontFamily="'JetBrains Mono',monospace" fontWeight={700}>GOAL</text>}
                                {isGoal && (
                                    <>
                                        <line x1={pos.x} y1={pos.y - r - 7} x2={pos.x} y2={pos.y + r + 7} stroke={fill} strokeWidth={1.2} opacity={0.5} />
                                        <line x1={pos.x - r - 7} y1={pos.y} x2={pos.x + r + 7} y2={pos.y} stroke={fill} strokeWidth={1.2} opacity={0.5} />
                                    </>
                                )}
                                {node.type === "concept" && (
                                    <text x={pos.x} y={pos.y + r + 14} textAnchor="middle"
                                        fill={focused ? "#fff" : isGreen ? "rgba(255,255,255,0.95)" : isAmber ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.3)"}
                                        fontSize={9} fontFamily="'Syne',sans-serif" fontWeight={isGreen || focused ? 700 : 400}>
                                        {node.label.length > 14 ? node.label.slice(0, 13) + "…" : node.label}
                                    </text>
                                )}
                                {(isStart || isGoal) && (
                                    <text x={pos.x} y={pos.y + r + 16} textAnchor="middle"
                                        fill={isStart ? "rgba(124,107,255,0.7)" : "rgba(167,139,250,0.7)"}
                                        fontSize={9} fontFamily="'Syne',sans-serif" fontWeight={600}>
                                        {node.label.length > 16 ? node.label.slice(0, 15) + "…" : node.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Celebration banner */}
            {showCelebration && (
                <div style={{
                    marginTop: 14, background: "linear-gradient(135deg, rgba(34,211,160,0.1), rgba(124,107,255,0.1))",
                    border: "1px solid rgba(34,211,160,0.3)", borderRadius: 16, padding: "18px 22px",
                    display: "flex", alignItems: "center", gap: 16, animation: "fadeUp 0.5s ease both",
                }}>
                    <div style={{ fontSize: 32, animation: "pulse 1.5s ease-in-out infinite" }}>✦</div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: "'Instrument Serif',serif", fontSize: 19, color: "#22d3a0", fontStyle: "italic", marginBottom: 4 }}>
                            All constellations mapped — your night sky is complete. 🌌
                        </div>
                        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6 }}>
                            Every star between <strong style={{ color: "rgba(255,255,255,0.7)" }}>Start</strong> and <strong style={{ color: "#a78bfa" }}>Goal</strong> is glowing green.
                        </div>
                    </div>
                    <button onClick={() => setShowCelebration(false)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 18 }}>✕</button>
                </div>
            )}

            <style>{`
                @keyframes shootingStar { 0%{opacity:0;transform:translate(0,0);} 10%{opacity:1;} 100%{opacity:0;transform:translate(120px,50px);} }
                @keyframes pulse { 0%,100%{opacity:.35;} 50%{opacity:1;} }
            `}</style>
        </div>
    );
}

// ─── STEP 1: Syllabus Input Form ────────────────
function SyllabusForm({ onGenerate }) {
    const [subject, setSubject] = useState('');
    const [level, setLevel] = useState('beginner');
    const [goal, setGoal] = useState('');
    const [syllabus, setSyllabus] = useState('');
    const [deadline, setDeadline] = useState('');
    const [hoursPerWeek, setHoursPerWeek] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const levels = ['Complete Beginner', 'Beginner', 'Intermediate', 'Advanced'];

    const handleGenerate = async () => {
        if (!subject.trim()) { setError('Subject is required'); return; }
        if (!goal.trim()) { setError('Target goal is required'); return; }
        setLoading(true); setError('');
        try {
            const res = await fetch('/api/compass/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ subject, level, goal, syllabus, deadline, hoursPerWeek }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            // The API returns graph nodes now
            const nodes = data.nodes || data.topics || [];
            const tip = data.tip || '';
            onGenerate(nodes, { subject, level, goal, deadline, hoursPerWeek, tip });
        } catch (err) {
            setError(err.message || 'Failed to generate. Try again.');
        }
        setLoading(false);
    };

    const inputStyle = {
        width: '100%', background: 'rgba(255,255,255,0.04)',
        border: '1px solid ' + C.border, borderRadius: 12,
        padding: '12px 16px', color: C.text, fontSize: 14,
        fontFamily: 'inherit', transition: 'border-color .2s',
    };

    return (
        <div style={{ animation: 'fadeUp .4s ease both', maxWidth: 900, margin: '0 auto' }}>
            <h2 style={{ fontFamily: FONTS.title, fontSize: 36, color: C.text, marginBottom: 8 }}>
                Knowledge Compass
            </h2>
            <p style={{ color: C.muted, fontSize: 14, marginBottom: 32 }}>
                Map the journey from where you are to where you want to be.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 20 }}>
                    <label style={{ fontSize: 12, color: C.muted, marginBottom: 8, display: 'block' }}>Subject *</label>
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Machine Learning, Organic Chemistry..." style={inputStyle} />
                </div>
                <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 20 }}>
                    <label style={{ fontSize: 12, color: C.muted, marginBottom: 10, display: 'block' }}>Current Level *</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                        {levels.map(l => (
                            <button key={l} onClick={() => setLevel(l.toLowerCase())}
                                style={{
                                    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                    background: level === l.toLowerCase() ? C.accent : 'rgba(255,255,255,0.06)',
                                    border: '1px solid ' + (level === l.toLowerCase() ? C.accent : C.border),
                                    color: level === l.toLowerCase() ? '#fff' : C.muted, cursor: 'pointer', fontFamily: 'inherit',
                                }}>
                                {l}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: C.muted, marginBottom: 8, display: 'block' }}>Target Goal *</label>
                <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="e.g. Build and deploy a neural network, Pass GATE exam..." style={inputStyle} />
            </div>

            <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 20, marginBottom: 16 }}>
                <label style={{ fontSize: 12, color: C.muted, marginBottom: 8, display: 'block' }}>Syllabus / Curriculum (optional)</label>
                <textarea value={syllabus} onChange={e => setSyllabus(e.target.value)} placeholder="Paste your syllabus, course outline, or list of topics here..." rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 20 }}>
                    <label style={{ fontSize: 12, color: C.muted, marginBottom: 8, display: 'block' }}>Deadline</label>
                    <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} style={inputStyle} />
                </div>
                <div style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 16, padding: 20 }}>
                    <label style={{ fontSize: 12, color: C.muted, marginBottom: 8, display: 'block' }}>Hours available per week</label>
                    <input type="number" value={hoursPerWeek} onChange={e => setHoursPerWeek(e.target.value)} placeholder="e.g. 10" style={inputStyle} />
                </div>
            </div>

            {/* Level tip */}
            <div style={{ background: 'rgba(124,107,255,0.06)', border: '1px solid ' + C.accentBorder, borderRadius: 12, padding: '12px 16px', marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginBottom: 4 }}>💡 Path tip for {level}</div>
                <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{LEVEL_TIPS[level] || LEVEL_TIPS["beginner"]}</div>
            </div>

            {error && <div style={{ color: C.red, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}

            <button onClick={handleGenerate} disabled={loading}
                style={{
                    width: '100%', padding: '14px 24px', borderRadius: 14, border: 'none',
                    background: 'linear-gradient(135deg, #7c6bff, #a78bfa)', color: '#fff',
                    fontSize: 16, fontWeight: 700, cursor: loading ? 'wait' : 'pointer',
                    fontFamily: "'Syne', sans-serif", opacity: loading ? 0.7 : 1,
                }}>
                {loading ? '⏳ Mapping your constellation...' : '✦ Generate Constellation Map →'}
            </button>
        </div>
    );
}

// ─── STEP 2: Edit/Review nodes ──────────────────
function EditNodes({ nodes, meta, onSave, onRegenerate, onUpdate, aiTip }) {
    const [editingId, setEditingId] = useState(null);
    const addNode = () => {
        const newId = 'c' + Date.now();
        const lastConcept = [...nodes].reverse().find(n => n.type === "concept");
        const goalNode = nodes.find(n => n.type === "goal");
        let updated = [...nodes];
        if (lastConcept) {
            updated = updated.map(n => n.id === lastConcept.id ? { ...n, connections: [...(n.connections || []), newId] } : n);
        }
        updated.push({ id: newId, label: "New Concept", description: "", type: "concept", connections: goalNode ? [goalNode.id] : [], estimatedHours: 3, manualScore: null });
        onUpdate(updated);
        setEditingId(newId);
    };

    const updateNode = (id, changes) => onUpdate(nodes.map(n => n.id === id ? { ...n, ...changes } : n));
    const deleteNode = (id) => {
        const node = nodes.find(n => n.id === id);
        if (node?.type !== "concept") return;
        onUpdate(nodes.filter(n => n.id !== id).map(n => ({ ...n, connections: (n.connections || []).filter(c => c !== id) })));
    };

    return (
        <div style={{ animation: 'fadeUp .4s ease both' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontFamily: FONTS.title, fontSize: 32, color: C.text }}>Review Your Path</h2>
                    <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>AI suggested this constellation. Edit, then view the map.</p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Btn small variant="ghost" onClick={addNode}>+ Add Star</Btn>
                    <Btn small onClick={onSave}>View Constellation →</Btn>
                </div>
            </div>

            {aiTip && (
                <Card style={{ marginBottom: 16, padding: '12px 16px', background: 'rgba(34,211,160,0.06)', borderColor: 'rgba(34,211,160,0.25)' }}>
                    <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 4 }}>✦ AI path recommendation for {meta?.level}</div>
                    <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{aiTip}</div>
                </Card>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 10 }}>
                {nodes.map(n => {
                    const isEditing = editingId === n.id;
                    const isSpecial = n.type !== "concept";
                    const typeColor = n.type === "start" ? C.accent : n.type === "goal" ? "#a78bfa" : C.muted;
                    return (
                        <Card key={n.id} glow={isEditing}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Badge color={typeColor}>{n.type === "start" ? "🚀 Start" : n.type === "goal" ? "🎯 Goal" : "⭐ Concept"}</Badge>
                                {!isSpecial && (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={() => setEditingId(isEditing ? null : n.id)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer' }}>✏️</button>
                                        <button onClick={() => deleteNode(n.id)} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer' }}>✕</button>
                                    </div>
                                )}
                            </div>
                            {isEditing && !isSpecial ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                    <input value={n.label} onChange={e => updateNode(n.id, { label: e.target.value })}
                                        style={{ background: C.surface, border: '1px solid ' + C.accentBorder, borderRadius: 8, padding: '6px 10px', color: C.text, fontSize: 13, fontFamily: 'inherit' }} />
                                    <textarea rows={2} value={n.description} onChange={e => updateNode(n.id, { description: e.target.value })}
                                        style={{ background: C.surface, border: '1px solid ' + C.border, borderRadius: 8, padding: '6px 10px', color: C.text, fontSize: 12, fontFamily: 'inherit', resize: 'none' }} />
                                    <Btn small onClick={() => setEditingId(null)}>Done ✓</Btn>
                                </div>
                            ) : (
                                <>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: C.text, marginBottom: 4 }}>{n.label}</div>
                                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginBottom: 6 }}>{n.description}</div>
                                    {n.estimatedHours > 0 && <div style={{ fontSize: 11, color: C.faint }}>~{n.estimatedHours}h</div>}
                                    {n.connections?.length > 0 && (
                                        <div style={{ fontSize: 11, color: C.faint, marginTop: 4 }}>
                                            → {n.connections.map(cid => nodes.find(nd => nd.id === cid)?.label || cid).join(", ")}
                                        </div>
                                    )}
                                </>
                            )}
                        </Card>
                    );
                })}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                <Btn variant="ghost" small onClick={onRegenerate}>← Regenerate</Btn>
                <Btn small onClick={onSave}>View Constellation →</Btn>
            </div>
        </div>
    );
}

// ─── STEP 3: Constellation Map View ─────────────
function MapView({ nodes, meta, mastery, onBack, onReset, onUpdateNodes, focusTopicId, onNodeClick }) {
    const [selectedNode, setSelectedNode] = useState(null);

    const conceptNodes = nodes.filter(n => n.type === "concept");
    const lit = conceptNodes.filter(n => {
        // Manual score takes visual precedence when set (temporary simulation)
        if (n.manualScore != null && n.manualScore > 0) return n.manualScore >= 70;
        // Fall back to real mastery from tracker
        const label = n.label.toLowerCase();
        const ms = Object.entries(mastery || {}).find(([k]) => k.toLowerCase().includes(label) || label.includes(k.toLowerCase()));
        if (ms && ms[1].total > 0) return ms[1].correct / ms[1].total >= 0.7;
        return false;
    }).length;
    const progress = conceptNodes.length > 0 ? Math.round((lit / conceptNodes.length) * 100) : 0;

    const handleNodeClick = (node) => {
        setSelectedNode(node);
    };

    // Update node locally only — manualScore is ephemeral, not persisted
    const updateNode = (id, changes) => {
        onUpdateNodes(nodes.map(n => n.id === id ? { ...n, ...changes } : n));
        setSelectedNode(prev => prev?.id === id ? { ...prev, ...changes } : prev);
    };

    return (
        <div style={{ animation: 'fadeUp .4s ease both' }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <h2 style={{ fontFamily: FONTS.title, fontSize: 24, fontWeight: 400, color: C.text }}>{meta?.subject}</h2>
                        <Badge color={C.accent}>{meta?.level}</Badge>
                    </div>
                    <div style={{ fontSize: 13, color: C.muted }}>Goal: {meta?.goal}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Btn small variant="ghost" onClick={onBack}>Edit Stars</Btn>
                    <Btn small variant="ghost" onClick={onReset}>New Map</Btn>
                </div>
            </div>

            {/* Path tip */}
            {(meta?.tip || LEVEL_TIPS[meta?.level]) && (
                <div style={{ marginBottom: 14, padding: '10px 16px', background: 'rgba(124,107,255,0.07)', border: '1px solid ' + C.accentBorder, borderRadius: 12, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
                    <div>
                        <span style={{ fontSize: 12, color: C.accent, fontWeight: 700 }}>Path tip · {meta?.level}: </span>
                        <span style={{ fontSize: 12, color: C.muted }}>{meta?.tip || LEVEL_TIPS[meta?.level]}</span>
                    </div>
                </div>
            )}

            {/* Progress bar */}
            <Card style={{ marginBottom: 14, padding: '12px 18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                    <div style={{ display: 'flex', gap: 16 }}>
                        <span style={{ fontSize: 12, color: C.muted }}><span style={{ color: C.green, fontWeight: 700 }}>✦ {lit}</span> mastered</span>
                        <span style={{ fontSize: 12, color: C.muted }}><span style={{ color: C.faint, fontWeight: 700 }}>○ {conceptNodes.length - lit}</span> remaining</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "'JetBrains Mono',monospace", color: progress >= 70 ? C.green : progress >= 40 ? C.amber : C.accent }}>{progress}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: `linear-gradient(90deg, ${C.accent}, ${C.green})`, borderRadius: 4, transition: 'width .8s ease' }} />
                </div>
            </Card>

            {/* Graph canvas */}
            <ConstellationCanvas nodes={nodes} masteryData={mastery || {}} onNodeClick={handleNodeClick} selectedId={selectedNode?.id} focusTopicId={focusTopicId} />

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 10, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
                {[
                    { color: '#7c6bff', label: 'Start node' },
                    { color: '#a78bfa', label: 'Goal node' },
                    { color: C.green, label: 'Mastered (solid line)' },
                    { color: C.amber, label: 'In progress (dotted)' },
                ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                        <span style={{ fontSize: 11, color: C.muted }}>{item.label}</span>
                    </div>
                ))}
                <span style={{ fontSize: 11, color: C.faint, marginLeft: 'auto' }}>Click any star to update</span>
            </div>

            {/* Selected node panel */}
            {selectedNode && (
                <Card glow style={{ animation: 'fadeUp .3s ease both' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                                <div style={{ fontSize: 17, fontWeight: 800, color: C.text }}>{selectedNode.label}</div>
                                <Badge color={selectedNode.type === "start" ? C.accent : selectedNode.type === "goal" ? "#a78bfa" : C.muted}>
                                    {selectedNode.type === "start" ? "🚀 Start" : selectedNode.type === "goal" ? "🎯 Goal" : "⭐ Concept"}
                                </Badge>
                            </div>
                            <div style={{ fontSize: 13, color: C.muted }}>{selectedNode.description}</div>
                        </div>
                        <button onClick={() => setSelectedNode(null)} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
                    </div>
                    {selectedNode.estimatedHours > 0 && <div style={{ fontSize: 12, color: C.faint, marginBottom: 12 }}>~{selectedNode.estimatedHours}h estimated</div>}
                    {selectedNode.connections?.length > 0 && (
                        <div style={{ fontSize: 12, color: C.muted, marginBottom: 14 }}>
                            Leads to: {selectedNode.connections.map(cid => nodes.find(n => n.id === cid)?.label || cid).join(", ")}
                        </div>
                    )}
                    {selectedNode.type === "concept" && (
                        <div>
                            <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Confidence (visual only)</div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                                <input type="range" min={0} max={100} value={selectedNode.manualScore ?? 0}
                                    onChange={e => updateNode(selectedNode.id, { manualScore: +e.target.value })}
                                    style={{ flex: 1, accentColor: C.accent }} />
                                <span style={{ fontSize: 14, fontWeight: 700, color: C.accent, fontFamily: "'JetBrains Mono',monospace", minWidth: 42 }}>
                                    {selectedNode.manualScore ?? 0}%
                                </span>
                            </div>
                            {selectedNode.manualScore != null && selectedNode.manualScore > 0 && (
                                <div style={{ fontSize: 10, color: C.amber, marginTop: 6, fontWeight: 600, letterSpacing: 0.5 }}>⚠ Simulation Mode – Not Saved</div>
                            )}
                            {onNodeClick && (
                                <button onClick={() => onNodeClick(selectedNode.id, selectedNode)}
                                    style={{
                                        marginTop: 12, width: '100%', padding: '10px 16px', borderRadius: 10,
                                        background: 'linear-gradient(135deg,#7c6bff,#a78bfa)', border: 'none',
                                        color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                        fontFamily: "'Syne',sans-serif",
                                    }}>
                                    ⚔️ Start Debate on "{selectedNode.label}" →
                                </button>
                            )}
                        </div>
                    )}
                </Card>
            )}
        </div>
    );
}

// ─── ROOT: Knowledge Compass ────────────────────
export default function KnowledgeCompass({
    onNavigateToDebate, mastery, masteryUpdate, focusTopicId, onTopicsUpdate,
    compassNodes, setCompassNodes, compassMeta, setCompassMeta,
    compassStep, setCompassStep, compassAiTip, setCompassAiTip,
}) {
    // Use lifted state from parent (persists across tab switches)
    const nodes = compassNodes;
    const setNodes = setCompassNodes;
    const meta = compassMeta;
    const setMeta = setCompassMeta;
    const step = compassStep;
    const setStep = setCompassStep;
    const aiTip = compassAiTip;
    const setAiTip = setCompassAiTip;

    useEffect(() => {
        if (focusTopicId && nodes.length > 0 && step !== 'map') {
            setStep('map');
        }
    }, [focusTopicId, nodes.length]);

    const updateNodes = useCallback((newNodes) => {
        setNodes(newNodes);
        // Sync concept nodes to parent as "compassTopics" with the subject name
        if (onTopicsUpdate) {
            const concepts = newNodes.filter(n => n.type === "concept").map(n => ({
                id: n.id,
                title: n.label,
                subject: meta?.subject || 'General',
                level: meta?.level || 'beginner',
                description: n.description,
            }));
            onTopicsUpdate(concepts);
        }
    }, [onTopicsUpdate, meta]);

    const handleGenerate = (generatedNodes, formMeta) => {
        const nodesWithScores = generatedNodes.map(n => ({ ...n, manualScore: null }));
        setNodes(nodesWithScores);
        setMeta(formMeta);
        setAiTip(formMeta.tip || '');
        setStep('edit');
        // Sync immediately
        if (onTopicsUpdate) {
            const concepts = nodesWithScores.filter(n => n.type === "concept").map(n => ({
                id: n.id, title: n.label, subject: formMeta.subject, level: formMeta.level, description: n.description,
            }));
            onTopicsUpdate(concepts);
        }
    };

    const handleNodeClick = (nodeId, node) => {
        if (onNavigateToDebate) {
            onNavigateToDebate(nodeId, node?.label || nodeId);
        }
    };

    if (step === 'input') return <SyllabusForm onGenerate={handleGenerate} />;

    if (step === 'edit') {
        return (
            <EditNodes
                nodes={nodes} meta={meta} aiTip={aiTip}
                onSave={() => setStep('map')}
                onRegenerate={() => setStep('input')}
                onUpdate={updateNodes}
            />
        );
    }

    return (
        <MapView
            nodes={nodes} meta={meta} mastery={mastery}
            onBack={() => setStep('edit')}
            onReset={() => { setNodes([]); setStep('input'); }}
            onUpdateNodes={updateNodes}
            focusTopicId={focusTopicId}
            onNodeClick={handleNodeClick}
        />
    );
}
