"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  size: number;
  speedY: number;
  speedX: number;
  opacity: number;
  life: number;
}

interface ParticleBackgroundProps {
  variant?: "default" | "intense" | "subtle";
  color?: string;
  interactive?: boolean;
}

export function ParticleBackground({
  variant = "default",
  color = "#55b3ff",
  interactive = true,
}: ParticleBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number>();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const particleCount = variant === "intense" ? 50 : variant === "subtle" ? 30 : 40;
    const isMobile = window.innerWidth < 768;
    const finalCount = isMobile ? Math.floor(particleCount * 0.6) : particleCount;

    const createParticle = (): Particle => ({
      x: Math.random() * canvas.width,
      y: canvas.height + Math.random() * 100,
      size: Math.random() * 2 + 1,
      speedY: -(Math.random() * 0.5 + 0.3),
      speedX: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.5 + 0.3,
      life: 0,
    });

    particlesRef.current = Array.from({ length: finalCount }, createParticle);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };

    if (interactive && !isMobile) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    const checkReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const animate = () => {
      if (!ctx || !canvas) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particlesRef.current.forEach((particle, index) => {
        particle.life += 1;

        if (interactive && !isMobile && !checkReducedMotion) {
          const dx = mouseRef.current.x - particle.x;
          const dy = mouseRef.current.y - particle.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const maxDistance = 150;

          if (distance < maxDistance) {
            const force = (maxDistance - distance) / maxDistance;
            particle.x -= (dx / distance) * force * 2;
            particle.y -= (dy / distance) * force * 2;
          }
        }

        particle.y += particle.speedY;
        particle.x += particle.speedX;

        if (particle.y < -10 || particle.x < -10 || particle.x > canvas.width + 10) {
          particlesRef.current[index] = createParticle();
          return;
        }

        const fadeIn = Math.min(particle.life / 60, 1);
        const currentOpacity = particle.opacity * fadeIn;

        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fillStyle = `${color}${Math.floor(currentOpacity * 255).toString(16).padStart(2, "0")}`;
        ctx.fill();

        if (particle.size > 1.5) {
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, particle.size * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = `${color}${Math.floor(currentOpacity * 0.3 * 255).toString(16).padStart(2, "0")}`;
          ctx.fill();
        }
      });

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      } else {
        animate();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    animate();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [variant, color, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ mixBlendMode: "screen" }}
    />
  );
}
