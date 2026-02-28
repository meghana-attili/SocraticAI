"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import katex from "katex";
import { C, FONTS } from "@/lib/theme";
import {
    Upload, X, FileText, Image, Scan, Loader2, ChevronRight,
    BookOpen, Sparkles, List, Code, Copy, Check, ZoomIn, ZoomOut,
    ChevronLeft, Lock
} from "lucide-react";

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// ─── Theme handled in @/lib/theme ───

// ─── Styles ──────────────────────────
const INSIGHT_CSS = `
  @keyframes insightSlideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
  @keyframes insightFadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes selectionPulse { 0%, 100% { border-color: rgba(124,107,255,0.6); } 50% { border-color: rgba(124,107,255,0.2); } }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
  .insight-panel { animation: insightSlideIn 0.3s ease both; }
  .insight-fade { animation: insightFadeUp 0.25s ease both; }
  .selection-rect { animation: selectionPulse 1.5s ease infinite; }

  /* react-pdf TextLayer styles (required to suppress warning) */
  :root { --react-pdf-text-layer: 1; }
  .textLayer {
    position: absolute; text-align: initial; inset: 0;
    overflow: hidden; line-height: 1; text-size-adjust: none;
    forced-color-adjust: none; transform-origin: 0 0; z-index: 2;
  }
  .textLayer :is(span, br) {
    color: transparent; position: absolute; white-space: pre;
    cursor: text; margin: 0; transform-origin: 0 0;
  }
  .textLayer span.markedContent { top: 0; height: 0; }
  .textLayer .highlight {
    margin: -1px; padding: 1px;
    background-color: rgba(124,107,255,0.3); border-radius: 4px;
  }
  .textLayer .highlight.appended { position: initial; }
  .textLayer .highlight.begin { border-radius: 4px 0 0 4px; }
  .textLayer .highlight.end { border-radius: 0 4px 4px 0; }
  .textLayer .highlight.middle { border-radius: 0; }
  .textLayer .highlight.selected { background-color: rgba(124,107,255,0.5); }
  .textLayer br::selection { background: transparent; }
  .textLayer .endOfContent {
    display: block; position: absolute; inset: 100% 0 0;
    z-index: -1; cursor: default; user-select: none;
  }
  .textLayer.selecting .endOfContent { top: 0; }
  .textLayer ::selection { background: rgba(124,107,255,0.3); }
  .katex-display { margin: 0 !important; }
  .katex { font-size: 1.15em !important; color: rgba(255,255,255,0.92) !important; }
`;

// ─── Button Component ────────────────
function Btn({ children, onClick, disabled, variant = "primary", small, style = {} }) {
    const base = {
        padding: small ? "6px 14px" : "10px 20px",
        borderRadius: 10,
        border: "none",
        fontSize: small ? 12 : 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "inherit",
        transition: "all .2s",
        opacity: disabled ? 0.4 : 1,
        display: "inline-flex", alignItems: "center", gap: 6,
        ...style,
    };
    if (variant === "ghost") Object.assign(base, { background: "none", color: C.accent, border: `1px solid ${C.accentBorder}` });
    else Object.assign(base, { background: `linear-gradient(135deg,${C.accent},#9b8aff)`, color: "#fff" });
    return <button onClick={onClick} disabled={disabled} style={base}>{children}</button>;
}

