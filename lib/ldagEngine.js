/**
 * LDAG Engine — SocraticAI 2.0
 * Layered Directed Acyclic Knowledge Graph Engine
 * 
 * Implements: §3 Mastery, §4 Priority, §5 Unlock, §7 State Machine, §8 Expansion, §11 Cascade
 */

// ─── §3.1 Mastery Score ─────────────────────────────
// M_i = (correct_i + 1) / (attempts_i + 2)
export function computeMastery(correct, attempts) {
    return (correct + 1) / (attempts + 2);
}

// ─── §3.2 Parent Mastery Propagation ────────────────
// M_parent = (1/|C|) * Σ M_k for k in children
export function propagateMasteryUpward(topicId, topics) {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return 0;

    const children = topics.filter(t => t.parentId === topicId);
    if (children.length === 0) return topic.mastery || 0;

    const childMasteries = children.map(c => c.mastery || computeMastery(c.correct || 0, c.attempts || 0));
    const parentMastery = childMasteries.reduce((a, b) => a + b, 0) / childMasteries.length;

    topic.mastery = parentMastery;

    // Recurse if this topic also has a parent
    if (topic.parentId) {
        propagateMasteryUpward(topic.parentId, topics);
    }

    return parentMastery;
}

// ─── §3.3 Forgetting Risk ──────────────────────────
// Retention = e^(-λ · daysSinceRevision)
// F_i = 1 - Retention
export function computeForgettingRisk(lastRevisedDate, lambda = 0.12) {
    if (!lastRevisedDate) return 0;
    const now = new Date();
    const daysSince = (now - new Date(lastRevisedDate)) / (1000 * 60 * 60 * 24);
    const retention = Math.exp(-lambda * daysSince);
    return 1 - retention;
}

// ─── §3.4 Dependency Weakness ──────────────────────
// D_i = (1/|Children(i)|) * Σ (1 - M_k)
export function computeDependencyWeakness(topicId, topics) {
    const children = topics.filter(t => t.parentId === topicId);
    if (children.length === 0) return 0;

    const weaknesses = children.map(c => 1 - (c.mastery || computeMastery(c.correct || 0, c.attempts || 0)));
    return weaknesses.reduce((a, b) => a + b, 0) / weaknesses.length;
}

// ─── §4 Priority Score ─────────────────────────────
// P = 0.30E + 0.25(1-M) + 0.20F + 0.15D + 0.10U
export function computePriority(topic, topics) {
    const M = topic.mastery || computeMastery(topic.correct || 0, topic.attempts || 0);
    const E = topic.examWeight || 0.5;
    const F = computeForgettingRisk(topic.lastRevised, topic.lambda || 0.12);
    const D = computeDependencyWeakness(topic.id, topics);
    const U = topic.userPriority || 0.5;

    return 0.30 * E + 0.25 * (1 - M) + 0.20 * F + 0.15 * D + 0.10 * U;
}

// ─── §5 Unlock Function ────────────────────────────
// Topic i is UNLOCKED if ∀j ∈ Pre(i), M_j ≥ 0.65
export function isUnlocked(topicId, topics) {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return false;

    // Root topics are always unlocked
    if (!topic.prerequisites || topic.prerequisites.length === 0) return true;

    return topic.prerequisites.every(preId => {
        const pre = topics.find(t => t.id === preId);
        if (!pre) return true;
        const mastery = pre.mastery || computeMastery(pre.correct || 0, pre.attempts || 0);
        return mastery >= 0.65;
    });
}

// ─── §6 Visibility Function ────────────────────────
// Visible if parent is UNLOCKED. Root topics always visible.
export function isVisible(topicId, topics) {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return false;

    // Root topics are always visible
    if (!topic.parentId) return true;

    // Visible if parent is unlocked
    return isUnlocked(topic.parentId, topics);
}

// ─── §7 State Machine ──────────────────────────────
// LOCKED → VISIBLE → UNLOCKED → MASTERED
// ALERT overlay if forgettingRisk ≥ 0.7
export const STATES = {
    LOCKED: 'LOCKED',
    VISIBLE: 'VISIBLE',
    UNLOCKED: 'UNLOCKED',
    MASTERED: 'MASTERED',
};

export function getTopicState(topicId, topics) {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return STATES.LOCKED;

    const mastery = topic.mastery || computeMastery(topic.correct || 0, topic.attempts || 0);

    // §7.1 Transition logic
    if (mastery >= 0.85) return STATES.MASTERED;
    if (isUnlocked(topicId, topics)) return STATES.UNLOCKED;
    if (isVisible(topicId, topics)) return STATES.VISIBLE;
    return STATES.LOCKED;
}

// ─── §8 Constellation Expansion ────────────────────
// R = R_0 + α · (Σ M_i / |V|)
export function computeExpansionRadius(topics, R0 = 50, alpha = 100) {
    if (topics.length === 0) return R0;
    const totalMastery = topics.reduce((sum, t) => sum + (t.mastery || 0), 0);
    const avgMastery = totalMastery / topics.length;
    return R0 + alpha * avgMastery;
}

// ─── §9.1 Node Visual Properties ───────────────────
export function getNodeVisuals(topic, topics) {
    const mastery = topic.mastery || computeMastery(topic.correct || 0, topic.attempts || 0);
    const state = getTopicState(topic.id, topics);
    const priority = computePriority(topic, topics);
    const forgettingRisk = computeForgettingRisk(topic.lastRevised);

    // Size: size = 5 + (20 × priority_score)
    const size = 5 + 20 * priority;

    // Color zones
    let color;
    if (mastery >= 0.85) color = '#3b82f6'; // Blue (MASTERED)
    else if (mastery >= 0.65) color = '#16a34a'; // Green
    else if (mastery >= 0.25) color = '#eab308'; // Yellow
    else color = '#dc2626'; // Red

    // Opacity: locked = 0.4
    const opacity = state === STATES.LOCKED ? 0.4 : 1;

    // Glow if mastery ≥ 0.65
    const glow = mastery >= 0.65;

    // Pulse if forgetting risk ≥ 0.6
    const pulse = forgettingRisk >= 0.6;

    return { size, color, opacity, glow, pulse, state, mastery, priority, forgettingRisk };
}

// ─── §11 Session Cascade ───────────────────────────
// 9-step atomic cascade after session completes
export function sessionCascade(topicId, correct, total, topics) {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return topics;

    // 1. Update attempts + correct
    topic.correct = (topic.correct || 0) + correct;
    topic.attempts = (topic.attempts || 0) + total;
    topic.lastRevised = new Date().toISOString();

    // 2. Recompute mastery
    topic.mastery = computeMastery(topic.correct, topic.attempts);

    // 3. Propagate mastery upward
    if (topic.parentId) {
        propagateMasteryUpward(topic.parentId, topics);
    }

    // 4-5. Recompute dependency weakness + priority for all topics
    topics.forEach(t => {
        t.priority = computePriority(t, topics);
    });

    // 6-7. Evaluate unlock function + update states
    topics.forEach(t => {
        t.state = getTopicState(t.id, topics);
    });

    // 8-9. Graph re-render + expansion handled by React
    return [...topics];
}
