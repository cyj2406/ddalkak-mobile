import { useEffect, useMemo, useRef, useState } from "react";
import { FileUp, LayoutGrid, MessageCircle, Plus, Sparkles, X } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import { AiAssistantPanel, type AiRequest, type AiResult, type BriefConfig } from "@/app/components/editor-shell/AiAssistantPanel";
import { CommentListPanel } from "@/app/components/editor-shell/CommentListPanel";
import { isUnread, type CommentAuthor } from "@/app/components/editor-shell/comments";
import { EditorHeader, type ProfileMenuHandlers, type SaveState, type Viewer } from "@/app/components/editor-shell/EditorHeader";
import { DockButtons, SideDock } from "@/app/components/editor-shell/SideDock";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";
import { creditFor } from "@/app/state/aiModels";
import { setCreditBalance } from "@/app/state/creditBalance";
import { useProfile } from "@/app/state/profile";
import { f } from "@/app/styleTokens";
import artHangul from "@/assets/home/editor/hangul.png";
import artWord from "@/assets/home/editor/word.png";
import artExcel from "@/assets/home/editor/excel.png";
import artPpt from "@/assets/home/editor/ppt.png";
import artPdf from "@/assets/home/editor/pdf.png";
import artVideo from "@/assets/home/editor/video-edit.png";
import artImage from "@/assets/home/editor/image.png";

import { DocCommentLayer, useDocCommentMembers, type DocThread } from "./DocCommentLayer";
import { DOC_TEMPLATES, type DocKind, type DocTemplate } from "./docTemplates";
import { PaperThumb } from "./PaperThumb";
import { TemplatePanel, TemplatePreview } from "./TemplatePanel";

/**
 * 한글·워드·엑셀·PPT·PDF·영상·이미지 편집기 셸(2026-11-19). 기획: docs/doc-editor.md. 셋은 안쪽 오픈소스 에디터만 다르고 바깥은 같다.
 *   상단 바(공통 EditorHeader: 앱 ▾ · 파일 이름 · 저장 상태 · [템플릿] · ✨ 딸깍 AI · 🔔 · 공유 · 프로필)
 *   / [왼쪽 템플릿 패널] [가운데 오픈소스 에디터 자리] [오른쪽 딸깍 AI]
 * 가운데 편집 영역은 오픈소스 에디터라 고칠 수 없다. 이 프로젝트엔 그 에디터가 없어 템플릿·AI 결과만 보이는 목업이다.
 * 코멘트는 UI 디자인 에디터와 같은 방식(헤더 "코멘트"로 남기기 + 코멘트 목록 패널, 쪽 위 핀). 기록·내보내기는 안쪽 에디터에 맡긴다.
 */

