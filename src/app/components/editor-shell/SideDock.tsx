import type { ComponentType, ReactNode } from "react";
import { ChevronsRight } from "lucide-react";

import { color, f } from "@/app/styleTokens";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/**
 * 오른쪽 도크(에디터 공통, 2026-11-13 v2) — 맨 오른쪽 세로 탭 줄(항상 보임) + 그 왼쪽 패널(300px).
 * 탭을 누르면 열고, 같은 탭을 다시 누르거나 패널 머리의 »(PanelCloseButton)를 누르면 접는다. 패널은 접거나 다른 탭으로 바꿔도 언마운트하지 않는다
 * (AI 작업·대화·입력 중인 글이 그대로 남는다). Google Workspace·Canva 오른쪽 사이드 패널과 같은 구조.
 */
export interface DockTab {
  id: string;
  label: string;
  /** 툴팁 — 단축키 안내 등. 없으면 label */
  hint?: string;
  icon: ComponentType<{ size?: number; color?: string }>;
  /** 숫자 배지(읽지 않음 등) */
  badge?: number;
  /** 배지 대신 점 — "끝났어요" 같은 알림 */
  dot?: boolean;
  disabled?: boolean;
  /** 아이콘 옆에 이름을 함께 보여 주는 강조 버튼(딸깍 AI처럼 핵심 기능, 2026-11-19) */
  emphasized?: boolean;
  panel: ReactNode;
}

/**
 * rail=false 면 오른쪽 세로 탭 줄을 그리지 않는다 — 토글은 상단 바의 DockButtons 로 옮긴다(2026-11-19 가로 단계 줄이기).
 */
export function SideDock({ tabs, active, onChange, width = 300, rail = true }: { tabs: DockTab[]; active: string | null; onChange: (id: string | null) => void; width?: number; rail?: boolean }) {
  return (
    <>
      <div className="shrink-0 h-full bg-white overflow-hidden" style={{ width: active ? width : 0, borderLeft: active ? "1px solid #eef0f3" : undefined, transition: "width 200ms cubic-bezier(0.4, 0, 0.2, 1)" }}>
        {tabs.map((t) => (
          <div key={t.id} className="h-full" style={{ width, display: active === t.id ? "block" : "none" }} role="tabpanel" aria-label={t.label}>
            {t.panel}
          </div>
        ))}
      </div>
      {rail && <nav className="shrink-0 w-12 h-full flex flex-col items-center gap-1 py-2 bg-white" style={{ ...f, borderLeft: "1px solid #eef0f3" }} aria-label="도구 패널" role="tablist" aria-orientation="vertical">
        {tabs.map((t) => {
          const on = active === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id} type="button" role="tab" aria-selected={on} disabled={t.disabled}
              aria-label={t.badge ? `${t.label} (읽지 않음 ${t.badge})` : t.label}
              title={t.hint ?? (on ? `${t.label} 닫기` : `${t.label} 열기`)}
              onClick={() => onChange(on ? null : t.id)}
              className="relative flex flex-col items-center gap-0.5 w-11 py-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-35"
            >
              <span className="size-8 rounded-lg flex items-center justify-center" style={{ background: on ? color.surface.accent : "transparent" }}>
                <Icon size={16} color={on ? color.brand : "#475569"} />
              </span>
              <span style={{ fontSize: 9.5, color: on ? "#111827" : "#64748b", fontWeight: on ? 600 : 400 }}>{t.label}</span>
              {!!t.badge && (
                <span className="absolute top-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full flex items-center justify-center" style={{ background: color.brand, color: "#fff", fontSize: 9.5, fontWeight: 700 }}>{t.badge > 99 ? "99+" : t.badge}</span>
              )}
              {!t.badge && t.dot && <span className="absolute top-1.5 right-2 size-2 rounded-full" style={{ background: color.brand }} />}
            </button>
          );
        })}
      </nav>}
    </>
  );
}

/** 패널 머리 왼쪽 끝 접기 버튼(»). 모든 도크 패널이 같은 자리에 둔다 — Claude in Chrome·Figma 오른쪽 패널과 같은 위치 */
export function PanelCloseButton({ onClick, shortcut }: { onClick: () => void; shortcut?: string }) {
  return (
    <IconTooltip label={shortcut ? `패널 닫기 (${shortcut})` : "패널 닫기"}><button
      type="button"
      aria-label="패널 닫기"
     
      onClick={onClick}
      className="size-7 shrink-0 flex items-center justify-center rounded-md hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
    >
      <ChevronsRight size={15} color="#475569" />
    </button></IconTooltip>
  );
}

/**
 * 상단 바용 도크 토글(아이콘만) — ✨ AI · 💬 코멘트(읽지 않음 배지) · 🕘 기록. 누르면 그 패널을 열고, 열린 걸 다시 누르면 닫는다.
 * Google Docs의 "코멘트 기록" 아이콘, Claude in Chrome 툴바 버튼과 같은 역할.
 */
export function DockButtons({ tabs, active, onChange }: { tabs: Omit<DockTab, "panel">[]; active: string | null; onChange: (id: string | null) => void }) {
  return (
    <div className="flex items-center gap-0.5" role="toolbar" aria-label="패널 열기">
      {tabs.map((t) => {
        const on = active === t.id;
        const Icon = t.icon;
        if (t.emphasized) {
          // 핵심 기능은 아이콘만 두지 않고 이름까지(Canva "Canva AI"·Notion "Notion AI" 버튼처럼). 닫혀 있어도 브랜드 색으로 보인다
          return (
            <IconTooltip key={t.id} label={t.hint ?? (on ? `${t.label} 닫기` : `${t.label} 열기`)}><button
              type="button" aria-pressed={on} disabled={t.disabled} aria-label={t.label}
              onClick={() => onChange(on ? null : t.id)}
              className="relative h-8 pl-2.5 pr-3 mr-1 flex items-center gap-1.5 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-35 hover:brightness-[0.97]"
              style={{ ...f, background: color.surface.accent, color: color.brand, fontSize: 12.5, fontWeight: 700, letterSpacing: "-0.2px", boxShadow: on ? `inset 0 0 0 1.5px ${color.brand}` : undefined }}
            >
              <Icon size={15} color={color.brand} />
              {t.label}
              {t.dot && !on && <span className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full" style={{ background: color.brand, boxShadow: "0 0 0 2px #f8fafc" }} />}
            </button></IconTooltip>
          );
        }
        return (
          <IconTooltip key={t.id} label={t.hint ?? (on ? `${t.label} 닫기` : `${t.label} 열기`)}><button
            type="button" aria-pressed={on} disabled={t.disabled}
            aria-label={t.badge ? `${t.label} (읽지 않음 ${t.badge})` : t.label}
           
            onClick={() => onChange(on ? null : t.id)}
            className={`relative size-8 flex items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-35 ${on ? "" : "hover:bg-black/[0.05]"}`}
            style={{ background: on ? color.surface.accent : undefined }}
          >
            <Icon size={16} color={on ? color.brand : "#475569"} />
            {!!t.badge && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full flex items-center justify-center" style={{ ...f, background: color.brand, color: "#fff", fontSize: 9.5, fontWeight: 700, boxShadow: "0 0 0 2px #f8fafc" }}>{t.badge > 99 ? "99+" : t.badge}</span>}
            {!t.badge && t.dot && <span className="absolute top-1 right-1 size-2 rounded-full" style={{ background: color.brand, boxShadow: "0 0 0 2px #f8fafc" }} />}
          </button></IconTooltip>
        );
      })}
    </div>
  );
}
