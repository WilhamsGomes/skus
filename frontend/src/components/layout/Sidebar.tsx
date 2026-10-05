import clsx from "clsx";
import { Activity, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useOverview } from "../../api/hooks";
import { formatInt } from "../../lib/format";
import { ScoreRing } from "../ui/ScoreRing";
import { NAV_ITEMS } from "./navigation";

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { data } = useOverview();

  return (
    <>
      <div
        className={clsx("fixed inset-0 z-30 bg-black/60 lg:hidden", open ? "block" : "hidden")}
        onClick={onClose}
        aria-hidden
      />
      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-line bg-surface transition-transform lg:static lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-lg bg-brand text-white shadow-lg shadow-brand/30">
              <Activity className="size-5" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-wide text-ink">SKU ENRICHMENT</p>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-brand">INTEGRATION OPS</p>
            </div>
          </div>
          <button type="button" className="text-ink-muted lg:hidden" onClick={onClose} aria-label="Fechar menu">
            <X className="size-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-brand text-white shadow-lg shadow-brand/25"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-xl border border-line bg-surface-2 p-4">
          <p className="panel-title">Melhor execução</p>
          <div className="mt-3 flex items-center gap-3">
            <ScoreRing value={data?.deliveries.bestScore ?? null} size={52} />
            <div className="min-w-0 text-xs text-ink-muted">
              <p>
                <span className="font-semibold text-ink">{formatInt(data?.runs.total)}</span> lotes
              </p>
              <p>
                <span className="font-semibold text-ink">{formatInt(data?.deliveries.total)}</span> entregas
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
