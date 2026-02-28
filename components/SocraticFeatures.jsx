"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Atom, Binary, TrendingUp, Dna, Flame, Brain, Lock, BookOpen, Compass, Swords, Lightbulb, ClipboardList, Map, AlertTriangle, Target, Sprout, CheckCircle, BarChart3, ShieldCheck } from "lucide-react";
import { AIVoiceInput } from "@/components/ui/ai-voice-input";
import { C, FONTS, GLOBAL_CSS } from "@/lib/theme";

async function groq(messages, systemPrompt, maxTokens = 600) {
  const res = await fetch("/api/groq", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages, systemPrompt, maxTokens }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Groq API error");
  return data.content;
}

// ─────────────────────────────────────────────
// MASTERY STORE — tracks source (debate/hint/rubric) + manual override
// Hydrates from DB on mount, auto-persists changes (debounced)
// ─────────────────────────────────────────────
export function useMastery() {
  const [mastery, setMastery] = useState({});
  const [loaded, setLoaded] = useState(false);
  const saveTimer = useRef(null);

  // Hydrate from DB on mount
  useEffect(() => {
    fetch('/api/user/mastery')
      .then(r => r.json())
      .then(data => {
        if (data.mastery && Object.keys(data.mastery).length > 0) {
          setMastery(prev => {
            // Merge: DB data is base, in-memory overrides if any
            const merged = { ...data.mastery };
            Object.entries(prev).forEach(([k, v]) => {
              if (v.total > 0) merged[k] = v; // in-memory wins if has data
            });
            return merged;
          });
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true)); // DB offline — continue with in-memory
  }, []);

  // Auto-persist to DB (debounced 2s after last change)
  const persistToDb = useCallback((data) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch('/api/user/mastery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mastery: data }),
      }).catch(() => { }); // Fire-and-forget
    }, 2000);
  }, []);

  const update = useCallback((topic, isCorrect, source = "debate", subject = "") => {
    setMastery(prev => {
      const cur = prev[topic] || { correct: 0, total: 0, sources: {}, manualOverride: null, subject: "" };
      const newSources = { ...cur.sources };
      if (!newSources[source]) newSources[source] = { correct: 0, total: 0 };
      newSources[source] = {
        correct: newSources[source].correct + (isCorrect ? 1 : 0),
        total: newSources[source].total + 1,
      };
      const updated = {
        ...prev,
        [topic]: {
          correct: cur.correct + (isCorrect ? 1 : 0),
          total: cur.total + 1,
          sources: newSources,
          manualOverride: cur.manualOverride,
          subject: subject || cur.subject || "",
        },
      };
      persistToDb(updated);
      return updated;
    });
  }, [persistToDb]);

  const setManualOverride = useCallback((topic, value) => {
    setMastery(prev => {
      const updated = {
        ...prev,
        [topic]: {
          ...(prev[topic] || { correct: 0, total: 0, sources: {}, subject: "" }),
          manualOverride: value,
        },
      };
      persistToDb(updated);
      return updated;
    });
  }, [persistToDb]);

  return { mastery, update, setMastery, setManualOverride, loaded };
}


// ─── Theme and Global Styles handled in @/lib/theme ───

function Btn({ children, onClick, variant = "primary", disabled, style = {}, small }) {
  const base = {
    border: "none", cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 10, fontFamily: "inherit", fontWeight: 600,
    fontSize: small ? 12 : 14, transition: "all .18s",
    padding: small ? "6px 14px" : "10px 20px",
    opacity: disabled ? 0.45 : 1,
    ...style,
  };
  if (variant === "primary") return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, background: "linear-gradient(135deg,#7c6bff,#a78bfa)", color: "#fff" }}>{children}</button>
  );
  if (variant === "ghost") return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, background: C.surface, border: `1px solid ${C.border}`, color: C.text }}>{children}</button>
  );
  if (variant === "success") return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, background: "linear-gradient(135deg,#22d3a0,#059669)", color: "#fff" }}>{children}</button>
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

function Badge({ children, color = C.accent }) {
  return (
    <span style={{
      background: `${color}22`, border: `1px solid ${color}44`,
      borderRadius: 100, padding: "2px 10px", fontSize: 11,
      color, fontWeight: 600, fontFamily: "'JetBrains Mono', monospace",
    }}>{children}</span>
  );
}

function Spinner() {
  return (
    <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "8px 0" }}>
      {[0, .2, .4].map((d, i) => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: "50%", background: C.accent,
          animation: `blink 1.4s ${d}s infinite`,
        }} />
      ))}
    </div>
  );
}

function SectionTitle({ children, sub }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <h2 style={{ fontFamily: FONTS.title, fontSize: 32, fontWeight: 400, color: C.text }}>{children}</h2>
      {sub && <p style={{ color: C.muted, fontSize: 13, marginTop: 4 }}>{sub}</p>}
    </div>
  );
}

function Textarea({ value, onChange, placeholder, rows = 4, style = {} }) {
  return (
    <textarea
      rows={rows}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{
        width: "100%", background: "rgba(255,255,255,0.04)",
        border: `1px solid ${C.border}`, borderRadius: 12,
        padding: "12px 14px", color: C.text, fontSize: 14,
        fontFamily: "inherit", resize: "vertical", lineHeight: 1.6,
        transition: "border-color .2s", ...style,
      }}
      onFocus={e => e.target.style.borderColor = C.accentBorder}
      onBlur={e => e.target.style.borderColor = C.border}
    />
  );
}

function FileDropzone({ onFile, accept = ".txt,.pdf,.png,.jpg,.jpeg", label = "Drop file or click to upload" }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const handle = (f) => { if (f) onFile(f); };
  return (
    <div
      onClick={() => ref.current.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
      style={{
        border: `2px dashed ${drag ? C.accent : C.border}`,
        borderRadius: 14, padding: "28px 20px", textAlign: "center",
        cursor: "pointer", transition: "all .2s",
        background: drag ? C.accentSoft : "transparent",
      }}
    >
      <div style={{ fontSize: 28, marginBottom: 8 }}>📎</div>
      <div style={{ color: C.muted, fontSize: 13 }}>{label}</div>
      <div style={{ color: C.faint, fontSize: 11, marginTop: 4 }}>{accept}</div>
      <input ref={ref} type="file" accept={accept} style={{ display: "none" }}
        onChange={e => handle(e.target.files[0])} />
    </div>
  );
}

async function readFileText(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsText(file);
  });
}

// ─────────────────────────────────────────────────────────────
// FEATURE 1 — SOCRATIC DEBATE (from previous version, refined)
// ─────────────────────────────────────────────────────────────
const SOCRATIC_PROMPT = `You are SocraticAI — a debate-style learning coach who NEVER directly answers or explains.

Rules:
1. Always respond with a challenging question or a deliberate misconception.
2. Keep responses under 3 sentences. Sharp, provocative.
3. Track student reasoning. Push deeper if correct, plant doubt if wrong.
4. Occasionally make a WRONG statement on purpose to let the student correct you.
5. After your text, append exactly: |||JSON{"gap":"<string or null>","correct":<bool>,"concept":"<string>"}|||

Tone: Intellectually sparring, never condescending.`;

const TOPICS = [
  { Icon: Atom, label: "Quantum Physics", seed: "Explain what superposition means." },
  { Icon: Binary, label: "Recursion", seed: "What is recursion and why does it work?" },
  { Icon: TrendingUp, label: "Supply & Demand", seed: "Why do prices rise when supply falls?" },
  { Icon: Dna, label: "Evolution", seed: "How does natural selection actually work?" },
  { Icon: Flame, label: "Thermodynamics", seed: "Why can't we have a 100% efficient engine?" },
  { Icon: Brain, label: "Free Will", seed: "Do humans have genuine free will?" },
];

function parseAI(raw) {
  const m = raw.match(/\|\|\|JSON({.*?})\|\|\|/s);
  let meta = { gap: null, correct: false, concept: "" };
  try { if (m) meta = JSON.parse(m[1]); } catch { }
  return { text: raw.replace(/\|\|\|JSON.*?\|\|\|/s, "").trim(), meta };
}

