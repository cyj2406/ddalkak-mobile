import { useEffect, useState, type ReactNode } from "react";
import { AlignCenter, AlignLeft, AlignRight, ChevronDown, Minus, Plus } from "lucide-react";

import { f } from "@/app/styleTokens";

import type { DNode, Page } from "./model";
import { IconTooltip } from "@/app/components/viewer/IconTooltip";

/**
 * 오른쪽 속성 패널 — 선택 없음 = 페이지 배경 + 안내, 선택 있음 = 위치·레이아웃·모양·(타이포)·채우기·선.
 * 2026-11-19: 맨 위 내 아바타·▷ 줄(상단 바와 겹침)과 동작 없는 섹션(sRGB·로컬 변수/스타일·내보내기·효과)을 뺐다.
 */

const LABEL = { ...f, fontSize: 11, fontWeight: 600, color: "#111827" } as const;
const SUB = { ...f, fontSize: 10.5, color: "#6b7280" } as const;
const FIELD = "flex items-center gap-1.5 rounded-md px-2 h-7 bg-[#f5f5f5] border border-transparent focus-within:border-[#14b86e] focus-within:bg-white";

function Section({ title, action, children }: { title: string; action?: ReactNode; children?: ReactNode }) {
  return (
    <div style={{ padding: "12px 12px", borderBottom: "1px solid #eef0f3" }}>
      <div className="flex items-center justify-between" style={{ marginBottom: children ? 8 : 0 }}>
        <span style={LABEL}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function NumField({ label, value, onCommit, suffix, min }: { label: ReactNode; value: number; onCommit: (v: number) => void; suffix?: string; min?: number }) {
  const [text, setText] = useState(String(Math.round(value * 100) / 100));
  useEffect(() => setText(String(Math.round(value * 100) / 100)), [value]);
  const commit = () => {
    const v = Number(text);
    if (Number.isFinite(v)) onCommit(min != null ? Math.max(min, v) : v);
    else setText(String(value));
  };
  return (
    <label className={FIELD}>
      <span style={{ ...SUB, minWidth: 10 }}>{label}</span>
      <input
        value={text}
        inputMode="decimal"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
        className="w-full min-w-0 bg-transparent outline-none"
        style={{ ...f, fontSize: 11, color: "#111827" }}
      />
      {suffix && <span style={SUB}>{suffix}</span>}
    </label>
  );
}

function ColorField({ value, onCommit, onRemove }: { value: string; onCommit: (v: string) => void; onRemove?: () => void }) {
  const hex = value.replace("#", "").toUpperCase();
  const [text, setText] = useState(hex);
  useEffect(() => setText(hex), [hex]);
  const commit = () => {
    const t = text.replace("#", "").trim();
    if (/^[0-9a-f]{6}$/i.test(t)) onCommit(`#${t.toUpperCase()}`); else setText(hex);
  };
  return (
    <div className="flex items-center gap-1.5">
      <label className={`${FIELD} flex-1`}>
        <span className="relative shrink-0 size-4 rounded-[3px] overflow-hidden" style={{ background: value, boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.1)" }}>
          <input type="color" aria-label="색 고르기" value={/^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff"} onChange={(e) => onCommit(e.target.value.toUpperCase())} className="absolute inset-0 opacity-0 cursor-pointer" />
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
          className="w-full min-w-0 bg-transparent outline-none"
          style={{ ...f, fontSize: 11, color: "#111827" }}
          aria-label="색상 코드"
        />
        <span style={SUB}>100%</span>
      </label>
      {onRemove && (
        <IconTooltip label="삭제"><button type="button" aria-label="삭제" onClick={onRemove} className="size-6 flex items-center justify-center rounded hover:bg-black/[0.05]">
          <Minus size={13} color="#6b7280" />
        </button></IconTooltip>
      )}
    </div>
  );
}

const addBtn = (label: string, onClick: () => void) => (
  <IconTooltip label={label}><button type="button" aria-label={label} onClick={onClick} className="size-6 flex items-center justify-center rounded hover:bg-black/[0.05] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
    <Plus size={13} color="#6b7280" />
  </button></IconTooltip>
);

const TYPE_LABEL: Record<DNode["type"], string> = { frame: "프레임", rect: "사각형", ellipse: "타원", text: "텍스트" };
const ALIGN_LABEL = { left: "왼쪽", center: "가운데", right: "오른쪽" } as const;
const WEIGHTS = [[400, "Regular"], [500, "Medium"], [600, "SemiBold"], [700, "Bold"], [800, "ExtraBold"]] as const;

export function Inspector({ page, node, zoom, onZoom, onNode, onPageBg }: {
  page: Page;
  node: DNode | null;
  zoom: number;
  onZoom: (action: "in" | "out" | "100" | "fit") => void;
  onNode: (patch: Partial<DNode>) => void;
  onPageBg: (hex: string) => void;
}) {
  const [tab, setTab] = useState<"design" | "prototype">("design");
  const [zoomMenu, setZoomMenu] = useState(false);

  return (
    <aside className="shrink-0 flex flex-col bg-white overflow-hidden" style={{ ...f, width: 188, borderLeft: "1px solid #eef0f3" }} aria-label="속성">
      <div className="relative flex items-center gap-1 shrink-0" style={{ height: 44, padding: "0 8px", borderBottom: "1px solid #eef0f3" }}>
        {([["design", "디자인"], ["prototype", "프로토타입"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className="rounded px-1.5 h-6" style={{ fontSize: 11, fontWeight: 600, color: tab === k ? "#111827" : "#6b7280", background: tab === k ? "#f3f4f6" : "transparent" }}>{l}</button>
        ))}
        <button type="button" onClick={() => setZoomMenu((v) => !v)} aria-expanded={zoomMenu} className="ml-auto flex items-center gap-0.5 rounded px-1 h-6 hover:bg-black/[0.05]" style={{ fontSize: 11, color: "#111827" }}>
          {Math.round(zoom * 100)}% <ChevronDown size={11} color="#9ca3af" />
        </button>
        {zoomMenu && (
          <div className="absolute right-2 top-8 bg-white rounded-lg py-1 z-20" style={{ width: 150, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }}>
            {([["in", "확대", "⌘ +"], ["out", "축소", "⌘ −"], ["fit", "화면에 맞추기", "⇧ 1"], ["100", "100%로 보기", "⌘ 0"]] as const).map(([a, l, k]) => (
              <button key={a} type="button" onClick={() => { onZoom(a); setZoomMenu(false); }} className="w-full flex justify-between px-3 py-1.5 hover:bg-[#f8fafc]" style={{ fontSize: 11.5, color: "#111827" }}>
                <span>{l}</span><span style={{ color: "#9ca3af" }}>{k}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto ui-scroll">
        {tab === "prototype" ? (
          <p style={{ ...SUB, fontSize: 11.5, lineHeight: "18px", padding: 16, wordBreak: "keep-all" }}>프레임끼리 연결해 화면 전환을 만드는 프로토타입 기능은 준비 중이에요.</p>
        ) : !node ? (
          <>
            <Section title="페이지 배경"><ColorField value={page.bg} onCommit={onPageBg} /></Section>
            {/* 동작하지 않는 섹션(색상 프로필·로컬 변수/스타일·내보내기)은 두지 않는다 — 2026-11-19 겹침·자잘한 정리 */}
            <p style={{ ...SUB, fontSize: 11, lineHeight: "17px", padding: "12px 12px", wordBreak: "keep-all" }}>캔버스나 레이어에서 요소를 선택하면 위치·크기·색을 바꿀 수 있어요.</p>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between" style={{ padding: "12px 12px 0" }}>
              <span style={{ ...LABEL, fontSize: 12 }}>{TYPE_LABEL[node.type]}</span>
            </div>
            <Section title="위치">
              <div className="grid grid-cols-2 gap-1.5">
                <NumField label="X" value={node.x} onCommit={(v) => onNode({ x: v })} />
                <NumField label="Y" value={node.y} onCommit={(v) => onNode({ y: v })} />
              </div>
            </Section>
            <Section title="레이아웃">
              <div className="grid grid-cols-2 gap-1.5">
                <NumField label="W" value={node.w} min={1} onCommit={(v) => onNode({ w: v, autoW: false })} />
                <NumField label="H" value={node.h} min={1} onCommit={(v) => onNode({ h: v })} />
              </div>
            </Section>
            <Section title="모양">
              <div className="grid grid-cols-2 gap-1.5">
                <NumField label="◐" value={Math.round(node.opacity * 100)} suffix="%" min={0} onCommit={(v) => onNode({ opacity: Math.min(100, v) / 100 })} />
                {node.type !== "text" && <NumField label="⌜" value={node.radius >= 9999 ? 0 : node.radius} min={0} onCommit={(v) => onNode({ radius: v })} />}
              </div>
            </Section>
            {node.type === "text" && (
              <Section title="타이포그래피">
                <div className="flex flex-col gap-1.5">
                  <div className="rounded-md px-2 h-7 flex items-center bg-[#f5f5f5]" style={{ fontSize: 11, color: "#111827" }}>Pretendard</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <select
                      value={node.fontWeight}
                      onChange={(e) => onNode({ fontWeight: Number(e.target.value) })}
                      className="rounded-md px-1.5 h-7 bg-[#f5f5f5] outline-none"
                      style={{ ...f, fontSize: 11, color: "#111827" }}
                      aria-label="굵기"
                    >
                      {WEIGHTS.map(([w, l]) => <option key={w} value={w}>{l}</option>)}
                    </select>
                    <NumField label="" value={node.fontSize ?? 16} min={1} onCommit={(v) => onNode({ fontSize: v })} />
                  </div>
                  <div className="flex gap-1">
                    {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(([a, Icon]) => (
                      <IconTooltip key={a} label={`${ALIGN_LABEL[a]} 정렬`}><button type="button" aria-label={`${ALIGN_LABEL[a]} 정렬`} aria-pressed={node.align === a} onClick={() => onNode({ align: a })} className="size-7 flex items-center justify-center rounded" style={{ background: node.align === a ? "#f3f4f6" : "transparent" }}>
                        <Icon size={13} color={node.align === a ? "#111827" : "#9ca3af"} />
                      </button></IconTooltip>
                    ))}
                  </div>
                </div>
              </Section>
            )}
            <Section title="채우기">
              {node.type === "text"
                ? <ColorField value={node.color ?? "#000000"} onCommit={(v) => onNode({ color: v })} />
                : <ColorField value={node.fill === "transparent" ? "#FFFFFF" : node.fill} onCommit={(v) => onNode({ fill: v })} />}
            </Section>
            <Section title="선" action={!node.stroke ? addBtn("선 추가", () => onNode({ stroke: "#000000" })) : undefined}>
              {node.stroke ? <ColorField value={node.stroke} onCommit={(v) => onNode({ stroke: v })} onRemove={() => onNode({ stroke: undefined })} /> : null}
            </Section>
          </>
        )}
      </div>
    </aside>
  );
}
