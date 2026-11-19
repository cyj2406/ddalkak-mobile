import { useEffect, useRef, useState } from "react";
import {
  ArrowUp, Bell, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, FileText, Frame, FolderOpen, Image as ImageIcon, MessagesSquare, Loader2,
  MessageSquarePlus, Plus, Scan, Sparkles, Square, Trash2, Upload, X, Zap, ListChecks, Crosshair, Undo2,
} from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import { color, f } from "@/app/styleTokens";

import { PanelCloseButton } from "./SideDock";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/**
 * 딸깍 AI 패널(에디터 공통, 2026-11-13 v2) — 오른쪽 도크의 AI 탭. 기획: docs/ui-design-editor.md "4. 딸깍 AI".
 * Claude 사이드 패널을 참고했다:
 *   - 입력창: ＋(파일 올리기 · 프로젝트 파일에서 고르기 · 선택 영역 첨부) · 실행 방식(자동 / 먼저 계획 보여 주기) · 보내기/정지. 그 밖의 아이콘은 뺐다.
 *   - 프로젝트 자료: 지침 + 파일(Claude 프로젝트의 지식). 요청마다 자동으로 함께 보낸다.
 *   - 대화: 제목 · 기록(지난 대화) · 새 대화. 작업 결과: 단계 요약(펼침) · 설명 · 크레딧 · 결과 액션 · 복사/의견.
 * 실제 작업은 에디터가 넘긴 runAi 가 한다(지금은 목업).
 */

export interface AiAttachment { id: string; name: string; size: number; kind: "image" | "pdf" | "fig" | "selection" | "other"; url?: string }
export interface AiRequest { prompt: string; attachments: AiAttachment[]; instructions: string; projectFiles: AiAttachment[]; mode: RunMode }
export interface AiResult {
  summary: string; credit: number; stepsDone: number; stopped: boolean; addedCount: number;
  /** 결과 카드 — 누르면 캔버스에서 그 요소를 선택해 보여 준다(Claude 결과 파일 카드처럼) */
  target?: { id: string; label: string; meta: string };
  /** 새로 만든 최상위 요소 — 있으면 최신 결과에 한해 ↶ 되돌리기(만든 것만 지움) */
  createdRootId?: string;
  /** 요청이 모호해 되물은 답 — 작업·크레딧 없음 */
  clarify?: boolean;
}
export type RunAi = (req: AiRequest, onStep: (label: string) => void, isCancelled: () => boolean) => Promise<AiResult>;
export type PlanAi = (req: AiRequest) => string[];
type RunMode = "auto" | "plan";
interface QueueItem { id: number; req: AiRequest }

type AiMsg = { id: number; role: "ai"; status: "plan" | "working" | "done" | "stopped" | "cancelled"; steps: string[]; plan?: string[]; result?: AiResult; req: AiRequest };
type Msg = { id: number; role: "user"; text: string; attachments: AiAttachment[] } | AiMsg;
interface Conversation { id: number; title: string; msgs: Msg[]; at: number; /** 실제 작업이 한 번 끝나 제목이 정해졌는지 — 되물은 답("더" 등)은 제목이 되지 않게 */ titled?: boolean }

