export function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-2 rounded-lg border border-lab bg-lab-panel px-3 py-2 text-xs text-lab-muted">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:120ms]" />
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-300 [animation-delay:240ms]" />
      Agent A 正在组织回应...
    </div>
  );
}
