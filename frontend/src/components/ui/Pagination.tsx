import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatInt } from "../../lib/format";
import { Button } from "./Button";

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  onChange: (offset: number) => void;
}

export function Pagination({ total, limit, offset, onChange }: PaginationProps) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-2.5 text-xs text-ink-muted">
      <span>
        {formatInt(from)}–{formatInt(to)} de {formatInt(total)}
      </span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="ghost"
          icon={<ChevronLeft className="size-4" />}
          disabled={offset === 0}
          onClick={() => onChange(Math.max(0, offset - limit))}
          aria-label="Página anterior"
        />
        <Button
          size="sm"
          variant="ghost"
          icon={<ChevronRight className="size-4" />}
          disabled={to >= total}
          onClick={() => onChange(offset + limit)}
          aria-label="Próxima página"
        />
      </div>
    </div>
  );
}
