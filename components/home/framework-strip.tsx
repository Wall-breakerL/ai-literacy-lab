import { Card } from "@/components/ui/card";

export function FrameworkStrip() {
  return (
    <section>
      <Card className="lab-layer-panel p-4">
        <p className="text-xs text-lab-muted">补充说明</p>
        <p className="mt-2 text-sm leading-6 text-lab-muted">
          当前结果会参考 AI-MBTI 与 FAA 两个框架生成解释。它们用于帮助你理解协作过程，不代表稳定人格或正式评估结论。
        </p>
      </Card>
    </section>
  );
}
