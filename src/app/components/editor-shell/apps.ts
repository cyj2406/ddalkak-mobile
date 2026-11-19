/**
 * 딸깍 도구 목록 — 공통 헤더의 앱 이름 ▾(다른 도구로 바로 이동)에 쓴다. 홈 도구모음 화면과 같은 분류·순서.
 * 기획: docs/editor-common-header.md "3. 공통 헤더 구조".
 */
export interface DdalkkakApp { id: string; name: string; desc: string }
export interface DdalkkakAppGroup { label: string; apps: DdalkkakApp[] }

export const DDALKKAK_APPS: DdalkkakAppGroup[] = [
  { label: "문서 편집", apps: [
    { id: "hangul", name: "한글 편집기", desc: "HWP·HWPX 문서" },
    { id: "word", name: "딸깍 문서", desc: "DOCX 문서" },
    { id: "excel", name: "딸깍 시트", desc: "XLSX 스프레드시트" },
    { id: "ppt", name: "딸깍 슬라이드", desc: "PPTX 프레젠테이션" },
    { id: "pdf", name: "딸깍 PDF", desc: "PDF 수정·저장" },
  ] },
  { label: "이미지·디자인", apps: [
    { id: "uidesign", name: "딸깍 UI 디자인", desc: "피그마 파일·화면 디자인" },
    { id: "image", name: "딸깍 포토", desc: "레이어 사진 편집" },
    { id: "vector", name: "딸깍 벡터", desc: "벡터 드로잉" },
    { id: "retouch", name: "딸깍 보정", desc: "노출·색 보정" },
    { id: "layout", name: "딸깍 레이아웃", desc: "인쇄물·출판 디자인" },
    { id: "cardnews", name: "카드뉴스", desc: "카드뉴스 디자인·편집" },
    { id: "detail", name: "상세페이지", desc: "쇼핑몰 상세페이지 편집" },
    { id: "imagedesign", name: "이미지 디자인", desc: "포스터·광고 이미지" },
    { id: "slides", name: "디자인 슬라이드", desc: "발표 슬라이드 디자인" },
    { id: "landing", name: "랜딩페이지", desc: "홍보 웹페이지 편집" },
  ] },
  { label: "영상", apps: [{ id: "video", name: "딸깍 영상편집", desc: "간단한 영상 편집" }] },
];
