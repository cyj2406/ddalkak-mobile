import { useMemo, useState } from "react";
import { ArrowUp, FolderOpen, Paperclip, Sparkles } from "lucide-react";
import { color, f, radius } from "@/app/styleTokens";
import { CAROUSEL_COVERS } from "@/app/data/tasks";
import { ENGINES, PRESETS, type EngineGroup } from "./editorEngines";
import { EngineCard, FileDropZone, MockTag, useEngineActions, type HomeVariantActions } from "./shared";

/**
 * 시안 B — 에디터 우선형 홈.
 * 홈 자체를 에디터와 같은 3단 셸로 만든다: 왼쪽 템플릿 패널 / 가운데 새로 만들기(=빈 캔버스 자리) / 오른쪽 딸깍 AI.
 * 홈에서 이미 "왼쪽에서 고르고, 오른쪽에 시킨다"는 에디터 사용법을 익히게 하는 게 목적.
 * 1024px 미만에서는 AI → 새로 만들기 → 템플릿 순으로 세로로 쌓는다.
 * 기획: docs/home-editor-redesign.md "5. 시안 B".
 */

const TEMPLATE_TABS: ("전체" | EngineGroup)[] = ["전체", "문서", "디자인", "영상"];
/** 캐러셀 표지 분류(cat) → 엔진 그룹 */
const CAT_TO_GROUP: Record<string, EngineGroup> = { 문서: "문서", 발표자료: "문서", 이미지: "디자인", 영상: "영상" };

const AI_SUGGESTIONS = [
  "카페 신메뉴 인스타 카드뉴스 4장 만들어 줘",
  "첨부한 보고서를 10장짜리 발표자료로 바꿔 줘",
  "이 사진 배경 지우고 상세페이지 첫 화면 만들어 줘",
];

