import { useState } from "react";
import { ArrowRight, Paperclip, Sparkles, Upload } from "lucide-react";
import { color, f, radius, shadow } from "@/app/styleTokens";
import { HomeSectionHeader } from "@/app/components/home/HomeSectionHeader";
import { CAROUSEL_COVERS } from "@/app/data/tasks";
import { ENGINES, PRESETS } from "./editorEngines";
import { EngineCard, FileDropZone, MockTag, useEngineActions, type HomeVariantActions } from "./shared";

/**
 * 시안 A — 런처형 홈.
 * 홈의 역할을 "에디터로 빨리 보내기"로 좁힌다. 순서:
 *   1) 프롬프트 + 파일 끌어다 놓기(한 덩어리) + 결과물 프리셋 칩
 *   2) 새로 만들기 — 편집기(엔진) 9개를 카드로 크게
 *   3) 최근 작업 — 재방문 사용자의 "이어서 하기"
 *   4) 템플릿 — 한 줄만, 본격 탐색은 에디터 왼쪽 패널과 "전체 보기"
 * 기획: docs/home-editor-redesign.md "4. 시안 A".
 */

/** 최근 작업 — 실제 데이터가 없어 캐러셀 표지로 예시를 만든다. */
const RECENT = [
  { cover: CAROUSEL_COVERS[2].cover, title: "2027 사업 제안 발표자료", meta: "슬라이드 · 2시간 전 수정", engine: "slide" as const },
  { cover: CAROUSEL_COVERS[1].cover, title: "11월 트렌드 카드뉴스", meta: "디자인 · 어제", engine: "design" as const },
  { cover: CAROUSEL_COVERS[10].cover, title: "주간 업무 보고서", meta: "문서 · 3일 전", engine: "doc" as const },
  { cover: CAROUSEL_COVERS[3].cover, title: "겨울 니트 상세페이지", meta: "디자인 · 지난주", engine: "design" as const },
];

