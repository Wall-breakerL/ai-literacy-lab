import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ExportActionsProps {
  sessionId: string;
  resultJson: unknown;
  shareCopy: string;
}

export function ExportActions({ sessionId, resultJson, shareCopy }: ExportActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(resultJson, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${sessionId}-result.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareCopy);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card className="lab-layer-panel p-5">
      <h2 className="text-lg font-semibold">导出与分享（高级）</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button onClick={handleDownloadJson} variant="subtle">
          导出 result JSON
        </Button>
        <Button onClick={() => void handleCopy()} variant="ghost">
          {copied ? "已复制分享文案" : "复制简版分享文案"}
        </Button>
      </div>
      <p className="mt-3 rounded border border-lab bg-lab-panel p-2 text-sm text-lab-muted">{shareCopy}</p>
    </Card>
  );
}

