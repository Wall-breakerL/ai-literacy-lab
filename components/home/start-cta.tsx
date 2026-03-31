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
      <p className="text-sm text-lab-muted">当前为原型模式。你可以直接进入流程体验，结果用于交互验证与内部测试参考。</p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button disabled={loading} onClick={() => void onStart()} variant="primary">
          {loading ? "正在创建..." : "进入原型体验"}
        </Button>
      </div>
      <p className="mt-3 text-xs text-lab-muted">如果会话创建失败，可稍后重试或返回首页重新开始。</p>
      {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
    </Card>
  );
}