/** 문서(한글·워드) "자세히 적어서 요청하기" — 주제 · 꼭 들어갈 내용 · 받는 사람 · 말투 */
const DOC_BRIEF: BriefConfig = {
  submitLabel: "문서 쓰기",
  fields: [
    { id: "topic", label: "무엇을 쓸까요", placeholder: "예: 12월 워크숍 장소 협조 요청 공문", required: true },
    { id: "points", label: "꼭 들어갈 내용", placeholder: "예: 일시 12월 12일, 인원 40명, 회신 기한", multiline: true },
    { id: "to", label: "받는 사람", placeholder: "예: 시설관리팀, 팀장 보고" },
    { id: "tone", label: "말투", placeholder: "", chips: ["공식적인", "공손한", "간결한", "친근한"] },
  ],
  compose: (v) => [`「${v.topic.trim()}」 써 줘.`, v.points?.trim() && `꼭 들어갈 내용: ${v.points.trim()}`, v.to?.trim() && `받는 사람: ${v.to.trim()}`, v.tone && `말투: ${v.tone}`].filter(Boolean).join("\n"),
};
/** 시트(엑셀) — 분위기·로고 대신 표에 필요한 것: 무엇을 정리 · 열 · 기간 · 계산 */
const SHEET_BRIEF: BriefConfig = {
  submitLabel: "표 채우기",
  fields: [
    { id: "topic", label: "무엇을 정리할까요", placeholder: "예: 11월 매장별 매출 정리", required: true },
    { id: "cols", label: "들어갈 항목(열)", placeholder: "예: 매장, 1~4주 매출, 합계" },
    { id: "range", label: "기간·범위", placeholder: "예: 강남·성수·홍대 3개 매장, 11월" },
    { id: "calc", label: "계산", placeholder: "", chips: ["합계", "평균", "전월 대비", "비율"] },
  ],
  compose: (v) => [`「${v.topic.trim()}」 표 만들어 줘.`, v.cols?.trim() && `열: ${v.cols.trim()}`, v.range?.trim() && `기간·범위: ${v.range.trim()}`, v.calc && `계산: ${v.calc}`].filter(Boolean).join("\n"),
};
/** 발표(PPT) — 무엇을 발표 · 꼭 넣을 내용 · 듣는 사람 · 장수 */
const SLIDE_BRIEF: BriefConfig = {
  submitLabel: "슬라이드 만들기",
  fields: [
    { id: "topic", label: "무엇을 발표할까요", placeholder: "예: 가을 신메뉴 출시 안내", required: true },
    { id: "points", label: "꼭 넣을 내용", placeholder: "예: 메뉴 3종, 출시일 10월 1일, 할인 20%", multiline: true },
    { id: "audience", label: "듣는 사람", placeholder: "예: 매장 점주, 투자자" },
    { id: "count", label: "장수", placeholder: "", chips: ["5장", "10장", "15장"] },
  ],
  compose: (v) => [`「${v.topic.trim()}」 발표 자료 만들어 줘.`, v.points?.trim() && `꼭 넣을 내용: ${v.points.trim()}`, v.audience?.trim() && `듣는 사람: ${v.audience.trim()}`, v.count && `장수: ${v.count}`].filter(Boolean).join("\n"),
};
/** PDF — 이미 있는 파일에 시키는 일: 무엇을 · 범위 · 덧붙일 요청 */
const PDF_BRIEF: BriefConfig = {
  submitLabel: "실행하기",
  fields: [
    { id: "task", label: "무엇을 할까요", placeholder: "", required: true, chips: ["요약", "번역", "표를 엑셀로", "개인정보 가리기"] },
    { id: "range", label: "범위", placeholder: "예: 전체, 3~5쪽" },
    { id: "more", label: "덧붙일 요청", placeholder: "예: 세 줄로, 숫자는 그대로", multiline: true },
  ],
  compose: (v) => [`이 PDF ${v.range?.trim() || "전체"}: ${v.task} 해 줘.`, v.more?.trim() && `덧붙일 요청: ${v.more.trim()}`].filter(Boolean).join("\n"),
};
/** 영상 — 분위기·로고 대신 영상에 필요한 것: 무엇 · 길이 · 비율 · 자막 */
const VIDEO_BRIEF: BriefConfig = {
  submitLabel: "영상 만들기",
  fields: [
    { id: "topic", label: "무엇을 만들까요", placeholder: "예: 우리 카페 신메뉴 홍보 숏폼", required: true },
    { id: "length", label: "길이", placeholder: "", chips: ["15초", "30초", "60초"] },
    { id: "ratio", label: "화면 비율", placeholder: "", chips: ["세로 9:16", "가로 16:9", "정사각 1:1"] },
    { id: "caption", label: "꼭 넣을 자막", placeholder: "예: 오늘만 1+1, 매장 위치", multiline: true },
  ],
  compose: (v) => [`「${v.topic.trim()}」 영상 만들어 줘.`, v.length && `길이: ${v.length}`, v.ratio && `비율: ${v.ratio}`, v.caption?.trim() && `꼭 넣을 자막: ${v.caption.trim()}`].filter(Boolean).join("\n"),
};
/** 이미지 — dev 브리프의 분위기는 여기서만 의미가 있다 */
const IMAGE_BRIEF: BriefConfig = {
  submitLabel: "이미지 만들기",
  fields: [
    { id: "topic", label: "무엇을 만들까요", placeholder: "예: 가을 신메뉴 할인 이벤트 이미지", required: true },
    { id: "size", label: "크기", placeholder: "", chips: ["정사각 1080", "세로 1080×1350", "가로 1200×628"] },
    { id: "mood", label: "분위기", placeholder: "", chips: ["깔끔한", "고급스러운", "귀여운", "강렬한"] },
    { id: "copy", label: "꼭 넣을 문구", placeholder: "예: 20% 할인, 10월 31일까지", multiline: true },
  ],
  compose: (v) => [`「${v.topic.trim()}」 이미지 만들어 줘.`, v.size && `크기: ${v.size}`, v.mood && `분위기: ${v.mood}`, v.copy?.trim() && `꼭 넣을 문구: ${v.copy.trim()}`].filter(Boolean).join("\n"),
};

