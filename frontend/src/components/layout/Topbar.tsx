import { useIsFetching, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { LogOut, Menu, RefreshCw, Rocket, UserCircle2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useOverview } from "../../api/hooks";
import { useAuth } from "../../auth/AuthContext";
import { formatTime, shortId } from "../../lib/format";
import { Button } from "../ui/Button";
import { findNavItem } from "./navigation";
import { useRequestBatchAction } from "./useRequestBatchAction";

export function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { pathname } = useLocation();
  const { username, logout } = useAuth();
  const { data, isError, dataUpdatedAt } = useOverview();
  const fetching = useIsFetching();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.refetchQueries({ type: "active" });
  const { requestBatch, isPending } = useRequestBatchAction();
  const page = findNavItem(pathname);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
        <button type="button" className="text-ink-muted lg:hidden" onClick={onOpenMenu} aria-label="Abrir menu">
          <Menu className="size-5" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-bold tracking-tight text-ink uppercase sm:text-xl">
            {page?.label ?? "Detalhe"}
          </h1>
          <p className="truncate text-xs text-ink-faint">{page?.description ?? "Integração de enriquecimento de SKUs"}</p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={clsx(
              "hidden items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs sm:flex",
              isError ? "border-bad/40 text-bad" : "border-line text-ink-muted",
            )}
            title={data?.registration ? `cid ${data.registration.cid}` : "Serviço não registrado"}
          >
            <span
              className={clsx(
                "size-2 rounded-full",
                isError ? "bg-bad" : "bg-ok",
                fetching > 0 && !isError && "animate-pulse",
              )}
            />
            {isError ? "Backend offline" : data?.registration ? `cid ${shortId(data.registration.cid)}` : "Ao vivo"}
          </span>

          <Button
            variant="secondary"
            icon={<RefreshCw className={clsx("size-4", fetching > 0 && "animate-spin")} />}
            onClick={refresh}
            disabled={fetching > 0}
            title={dataUpdatedAt ? `Atualizado às ${formatTime(dataUpdatedAt)}` : "Atualizar"}
            aria-label="Atualizar dados"
          >
            <span className="hidden md:inline">Atualizar</span>
          </Button>

          <Button
            variant="primary"
            icon={<Rocket className="size-4" />}
            loading={isPending}
            onClick={requestBatch}
            disabled={!data?.registration}
            title={data?.registration ? "POST /burst/:cid na plataforma" : "Registre o webhook primeiro"}
          >
            <span className="hidden sm:inline">Solicitar lote</span>
          </Button>

          <div className="flex items-center gap-1 rounded-lg border border-line py-1 pr-1 pl-2.5">
            <UserCircle2 className="size-4 text-ink-muted" />
            <span className="hidden text-xs text-ink-muted md:inline">{username}</span>
            <Button size="sm" variant="ghost" icon={<LogOut className="size-4" />} onClick={logout} aria-label="Sair" />
          </div>
        </div>
      </div>
    </header>
  );
}
