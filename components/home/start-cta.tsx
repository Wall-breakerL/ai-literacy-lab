import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface StartCtaProps {
  loading: boolean;
  error: string | null;
  onStart: () => Promise<void>;
}

export function StartCta({ loading, error, onStart }: StartCtaProps) {
  const scrollToFlow = () => {
    document.getElementById("flow-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Card className="lab-layer-panel p-5">
      <p className="text-sm text-lab-muted">建议先查看流程说明。确认后再开始 2 个连续协作任务（约 12-15 分钟）。</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={scrollToFlow} variant="subtle">
          查看流程说明
        </Button>
        <Button disabled={loading} onClick={() => void onStart()} variant="primary">
          {loading ? "正在创建..." : "开始测评"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-lab-muted">开始后系统将自动创建会话，并进入固定双任务流程。</p>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </Card>
  );
}
