import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg py-20 text-center">
      <h1 className="mb-4 font-mono text-2xl text-[rgb(var(--lab-fg-rgb))]">404</h1>
      <p className="mb-6 text-sm text-lab-muted">未找到会话或页面。</p>
      <Link className="text-lab-accent hover:underline" href="/">
        返回首页
      </Link>
    </div>
  );
}
