'use client';

import React, { useEffect, useRef, useState } from 'react';
import Graph from 'graphology';

// Related concept map — when a user debates a topic, related concepts get weaker edges
const CONCEPT_RELATIONS = {
    "Quantum Physics": ["Superposition", "Wave Function", "Entanglement", "Schrödinger"],
    "Superposition": ["Quantum Physics", "Wave Function"],
    "Recursion": ["Call Stack", "Base Case", "Dynamic Programming", "Divide & Conquer"],
    "Supply & Demand": ["Market Equilibrium", "Price Elasticity", "Scarcity"],
    "Evolution": ["Natural Selection", "Genetic Mutation", "Adaptation", "Speciation"],
    "Thermodynamics": ["Entropy", "Heat Transfer", "Energy Conservation"],
    "Free Will": ["Determinism", "Compatibilism", "Consciousness"],
};

export default function KnowledgeGraph({ onNodeClick, mastery = {} }) {
    const containerRef = useRef(null);
    const [hoveredNode, setHoveredNode] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let sigmaInstance = null;
        let animationFrameId;

        const initGraph = async () => {
            try {
                const { default: Sigma } = await import('sigma');
                const forceAtlas2 = await import('graphology-layout-forceatlas2');

                if (!containerRef.current) return;

                const graph = new Graph();
                const topics = Object.entries(mastery);

                if (topics.length === 0) {
                    setLoading(false);
                    return;
                }

                // Build nodes from mastery data
                const addedNodes = new Set();

                topics.forEach(([concept, data]) => {
                    const pct = data.total > 0 ? data.correct / data.total : 0;
                    const priority = 1 - pct; // lower mastery = higher priority
                    const forgettingRisk = data.total > 0 ? Math.max(0, 1 - pct - 0.1) : 0;

                    if (!addedNodes.has(concept)) {
                        graph.addNode(concept, {
                            x: Math.random() * 100,
                            y: Math.random() * 100,
                            size: 8 + (priority * 18),
                            label: concept,
                            color: pct > 0.7 ? '#16a34a' : pct >= 0.4 ? '#eab308' : '#dc2626',
                            mastery: pct,
                            priority: priority,
                            forgettingRisk: forgettingRisk,
                            total: data.total,
                            correct: data.correct,
                        });
                        addedNodes.add(concept);
                    }

                    // Add related concept nodes
                    const related = CONCEPT_RELATIONS[concept] || [];
                    related.forEach(rel => {
                        if (!addedNodes.has(rel)) {
                            const relMastery = mastery[rel];
                            const relPct = relMastery ? (relMastery.total > 0 ? relMastery.correct / relMastery.total : 0) : 0;
                            graph.addNode(rel, {
                                x: Math.random() * 100,
                                y: Math.random() * 100,
                                size: 6 + (relMastery ? (1 - relPct) * 14 : 5),
                                label: rel,
                                color: relMastery ? (relPct > 0.7 ? '#16a34a' : relPct >= 0.4 ? '#eab308' : '#dc2626') : '#6366f1',
                                mastery: relPct,
                                priority: relMastery ? 1 - relPct : 0.3,
                                forgettingRisk: 0,
                                total: relMastery ? relMastery.total : 0,
                                correct: relMastery ? relMastery.correct : 0,
                            });
                            addedNodes.add(rel);
                        }
                        // Add edge
                        try {
                            graph.addEdge(concept, rel, {
                                size: 2,
                                color: 'rgba(124,107,255,0.3)',
                            });
                        } catch (e) { /* edge might already exist */ }
                    });
                });

                // Add edges between debated topics
                const topicNames = topics.map(t => t[0]);
                for (let i = 0; i < topicNames.length; i++) {
                    for (let j = i + 1; j < topicNames.length; j++) {
                        if (graph.hasNode(topicNames[i]) && graph.hasNode(topicNames[j])) {
                            try {
                                graph.addEdge(topicNames[i], topicNames[j], {
                                    size: 1,
                                    color: 'rgba(255,255,255,0.08)',
                                });
                            } catch (e) { }
                        }
                    }
                }

                // Apply force-directed layout
                const sensibleSettings = forceAtlas2.inferSettings(graph);
                forceAtlas2.assign(graph, { iterations: 100, settings: sensibleSettings });

                sigmaInstance = new Sigma(graph, containerRef.current, {
                    allowInvalidContainer: true,
                    renderLabels: true,
                    labelRenderedSizeThreshold: 0,
                    labelColor: { color: '#e2e8f0' },
                    labelFont: "Syne, sans-serif",
                    labelSize: 14,
                    labelWeight: "bold",
                    defaultEdgeColor: 'rgba(124,107,255,0.25)',
                    defaultNodeColor: '#6366f1',
                });

                sigmaInstance.on('clickNode', (event) => {
                    if (onNodeClick) onNodeClick(event.node);
                });

                sigmaInstance.on('enterNode', (event) => {
                    const nodeAttrs = graph.getNodeAttributes(event.node);
                    setHoveredNode(nodeAttrs);
                    setTooltipPos({ x: event.event.x, y: event.event.y });
                });

                sigmaInstance.on('leaveNode', () => {
                    setHoveredNode(null);
                });

                // Pulsing animation for high forgetting risk
                let time = 0;
                const animateNodes = () => {
                    time += 0.05;
                    graph.forEachNode((node, attributes) => {
                        if (attributes.forgettingRisk > 0.5) {
                            const baseSize = 8 + (attributes.priority * 18);
                            graph.setNodeAttribute(node, 'size', baseSize + Math.sin(time) * 3);
                        }
                    });
                    animationFrameId = requestAnimationFrame(animateNodes);
                };
                animateNodes();

                setLoading(false);
            } catch (err) {
                console.error('Error initializing graph:', err);
                setLoading(false);
            }
        };

        initGraph();

        return () => {
            if (sigmaInstance) sigmaInstance.kill();
            if (animationFrameId) cancelAnimationFrame(animationFrameId);
        };
    }, [mastery, onNodeClick]);

    const topicCount = Object.keys(mastery).length;

    if (topicCount === 0) {
        return (
            <div style={{ width: '100%', minHeight: '600px', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, border: '1px solid rgba(124,107,255,0.15)' }}>
                <div style={{ fontSize: 56 }}>🌐</div>
                <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 18, fontWeight: 700, fontFamily: "'Syne', sans-serif" }}>Knowledge Graph</div>
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, textAlign: 'center', maxWidth: 360, lineHeight: 1.6 }}>
                    Start a <strong style={{ color: '#7c6bff' }}>Socratic Debate</strong> to populate your Knowledge Graph.
                    Each concept you discuss will appear as a node — connected to related ideas.
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    {['⚛️ Quantum', '🧮 Recursion', '📈 Economics'].map((t, i) => (
                        <span key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 100, padding: '4px 12px' }}>{t}</span>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '600px', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', borderRadius: '1rem', border: '1px solid rgba(124,107,255,0.15)' }}>
            {/* Header */}
            <div style={{ position: 'absolute', top: 16, left: 20, zIndex: 5, display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', fontFamily: "'Syne', sans-serif", fontWeight: 700 }}>
                    🌐 {topicCount} concept{topicCount !== 1 ? 's' : ''} tracked
                </span>
                <span style={{ fontSize: 11, color: '#dc2626', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 100, padding: '2px 8px' }}>● pulsing = forgetting risk</span>
            </div>

            {/* Legend */}
            <div style={{ position: 'absolute', bottom: 16, left: 20, zIndex: 5, display: 'flex', gap: 16 }}>
                {[
                    { color: '#16a34a', label: 'Strong (>70%)' },
                    { color: '#eab308', label: 'Medium (40-70%)' },
                    { color: '#dc2626', label: 'Weak (<40%)' },
                    { color: '#6366f1', label: 'Unexplored' },
                ].map((item, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color }} />
                        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{item.label}</span>
                    </div>
                ))}
            </div>

            <div ref={containerRef} style={{ width: '100%', height: '100%', minHeight: '600px' }} />

            {hoveredNode && (
                <div style={{
                    position: 'absolute',
                    top: tooltipPos.y + 15,
                    left: tooltipPos.x + 15,
                    backgroundColor: '#1e293b',
                    color: '#f8fafc',
                    padding: '14px 16px',
                    borderRadius: '10px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                    border: '1px solid rgba(124,107,255,0.2)',
                    zIndex: 10,
                    pointerEvents: 'none',
                    minWidth: '200px'
                }}>
                    <h4 style={{ margin: '0 0 10px 0', fontSize: '15px', fontWeight: 'bold', fontFamily: "'Syne', sans-serif" }}>{hoveredNode.label}</h4>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                            <span style={{ color: '#94a3b8' }}>Mastery:</span>
                            <span style={{ fontWeight: 'bold', color: hoveredNode.color }}>{(hoveredNode.mastery * 100).toFixed(0)}%</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                            <span style={{ color: '#94a3b8' }}>Exchanges:</span>
                            <span style={{ fontWeight: 'bold' }}>{hoveredNode.correct}/{hoveredNode.total}</span>
                        </div>
                        {hoveredNode.forgettingRisk > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 20 }}>
                                <span style={{ color: '#94a3b8' }}>Forgetting Risk:</span>
                                <span style={{ fontWeight: 'bold', color: hoveredNode.forgettingRisk > 0.5 ? '#dc2626' : '#eab308' }}>
                                    {(hoveredNode.forgettingRisk * 100).toFixed(0)}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
