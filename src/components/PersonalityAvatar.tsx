"use client";

import Image from "next/image";
import type { PersonalityProfile } from "@/lib/types";

const AVATAR_BASE_PATH = "/avatars/ai-mbti";

function getAvatarCode(code?: string) {
  return /^[A-Z]{4}$/.test(code ?? "") ? code! : "CEAL";
}

export function PersonalityAvatar({
  profile,
  size = 168,
}: {
  profile?: PersonalityProfile;
  size?: number;
}) {
  const code = getAvatarCode(profile?.code);
  const label = profile ? `${profile.code} ${profile.name}` : "AI 协作画像";

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded-[28px] border border-[rgba(255,255,255,0.08)] bg-surface-100 shadow-card-ring"
      style={{ width: size, height: size }}
      aria-label={label}
    >
      <Image
        src={`${AVATAR_BASE_PATH}/${code}.png`}
        alt={label}
        width={size}
        height={size}
        sizes={`${size}px`}
        className="h-full w-full object-cover"
        draggable={false}
      />
    </div>
  );
}
