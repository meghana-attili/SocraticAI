"use client";

import { useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Compass, Swords, Lightbulb, ClipboardList, Map, Lock, BookOpen, ShieldCheck, ScanSearch, User } from "lucide-react";
import { C, FONTS, GLOBAL_CSS as THEME_CSS } from "@/lib/theme";

// Dynamically loaded UserButton — skips SSR to avoid ClerkProvider errors during build
const SafeUserButton = dynamic(
  () => import("@clerk/nextjs").then(mod => {
    const Btn = (props) => <mod.UserButton {...props} />;
    Btn.displayName = "ClerkUserButton";
    return Btn;
  }).catch(() => {
    const Fallback = () => null;
    Fallback.displayName = "ClerkFallback";
    return Fallback;
  }),
  { ssr: false }
);
import { classifyTopic, classifyTopicWithLLM } from "@/lib/topicClassifier";
import {
  SocraticDebate,
  HintSystem,
  RubricFeedback,
  MasteryTracker,
  IntegrityPanel,
  useMastery,
} from "@/components/SocraticFeatures";

const KnowledgeCompass = dynamic(() => import("@/components/KnowledgeCompass"), { ssr: false });
const InsightCanvas = dynamic(() => import("@/components/InsightCanvas"), { ssr: false });

// ─── Styles ─────────────────────
// ─── Theme and Global Styles handled in @/lib/theme ───
const GLOBAL_CSS = `
  ${THEME_CSS}
  body { color: white; font-family: ${FONTS.body}; }
  .desktop-sidebar { display: flex; flex-direction: column; }
  .mobile-header { display: none; }
  @media (max-width: 800px) {
    .desktop-sidebar { display: none !important; }
    .mobile-header { display: flex !important; }
    .main-container { flex-direction: column !important; }
    .main-content-wrap { padding: 16px !important; }
  }
  @keyframes slideIn { from { opacity:0; transform:translateX(100px);} to { opacity:1; transform:translateX(0);} }
  @keyframes fadeOut { from { opacity:1; } to { opacity:0; } }
`;

const NAV_ITEMS = [
  { id: "compass", Icon: Compass, label: "Knowledge Compass" },
  { id: "debate", Icon: Swords, label: "Socratic Debate" },
  { id: "hints", Icon: Lightbulb, label: "Hint System" },
  { id: "rubric", Icon: ClipboardList, label: "Rubric Feedback" },
  { id: "canvas", Icon: ScanSearch, label: "InsightCanvas" },
  { id: "mastery", Icon: Map, label: "Master Tracker" },
  { id: "integrity", Icon: ShieldCheck, label: "Integrity Mode" },
];

