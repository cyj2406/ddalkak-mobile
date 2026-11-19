import { f } from "@/app/styleTokens";

import type { DocTemplate } from "./docTemplates";

/**
 * 종이 미리보기(A4 비율). 실제 서식 이미지(cover)가 있으면 그것을, 없으면 layout 모양을 그린다.
 * 예전 템플릿 패널은 실제 스캔을 작게 줄여 글자가 안 보였다(docs/doc-editor.md "1"). 그래서 **제목은 진짜 글자로 크게** 박고,
 * 나머지는 서식 모양(결재란·표·문단)만 보여 준다. scale로 크기를 정한다(1 = 썸네일, 2.4 = 미리보기 창).
 */
const BAR = "#e5e7eb";
const LINE = "#cbd5e1";

export function PaperThumb({ template, scale = 1, className }: { template: Pick<DocTemplate, "title" | "layout" | "cover" | "sections">; scale?: number; className?: string }) {
  const s = (n: number) => n * scale;
  if (template.cover) {
    return (
      <div className={`relative w-full overflow-hidden bg-white ${className ?? ""}`} style={{ aspectRatio: "1 / 1.414" }}>
        <img src={template.cover} alt="" className="absolute inset-0 w-full h-full object-cover object-top" draggable={false} />
      </div>
    );
  }
  const bars = (n: number, widths = [100, 92, 96, 70]) =>
    Array.from({ length: n }, (_, i) => <div key={i} style={{ height: s(2.4), width: `${widths[i % widths.length]}%`, background: BAR, borderRadius: 2, marginTop: s(3.2) }} />);
  return (
    <div className={`relative w-full overflow-hidden bg-white ${className ?? ""}`} style={{ aspectRatio: "1 / 1.414", padding: `${s(12)}px ${s(11)}px` }}>
      {template.layout === "form" && (
        <div className="absolute flex" style={{ top: s(8), right: s(8), border: `${Math.max(0.6, s(0.6))}px solid ${LINE}` }}>
          {[0, 1, 2].map((i) => <div key={i} style={{ width: s(9), height: s(11), borderLeft: i ? `${Math.max(0.6, s(0.6))}px solid ${LINE}` : undefined }} />)}
        </div>
      )}
      <p
        className="text-center"
        style={{ ...f, fontWeight: 800, fontSize: s(8.5), lineHeight: 1.25, color: "#111827", letterSpacing: template.title.length <= 6 ? s(1.6) : "-0.2px", marginTop: template.layout === "form" ? s(14) : s(4), wordBreak: "keep-all" }}
      >
        {template.title}
      </p>
      <div style={{ height: s(1), background: "#111827", margin: `${s(6)}px 0 ${s(4)}px` }} />
      {template.layout === "letter" && (
        <>
          {["수신", "제목"].map((k) => <div key={k} className="flex items-center" style={{ gap: s(4), marginTop: s(3) }}><span style={{ ...f, fontSize: s(4.2), color: "#64748b" }}>{k}</span><div style={{ flex: 1, height: s(2.2), background: BAR, borderRadius: 2 }} /></div>)}
          <div style={{ marginTop: s(5) }}>{bars(9)}</div>
        </>
      )}
      {template.layout === "form" && (
        <div style={{ border: `${Math.max(0.6, s(0.6))}px solid ${LINE}`, marginTop: s(2) }}>
          {template.sections.slice(0, 5).map((sec, i) => (
            <div key={sec} className="flex" style={{ borderTop: i ? `${Math.max(0.6, s(0.6))}px solid ${LINE}` : undefined, minHeight: s(i === 2 ? 26 : 12) }}>
              <span className="shrink-0 flex items-center" style={{ ...f, width: "30%", fontSize: s(3.8), color: "#475569", padding: `0 ${s(2.5)}px`, background: "#f8fafc", borderRight: `${Math.max(0.6, s(0.6))}px solid ${LINE}`, lineHeight: 1.2, overflow: "hidden" }}>{sec}</span>
            </div>
          ))}
        </div>
      )}
      {template.layout === "table" && (
        <div style={{ border: `${Math.max(0.6, s(0.6))}px solid ${LINE}`, marginTop: s(2) }}>
          {Array.from({ length: 11 }, (_, r) => (
            <div key={r} className="flex" style={{ height: s(8), borderTop: r ? `${Math.max(0.6, s(0.6))}px solid ${LINE}` : undefined, background: r === 0 ? "#f1f5f9" : undefined }}>
              {[22, 18, 22, 22, 16].map((w, c) => <div key={c} style={{ width: `${w}%`, borderLeft: c ? `${Math.max(0.6, s(0.6))}px solid ${LINE}` : undefined }} />)}
            </div>
          ))}
        </div>
      )}
      {template.layout === "report" && template.sections.slice(0, 4).map((sec, i) => (
        <div key={sec} style={{ marginTop: s(i ? 6 : 2) }}>
          <p className="truncate" style={{ ...f, fontSize: s(4.6), fontWeight: 700, color: "#334155" }}>{i + 1}. {sec}</p>
          {bars(3)}
        </div>
      ))}
    </div>
  );
}
