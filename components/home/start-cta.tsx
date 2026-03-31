import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface StartCtaProps {
  loading: boolean;
  error: string | null;
  onStart: () => Promise<void>;
}

export function StartCta({ loading, error, onStart }: StartCtaProps) {
  return (
    <Card className="lab-layer-panel p-5">
      <p className="text-sm text-lab-muted">准备好后直接进入完整流程。系统会创建一个固定双任务 session 并自动跳转。</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={loading} onClick={() => void onStart()} variant="primary">
          {loading ? "正在创建..." : "开始完整测试"}
        </Button>
        <span className="type-code text-xs text-lab-muted">fixed flow: apartment {"->"} brand {"->"} result</span>
      </div>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </Card>
  );
}