// ─── Main Component ──────────────────
export default function InsightCanvas({ integrityMode }) {
    // Document state
    const [docType, setDocType] = useState(null); // "pdf" | "image"
    const [docSrc, setDocSrc] = useState(null);   // URL or data URL
    const [docName, setDocName] = useState("");
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [scale, setScale] = useState(1.0);

    // Selection state
    const [selectionMode, setSelectionMode] = useState("text"); // "text" | "region"
    const [isDrawing, setIsDrawing] = useState(false);
    const [selRect, setSelRect] = useState(null);  // {x, y, w, h}
    const [selectedText, setSelectedText] = useState("");
    const drawStart = useRef(null);
    const canvasRef = useRef(null);
    const viewerRef = useRef(null);

    // Analysis state
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState(null);
    const [panelOpen, setPanelOpen] = useState(false);
    const [activeTab, setActiveTab] = useState("explanation");

    // Visual image state
    const [visualImages, setVisualImages] = useState(null);
    const [visualLoading, setVisualLoading] = useState(false);

    // ─── Exam Mode Gate ────────────────
    if (integrityMode === "exam") {
        return (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 16, animation: "fadeUp .4s ease both" }}>
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(246,164,48,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Lock size={32} style={{ color: C.amber }} />
                </div>
                <div style={{ fontSize: 24, fontWeight: 400, color: C.text, fontFamily: FONTS.title }}>
                    InsightCanvas is Locked
                </div>
                <div style={{ fontSize: 14, color: C.muted, textAlign: "center", maxWidth: 360, lineHeight: 1.6 }}>
                    Document analysis is disabled in Exam Mode. Switch to Learning Mode from the Integrity panel to use InsightCanvas.
                </div>
            </div>
        );
    }

    // ─── File Upload ───────────────────
    const handleUpload = useCallback((file) => {
        if (!file) return;
        const name = file.name.toLowerCase();
        const url = URL.createObjectURL(file);
        setDocName(file.name);
        setResult(null);
        setPanelOpen(false);
        setSelRect(null);
        setSelectedText("");
        setVisualImages(null);
        setCurrentPage(1);
        setScale(1.0);

        if (name.endsWith(".pdf")) {
            setDocType("pdf");
            setDocSrc(url);
        } else if (/\.(png|jpg|jpeg|webp|gif|bmp)$/.test(name)) {
            setDocType("image");
            setDocSrc(url);
        } else {
            alert("Unsupported file type. Upload a PDF or image.");
        }
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const file = e.dataTransfer?.files?.[0];
        if (file) handleUpload(file);
    }, [handleUpload]);

    // ─── Text Selection Handler ────────
    useEffect(() => {
        if (selectionMode !== "text" || !docSrc) return;
        const handler = () => {
            const sel = window.getSelection();
            const text = sel?.toString()?.trim();
            if (text && text.length > 3) {
                setSelectedText(text);
                setSelRect(null);
            }
        };
        document.addEventListener("mouseup", handler);
        return () => document.removeEventListener("mouseup", handler);
    }, [selectionMode, docSrc]);

    // ─── Region Drawing ────────────────
    const handleMouseDown = useCallback((e) => {
        if (selectionMode !== "region") return;
        const wrapper = e.currentTarget;
        const rect = wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        drawStart.current = { x, y };
        setIsDrawing(true);
        setSelRect(null);
        setSelectedText("");
    }, [selectionMode]);

    const handleMouseMove = useCallback((e) => {
        if (!isDrawing || !drawStart.current) return;
        const wrapper = e.currentTarget;
        const rect = wrapper.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setSelRect({
            x: Math.min(drawStart.current.x, x),
            y: Math.min(drawStart.current.y, y),
            w: Math.abs(x - drawStart.current.x),
            h: Math.abs(y - drawStart.current.y),
        });
    }, [isDrawing]);

    const handleMouseUp = useCallback(() => {
        setIsDrawing(false);
        drawStart.current = null;
    }, []);

    // ─── Crop Region to Base64 ─────────
    const cropRegion = useCallback(() => {
        if (!selRect || !viewerRef.current) return null;

        // Find the rendered image or PDF canvas
        const target = viewerRef.current.querySelector("canvas") || viewerRef.current.querySelector("img");
        if (!target) return null;

        // Scale factor between displayed size and actual pixel size
        const scaleX = (target.naturalWidth || target.width) / target.clientWidth;
        const scaleY = (target.naturalHeight || target.height) / target.clientHeight;

        const cropW = Math.round(selRect.w * scaleX);
        const cropH = Math.round(selRect.h * scaleY);

        const canvas = document.createElement("canvas");
        canvas.width = cropW;
        canvas.height = cropH;
        const ctx = canvas.getContext("2d");

        ctx.drawImage(
            target,
            selRect.x * scaleX,
            selRect.y * scaleY,
            cropW,
            cropH,
            0, 0, cropW, cropH
        );
        return canvas.toDataURL("image/png");
    }, [selRect]);

    // ─── Analyze Selection ─────────────
    const analyzeSelection = useCallback(async () => {
        if (!selectedText && !selRect) return;
        setAnalyzing(true);
        setPanelOpen(true);
        setActiveTab("explanation");
        setVisualImages(null);

        try {
            let body;
            if (selectedText) {
                body = { type: "text", content: selectedText };
            } else {
                const cropped = cropRegion();
                if (!cropped) { setAnalyzing(false); return; }
                body = { type: "image", content: cropped };
            }

            const res = await fetch("/api/canvas/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok) {
                setResult(data);
                // If equation detected, auto-fetch visual images
                if (data.contentType === "equation" && data.latex) {
                    fetchVisual(data.latex, data.explanation?.slice(0, 60) || "Equation");
                }
            } else {
                setResult({ contentType: "error", explanation: data.error || "Analysis failed", keyConcepts: [], steps: [] });
            }
        } catch (err) {
            setResult({ contentType: "error", explanation: err.message, keyConcepts: [], steps: [] });
        }
        setAnalyzing(false);
    }, [selectedText, selRect, cropRegion]);

    // ─── Fetch Visual Images ───────────
    const fetchVisual = async (latex, title) => {
        setVisualLoading(true);
        try {
            const res = await fetch("/api/canvas/manim", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ latex, title }),
            });
            const data = await res.json();
            setVisualImages(data);
        } catch (err) {
            setVisualImages({ images: [], error: err.message });
        }
        setVisualLoading(false);
    };

    // ─── Clear Document ────────────────
    const clearDoc = () => {
        setDocType(null); setDocSrc(null); setDocName("");
        setResult(null); setPanelOpen(false); setSelRect(null);
        setSelectedText(""); setManimScript(null);
        setNumPages(0); setCurrentPage(1); setScale(1.0);
    };

    const hasSelection = selectedText || (selRect && selRect.w > 20 && selRect.h > 20);

    // ─── RENDER ────────────────────────
    return (
        <div style={{ display: "flex", flexDirection: "column", height: "100%", animation: "fadeUp .4s ease both" }}>
            <style>{INSIGHT_CSS}</style>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.21/dist/katex.min.css" />

            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div>
                    <h2 style={{ fontFamily: FONTS.title, fontSize: 32, color: C.text, margin: 0, fontWeight: 400 }}>
                        Insight<span style={{ color: C.accent }}>Canvas</span>
                    </h2>
                    <p style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
                        Upload → Select → Understand. Selection-driven document intelligence.
                    </p>
                </div>
                {docSrc && (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <div style={{
                            padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: selectionMode === "text" ? C.accentSoft : "transparent",
                            border: `1px solid ${selectionMode === "text" ? C.accentBorder : C.border}`,
                            color: selectionMode === "text" ? C.accent : C.muted,
                            cursor: "pointer",
                        }} onClick={() => setSelectionMode("text")}>
                            <FileText size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Text
                        </div>
                        <div style={{
                            padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                            background: selectionMode === "region" ? C.accentSoft : "transparent",
                            border: `1px solid ${selectionMode === "region" ? C.accentBorder : C.border}`,
                            color: selectionMode === "region" ? C.accent : C.muted,
                            cursor: "pointer",
                        }} onClick={() => setSelectionMode("region")}>
                            <Scan size={12} style={{ marginRight: 4, verticalAlign: -2 }} />Region
                        </div>
                        <Btn small variant="ghost" onClick={clearDoc}><X size={12} /> Close</Btn>
                    </div>
                )}
            </div>

            {/* ─── Upload State ─── */}
            {!docSrc && (
                <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById("insight-file-input")?.click()}
                    style={{
                        flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                        border: `2px dashed ${C.accentBorder}`, borderRadius: 20, cursor: "pointer",
                        background: "rgba(124,107,255,0.03)", transition: "all .2s",
                        gap: 16, padding: 40,
                    }}
                >
                    <div style={{
                        width: 80, height: 80, borderRadius: 20, background: C.accentSoft,
                        display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <Upload size={32} style={{ color: C.accent }} />
                    </div>
                    <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>Drop your document here</div>
                        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
                            PDF, PNG, JPG, or WebP — click or drag to upload
                        </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                        <div style={{ padding: "6px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
                            <FileText size={12} style={{ marginRight: 4, verticalAlign: -2 }} /> PDF
                        </div>
                        <div style={{ padding: "6px 14px", borderRadius: 8, background: C.surface, border: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
                            <Image size={12} style={{ marginRight: 4, verticalAlign: -2 }} /> Images
                        </div>
                    </div>
                    <input id="insight-file-input" type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.gif,.bmp" style={{ display: "none" }}
                        onChange={(e) => handleUpload(e.target.files?.[0])} />
                </div>
            )}

            {/* ─── Document + Panel Split ─── */}
            {docSrc && (
                <div style={{ flex: 1, display: "flex", gap: 0, overflow: "hidden", borderRadius: 16, border: `1px solid ${C.border}` }}>

                    {/* Document Viewer */}
                    <div style={{ flex: panelOpen ? 1.4 : 1, display: "flex", flexDirection: "column", transition: "flex .3s", minWidth: 0 }}>

                        {/* Doc toolbar */}
                        <div style={{
                            padding: "8px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                            borderBottom: `1px solid ${C.border}`, background: "rgba(255,255,255,0.02)",
                        }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                {docType === "pdf" ? <FileText size={14} style={{ color: C.accent }} /> : <Image size={14} style={{ color: C.amber }} />}
                                <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{docName}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                {docType === "pdf" && numPages > 1 && (
                                    <>
                                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}
                                            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 2 }}>
                                            <ChevronLeft size={16} />
                                        </button>
                                        <span style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono',monospace" }}>
                                            {currentPage}/{numPages}
                                        </span>
                                        <button onClick={() => setCurrentPage(p => Math.min(numPages, p + 1))} disabled={currentPage >= numPages}
                                            style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 2 }}>
                                            <ChevronRight size={16} />
                                        </button>
                                    </>
                                )}
                                <button onClick={() => setScale(s => Math.min(2.5, s + 0.2))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 2 }}>
                                    <ZoomIn size={14} />
                                </button>
                                <span style={{ fontSize: 10, color: C.faint, fontFamily: "'JetBrains Mono',monospace", minWidth: 32, textAlign: "center" }}>
                                    {Math.round(scale * 100)}%
                                </span>
                                <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", padding: 2 }}>
                                    <ZoomOut size={14} />
                                </button>
                            </div>
                        </div>

                        {/* Viewer area */}
                        <div
                            ref={viewerRef}
                            style={{
                                flex: 1, overflow: "auto", position: "relative",
                                background: "rgba(0,0,0,0.3)",
                                padding: 16,
                            }}
                        >
                            {/* Inner wrapper — selection coords relative to this */}
                            <div
                                onMouseDown={selectionMode === "region" ? handleMouseDown : undefined}
                                onMouseMove={selectionMode === "region" ? handleMouseMove : undefined}
                                onMouseUp={selectionMode === "region" ? handleMouseUp : undefined}
                                style={{
                                    position: "relative", display: "inline-block",
                                    cursor: selectionMode === "region" ? "crosshair" : "text",
                                    userSelect: selectionMode === "text" ? "text" : "none",
                                    margin: "0 auto",
                                }}
                            >
                                {docType === "pdf" && (
                                    <Document file={docSrc} onLoadSuccess={({ numPages: n }) => setNumPages(n)} loading={<div style={{ color: C.muted, fontSize: 13, padding: 40 }}>Loading PDF…</div>}>
                                        <Page pageNumber={currentPage} scale={scale} renderTextLayer={selectionMode === "text"} renderAnnotationLayer={false} />
                                    </Document>
                                )}

                                {docType === "image" && (
                                    <img src={docSrc} alt={docName} style={{ maxWidth: "100%", transform: `scale(${scale})`, transformOrigin: "top left", transition: "transform .2s", display: "block" }} />
                                )}

                                {/* Selection rectangle overlay */}
                                {selRect && selRect.w > 5 && selRect.h > 5 && (
                                    <div className="selection-rect" style={{
                                        position: "absolute",
                                        left: selRect.x, top: selRect.y, width: selRect.w, height: selRect.h,
                                        border: `2px solid ${C.accent}`, background: "rgba(124,107,255,0.1)",
                                        borderRadius: 4, pointerEvents: "none",
                                    }} />
                                )}
                            </div>
                        </div>

                        {/* Selection action bar */}
                        {hasSelection && (
                            <div style={{
                                padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between",
                                borderTop: `1px solid ${C.border}`, background: "rgba(124,107,255,0.04)",
                                animation: "insightFadeUp .2s ease both",
                            }}>
                                <div style={{ fontSize: 12, color: C.muted }}>
                                    {selectedText
                                        ? <><FileText size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> {selectedText.length} chars selected</>
                                        : <><Scan size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> Region {Math.round(selRect.w)}×{Math.round(selRect.h)}px selected</>
                                    }
                                </div>
                                <Btn small onClick={analyzeSelection} disabled={analyzing}>
                                    {analyzing ? <><Loader2 size={12} style={{ animation: "spin 1s linear infinite" }} /> Analyzing…</> : <><Sparkles size={12} /> Analyze Selection</>}
                                </Btn>
                            </div>
                        )}
                    </div>

                    {/* ─── Explanation Panel ─── */}
                    {panelOpen && (
                        <div className="insight-panel" style={{
                            width: 380, minWidth: 320, borderLeft: `1px solid ${C.border}`,
                            display: "flex", flexDirection: "column", background: "rgba(255,255,255,0.015)",
                        }}>
                            {/* Panel header */}
                            <div style={{
                                padding: "12px 16px", borderBottom: `1px solid ${C.border}`,
                                display: "flex", alignItems: "center", justifyContent: "space-between",
                            }}>
                                <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>
                                    <Sparkles size={14} style={{ color: C.accent, marginRight: 6, verticalAlign: -2 }} />
                                    Analysis
                                </div>
                                <button onClick={() => setPanelOpen(false)} style={{ background: "none", border: "none", color: C.muted, cursor: "pointer" }}>
                                    <X size={16} />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div style={{ display: "flex", borderBottom: `1px solid ${C.border}` }}>
                                {[
                                    { id: "explanation", label: "Explain", icon: BookOpen },
                                    { id: "concepts", label: "Concepts", icon: List },
                                    ...(result?.contentType === "equation" ? [{ id: "manim", label: "Visual", icon: Code }] : []),
                                ].map(tab => (
                                    <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
                                        flex: 1, padding: "10px 8px", background: "none", border: "none",
                                        borderBottom: activeTab === tab.id ? `2px solid ${C.accent}` : "2px solid transparent",
                                        color: activeTab === tab.id ? C.accent : C.muted,
                                        fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit",
                                        display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                    }}>
                                        <tab.icon size={12} /> {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Panel content */}
                            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
                                {analyzing && (
                                    <div className="insight-fade" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: 40 }}>
                                        <Loader2 size={28} style={{ color: C.accent, animation: "spin 1s linear infinite" }} />
                                        <div style={{ fontSize: 13, color: C.muted }}>Analyzing selection…</div>
                                    </div>
                                )}

                                {!analyzing && result && activeTab === "explanation" && (
                                    <div className="insight-fade">
                                        {/* Content type badge */}
                                        <div style={{
                                            display: "inline-block", padding: "3px 10px", borderRadius: 6, fontSize: 10, fontWeight: 700,
                                            background: result.contentType === "equation" ? "rgba(124,107,255,0.15)" : result.contentType === "diagram" ? "rgba(246,164,48,0.15)" : "rgba(34,211,160,0.15)",
                                            color: result.contentType === "equation" ? C.accent : result.contentType === "diagram" ? C.amber : C.green,
                                            textTransform: "uppercase", letterSpacing: 1, marginBottom: 14,
                                        }}>
                                            {result.contentType}
                                        </div>

                                        {/* Main explanation */}
                                        <p style={{ fontSize: 14, lineHeight: 1.7, color: C.text, marginBottom: 16 }}>{result.explanation}</p>

                                        {/* LaTeX display — rendered visually */}
                                        {result.latex && (
                                            <div style={{
                                                padding: "16px 18px", borderRadius: 12, marginBottom: 16,
                                                background: "rgba(124,107,255,0.06)", border: `1px solid rgba(124,107,255,0.15)`,
                                                overflowX: "auto", textAlign: "center",
                                            }}>
                                                <div dangerouslySetInnerHTML={{
                                                    __html: (() => {
                                                        try {
                                                            return katex.renderToString(result.latex, {
                                                                displayMode: true,
                                                                throwOnError: false,
                                                                trust: true,
                                                            });
                                                        } catch {
                                                            return `<code style="font-family:'JetBrains Mono',monospace;font-size:12px;color:#7c6bff">${result.latex}</code>`;
                                                        }
                                                    })()
                                                }} />
                                            </div>
                                        )}

                                        {/* Why it matters */}
                                        {result.whyItMatters && (
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                                                    Why it Matters
                                                </div>
                                                <p style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>{result.whyItMatters}</p>
                                            </div>
                                        )}

                                        {/* Steps */}
                                        {result.steps?.length > 0 && (
                                            <div style={{ marginBottom: 16 }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                                                    Step-by-Step
                                                </div>
                                                {result.steps.map((s, i) => (
                                                    <div key={i} className="insight-fade" style={{
                                                        display: "flex", gap: 10, marginBottom: 10, animationDelay: `${i * 0.06}s`,
                                                    }}>
                                                        <div style={{
                                                            width: 22, height: 22, borderRadius: "50%", background: C.accentSoft,
                                                            display: "flex", alignItems: "center", justifyContent: "center",
                                                            fontSize: 10, fontWeight: 700, color: C.accent, flexShrink: 0,
                                                            fontFamily: "'JetBrains Mono',monospace",
                                                        }}>{s.step || i + 1}</div>
                                                        <div>
                                                            <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{s.title}</div>
                                                            <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{s.detail}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Misconceptions */}
                                        {result.commonMisconceptions?.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                                                    ⚠ Common Misconceptions
                                                </div>
                                                {result.commonMisconceptions.map((m, i) => (
                                                    <div key={i} style={{
                                                        padding: "8px 12px", borderRadius: 8, marginBottom: 6,
                                                        background: "rgba(246,164,48,0.06)", border: "1px solid rgba(246,164,48,0.12)",
                                                        fontSize: 12, color: C.text, lineHeight: 1.5,
                                                    }}>
                                                        {m}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {!analyzing && result && activeTab === "concepts" && (
                                    <div className="insight-fade">
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                                            Key Concepts Extracted
                                        </div>
                                        {result.keyConcepts?.length > 0 ? result.keyConcepts.map((concept, i) => (
                                            <div key={i} className="insight-fade" style={{
                                                padding: "10px 14px", borderRadius: 10, marginBottom: 8,
                                                background: C.surface, border: `1px solid ${C.border}`,
                                                animationDelay: `${i * 0.05}s`,
                                            }}>
                                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                                    <div style={{
                                                        width: 6, height: 6, borderRadius: "50%", background: C.accent, flexShrink: 0,
                                                    }} />
                                                    <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>{concept}</span>
                                                </div>
                                            </div>
                                        )) : (
                                            <div style={{ fontSize: 13, color: C.muted }}>No key concepts extracted.</div>
                                        )}
                                    </div>
                                )}

                                {!analyzing && result && activeTab === "manim" && (
                                    <div className="insight-fade">
                                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 12, textTransform: "uppercase", letterSpacing: 1 }}>
                                            Visual Representation
                                        </div>

                                        {/* Loading */}
                                        {visualLoading && (
                                            <div style={{
                                                display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                                                padding: "30px 16px", borderRadius: 12,
                                                background: "rgba(124,107,255,0.04)", border: `1px solid ${C.accentBorder}`,
                                            }}>
                                                <Loader2 size={22} style={{ color: C.accent, animation: "spin 1s linear infinite" }} />
                                                <div style={{ fontSize: 12, color: C.muted }}>Searching for visuals…</div>
                                            </div>
                                        )}

                                        {/* KaTeX rendered equation */}
                                        {result.latex && (
                                            <div style={{
                                                padding: "16px 14px", borderRadius: 12, marginBottom: 14,
                                                background: "linear-gradient(135deg, #0a0a1a 0%, #12122a 50%, #0d0d1f 100%)",
                                                border: `1px solid ${C.accentBorder}`, textAlign: "center",
                                            }}>
                                                <div dangerouslySetInnerHTML={{
                                                    __html: (() => {
                                                        try { return katex.renderToString(result.latex, { displayMode: true, throwOnError: false, trust: true }); }
                                                        catch { return `<code style="color:#7c6bff">${result.latex}</code>`; }
                                                    })()
                                                }} />
                                            </div>
                                        )}

                                        {/* Fetched images from Google */}
                                        {!visualLoading && visualImages?.images?.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>Visual References</div>
                                                {visualImages.images.map((url, i) => (
                                                    <div key={i} className="insight-fade" style={{
                                                        borderRadius: 10, overflow: "hidden", marginBottom: 10,
                                                        border: `1px solid ${C.border}`, background: "#000",
                                                        animationDelay: `${i * 0.1}s`,
                                                    }}>
                                                        <img
                                                            src={url}
                                                            alt={`Visual ${i + 1}`}
                                                            style={{ width: "100%", display: "block", minHeight: 80 }}
                                                            onError={(e) => { e.target.style.display = "none"; }}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* No images found */}
                                        {!visualLoading && visualImages && visualImages.images?.length === 0 && (
                                            <div style={{ fontSize: 13, color: C.muted, textAlign: "center", padding: 20 }}>
                                                No visuals found. Try selecting a different region.
                                            </div>
                                        )}

                                        {/* Component breakdown cards */}
                                        {result.visualParts?.length > 0 && (
                                            <div>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>Component Breakdown</div>
                                                {result.visualParts.map((part, i) => (
                                                    <div key={i} className="insight-fade" style={{
                                                        padding: "12px 14px", borderRadius: 10, marginBottom: 10,
                                                        background: `${part.color || C.accent}10`,
                                                        border: `1px solid ${part.color || C.accent}30`,
                                                        animationDelay: `${i * 0.12}s`,
                                                    }}>
                                                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                                                            <div style={{ width: 8, height: 8, borderRadius: "50%", background: part.color || C.accent, flexShrink: 0 }} />
                                                            <span style={{ fontSize: 11, fontWeight: 700, color: part.color || C.accent, textTransform: "uppercase", letterSpacing: 0.5 }}>{part.label}</span>
                                                        </div>
                                                        <div style={{ padding: "8px 10px", borderRadius: 8, marginBottom: 8, background: "rgba(0,0,0,0.25)", textAlign: "center" }}>
                                                            <div dangerouslySetInnerHTML={{
                                                                __html: (() => {
                                                                    try { return katex.renderToString(part.partLatex, { displayMode: false, throwOnError: false, trust: true }); }
                                                                    catch { return `<code style="color:${part.color || C.accent}">${part.partLatex}</code>`; }
                                                                })()
                                                            }} />
                                                        </div>
                                                        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.5 }}>{part.explanation}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Fetch button if not auto-loaded */}
                                        {!visualLoading && !visualImages && result.latex && (
                                            <Btn small onClick={() => fetchVisual(result.latex, result.explanation?.slice(0, 60))}>
                                                <Sparkles size={12} /> Find Visuals
                                            </Btn>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
