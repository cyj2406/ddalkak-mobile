import { useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, Plus, Sparkles, X } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import { AiAssistantPanel, type AiRequest, type AiResult } from "@/app/components/editor-shell/AiAssistantPanel";
import { DDALKKAK_APPS } from "@/app/components/editor-shell/apps";
import { EditorHeader, type ProfileMenuHandlers, type SaveState, type Viewer } from "@/app/components/editor-shell/EditorHeader";
import { DockButtons, SideDock } from "@/app/components/editor-shell/SideDock";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";
import { setCreditBalance } from "@/app/state/creditBalance";
import { useProfile } from "@/app/state/profile";
import { f } from "@/app/styleTokens";
import artHangul from "@/assets/home/editor/hangul.png";
import artWord from "@/assets/home/editor/word.png";

import { DOC_TEMPLATES, type DocKind, type DocTemplate } from "./docTemplates";
import { PaperThumb } from "./PaperThumb";
import { TemplatePanel, TemplatePreview } from "./TemplatePanel";

/**
 * 한글·워드 편집기 셸(2026-11-19). 기획: docs/doc-editor.md.
 *   상단 바(공통 EditorHeader: 앱 ▾ · 파일 이름 · 저장 상태 · [템플릿] · ✨ 딸깍 AI · 🔔 · 공유 · 프로필)
 *   / [왼쪽 템플릿 패널] [가운데 오픈소스 에디터 자리] [오른쪽 딸깍 AI]
 * 가운데 편집 영역은 오픈소스 에디터라 고칠 수 없다. 이 프로젝트엔 그 에디터가 없어 템플릿·AI 결과만 보이는 목업이다.
 * 코멘트·기록·내보내기는 안쪽 에디터에 있어서 헤더에 두지 않는다(중복 금지).
 */

const CONF: Record<DocKind, { appId: string; icon: string; ext: string; untitled: string; suggestions: string[]; example: string }> = {
  hangul: {
    appId: "hangul", icon: artHangul, ext: "hwpx", untitled: "제목 없음",
    suggestions: ["행사 개최 알림 공문 써 줘", "출장 결과 보고서 초안 써 줘", "협조 요청 공문 써 줘"],
    example: "“제목을 '2026 사업계획서'로 넣고 아래에 추진 일정 표를 만들어 줘”",
  },
  word: {
    appId: "word", icon: artWord, ext: "docx", untitled: "문서",
    suggestions: ["월간 업무 보고서 초안 써 줘", "회의록 정리해 줘", "자기소개서 지원 동기 써 줘"],
    example: "“제목을 '2026 사업계획서'로 넣고 아래에 일정 표를 만들어 줘”",
  },
};
const appName = (kind: DocKind) => DDALKKAK_APPS.flatMap((g) => g.apps).find((a) => a.id === CONF[kind].appId)?.name ?? "딸깍 문서";
const AI_SHORTCUT = "⌘J";

interface AiDraft { title: string; sections: { heading: string; body: string }[] }
interface DocFile { id: string; name: string; templateId?: string; ai?: AiDraft; updatedAt: number }
const isEmpty = (d: DocFile) => !d.templateId && !d.ai;
const storeKey = (kind: DocKind) => `ddalkkak.doceditor.${kind}.v1`;
let seq = 0;
const newId = () => `d${Date.now().toString(36)}${seq++}`;

function load(kind: DocKind): DocFile[] {
  try { return (JSON.parse(localStorage.getItem(storeKey(kind)) ?? "[]") as DocFile[]).slice(0, 20); } catch { return []; }
}