export default function HomeLauncher(props: HomeVariantActions) {
  const { openEngine, openPreset, openFile } = useEngineActions(props);
  const [query, setQuery] = useState("");
  const submit = () => { if (query.trim()) props.onSearch(query.trim()); };

  return (
    <main className="flex-1 overflow-y-auto pb-16" style={{ scrollbarWidth: "none", paddingLeft: "var(--gap-screen-x)", paddingRight: "var(--gap-screen-x)", ...f }}>
      <div className="mx-auto flex flex-col" style={{ maxWidth: "var(--home-container)", paddingTop: 48, gap: 56 }}>
        {/* 1. 히어로 — 적거나, 파일을 놓거나 */}
        <section aria-label="시작하기" className="flex flex-col items-center" style={{ gap: 20 }}>
          <h1 className="text-center" style={{ fontWeight: 700, fontSize: "var(--hero-title-size)", letterSpacing: "var(--hero-title-tracking)", color: color.text.primary, wordBreak: "keep-all" }}>
            무엇을 <span style={{ color: color.brand }}>만들거나 열어</span> 볼까요?
          </h1>
          <FileDropZone onFile={openFile} className="w-full" style={{ maxWidth: 760, borderRadius: 20 }}>
            {(pick, dragging) => (
              <div className="flex flex-col" style={{ borderRadius: 20, border: `1px solid ${dragging ? color.brand : color.border.default}`, background: dragging ? color.surface.accent : color.surface.default, boxShadow: shadow.cardEmphasis, padding: 16, gap: 12 }}>
                <textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); } }}
                  rows={2}
                  aria-label="만들 작업 입력"
                  placeholder={dragging ? "여기에 놓으면 알맞은 편집기로 열어요" : "만들 것을 적어 주세요. 예: 카페 신메뉴 인스타 카드뉴스 4장"}
                  className="w-full resize-none bg-transparent outline-none"
                  style={{ fontSize: 16, lineHeight: "24px", color: color.text.primary }}
                />
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={pick} className="flex items-center gap-1.5 rounded-lg px-2.5 h-9 hover:bg-[#f1f5f9] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 13, fontWeight: 600, color: color.text.secondary }}>
                      <Paperclip size={16} aria-hidden /> 파일 열기
                    </button>
                    <button type="button" onClick={props.onHelp} className="flex items-center gap-1.5 rounded-lg px-2.5 h-9 hover:bg-[#f1f5f9] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 13, fontWeight: 600, color: color.text.secondary }}>
                      <Sparkles size={16} aria-hidden /> 요청 작성 도우미
                    </button>
                  </div>
                  <button type="button" onClick={submit} disabled={!query.trim()} className="flex items-center gap-1 rounded-xl px-4 h-10 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4f7bff] disabled:opacity-40" style={{ background: color.brand, color: "#fff", fontSize: 14, fontWeight: 700 }}>
                    AI로 만들기 <ArrowRight size={16} aria-hidden />
                  </button>
                </div>
              </div>
            )}
          </FileDropZone>
          <div className="flex flex-wrap justify-center" style={{ gap: 8, maxWidth: 760 }}>
            {PRESETS.map((p) => (
              <button key={p.label} type="button" onClick={() => openPreset(p)} className="rounded-full px-3.5 h-9 hover:bg-[#f1f5f9] outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ border: `1px solid ${color.border.default}`, fontSize: 13.5, fontWeight: 600, color: "#334155", background: color.surface.default }}>
                {p.label}
              </button>
            ))}
          </div>
          <p className="flex items-center gap-1.5" style={{ fontSize: 12.5, color: color.text.muted }}>
            <Upload size={13} aria-hidden /> HWP·DOCX·PDF·XLSX·PPTX·이미지·영상 파일을 끌어다 놓으면 맞는 편집기로 바로 열려요
          </p>
        </section>

        {/* 2. 새로 만들기 — 편집기 */}
        <section aria-labelledby="launcher-new">
          <HomeSectionHeader id="launcher-new" title="새로 만들기" subtitle="빈 화면에서 시작해요. 템플릿과 AI는 편집기 안에서 언제든 불러올 수 있어요" />
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3" style={{ gap: 12 }}>
            {ENGINES.map((e) => <EngineCard key={e.id} engine={e} onClick={() => openEngine(e)} />)}
          </div>
        </section>

        {/* 3. 최근 작업 */}
        <section aria-labelledby="launcher-recent">
          <HomeSectionHeader id="launcher-recent" title="최근 작업" subtitle="하던 작업을 이어서 해요" action={<MockTag />} />
          <div className="grid grid-cols-2 wide:grid-cols-4" style={{ gap: 16 }}>
            {RECENT.map((r) => (
              <button key={r.title} type="button" onClick={() => openEngine(ENGINES.find((e) => e.id === r.engine)!)} className="flex flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] rounded-2xl group" style={{ gap: 8 }}>
                <span className="w-full overflow-hidden" style={{ aspectRatio: "4 / 3", borderRadius: radius.card, background: color.surface.subtle, border: `1px solid ${color.border.default}` }}>
                  <img src={r.cover} alt="" className="w-full h-full object-cover object-top transition-transform group-hover:scale-[1.03]" />
                </span>
                <span style={{ fontWeight: 600, fontSize: 14, color: color.text.primary }}>{r.title}</span>
                <span style={{ fontSize: 12.5, color: color.text.secondary, marginTop: -6 }}>{r.meta}</span>
              </button>
            ))}
          </div>
        </section>

        {/* 4. 템플릿 — 한 줄 */}
        <section aria-labelledby="launcher-templates">
          <HomeSectionHeader
            id="launcher-templates"
            title="템플릿으로 시작하기"
            subtitle="편집기 왼쪽 패널에서도 같은 템플릿을 고를 수 있어요"
            action={<button type="button" onClick={props.onViewAllTemplates} className="shrink-0 rounded outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff]" style={{ fontSize: 14, fontWeight: 600, color: color.text.secondary }}>전체 보기 ›</button>}
          />
          <div className="flex overflow-x-auto" style={{ gap: 12, scrollbarWidth: "none" }}>
            {CAROUSEL_COVERS.slice(0, 10).map((c) => (
              <button key={c.title} type="button" onClick={() => c.taskId === "cardnews" ? props.onOpenCardNews() : props.onViewAllTemplates()} className="shrink-0 flex flex-col text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4f7bff] rounded-xl" style={{ gap: 6 }}>
                <img src={c.cover} alt="" style={{ height: 180, width: Math.round(180 * c.ratio), objectFit: "cover", borderRadius: 12, border: `1px solid ${color.border.default}` }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#334155", maxWidth: Math.round(180 * c.ratio) }} className="truncate">{c.title}</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
