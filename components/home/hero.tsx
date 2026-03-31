export function Hero() {
  return (
    <section className="lab-layer-panel rounded-2xl p-6 md:p-8">
      <p className="type-code text-xs uppercase tracking-[0.16em] text-lab-accent">Human-AI Performance Lab</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">这不是考试，而是一场连续双任务协作测评</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-lab-muted md:text-base">
        你不会被考 AI 常识。你会连续进入两个贴近日常的任务，系统关注的是你和 AI 如何协作推进，而不是有没有标准答案。
      </p>
    </section>
  );
}
