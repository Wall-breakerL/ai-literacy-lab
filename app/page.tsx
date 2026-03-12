import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "0.5rem" }}>AI 交互素养评估原型</h1>
      <p style={{ color: "#555", marginBottom: "1.5rem" }}>
        在自然、轻松的任务对话中，评估你与 AI 协作解决问题的能力。
      </p>
      <Link
        href="/profile"
        style={{
          display: "inline-block",
          padding: "0.6rem 1.2rem",
          background: "#111",
          color: "#fff",
          borderRadius: 6,
        }}
      >
        开始评估
      </Link>
    </main>
  );
}
