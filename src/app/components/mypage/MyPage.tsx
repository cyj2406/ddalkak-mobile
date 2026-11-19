import { useRef, useState, type ReactNode } from "react";
import { Camera, Trash2 } from "lucide-react";

import { Badge } from "@/app/components/common/Badge";
import { Button } from "@/app/components/common/Button";
import { InputField } from "@/app/components/common/InputField";
import { PageContainer, PageHeader } from "@/app/components/common/PageContainer";
import { showToast } from "@/app/components/common/Toast";
import { PROFILE_LIMITS, resizeAvatar, updateProfile, useProfile, type Profile } from "@/app/state/profile";
import { color, f, radius, shadow, typography } from "@/app/styleTokens";

import { ProfileAvatar } from "./ProfileAvatar";

/**
 * 마이페이지(프로필 메뉴 > 마이페이지, 2026-11-13 / 2026-11-19 간소화).
 *
 * Canva "내 계정"처럼 사진 · 이름 · 이메일 · 계정 삭제만 둔다.
 *   - 항목마다 [값 · 수정] 한 줄 → 누르면 그 줄만 입력칸(저장/취소). 페이지 전체 "저장" 버튼 없음.
 *   - 2026-11-19에 뺀 것: 직무 · 한 줄 소개 · 협업 색상 · 참여 중인 팀 · 받은 초대 · "공동 작업자에게 이렇게 보여요" 미리보기 ·
 *     설정 열기 줄. 공동 작업은 각 작업물(에디터의 공유)에서 하고, 설정은 프로필 메뉴에 이미 있다.
 *     profile 상태의 collabColor는 사진이 없을 때 아바타 바탕색으로 계속 쓴다.
 */

type EditKey = "name";

const CARD_STYLE = {
  background: color.surface.default,
  border: `1px solid ${color.border.default}`,
  borderRadius: radius.cardEmphasis,
  boxShadow: shadow.cardEmphasis,
} as const;

/** 줄 끝 텍스트 버튼(수정·삭제 요청) */
const LINK_BUTTON_CLASS =
  "shrink-0 px-2 py-1.5 -mr-2 rounded-md outline-none transition-colors hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-40 disabled:hover:bg-transparent";
const linkButtonStyle = { ...f, fontWeight: 600, fontSize: 13.5, color: color.brand, letterSpacing: "-0.2px" } as const;

export function MyPage() {
  const profile = useProfile();
  const [editing, setEditing] = useState<EditKey | null>(null);

  return (
    <PageContainer>
      <div className="w-full mx-auto flex flex-col gap-5" style={{ maxWidth: 720 }}>
        <PageHeader title="마이페이지" description="사진과 이름은 함께 작업하는 사람에게도 이렇게 보여요." />

        <section style={{ ...CARD_STYLE, padding: "24px 24px 8px" }}>
          <AvatarEditor profile={profile} />
          <div className="mt-4 pb-4" style={{ borderTop: `1px solid ${color.surface.hover}` }}>
            <EditableRow
              label="이름" field="name" required editing={editing} setEditing={setEditing}
              value={profile.name} limit={PROFILE_LIMITS.name} placeholder="이름을 입력하세요"
            />
            <Row label="이메일">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="truncate" style={typography.formValue}>{profile.email}</span>
                <Badge tone="neutral">Google 로그인</Badge>
              </div>
            </Row>
            <Row label="계정 삭제" last>
              <span style={{ ...typography.body, color: color.text.secondary }}>작업물과 크레딧이 모두 사라지며 되돌릴 수 없어요.</span>
              <button
                type="button"
                className={LINK_BUTTON_CLASS}
                style={{ ...linkButtonStyle, color: "#ef4444" }}
                onClick={() => showToast("계정 삭제는 고객센터(문의하기)로 요청해 주세요.")}
              >
                삭제 요청
              </button>
            </Row>
          </div>
        </section>
      </div>
    </PageContainer>
  );
}

/* ───────────────────────── 프로필 사진 ───────────────────────── */

