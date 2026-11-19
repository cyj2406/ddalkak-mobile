import { useEffect, useRef, useState } from "react";
import { Link2 } from "lucide-react";

import { showToast } from "@/app/components/common/Toast";
import { ProfileAvatar } from "@/app/components/mypage/ProfileAvatar";
import { useProfile } from "@/app/state/profile";
import { f } from "@/app/styleTokens";

import type { Viewer } from "./EditorHeader";

/**
 * 공유 팝오버(에디터 공통) — 지금 함께 보는 중 · 이메일 초대 + 권한 · 참여자 · 링크 복사. 서버 없음: 초대는 목록에만 추가된다.
 * "지금 함께 보는 중"은 상단에 아바타를 늘어놓는 대신 여기서 보여 준다(2026-11-19, 미리캔버스 공유 패널 참고).
 */
export function SharePopover({ fileName, accent, viewers, onClose }: { fileName: string; accent: string; viewers: Viewer[]; onClose: () => void }) {
  const profile = useProfile();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"편집 가능" | "보기 가능" | "코멘트 가능">("편집 가능");
  const [invited, setInvited] = useState<{ email: string; role: string }[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent) => { if (!ref.current?.parentElement?.contains(e.target as Node)) onClose(); };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", down);
    document.addEventListener("keydown", key);
    return () => { document.removeEventListener("pointerdown", down); document.removeEventListener("keydown", key); };
  }, [onClose]);
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  return (
    <div ref={ref} className="absolute right-0 top-10 bg-white rounded-xl z-50" style={{ ...f, width: 340, padding: 16, boxShadow: "0px 8px 32px rgba(0,0,0,0.14)", border: "1px solid #e5e7eb" }} role="dialog" aria-label="공유">
      <p style={{ fontSize: 14, fontWeight: 700, color: "#111827" }}>“{fileName}” 공유</p>
      <div className="mt-3 rounded-xl" style={{ background: "#f8fafc", padding: "10px 12px" }}>
        <p className="flex items-center gap-1.5" style={{ fontSize: 11.5, fontWeight: 700, color: "#334155" }}>
          <span className="size-2 rounded-full" style={{ background: "#22c55e" }} />지금 함께 보는 중 {viewers.length}명
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {viewers.map((v) => (
            <li key={v.name} className="flex items-center gap-2">
              <span className="relative">
                <ProfileAvatar profile={v} size={24} />
                <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 0 2px #f8fafc" }} />
              </span>
              <span style={{ fontSize: 12.5, color: "#111827" }}>{v.name}{v.isMe ? " (나)" : ""}</span>
              <span className="ml-auto" style={{ fontSize: 11, color: "#94a3b8" }}>{v.activity}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex gap-1.5 mt-3">
        <div className="flex-1 min-w-0 flex items-center rounded-lg border border-[#e5e7eb] focus-within:border-[#4f7bff]">
          <input value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.stopPropagation()} placeholder="이메일로 초대" className="flex-1 min-w-0 px-2.5 h-8 outline-none bg-transparent" style={{ fontSize: 12 }} />
          <select value={role} onChange={(e) => setRole(e.target.value as typeof role)} className="h-8 pr-1 bg-transparent outline-none" style={{ fontSize: 11.5, color: "#475569" }} aria-label="권한">
            <option>편집 가능</option><option>코멘트 가능</option><option>보기 가능</option>
          </select>
        </div>
        <button
          type="button" disabled={!valid}
          onClick={() => { setInvited((l) => [...l, { email: email.trim(), role }]); setEmail(""); showToast("초대를 보냈어요. (예시라 실제 메일은 가지 않아요)"); }}
          className="rounded-lg px-3 h-8" style={{ fontSize: 12, fontWeight: 700, color: "#fff", background: valid ? accent : "#cbd5e1" }}
        >
          초대
        </button>
      </div>
      <p style={{ fontSize: 11.5, fontWeight: 600, color: "#64748b", marginTop: 14 }}>참여자</p>
      <ul className="mt-2 flex flex-col gap-2">
        <li className="flex items-center gap-2">
          <ProfileAvatar profile={profile} size={26} />
          <span style={{ fontSize: 12.5, color: "#111827" }}>{profile.name} (나)</span>
          <span className="ml-auto" style={{ fontSize: 11.5, color: "#64748b" }}>소유자</span>
        </li>
        {invited.map((m) => (
          <li key={m.email} className="flex items-center gap-2">
            <span className="size-[26px] rounded-full bg-[#f1f5f9] flex items-center justify-center" style={{ fontSize: 10.5, color: "#475569" }}>{m.email[0].toUpperCase()}</span>
            <span className="truncate" style={{ fontSize: 12.5, color: "#111827" }}>{m.email}</span>
            <span className="ml-auto shrink-0" style={{ fontSize: 11.5, color: "#64748b" }}>{m.role} · 대기 중</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center gap-2 mt-4 pt-3" style={{ borderTop: "1px solid #f1f5f9" }}>
        <span style={{ fontSize: 11.5, color: "#64748b" }}>링크가 있는 사람: 초대받은 사람만</span>
        <button
          type="button"
          onClick={() => { void navigator.clipboard?.writeText(window.location.href).catch(() => {}); showToast("링크를 복사했어요."); }}
          className="ml-auto flex items-center gap-1 rounded-lg px-2.5 h-8 border border-[#e5e7eb] hover:bg-[#f8fafc]"
          style={{ fontSize: 12, fontWeight: 600, color: "#111827" }}
        >
          <Link2 size={13} />링크 복사
        </button>
      </div>
    </div>
  );
}