const MAX_FILE = 20 * 1024 * 1024;
const MAX_ATTACH = 5;
const PROJECT_LIMIT = 100 * 1024 * 1024;
const MAX_QUEUE = 5;
const fmtSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`);
const kindOf = (file: File): AiAttachment["kind"] =>
  file.type.startsWith("image/") ? "image" : file.type === "application/pdf" ? "pdf" : /\.fig(craft)?$/i.test(file.name) ? "fig" : "other";
let attSeq = 0;
const toAttachment = (file: File): AiAttachment => ({
  id: `a${Date.now()}${attSeq++}`, name: file.name, size: file.size, kind: kindOf(file), url: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
});

export function AiAssistantPanel({
  runAi, planAi, context, suggestions, example, commandCount = 634, onAttachSelection, onShowResult, onUndoResult, onFinished, onClose, closeShortcut,
}: {
  runAi: RunAi;
  planAi: PlanAi;
  /** 맥락 칩 — 선택한 요소 등. null 이면 "페이지 전체" */
  context: { label: string; onClear: () => void } | null;
  suggestions: string[];
  example: string;
  commandCount?: number;
  onAttachSelection?: () => AiAttachment | null;
  onShowResult?: (r: AiResult) => void;
  onUndoResult?: (r: AiResult) => void;
  /** 작업이 끝났을 때(도크가 접혀 있으면 탭에 점을 붙이는 데 쓴다) */
  onFinished?: () => void;
  /** 머리 왼쪽 » 접기 버튼 — 도크가 넘긴다 */
  onClose?: () => void;
  closeShortcut?: string;
}) {
  const [convs, setConvs] = useState<Conversation[]>([{ id: 1, title: "새 대화", msgs: [], at: Date.now() }]);
  const [cur, setCur] = useState(1);
  const conv = convs.find((c) => c.id === cur)!;
  const msgs = conv.msgs;
  const setMsgs = (fn: (m: Msg[]) => Msg[], convId = cur) =>
    setConvs((all) => all.map((c) => (c.id === convId ? { ...c, msgs: fn(c.msgs), at: Date.now() } : c)));

  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [mode, setMode] = useState<RunMode>("auto");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [running, setRunning] = useState(false);
  const [menu, setMenu] = useState<null | "plus" | "mode" | "history" | "projectPick">(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [projectFiles, setProjectFiles] = useState<(AiAttachment & { at: number })[]>([]);
  const cancelRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const projFileRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(1);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [msgs]);
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest("[data-ai-menu]")) setMenu(null); };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  const projectCount = projectFiles.length + (instructions.trim() ? 1 : 0);

  const execute = async (aid: number, req: AiRequest, convId: number) => {
    setRunning(true);
    cancelRef.current = false;
    const patch = (p: (m: AiMsg) => Partial<AiMsg>) => setMsgs((all) => all.map((m) => (m.id === aid && m.role === "ai" ? { ...m, ...p(m) } : m)), convId);
    patch(() => ({ status: "working" }));
    const result = await runAi(req, (label) => patch((m) => ({ steps: [...m.steps, label] })), () => cancelRef.current);
    patch(() => ({ status: result.stopped ? "stopped" : "done", result }));
    if (!result.clarify) setConvs((all) => all.map((c) => (c.id === convId && !c.titled ? { ...c, title: req.prompt.slice(0, 24), titled: true } : c)));
    setRunning(false);
    onFinished?.();
  };

  const start = (req: AiRequest) => {
    const uid = ++idRef.current, aid = ++idRef.current;
    const convId = cur;
    // 계획을 세울 게 없는 요청(모호해서 되물어야 하는 경우)은 바로 실행해 질문으로 답한다
    if (req.mode === "plan" && planAi(req).length > 0) {
      setMsgs((m) => [...m, { id: uid, role: "user", text: req.prompt, attachments: req.attachments }, { id: aid, role: "ai", status: "plan", steps: [], plan: planAi(req), req }], convId);
      return;
    }
    setMsgs((m) => [...m, { id: uid, role: "user", text: req.prompt, attachments: req.attachments }, { id: aid, role: "ai", status: "working", steps: [], req }], convId);
    void execute(aid, req, convId);
  };

  useEffect(() => {
    if (running || queue.length === 0) return;
    const [next, ...rest] = queue;
    setQueue(rest);
    start(next.req);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, queue]);

  const send = (text = input) => {
    const t = text.trim();
    if (!t) return;
    const req: AiRequest = { prompt: t, attachments, instructions, projectFiles, mode };
    if (running) {
      if (queue.length >= MAX_QUEUE) { showToast(`대기는 ${MAX_QUEUE}개까지예요. 앞의 요청이 끝나면 다시 보내 주세요.`, "error"); return; }
      setQueue((q) => [...q, { id: ++idRef.current, req }]);
    } else start(req);
    setInput("");
    setAttachments([]);
  };
  /** 바로 보내기 — 이 요청을 맨 앞으로 올리고 지금 작업을 멈춘다(그린 데까지는 남는다) */
  const sendQueuedNow = (id: number) => {
    setQueue((q) => { const it = q.find((x) => x.id === id); return it ? [it, ...q.filter((x) => x.id !== id)] : q; });
    cancelRef.current = true;
  };

  const addFiles = (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files);
    const tooBig = list.filter((x) => x.size > MAX_FILE);
    if (tooBig.length) showToast(`20MB가 넘는 파일은 올릴 수 없어요: ${tooBig[0].name}`, "error");
    const ok = list.filter((x) => x.size <= MAX_FILE);
    setAttachments((a) => {
      const room = MAX_ATTACH - a.length;
      if (ok.length > room) showToast(`한 번에 ${MAX_ATTACH}개까지 첨부할 수 있어요.`, "error");
      return [...a, ...ok.slice(0, Math.max(0, room)).map(toAttachment)];
    });
  };
  const addProjectFiles = (files: FileList | null) => {
    if (!files) return;
    const used = projectFiles.reduce((s, x) => s + x.size, 0);
    let room = PROJECT_LIMIT - used;
    const added: (AiAttachment & { at: number })[] = [];
    for (const file of Array.from(files)) {
      if (file.size > room) { showToast("프로젝트 용량(100MB)을 넘어요.", "error"); break; }
      room -= file.size;
      added.push({ ...toAttachment(file), at: Date.now() });
    }
    setProjectFiles((p) => [...p, ...added]);
  };

  const newChat = () => {
    if (msgs.length === 0) return;
    const id = ++idRef.current;
    setConvs((all) => [{ id, title: "새 대화", msgs: [], at: Date.now() }, ...all]);
    setCur(id);
    setMenu(null);
  };

  const iconBtn = "size-7 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";
  const menuStyle = { boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" } as const;
  const menuItem = "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[#f8fafc] disabled:opacity-40 disabled:hover:bg-transparent";

  return (
    <div className="relative flex flex-col h-full" style={f}>
      {/* 머리 — 대화 제목 · 기록 · 새 대화 · 프로젝트 자료 */}
      <div className="relative flex items-center gap-1 shrink-0" style={{ height: 44, padding: onClose ? "0 8px 0 6px" : "0 8px 0 14px", borderBottom: "1px solid #eef0f3" }} data-ai-menu>
        {onClose && <PanelCloseButton onClick={onClose} shortcut={closeShortcut} />}
        <Sparkles size={15} color="#111827" className="shrink-0" />
        <span className="truncate" style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{msgs.length ? conv.title : "딸깍 AI"}</span>
        <div className="ml-auto flex items-center shrink-0">
          <IconTooltip label="대화 목록 (이 파일에서 나눈 대화)"><button type="button" className={iconBtn} aria-label="대화 목록" aria-expanded={menu === "history"} onClick={() => setMenu(menu === "history" ? null : "history")}><MessagesSquare size={15} color="#475569" /></button></IconTooltip>
          <IconTooltip label="새 대화"><button type="button" className={iconBtn} aria-label="새 대화" disabled={msgs.length === 0} onClick={newChat}><MessageSquarePlus size={15} color={msgs.length ? "#475569" : "#cbd5e1"} /></button></IconTooltip>
          <IconTooltip label="프로젝트 자료: AI가 매번 참고해요"><button type="button" className={`${iconBtn} w-auto px-1.5 gap-1`} aria-label="프로젝트 자료" onClick={() => setProjectOpen(true)}>
            <FolderOpen size={15} color="#475569" />{projectCount > 0 && <span style={{ fontSize: 11, fontWeight: 700, color: color.brand }}>{projectCount}</span>}
          </button></IconTooltip>
        </div>
        {menu === "history" && (
          <div className="absolute right-2 top-10 z-30 bg-white rounded-xl py-1 w-[260px]" style={menuStyle}>
            <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", padding: "6px 12px" }}>이 파일의 대화</p>
            {convs.filter((c) => c.msgs.length || c.id === cur).map((c) => (
              <button key={c.id} type="button" className={menuItem} onClick={() => { setCur(c.id); setMenu(null); }} style={{ background: c.id === cur ? "#f8fafc" : undefined }}>
                <span className="truncate flex-1" style={{ fontSize: 12.5, color: "#111827", fontWeight: c.id === cur ? 600 : 400 }}>{c.msgs.length ? c.title : "새 대화"}</span>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>{c.msgs.filter((m) => m.role === "user").length}개</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 대화 */}
      <div ref={listRef} className="flex-1 overflow-y-auto ui-scroll" style={{ padding: "12px 14px 16px" }}>
        {msgs.length === 0 ? (
          <div>
            <p style={{ fontSize: 12.5, lineHeight: "20px", color: "#4b5563", wordBreak: "keep-all" }}>하고 싶은 작업을 말로 적어 주세요. 예: {example}</p>
            <span className="inline-block mt-1.5 rounded px-1.5 py-0.5" style={{ fontSize: 11, color: "#6b7280", background: "#f3f4f6" }}>사용할 수 있는 명령 {commandCount}개</span>
            <Suggestions items={suggestions} onPick={(s) => send(s)} />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {msgs.map((m, mi) => m.role === "user" ? (
              <div key={m.id} className="self-end max-w-[88%] flex flex-col items-end gap-1">
                {m.attachments.length > 0 && <div className="flex flex-wrap justify-end gap-1">{m.attachments.map((a) => <AttachChip key={a.id} a={a} />)}</div>}
                <div className="rounded-xl px-3 py-2" style={{ background: "#f1f5f9", fontSize: 12.5, lineHeight: "19px", color: "#111827", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{m.text}</div>
              </div>
            ) : (
              <AiTurn
                key={m.id} m={m}
                isLatest={!msgs.slice(mi + 1).some((x) => x.role === "ai")}
                onRunPlan={() => void execute(m.id, { ...m.req, mode: "auto" }, cur)}
                onCancelPlan={() => setMsgs((all) => all.map((x) => (x.id === m.id && x.role === "ai" ? { ...x, status: "cancelled" } : x)))}
                onShow={onShowResult} onUndo={onUndoResult}
              />
            ))}
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="shrink-0" style={{ padding: "0 12px 12px" }}>
        {queue.length > 0 && (
          <QueueTray
            items={queue}
            onRemove={(id) => setQueue((q) => q.filter((x) => x.id !== id))}
            onSendNow={sendQueuedNow}
            onClear={() => setQueue([])}
          />
        )}
        {/* 포커스는 바깥 상자 테두리로만 — 안쪽 입력칸에 전역 포커스 테두리가 겹쳐 그려지지 않게 */}
        <div className="rounded-2xl bg-white border border-[#e5e7eb] focus-within:border-[#a5b4fc] focus-within:shadow-[0_0_0_3px_rgba(79,123,255,0.12)] transition-shadow" style={{ padding: "8px 10px 8px" }}>
          <div className="flex flex-wrap gap-1 mb-1.5">
            {context ? (
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 h-6 max-w-full" style={{ background: color.surface.accent, fontSize: 11, color: color.brand, fontWeight: 600 }}>
                <Crosshair size={11} /><span className="truncate">선택: {context.label}</span>
                <button type="button" aria-label="선택 맥락 빼기" onClick={context.onClear} className="shrink-0"><X size={11} /></button>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-md px-1.5 h-6" style={{ background: "#f3f4f6", fontSize: 11, color: "#64748b" }}><Scan size={11} />페이지 전체</span>
            )}
            {projectCount > 0 && (
              <button type="button" onClick={() => setProjectOpen(true)} className="inline-flex items-center gap-1 rounded-md px-1.5 h-6" style={{ background: "#f3f4f6", fontSize: 11, color: "#475569" }}>
                <FolderOpen size={11} />프로젝트 자료 {projectCount}개 참고 중
              </button>
            )}
            {attachments.map((a) => <AttachChip key={a.id} a={a} onRemove={() => setAttachments((l) => l.filter((x) => x.id !== a.id))} />)}
          </div>
          <textarea
            rows={2} value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
            onPaste={(e) => { if (e.clipboardData.files.length) { e.preventDefault(); addFiles(e.clipboardData.files); } }}
            placeholder={running ? (queue.length ? "더 적으면 대기열 뒤에 붙어요" : "다음에 할 일을 적으면 지금 일이 끝난 뒤 보내요") : "무엇을 할까요?"}
            aria-label="딸깍 AI에게 요청"
            className="w-full resize-none bg-transparent"
            style={{ ...f, fontSize: 12.5, lineHeight: "19px", color: "#111827", outline: "none", boxShadow: "none" }}
          />
          <div className="relative flex items-center gap-1 mt-0.5" data-ai-menu>
            <IconTooltip label="첨부: 파일 · 프로젝트 파일 · 선택 영역" side="top"><button type="button" aria-label="첨부" aria-expanded={menu === "plus"} onClick={() => setMenu(menu === "plus" ? null : "plus")} className="size-8 rounded-full flex items-center justify-center hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
              <Plus size={17} color="#334155" />
            </button></IconTooltip>
            <button type="button" aria-expanded={menu === "mode"} onClick={() => setMenu(menu === "mode" ? null : "mode")} className="flex items-center gap-1 rounded-full px-2 h-7 hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 12, color: "#334155", fontWeight: 600 }}>
              {mode === "auto" ? <Zap size={13} /> : <ListChecks size={13} />}{mode === "auto" ? "자동" : "계획 먼저"}<ChevronDown size={11} color="#94a3b8" />
            </button>
            {running && !input.trim() ? (
              <IconTooltip label="작업 중지 (그린 데까지는 남아요)" side="top"><button type="button" aria-label="작업 중지" onClick={() => { cancelRef.current = true; }} className="ml-auto size-8 rounded-full flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]" style={{ background: color.brand }}>
                <Square size={12} color="#fff" fill="#fff" />
              </button></IconTooltip>
            ) : (
              <IconTooltip label={running ? "대기열에 추가 (Enter)" : "보내기 (Enter)"} side="top"><button type="button" aria-label={running ? "대기열에 추가" : "보내기"} disabled={!input.trim()} onClick={() => send()} className="ml-auto size-8 rounded-full flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]" style={{ background: input.trim() ? color.brand : "#c7d2fe" }}>
                <ArrowUp size={16} color="#fff" strokeWidth={2.2} />
              </button></IconTooltip>
            )}

            {menu === "plus" && (
              <div className="absolute left-0 bottom-10 z-30 bg-white rounded-xl py-1 w-[230px]" style={menuStyle}>
                <button type="button" className={menuItem} onClick={() => { setMenu(null); fileRef.current?.click(); }}>
                  <Upload size={14} color="#475569" /><span style={{ fontSize: 12.5 }}>파일 올리기</span><span className="ml-auto" style={{ fontSize: 10.5, color: "#94a3b8" }}>이미지·PDF·.fig</span>
                </button>
                <button type="button" className={menuItem} disabled={projectFiles.length === 0} onClick={() => setMenu("projectPick")}>
                  <FolderOpen size={14} color="#475569" /><span style={{ fontSize: 12.5 }}>프로젝트 파일에서 고르기</span><ChevronRight size={12} className="ml-auto" color="#94a3b8" />
                </button>
                <button
                  type="button" className={menuItem} disabled={!onAttachSelection || !context}
                  onClick={() => { setMenu(null); const a = onAttachSelection?.(); if (a) setAttachments((l) => (l.length >= MAX_ATTACH ? l : [...l, a])); }}
                >
                  <ImageIcon size={14} color="#475569" /><span style={{ fontSize: 12.5 }}>선택 영역을 이미지로 첨부</span>
                </button>
              </div>
            )}
            {menu === "projectPick" && (
              <div className="absolute left-0 bottom-10 z-30 bg-white rounded-xl py-1 w-[240px] max-h-[240px] overflow-y-auto ui-scroll" style={menuStyle}>
                <p style={{ fontSize: 11, fontWeight: 600, color: "#64748b", padding: "6px 12px" }}>이번 메시지에 첨부할 프로젝트 파일</p>
                {projectFiles.map((p) => {
                  const on = attachments.some((a) => a.id === p.id);
                  return (
                    <button key={p.id} type="button" className={menuItem} onClick={() => setAttachments((l) => (on ? l.filter((a) => a.id !== p.id) : l.length >= MAX_ATTACH ? l : [...l, p]))}>
                      <span className="size-4 rounded flex items-center justify-center shrink-0" style={{ border: "1px solid #cbd5e1", background: on ? color.brand : "#fff" }}>{on && <Check size={11} color="#fff" />}</span>
                      <span className="truncate" style={{ fontSize: 12.5 }}>{p.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {menu === "mode" && (
              <div className="absolute left-8 bottom-10 z-30 bg-white rounded-xl py-1 w-[250px]" style={menuStyle}>
                {([["auto", Zap, "자동", "바로 캔버스에 그려요"], ["plan", ListChecks, "계획 먼저 보여 주기", "할 일을 먼저 보여 주고, 실행을 눌러야 그려요"]] as const).map(([k, Icon, l, d]) => (
                  <button key={k} type="button" className={menuItem} onClick={() => { setMode(k); setMenu(null); }}>
                    <Icon size={14} color="#475569" className="shrink-0 self-start mt-0.5" />
                    <span className="flex-1"><span className="block" style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{l}</span><span className="block" style={{ fontSize: 11, color: "#64748b" }}>{d}</span></span>
                    {mode === k && <Check size={14} color={color.brand} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <input ref={fileRef} type="file" multiple accept="image/*,application/pdf,.fig,.figcraft" className="sr-only" tabIndex={-1} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
      </div>

      {projectOpen && (
        <ProjectSheet
          instructions={instructions} setInstructions={setInstructions} files={projectFiles}
          onUpload={() => projFileRef.current?.click()}
          onRemove={(id) => setProjectFiles((l) => l.filter((x) => x.id !== id))}
          onClose={() => setProjectOpen(false)}
        />
      )}
      <input ref={projFileRef} type="file" multiple accept="image/*,application/pdf,.fig,.figcraft" className="sr-only" tabIndex={-1} onChange={(e) => { addProjectFiles(e.target.files); e.target.value = ""; }} />
    </div>
  );
}

/**
 * 대기열 — 작업 중에 보낸 요청이 순서대로 쌓인다(Claude 대기 메시지처럼). 입력창 바로 위에 붙는 카드 한 장.
 * 카드는 좌우로 넘겨 본다: ‹ › 버튼 · 트랙패드/터치 가로 스와이프(scroll-snap) · 키보드 ←/→. "대기 1/3" 표시.
 * 카드마다 [↑ 바로 보내기](지금 작업을 멈추고 이 요청 먼저) · [✕ 빼기]. 고치기는 두지 않는다(빼고 다시 쓰면 된다).
 */
function QueueTray({ items, onRemove, onSendNow, onClear }: {
  items: QueueItem[]; onRemove: (id: number) => void; onSendNow: (id: number) => void; onClear: () => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const at = Math.min(idx, items.length - 1);
  // 항목이 줄면(실행·빼기) 보이는 카드 번호를 맞춘다
  useEffect(() => { if (idx > items.length - 1) setIdx(Math.max(0, items.length - 1)); }, [items.length, idx]);
  const go = (i: number) => {
    const n = Math.max(0, Math.min(items.length - 1, i));
    setIdx(n);
    const el = scroller.current;
    el?.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = scroller.current;
    if (el && el.clientWidth) setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const navBtn = "size-6 shrink-0 flex items-center justify-center rounded-full hover:bg-black/[0.06] disabled:opacity-30 disabled:hover:bg-transparent outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";
  const iconBtn = "size-6 shrink-0 flex items-center justify-center rounded-full hover:bg-black/[0.06] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";
  return (
    <div
      className="mb-2 rounded-xl" style={{ background: "#f8fafc", border: "1px solid #eef0f3" }}
      role="region" aria-roledescription="대기열" aria-label={`대기 중인 요청 ${items.length}개`}
      onKeyDown={(e) => { if (e.key === "ArrowLeft") { e.preventDefault(); go(at - 1); } if (e.key === "ArrowRight") { e.preventDefault(); go(at + 1); } }}
    >
      <div className="flex items-center gap-1" style={{ padding: "6px 6px 0 10px" }}>
        <Clock size={12} color="#64748b" className="shrink-0" />
        <span className="shrink-0 whitespace-nowrap" style={{ fontSize: 11.5, fontWeight: 700, color: "#334155" }} aria-live="polite">대기 {at + 1}/{items.length}</span>
        <span className="truncate" style={{ fontSize: 11, color: "#94a3b8" }}>· 끝나면 차례로 보내요</span>
        <div className="ml-auto flex items-center">
          {items.length > 1 && (
            <>
              <IconTooltip label="이전 대기" side="top"><button type="button" aria-label="이전 대기" disabled={at === 0} onClick={() => go(at - 1)} className={navBtn}><ChevronLeft size={14} color="#475569" /></button></IconTooltip>
              <IconTooltip label="다음 대기" side="top"><button type="button" aria-label="다음 대기" disabled={at === items.length - 1} onClick={() => go(at + 1)} className={navBtn}><ChevronRight size={14} color="#475569" /></button></IconTooltip>
              <button type="button" onClick={onClear} className="shrink-0 rounded px-1.5 h-6 hover:bg-black/[0.05]" style={{ fontSize: 11, color: "#64748b" }}>모두 지우기</button>
            </>
          )}
        </div>
      </div>
      <div ref={scroller} onScroll={onScroll} className="flex overflow-x-auto snap-x snap-mandatory" style={{ scrollbarWidth: "none" }}>
        {items.map((it, i) => (
          <div key={it.id} className="w-full shrink-0 snap-start flex items-start gap-1.5" style={{ padding: "4px 6px 8px 10px" }} aria-hidden={i !== at} aria-label={`${i + 1}번째 대기`}>
            <p className="flex-1 min-w-0 line-clamp-2" style={{ fontSize: 12.5, lineHeight: "18px", color: "#1f2937", wordBreak: "break-word" }} title={it.req.prompt}>
              {it.req.prompt}
              {it.req.attachments.length > 0 && <span style={{ fontSize: 11, color: "#94a3b8" }}> · 첨부 {it.req.attachments.length}</span>}
            </p>
            <IconTooltip label="지금 작업을 멈추고 이 요청 먼저 보내기" side="top"><button type="button" aria-label="바로 보내기" tabIndex={i === at ? 0 : -1} onClick={() => onSendNow(it.id)} className={iconBtn} style={{ background: "#fff", boxShadow: "inset 0 0 0 1px #e5e7eb" }}>
              <ArrowUp size={12} color={color.brand} strokeWidth={2.4} />
            </button></IconTooltip>
            <IconTooltip label="대기에서 빼기" side="top"><button type="button" aria-label="대기에서 빼기" tabIndex={i === at ? 0 : -1} onClick={() => onRemove(it.id)} className={iconBtn}>
              <X size={12} color="#64748b" />
            </button></IconTooltip>
          </div>
        ))}
      </div>
      {items.length > 1 && (
        <div className="flex justify-center gap-1" style={{ paddingBottom: 6 }} aria-hidden>
          {items.map((it, i) => <span key={it.id} className="rounded-full transition-all" style={{ width: i === at ? 12 : 4, height: 4, background: i === at ? color.brand : "#cbd5e1" }} />)}
        </div>
      )}
    </div>
  );
}

function Suggestions({ items, onPick }: { items: string[]; onPick: (s: string) => void }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1.5 mt-4">
      {<p style={{ fontSize: 11, fontWeight: 600, color: "#64748b" }}>이렇게 시켜 보세요</p>}
      {items.map((s) => (
        <button key={s} type="button" onClick={() => onPick(s)} className="self-start text-left rounded-lg px-2.5 py-1.5 hover:bg-[#eef2ff] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 12, color: "#334155", border: "1px solid #e5e7eb", wordBreak: "keep-all" }}>
          {s}
        </button>
      ))}
    </div>
  );
}

function AttachChip({ a, onRemove }: { a: AiAttachment; onRemove?: () => void }) {
  const Icon = a.kind === "image" || a.kind === "selection" ? ImageIcon : FileText;
  return (
    <span className="inline-flex items-center gap-1 rounded-md pl-1 pr-1.5 h-6 max-w-[200px]" style={{ background: "#f3f4f6", fontSize: 11, color: "#334155" }} title={`${a.name} · ${fmtSize(a.size)}`}>
      {a.url ? <img src={a.url} alt="" className="size-4 rounded object-cover shrink-0" /> : <Icon size={12} className="shrink-0" />}
      <span className="truncate">{a.name}</span>
      {onRemove && <button type="button" aria-label={`${a.name} 빼기`} onClick={onRemove} className="shrink-0"><X size={11} /></button>}
    </span>
  );
}

function AiTurn({ m, isLatest, onRunPlan, onCancelPlan, onShow, onUndo }: { m: AiMsg; isLatest: boolean; onRunPlan: () => void; onCancelPlan: () => void; onShow?: (r: AiResult) => void; onUndo?: (r: AiResult) => void }) {
  const [open, setOpen] = useState(false);
  const [undone, setUndone] = useState(false);
  if (m.status === "plan" || m.status === "cancelled") {
    return (
      <div className="rounded-2xl" style={{ border: "1px solid #eef0f3", padding: 14 }}>
        <p className="flex items-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}><ListChecks size={14} />이렇게 진행할게요</p>
        <ol className="mt-2 flex flex-col gap-1 list-decimal pl-5" style={{ fontSize: 12, color: "#374151" }}>{m.plan?.map((s) => <li key={s}>{s}</li>)}</ol>
        {m.status === "plan" ? (
          <div className="flex gap-1.5 mt-3">
            <button type="button" onClick={onRunPlan} className="rounded-lg px-3 h-8" style={{ background: color.brand, color: "#fff", fontSize: 12, fontWeight: 700 }}>실행</button>
            <button type="button" onClick={onCancelPlan} className="rounded-lg px-3 h-8 border border-[#e5e7eb]" style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>취소</button>
          </div>
        ) : <p style={{ fontSize: 11.5, color: "#94a3b8", marginTop: 8 }}>취소했어요</p>}
      </div>
    );
  }
  if (m.status === "working") {
    return (
      <div className="rounded-2xl" style={{ border: "1px solid #eef0f3", boxShadow: "0px 2px 10px rgba(0,0,0,0.05)", padding: 14 }}>
        <div className="flex gap-3">
          <span className="shrink-0 size-11 rounded-xl flex items-center justify-center" style={{ background: color.surface.accent }}><Sparkles size={20} color={color.brand} className="animate-pulse" /></span>
          <div className="min-w-0">
            <p className="flex items-center gap-1" style={{ fontSize: 10.5, color: "#6b7280" }}><Clock size={11} />보통 1~3분</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#111827", lineHeight: "18px", marginTop: 2, wordBreak: "keep-all" }}>딸깍이들이 힘을 합쳐 작업하고 있어요</p>
          </div>
        </div>
        <div className="flex gap-2 rounded-xl mt-3" style={{ background: color.surface.accent, padding: "10px 12px" }}>
          <Bell size={13} color={color.brand} className="shrink-0 mt-0.5" />
          <p style={{ fontSize: 11.5, lineHeight: "18px", color: "#3b5bdb", wordBreak: "keep-all" }}>패널을 접거나 다른 탭으로 가도 계속 작업할게요. 끝나면 이 탭에 표시해 둘게요.</p>
        </div>
        {m.steps.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1.5">
            {m.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: "#374151" }}>
                {i === m.steps.length - 1 ? <Loader2 size={12} className="animate-spin" color={color.brand} /> : <Check size={12} color="#16a34a" />}{s}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  const r = m.result!;
  return (
    <div className="flex flex-col gap-2.5">
      {m.steps.length > 0 && (
        <div>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center gap-1 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] rounded" style={{ fontSize: 11.5, color: "#6b7280" }}>
            {r.addedCount > 0 ? `요소 ${r.addedCount}개 추가, ` : ""}단계 {m.steps.length}개 {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          </button>
          {open && <ul className="flex flex-col gap-1.5 mt-2 pl-1">{m.steps.map((s, i) => <li key={i} className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: "#374151" }}><Check size={12} color="#16a34a" />{s}</li>)}</ul>}
        </div>
      )}
      <p style={{ fontSize: 12.5, lineHeight: "20px", color: "#111827", wordBreak: "keep-all" }}>{r.summary}</p>
      {/* 결과 카드 — 누르면 캔버스에서 선택해 보여 준다(따로 "선택해서 보기" 버튼을 두지 않는다) */}
      {r.target && (
        <button
          type="button" disabled={undone} onClick={() => onShow?.(r)}
          className="self-stretch flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left bg-white hover:bg-[#f8fafc] disabled:opacity-50 disabled:hover:bg-white outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
          style={{ border: "1px solid #e5e7eb" }}
          title={undone ? undefined : "캔버스에서 선택해 보기"}
        >
          <span className="size-8 shrink-0 rounded-lg flex items-center justify-center" style={{ background: color.surface.accent }}><Frame size={15} color={color.brand} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate" style={{ fontSize: 12.5, fontWeight: 700, color: "#111827" }}>{r.target.label}</span>
            <span className="block truncate" style={{ fontSize: 11, color: "#64748b" }}>{undone ? "되돌렸어요" : r.target.meta}</span>
          </span>
          {!undone && <ChevronRight size={14} color="#94a3b8" className="shrink-0" />}
        </button>
      )}
      {/* 바닥 줄 — 쓴 크레딧(조용히) · 최신 결과에만 ↶ 되돌리기. 평가·복사 버튼은 두지 않는다 */}
      {(r.credit > 0 || (isLatest && r.createdRootId && !undone)) && (
        <div className="flex items-center gap-2" style={{ fontSize: 11, color: "#94a3b8" }}>
          {r.credit > 0 && <span>크레딧 {r.credit.toLocaleString()} 사용</span>}
          {isLatest && r.createdRootId && !undone && (
            <button type="button" onClick={() => { onUndo?.(r); setUndone(true); }} title="이 작업으로 만든 화면을 지워요 (⌘Z로 다시 살릴 수 있어요)" className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 h-6 hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 11.5, fontWeight: 600, color: "#475569" }}>
              <Undo2 size={12} />되돌리기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function ProjectSheet({ instructions, setInstructions, files, onUpload, onRemove, onClose }: {
  instructions: string; setInstructions: (v: string) => void; files: (AiAttachment & { at: number })[]; onUpload: () => void; onRemove: (id: string) => void; onClose: () => void;
}) {
  const used = files.reduce((s, x) => s + x.size, 0);
  return (
    <div className="absolute inset-0 z-40 bg-white flex flex-col" role="dialog" aria-label="프로젝트 자료">
      <div className="flex items-center gap-1.5 shrink-0" style={{ height: 44, padding: "0 8px 0 14px", borderBottom: "1px solid #eef0f3" }}>
        <FolderOpen size={15} color="#111827" />
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>프로젝트 자료</span>
        <button type="button" aria-label="닫기" onClick={onClose} className="ml-auto size-7 flex items-center justify-center rounded-md hover:bg-black/[0.05]"><X size={15} color="#475569" /></button>
      </div>
      <div className="flex-1 overflow-y-auto ui-scroll" style={{ padding: 14 }}>
        <p style={{ fontSize: 11.5, lineHeight: "18px", color: "#64748b", wordBreak: "keep-all" }}>여기 넣은 지침과 파일은 이 파일에서 딸깍 AI에게 시킬 때마다 함께 참고해요.</p>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#111827", marginTop: 14 }}>지침</p>
        <textarea
          value={instructions} onChange={(e) => setInstructions(e.target.value)} onKeyDown={(e) => e.stopPropagation()} rows={5}
          placeholder={"예: 브랜드 컬러는 #FF6B00, 모서리는 16px.\n버튼 문구는 해요체로 짧게."}
          className="w-full mt-1.5 rounded-lg outline-none resize-none border border-[#e5e7eb] focus:border-[#4f7bff]"
          style={{ ...f, fontSize: 12, lineHeight: "18px", padding: "8px 10px", color: "#111827" }}
        />
        <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>파일 {files.length}개</p>
          <button type="button" onClick={onUpload} className="inline-flex items-center gap-1 rounded-lg px-2.5 h-7 border border-[#e5e7eb] hover:bg-[#f8fafc]" style={{ fontSize: 11.5, fontWeight: 600, color: "#334155" }}><Upload size={12} />올리기</button>
        </div>
        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: "#f1f5f9" }} aria-label={`용량 ${fmtSize(used)} / 100MB`}>
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, (used / PROJECT_LIMIT) * 100)}%`, background: color.brand }} />
        </div>
        <p style={{ fontSize: 10.5, color: "#94a3b8", marginTop: 4 }}>{fmtSize(used)} / 100MB 사용</p>
        {files.length === 0 ? (
          <p style={{ fontSize: 11.5, lineHeight: "18px", color: "#94a3b8", padding: "16px 0", wordBreak: "keep-all" }}>브랜드 가이드 PDF, 로고, 참고 화면 캡처, 디자인 시스템 .fig 등을 올려 두세요.</p>
        ) : (
          <ul className="mt-2 flex flex-col">
            {files.map((x) => (
              <li key={x.id} className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid #f1f5f9" }}>
                {x.url ? <img src={x.url} alt="" className="size-8 rounded object-cover shrink-0" /> : <span className="size-8 rounded bg-[#f1f5f9] flex items-center justify-center shrink-0"><FileText size={14} color="#64748b" /></span>}
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ fontSize: 12, color: "#111827" }}>{x.name}</p>
                  <p style={{ fontSize: 10.5, color: "#94a3b8" }}>{fmtSize(x.size)} · 방금 올림</p>
                </div>
                <button type="button" aria-label={`${x.name} 지우기`} onClick={() => onRemove(x.id)} className="size-7 flex items-center justify-center rounded hover:bg-black/[0.05]"><Trash2 size={13} color="#64748b" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
