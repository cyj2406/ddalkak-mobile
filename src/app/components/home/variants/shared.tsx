import { useRef, useState, type DragEvent, type ReactNode } from "react";
import { showToast } from "@/app/components/common/Toast";
import { Badge } from "@/app/components/common/Badge";
import type { EditorKind } from "@/app/components/home/EditorQuickLinks";
import { color, f, motion, radius } from "@/app/styleTokens";
import { engineById, engineForFile, FILE_ACCEPT, type EditorEngine, type OutputPreset } from "./editorEngines";

/** 시안 A·B가 App 에서 받는 동작 — 기존 HomeScreen 과 같은 콜백을 그대로 쓴다. */
export interface HomeVariantActions {
  onOpenEditor: (kind: EditorKind) => void;
  onOpenCardNews: () => void;
  onSearch: (query: string) => void;
  onHelp: () => void;
  onViewAllTemplates: () => void;
}

/** 편집기 열기 — 아직 없는 편집기는 "준비 중" 안내만 한다. */
export function useEngineActions(a: HomeVariantActions) {
  const openEngine = (e: EditorEngine) => {
    if (!e.opens) { showToast(`${e.label} 편집기는 준비 중이에요`, "error"); return; }
    a.onOpenEditor(e.opens);
  };
  const openPreset = (p: OutputPreset) => {
    if (p.special === "cardnews") { a.onOpenCardNews(); return; }
    openEngine(engineById(p.engine));
  };
  const openFile = (file: File) => {
    const e = engineForFile(file.name);
    if (!e) { showToast("아직 열 수 없는 파일 형식이에요", "error"); return; }
    showToast(`${file.name} — ${e.label} 편집기로 열어요`);
    openEngine(e);
  };
  return { openEngine, openPreset, openFile };
}

/** 파일 끌어다 놓기 + 파일 선택 — children 은 드롭 영역 안에 그려진다. */
export function FileDropZone({ onFile, children, className, style }: {
  onFile: (file: File) => void;
  children: (pick: () => void, dragging: boolean) => ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const onDrop = (ev: DragEvent) => {
    ev.preventDefault();
    setDragging(false);
    const file = ev.dataTransfer.files?.[0];
    if (file) onFile(file);
  };
  return (
    <div
      className={className}
      style={{ ...style, outline: dragging ? `2px dashed ${color.brand}` : undefined, outlineOffset: 4 }}
      onDragOver={(ev) => { ev.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      {children(() => inputRef.current?.click(), dragging)}
      <input
        ref={inputRef}
        type="file"
        accept={FILE_ACCEPT}
        hidden
        onChange={(ev) => { const file = ev.target.files?.[0]; if (file) onFile(file); ev.target.value = ""; }}
      />
    </div>
  );
}

/** 편집기 카드 — 그림 + 이름 + 한 줄 설명. size="lg"는 시안 A의 새로 만들기, "sm"은 시안 B의 가운데 영역. */
export function EngineCard({ engine, onClick, size = "lg" }: { engine: EditorEngine; onClick: () => void; size?: "lg" | "sm" }) {
  const lg = size === "lg";
  const soon = !engine.opens;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${engine.label} 편집기 ${soon ? "(준비 중)" : "열기"}`}
      className={`group relative flex ${lg ? "flex-row items-center" : "flex-col items-start"} text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] hover:bg-[#f1f5f9]`}
      style={{ padding: lg ? "14px 16px" : 12, gap: lg ? 14 : 8, borderRadius: radius.card, border: `1px solid ${color.border.default}`, background: color.surface.default, transition: `background-color ${motion.fast}`, ...f }}
    >
      {(engine.isNew || soon) && (
        <span className="absolute" style={{ top: 10, right: 10 }}>
          <Badge tone={soon ? "neutral" : "brand"} size="sm">{soon ? "준비 중" : "NEW"}</Badge>
        </span>
      )}
      <img src={engine.art} alt="" aria-hidden style={{ width: lg ? 48 : 36, height: lg ? 48 : 36, objectFit: "contain", opacity: soon ? 0.55 : 1 }} />
      <span className="flex flex-col min-w-0" style={{ gap: 2, paddingRight: lg && (engine.isNew || soon) ? 44 : 0 }}>
        <span style={{ fontWeight: 700, fontSize: lg ? 15 : 14, color: color.text.primary, letterSpacing: "-0.3px" }}>{engine.label}</span>
        <span style={{ fontWeight: 500, fontSize: 12.5, color: color.text.secondary, wordBreak: "keep-all" }}>{engine.hint}</span>
      </span>
    </button>
  );
}

/** "준비 중"·예시 데이터임을 화면에 밝히는 작은 꼬리표 — 시안 검토 때 실제 데이터로 오해하지 않게. */
export function MockTag({ children = "예시 데이터" }: { children?: ReactNode }) {
  return <span style={{ ...f, fontSize: 11, fontWeight: 600, color: color.text.muted, border: `1px dashed ${color.border.default}`, borderRadius: 6, padding: "1px 6px" }}>{children}</span>;
}
