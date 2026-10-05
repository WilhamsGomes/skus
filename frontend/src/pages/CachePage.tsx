import { Activity, Clock, Cpu, Database, KeyRound, Target, Users } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useCache } from "../api/hooks";
import { KpiCard } from "../components/ui/KpiCard";
import { Panel } from "../components/ui/Panel";
import { EmptyState, ErrorState, LoadingState } from "../components/ui/States";
import { axisProps, CHART, tooltipStyle } from "../lib/chart";
import { DASH, formatInt, formatPercent, formatUptime } from "../lib/format";

const PREFIX_INFO: Record<string, string> = {
  "bull:enrichment": "Fila de enriquecimento (jobs, listas e metadados)",
  "bull:callback": "Fila de callback",
};

export function CachePage() {
  const { data, isLoading, error } = useCache();

  if (isLoading) return <LoadingState />;
  if (error || !data) return <ErrorState error={error} />;

  const groups = data.keyGroups.slice(0, 12);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 min-[1700px]:grid-cols-6">
        <KpiCard
          label="Redis"
          value={data.version ?? DASH}
          hint={data.mode ?? undefined}
          icon={<Database className="size-5" />}
          tone="bad"
        />
        <KpiCard
          label="Uptime"
          value={formatUptime(data.uptimeSeconds)}
          icon={<Clock className="size-5" />}
          tone="accent"
        />
        <KpiCard
          label="Memória usada"
          value={data.usedMemoryHuman ?? DASH}
          hint={`pico ${data.peakMemoryHuman ?? DASH}`}
          icon={<Cpu className="size-5" />}
          tone="violet"
        />
        <KpiCard
          label="Clientes conectados"
          value={formatInt(data.connectedClients)}
          hint="API, filas e workers"
          icon={<Users className="size-5" />}
          tone="brand"
        />
        <KpiCard
          label="Operações/s"
          value={formatInt(data.opsPerSecond)}
          hint={`${formatInt(data.totalCommands)} comandos no total`}
          icon={<Activity className="size-5" />}
          tone="ok"
        />
        <KpiCard
          label="Hit rate"
          value={formatPercent(data.hitRate)}
          hint={`${formatInt(data.keyspaceHits)} hits · ${formatInt(data.keyspaceMisses)} misses`}
          icon={<Target className="size-5" />}
          tone="warn"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Panel
          title="Chaves por prefixo"
          subtitle={`${formatInt(data.totalKeys)} chaves no banco · ${formatInt(data.keysScanned)} analisadas`}
          className="xl:col-span-7"
        >
          {groups.length === 0 ? (
            <EmptyState title="Nenhuma chave" />
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={groups} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid stroke={CHART.grid} horizontal={false} />
                  <XAxis type="number" {...axisProps} allowDecimals={false} />
                  <YAxis type="category" dataKey="prefix" {...axisProps} width={150} />
                  <Tooltip {...tooltipStyle} />
                  <Bar dataKey="keys" name="Chaves" fill={CHART.brand} radius={[0, 4, 4, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="O que fica no Redis" className="xl:col-span-5" bodyClassName="p-0">
          <table className="table-base">
            <thead>
              <tr>
                <th>Prefixo</th>
                <th className="text-right">Chaves</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((group) => (
                <tr key={group.prefix}>
                  <td>
                    <p className="font-mono text-xs">
                      <KeyRound className="mr-1.5 inline size-3 text-ink-faint" />
                      {group.prefix}
                    </p>
                    <p className="text-[11px] text-ink-faint">{PREFIX_INFO[group.prefix] ?? "Outras chaves"}</p>
                  </td>
                  <td className="text-right tabular-nums">{formatInt(group.keys)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-3 text-xs text-ink-muted">
            O Redis guarda só o estado das filas. O resultado dos itens e os relatórios ficam no PostgreSQL.
          </p>
        </Panel>
      </div>
    </div>
  );
}
