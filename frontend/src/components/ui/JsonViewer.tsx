import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function JsonViewer({ value, maxHeight = "max-h-96" }: { value: unknown; maxHeight?: string }) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(value, null, 2) ?? "null";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={copy}
        className="absolute top-2 right-2 rounded-md border border-line bg-surface-2 p-1.5 text-ink-muted hover:text-ink"
        aria-label="Copiar JSON"
      >
        {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      </button>
      <pre
        className={`${maxHeight} overflow-auto rounded-lg border border-line bg-canvas p-4 font-mono text-xs leading-relaxed text-ink-muted`}
      >
        {text}
      </pre>
    </div>
  );
}
