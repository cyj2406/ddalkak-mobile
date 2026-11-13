import { useRef, useState, type ReactNode } from "react";
import { Camera, Check, Mail, MousePointer2, Trash2, Users } from "lucide-react";

import { Badge } from "@/app/components/common/Badge";
import { Button } from "@/app/components/common/Button";
import { InputField } from "@/app/components/common/InputField";
import { PageContainer, PageHeader } from "@/app/components/common/PageContainer";
import { showToast } from "@/app/components/common/Toast";
import {
  COLLAB_COLORS, PROFILE_LIMITS, collabColorValue, resizeAvatar, respondToInvite, updateProfile, useProfile,
  type Profile, type TeamRole,
} from "@/app/state/profile";
import { findPlan, useSubscription } from "@/app/state/subscription";
import { color, f, radius, shadow, typography } from "@/app/styleTokens";

import { ProfileAvatar } from "./ProfileAvatar";

/**
 * 마이페이지(프로필 메뉴 > 마이페이지, 2026-11-13).
 *
 * 공동 작업 기능이 생기면서 "다른 사람에게 보이는 나"를 고칠 곳이 필요해 만들었다.
 * 참고한 패턴:
 *   - Canva "계정 설정": 항목마다 [값 · 수정] 한 줄 → 누르면 그 줄만 입력칸으로 바뀌고 저장/취소.
 *     한 번에 한 줄만 편집(다른 줄을 열면 이전 줄은 닫힘). 페이지 전체 "저장" 버튼이 없다.
 *   - Notion·Canva 프로필 사진: 원형 아바타 + 카메라 버튼 / "사진 변경 · 삭제". 사진이 없으면 이니셜.
 *   - Figma·Miro 멀티플레이어: 협업 색상(커서·이름표 색)과 "공동 작업자에게 이렇게 보여요" 미리보기.
 *   - Canva·Figma 팀 목록: 참여 중인 팀 + 내 역할 배지, 받은 초대 수락/거절.
 * 레이아웃·카드·버튼은 요금제 페이지(PageContainer, radius.cardEmphasis, Button)를 그대로 따른다.
 */

type EditKey = "name" | "jobTitle" | "bio";

const CARD_STYLE = {
  background: color.surface.default,
  border: `1px solid ${color.border.default}`,
  borderRadius: radius.cardEmphasis,
  boxShadow: shadow.cardEmphasis,
} as const;

/** 줄 끝 텍스트 버튼(수정·변경) — 프로필 메뉴의 "내역 보기 ›"와 같은 모양 */
const LINK_BUTTON_CLASS =
  "shrink-0 px-2 py-1.5 -mr-2 rounded-md outline-none transition-colors hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-[#4f7bff] disabled:opacity-40 disabled:hover:bg-transparent";
const linkButtonStyle = { ...f, fontWeight: 600, fontSize: 13.5, color: color.brand, letterSpacing: "-0.2px" } as const;

const ROLE_TONE: Record<TeamRole, "brand" | "neutral"> = { 소유자: "brand", 편집자: "neutral", "보기 전용": "neutral" };

