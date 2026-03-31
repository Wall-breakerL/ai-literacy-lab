export function Hero() {
  return (
    <section className="lab-layer-panel rounded-2xl p-6 md:p-8">
      <p className="text-xs tracking-[0.08em] text-lab-muted">原型体验 / 内测模式</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-5xl">一个轻量的人机协作流程原型</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-lab-muted md:text-base">
        你将连续完成两个协作任务，体验从任务理解、方案比较到结果复盘的基本流程。当前版本主要用于验证交互与流程设计，不代表最终正式能力。
      </p>
      <p className="mt-3 text-sm text-lab-muted">适合想快速体验协作流程的用户、研究者与产品团队内部测试使用。</p>
    </section>
  );
}