/** 요청 문장에서 문서 제목을 뽑는다(목업). "월간 업무 보고서 초안 써 줘" → "월간 업무 보고서" */
function titleFromPrompt(p: string): string {
  const quoted = p.match(/[‘'“"「](.+?)[’'”"」]/)?.[1];
  if (quoted) return quoted.slice(0, 30);
  return p.replace(/(초안|을|를)?\s*(써|만들어|작성해|정리해)\s*(줘|주세요|줄래)[.!?]?$/u, "").trim().slice(0, 30) || "새 문서";
}

export function DocEditor({ kind, onBack, onBellClick, onSwitchApp, profileMenu }: {
  kind: DocKind;
  onBack: () => void;
  onBellClick?: () => void;
  onSwitchApp?: (appId: string) => void;
  profileMenu?: ProfileMenuHandlers;
}) {
  const conf = CONF[kind];
  const profile = useProfile();
  const viewers: Viewer[] = [{ name: profile.name, avatarUrl: profile.avatarUrl, collabColor: profile.collabColor, isMe: true, activity: "이 탭" }];

  const untitledName = (list: DocFile[]) => {
    const n = list.filter((d) => d.name.startsWith(conf.untitled)).length;
    return kind === "hangul" ? (n ? `${conf.untitled} ${n + 1}` : conf.untitled) : `${conf.untitled}${n + 1}`;
  };
  // 열 때마다 새 빈 문서 하나로 시작한다(홈 "편집기 바로 열기" = 새 문서). 지난 문서는 저장소에만 남는다.
  const [docs, setDocs] = useState<DocFile[]>(() => { const prev = load(kind); return [...prev, { id: newId(), name: untitledName(prev), updatedAt: Date.now() }]; });
  const [openIds, setOpenIds] = useState<string[]>(() => [docs[docs.length - 1].id]);
  const [activeId, setActiveId] = useState(openIds[0]);
  const active = docs.find((d) => d.id === activeId)!;
  const patch = (id: string, p: Partial<DocFile>) => setDocs((l) => l.map((d) => (d.id === id ? { ...d, ...p, updatedAt: Date.now() } : d)));

  // 저장(이 브라우저) — 빈 문서는 저장하지 않는다
  const [saveState, setSaveState] = useState<SaveState>({ kind: "saved", at: Date.now() });
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    setSaveState({ kind: "saving" });
    const t = window.setTimeout(() => {
      try { localStorage.setItem(storeKey(kind), JSON.stringify(docs.filter((d) => !isEmpty(d)))); setSaveState({ kind: "saved", at: Date.now() }); }
      catch { setSaveState({ kind: "error" }); }
    }, 400);
    return () => window.clearTimeout(t);
  }, [docs, kind]);

  // 왼쪽 템플릿 패널: 빈 문서일 때 자동으로 열리고, 템플릿·AI로 내용이 생기면 닫힌다
  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [preview, setPreview] = useState<DocTemplate | null>(null);
  // 오른쪽 딸깍 AI
  const [dock, setDock] = useState<"ai" | null>("ai");
  const dockRef = useRef(dock);
  dockRef.current = dock;
  const [aiDot, setAiDot] = useState(false);
  const [prefill, setPrefill] = useState<{ text: string; key: number } | undefined>();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "j") {
        e.preventDefault(); e.stopPropagation();
        setDock(dockRef.current === "ai" ? null : "ai");
        setAiDot(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);
  const askAi = (text: string) => { setDock("ai"); setAiDot(false); setPrefill({ text, key: Date.now() }); };

  const openNew = (p: Partial<DocFile> = {}) => {
    const d: DocFile = { id: newId(), name: untitledName(docs), updatedAt: Date.now(), ...p };
    setDocs((l) => [...l, d]);
    setOpenIds((o) => [...o, d.id]);
    setActiveId(d.id);
    return d.id;
  };
  const closeTab = (id: string) => {
    const rest = openIds.filter((x) => x !== id);
    if (!rest.length) { onBack(); return; }
    setOpenIds(rest);
    if (activeId === id) setActiveId(rest[Math.max(0, openIds.indexOf(id) - 1)]);
  };

  const applyTemplate = (tpl: DocTemplate, { withAi, target }: { withAi: boolean; target: "new" | "replace" }) => {
    const p: Partial<DocFile> = { templateId: tpl.id, ai: undefined, name: tpl.title };
    if (target === "new") openNew(p); else patch(activeId, p);
    setTemplatesOpen(false);
    if (withAi) askAi(`「${tpl.title}」 서식에 맞춰 내용을 채워 줘. `);
    else showToast("템플릿을 넣었어요. 템플릿은 상단 '템플릿'으로 다시 열 수 있어요.");
  };

  // AI 되돌리기용 — 결과마다 그 직전 문서 상태
  const undoRef = useRef<Record<string, { docId: string; prev: DocFile }>>({});
  const runAi = async (req: AiRequest, onStep: (l: string) => void, isCancelled: () => boolean): Promise<AiResult> => {
    if (req.prompt.trim().length < 4) {
      await new Promise((r) => setTimeout(r, 400));
      return { summary: "어떤 문서를 쓸지 조금 더 알려 주세요. 예: “다음 달 워크숍 안내 공문 써 줘”", credit: 0, stepsDone: 0, stopped: false, addedCount: 0, clarify: true };
    }
    const docId = activeId;
    const doc = docs.find((d) => d.id === docId)!;
    const tpl = DOC_TEMPLATES.find((x) => x.id === doc.templateId);
    const title = tpl?.title ?? titleFromPrompt(req.prompt);
    const heads = tpl?.sections ?? ["개요", "주요 내용", "세부 사항", "향후 계획"];
    const steps = ["요청 읽기", "목차 잡기", "본문 쓰기", "문서에 넣기"];
    for (let i = 0; i < steps.length; i++) {
      if (isCancelled()) return { summary: "멈췄어요. 문서는 바뀌지 않았어요.", credit: 0, stepsDone: i, stopped: true, addedCount: 0 };
      onStep(steps[i]);
      await new Promise((r) => setTimeout(r, 450));
    }
    const draft: AiDraft = { title, sections: heads.map((h) => ({ heading: h, body: `${h}에 들어갈 내용을 요청에 맞춰 정리한 자리예요. (목업: 실제 서비스에서는 딸깍 AI가 문장을 채워요.)` })) };
    const resultId = newId();
    undoRef.current[resultId] = { docId, prev: doc };
    patch(docId, { ai: draft, name: doc.templateId || doc.name.startsWith(conf.untitled) ? title : doc.name });
    setTemplatesOpen(false);
    const credit = 30;
    setCreditBalance((b) => b - credit);
    return { summary: `「${title}」 초안을 문서에 넣었어요. 항목 ${heads.length}개를 썼어요.`, credit, stepsDone: steps.length, stopped: false, addedCount: heads.length, target: { id: docId, label: title, meta: `${conf.ext.toUpperCase()} · 항목 ${heads.length}개` }, createdRootId: resultId };
  };

  const dockTabs = [{ id: "ai", label: "딸깍 AI", hint: `딸깍 AI 열기/닫기 (${AI_SHORTCUT})`, icon: Sparkles, dot: aiDot && dock !== "ai", emphasized: true }];
  const aiPanel = (
    <AiAssistantPanel
      runAi={runAi}
      planAi={(req) => (req.prompt.trim().length < 4 ? [] : ["요청 읽기", "목차 잡기", "본문 쓰기", "문서에 넣기"])}
      context={null}
      suggestions={conf.suggestions}
      example={conf.example}
      commandCount={kind === "hangul" ? 15 : 658}
      onShowResult={(r) => r.target && (setOpenIds((o) => (o.includes(r.target!.id) ? o : [...o, r.target!.id])), setActiveId(r.target.id))}
      onUndoResult={(r) => {
        const u = r.createdRootId ? undoRef.current[r.createdRootId] : undefined;
        if (!u) return;
        setDocs((l) => l.map((d) => (d.id === u.docId ? u.prev : d)));
        showToast("AI가 넣은 내용을 되돌렸어요.");
      }}
      onFinished={() => { if (dockRef.current !== "ai") setAiDot(true); }}
      onClose={() => setDock(null)}
      closeShortcut={AI_SHORTCUT}
      prefill={prefill}
    />
  );

  const tpl = DOC_TEMPLATES.find((x) => x.id === active.templateId);
  const openTabs = useMemo(() => openIds.map((id) => docs.find((d) => d.id === id)!).filter(Boolean), [openIds, docs]);

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-[#f8fafc]" style={f}>
      <EditorHeader
        appIcon={conf.icon}
        appName={appName(kind)}
        currentAppId={conf.appId}
        onSwitchApp={onSwitchApp}
        onNewFile={() => { openNew(); setTemplatesOpen(true); }}
        fileName={`${active.name}.${conf.ext}`}
        onRenameFile={(name) => patch(activeId, { name: name.replace(new RegExp(`\\.${conf.ext}$`), "") })}
        // 저장 상태는 안쪽 오픈소스 에디터가 보여 준다(워드 "저장되지 않음"·자동 저장) — 헤더에 또 두지 않는다
        capabilities={{ share: true }}
        viewers={viewers}
        profileMenu={profileMenu}
        onBack={onBack}
        onBell={onBellClick}
        toolSlot={
          <IconTooltip label={templatesOpen ? "템플릿 닫기" : "템플릿 열기"}><button
            type="button" aria-pressed={templatesOpen} onClick={() => setTemplatesOpen((v) => !v)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] hover:bg-black/[0.05]"
            style={{ fontSize: 12.5, fontWeight: 600, color: templatesOpen ? "#111827" : "#475569", background: templatesOpen ? "rgba(0,0,0,0.06)" : undefined }}
          >
            <LayoutGrid size={15} />템플릿
          </button></IconTooltip>
        }
        actions={<DockButtons tabs={dockTabs} active={dock} onChange={(id) => { setDock(id as "ai" | null); setAiDot(false); }} />}
      />

      {/* 문서가 둘 이상 열렸을 때만 탭 줄 */}
      {openTabs.length > 1 && (
        <div className="h-8 shrink-0 flex items-stretch bg-[#ececee]" style={{ borderTop: "1px solid #eef0f3" }} role="tablist" aria-label="열린 문서">
          {openTabs.map((d) => (
            <div key={d.id} role="tab" aria-selected={d.id === activeId} onClick={() => setActiveId(d.id)} className="flex items-center gap-2 pl-3 pr-1.5 cursor-default" style={{ minWidth: 120, maxWidth: 220, background: d.id === activeId ? "#fff" : undefined, borderRight: "1px solid #e2e2e5" }}>
              <img src={conf.icon} alt="" className="size-3.5 object-contain" />
              <span className="truncate flex-1" style={{ fontSize: 11.5, color: "#111827" }}>{d.name}</span>
              <IconTooltip label="탭 닫기"><button type="button" aria-label={`${d.name} 탭 닫기`} onClick={(e) => { e.stopPropagation(); closeTab(d.id); }} className="size-5 flex items-center justify-center rounded hover:bg-black/[0.06]"><X size={11} color="#6b7280" /></button></IconTooltip>
            </div>
          ))}
          <IconTooltip label="새 문서"><button type="button" aria-label="새 문서" onClick={() => { openNew(); setTemplatesOpen(true); }} className="w-9 flex items-center justify-center hover:bg-black/[0.04]"><Plus size={14} color="#4b5563" /></button></IconTooltip>
        </div>
      )}

      <div className="flex-1 min-h-0 flex" style={{ borderTop: "1px solid #eef0f3" }}>
        {/* 왼쪽 템플릿 */}
        <div className="shrink-0 h-full overflow-hidden" style={{ width: templatesOpen ? 300 : 0, borderRight: templatesOpen ? "1px solid #eef0f3" : undefined, transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
          <TemplatePanel
            kind={kind}
            onPreview={setPreview}
            onBlank={() => { if (isEmpty(active)) { setTemplatesOpen(false); return; } openNew(); }}
            onAskAi={(q) => askAi(q ? `${q} 문서 써 줘` : "")}
            onClose={() => setTemplatesOpen(false)}
          />
        </div>

        {/* 가운데: 오픈소스 에디터 자리(목업) */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#e9ebef]" aria-label="문서 편집 영역">
          <div className="shrink-0 flex items-center gap-2 bg-white px-4" style={{ height: 64, borderBottom: "1px solid #e2e8f0" }} aria-hidden>
            {Array.from({ length: 14 }, (_, i) => <span key={i} className="rounded" style={{ width: i % 5 === 4 ? 1 : 26, height: i % 5 === 4 ? 28 : 26, background: i % 5 === 4 ? "#e2e8f0" : "#f1f5f9" }} />)}
            <span className="ml-auto" style={{ fontSize: 11.5, color: "#94a3b8" }}>{kind === "hangul" ? "한글" : "워드"} 에디터 도구 모음 · 오픈소스 영역(목업)</span>
          </div>
          <div className="flex-1 overflow-auto ui-scroll py-8 px-6">
            <div className="mx-auto bg-white" style={{ width: "min(100%, 680px)", minHeight: 880, boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px #e2e8f0", padding: active.ai ? "64px 72px" : tpl ? 0 : "64px 72px" }}>
              {active.ai ? (
                <article>
                  <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", textAlign: "center", letterSpacing: "-0.4px" }}>{active.ai.title}</h1>
                  {active.ai.sections.map((s, i) => (
                    <section key={s.heading} style={{ marginTop: i ? 20 : 32 }}>
                      <h2 style={{ fontSize: 15, fontWeight: 700, color: "#1e293b" }}>{i + 1}. {s.heading}</h2>
                      <p style={{ fontSize: 13.5, lineHeight: 1.8, color: "#334155", marginTop: 6 }}>{s.body}</p>
                    </section>
                  ))}
                </article>
              ) : tpl ? (
                <PaperThumb template={tpl} scale={5.2} />
              ) : (
                <span className="inline-block w-px h-5 animate-pulse" style={{ background: "#111827" }} aria-label="빈 문서" />
              )}
            </div>
          </div>
        </main>

        <SideDock rail={false} active={dock} onChange={(id) => setDock(id as "ai" | null)} tabs={[{ ...dockTabs[0], panel: aiPanel }]} />
      </div>

      {preview && (
        <TemplatePreview
          template={preview}
          docHasContent={!isEmpty(active)}
          onApply={(o) => applyTemplate(preview, o)}
          onClose={() => setPreview(null)}
        />
      )}
    </div>
  );
}