const CONF: Record<DocKind, { appId: string; appName: string; label: string; icon: string; ext: string; untitled: string; place: string; surface: string; suggestions: string[]; example: string; brief: BriefConfig }> = {
  hangul: {
    appId: "hangul", appName: "한글 편집기", label: "한글", icon: artHangul, ext: "hwpx", untitled: "제목 없음", place: "1쪽", surface: "문서",
    suggestions: ["행사 개최 알림 공문 써 줘", "출장 결과 보고서 초안 써 줘", "협조 요청 공문 써 줘"],
    example: "“제목을 '2026 사업계획서'로 넣고 아래에 추진 일정 표를 만들어 줘”", brief: DOC_BRIEF,
  },
  word: {
    appId: "word", appName: "딸깍 문서", label: "워드", icon: artWord, ext: "docx", untitled: "문서", place: "1쪽", surface: "문서",
    suggestions: ["월간 업무 보고서 초안 써 줘", "회의록 정리해 줘", "자기소개서 지원 동기 써 줘"],
    example: "“제목을 '2026 사업계획서'로 넣고 아래에 일정 표를 만들어 줘”", brief: DOC_BRIEF,
  },
  excel: {
    appId: "excel", appName: "딸깍 시트", label: "엑셀", icon: artExcel, ext: "xlsx", untitled: "통합 문서", place: "Sheet1", surface: "시트",
    suggestions: ["11월 매장별 매출 표 만들어 줘", "거래처 견적 표 만들어 줘", "월별 지출 정리 표 만들어 줘"],
    example: "“A열에 매장, B~E열에 주차별 매출을 넣고 마지막 줄에 합계를 만들어 줘”", brief: SHEET_BRIEF,
  },
  ppt: {
    appId: "ppt", appName: "딸깍 슬라이드", label: "PPT", icon: artPpt, ext: "pptx", untitled: "프레젠테이션", place: "1번 슬라이드", surface: "슬라이드",
    suggestions: ["신제품 출시 발표 자료 만들어 줘", "분기 실적 보고 슬라이드 만들어 줘", "회사 소개 5장 만들어 줘"],
    example: "“1장 제목을 '가을 신메뉴 출시'로 바꾸고 아래에 할인 문구를 넣어 줘”", brief: SLIDE_BRIEF,
  },
  pdf: {
    appId: "pdf", appName: "딸깍 PDF", label: "PDF", icon: artPdf, ext: "pdf", untitled: "새 PDF", place: "1쪽", surface: "PDF",
    suggestions: ["이 PDF 세 줄로 요약해 줘", "3쪽 표를 엑셀로 바꿔 줘", "전화번호·주소 가려 줘"],
    example: "“이 PDF를 세 줄로 요약하고 중요한 숫자만 뽑아 줘”", brief: PDF_BRIEF,
  },
  video: {
    appId: "video", appName: "딸깍 영상편집", label: "영상", icon: artVideo, ext: "mp4", untitled: "새 프로젝트", place: "00:00", surface: "영상",
    suggestions: ["신메뉴 홍보 숏폼 만들어 줘", "3초부터 자막 넣어 줘", "배경 음악 잔잔하게 깔아 줘"],
    example: "“3초부터 5초 동안 가운데에 '오늘의 브이로그' 자막을 크게 넣어 줘”", brief: VIDEO_BRIEF,
  },
  image: {
    appId: "image", appName: "이미지 디자인", label: "이미지", icon: artImage, ext: "png", untitled: "이미지 디자인", place: "1페이지", surface: "캔버스",
    suggestions: ["가을 할인 이벤트 이미지 만들어 줘", "유튜브 썸네일 만들어 줘", "카드뉴스 표지 만들어 줘"],
    example: "“가운데에 '가을 신메뉴 출시'를 크게 넣고 아래에 할인 문구를 넣어 줘”", brief: IMAGE_BRIEF,
  },
};
const appName = (kind: DocKind) => CONF[kind].appName;
const STEPS: Record<DocKind, string[]> = {
  hangul: ["요청 읽기", "목차 잡기", "본문 쓰기", "문서에 넣기"],
  word: ["요청 읽기", "목차 잡기", "본문 쓰기", "문서에 넣기"],
  excel: ["요청 읽기", "표 구조 잡기", "값 채우기", "시트에 넣기"],
  ppt: ["요청 읽기", "구성 잡기", "슬라이드 만들기", "발표 자료에 넣기"],
  pdf: ["PDF 읽기", "내용 정리", "결과 만들기"],
  video: ["요청 읽기", "장면 나누기", "자막·음악 넣기", "타임라인에 넣기"],
  image: ["요청 읽기", "구도 잡기", "요소 배치", "캔버스에 넣기"],
};
const AI_SHORTCUT = "⌘J";

interface AiDraft { title: string; sections: { heading: string; body: string }[] }
interface DocFile { id: string; name: string; templateId?: string; ai?: AiDraft; threads?: DocThread[]; updatedAt: number; /** PDF로 연 파일 이름(내용은 메모리의 object URL) */ pdfName?: string }
const isEmpty = (d: DocFile) => !d.templateId && !d.ai && !d.pdfName;
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

