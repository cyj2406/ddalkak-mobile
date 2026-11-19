import coverExpensePlan from "@/assets/home/templates/task/hangul-1.png";
import coverOperationPlan from "@/assets/home/templates/task/hangul-2.png";

/**
 * 한글·워드 편집기 템플릿(2026-11-19). 기획: docs/doc-editor.md "2-2".
 * 형식(한글/문서)이 아니라 **용도**로 묶는다. 지금 편집기 형식의 템플릿만 보인다.
 * cover가 있으면 실제 서식 이미지, 없으면 PaperThumb가 layout 모양으로 종이 미리보기를 그린다(제목을 크게 박아 읽히게).
 */
export type DocKind = "hangul" | "word";
export type PaperLayout = "letter" | "form" | "table" | "report";

export interface DocTemplate {
  id: string;
  kind: DocKind;
  title: string;
  category: string;
  /** 이럴 때 써요 */
  use: string;
  /** 들어 있는 항목 */
  sections: string[];
  layout: PaperLayout;
  cover?: string;
}

export const DOC_CATEGORIES: Record<DocKind, string[]> = {
  hangul: ["공문", "신청·확인서", "기안·결재", "보고·계획", "계약·거래"],
  word: ["보고서", "기획·제안", "회의", "취업", "안내문"],
};

const t = (kind: DocKind, id: string, title: string, category: string, layout: PaperLayout, use: string, sections: string[], cover?: string): DocTemplate =>
  ({ id: `${kind}-${id}`, kind, title, category, layout, use, sections, cover });

export const DOC_TEMPLATES: DocTemplate[] = [
  // ── 한글 ──
  t("hangul", "coop", "협조 요청 공문", "공문", "letter", "다른 기관·부서에 자료나 협조를 요청할 때", ["수신·참조", "제목", "관련 근거", "요청 내용", "붙임", "발신 명의"]),
  t("hangul", "result", "결과 보고 공문", "공문", "letter", "추진한 사업이나 행사의 결과를 알릴 때", ["수신", "제목", "추진 개요", "추진 결과", "향후 계획", "붙임"]),
  t("hangul", "event", "행사 개최 알림 공문", "공문", "letter", "행사 일정과 참석 협조를 알릴 때", ["수신", "제목", "행사 개요(일시·장소)", "참석 대상", "협조 사항"]),
  t("hangul", "objection", "강제퇴거명령에 대한 이의신청서", "신청·확인서", "form", "출입국 행정 처분에 이의를 신청할 때", ["신청인 인적 사항", "처분 내용", "이의 신청 이유", "첨부 서류", "서명"]),
  t("hangul", "residence", "거소신고(신청)서", "신청·확인서", "form", "국내 거소를 신고할 때", ["신고인 정보", "거소지", "체류 자격", "신고 사유", "서명"]),
  t("hangul", "lodging", "거주숙소제공사실확인서", "신청·확인서", "form", "외국인에게 숙소를 제공했음을 확인할 때", ["숙소 제공자", "피제공자", "숙소 주소", "제공 기간", "확인 서명"]),
  t("hangul", "employment", "재직증명서", "신청·확인서", "form", "회사 재직 사실을 증명할 때", ["인적 사항", "재직 정보(부서·직위·기간)", "용도", "발급 기관 직인"]),
  t("hangul", "draft", "기안서", "기안·결재", "form", "업무 추진을 결재받을 때", ["결재란", "문서번호·시행일자", "제목", "기안 내용", "붙임"]),
  t("hangul", "approval", "기안품의서", "기안·결재", "form", "기안과 품의를 한 장으로 올릴 때", ["결재란", "품의 사유", "소요 예산", "세부 내역", "붙임"]),
  t("hangul", "expense-res", "지출결의서", "기안·결재", "table", "비용 지출을 결재받을 때", ["결재란", "지출 내역 표", "합계", "증빙"]),
  t("hangul", "expense-plan", "지출계획서", "보고·계획", "table", "부서별 인건비·비용 지출을 계획할 때", ["문서번호·부서·작성자", "결재란", "구분·인원수·기본급·총금액 표", "합계"], coverExpensePlan),
  t("hangul", "operation", "운영계획서", "보고·계획", "report", "매장·사업의 판매 목표와 손익을 계획할 때", ["판매목표", "판촉계획", "손익계획", "정보 및 고객관리", "제안 및 건의사항"], coverOperationPlan),
  t("hangul", "trip", "출장 결과 보고서", "보고·계획", "report", "출장 다녀온 내용을 보고할 때", ["출장 개요", "주요 활동", "결과 및 성과", "후속 조치", "경비 내역"]),
  t("hangul", "mou", "양해각서", "계약·거래", "letter", "두 기관이 협력 원칙을 정할 때", ["협약 당사자", "목적", "협력 범위", "유효 기간", "서명란"]),
  t("hangul", "statement", "거래명세서", "계약·거래", "table", "공급한 물품과 금액을 알릴 때", ["공급자·공급받는자", "품목·수량·단가 표", "공급가액·세액", "합계"]),
  t("hangul", "quote", "견적서", "계약·거래", "table", "물품·용역 가격을 제시할 때", ["수신·견적일", "품목 표", "합계 금액", "유효 기간·조건"]),
  // ── 워드 ──
  t("word", "monthly", "월간 업무 보고서", "보고서", "report", "한 달 성과를 정리해 보고할 때", ["요약", "주요 성과", "진행 중인 업무", "이슈와 대응", "다음 달 계획"]),
  t("word", "weekly", "주간 업무 보고", "보고서", "report", "한 주 업무를 짧게 공유할 때", ["이번 주 한 일", "다음 주 할 일", "도움이 필요한 일"]),
  t("word", "bizplan", "사업계획서", "기획·제안", "report", "사업 개요와 시장·재무 계획을 정리할 때", ["사업 개요", "시장 분석", "추진 전략", "재무 계획", "추진 일정"]),
  t("word", "proposal", "제안서", "기획·제안", "form", "프로젝트·서비스를 제안할 때", ["제안 배경", "제안 내용", "기대 효과", "일정·비용"]),
  t("word", "bid", "입찰 제안서", "기획·제안", "report", "공공 입찰에 제출할 때", ["사업 이해", "수행 방안", "수행 조직", "일정 계획", "유사 실적"]),
  t("word", "minutes", "회의록", "회의", "table", "회의 결정 사항과 할 일을 남길 때", ["회의 정보(일시·참석자)", "안건", "논의 내용", "결정 사항", "후속 조치"]),
  t("word", "cover-letter", "자기소개서", "취업", "letter", "취업·대학원 지원서를 쓸 때", ["성장 과정", "지원 동기", "직무 역량", "입사 후 포부"]),
  t("word", "resume", "이력서", "취업", "table", "경력과 학력을 한눈에 정리할 때", ["인적 사항", "학력", "경력", "자격·어학", "기타"]),
  t("word", "notice", "행사 안내문", "안내문", "letter", "행사 일정과 참여 방법을 알릴 때", ["행사 소개", "일시·장소", "참여 방법", "문의처"]),
  t("word", "announce", "공지문", "안내문", "letter", "변경 사항을 짧게 알릴 때", ["제목", "변경 내용", "적용 일자", "문의처"]),
];

export const templatesFor = (kind: DocKind) => DOC_TEMPLATES.filter((x) => x.kind === kind);
