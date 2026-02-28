import { NextResponse } from 'next/server';

// Demo seed topics for the Knowledge Graph when databases aren't available
const SEED_NODES = [
    { id: "quantum", label: "Quantum Physics", mastery: 0.3, priority: 0.85, forgettingRisk: 0.7 },
    { id: "superposition", label: "Superposition", mastery: 0.25, priority: 0.9, forgettingRisk: 0.8 },
    { id: "entanglement", label: "Entanglement", mastery: 0.15, priority: 0.95, forgettingRisk: 0.65 },
    { id: "recursion", label: "Recursion", mastery: 0.6, priority: 0.5, forgettingRisk: 0.3 },
    { id: "stacks", label: "Call Stack", mastery: 0.7, priority: 0.35, forgettingRisk: 0.2 },
    { id: "basecase", label: "Base Case", mastery: 0.8, priority: 0.25, forgettingRisk: 0.1 },
    { id: "supply", label: "Supply & Demand", mastery: 0.45, priority: 0.6, forgettingRisk: 0.5 },
    { id: "equilibrium", label: "Market Equilibrium", mastery: 0.35, priority: 0.7, forgettingRisk: 0.55 },
    { id: "elasticity", label: "Price Elasticity", mastery: 0.2, priority: 0.8, forgettingRisk: 0.72 },
    { id: "evolution", label: "Evolution", mastery: 0.55, priority: 0.55, forgettingRisk: 0.4 },
    { id: "selection", label: "Natural Selection", mastery: 0.5, priority: 0.6, forgettingRisk: 0.45 },
    { id: "mutation", label: "Genetic Mutation", mastery: 0.3, priority: 0.75, forgettingRisk: 0.6 },
    { id: "thermo", label: "Thermodynamics", mastery: 0.4, priority: 0.65, forgettingRisk: 0.5 },
    { id: "entropy", label: "Entropy", mastery: 0.2, priority: 0.85, forgettingRisk: 0.75 },
    { id: "freewill", label: "Free Will", mastery: 0.35, priority: 0.7, forgettingRisk: 0.55 },
    { id: "determinism", label: "Determinism", mastery: 0.25, priority: 0.8, forgettingRisk: 0.65 },
];

const SEED_EDGES = [
    { source: "quantum", target: "superposition", weight: 0.9 },
    { source: "quantum", target: "entanglement", weight: 0.85 },
    { source: "superposition", target: "entanglement", weight: 0.7 },
    { source: "recursion", target: "stacks", weight: 0.95 },
    { source: "recursion", target: "basecase", weight: 0.9 },
    { source: "stacks", target: "basecase", weight: 0.6 },
    { source: "supply", target: "equilibrium", weight: 0.9 },
    { source: "supply", target: "elasticity", weight: 0.8 },
    { source: "equilibrium", target: "elasticity", weight: 0.75 },
    { source: "evolution", target: "selection", weight: 0.95 },
    { source: "evolution", target: "mutation", weight: 0.8 },
    { source: "selection", target: "mutation", weight: 0.7 },
    { source: "thermo", target: "entropy", weight: 0.9 },
    { source: "freewill", target: "determinism", weight: 0.85 },
    // Cross-domain similarity edges
    { source: "quantum", target: "freewill", weight: 0.4 },
    { source: "entropy", target: "evolution", weight: 0.45 },
    { source: "recursion", target: "evolution", weight: 0.3 },
];

export async function GET() {
    try {
        // Try databases first
        let nodes = [];
        let edges = [];

        try {
            const neo4jDriver = (await import('@/lib/neo4j')).default;
            const prisma = (await import('@/lib/db')).default;

            const session = neo4jDriver.session();
            const nodesResult = await session.run('MATCH (n:Topic) RETURN n.topicId AS id, n.title AS label');
            await session.close();

            if (nodesResult.records.length > 0) {
                // Real data exists — use it
                const edgesResult = await (neo4jDriver.session()).run(
                    'MATCH (n)-[r]->(m) RETURN n.topicId AS source, m.topicId AS target, r.weight AS weight'
                );

                nodes = nodesResult.records.map(r => {
                    const id = r.get('id');
                    return { id, label: r.get('label'), mastery: 0, priority: 0.5, forgettingRisk: 0 };
                });

                edges = edgesResult.records.map(r => ({
                    source: r.get('source'), target: r.get('target'), weight: r.get('weight') || 0.5,
                }));

                return NextResponse.json({ nodes: formatNodes(nodes), edges: formatEdges(edges) });
            }
        } catch (dbError) {
            // Databases not available — fall through to seed data
        }

        // Return seed demo data
        return NextResponse.json({
            nodes: formatNodes(SEED_NODES),
            edges: formatEdges(SEED_EDGES),
        });

    } catch (error) {
        return NextResponse.json({ nodes: [], edges: [] });
    }
}

function formatNodes(nodes) {
    return nodes.map(n => {
        const size = 5 + (n.priority * 20);
        let color = '#dc2626';
        if (n.mastery > 0.7) color = '#16a34a';
        else if (n.mastery >= 0.4) color = '#eab308';
        return { ...n, size, color };
    });
}

function formatEdges(edges) {
    return edges.map((e, i) => ({
        id: `e-${i}-${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        weight: e.weight || 0.5,
    }));
}
