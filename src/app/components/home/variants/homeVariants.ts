import { useCallback, useEffect, useState } from "react";

/**
 * 홈 시안 전환 — 기존 홈(current)은 그대로 두고, 새 시안을 같은 앱 안에서 바꿔 가며 본다.
 *
 * 고르는 순서: URL `?home=a` → 이 브라우저에 마지막으로 고른 값(localStorage) → "current".
 * 링크를 공유할 때는 URL 파라미터를 붙이면 받는 사람도 같은 시안을 본다.
 *
 * 새 시안 추가 방법: 아래 HOME_VARIANTS 에 한 줄 추가 → variants/ 에 컴포넌트를 만들고
 * App.tsx 의 `screen === "home"` 분기에 연결한다. 자세한 건 docs/home-editor-redesign.md.
 */
export const HOME_VARIANTS = [
  { id: "current", label: "현재", desc: "지금 배포된 홈 (템플릿·작업 중심)" },
  { id: "a", label: "A 런처형", desc: "프롬프트·파일 열기 → 새로 만들기(편집기) → 최근 작업 → 템플릿 한 줄" },
  { id: "b", label: "B 에디터 우선형", desc: "홈이 곧 3단 작업 화면(왼쪽 템플릿, 가운데 새로 만들기, 오른쪽 AI)" },
] as const;

export type HomeVariantId = (typeof HOME_VARIANTS)[number]["id"];

const STORAGE_KEY = "home-variant";
const PARAM = "home";

function isVariant(v: string | null): v is HomeVariantId {
  return !!v && HOME_VARIANTS.some((x) => x.id === v);
}

function readInitial(): HomeVariantId {
  if (typeof window === "undefined") return "current";
  const fromUrl = new URLSearchParams(window.location.search).get(PARAM);
  if (isVariant(fromUrl)) return fromUrl;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (isVariant(saved)) return saved;
  } catch { /* 저장소 차단 — 기본값 사용 */ }
  return "current";
}

/** 시안 전환 스위처가 보이는지 — `?switcher=0` 이면 숨긴다(발표·캡처용). */
export function isVariantSwitcherVisible(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("switcher") !== "0";
}

const listeners = new Set<(v: HomeVariantId) => void>();
let current: HomeVariantId = readInitial();

export function useHomeVariant(): [HomeVariantId, (v: HomeVariantId) => void] {
  const [variant, setLocal] = useState<HomeVariantId>(current);

  useEffect(() => {
    listeners.add(setLocal);
    return () => { listeners.delete(setLocal); };
  }, []);

  const setVariant = useCallback((v: HomeVariantId) => {
    current = v;
    try { window.localStorage.setItem(STORAGE_KEY, v); } catch { /* 무시 */ }
    const url = new URL(window.location.href);
    if (v === "current") url.searchParams.delete(PARAM); else url.searchParams.set(PARAM, v);
    window.history.replaceState(window.history.state, "", url);
    listeners.forEach((fn) => fn(v));
  }, []);

  return [variant, setVariant];
}
