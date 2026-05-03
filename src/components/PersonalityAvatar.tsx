"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useState } from "react";
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
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const rotateXValue = ((y - centerY) / centerY) * -10;
    const rotateYValue = ((x - centerX) / centerX) * 10;
    setRotateX(rotateXValue);
    setRotateY(rotateYValue);
  };

  const handleMouseLeave = () => {
    setRotateX(0);
    setRotateY(0);
    setIsHovered(false);
  };

  return (
    <motion.div
      className="relative shrink-0 preserve-3d"
      style={{ perspective: "1000px", width: size, height: size }}
      animate={{
        y: [0, -8, 0],
      }}
      transition={{
        duration: 4,
        ease: "easeInOut",
        repeat: Infinity,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <motion.div
        className="relative overflow-hidden rounded-[28px] border bg-surface-100 backface-hidden"
        style={{
          width: size,
          height: size,
          willChange: "transform",
        }}
        animate={{
          rotateX,
          rotateY,
          scale: isHovered ? 1.05 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-[28px] pointer-events-none"
          animate={{
            borderColor: isHovered
              ? "rgba(85, 179, 255, 0.4)"
              : "rgba(255, 255, 255, 0.08)",
            boxShadow: isHovered
              ? "0 0 30px rgba(85, 179, 255, 0.5), 0 0 60px rgba(85, 179, 255, 0.25), 0 0 90px rgba(85, 179, 255, 0.1)"
              : "rgb(27, 28, 30) 0px 0px 0px 1px, rgb(7, 8, 10) 0px 0px 0px 1px inset",
          }}
          transition={{ duration: 0.3 }}
          style={{
            border: "1px solid",
          }}
        />
        <div
          className="absolute inset-0 rounded-[28px] opacity-0 hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            background:
              "conic-gradient(from 0deg, rgba(255, 99, 99, 0.1), rgba(85, 179, 255, 0.2), rgba(95, 201, 146, 0.1), rgba(255, 188, 51, 0.1), rgba(255, 99, 99, 0.1))",
            animation: "rotate-slow 20s linear infinite",
          }}
        />
        <Image
          src={`${AVATAR_BASE_PATH}/${code}.png`}
          alt={label}
          width={size}
          height={size}
          sizes={`${size}px`}
          className="h-full w-full object-cover relative z-10"
          draggable={false}
        />
      </motion.div>
    </motion.div>
  );
}
