import { CheckCircle2, Link2, ShieldPlus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { useRegister, useRegistrations } from "../api/hooks";
import { Button } from "../components/ui/Button";
import { Panel } from "../components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useToast } from "../components/ui/Toaster";
import { formatDateTime, formatInt } from "../lib/format";

export function RegistrationPage() {
  const { data, isLoading, error } = useRegistrations();
  const register = useRegister();
  const { notify } = useToast();
  const current = data?.find((registration) => registration.current);
  const [name, setName] = useState("");
  const [webhook, setWebhook] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    register.mutate(
      { name: name.trim(), webhook: webhook.trim() },
      {
        onSuccess: (registration) => {
          notify("success", "Webhook registrado", `cid ${registration.cid}`);
          setName("");
          setWebhook("");
        },
        onError: (failure) => notify("error", "Registro recusado", failure.message),
      },
    );
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel title="Registro vigente" className="xl:col-span-5">
          {isLoading && <LoadingState />}
          {error && <ErrorState error={error} />}
          {data && !current && <EmptyState title="Serviço ainda não registrado" />}
          {current && (
            <dl className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-5 text-ok" />
                <span className="font-medium text-ink">{current.name}</span>
              </div>
              <div>
                <dt className="panel-title">cid</dt>
                <dd className="mt-0.5 font-mono text-xs break-all">{current.cid}</dd>
              </div>
              <div>
                <dt className="panel-title">Webhook</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-xs break-all text-ink-muted">
                  <Link2 className="size-3.5 shrink-0" />
                  {current.webhook}
                </dd>
              </div>
              <div className="flex gap-6">
                <div>
                  <dt className="panel-title">Registrado em</dt>
                  <dd className="mt-0.5 text-xs">{formatDateTime(current.registeredAt)}</dd>
                </div>
                <div>
                  <dt className="panel-title">Lotes</dt>
                  <dd className="mt-0.5 text-xs">{formatInt(current.runs)}</dd>
                </div>
              </div>
              <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[11px] text-ink-faint">
                O token fica só no backend: ele autentica /burst, /enrich e /callback e não é exibido aqui.
              </p>
            </dl>
          )}
        </Panel>

        <Panel title="Novo registro" subtitle="POST /register na plataforma" className="xl:col-span-7">
          <form onSubmit={submit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-ink-muted">Nome exibido nos relatórios</span>
              <input
                className="input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Seu nome"
                required
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-ink-muted">Webhook público (HTTPS, sem /check)</span>
              <input
                className="input font-mono text-xs"
                type="url"
                pattern="https://.*"
                value={webhook}
                onChange={(event) => setWebhook(event.target.value)}
                placeholder="https://xxxx.ngrok-free.app"
                required
              />
            </label>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-ink-faint">
                Durante o registro a plataforma chama {"<webhook>"}/check. O backend precisa estar acessível pelo túnel.
              </p>
              <Button type="submit" variant="primary" icon={<ShieldPlus className="size-4" />} loading={register.isPending}>
                Registrar
              </Button>
            </div>
          </form>
        </Panel>
      </div>

      <Panel title="Histórico de registros" bodyClassName="overflow-x-auto p-0">
        {data && data.length === 0 && <EmptyState title="Nenhum registro" />}
        {data && data.length > 0 && (
          <table className="table-base min-w-[760px]">
            <thead>
              <tr>
                <th>Nome</th>
                <th>cid</th>
                <th>Webhook</th>
                <th className="text-right">Lotes</th>
                <th>Registrado em</th>
              </tr>
            </thead>
            <tbody>
              {data.map((registration) => (
                <tr key={registration.cid}>
                  <td>
                    <span className="mr-2">{registration.name}</span>
                    {registration.current && <StatusBadge tone="ok" label="vigente" />}
                  </td>
                  <td className="font-mono text-xs">{registration.cid}</td>
                  <td className="max-w-72 truncate text-xs text-ink-muted" title={registration.webhook}>
                    {registration.webhook}
                  </td>
                  <td className="text-right tabular-nums">{formatInt(registration.runs)}</td>
                  <td className="text-xs text-ink-muted">{formatDateTime(registration.registeredAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