export function SocraticDebate({ integrityMode, masteryUpdate, compassTopics = [], initialTopic }) {
  const [phase, setPhase] = useState("pick"); // pick | chat | summary
  const [topic, setTopic] = useState("");
  const [activeSubject, setActiveSubject] = useState("");
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [customTopic, setCustomTopic] = useState("");
  const chatRef = useRef();

  // Resolve subject for a given topic label
  const resolveSubject = (label) => {
    const ct = compassTopics.find(t => (t.title || t) === label);
    return ct?.subject || activeSubject || "";
  };

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [msgs, loading]);

  const start = async (label, seed, subj) => {
    const resolvedSubj = subj || resolveSubject(label);
    setTopic(label); setActiveSubject(resolvedSubj); setMsgs([]); setPhase("chat"); setLoading(true);
    const userMsg = { role: "user", content: seed, meta: null };
    setMsgs([userMsg]);
    try {
      const raw = await groq([{ role: "user", content: seed }], SOCRATIC_PROMPT);
      const { text, meta } = parseAI(raw);
      setMsgs([userMsg, { role: "assistant", content: text, meta }]);
      if (meta.concept && masteryUpdate) masteryUpdate(meta.concept, false, "debate", resolvedSubj);
    } catch { setMsgs(p => [...p, { role: "assistant", content: "⚠️ Groq error — check your API key.", meta: null }]); }
    setLoading(false);
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const txt = input.trim(); setInput(""); setLoading(true);
    const newMsg = { role: "user", content: txt, meta: null };
    const updated = [...msgs, newMsg];
    setMsgs(updated);
    try {
      const raw = await groq(updated.map(m => ({ role: m.role, content: m.content })), SOCRATIC_PROMPT);
      const { text, meta } = parseAI(raw);
      setMsgs(p => [...p, { role: "assistant", content: text, meta }]);
      if (meta.concept && masteryUpdate) masteryUpdate(meta.concept, meta.correct, "debate", activeSubject);
    } catch { setMsgs(p => [...p, { role: "assistant", content: "⚠️ Groq error.", meta: null }]); }
    setLoading(false);
  };

  // Auto-start if initialTopic is set
  useEffect(() => {
    if (initialTopic && phase === "pick") {
      start(initialTopic, `Explain the core concepts of ${initialTopic}.`);
    }
  }, [initialTopic]);

  // Group compass topics by subject
  const [expandedSubject, setExpandedSubject] = useState(null);
  const subjectGroups = {};
  compassTopics.forEach(ct => {
    const subj = ct.subject || ct.level || "General";
    if (!subjectGroups[subj]) subjectGroups[subj] = [];
    subjectGroups[subj].push(ct);
  });
  const subjectKeys = Object.keys(subjectGroups);

  if (phase === "pick") return (
    <div style={{ animation: "fadeUp .4s ease both" }}>
      <SectionTitle children="Socratic Debate" sub="Pick a topic — the AI will never give you the answer. It'll make you earn it." />
      {integrityMode === "exam" && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(246,164,48,0.08)", border: `1px solid rgba(246,164,48,0.25)`, borderRadius: 12, fontSize: 13, color: C.amber, display: "flex", alignItems: "center", gap: 8 }}>
          <Lock size={14} /> Exam Mode active — no solutions will be revealed
        </div>
      )}

      {/* Compass subjects — click to expand subtopics */}
      {subjectKeys.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: C.accent, fontWeight: 700, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1, display: "flex", alignItems: "center", gap: 6 }}><Compass size={14} /> Your Subjects</div>
          {subjectKeys.map(subj => {
            const isOpen = expandedSubject === subj;
            const topicsInSubj = subjectGroups[subj];
            return (
              <div key={subj} style={{ marginBottom: 8 }}>
                <button onClick={() => setExpandedSubject(isOpen ? null : subj)} style={{
                  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                  background: isOpen ? C.accentSoft : C.surface, border: `1px solid ${isOpen ? C.accentBorder : C.border}`,
                  borderRadius: isOpen ? "14px 14px 0 0" : 14, padding: "14px 18px", cursor: "pointer",
                  color: C.text, fontFamily: "inherit", transition: "all .18s",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 20 }}><Compass size={20} /></span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontSize: 15, fontWeight: 700 }}>{subj}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{topicsInSubj.length} topic{topicsInSubj.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <span style={{ fontSize: 14, color: C.muted, transition: "transform .2s", transform: isOpen ? "rotate(180deg)" : "" }}>▼</span>
                </button>
                {isOpen && (
                  <div style={{
                    background: "rgba(124,107,255,0.04)", border: `1px solid ${C.accentBorder}`, borderTop: "none",
                    borderRadius: "0 0 14px 14px", padding: "12px",
                  }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(170px,1fr))", gap: 8 }}>
                      {topicsInSubj.map((ct, i) => {
                        const label = ct.title || ct;
                        return (
                          <button key={i} onClick={() => start(label, `Explain the core concepts of ${label}.`, subj)} style={{
                            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10,
                            padding: "10px 14px", cursor: "pointer", textAlign: "left", color: C.text,
                            fontFamily: "inherit", fontSize: 13, transition: "all .15s",
                          }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentBorder; e.currentTarget.style.transform = "translateY(-2px)"; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.transform = ""; }}
                          >
                            <div style={{ fontWeight: 600 }}>{label}</div>
                            <div style={{ fontSize: 10, color: C.muted, marginTop: 3 }}>{ct.level || ""}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 10 }}>Quick Topics</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(190px,1fr))", gap: 12, marginBottom: 20 }}>
        {TOPICS.map((t, i) => (
          <button key={i} onClick={() => start(t.label, t.seed)} style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14,
            padding: "18px 16px", cursor: "pointer", textAlign: "left", color: C.text,
            fontFamily: "inherit", transition: "all .18s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.accentBorder; e.currentTarget.style.background = C.accentSoft; e.currentTarget.style.transform = "translateY(-2px)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.background = C.surface; e.currentTarget.style.transform = ""; }}
          >
            <div style={{ fontSize: 28, marginBottom: 8, display: "flex", alignItems: "center" }}><t.Icon size={28} /></div>
            <div style={{ fontSize: 14, fontWeight: 700 }}>{t.label}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>Click to begin</div>
          </button>
        ))}
      </div>
      <Card style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input value={customTopic} onChange={e => setCustomTopic(e.target.value)}
          placeholder="Or type your own topic / question…"
          style={{ flex: 1, background: "transparent", border: "none", color: C.text, fontSize: 14, fontFamily: "inherit" }}
          onKeyDown={e => { if (e.key === "Enter" && customTopic.trim()) { start(customTopic.trim(), customTopic.trim()); setCustomTopic(""); } }}
        />
        <Btn small onClick={() => { if (customTopic.trim()) { start(customTopic.trim(), customTopic.trim()); setCustomTopic(""); } }}>Go ↵</Btn>
      </Card>
    </div>
  );

  const userMsgs = msgs.filter(m => m.role === "user");
  const correct = userMsgs.filter(m => m.meta?.correct).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "fadeUp .3s ease both" }}>
      {/* Chat header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 18, color: C.text }}>
            Debating: <span style={{ color: C.accent }}>{topic}</span>
          </div>
          <div style={{ fontSize: 12, color: C.muted }}>{Math.floor(msgs.length / 2)} exchanges · {correct} sound arguments</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Btn small variant="ghost" onClick={() => setPhase("summary")}>End & Review</Btn>
          <Btn small variant="ghost" onClick={() => { setPhase("pick"); setMsgs([]); }}>← Topics</Btn>
        </div>
      </div>

      {/* Messages */}
      <div ref={chatRef} style={{ flex: 1, overflowY: "auto", paddingRight: 4, marginBottom: 12 }}>
        <Card style={{ marginBottom: 12, padding: "10px 16px", background: C.accentSoft, borderColor: C.accentBorder }}>
          <span style={{ fontSize: 12, color: C.muted }}>
            <strong style={{ color: "#a5b4fc" }}>Remember:</strong> I will NEVER give you the answer. Argue back. That's how you learn.
          </span>
        </Card>
        {msgs.map((msg, i) => {
          const isUser = msg.role === "user";
          return (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 12, animation: `fadeUp .3s ease ${i * 0.04}s both` }}>
              <div style={{
                width: 30, height: 30, flexShrink: 0, borderRadius: "50%", marginTop: 2,
                background: isUser ? "linear-gradient(135deg,#7c6bff,#a78bfa)" : msg.meta?.correct ? "linear-gradient(135deg,#22d3a0,#059669)" : msg.meta?.gap ? "linear-gradient(135deg,#f6a430,#d97706)" : "linear-gradient(135deg,#3b82f6,#2563eb)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 700, color: "white",
                boxShadow: `0 0 0 3px ${isUser ? "rgba(124,107,255,0.25)" : msg.meta?.correct ? "rgba(34,211,160,0.25)" : "rgba(59,130,246,0.2)"}`,
              }}>{isUser ? "U" : "S"}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: C.muted, marginBottom: 4, display: "flex", gap: 8, alignItems: "center" }}>
                  {isUser ? "YOU" : "SOCRATES"}
                  {msg.meta?.concept && <Badge>{msg.meta.concept}</Badge>}
                </div>
                <Card style={{ padding: "10px 14px", borderColor: isUser ? C.accentBorder : msg.meta?.gap ? "rgba(246,164,48,0.2)" : C.border }}>
                  <div style={{ fontSize: 14, color: C.text, lineHeight: 1.65 }}>{msg.content}</div>
                  {msg.meta?.gap && <div style={{ marginTop: 8, fontSize: 12, color: C.amber, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={12} /> Gap: {msg.meta.gap}</div>}
                  {msg.meta?.correct && isUser && <div style={{ marginTop: 6, fontSize: 12, color: C.green, display: "flex", alignItems: "center", gap: 4 }}><CheckCircle size={12} /> Sound reasoning</div>}
                </Card>
              </div>
            </div>
          );
        })}
        {loading && (
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(135deg,#3b82f6,#2563eb)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white" }}>S</div>
            <Card style={{ padding: "10px 14px" }}><Spinner /></Card>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
        <textarea rows={1} value={input} onChange={e => { setInput(e.target.value); e.target.style.height = "auto"; e.target.style.height = Math.min(e.target.scrollHeight, 100) + "px"; }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Argue your point…"
          style={{ flex: 1, background: C.surface, border: `1px solid ${C.accentBorder}`, borderRadius: 12, padding: "10px 14px", color: C.text, fontSize: 14, fontFamily: "inherit", resize: "none", minHeight: 42 }} />
        <AIVoiceInput onTranscript={(text) => setInput(prev => prev + text)} accentColor={C.accent} />
        <Btn onClick={send} disabled={loading || !input.trim()} style={{ height: 42, padding: "0 18px" }}>↑</Btn>
      </div>

      {/* Summary overlay */}
      {phase === "summary" && (
        <SocraticSummary msgs={msgs} topic={topic} onClose={() => setPhase("chat")} onReset={() => { setPhase("pick"); setMsgs([]); }} />
      )}
    </div>
  );
}

function SocraticSummary({ msgs, topic, onClose, onReset }) {
  const userMsgs = msgs.filter(m => m.role === "user");
  const aiMsgs = msgs.filter(m => m.role === "assistant");
  const correct = userMsgs.filter(m => m.meta?.correct).length;
  const score = Math.round((correct / Math.max(userMsgs.length, 1)) * 100);
  const gaps = [...new Set(aiMsgs.filter(m => m.meta?.gap).map(m => m.meta.gap))];
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.82)", backdropFilter: "blur(18px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 200, padding: 24 }}>
      <div style={{ background: "#0e0e1c", border: `1px solid ${C.accentBorder}`, borderRadius: 24, padding: 40, maxWidth: 480, width: "100%", animation: "fadeUp .4s ease both", boxShadow: "0 0 80px rgba(124,107,255,0.2)" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 52, display: "flex", justifyContent: "center" }}>{score >= 70 ? <Target size={52} /> : score >= 40 ? <Brain size={52} /> : <Sprout size={52} />}</div>
          <h2 style={{ fontFamily: "'Instrument Serif', serif", fontSize: 28, color: C.text, margin: "10px 0 4px" }}>Session Complete</h2>
          <div style={{ color: C.muted, fontSize: 13 }}>Topic: {topic}</div>
        </div>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 28 }}>
          <div style={{ width: 110, height: 110, borderRadius: "50%", background: `conic-gradient(${C.accent} ${score * 3.6}deg, rgba(255,255,255,0.05) 0)`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 40px rgba(124,107,255,0.3)` }}>
            <div style={{ width: 82, height: 82, borderRadius: "50%", background: "#0e0e1c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontSize: 26, fontWeight: 800, color: C.text }}>{score}%</div>
              <div style={{ fontSize: 10, color: C.muted }}>accuracy</div>
            </div>
          </div>
        </div>
        {gaps.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>Reasoning Gaps</div>
            {gaps.map((g, i) => (
              <div key={i} style={{ background: "rgba(246,164,48,0.08)", border: "1px solid rgba(246,164,48,0.2)", borderRadius: 10, padding: "8px 12px", marginBottom: 8, fontSize: 13, color: C.amber, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle size={14} /> {g}</div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: 10 }}>
          <Btn variant="ghost" onClick={onClose} style={{ flex: 1 }}>Resume</Btn>
          <Btn onClick={onReset} style={{ flex: 1 }}>New Topic</Btn>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// FEATURE 2 — STEPWISE HINT SYSTEM (with RANKING UNLOCK)
// ─────────────────────────────────────────────
const HINT_PROMPT = (integrityMode) => `You are a Socratic hint engine. The student has a question/problem.
Generate exactly 3 progressive hints AND a ranking challenge as JSON (no markdown, no backticks):
{
  "hint1": "A very subtle nudge — a question or observation that points toward the right direction. DO NOT reveal the approach.",
  "hint2": "A more direct structural hint — name the concept or strategy to use, but not how.",
  "hint3": ${integrityMode === "exam" ? `"A detailed explanation but still do NOT give the final numerical/written answer. In Exam Mode, we stop here."` : `"The complete worked solution with explanation."`},
  "ranking": {
    "question": "A short instruction like 'Rank these from most to least fundamental for solving this problem:'",
    "options": ["Concept A", "Concept B", "Concept C", "Concept D"],
    "correctOrder": [0, 1, 2, 3],
    "explanations": ["Why option at position 0 is first", "Why position 1", "Why position 2", "Why position 3"]
  }
}
IMPORTANT for ranking:
- Generate exactly 4 options relevant to the student's question
- options array is the DISPLAY labels
- correctOrder is an array of indices into options, representing the correct ranking from first to last
- explanations[i] explains why options[correctOrder[i]] belongs at position i
- Make options plausible enough that ranking is non-trivial`;

// ─── Drag-and-drop Ranking Component ─────────
function RankingChallenge({ ranking, onSubmit, integrityMode }) {
  const [items, setItems] = useState(() => {
    // Shuffle options for display
    const indices = ranking.options.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.map(i => ({ id: i, label: ranking.options[i] }));
  });
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [hasMoved, setHasMoved] = useState(false);

  const handleDragStart = (e, idx) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", idx);
    setDragIdx(idx);
  };

  const handleDragOver = (e, idx) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (idx !== overIdx) setOverIdx(idx);
  };

  const handleDrop = (e, dropIdx) => {
    e.preventDefault();
    const fromIdx = dragIdx;
    if (fromIdx == null || fromIdx === dropIdx) { setDragIdx(null); setOverIdx(null); return; }
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(dropIdx, 0, moved);
      return next;
    });
    setHasMoved(true);
    setDragIdx(null);
    setOverIdx(null);
  };

  const handleDragEnd = () => { setDragIdx(null); setOverIdx(null); };

  // Touch support
  const touchState = useRef({ idx: null, el: null, startY: 0 });
  const listRef = useRef(null);

  const handleTouchStart = (e, idx) => {
    const touch = e.touches[0];
    touchState.current = { idx, el: e.currentTarget, startY: touch.clientY };
  };

  const handleTouchMove = (e, idx) => {
    e.preventDefault();
    const touch = e.touches[0];
    const list = listRef.current;
    if (!list) return;
    const children = Array.from(list.children);
    let targetIdx = idx;
    children.forEach((child, ci) => {
      const rect = child.getBoundingClientRect();
      if (touch.clientY > rect.top && touch.clientY < rect.bottom) targetIdx = ci;
    });
    if (targetIdx !== overIdx) setOverIdx(targetIdx);
    setDragIdx(idx);
  };

  const handleTouchEnd = (e, idx) => {
    if (overIdx != null && overIdx !== idx) {
      setItems(prev => {
        const next = [...prev];
        const [moved] = next.splice(idx, 1);
        next.splice(overIdx, 0, moved);
        return next;
      });
      setHasMoved(true);
    }
    setDragIdx(null);
    setOverIdx(null);
    touchState.current = { idx: null, el: null, startY: 0 };
  };

  const handleSubmit = () => {
    const userOrder = items.map(item => item.id);
    const correctOrder = ranking.correctOrder;
    const isCorrect = userOrder.every((id, i) => id === correctOrder[i]);
    // Build per-item correctness for nudge hints
    const itemCorrectness = userOrder.map((id, i) => id === correctOrder[i]);
    onSubmit(isCorrect, userOrder, itemCorrectness);
  };

  return (
    <Card glow style={{ marginBottom: 16, animation: "fadeUp .3s ease both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 22 }}>🎯</span>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>Ranking Challenge</div>
          <div style={{ fontSize: 12, color: C.muted }}>{ranking.question}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: C.faint, marginBottom: 12 }}>
        Drag and drop to reorder. Place the most important concept at the top.
      </div>
      <div ref={listRef} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {items.map((item, idx) => {
          const isDragging = dragIdx === idx;
          const isOver = overIdx === idx && dragIdx !== idx;
          return (
            <div key={item.id}>
              {isOver && dragIdx != null && dragIdx > idx && (
                <div style={{ height: 3, background: C.accent, borderRadius: 2, margin: "2px 0", transition: "all .2s" }} />
              )}
              <div
                draggable
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onTouchStart={(e) => handleTouchStart(e, idx)}
                onTouchMove={(e) => handleTouchMove(e, idx)}
                onTouchEnd={(e) => handleTouchEnd(e, idx)}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 16px", marginBottom: 6,
                  background: isDragging ? "rgba(124,107,255,0.15)" : C.surface,
                  border: `1px solid ${isDragging ? C.accent : C.border}`,
                  borderRadius: 12, cursor: "grab",
                  opacity: isDragging ? 0.6 : 1,
                  transform: isDragging ? "scale(1.02)" : "none",
                  boxShadow: isDragging ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
                  transition: isDragging ? "none" : "all .2s ease",
                  userSelect: "none",
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: "50%",
                  background: "rgba(255,255,255,0.06)", display: "flex",
                  alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: C.muted,
                  fontFamily: "'JetBrains Mono',monospace", flexShrink: 0,
                }}>{idx + 1}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.text, flex: 1 }}>{item.label}</div>
                <div style={{ color: C.faint, fontSize: 14, cursor: "grab", flexShrink: 0 }}>⠿</div>
              </div>
              {isOver && dragIdx != null && dragIdx < idx && (
                <div style={{ height: 3, background: C.accent, borderRadius: 2, margin: "2px 0", transition: "all .2s" }} />
              )}
            </div>
          );
        })}
      </div>
      <Btn onClick={handleSubmit} disabled={!hasMoved} style={{ marginTop: 14, width: "100%" }}>
        Submit Ranking →
      </Btn>
      {!hasMoved && (
        <div style={{ fontSize: 11, color: C.faint, marginTop: 6, textAlign: "center" }}>
          Reorder at least one item to submit
        </div>
      )}
    </Card>
  );
}

export function HintSystem({ integrityMode, masteryUpdate, compassTopics = [] }) {
  const [question, setQuestion] = useState("");
  const [file, setFile] = useState(null);
  const [hints, setHints] = useState(null);
  const [unlocked, setUnlocked] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");
  // Ranking state
  const [rankingData, setRankingData] = useState(null);
  const [rankingPhase, setRankingPhase] = useState("pending"); // "pending" | "passed" | "revealed"
  const [attempts, setAttempts] = useState(0);         // 0-3 attempts used
  const [shuffleKey, setShuffleKey] = useState(0);

  const MAX_ATTEMPTS = 3;

  // Build unique subjects from compassTopics
  const subjects = [...new Set(compassTopics.map(ct => ct.subject || ct.level || 'General').filter(Boolean))];

  const generate = async () => {
    const q = question.trim();
    if (!q && !file) return;
    setLoading(true); setHints(null); setUnlocked(0); setError("");
    setRankingData(null); setRankingPhase("pending"); setAttempts(0); setShuffleKey(0);
    let text = q;
    if (file) { try { text = (await readFileText(file)) + "\n\n" + q; } catch { text = q; } }
    try {
      const raw = await groq([{ role: "user", content: `Question/Problem:\n${text}` }], HINT_PROMPT(integrityMode), 1200);
      const clean = raw.replace(/```json|```/gi, "").trim();
      const parsed = JSON.parse(clean);
      setHints(parsed);
      if (parsed.ranking && parsed.ranking.options?.length === 4) {
        setRankingData(parsed.ranking);
      } else {
        setRankingPhase("passed");
      }
    } catch { setError("Failed to parse hints. Try again."); }
    setLoading(false);
  };

  const handleRankingSubmit = (isCorrect, userOrder, itemCorrectness) => {
    const newAttempts = attempts + 1;
    setAttempts(newAttempts);
    const topicKey = question.trim().slice(0, 50) || "Hint Question";

    if (isCorrect) {
      // Correct! Pass immediately
      setRankingPhase("passed");
      if (masteryUpdate) masteryUpdate(topicKey, true, "hint", selectedSubject);
    } else if (newAttempts >= MAX_ATTEMPTS) {
      // 3rd wrong — reveal the answer
      setRankingPhase("revealed");
      setUnlocked(3); // unlock all hints too
      if (masteryUpdate) masteryUpdate(topicKey, false, "hint", selectedSubject);
    } else {
      // 1st or 2nd wrong — auto-unlock corresponding hint and let them retry
      setUnlocked(newAttempts); // attempt 1 → unlock hint 1, attempt 2 → unlock hint 2
      setShuffleKey(prev => prev + 1); // reshuffle for next try
    }
  };

  const handleRetry = () => {
    setShuffleKey(prev => prev + 1);
    setRankingPhase("pending");
  };

  const hintDefs = hints ? [
    { key: "hint1", label: "Hint 1", icon: "💡", color: C.accent, desc: "Subtle nudge" },
    { key: "hint2", label: "Hint 2", icon: "🔍", color: C.amber, desc: "Structural guidance" },
    { key: "hint3", label: integrityMode === "exam" ? "Deep Hint (Exam)" : "Full Solution", icon: integrityMode === "exam" ? "📘" : "✅", color: C.green, desc: integrityMode === "exam" ? "No final answer" : "Complete solution" },
  ] : [];

  // Show correct ranking + explanations when Hint 3 (full solution) is unlocked in learning mode
  const showRankingSolution = unlocked >= 3 && integrityMode !== "exam" && rankingData;

  return (
    <div style={{ animation: "fadeUp .4s ease both" }}>
      <SectionTitle children="Stepwise Hint System" sub="Upload or type a question — unlock hints one at a time. Work for the answer." />
      {integrityMode === "exam" && (
        <div style={{ marginBottom: 16, padding: "10px 14px", background: "rgba(246,164,48,0.08)", border: `1px solid rgba(246,164,48,0.25)`, borderRadius: 12, fontSize: 13, color: C.amber }}>
          🔒 Exam Mode — Hint 3 gives deep guidance but withholds the final answer
        </div>
      )}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 12, color: C.muted }}>Type your question</div>
          {subjects.length > 0 && (
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
              style={{
                padding: "4px 10px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                background: selectedSubject ? C.accentSoft : "#14141f",
                border: `1px solid ${selectedSubject ? C.accentBorder : C.border}`,
                color: selectedSubject ? C.accent : "rgba(255,255,255,0.7)", cursor: "pointer", fontFamily: "inherit",
              }}>
              <option value="" style={{ background: "#14141f", color: "rgba(255,255,255,0.7)" }}>Subject</option>
              {subjects.map(s => <option key={s} value={s} style={{ background: "#14141f", color: "#fff" }}>{s}</option>)}
            </select>
          )}
        </div>
        <Textarea value={question} onChange={e => setQuestion(e.target.value)} placeholder="E.g. A train leaves station A at 60km/h… When do they meet?" rows={3} />
        <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}>
          <AIVoiceInput onTranscript={(text) => setQuestion(prev => prev + text)} accentColor={C.amber} />
        </div>
      </Card>
      <div style={{ marginBottom: 16 }}>
        <FileDropzone onFile={f => setFile(f)} label={file ? `📄 ${file.name} — ready` : "Or upload a question file (.txt, .pdf)"} accept=".txt,.pdf" />
      </div>
      <Btn onClick={generate} disabled={loading || (!question.trim() && !file)}>
        {loading ? "Generating hints…" : "Generate Hints →"}
      </Btn>
      {loading && <div style={{ marginTop: 20 }}><Spinner /></div>}
      {error && <div style={{ marginTop: 12, color: C.red, fontSize: 13 }}>{error}</div>}

      {hints && (
        <div style={{ marginTop: 24 }}>

          {/* ─── Unlocked Hint Cards (shown alongside ranking when wrong) ─── */}
          {unlocked > 0 && rankingPhase !== "passed" && rankingPhase !== "revealed" && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 10 }}>
                💡 {attempts === 1 ? "Wrong! Here's Hint 1 to help you rearrange:" : "Still wrong! Here's Hint 2 — try one more time:"}
              </div>
              {hintDefs.slice(0, unlocked).map((h, i) => (
                <div key={h.key} style={{
                  marginBottom: 8, padding: "12px 16px",
                  background: `${h.color}12`, border: `1px solid ${h.color}40`,
                  borderRadius: 12, animation: "fadeUp .3s ease both",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: 16 }}>{h.icon}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: h.color }}>{h.label}</span>
                    <Badge color={h.color}>Unlocked</Badge>
                  </div>
                  <p style={{ fontSize: 13, color: C.text, lineHeight: 1.65, margin: 0 }}>{hints[h.key]}</p>
                </div>
              ))}
            </div>
          )}

          {/* ─── Ranking Challenge (show while not passed/revealed) ─── */}
          {rankingData && rankingPhase === "pending" && (
            <div>
              {attempts > 0 && (
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>
                  Attempt {attempts + 1} of {MAX_ATTEMPTS} — use the hint{unlocked > 1 ? "s" : ""} above to guide your arrangement
                </div>
              )}
              <RankingChallenge key={shuffleKey} ranking={rankingData} onSubmit={handleRankingSubmit} integrityMode={integrityMode} />
            </div>
          )}

          {/* ─── Answer Revealed (3rd wrong attempt) ─── */}
          {rankingPhase === "revealed" && rankingData && (
            <Card glow style={{ marginBottom: 16, animation: "fadeUp .4s ease both" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                <span style={{ fontSize: 20 }}>📊</span>
                <div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.red }}>Answer Revealed</div>
                  <div style={{ fontSize: 12, color: C.muted }}>3 attempts used — here's the correct arrangement and why</div>
                </div>
              </div>
              {rankingData.correctOrder.map((optIdx, pos) => (
                <div key={pos} style={{
                  display: "flex", gap: 12, alignItems: "flex-start",
                  padding: "10px 14px", marginBottom: 6,
                  background: "rgba(124,107,255,0.06)", borderRadius: 10,
                  border: "1px solid rgba(124,107,255,0.12)",
                }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", background: C.accent,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                    fontFamily: "'JetBrains Mono',monospace",
                  }}>{pos + 1}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                      {rankingData.options[optIdx]}
                    </div>
                    {rankingData.explanations?.[pos] && (
                      <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                        {rankingData.explanations[pos]}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}

          {/* ─── Ranking Passed Badge ─── */}
          {rankingPhase === "passed" && attempts > 0 && (
            <div style={{
              marginBottom: 16, padding: "10px 16px",
              background: "rgba(34,211,160,0.08)", border: "1px solid rgba(34,211,160,0.25)",
              borderRadius: 12, display: "flex", alignItems: "center", gap: 10,
              animation: "fadeUp .3s ease both",
            }}>
              <span style={{ fontSize: 18 }}>✅</span>
              <div style={{ fontSize: 13, color: C.green }}>
                Correct! Ranking nailed{attempts > 1 ? ` on attempt ${attempts}` : " on first try"} 🎯
              </div>
            </div>
          )}

          {/* ─── Remaining Hint Cards (after passed or revealed) ─── */}
          {(rankingPhase === "passed" || rankingPhase === "revealed") && (
            <>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 16 }}>Unlock remaining hints one at a time. 🔒</div>
              {hintDefs.map((h, i) => {
                const isUnlocked = unlocked > i;
                const isNext = unlocked === i;
                return (
                  <div key={h.key} style={{ marginBottom: 12, animation: isUnlocked ? `unlockPop .35s ease both` : "none" }}>
                    <div style={{
                      background: isUnlocked ? `${h.color}12` : C.surface,
                      border: `1px solid ${isUnlocked ? `${h.color}40` : C.border}`,
                      borderRadius: 14, overflow: "hidden", transition: "all .3s",
                    }}>
                      {/* Header row */}
                      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span style={{ fontSize: 20 }}>{isUnlocked ? h.icon : "🔒"}</span>
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 700, color: isUnlocked ? h.color : C.muted }}>{h.label}</div>
                            <div style={{ fontSize: 11, color: C.muted }}>{h.desc}</div>
                          </div>
                        </div>
                        {isNext && (
                          <Btn small onClick={() => setUnlocked(i + 1)}>
                            Unlock {h.label}
                          </Btn>
                        )}
                        {isUnlocked && <Badge color={h.color}>Unlocked</Badge>}
                        {!isUnlocked && !isNext && <Badge color={C.muted}>Locked</Badge>}
                      </div>
                      {/* Content */}
                      {isUnlocked && (
                        <div style={{ padding: "0 18px 16px", borderTop: `1px solid ${h.color}22`, paddingTop: 14 }}>
                          <p style={{ fontSize: 14, color: C.text, lineHeight: 1.7 }}>{hints[h.key]}</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* ─── Correct Ranking Reveal (Learning Mode only, after Hint 3) ─── */}
              {showRankingSolution && (
                <Card glow style={{ marginTop: 16, animation: "fadeUp .4s ease both" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 20 }}>📊</span>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: C.accent }}>Correct Ranking</div>
                      <div style={{ fontSize: 12, color: C.muted }}>Why each concept belongs in its position</div>
                    </div>
                  </div>
                  {rankingData.correctOrder.map((optIdx, pos) => (
                    <div key={pos} style={{
                      display: "flex", gap: 12, alignItems: "flex-start",
                      padding: "10px 14px", marginBottom: 6,
                      background: "rgba(124,107,255,0.06)", borderRadius: 10,
                      border: "1px solid rgba(124,107,255,0.12)",
                    }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%", background: C.accent,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0,
                        fontFamily: "'JetBrains Mono',monospace",
                      }}>{pos + 1}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 2 }}>
                          {rankingData.options[optIdx]}
                        </div>
                        {rankingData.explanations?.[pos] && (
                          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                            {rankingData.explanations[pos]}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </Card>
              )}

              <Btn small variant="ghost" style={{ marginTop: 8 }} onClick={() => {
                setHints(null); setUnlocked(0); setQuestion(""); setFile(null);
                setRankingData(null); setRankingPhase("pending"); setAttempts(0);
              }}>
                Try Another Question
              </Btn>
            </>
          )}
        </div>
      )
      }
    </div >
  );
}

// ─────────────────────────────────────────────
// FEATURE 3 — RUBRIC-BASED FEEDBACK
// ─────────────────────────────────────────────
const RUBRIC_PRESETS = {
  essay: `Criteria:
1. Thesis clarity (0-20): Does the essay have a clear, arguable thesis?
2. Evidence & support (0-25): Are claims backed with relevant evidence?
3. Structure & flow (0-20): Is the essay logically organized?
4. Critical thinking (0-20): Does the student analyze rather than just describe?
5. Language & style (0-15): Is the writing clear and precise?`,
  code: `Criteria:
1. Correctness (0-30): Does the code solve the problem correctly?
2. Readability (0-25): Is the code clean, well-named, and commented?
3. Efficiency (0-20): Is the approach reasonably optimal?
4. Edge cases (0-15): Are edge cases handled?
5. Style/conventions (0-10): Does it follow standard conventions?`,
  shortAnswer: `Criteria:
1. Accuracy (0-40): Is the answer factually correct?
2. Completeness (0-30): Does it address all parts of the question?
3. Clarity (0-20): Is the explanation clear and concise?
4. Terminology (0-10): Is domain-specific vocabulary used correctly?`,
};

const RUBRIC_PROMPT = `You are a rigorous academic grader. Grade the student submission using the provided rubric.
Respond ONLY with valid JSON (no markdown, no backticks):
{
  "scores": [{"criterion": "...", "score": <number>, "max": <number>, "feedback": "..."}],
  "totalScore": <number>,
  "totalMax": <number>,
  "grade": "A/B/C/D/F",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."],
  "overall": "2-3 sentence holistic summary"
}`;

export function RubricFeedback({ integrityMode, masteryUpdate, compassTopics = [] }) {
  const [submission, setSubmission] = useState("");
  const [rubric, setRubric] = useState(RUBRIC_PRESETS.essay);
  const [preset, setPreset] = useState("essay");
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedSubject, setSelectedSubject] = useState("");

  // Build unique subjects from compassTopics
  const subjects = [...new Set(compassTopics.map(ct => ct.subject || ct.level || 'General').filter(Boolean))];

  const grade = async () => {
    let text = submission.trim();
    if (file) { try { text = (await readFileText(file)) + "\n\n" + text; } catch { } }
    if (!text) return;
    setLoading(true); setResult(null); setError("");
    try {
      const raw = await groq([{
        role: "user",
        content: `RUBRIC:\n${rubric}\n\nSTUDENT SUBMISSION:\n${text}`
      }], RUBRIC_PROMPT, 800);
      const clean = raw.replace(/```json|```/gi, "").trim();
      const parsed = JSON.parse(clean);
      setResult(parsed);
      // Report to Master Tracker (classification handled centrally by page.jsx)
      const score = parsed.totalScore / parsed.totalMax;
      const topicKey = `${preset} submission`;
      if (masteryUpdate) masteryUpdate(topicKey, score >= 0.5, "rubric", selectedSubject);
    } catch { setError("Failed to parse grading result. Try again."); }
    setLoading(false);
  };

  const pct = result ? Math.round((result.totalScore / result.totalMax) * 100) : 0;
  const gradeColor = result ? (result.grade === "A" ? C.green : result.grade === "B" ? C.accent : result.grade === "C" ? C.amber : C.red) : C.text;

  return (
    <div style={{ animation: "fadeUp .4s ease both" }}>
      <SectionTitle children="Rubric-Based Feedback" sub="Submit your work — get structured, criterion-by-criterion grading." />

      {/* Preset selector + Subject dropdown */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        {Object.keys(RUBRIC_PRESETS).map(k => (
          <button key={k} onClick={() => { setPreset(k); setRubric(RUBRIC_PRESETS[k]); }}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: preset === k ? C.accentSoft : C.surface,
              border: `1px solid ${preset === k ? C.accentBorder : C.border}`,
              color: preset === k ? C.accent : C.muted, cursor: "pointer", fontFamily: "inherit",
            }}>
            {k === "shortAnswer" ? "Short Answer" : k.charAt(0).toUpperCase() + k.slice(1)}
          </button>
        ))}
        {subjects.length > 0 && (
          <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
            style={{
              padding: "6px 14px", borderRadius: 8, fontSize: 12, fontWeight: 600,
              background: selectedSubject ? C.accentSoft : "#14141f",
              border: `1px solid ${selectedSubject ? C.accentBorder : C.border}`,
              color: selectedSubject ? C.accent : "rgba(255,255,255,0.7)", cursor: "pointer", fontFamily: "inherit",
            }}>
            <option value="" style={{ background: "#14141f", color: "rgba(255,255,255,0.7)" }}>Subject</option>
            {subjects.map(s => <option key={s} value={s} style={{ background: "#14141f", color: "#fff" }}>{s}</option>)}
          </select>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Card>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Student Submission</div>
          <Textarea value={submission} onChange={e => setSubmission(e.target.value)} placeholder="Paste essay, code, or short answer here…" rows={6} />
          <div style={{ marginTop: 10 }}>
            <FileDropzone onFile={f => setFile(f)} label={file ? `📄 ${file.name}` : "Or upload file"} accept=".txt,.pdf" />
          </div>
        </Card>
        <Card>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 8 }}>Rubric (editable)</div>
          <Textarea value={rubric} onChange={e => setRubric(e.target.value)} rows={9} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12 }} />
        </Card>
      </div>

      <Btn onClick={grade} disabled={loading || (!submission.trim() && !file)}>
        {loading ? "Grading…" : "Grade Submission →"}
      </Btn>
      {loading && <div style={{ marginTop: 16 }}><Spinner /></div>}
      {error && <div style={{ marginTop: 12, color: C.red, fontSize: 13 }}>{error}</div>}

      {result && (
        <div style={{ marginTop: 24, animation: "fadeUp .4s ease both" }}>
          {/* Score header */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20, alignItems: "center" }}>
            <div style={{
              width: 90, height: 90, borderRadius: "50%",
              background: `conic-gradient(${gradeColor} ${pct * 3.6}deg, rgba(255,255,255,0.05) 0)`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 0 32px ${gradeColor}44`,
            }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: "#0e0e1c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: gradeColor }}>{result.grade}</div>
                <div style={{ fontSize: 10, color: C.muted }}>{result.totalScore}/{result.totalMax}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Overall assessment</div>
              <p style={{ fontSize: 14, color: C.text, lineHeight: 1.65, maxWidth: 480 }}>{result.overall}</p>
            </div>
          </div>

          {/* Criterion scores */}
          <Card style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>Criterion Breakdown</div>
            {result.scores?.map((s, i) => {
              const p = Math.round((s.score / s.max) * 100);
              const c = p >= 75 ? C.green : p >= 50 ? C.amber : C.red;
              return (
                <div key={i} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 13, color: C.text, fontWeight: 600 }}>{s.criterion}</span>
                    <span style={{ fontSize: 13, color: c, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{s.score}/{s.max}</span>
                  </div>
                  <div style={{ height: 4, background: C.surface, borderRadius: 4, marginBottom: 5 }}>
                    <div style={{ height: "100%", width: `${p}%`, background: c, borderRadius: 4, transition: "width .6s ease" }} />
                  </div>
                  <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{s.feedback}</div>
                </div>
              );
            })}
          </Card>

          {/* Strengths & improvements */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Card>
              <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginBottom: 10 }}>✓ Strengths</div>
              {result.strengths?.map((s, i) => <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${C.green}` }}>{s}</div>)}
            </Card>
            <Card>
              <div style={{ fontSize: 12, color: C.amber, fontWeight: 700, marginBottom: 10 }}>↑ Improvements</div>
              {result.improvements?.map((s, i) => <div key={i} style={{ fontSize: 13, color: C.text, marginBottom: 6, paddingLeft: 12, borderLeft: `2px solid ${C.amber}` }}>{s}</div>)}
            </Card>
          </div>
          <Btn small variant="ghost" style={{ marginTop: 12 }} onClick={() => { setResult(null); setSubmission(""); setFile(null); }}>
            Grade Another →
          </Btn>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// FEATURE 4 — MASTERY TRACKER (dual-level tab view)
// Tab bar: General + Subject tabs
// General: stats, source row, subject breakdown list, performance chart
// Subject: stats, source, subtopic breakdown, View Constellation
// ─────────────────────────────────────────────
export function MasteryTracker({ mastery = {}, onViewConstellation, onAddSubject, compassTopics = [] }) {
  const topics = Object.entries(mastery);
  const [activeTab, setActiveTab] = useState("General"); // "General" or subject name

  // Build subject → topic mapping
  const subjectMap = {};
  topics.forEach(([topic, data]) => {
    const subj = data.subject || "General";
    if (!subjectMap[subj]) subjectMap[subj] = [];
    if (!subjectMap[subj].includes(topic)) subjectMap[subj].push(topic);
  });
  compassTopics.forEach(ct => {
    const subj = ct.subject || ct.level || "General";
    if (!subjectMap[subj]) subjectMap[subj] = [];
    const title = ct.title || ct;
    if (typeof title === "string" && !subjectMap[subj].includes(title)) subjectMap[subj].push(title);
  });
  const subjectNames = Object.keys(subjectMap).filter(s => s !== "General").sort();

  // System confidence only — manual overrides are ephemeral (constellation only)
  function getEffectivePct(data) {
    return data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0;
  }

  function subjectStats(subj) {
    const topicNames = subjectMap[subj] || [];
    const entries = topics.filter(([name]) => topicNames.includes(name));
    if (entries.length === 0) return { overall: 0, count: 0, exchanges: 0, weakness: 0, debate: 0, hint: 0, rubric: 0 };
    const pcts = entries.map(([, d]) => getEffectivePct(d));
    const overall = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    const exchanges = entries.reduce((a, [, d]) => a + d.total, 0);
    const weakness = pcts.filter(p => p < 40).length;
    const src = { debate: 0, hint: 0, rubric: 0 };
    entries.forEach(([, d]) => {
      Object.entries(d.sources || {}).forEach(([s, sd]) => {
        if (src[s] !== undefined) src[s] += sd.total;
      });
    });
    return { overall, count: entries.length, exchanges, weakness, ...src };
  }

  // Global stats across all subjects
  const globalStats = (() => {
    if (topics.length === 0) return { overall: 0, count: 0, exchanges: 0, weakness: 0, debate: 0, hint: 0, rubric: 0 };
    const pcts = topics.map(([, d]) => getEffectivePct(d));
    const overall = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
    const exchanges = topics.reduce((a, [, d]) => a + d.total, 0);
    const weakness = pcts.filter(p => p < 40).length;
    const src = { debate: 0, hint: 0, rubric: 0 };
    topics.forEach(([, d]) => {
      Object.entries(d.sources || {}).forEach(([s, sd]) => {
        if (src[s] !== undefined) src[s] += sd.total;
      });
    });
    return { overall, count: topics.length, exchanges, weakness, ...src };
  })();

  const allSubjects = subjectNames;
  const isGeneral = activeTab === "General";

  // ─── SVG Donut Chart — Mastery Progress (achieved vs remaining) ───
  const ProgressChart = ({ pct }) => {
    const cx = 90, cy = 90, r = 75;
    const clampedPct = Math.max(0, Math.min(100, pct));
    const achievedAngle = (clampedPct / 100) * 360;
    const toRad = (deg) => (deg - 90) * (Math.PI / 180);
    const achievedColor = clampedPct >= 70 ? C.green : clampedPct >= 40 ? C.amber : C.red;
    const remainColor = "rgba(255,255,255,0.06)";
    const level = clampedPct >= 90 ? "Expert" : clampedPct >= 70 ? "Advanced" : clampedPct >= 50 ? "Intermediate" : clampedPct >= 25 ? "Beginner" : "Novice";

    return (
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <svg width="180" height="180" viewBox="0 0 180 180">
          {/* Remaining (gray background) */}
          <circle cx={cx} cy={cy} r={r} fill={remainColor} />
          {/* Achieved arc */}
          {clampedPct > 0 && clampedPct < 100 && (() => {
            const start = toRad(0);
            const end = toRad(achievedAngle);
            const largeArc = achievedAngle > 180 ? 1 : 0;
            const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
            const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
            return <path d={`M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${largeArc} 1 ${x2},${y2} Z`} fill={achievedColor} opacity={0.88} />;
          })()}
          {clampedPct >= 100 && <circle cx={cx} cy={cy} r={r} fill={achievedColor} opacity={0.88} />}
          {/* Center hole */}
          <circle cx={cx} cy={cy} r={42} fill="#07070f" />
          <text x={cx} y={cy - 6} textAnchor="middle" fill={C.text} fontSize="18" fontWeight="800" fontFamily="'JetBrains Mono',monospace">{clampedPct}%</text>
          <text x={cx} y={cy + 12} textAnchor="middle" fill={C.muted} fontSize="9" fontFamily="'Syne',sans-serif">mastery</text>
        </svg>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: achievedColor, fontFamily: "'Syne',sans-serif" }}>{level}</div>
          <div style={{ fontSize: 11, color: C.muted }}>You are <strong style={{ color: achievedColor }}>{clampedPct}%</strong> toward full mastery</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: achievedColor }} />
            <span style={{ fontSize: 11, color: C.text }}>Achieved</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: remainColor }} />
            <span style={{ fontSize: 11, color: C.muted }}>Remaining</span>
          </div>
        </div>
      </div>
    );
  };

  // Get current stats based on tab
  const currentStats = isGeneral ? globalStats : subjectStats(activeTab);
  const currentColor = currentStats.overall >= 70 ? C.green : currentStats.overall >= 40 ? C.amber : C.red;

  return (
    <div style={{ animation: "fadeUp .4s ease both" }}>
      <SectionTitle children="Master Tracker" sub="Central performance aggregator — overview of all subjects." />

      {/* ─── Tab bar: General + Subject tabs ─── */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, overflowX: "auto", paddingBottom: 4, flexWrap: "wrap" }}>
        <button onClick={() => setActiveTab("General")} style={{
          padding: "7px 16px", borderRadius: 8,
          border: "1px solid " + (isGeneral ? C.accentBorder : C.border),
          background: isGeneral ? C.accentSoft : C.surface,
          color: isGeneral ? C.accent : C.muted,
          fontSize: 12, fontWeight: isGeneral ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
          whiteSpace: "nowrap", transition: "all .15s",
        }}>General</button>
        {allSubjects.map(subj => (
          <button key={subj} onClick={() => setActiveTab(subj)} style={{
            padding: "7px 16px", borderRadius: 8,
            border: "1px solid " + (activeTab === subj ? C.accentBorder : C.border),
            background: activeTab === subj ? C.accentSoft : C.surface,
            color: activeTab === subj ? C.accent : C.muted,
            fontSize: 12, fontWeight: activeTab === subj ? 700 : 500, cursor: "pointer", fontFamily: "inherit",
            whiteSpace: "nowrap", transition: "all .15s",
          }}>{subj}</button>
        ))}
        {onAddSubject && (
          <button onClick={onAddSubject} title="Add new subject" style={{
            width: 32, height: 32, borderRadius: "50%",
            border: "1px solid " + C.border, background: C.surface,
            color: C.muted, fontSize: 16, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "all .15s", flexShrink: 0,
          }}>+</button>
        )}
      </div>

      {/* ─── Stats row ─── */}
      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {[
          { label: "Overall Confidence", value: `${currentStats.overall}%`, color: currentColor },
          { label: "Topics Explored", value: currentStats.count, color: C.accent },
          { label: "Total Exchanges", value: currentStats.exchanges, color: C.text },
          { label: "Weak Areas", value: currentStats.weakness, color: currentStats.weakness > 0 ? C.red : C.green },
        ].map((s, i) => (
          <Card key={i} style={{ flex: 1, minWidth: 90, textAlign: "center", padding: 14 }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono',monospace" }}>{s.value}</div>
            <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* ─── Source row ─── */}
      <div style={{ display: "flex", gap: 18, marginBottom: 20, fontSize: 12 }}>
        <span style={{ color: C.muted, display: "inline-flex", alignItems: "center", gap: 4 }}><Swords size={12} /> Debate <span style={{ color: C.accent, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{currentStats.debate}</span></span>
        <span style={{ color: C.muted, display: "inline-flex", alignItems: "center", gap: 4 }}><Lightbulb size={12} /> Hints <span style={{ color: C.amber, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{currentStats.hint}</span></span>
        <span style={{ color: C.muted, display: "inline-flex", alignItems: "center", gap: 4 }}><ClipboardList size={12} /> Rubric <span style={{ color: C.green, fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{currentStats.rubric}</span></span>
      </div>

      {isGeneral ? (
        /* ═══ GENERAL TAB CONTENT ═══ */
        <>
          {topics.length === 0 && allSubjects.length === 0 ? (
            <Card style={{ textAlign: "center", padding: 48 }}>
              <div style={{ fontSize: 40, marginBottom: 12, display: "flex", justifyContent: "center" }}><Map size={40} /></div>
              <div style={{ color: C.muted, fontSize: 15 }}>No mastery data yet.</div>
              <div style={{ color: C.faint, fontSize: 13, marginTop: 6 }}>Complete a Debate, use Hints, or get Rubric Feedback to begin tracking.</div>
            </Card>
          ) : (
            <>
              {/* Subject Breakdown list */}
              <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Subject Breakdown</div>
              {allSubjects.map((subj, i) => {
                const s = subjectStats(subj);
                const c = s.overall >= 70 ? C.green : s.overall >= 40 ? C.amber : C.red;
                return (
                  <Card key={i} style={{ marginBottom: 8, cursor: "pointer" }} onClick={() => setActiveTab(subj)}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{subj}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c, fontFamily: "'JetBrains Mono',monospace" }}>{s.overall}%</span>
                    </div>
                    <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 4 }}>
                      <div style={{ height: "100%", width: `${s.overall}%`, background: `linear-gradient(90deg,${c}88,${c})`, borderRadius: 4, transition: "width .8s ease" }} />
                    </div>
                  </Card>
                );
              })}

              {/* Mastery Progress Chart */}
              <Card style={{ marginTop: 16, padding: 20 }}>
                <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 14, textTransform: "uppercase", letterSpacing: 1 }}>Mastery Progress</div>
                <ProgressChart pct={globalStats.overall} />
              </Card>
            </>
          )}
        </>
      ) : (
        /* ═══ SUBJECT TAB CONTENT ═══ */
        (() => {
          const topicNames = subjectMap[activeTab] || [];
          const filteredTopics = topics.filter(([name]) => topicNames.includes(name));
          const sorted = [...filteredTopics].sort((a, b) => getEffectivePct(a[1]) - getEffectivePct(b[1]));

          return (
            <>
              {filteredTopics.length === 0 ? (
                <Card style={{ textAlign: "center", padding: 36 }}>
                  <div style={{ fontSize: 30, marginBottom: 8, display: "flex", justifyContent: "center" }}><BarChart3 size={30} /></div>
                  <div style={{ color: C.muted, fontSize: 14 }}>No subtopic activity yet for {activeTab}.</div>
                  <div style={{ color: C.faint, fontSize: 12, marginTop: 4 }}>Start a Debate, use Hints, or submit Rubric work under this subject.</div>
                </Card>
              ) : (
                <>
                  {/* Subtopic Breakdown */}
                  <div style={{ fontSize: 12, color: C.muted, fontWeight: 600, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Subtopic Breakdown</div>
                  {sorted.map(([topic, data], i) => {
                    const pct = getEffectivePct(data);
                    const color = pct >= 70 ? C.green : pct >= 40 ? C.amber : C.red;
                    const label = pct >= 70 ? "Strong" : pct >= 40 ? "Medium" : "Weak";
                    const src = data.sources || {};
                    return (
                      <Card key={i} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{topic}</span>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <Badge color={color}>{label}</Badge>
                            <span style={{ fontSize: 13, fontWeight: 700, color, fontFamily: "'JetBrains Mono',monospace" }}>{pct}%</span>
                          </div>
                        </div>
                        <div style={{ height: 5, background: "rgba(255,255,255,0.06)", borderRadius: 4, marginBottom: 6 }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg,${color}88,${color})`, borderRadius: 4, transition: "width .8s ease" }} />
                        </div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                          {src.debate && <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 20,
                            background: "rgba(255,255,255,0.07)", fontSize: 11, color: C.text,
                          }}>  <Swords size={11} /> {src.debate.correct}/{src.debate.total}</span>}
                          {src.hint && <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 20,
                            background: "rgba(255,255,255,0.07)", fontSize: 11, color: C.text,
                          }}><Lightbulb size={11} /> {src.hint.correct}/{src.hint.total}</span>}
                          {src.rubric && <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 20,
                            background: "rgba(255,255,255,0.07)", fontSize: 11, color: C.text,
                          }}><ClipboardList size={11} /> {src.rubric.correct}/{src.rubric.total}</span>}
                          {data.manualOverride != null && <span style={{
                            display: "inline-flex", alignItems: "center", gap: 4,
                            padding: "3px 10px", borderRadius: 20,
                            background: "rgba(255,255,255,0.07)", fontSize: 11, color: C.faint,
                            fontWeight: 600, textDecoration: "line-through",
                          }}>Manual {data.manualOverride}%</span>}
                        </div>
                      </Card>
                    );
                  })}
                </>
              )}

              {/* View Constellation — scoped to this subject */}
              {onViewConstellation && (
                <button onClick={() => onViewConstellation(activeTab)} style={{
                  width: "100%", marginTop: 16, padding: "14px", borderRadius: 12,
                  border: `1px solid ${C.accentBorder}`,
                  background: "linear-gradient(135deg, rgba(124,107,255,0.15), rgba(167,139,250,0.08))",
                  color: C.accent, fontSize: 13, fontWeight: 700,
                  cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}>
                  <Compass size={14} /> View {activeTab} Constellation
                </button>
              )}
            </>
          );
        })()
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// INTEGRITY MODE PANEL (settings)
// ─────────────────────────────────────────────
export function IntegrityPanel({ mode, setMode }) {
  return (
    <div style={{ animation: "fadeUp .4s ease both" }}>
      <SectionTitle children="Integrity Mode" sub="Control how much the AI reveals. Set it before a session — stick to it." />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {[
          {
            key: "learning", Icon: BookOpen, label: "Learning Mode",
            desc: "Full hints, progressive reveals, complete solutions. Best for studying and practice.",
            features: ["All 3 hints available", "Full solution reveal", "Reasoning explanations"],
            color: C.green,
          },
          {
            key: "exam", Icon: Lock, label: "Exam Mode",
            desc: "Hints only — the final solution is locked. Simulates real exam conditions.",
            features: ["Hint 1 & 2 available", "No solution reveal", "Exam-style guidance only"],
            color: C.amber,
          },
        ].map(m => (
          <div key={m.key}
            onClick={() => setMode(m.key)}
            style={{
              background: mode === m.key ? `${m.color}10` : C.surface,
              border: `2px solid ${mode === m.key ? m.color : C.border}`,
              borderRadius: 18, padding: 24, cursor: "pointer", transition: "all .2s",
              boxShadow: mode === m.key ? `0 0 32px ${m.color}22` : "none",
            }}>
            <div style={{ fontSize: 36, marginBottom: 12, display: "flex" }}><m.Icon size={36} /></div>
            <div style={{ fontSize: 17, fontWeight: 800, color: mode === m.key ? m.color : C.text, marginBottom: 6, fontFamily: "'Syne',sans-serif" }}>{m.label}</div>
            <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.6, marginBottom: 14 }}>{m.desc}</div>
            {m.features.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: mode === m.key ? m.color : C.muted, display: "flex", gap: 8, marginBottom: 4, alignItems: "center" }}>
                <span>{mode === m.key ? <CheckCircle size={11} /> : "·"}</span><span>{f}</span>
              </div>
            ))}
            {mode === m.key && <div style={{ marginTop: 14 }}><Badge color={m.color}>Active</Badge></div>}
          </div>
        ))}
      </div>
      <Card style={{ marginTop: 20, padding: "14px 18px" }}>
        <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.7 }}>
          <strong style={{ color: C.text }}>How it works:</strong> Integrity Mode affects the{" "}
          <strong style={{ color: C.accent }}>Hint System</strong> and{" "}
          <strong style={{ color: C.accent }}>Socratic Debate</strong> across the entire app.
          In Exam Mode, Socrates will never reveal solutions — only challenge your thinking.
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// SIDEBAR NAV
// ─────────────────────────────────────────────
const NAV_ITEMS = [
  { id: "debate", Icon: Swords, label: "Socratic Debate" },
  { id: "hints", Icon: Lightbulb, label: "Hint System" },
  { id: "rubric", Icon: ClipboardList, label: "Rubric Feedback" },
  { id: "mastery", Icon: Map, label: "Mastery Tracker" },
  { id: "integrity", Icon: ShieldCheck, label: "Integrity Mode" },
];

// ─────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────