// ─── Main App ───────────────────
export default function AppPage() {
  const [activeNav, setActiveNav] = useState("compass");
  const [integrityMode, setIntegrityMode] = useState("learning");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { mastery, update: rawMasteryUpdate, setMastery, setManualOverride } = useMastery();

  // Sync Clerk user to DB on mount (fire-and-forget)
  useEffect(() => {
    fetch('/api/user/sync', { method: 'POST' }).catch(() => { });
  }, []);

  // Shared topics from Knowledge Compass
  const [compassTopics, setCompassTopics] = useState([]);
  const [debateTopic, setDebateTopic] = useState(null);
  const [focusTopicId, setFocusTopicId] = useState(null);

  // ─── Lifted constellation state (persists across tab switches) ───
  const [compassNodes, setCompassNodes] = useState([]);
  const [compassMeta, setCompassMeta] = useState({});
  const [compassStep, setCompassStep] = useState("input");
  const [compassAiTip, setCompassAiTip] = useState("");

  // Reset ephemeral manual scores when leaving Knowledge Compass tab
  useEffect(() => {
    if (activeNav !== "compass" && compassNodes.length > 0) {
      const hasManual = compassNodes.some(n => n.manualScore != null && n.manualScore > 0);
      if (hasManual) {
        setCompassNodes(prev => prev.map(n => ({ ...n, manualScore: null })));
      }
    }
  }, [activeNav]);

  // Centralized mastery update — ontology-driven classification gateway
  // Phase 1: Sync classification (Tier 1+2) stores immediately
  // Phase 2: If sync fails, async LLM (Tier 3) reclassifies and corrects the entry
  const masteryUpdate = useCallback((topic, isCorrect, source = "debate", subject = "") => {
    const resolvedSubject = subject || compassMeta?.subject || "";
    const concepts = compassNodes.filter(n => n.type === "concept");

    if (concepts.length === 0) {
      // No constellation yet — store as-is
      rawMasteryUpdate(topic, isCorrect, source, resolvedSubject);
      return;
    }

    // Phase 1: sync classification (Tier 1 exact + Tier 2 token similarity)
    const syncResult = classifyTopic(topic, compassNodes);
    if (syncResult.confidence >= 0.5) {
      // Good sync match — store under canonical node label
      rawMasteryUpdate(syncResult.nodeLabel, isCorrect, source, resolvedSubject);
      return;
    }

    // Phase 2: sync failed — store temporarily, then LLM reclassifies
    rawMasteryUpdate(topic, isCorrect, source, resolvedSubject);

    // Fire-and-forget async LLM reclassification
    classifyTopicWithLLM(topic, compassNodes).then(llmResult => {
      if (llmResult.confidence > 0 && llmResult.nodeLabel !== topic) {
        // LLM found a better match — move the data from old key to canonical key
        setMastery(prev => {
          const oldEntry = prev[topic];
          if (!oldEntry) return prev;
          const canonKey = llmResult.nodeLabel;
          const existing = prev[canonKey] || { correct: 0, total: 0, sources: {}, manualOverride: null, subject: resolvedSubject };
          // Merge old entry data into canonical node
          const mergedSources = { ...existing.sources };
          Object.entries(oldEntry.sources || {}).forEach(([src, sd]) => {
            if (!mergedSources[src]) mergedSources[src] = { correct: 0, total: 0 };
            mergedSources[src] = {
              correct: mergedSources[src].correct + sd.correct,
              total: mergedSources[src].total + sd.total,
            };
          });
          const newState = { ...prev };
          delete newState[topic]; // Remove free-form entry
          newState[canonKey] = {
            correct: existing.correct + oldEntry.correct,
            total: existing.total + oldEntry.total,
            sources: mergedSources,
            manualOverride: existing.manualOverride,
            subject: resolvedSubject,
          };
          return newState;
        });
      }
    }).catch(() => { /* LLM failed — keep the sync entry */ });
  }, [rawMasteryUpdate, compassNodes, compassMeta?.subject, setMastery]);

  // Navigate from constellation to debate
  const handleNavigateToDebate = useCallback((nodeId, topicLabel) => {
    setDebateTopic(topicLabel || nodeId);
    setActiveNav("debate");
  }, []);

  // Sync compass topics
  const handleCompassTopicsUpdate = useCallback((topics) => {
    setCompassTopics(topics);
  }, []);

  // Navigate to constellation from Master Tracker (scoped to subject)
  // Forces step='map' so it shows the actual graph, not the input form
  const handleViewConstellation = useCallback((subject) => {
    // If we have nodes for this subject, go straight to the map
    if (compassNodes.length > 0 && compassMeta?.subject === subject) {
      setCompassStep("map");
    }
    setActiveNav("compass");
  }, [compassNodes.length, compassMeta?.subject]);

  return (
    <div className="main-container" style={{ height: "100vh", display: "flex", background: C.bg, overflow: "hidden" }}>
      <style>{GLOBAL_CSS}</style>

      {/* Mobile Header (Hidden on Desktop) */}
      <div className="mobile-header" style={{
        padding: "16px", borderBottom: "1px solid " + C.border,
        alignItems: "center", justifyContent: "space-between", background: C.bg,
        zIndex: 50
      }}>
        <div style={{ fontFamily: FONTS.title, fontSize: 24, color: C.text }}>
          Socratic<span style={{ fontStyle: "italic", color: C.accent }}>AI</span>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} style={{
          background: "none", border: "none", color: C.text, fontSize: 24, cursor: "pointer"
        }}>
          ☰
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            style={{
              position: "fixed", inset: 0, zIndex: 100, background: C.bg,
              display: "flex", flexDirection: "column", padding: 24
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
              <div style={{ fontFamily: FONTS.title, fontSize: 24, color: C.text }}>
                Socratic<span style={{ fontStyle: "italic", color: C.accent }}>AI</span>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} style={{ background: "none", border: "none", color: C.text, fontSize: 28, cursor: "pointer" }}>
                ✕
              </button>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              {NAV_ITEMS.map((item) => {
                const active = activeNav === item.id;
                return (
                  <button key={item.id} onClick={() => { setActiveNav(item.id); if (item.id !== "compass") setFocusTopicId(null); setMobileMenuOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 14,
                      padding: "14px 16px", borderRadius: 12,
                      background: active ? C.accentSoft : "transparent",
                      border: "1px solid " + (active ? C.accentBorder : "transparent"),
                      color: active ? C.accent : C.text, cursor: "pointer",
                      fontFamily: "inherit", fontSize: 16, fontWeight: active ? 700 : 500,
                      textAlign: "left",
                    }}>
                    <item.Icon size={20} />
                    {item.label}
                  </button>
                );
              })}
            </div>

            <div style={{
              padding: "16px", marginTop: "auto",
              background: integrityMode === "exam" ? "rgba(246,164,48,0.08)" : "rgba(34,211,160,0.08)",
              border: "1px solid " + (integrityMode === "exam" ? "rgba(246,164,48,0.25)" : "rgba(34,211,160,0.2)"),
              borderRadius: 12, display: "flex", flexDirection: "column"
            }}>
              <div style={{ fontSize: 13, color: integrityMode === "exam" ? C.amber : C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                {integrityMode === "exam" ? <><Lock size={14} /> Exam Mode Active</> : <><BookOpen size={14} /> Learning Mode Active</>}
              </div>
              <button onClick={() => setActiveNav("integrity")} style={{ fontSize: 12, color: C.faint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, marginTop: 4, textAlign: "left" }}>
                Change mode →
              </button>
            </div>

            {/* User profile */}
            <div style={{ padding: "12px", display: "flex", alignItems: "center", gap: 10 }}>
              <SafeUserButton
                appearance={{
                  elements: {
                    avatarBox: { width: 32, height: 32 },
                  },
                }}
              />
              <span style={{ fontSize: 12, color: C.muted }}>Account</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <motion.div
        className="desktop-sidebar"
        onMouseEnter={() => setSidebarOpen(true)}
        onMouseLeave={() => setSidebarOpen(false)}
        animate={{ width: sidebarOpen ? 220 : 68 }}
        style={{
          flexShrink: 0, background: "rgba(255,255,255,0.02)",
          borderRight: "1px solid " + C.border,
          padding: sidebarOpen ? "20px 12px" : "20px 8px",
          overflow: "hidden", whiteSpace: "nowrap", zIndex: 10
        }}
      >
        <div style={{ padding: sidebarOpen ? "0 8px 24px" : "0 0 24px", borderBottom: "1px solid " + C.border, marginBottom: 16, display: "flex", flexDirection: "column", alignItems: sidebarOpen ? "flex-start" : "center" }}>
          {sidebarOpen ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div style={{ fontFamily: FONTS.title, fontSize: 22, color: C.text }}>
                Socratic<span style={{ fontStyle: "italic", color: C.accent }}>AI</span>
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 2, letterSpacing: 1, textTransform: "uppercase" }}>AMD Slingshot 2026</div>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ fontFamily: FONTS.title, fontSize: 22, color: C.text }}>
              S<span style={{ fontStyle: "italic", color: C.accent }}>AI</span>
            </motion.div>
          )}
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const active = activeNav === item.id;
            return (
              <button key={item.id} onClick={() => { setActiveNav(item.id); if (item.id !== "compass") setFocusTopicId(null); }}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: sidebarOpen ? 10 : 0,
                  padding: sidebarOpen ? "10px 12px" : "10px 0", borderRadius: 10,
                  background: active ? C.accentSoft : "transparent",
                  border: "1px solid " + (active ? C.accentBorder : "transparent"),
                  color: active ? C.accent : C.muted, cursor: "pointer",
                  fontFamily: "inherit", fontSize: 13, fontWeight: active ? 700 : 500,
                  transition: "all .15s", textAlign: "left",
                  justifyContent: sidebarOpen ? "flex-start" : "center"
                }}>
                <item.Icon size={16} style={{ flexShrink: 0 }} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, display: "none" }}
                      animate={{ opacity: 1, display: "inline-block" }}
                      exit={{ opacity: 0, display: "none" }}
                      transition={{ duration: 0.15 }}
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            );
          })}
        </div>

        <div style={{
          padding: sidebarOpen ? "12px" : "12px 0",
          background: integrityMode === "exam" ? "rgba(246,164,48,0.08)" : "rgba(34,211,160,0.08)",
          border: "1px solid " + (integrityMode === "exam" ? "rgba(246,164,48,0.25)" : "rgba(34,211,160,0.2)"),
          borderRadius: 10,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
        }}>
          {sidebarOpen ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: "100%", textAlign: "left" }}>
              <div style={{ fontSize: 11, color: integrityMode === "exam" ? C.amber : C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
                {integrityMode === "exam" ? <><Lock size={12} /> Exam Mode</> : <><BookOpen size={12} /> Learning Mode</>}
              </div>
              <button onClick={() => setActiveNav("integrity")} style={{ fontSize: 10, color: C.faint, background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", padding: 0, marginTop: 2 }}>
                Change mode →
              </button>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setActiveNav("integrity")} title={integrityMode === "exam" ? "Exam Mode" : "Learning Mode"}>
              {integrityMode === "exam" ? <Lock size={16} /> : <BookOpen size={16} />}
            </motion.div>
          )}
        </div>

        {/* User profile */}
        <div style={{
          marginTop: 10, display: "flex", alignItems: "center",
          justifyContent: sidebarOpen ? "flex-start" : "center",
          padding: sidebarOpen ? "8px 12px" : "8px 0",
        }}>
          <SafeUserButton
            appearance={{
              elements: {
                avatarBox: { width: sidebarOpen ? 30 : 26, height: sidebarOpen ? 30 : 26, transition: "all .2s" },
              },
            }}
          />
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="main-content-wrap" style={{ flex: 1, overflowY: "auto", padding: activeNav === "compass" ? "16px" : "32px 40px", display: "flex" }}>
        <div style={{ flex: 1, maxWidth: activeNav === "compass" ? "100%" : 900, margin: "0 auto" }}>
          {/* KnowledgeCompass: always mounted (hidden when inactive) so constellation state persists */}
          <div style={{ display: activeNav === "compass" ? "block" : "none" }}>
            <KnowledgeCompass
              onNavigateToDebate={handleNavigateToDebate}
              mastery={mastery}
              masteryUpdate={masteryUpdate}
              focusTopicId={focusTopicId}
              onTopicsUpdate={handleCompassTopicsUpdate}
              compassNodes={compassNodes}
              setCompassNodes={setCompassNodes}
              compassMeta={compassMeta}
              setCompassMeta={setCompassMeta}
              compassStep={compassStep}
              setCompassStep={setCompassStep}
              compassAiTip={compassAiTip}
              setCompassAiTip={setCompassAiTip}
            />
          </div>
          {activeNav === "debate" && (
            <SocraticDebate
              integrityMode={integrityMode}
              masteryUpdate={masteryUpdate}
              compassTopics={compassTopics}
              initialTopic={debateTopic}
            />
          )}
          {activeNav === "hints" && <HintSystem integrityMode={integrityMode} masteryUpdate={masteryUpdate} compassTopics={compassTopics} />}
          {activeNav === "rubric" && <RubricFeedback integrityMode={integrityMode} masteryUpdate={masteryUpdate} compassTopics={compassTopics} />}
          {activeNav === "mastery" && (
            <MasteryTracker
              mastery={mastery}
              compassTopics={compassTopics}
              onViewConstellation={handleViewConstellation}
              onAddSubject={() => {
                setCompassStep("input");
                setActiveNav("compass");
              }}
            />
          )}
          {activeNav === "integrity" && <IntegrityPanel mode={integrityMode} setMode={setIntegrityMode} />}
          {activeNav === "canvas" && <InsightCanvas integrityMode={integrityMode} />}
        </div>
      </div>
    </div>
  );
}
