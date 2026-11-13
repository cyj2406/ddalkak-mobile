import { useState } from "react";
import { Layers, X } from "lucide-react";
import { color, f, radius, shadow } from "@/app/styleTokens";
import { HOME_VARIANTS, isVariantSwitcherVisible, useHomeVariant } from "./homeVariants";

/**
 * 시안 비교용 플로팅 스위처 — 서비스 UI가 아니라 검토용 도구라 화면 왼쪽 아래 구석에 작게 둔다.
 * 접으면 아이콘 하나만 남는다. `?switcher=0` 이면 아예 렌더하지 않는다.
 */
export function HomeVariantSwitcher() {
  const [variant, setVariant] = useHomeVariant();
  const [open, setOpen] = useState(true);
  if (!isVariantSwitcherVisible()) return null;

  const active = HOME_VARIANTS.find((v) => v.id === variant)!;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`홈 시안 전환 열기 (현재: ${active.label})`}
        className="fixed z-[60] flex items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
        style={{ left: 16, bottom: 16, height: 36, padding: "0 12px", borderRadius: 999, background: "#0f172a", color: "#fff", boxShadow: shadow.popover,...f, fontSize: 13, fontWeight: 600 }}
      >
        <Layers size={14} aria-hidden /> {active.label}
      </button>
    );
  }

  return (
    <div
      role="group"
      aria-label="홈 시안 전환"
      className="fixed z-[60] flex flex-col"
      style={{ left: 16, bottom: 16, width: 280, padding: 12, gap: 8, borderRadius: radius.card, background: "#0f172a", color: "#fff", boxShadow: shadow.popover,...f }}
    >
      <div className="flex items-center justify-between">
        <span style={{ fontSize: 12, fontWeight: 600, color: "#94a3b8" }}>홈 시안 (검토용)</span>
        <button type="button" onClick={() => setOpen(false)} aria-label="접기" className="rounded p-1 hover:bg-white/10 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]">
          <X size={14} aria-hidden />
        </button>
      </div>
      <div className="flex gap-1" role="radiogroup" aria-label="시안">
        {HOME_VARIANTS.map((v) => {
          const on = v.id === variant;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setVariant(v.id)}
              className="flex-1 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
              style={{ height: 32, borderRadius: 8, fontSize: 12.5, fontWeight: 600, background: on ? color.brand : "rgba(255,255,255,.08)", color: on ? "#fff" : "#cbd5e1", whiteSpace: "nowrap" }}
            >
              {v.label}
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: 12, lineHeight: "17px", color: "#94a3b8", wordBreak: "keep-all" }}>{active.desc}</p>
    </div>
  );
}

export default HomeVariantSwitcher;
