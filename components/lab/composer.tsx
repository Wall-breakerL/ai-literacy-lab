import { useState } from "react";
import { Button } from "@/components/ui/button";

interface ComposerProps {
  disabled?: boolean;
  onSubmit: (message: string) => Promise<void>;
}

export function Composer({ disabled, onSubmit }: ComposerProps) {
  const [value, setValue] = useState("");

  const handleSubmit = async () => {
    const message = value.trim();
    if (!message) return;
    await onSubmit(message);
    setValue("");
  };

  return (
    <div className="rounded-xl border border-lab bg-lab-panel p-3">
      <textarea
        className="h-24 w-full rounded-lg border border-lab bg-lab-card px-3 py-2 text-sm outline-none ring-cyan-300/30 transition focus:ring-2"
        disabled={disabled}
        onChange={(event) => setValue(event.target.value)}
        placeholder="写下你的判断、证据和下一步..."
        value={value}
      />
      <div className="mt-3 flex flex-col items-end gap-1">
        <Button disabled={disabled} onClick={() => void handleSubmit()} variant="primary">
          发送消息
        </Button>
        <p className="text-[11px] text-lab-muted">将本条内容发送给协作助手。</p>
      </div>
    </div>
  );
}