export function DocEditor({ kind, onBack, onBellClick, onSwitchApp, profileMenu, onManageModels }: {
  kind: DocKind;
  onBack: () => void;
  onBellClick?: () => void;
  onSwitchApp?: (appId: string) => void;
  profileMenu?: ProfileMenuHandlers;
  /** AI 입력창 모델 메뉴 › AI 연결 관리 */
  onManageModels?: () => void;
}) {
  const conf = CONF[kind];
  const profile = useProfile();
  const me: CommentAuthor = useMemo(() => ({ name: profile.name, avatarUrl: profile.avatarUrl, collabColor: profile.collabColor }), [profile]);
  const members = useDocCommentMembers(me);

  const untitledName = (list: DocFile[]) => {
    const n = list.filter((d) => d.name.startsWith(conf.untitled)).length;
    return kind === "word" || kind === "excel" || kind === "ppt" ? `${conf.untitled}${n + 1}` : n ? `${conf.untitled} ${n + 1}` : conf.untitled;
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
      try { localStorage.setItem(storeKey(kind), JSON.stringify(kind === "pdf" ? [] : docs.filter((d) => !isEmpty(d) || d.threads?.length))); setSaveState({ kind: "saved", at: Date.now() }); }
      catch { setSaveState({ kind: "error" }); }
    }, 400);
    return () => window.clearTimeout(t);
  }, [docs, kind]);

  // 코멘트: 상단 바 오른쪽 💬 하나로(2026-11-19). 누르면 코멘트 목록이 열리면서 바로 남기기 모드 — Figma 코멘트 도구처럼.
  // 예전엔 왼쪽 "코멘트"(남기기)와 오른쪽 💬(목록)가 따로 있었다.
  const [openThreadId, setOpenThreadId] = useState<string | null>(null);
  const [pinsHidden, setPinsHidden] = useState(false);
  const threads = active.threads ?? [];
  const setThreads = (u: React.SetStateAction<DocThread[]>) => setDocs((l) => l.map((d) => (d.id === activeId ? { ...d, threads: typeof u === "function" ? u(d.threads ?? []) : u } : d)));
  const unread = threads.filter((t) => isUnread(t, me)).length;
  // 함께 보는 사람 — 프로토타입: 나 + 이 문서에 코멘트를 단 예시 팀원
  const someoneElse = threads.some((t) => t.messages.some((m) => m.author.name !== me.name));
  const viewers: Viewer[] = [{ ...me, isMe: true, activity: "이 탭" }, ...(someoneElse ? [{ ...threads.flatMap((t) => t.messages).find((m) => m.author.name !== me.name)!.author, activity: "방금 활동" }] : [])];
  useEffect(() => { setOpenThreadId(null); }, [activeId]);

  // 왼쪽 템플릿 패널: 빈 문서일 때 자동으로 열리고, 템플릿·AI로 내용이 생기면 닫힌다
  const [templatesOpen, setTemplatesOpen] = useState(kind !== "pdf");
  // PDF: 연 파일은 이 탭에서만(object URL). 빈 PDF 탭이면 거기에, 아니면 새 탭으로 연다
  const pdfUrls = useRef<Record<string, string>>({});
  const pdfInput = useRef<HTMLInputElement>(null);
  const openPdf = (file: File | undefined) => {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") { showToast("PDF 파일만 열 수 있어요.", "error"); return; }
    const name = file.name.replace(/\.pdf$/i, "");
    const url = URL.createObjectURL(file);
    const target = isEmpty(active) ? activeId : openNew({ name, pdfName: file.name });
    pdfUrls.current[target] = url;
    if (target === activeId) patch(activeId, { name, pdfName: file.name });
  };
  const [preview, setPreview] = useState<DocTemplate | null>(null);
  // 오른쪽 딸깍 AI
  const [dock, setDock] = useState<"ai" | "comments" | null>("ai");
  const commentMode = dock === "comments";
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
      return { summary: kind === "video" ? "어떤 영상을 만들지 조금 더 알려 주세요. 예: “신메뉴 홍보 15초 숏폼 만들어 줘”" : kind === "image" ? "어떤 이미지를 만들지 조금 더 알려 주세요. 예: “가을 할인 이벤트 이미지 만들어 줘”" : kind === "ppt" ? "어떤 발표 자료를 만들지 조금 더 알려 주세요. 예: “신제품 출시 발표 5장 만들어 줘”" : kind === "excel" ? "어떤 표를 만들지 조금 더 알려 주세요. 예: “11월 매장별 매출 표 만들어 줘”" : "어떤 문서를 쓸지 조금 더 알려 주세요. 예: “다음 달 워크숍 안내 공문 써 줘”", credit: 0, stepsDone: 0, stopped: false, addedCount: 0, clarify: true };
    }
    if (kind === "pdf") {
      if (!active.pdfName) {
        await new Promise((r) => setTimeout(r, 400));
        return { summary: "먼저 PDF를 열어 주세요. 가운데 'PDF 파일 열기'나 위의 '열기'를 누르면 돼요.", credit: 0, stepsDone: 0, stopped: false, addedCount: 0, clarify: true };
      }
      for (let i = 0; i < STEPS.pdf.length; i++) {
        if (isCancelled()) return { summary: "멈췄어요.", credit: 0, stepsDone: i, stopped: true, addedCount: 0 };
        onStep(STEPS.pdf[i]);
        await new Promise((r) => setTimeout(r, 450));
      }
      const pdfCredit = creditFor(req.model, 20);
      if (pdfCredit) setCreditBalance((b) => b - pdfCredit);
      return { summary: `「${active.pdfName}」에 요청한 작업 결과가 여기에 나와요. (목업: 실제 서비스에서는 요약·번역·추출 결과를 보여 줘요.)`, credit: pdfCredit, stepsDone: STEPS.pdf.length, stopped: false, addedCount: 0 };
    }
    const docId = activeId;
    const doc = docs.find((d) => d.id === docId)!;
    const tpl = DOC_TEMPLATES.find((x) => x.id === doc.templateId);
    const title = tpl?.title ?? titleFromPrompt(req.prompt);
    // 요청에 "열: 매장, 1주, …"가 있으면 그 열을 그대로 쓴다(자세히 적어서 요청하기의 "들어갈 항목")
    const askedCols = kind === "excel" ? req.prompt.match(/열:\s*(.+)/)?.[1]?.split(/[,，、]/).map((x) => x.trim()).filter(Boolean).slice(0, 12) : undefined;
    // PPT: 요청에 "N장"이 있으면 그 장수만큼(표지 + 내용)
    const askedCount = kind === "ppt" ? Number(req.prompt.match(/(\d+)\s*장/)?.[1] ?? 0) : 0;
    // 장수를 적었으면 그 장수가 이긴다 — 템플릿이 있으면 템플릿 구성을 앞에서부터 쓰고 모자라면 "추가 n"으로 채운다
    const base = tpl?.sections ?? ["표지", "목차", "핵심 내용", "정리"];
    const pptHeads = askedCount > 1 ? Array.from({ length: Math.min(askedCount, 20) }, (_, i) => base[i] ?? `추가 ${i + 1 - base.length}`) : base;
    const heads = askedCols?.length ? askedCols : kind === "ppt" ? pptHeads : tpl?.sections ?? (kind === "excel" ? ["항목", "1월", "2월", "3월", "합계"] : kind === "video" ? ["오프닝", "본문", "마무리"] : kind === "image" ? ["제목", "이미지", "문구"] : ["개요", "주요 내용", "세부 사항", "향후 계획"]);
    const steps = STEPS[kind];
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
    // 모델에 따라: 딸깍 AI 높음 2배 · 낮음 절반, 내 키는 0(docs/ai-models.md "2-2")
    const credit = creditFor(req.model, 30);
    if (credit) setCreditBalance((b) => b - credit);
    return { summary: kind === "video" ? `「${title}」 장면 ${heads.length}개를 타임라인에 넣었어요.` : kind === "image" ? `「${title}」 이미지를 캔버스에 만들었어요.` : kind === "excel" ? `「${title}」 표를 시트에 넣었어요. 열 ${heads.length}개.` : kind === "ppt" ? `「${title}」 슬라이드 ${heads.length}장을 만들었어요.` : `「${title}」 초안을 문서에 넣었어요. 항목 ${heads.length}개를 썼어요.`, credit, stepsDone: steps.length, stopped: false, addedCount: heads.length, target: { id: docId, label: title, meta: `${conf.ext.toUpperCase()} · ${kind === "excel" ? `열 ${heads.length}개` : kind === "ppt" ? `슬라이드 ${heads.length}장` : kind === "video" ? `장면 ${heads.length}개` : kind === "image" ? "1080×1080" : `항목 ${heads.length}개`}` }, createdRootId: resultId };
  };

  // 영상편집은 코멘트 없음(dev: 딸깍 AI · 템플릿 · 기록만, docs/editor-common-header.md "1")
  const hasComments = kind !== "video";
  const dockTabs = [
    { id: "ai", label: "딸깍 AI", hint: `딸깍 AI 열기/닫기 (${AI_SHORTCUT})`, icon: Sparkles, dot: aiDot && dock !== "ai", emphasized: true },
    { id: "comments", label: "코멘트", hint: unread ? `코멘트: 문서를 클릭해 남기기 · 목록 (읽지 않음 ${unread})` : "코멘트: 문서를 클릭해 남기기 · 목록", icon: MessageCircle, badge: unread },
  ];
  const commentsPanel = (
    <CommentListPanel
      threads={threads}
      me={me}
      location={() => conf.place}
      openThreadId={openThreadId}
      hidden={pinsHidden}
      onToggleHidden={() => setPinsHidden((v) => !v)}
      onOpen={(t) => { setPinsHidden(false); setOpenThreadId(t.id); setThreads((all) => all.map((x) => (x.id === t.id ? { ...x, readAt: Date.now(), forcedUnread: false } : x))); }}
      onMarkAllRead={() => setThreads((all) => all.map((t) => ({ ...t, readAt: Date.now(), forcedUnread: false })))}
      emptyHint={`열린 코멘트가 없어요. ${conf.surface}에서 남길 자리를 클릭해 보세요.`}
      onClose={() => setDock(null)}
    />
  );
  const aiPanel = (
    <AiAssistantPanel
      runAi={runAi}
      planAi={(req) => (req.prompt.trim().length < 4 ? [] : STEPS[kind])}
      brief={conf.brief}
      onManageModels={onManageModels}
      context={null}
      suggestions={conf.suggestions}
      example={conf.example}
      commandCount={{ hangul: 15, word: 658, excel: 420, ppt: 383, pdf: 198, video: 16, image: 24 }[kind]}
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
        fileName={kind === "pdf" && !active.pdfName ? undefined : `${active.name}.${conf.ext}`}
        onRenameFile={(name) => patch(activeId, { name: name.replace(new RegExp(`\\.${conf.ext}$`), "") })}
        // 저장 상태는 안쪽 오픈소스 에디터가 보여 준다(워드 "저장되지 않음"·자동 저장) — 헤더에 또 두지 않는다
        // 영상: 공유 없음 → 내보내기가 주요 버튼(헤더 규칙 "4"). 나머지: 공유
        capabilities={kind === "video" ? { export: true } : { share: true, present: kind === "ppt" }}
        onExport={() => showToast("내보내기(MP4)는 안쪽 영상 편집기의 내보내기로 이어져요(목업).")}
        presentLabel="발표 (F5)"
        onPresent={() => showToast("발표를 시작해요. 실제로는 안쪽 에디터의 발표 화면으로 이어져요(목업).")}
        viewers={viewers}
        profileMenu={profileMenu}
        onBack={onBack}
        onBell={onBellClick}
        toolSlot={kind === "pdf" ? (
          <IconTooltip label="다른 PDF 열기"><button
            type="button" onClick={() => pdfInput.current?.click()}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] hover:bg-black/[0.05]"
            style={{ fontSize: 12.5, fontWeight: 600, color: "#475569" }}
          >
            <FileUp size={15} />열기
          </button></IconTooltip>
        ) : (
          <IconTooltip label={templatesOpen ? "템플릿 닫기" : "템플릿 열기"}><button
            type="button" aria-pressed={templatesOpen} onClick={() => setTemplatesOpen((v) => !v)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] hover:bg-black/[0.05]"
            style={{ fontSize: 12.5, fontWeight: 600, color: templatesOpen ? "#111827" : "#475569", background: templatesOpen ? "rgba(0,0,0,0.06)" : undefined }}
          >
            <LayoutGrid size={15} />템플릿
          </button></IconTooltip>
        )}
        actions={<DockButtons tabs={hasComments ? dockTabs : [dockTabs[0]]} active={dock} onChange={(id) => { setDock(id as "ai" | "comments" | null); setAiDot(false); setOpenThreadId(null); if (id === "comments") setPinsHidden(false); }} />}
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
        {kind !== "pdf" && <div className="shrink-0 h-full overflow-hidden" style={{ width: templatesOpen ? 300 : 0, borderRight: templatesOpen ? "1px solid #eef0f3" : undefined, transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
          <TemplatePanel
            kind={kind}
            onPreview={setPreview}
            onBlank={() => { if (isEmpty(active)) { setTemplatesOpen(false); return; } openNew(); }}
            onAskAi={(q) => askAi(q ? `${q} 문서 써 줘` : "")}
            onClose={() => setTemplatesOpen(false)}
          />
        </div>}

        {/* 가운데: 오픈소스 에디터 자리(목업) */}
        <main className="flex-1 min-w-0 flex flex-col bg-[#e9ebef]" aria-label="문서 편집 영역">
          <div className="shrink-0 flex items-center gap-2 bg-white px-4" style={{ height: 64, borderBottom: "1px solid #e2e8f0" }} aria-hidden>
            {Array.from({ length: 14 }, (_, i) => <span key={i} className="rounded" style={{ width: i % 5 === 4 ? 1 : 26, height: i % 5 === 4 ? 28 : 26, background: i % 5 === 4 ? "#e2e8f0" : "#f1f5f9" }} />)}
            <span className="ml-auto" style={{ fontSize: 11.5, color: "#94a3b8" }}>{conf.label} 에디터 도구 모음 · 오픈소스 영역(목업)</span>
          </div>
          <div className="flex-1 overflow-auto ui-scroll py-8 px-6">
            {commentMode && (
              <div className="sticky top-0 z-20 flex justify-center pointer-events-none" style={{ marginTop: -20, marginBottom: 4 }}>
                <span className="rounded-full px-3 py-1.5" style={{ fontSize: 12, fontWeight: 600, color: "#fff", background: "#111827" }}>코멘트 모드: 남길 자리를 클릭하세요 · Esc로 나가기</span>
              </div>
            )}
            {kind === "ppt" ? (
              <SlideMock
                title={active.ai?.title ?? tpl?.title}
                slides={active.ai?.sections.map((x) => x.heading) ?? tpl?.sections}
                cover={!active.ai ? tpl?.cover : undefined}
                tpl={!active.ai ? tpl : undefined}
              >
                <DocCommentLayer
                  key={activeId}
                  threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                  commentMode={commentMode} exitCommentMode={() => setDock(null)}
                  openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden}
                />
              </SlideMock>
            ) : null}
            {kind === "ppt" && <SlideNotes />}
            {kind === "pdf" && (active.pdfName && pdfUrls.current[activeId] ? (
              <div className="relative mx-auto bg-white" style={{ width: "min(100%, 900px)", height: "calc(100vh - 200px)", boxShadow: "0 0 0 1px #e2e8f0" }}>
                <iframe src={pdfUrls.current[activeId]} title={active.pdfName} className="w-full h-full" style={{ border: 0 }} />
                <DocCommentLayer
                  key={activeId}
                  threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                  commentMode={commentMode} exitCommentMode={() => setDock(null)}
                  openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden}
                />
              </div>
            ) : (
              <PdfStart onPick={() => pdfInput.current?.click()} onDrop={openPdf} />
            ))}
            <input ref={pdfInput} type="file" accept="application/pdf,.pdf" className="sr-only" tabIndex={-1} onChange={(e) => { openPdf(e.target.files?.[0]); e.target.value = ""; }} />
            {kind === "video" && (
              <VideoMock title={active.ai?.title ?? tpl?.title} scenes={active.ai?.sections.map((x) => x.heading) ?? tpl?.sections} cover={!active.ai ? tpl?.cover : undefined} />
            )}
            {kind === "image" && (
              <div className="relative mx-auto bg-white" style={{ width: "min(100%, 560px)", aspectRatio: "1 / 1", boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px #e2e8f0" }} aria-label="캔버스">
                {!active.ai && tpl?.cover ? <img src={tpl.cover} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
                  : !active.ai && tpl ? <PaperThumb template={tpl} scale={4.2} />
                  : active.ai ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center" style={{ background: "linear-gradient(135deg, #fde68a 0%, #fca5a5 100%)", padding: "0 10%" }}>
                      <p style={{ fontSize: 34, fontWeight: 900, color: "#111827", lineHeight: 1.2, wordBreak: "keep-all" }}>{active.ai.title}</p>
                      <p style={{ fontSize: 13, color: "#475569", marginTop: 12 }}>목업: 실제 서비스에서는 딸깍 AI가 이미지를 만들어요</p>
                    </div>
                  ) : null}
                <DocCommentLayer
                  key={activeId}
                  threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                  commentMode={commentMode} exitCommentMode={() => setDock(null)}
                  openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden}
                />
              </div>
            )}
            {kind === "ppt" || kind === "pdf" || kind === "video" || kind === "image" ? null : kind === "excel" ? (
              <div className="relative mx-auto bg-white" style={{ width: "min(100%, 980px)", boxShadow: "0 0 0 1px #e2e8f0" }}>
                <SheetMock title={active.ai?.title ?? tpl?.title} cols={active.ai?.sections.map((x) => x.heading) ?? tpl?.sections} />
                <DocCommentLayer
                  key={activeId}
                  threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                  commentMode={commentMode} exitCommentMode={() => setDock(null)}
                  openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden}
                />
              </div>
            ) : (
            <div className="relative mx-auto bg-white" style={{ width: "min(100%, 680px)", minHeight: 880, boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px #e2e8f0", padding: active.ai ? "64px 72px" : tpl ? 0 : "64px 72px" }}>
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
              <DocCommentLayer
                key={activeId}
                threads={threads} setThreads={setThreads} me={me} members={members} anchorLabel={conf.place}
                commentMode={commentMode} exitCommentMode={() => setDock(null)}
                openThreadId={openThreadId} setOpenThreadId={setOpenThreadId} pinsHidden={pinsHidden}
              />
            </div>
            )}
          </div>
        </main>

        <SideDock rail={false} active={dock} onChange={(id) => setDock(id as "ai" | "comments" | null)} tabs={hasComments ? [{ ...dockTabs[0], panel: aiPanel }, { ...dockTabs[1], panel: commentsPanel }] : [{ ...dockTabs[0], panel: aiPanel }]} />
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

/** 엑셀 편집 영역 목업 — 열 머리(A~L) · 행 번호. 템플릿·AI 결과가 있으면 1행 제목, 3행 머리글(열 이름) */
function SheetMock({ title, cols }: { title?: string; cols?: string[] }) {
  const letters = "ABCDEFGHIJKL".split("");
  const cell = { height: 26, borderRight: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", fontSize: 12, padding: "0 6px" } as const;
  return (
    <div style={{ ...f, display: "grid", gridTemplateColumns: `40px repeat(${letters.length}, minmax(72px, 1fr))` }} aria-label="시트">
      <div style={{ ...cell, background: "#f3f4f6" }} />
      {letters.map((l) => <div key={l} className="flex items-center justify-center" style={{ ...cell, background: "#f3f4f6", color: "#64748b", fontSize: 11.5 }}>{l}</div>)}
      {Array.from({ length: 32 }, (_, r) => (
        <div key={r} className="contents">
          <div className="flex items-center justify-center" style={{ ...cell, background: "#f3f4f6", color: "#64748b", fontSize: 11.5 }}>{r + 1}</div>
          {letters.map((l, c) => {
            const head = r === 2 && cols ? cols[c] : undefined;
            const isTitle = r === 0 && c === 0 && title;
            return (
              <div key={l} className="flex items-center overflow-visible whitespace-nowrap" style={{ ...cell, background: head ? "#e7f3ec" : undefined, fontWeight: head || isTitle ? 700 : 400, color: head ? "#166534" : "#111827", fontSize: isTitle ? 14 : 12, outline: r === 0 && c === 0 && !title ? "2px solid #16a34a" : undefined, outlineOffset: -2 }}>
                {isTitle ? title : head ?? ""}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/** PPT 편집 영역 목업 — 왼쪽 슬라이드 목록 + 가운데 16:9 슬라이드(코멘트 레이어는 슬라이드 위) */
function SlideMock({ title, slides, cover, tpl, children }: { title?: string; slides?: string[]; cover?: string; tpl?: DocTemplate; children: React.ReactNode }) {
  const list = slides?.length ? slides : ["표지"];
  return (
    <div className="flex gap-5 mx-auto" style={{ ...f, maxWidth: 1080 }}>
      <ol className="shrink-0 flex flex-col gap-2.5" style={{ width: 132 }} aria-label="슬라이드 목록">
        {list.map((name, i) => (
          <li key={`${name}${i}`} className="flex gap-1.5">
            <span style={{ fontSize: 11, color: "#64748b", width: 14, textAlign: "right" }}>{i + 1}</span>
            <span className="flex-1 flex items-center justify-center bg-white rounded" style={{ aspectRatio: "16 / 9", boxShadow: i === 0 ? "0 0 0 2px #4f7bff" : "0 0 0 1px #e2e8f0", fontSize: 9.5, color: "#475569", padding: 4, textAlign: "center", overflow: "hidden" }}>
              {i === 0 && title ? title : name}
            </span>
          </li>
        ))}
      </ol>
      <div className="relative flex-1 min-w-0 bg-white" style={{ aspectRatio: "16 / 9", boxShadow: "0 1px 3px rgba(15,23,42,0.08), 0 0 0 1px #e2e8f0" }}>
        {cover ? (
          <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        ) : tpl ? (
          <PaperThumb template={tpl} scale={5.4} />
        ) : title ? (
          <div className="absolute inset-0 flex flex-col justify-center" style={{ padding: "0 8%" }}>
            <div style={{ width: 56, height: 6, background: "#4f7bff", borderRadius: 3 }} />
            <h1 style={{ fontSize: 36, fontWeight: 800, color: "#111827", marginTop: 18, letterSpacing: "-0.8px", wordBreak: "keep-all" }}>{title}</h1>
            <p style={{ fontSize: 15, color: "#64748b", marginTop: 10 }}>슬라이드 {list.length}장 · 목업: 실제 서비스에서는 딸깍 AI가 내용을 채워요</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 22, color: "#cbd5e1" }}>제목을 입력하세요</div>
        )}
        {children}
      </div>
    </div>
  );
}

/** 슬라이드 아래 노트(발표자 메모) 자리 — 안쪽 에디터 화면(dev 캡처)을 흉내 낸 목업 */
function SlideNotes() {
  return <div className="mx-auto mt-4 rounded bg-white" style={{ ...f, maxWidth: 1080, padding: "12px 14px", fontSize: 12.5, color: "#94a3b8", boxShadow: "0 0 0 1px #e2e8f0" }}>클릭하여 노트 추가</div>;
}

/** PDF 시작 화면 — 템플릿 대신 "파일 열기"가 첫 행동(끌어다 놓아도 된다) */
function PdfStart({ onPick, onDrop }: { onPick: () => void; onDrop: (f: File | undefined) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className="mx-auto flex flex-col items-center justify-center text-center rounded-2xl"
      style={{ ...f, width: "min(100%, 640px)", minHeight: 360, marginTop: 40, background: over ? "#eef4ff" : "#fff", border: `2px dashed ${over ? "#4f7bff" : "#cbd5e1"}` }}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); onDrop(e.dataTransfer.files?.[0]); }}
    >
      <img src={artPdf} alt="" className="size-16 object-contain" />
      <p style={{ fontSize: 17, fontWeight: 800, color: "#111827", marginTop: 14 }}>고칠 PDF를 열어 주세요</p>
      <p style={{ fontSize: 13, color: "#64748b", marginTop: 6 }}>여기에 끌어다 놓거나 버튼을 눌러 고르세요. 열면 딸깍 AI에게 요약·번역·표 뽑기를 시킬 수 있어요.</p>
      <button type="button" onClick={onPick} className="mt-5 h-10 px-5 rounded-xl flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4f7bff]" style={{ background: "#111827", color: "#fff", fontSize: 13.5, fontWeight: 700 }}>
        <FileUp size={16} />PDF 파일 열기
      </button>
    </div>
  );
}

/** 영상 편집 영역 목업 — 미리보기(9:16 또는 검정 화면) + 아래 타임라인(장면 블록) */
function VideoMock({ title, scenes, cover }: { title?: string; scenes?: string[]; cover?: string }) {
  const list = scenes?.length ? scenes : [];
  return (
    <div className="mx-auto flex flex-col gap-4" style={{ ...f, maxWidth: 1080 }}>
      <div className="mx-auto relative overflow-hidden rounded-lg" style={{ height: 420, aspectRatio: cover || title ? "9 / 16" : "16 / 9", background: "#000" }} aria-label="미리보기">
        {cover ? <img src={cover} alt="" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
          : title ? <div className="absolute inset-0 flex items-center justify-center text-center" style={{ padding: "0 10%" }}><p style={{ fontSize: 22, fontWeight: 900, color: "#fff", wordBreak: "keep-all" }}>{title}</p></div>
          : <div className="absolute inset-0 flex items-center justify-center" style={{ fontSize: 13, color: "#64748b" }}>동영상·사진·오디오를 넣으면 여기에 보여요</div>}
      </div>
      <div className="rounded-lg bg-white" style={{ boxShadow: "0 0 0 1px #e2e8f0", padding: "10px 12px" }} aria-label="타임라인">
        <div className="flex" style={{ fontSize: 10.5, color: "#94a3b8" }}>{["00:00", "00:05", "00:10", "00:15", "00:20"].map((t) => <span key={t} className="flex-1">{t}</span>)}</div>
        <div className="flex gap-1 mt-2" style={{ height: 40 }}>
          {list.length ? list.map((sc, i) => (
            <span key={`${sc}${i}`} className="flex-1 rounded flex items-center justify-center truncate px-1" style={{ background: ["#dbeafe", "#dcfce7", "#fef3c7", "#fce7f3", "#ede9fe"][i % 5], fontSize: 11, fontWeight: 600, color: "#334155" }}>{sc}</span>
          )) : <span className="flex-1 rounded flex items-center justify-center" style={{ border: "1.5px dashed #cbd5e1", fontSize: 11.5, color: "#94a3b8" }}>타임라인이 비어 있어요</span>}
        </div>
      </div>
    </div>
  );
}
