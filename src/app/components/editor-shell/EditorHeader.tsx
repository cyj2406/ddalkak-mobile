import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, Cloud, Download, Loader2, Play, Plus } from "lucide-react";

import { ProfileMenuButton } from "@/app/components/account/ProfileMenuButton";
import { color, f } from "@/app/styleTokens";

import { DDALKKAK_APPS } from "./apps";
import type { CommentAuthor } from "./comments";
import { SharePopover } from "./SharePopover";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/** 지금 파일을 보고 있는 사람 — activity: "이 탭" · "2분 전 활동" 같은 상태 문구 */
export interface Viewer extends CommentAuthor { isMe?: boolean; activity: string }

/** 도구가 지원하는 것 — 지원하지 않는 버튼은 아예 그리지 않는다(docs/editor-common-header.md "4") */
export interface HeaderCapabilities {
  /** ▷ 미리보기/프레젠테이션/재생 — 문구는 presentLabel */
  present?: boolean;
  /** 내보내기 버튼. 공유가 없으면 이게 주요(채운) 버튼이 된다 */
  export?: boolean;
  /** 공유(공동 작업). 있으면 항상 주요 버튼 */
  share?: boolean;
}

export type SaveState = { kind: "saved"; at: number } | { kind: "saving" } | { kind: "local" } | { kind: "error" };

const savedLabel = (at: number) => {
  const s = Math.floor((Date.now() - at) / 1000);
  return s < 10 ? "방금" : s < 60 ? `${s}초 전` : s < 3600 ? `${Math.floor(s / 60)}분 전` : `${Math.floor(s / 3600)}시간 전`;
};

/**
 * 딸깍 도구 공통 상단 바(2026-11-19 v3) — 기획: docs/editor-common-header.md.
 *   ① 정체성  : ‹ 나가기 · [아이콘] 앱 이름 ▾(다른 도구로 이동 · 새로 만들기) / 파일 이름(더블클릭 이름 바꾸기) · 저장 상태
 *   ② 도구 슬롯: 그 도구에만 있는 핵심 행동 1~2개(toolSlot)
 *   ③ 패널 토글: ✨ AI · 💬 코멘트 · 🕘 기록 아이콘(actions — DockButtons). 오른쪽 패널을 여는 버튼은 오른쪽에
 *   ④ 🔔 알림
 *   ⑤ 결과물  : ▷ · [내보내기] · [공유 •N] — 오른쪽 끝 채운 버튼은 "다음 단계" 하나(공유가 없으면 내보내기)
 * 내 프로필은 오른쪽 끝에 하나만. 메뉴는 서비스 상단바와 같은 컴포넌트(account/ProfileMenuButton). 함께 보는 사람은 공유 팝오버에서(버튼에 인원 표시 없음).
 */
export type ProfileMenuHandlers = Parameters<typeof ProfileMenuButton>[0];