export function MyPage({ onOpenSettings }: { onOpenSettings: () => void }) {
  const profile = useProfile();
  const [editing, setEditing] = useState<EditKey | null>(null);

  return (
    <PageContainer>
      <PageHeader title="마이페이지" description="공동 작업자에게 보이는 프로필과 내 계정 정보를 관리해요." />

      <div className="grid gap-5 items-start wide:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-5 min-w-0">
          <ProfileHero profile={profile} />

          <Section title="기본 정보" description="팀원이 초대 목록·댓글·공동 편집 화면에서 나를 알아보는 정보예요.">
            <EditableRow
              label="이름" field="name" required editing={editing} setEditing={setEditing}
              value={profile.name} limit={PROFILE_LIMITS.name} placeholder="이름을 입력하세요"
            />
            <EditableRow
              label="직무" field="jobTitle" editing={editing} setEditing={setEditing}
              value={profile.jobTitle} limit={PROFILE_LIMITS.jobTitle} placeholder="예: 마케터, 콘텐츠 디자이너" emptyLabel="직무 추가"
            />
            <EditableRow
              label="한 줄 소개" field="bio" editing={editing} setEditing={setEditing}
              value={profile.bio} limit={PROFILE_LIMITS.bio} placeholder="예: 카드뉴스와 상세페이지를 주로 만들어요" emptyLabel="소개 추가" last
            />
          </Section>

          <Section title="공동 작업" description="함께 편집할 때 내 커서와 이름표에 쓰이는 색이에요.">
            <CollabColorPicker profile={profile} />
            <div className="wide:hidden mt-4"><CollabPreview profile={profile} /></div>
            <TeamList profile={profile} />
          </Section>

          <Section title="계정">
            <Row label="이메일">
              <div className="flex items-center gap-2 min-w-0 flex-wrap">
                <span className="truncate" style={typography.formValue}>{profile.email}</span>
                <Badge tone="neutral">Google 로그인</Badge>
              </div>
            </Row>
            <Row label="알림·화면 설정">
              <span style={{ ...typography.body, color: color.text.secondary }}>설정에서 바꿀 수 있어요.</span>
              <button type="button" className={LINK_BUTTON_CLASS} style={linkButtonStyle} onClick={onOpenSettings}>설정 열기</button>
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
          </Section>
        </div>

        {/* 데스크톱 — 오른쪽에 고정되는 미리보기. 고치는 즉시 바뀐다 */}
        <aside className="hidden wide:block sticky top-0">
          <div style={{ ...CARD_STYLE, padding: 20 }}>
            <CollabPreview profile={profile} />
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}

/* ───────────────────────── 상단 프로필 카드 ───────────────────────── */

function ProfileHero({ profile }: { profile: Profile }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const subscription = useSubscription();
  const plan = findPlan(subscription.planId);
  const hasPlan = subscription.status === "active" || subscription.status === "cancel_scheduled";

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
    <div className="flex flex-col sm:flex-row sm:items-center gap-5" style={{ ...CARD_STYLE, padding: 24 }}>
      <div className="relative self-start sm:self-auto">
        <ProfileAvatar profile={profile} size={84} />
        <button
          type="button"
          aria-label="프로필 사진 변경"
          onClick={() => fileRef.current?.click()}
          className="absolute -right-0.5 -bottom-0.5 size-8 rounded-full flex items-center justify-center outline-none transition-colors hover:bg-[#f8fafc] focus-visible:ring-2 focus-visible:ring-[#4f7bff]"
          style={{ background: color.surface.default, border: `1px solid ${color.border.default}`, boxShadow: shadow.card }}
        >
          <Camera size={15} strokeWidth={1.8} color="#334155" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ""; }}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="truncate" style={{ ...typography.pageTitle, fontSize: 20, letterSpacing: "-0.5px" }}>{profile.name}</p>
          {hasPlan && plan && <Badge tone="brand">{plan.name}</Badge>}
        </div>
        <p className="truncate" style={{ ...f, fontWeight: 400, fontSize: 13.5, color: color.text.secondary, marginTop: 2 }}>
          {[profile.jobTitle, profile.email].filter(Boolean).join(" · ")}
        </p>
        <div className="flex gap-2 mt-4">
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
      </div>
    </div>
  );
}

/* ───────────────────────── 섹션 · 줄 ───────────────────────── */

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section style={{ ...CARD_STYLE, padding: "22px 24px 8px" }}>
      <h2 style={typography.sectionTitle}>{title}</h2>
      {description && <p style={{ ...typography.body, color: color.text.secondary, marginTop: 4 }}>{description}</p>}
      <div className="mt-3 pb-4">{children}</div>
    </section>
  );
}

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
        <span style={{ color: error ? "#ef4444" : color.text.secondary }}>{error ?? (field === "name" ? "공동 작업자에게 이 이름으로 보여요." : "")}</span>
        <span style={{ color: over ? "#ef4444" : color.text.secondary }}>{draft.trim().length}/{limit}</span>
      </div>
      <div className="flex justify-end gap-2 mt-3">
        <Button variant="secondary" size="md" onClick={cancel}>취소</Button>
        <Button variant="primary" size="md" onClick={save}>저장</Button>
      </div>
    </div>
  );
}

/* ───────────────────────── 공동 작업 ───────────────────────── */

function CollabColorPicker({ profile }: { profile: Profile }) {
  return (
    <div role="radiogroup" aria-label="협업 색상" className="flex flex-wrap gap-2.5 pt-1">
      {COLLAB_COLORS.map((c) => {
        const selected = profile.collabColor === c.id;
        return (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={c.label}
            title={c.label}
            onClick={() => updateProfile({ collabColor: c.id })}
            className="size-9 rounded-full flex items-center justify-center outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#4f7bff]"
            style={{ background: c.value, boxShadow: selected ? `0 0 0 2px #ffffff, 0 0 0 4px ${c.value}` : undefined }}
          >
            {selected && <Check size={16} strokeWidth={2.6} color="#ffffff" />}
          </button>
        );
      })}
    </div>
  );
}

