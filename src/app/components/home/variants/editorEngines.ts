import type { EditorKind } from "@/app/components/home/EditorQuickLinks";
import artWord from "@/assets/home/editor/word.png";
import artHangul from "@/assets/home/editor/hangul.png";
import artPpt from "@/assets/home/editor/ppt.png";
import artExcel from "@/assets/home/editor/excel.png";
import artVideo from "@/assets/home/editor/video.png";
import artVector from "@/assets/home/editor/image.png";
import artPdf from "@/assets/home/art/typo.png";
import artDesign from "@/assets/home/art/appintro.png";
import artPhoto from "@/assets/home/art/photo.png";

/**
 * 편집기(엔진)와 결과물(프리셋)을 나눈 데이터 — 시안 A·B가 함께 쓴다.
 * 기획 근거: docs/home-editor-redesign.md "2. 정보 구조".
 *
 * opens: 지금 있는 편집기 중 무엇으로 열지(App.openEditor). null 이면 아직 없는 편집기 → "준비 중".
 */
export type EngineId = "doc" | "hangul" | "pdf" | "sheet" | "slide" | "design" | "photo" | "vector" | "video";
export type EngineGroup = "문서" | "디자인" | "영상";

export interface EditorEngine {
  id: EngineId;
  label: string;
  /** 한 줄 설명 — 카드 아래·툴팁 */
  hint: string;
  group: EngineGroup;
  art: string;
  opens: EditorKind | null;
  /** 이 편집기로 여는 파일 확장자 — 파일 열기 자동 연결용 */
  ext: string[];
  isNew?: boolean;
}

export const ENGINES: EditorEngine[] = [
  { id: "doc", label: "문서", hint: "DOCX 보고서·제안서", group: "문서", art: artWord, opens: "word", ext: ["docx", "doc", "txt", "md"] },
  { id: "hangul", label: "한글", hint: "HWP·HWPX 공문·신청서", group: "문서", art: artHangul, opens: "hangul", ext: ["hwp", "hwpx"] },
  { id: "pdf", label: "PDF", hint: "PDF 수정·저장", group: "문서", art: artPdf, opens: null, ext: ["pdf"], isNew: true },
  { id: "sheet", label: "시트", hint: "XLSX 표·계산", group: "문서", art: artExcel, opens: "excel", ext: ["xlsx", "xls", "csv"] },
  { id: "slide", label: "슬라이드", hint: "PPTX 발표자료", group: "문서", art: artPpt, opens: "ppt", ext: ["pptx", "ppt"] },
  { id: "design", label: "디자인", hint: "카드뉴스·포스터·상세페이지", group: "디자인", art: artDesign, opens: "image", ext: ["fig"], isNew: true },
  { id: "photo", label: "포토", hint: "사진 편집·보정·레이어 분리", group: "디자인", art: artPhoto, opens: "layer", ext: ["jpg", "jpeg", "png", "webp", "psd"], isNew: true },
  { id: "vector", label: "벡터", hint: "로고·일러스트 드로잉", group: "디자인", art: artVector, opens: null, ext: ["svg", "ai"], isNew: true },
  { id: "video", label: "영상", hint: "컷 편집·자막", group: "영상", art: artVideo, opens: "video", ext: ["mp4", "mov"] },
];

/**
 * 결과물 프리셋 — 사용자가 "뭘 만들지"로 고르면, 알맞은 편집기를 알맞은 크기로 연다.
 * 편집기 카드 수를 늘리지 않고 진입점만 늘리는 역할.
 */
export interface OutputPreset {
  label: string;
  engine: EngineId;
  /** 캔버스 규격 메모 — 지금은 표시용 */
  size: string;
  /** 카드뉴스처럼 전용 화면이 이미 있는 경우 */
  special?: "cardnews";
}

export const PRESETS: OutputPreset[] = [
  { label: "카드뉴스", engine: "design", size: "1080×1350", special: "cardnews" },
  { label: "상세페이지", engine: "design", size: "860×가변" },
  { label: "포스터·광고", engine: "design", size: "A4 · SNS" },
  { label: "발표자료", engine: "slide", size: "16:9" },
  { label: "보고서", engine: "doc", size: "A4" },
  { label: "공문·신청서", engine: "hangul", size: "A4" },
  { label: "숏폼 영상", engine: "video", size: "9:16" },
];

export function engineById(id: EngineId): EditorEngine {
  return ENGINES.find((e) => e.id === id)!;
}

export function engineForFile(name: string): EditorEngine | undefined {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ENGINES.find((e) => e.ext.includes(ext));
}

export const FILE_ACCEPT = ENGINES.flatMap((e) => e.ext.map((x) => `.${x}`)).join(",");