export function EditorHeader({
  appIcon, appName, currentAppId, onSwitchApp, onNewFile, fileName, onRenameFile, location, saveState,
  capabilities = { share: true, present: true }, presentLabel = "프레젠테이션", onPresent, onExport,
  toolSlot, actions, viewers, onBack, onBell, accent = color.brand, profileMenu,
}: {
  appIcon: string;
  appName: string;
  /** 앱 전환 메뉴에서 지금 도구 표시 */
  currentAppId?: string;
  onSwitchApp?: (id: string) => void;
  /** 앱 이름 ▾ 메뉴의 "새 파일" */
  onNewFile?: () => void;
  /** 없으면(홈 탭) 앱 이름만 보이고 결과물 버튼을 숨긴다 */
  fileName?: string;
  onRenameFile?: (name: string) => void;
  location?: string;
  saveState?: SaveState;
  capabilities?: HeaderCapabilities;
  presentLabel?: string;
  onPresent?: () => void;
  onExport?: () => void;
  toolSlot?: ReactNode;
  actions?: ReactNode;
  /** 지금 이 파일을 보고 있는 사람(나 포함) — 공유 팝오버에 보이고, 나 말고 있으면 버튼에 인원 */
  viewers: Viewer[];
  onBack: () => void;
  onBell?: () => void;
  /** 주요 버튼 색 — 도구 강조색 */
  accent?: string;
  /** 오른쪽 끝 내 프로필 메뉴: 서비스 상단바와 같은 ProfileMenuButton(2026-11-19) */
  profileMenu?: ProfileMenuHandlers;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [appMenu, setAppMenu] = useState(false);
  const [, tick] = useState(0);
  // "n분 전" 갱신
  useEffect(() => { const t = window.setInterval(() => tick((n) => n + 1), 30000); return () => window.clearInterval(t); }, []);
  const exportPrimary = !!capabilities.export && !capabilities.share;
  const iconBtn = "size-8 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]";

  return (
    <header className="h-12 shrink-0 flex items-center gap-1 pl-2 pr-3" style={f}>
      {/* ① 정체성 */}
      <IconTooltip label="딸깍 홈으로 나가기"><button type="button" aria-label="딸깍 홈으로 나가기" onClick={onBack} className="size-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
        <ChevronLeft size={18} color="#111827" />
      </button></IconTooltip>
      <div className="relative">
        <button
          type="button" aria-haspopup="menu" aria-expanded={appMenu} onClick={() => setAppMenu((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg pl-1.5 pr-1 h-8 hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
          style={{ background: appMenu ? "rgba(0,0,0,0.05)" : undefined }}
        >
          <img src={appIcon} alt="" className="size-5 object-contain" />
          <span style={{ fontSize: 13, fontWeight: fileName ? 600 : 700, color: fileName ? "#475569" : "#111827" }}>{appName}</span>
          <ChevronDown size={13} color="#94a3b8" />
        </button>
        {appMenu && <AppSwitcher current={currentAppId} onClose={() => setAppMenu(false)} onSwitch={onSwitchApp} onNewFile={onNewFile} />}
      </div>
      {fileName && (
        <span className="flex items-center gap-1.5 min-w-0">
          <span aria-hidden style={{ color: "#cbd5e1" }}>/</span>
          <EditableTitle value={fileName} onChange={onRenameFile} />
          {(saveState || location) && <SaveBadge state={saveState} location={location} />}
        </span>
      )}

      {/* ② 도구 슬롯 */}
      {fileName && toolSlot && <div className="ml-4 flex items-center gap-1.5">{toolSlot}</div>}

      <div className="ml-auto flex items-center gap-1.5">
        {/* ③ 패널 토글 */}
        {actions}
        {actions && <span aria-hidden className="w-px h-5 mx-1" style={{ background: "#e2e8f0" }} />}
        {/* ④ 알림 */}
        {onBell && (
          <IconTooltip label="알림"><button type="button" aria-label="알림" onClick={onBell} className="relative size-8 flex items-center justify-center rounded-full hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4b5563" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
            <span aria-hidden className="absolute top-[6px] right-[7px] size-2 rounded-full bg-[#2b7fff] ring-2 ring-[#f8fafc]" />
          </button></IconTooltip>
        )}
        {/* ⑤ 결과물 */}
        {fileName && capabilities.present && onPresent && (
          <IconTooltip label={presentLabel}><button type="button" aria-label={presentLabel} onClick={onPresent} className={iconBtn}>
            <Play size={15} color="#111827" />
          </button></IconTooltip>
        )}
        {fileName && capabilities.export && onExport && (
          <button
            type="button" onClick={onExport}
            className="h-8 px-3 rounded-lg flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]"
            style={exportPrimary ? { background: accent, color: "#fff", fontSize: 12.5, fontWeight: 700 } : { background: "#fff", color: "#111827", fontSize: 12.5, fontWeight: 600, boxShadow: "inset 0 0 0 1px #e2e8f0" }}
          >
            <Download size={14} />내보내기
          </button>
        )}
        {fileName && capabilities.share && (
          <div className="relative">
            <button
              type="button"
              aria-expanded={shareOpen}
              onClick={() => setShareOpen((v) => !v)}
              className="h-8 px-3.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[#4f7bff]"
              style={{ background: accent, color: "#fff", fontSize: 12.5, fontWeight: 700 }}
            >
              공유
            </button>
            {shareOpen && <SharePopover fileName={fileName} accent={accent} viewers={viewers} onClose={() => setShareOpen(false)} />}
          </div>
        )}
        {profileMenu && <div className="ml-1"><ProfileMenuButton {...profileMenu} /></div>}
      </div>
    </header>
  );
}

/**
 * 저장 상태(자동 저장). 2026-11-19 간소화: 평소(저장됨)엔 구름 아이콘만 두고 위치·시각은 툴팁으로.
 * 글자는 저장 중·저장 못 함처럼 알아야 할 때만 보인다(Google Docs·Canva 방식). 예전엔 "임시 보관함 · 저장됨 · 39초 전"이 늘 붙어 있었다.
 */
function SaveBadge({ state, location }: { state?: SaveState; location?: string }) {
  if (state?.kind === "saving") {
    return <span className="shrink-0 inline-flex items-center gap-1 ml-1" style={{ fontSize: 11.5, color: "#94a3b8" }} aria-live="polite"><Loader2 size={12} className="animate-spin" />저장 중…</span>;
  }
  if (state?.kind === "error") {
    return <span className="shrink-0 inline-flex items-center gap-1 ml-1" style={{ fontSize: 11.5, color: "#b45309" }} aria-live="polite"><Cloud size={12} />저장 못 함: 이 브라우저 저장 공간 부족</span>;
  }
  const where = location ? `${location}에 ` : "";
  const label = !state ? (location ?? "") : state.kind === "saved" ? `${where}저장됨 · ${savedLabel(state.at)}` : `${where}이 브라우저에 저장`;
  return (
    <IconTooltip label={label}>
      <span className="shrink-0 inline-flex items-center justify-center size-6 rounded-md ml-0.5" tabIndex={0} aria-label={label} style={{ color: "#94a3b8" }}>
        <Cloud size={14} />
      </span>
    </IconTooltip>
  );
}

/** 앱 이름 ▾ — 다른 딸깍 도구로 바로 이동(서비스 사이드바 대신) + 새 파일 */
function AppSwitcher({ current, onClose, onSwitch, onNewFile }: { current?: string; onClose: () => void; onSwitch?: (id: string) => void; onNewFile?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);
  const item = "w-full flex items-center gap-2 px-3 py-1.5 text-left rounded-lg hover:bg-[#f3f4f6] outline-none focus-visible:bg-[#f3f4f6]";
  return (
    <div ref={ref} className="absolute left-0 top-10 z-50 bg-white rounded-xl p-1.5 w-[280px] max-h-[70vh] overflow-y-auto ui-scroll" style={{ ...f, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="menu" aria-label="딸깍 도구">
      {onNewFile && (
        <>
          <button type="button" role="menuitem" className={item} onClick={() => { onClose(); onNewFile(); }}>
            <span className="size-6 rounded-md flex items-center justify-center" style={{ background: "#f1f5f9" }}><Plus size={13} color="#334155" /></span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>새 파일</span>
          </button>
          <div className="h-px my-1" style={{ background: "#f1f5f9" }} />
        </>
      )}
      {DDALKKAK_APPS.map((g) => (
        <div key={g.label} className="py-0.5">
          <p style={{ fontSize: 10.5, fontWeight: 700, color: "#94a3b8", padding: "6px 12px 2px" }}>{g.label}</p>
          {g.apps.map((a) => (
            <button key={a.id} type="button" role="menuitem" aria-current={a.id === current ? "true" : undefined} className={item} onClick={() => { onClose(); if (a.id !== current) onSwitch?.(a.id); }}>
              <span className="min-w-0 flex-1">
                <span className="block truncate" style={{ fontSize: 12.5, fontWeight: a.id === current ? 700 : 500, color: "#111827" }}>{a.name}</span>
                <span className="block truncate" style={{ fontSize: 11, color: "#94a3b8" }}>{a.desc}</span>
              </span>
              {a.id === current && <Check size={14} color={color.brand} />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function EditableTitle({ value, onChange }: { value: string; onChange?: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  const style = { ...f, fontSize: 13, fontWeight: 700, color: "#111827" } as const;
  if (!editing || !onChange) {
    return (
      <button type="button" title={onChange ? "더블클릭해서 이름 바꾸기" : undefined} onDoubleClick={() => { setText(value); setEditing(true); }} className="truncate max-w-[240px] text-left rounded px-1 -mx-1 hover:bg-black/[0.04]" style={style}>
        {value}
      </button>
    );
  }
  const done = () => { onChange(text.trim() || value); setEditing(false); };
  return (
    <input
      autoFocus value={text} onChange={(e) => setText(e.target.value)} onBlur={done}
      onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") done(); if (e.key === "Escape") setEditing(false); }}
      className="outline-none rounded px-1 -mx-1 w-[200px]" style={{ ...style, boxShadow: "inset 0 0 0 1px #4f7bff" }}
    />
  );
}