/** Figma 멀티플레이어 커서 + Notion 사람 카드 — 지금 값이 다른 사람 화면에서 어떻게 보이는지 */
function CollabPreview({ profile }: { profile: Profile }) {
  const c = collabColorValue(profile.collabColor);
  return (
    <div>
      <p style={{ ...typography.formLabel, fontSize: 13.5 }}>공동 작업자에게 이렇게 보여요</p>
      <div
        className="relative mt-3 overflow-hidden"
        style={{ height: 112, borderRadius: radius.card, background: color.surface.subtle, border: `1px solid ${color.border.default}` }}
        aria-hidden
      >
        {/* 캔버스 위 편집 중인 요소 + 내 선택 테두리 */}
        <div className="absolute" style={{ left: 18, top: 18, width: 128, height: 52, borderRadius: 8, background: "#ffffff", outline: `2px solid ${c}`, outlineOffset: 2 }}>
          <div style={{ margin: "12px 12px 6px", height: 8, width: 80, borderRadius: 4, background: "#e2e8f0" }} />
          <div style={{ margin: "0 12px", height: 8, width: 56, borderRadius: 4, background: "#eef2f7" }} />
        </div>
        <div className="absolute flex items-start" style={{ left: 150, top: 56 }}>
          <MousePointer2 size={18} strokeWidth={1.5} fill={c} color="#ffffff" style={{ transform: "rotate(-8deg)" }} />
          <span
            className="truncate"
            style={{ ...f, marginTop: 14, marginLeft: -2, maxWidth: 120, padding: "3px 8px", borderRadius: 6, background: c, color: "#ffffff", fontSize: 12, fontWeight: 600, letterSpacing: "-0.2px" }}
          >
            {profile.name}
          </span>
        </div>
      </div>
      <div className="flex items-start gap-3 mt-3" style={{ padding: 14, borderRadius: radius.card, border: `1px solid ${color.border.default}`, boxShadow: shadow.card }}>
        <ProfileAvatar profile={profile} size={40} ring />
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ ...f, fontWeight: 700, fontSize: 14.5, color: color.text.primary, letterSpacing: "-0.3px" }}>{profile.name}</p>
          <p className="truncate" style={{ ...typography.caption, color: color.text.secondary, marginTop: 1 }}>{profile.jobTitle || "직무 미입력"}</p>
          {profile.bio && <p style={{ ...typography.body, marginTop: 6, wordBreak: "keep-all" }}>{profile.bio}</p>}
        </div>
      </div>
    </div>
  );
}

function TeamList({ profile }: { profile: Profile }) {
  return (
    <div className="mt-6">
      {profile.invites.length > 0 && (
        <>
          <p style={{ ...typography.formLabel, fontSize: 13.5 }}>받은 초대 <span style={{ color: color.brand }}>{profile.invites.length}</span></p>
          <ul className="mt-2 flex flex-col gap-2">
            {profile.invites.map((inv) => (
              <li
                key={inv.id}
                className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
                style={{ padding: "12px 14px", borderRadius: radius.card, background: color.surface.accent }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="size-9 rounded-full flex items-center justify-center shrink-0" style={{ background: "#ffffff" }}>
                    <Mail size={16} strokeWidth={1.8} color={color.brand} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate" style={{ ...f, fontWeight: 600, fontSize: 14, color: color.text.primary, letterSpacing: "-0.3px" }}>{inv.teamName}</p>
                    <p className="truncate" style={{ ...typography.caption, color: color.text.secondary }}>{inv.invitedBy}님이 {inv.role}로 초대했어요</p>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button variant="secondary" size="md" onClick={() => { respondToInvite(inv.id, false); showToast("초대를 거절했어요."); }}>거절</Button>
                  <Button variant="primary" size="md" onClick={() => { respondToInvite(inv.id, true); showToast(`${inv.teamName}에 참여했어요.`); }}>수락</Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <p className={profile.invites.length > 0 ? "mt-5" : ""} style={{ ...typography.formLabel, fontSize: 13.5 }}>참여 중인 팀</p>
      <ul className="mt-1">
        {profile.teams.map((t, i) => (
          <li
            key={t.id}
            className="flex items-center gap-3 py-3"
            style={{ borderBottom: i === profile.teams.length - 1 ? undefined : `1px solid ${color.surface.hover}` }}
          >
            <span
              className="size-9 rounded-[10px] flex items-center justify-center shrink-0"
              style={{ ...f, background: color.surface.hover, color: "#475569", fontWeight: 700, fontSize: 14 }}
              aria-hidden
            >
              {t.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ ...f, fontWeight: 600, fontSize: 14, color: color.text.primary, letterSpacing: "-0.3px" }}>{t.name}</p>
              <p className="flex items-center gap-1" style={{ ...typography.caption, color: color.text.secondary }}>
                <Users size={12} strokeWidth={1.8} />멤버 {t.memberCount}명
              </p>
            </div>
            <Badge tone={ROLE_TONE[t.role]}>{t.role}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