function AvatarEditor({ profile }: { profile: Profile }) {
  const fileRef = useRef<HTMLInputElement>(null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { showToast("이미지 파일만 올릴 수 있어요.", "error"); return; }
    if (file.size > 10 * 1024 * 1024) { showToast("10MB 이하 이미지를 올려 주세요.", "error"); return; }
    try {
      updateProfile({ avatarUrl: await resizeAvatar(file) });
      showToast("프로필 사진을 바꿨어요.");
    } catch {
      showToast("사진을 불러오지 못했어요. 다른 파일로 시도해 주세요.", "error");
    }
  };

  return (
    <div className="flex items-center gap-5">
      <ProfileAvatar profile={profile} size={72} />
      <div className="flex gap-2 flex-wrap">
        <Button variant="secondary" size="md" onClick={() => fileRef.current?.click()}>
          <Camera size={15} strokeWidth={1.8} />사진 변경
        </Button>
        {profile.avatarUrl && (
          <Button
            variant="secondary"
            size="md"
            onClick={() => { updateProfile({ avatarUrl: null }); showToast("사진을 삭제하고 이니셜로 표시해요."); }}
          >
            <Trash2 size={15} strokeWidth={1.8} />삭제
          </Button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
      />
    </div>
  );
}

/* ───────────────────────── 섹션 · 줄 ───────────────────────── */

/** 라벨 | 내용 한 줄 — 640px 미만에서는 라벨이 위로 올라간다 */
function Row({ label, children, last }: { label: string; children: ReactNode; last?: boolean }) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-4 py-3.5"
      style={{ borderBottom: last ? undefined : `1px solid ${color.surface.hover}` }}
    >
      <span className="sm:w-[112px] shrink-0" style={{ ...typography.formLabel, color: color.text.secondary, fontWeight: 500 }}>{label}</span>
      <div className="flex-1 min-w-0 flex items-center justify-between gap-3">{children}</div>
    </div>
  );
}

function EditableRow({
  label, field, value, limit, placeholder, emptyLabel, required, editing, setEditing, last,
}: {
  label: string;
  field: EditKey;
  value: string;
  limit: number;
  placeholder: string;
  emptyLabel?: string;
  required?: boolean;
  editing: EditKey | null;
  setEditing: (k: EditKey | null) => void;
  last?: boolean;
}) {
  const isEditing = editing === field;
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  const open = () => { setDraft(value); setError(null); setEditing(field); };
  const cancel = () => { setError(null); setEditing(null); };
  const save = () => {
    const next = draft.trim().replace(/\s+/g, " ");
    if (required && !next) { setError(`${label}을 입력해 주세요.`); return; }
    if (next.length > limit) { setError(`${limit}자 이내로 입력해 주세요.`); return; }
    if (next !== value) {
      updateProfile({ [field]: next } as Partial<Profile>);
      showToast(`${label}을(를) 저장했어요.`);
    }
    setEditing(null);
  };

  if (!isEditing) {
    return (
      <Row label={label} last={last}>
        {value ? (
          <span className="truncate" style={typography.formValue}>{value}</span>
        ) : (
          <span style={{ ...typography.formValue, color: color.text.placeholder }}>{placeholder}</span>
        )}
        <button type="button" className={LINK_BUTTON_CLASS} style={linkButtonStyle} onClick={open}>
          {value || !emptyLabel ? "수정" : emptyLabel}
        </button>
      </Row>
    );
  }

  const over = draft.trim().length > limit;
  return (
    <div className="py-3.5" style={{ borderBottom: last ? undefined : `1px solid ${color.surface.hover}` }}>
      <label htmlFor={`profile-${field}`} style={typography.formLabel}>{label}</label>
      <InputField
        variant="singleline"
        id={`profile-${field}`}
        autoFocus
        value={draft}
        onChange={(v) => { setDraft(v); if (error) setError(null); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) save();
          if (e.key === "Escape") { e.stopPropagation(); cancel(); }
        }}
        placeholder={placeholder}
        aria-invalid={!!error || over}
        aria-describedby={`profile-${field}-help`}
        containerClassName="mt-2"
        style={{
          ...typography.formValue,
          height: 48,
          padding: "0 14px",
          borderRadius: radius.control,
          border: `1px solid ${error || over ? "#ef4444" : color.border.default}`,
        }}
        placeholderStyle={typography.formPlaceholder}
      />
      <div id={`profile-${field}-help`} className="flex justify-between gap-3 mt-1.5" style={typography.caption}>
        <span style={{ color: error ? "#ef4444" : color.text.secondary }}>{error ?? "함께 작업하는 사람에게 이 이름으로 보여요."}</span>
        <span style={{ color: over ? "#ef4444" : color.text.secondary }}>{draft.trim().length}/{limit}</span>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="secondary" size="md" onClick={cancel}>취소</Button>
        <Button variant="primary" size="md" onClick={save}>저장</Button>
      </div>
    </div>
  );
}
