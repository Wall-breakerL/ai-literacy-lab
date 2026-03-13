import Link from "next/link";
import { copy } from "@/lib/copy";

export default function HomePage() {
  return (
    <main className="page-main">
      <h1 style={{ marginBottom: "var(--space-sm)", fontSize: "var(--text-2xl)", fontWeight: 700 }}>
        {copy.home.title}
      </h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-lg)" }}>
        {copy.home.subtitle}
      </p>
      <Link href="/profile" className="btn-primary">
        {copy.home.cta}
      </Link>
    </main>
  );
}