export default function HomeEditorFirst(props: HomeVariantActions) {
  const { openEngine, openPreset, openFile } = useEngineActions(props);
  const [tab, setTab] = useState<(typeof TEMPLATE_TABS)[number]>("전체");
  const [prompt, setPrompt] = useState("");
  const templates = useMemo(() => CAROUSEL_COVERS.filter((c) => tab === "전체" || CAT_TO_GROUP[c.cat] === tab), [tab]);
  const send = (text = prompt) => { if (text.trim()) props.onSearch(text.trim()); };

  const panelTitle = (t: string) => <h2 style={{ fontWeight: 700, fontSize: 15, color: color.text.primary, letterSpacing: "-0.3px" }}>{t}</h2>;

  return (
    <main className="flex-1 min-h-0 overflow-y-auto lg:overflow-hidden" style={{ ...f, background: color.surface.subtle }}>
      <div className="flex flex-col lg:grid lg:h-full" style={{ gridTemplateColumns: "280px minmax(0,1fr) 340px" }}>
        {/* 왼쪽 — 템플릿 패널 (모바일에서는 맨 아래) */}
        <aside aria-label="템플릿" className="order-3 lg:order-1 flex flex-col lg:min-h-0 bg-white lg:border-r" style={{ borderColor: color.border.default }}>
          <div className="flex flex-col" style={{ padding: "20px 16px 12px", gap: 12 }}>
            {panelTitle("템플릿")}
            <div className="flex gap-1" role="tablist" aria-label="템플릿 분류">
              {TEMPLATE_TABS.map((t) => (
                <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className="rounded-full px-3 h-8 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 13, fontWeight: 600, background: tab === t ? "#0f172a" : color.surface.hover, color: tab === t ? "#fff" : "#475569" }}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="lg:flex-1 lg:min-h-0 max-h-[560px] lg:max-h-none overflow-y-auto grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 content-start" style={{ padding: "0 16px 16px", gap: 10, scrollbarWidth: "thin" }}>
            {templates.map((c) => (
              <button key={c.title} type="button" onClick={() => c.taskId === "cardnews" ? props.onOpenCardNews() : props.onViewAllTemplates()} className="flex flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] rounded-xl group" style={{ gap: 4 }}>
                <span className="w-full overflow-hidden" style={{ aspectRatio: "3 / 4", borderRadius: 10, border: `1px solid ${color.border.default}`, background: color.surface.subtle }}>
                  <img src={c.cover} alt="" className="w-full h-full object-cover object-top transition-transform group-hover:scale-[1.04]" />
                </span>
                <span className="truncate" style={{ fontSize: 12, fontWeight: 600, color: "#334155" }}>{c.title}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={props.onViewAllTemplates} className="mx-4 mb-4 h-10 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] hover:bg-[#f1f5f9]" style={{ border: `1px solid ${color.border.default}`, fontSize: 13, fontWeight: 600, color: "#334155" }}>
            템플릿 전체 보기
          </button>
        </aside>

        {/* 가운데 — 새로 만들기 (빈 캔버스 자리) */}
        <section aria-labelledby="ef-new" className="order-2 lg:min-h-0 lg:overflow-y-auto" style={{ padding: "32px var(--gap-screen-x) 48px" }}>
          <div className="mx-auto flex flex-col" style={{ maxWidth: 760, gap: 28 }}>
            <div className="flex flex-col" style={{ gap: 6 }}>
              <h1 id="ef-new" style={{ fontWeight: 700, fontSize: 24, letterSpacing: "-0.6px", color: color.text.primary }}>새 작업 만들기</h1>
              <p style={{ fontSize: 14, color: color.text.secondary, wordBreak: "keep-all" }}>편집기를 고르거나, 왼쪽에서 템플릿을 고르거나, 오른쪽 AI에게 맡기세요.</p>
            </div>

            <FileDropZone onFile={openFile} style={{ borderRadius: radius.card }}>
              {(pick, dragging) => (
                <button type="button" onClick={pick} className="w-full flex items-center justify-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ height: 88, borderRadius: radius.card, border: `1.5px dashed ${dragging ? color.brand : "#cbd5e1"}`, background: dragging ? color.surface.accent : color.surface.default, fontSize: 14, fontWeight: 600, color: dragging ? color.brand : color.text.secondary }}>
                  <FolderOpen size={18} aria-hidden /> {dragging ? "놓으면 알맞은 편집기로 열어요" : "파일을 끌어다 놓거나 눌러서 열기"}
                </button>
              )}
            </FileDropZone>

            {(["문서", "디자인", "영상"] as EngineGroup[]).map((g) => (
              <div key={g} className="flex flex-col" style={{ gap: 10 }}>
                <h3 style={{ fontSize: 13, fontWeight: 700, color: color.text.muted }}>{g}</h3>
                <div className="grid grid-cols-2 sm:grid-cols-3" style={{ gap: 10 }}>
                  {ENGINES.filter((e) => e.group === g).map((e) => <EngineCard key={e.id} engine={e} size="sm" onClick={() => openEngine(e)} />)}
                </div>
              </div>
            ))}

            <div className="flex flex-col" style={{ gap: 10 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: color.text.muted }}>크기로 시작하기</h3>
              <div className="flex flex-wrap" style={{ gap: 8 }}>
                {PRESETS.map((p) => (
                  <button key={p.label} type="button" onClick={() => openPreset(p)} className="flex items-baseline gap-1.5 rounded-lg px-3 h-9 bg-white hover:bg-[#f1f5f9] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: `1px solid ${color.border.default}`, fontSize: 13, fontWeight: 600, color: "#334155" }}>
                    {p.label} <span style={{ fontSize: 11.5, fontWeight: 500, color: color.text.muted }}>{p.size}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 오른쪽 — 딸깍 AI (모바일에서는 맨 위) */}
        <aside aria-label="딸깍 AI" className="order-1 lg:order-3 flex flex-col lg:min-h-0 bg-white lg:border-l" style={{ borderColor: color.border.default }}>
          <div className="flex items-center justify-between" style={{ padding: "20px 16px 12px" }}>
            <span className="flex items-center gap-1.5">{<Sparkles size={16} color={color.brand} aria-hidden />}{panelTitle("딸깍 AI")}</span>
            <MockTag>시안</MockTag>
          </div>
          <div className="hidden lg:flex flex-1 min-h-0 overflow-y-auto flex-col" style={{ padding: "0 16px", gap: 8 }}>
            <p style={{ fontSize: 13.5, lineHeight: "20px", color: "#475569", wordBreak: "keep-all" }}>
              하고 싶은 작업을 말로 적어 주세요. 알맞은 편집기를 열고 초안까지 만들어 둘게요. 만든 뒤에도 이 자리에서 계속 고칠 수 있어요.
            </p>
            {AI_SUGGESTIONS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="text-left rounded-xl px-3 py-2.5 hover:bg-[#f1f5f9] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: `1px solid ${color.border.default}`, fontSize: 13, color: "#334155", wordBreak: "keep-all" }}>
                {s}
              </button>
            ))}
          </div>
          <div style={{ padding: 16 }}>
            <div className="flex flex-col" style={{ border: `1px solid ${color.border.default}`, borderRadius: radius.card, padding: 12, gap: 8 }}>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}
                rows={3}
                aria-label="AI에게 맡길 작업"
                placeholder="무엇을 할까요?"
                className="w-full resize-none bg-transparent outline-none"
                style={{ fontSize: 14, lineHeight: "21px", color: color.text.primary }}
              />
              <div className="flex items-center justify-between">
                <button type="button" onClick={props.onHelp} className="flex items-center gap-1 rounded-lg px-2 h-8 hover:bg-[#f1f5f9] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 12.5, fontWeight: 600, color: color.text.secondary }}>
                  <Paperclip size={14} aria-hidden /> 요청 작성 도우미
                </button>
                <button type="button" onClick={() => send()} disabled={!prompt.trim()} aria-label="보내기" className="flex items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4f7bff] disabled:opacity-40" style={{ width: 34, height: 34, background: color.brand, color: "#fff" }}>
                  <ArrowUp size={18} aria-hidden />
                </button>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
