import { Injectable } from "@nestjs/common";
import { RedisService } from "../../../shared/infra/redis/redis.service";

const SCAN_LIMIT = 20_000;

export interface KeyGroup {
  readonly prefix: string;
  readonly keys: number;
}

export interface CacheSnapshot {
  readonly version: string | null;
  readonly mode: string | null;
  readonly uptimeSeconds: number | null;
  readonly connectedClients: number | null;
  readonly usedMemoryBytes: number | null;
  readonly usedMemoryHuman: string | null;
  readonly peakMemoryHuman: string | null;
  readonly maxMemoryBytes: number | null;
  readonly opsPerSecond: number | null;
  readonly totalCommands: number | null;
  readonly keyspaceHits: number | null;
  readonly keyspaceMisses: number | null;
  readonly hitRate: number | null;
  readonly totalKeys: number;
  readonly keysScanned: number;
  readonly keyGroups: KeyGroup[];
}

@Injectable()
export class CacheQuery {
  constructor(private readonly redis: RedisService) {}

  async snapshot(): Promise<CacheSnapshot> {
    const [info, totalKeys, groups] = await Promise.all([
      this.redis.info(),
      this.redis.dbsize(),
      this.keyGroups(),
    ]);
    const fields = parseInfo(info);
    const hits = toNumber(fields.keyspace_hits);
    const misses = toNumber(fields.keyspace_misses);
    const lookups = (hits ?? 0) + (misses ?? 0);

    return {
      version: fields.redis_version ?? null,
      mode: fields.redis_mode ?? null,
      uptimeSeconds: toNumber(fields.uptime_in_seconds),
      connectedClients: toNumber(fields.connected_clients),
      usedMemoryBytes: toNumber(fields.used_memory),
      usedMemoryHuman: fields.used_memory_human ?? null,
      peakMemoryHuman: fields.used_memory_peak_human ?? null,
      maxMemoryBytes: toNumber(fields.maxmemory),
      opsPerSecond: toNumber(fields.instantaneous_ops_per_sec),
      totalCommands: toNumber(fields.total_commands_processed),
      keyspaceHits: hits,
      keyspaceMisses: misses,
      hitRate: lookups > 0 ? (hits ?? 0) / lookups : null,
      totalKeys,
      keysScanned: groups.scanned,
      keyGroups: groups.groups,
    };
  }

  private async keyGroups(): Promise<{ scanned: number; groups: KeyGroup[] }> {
    const counts = new Map<string, number>();
    let scanned = 0;
    let cursor = "0";
    do {
      const [next, keys] = await this.redis.scan(cursor, "COUNT", 1000);
      cursor = next;
      for (const key of keys) {
        const prefix = key.split(":").slice(0, 2).join(":");
        counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
      }
      scanned += keys.length;
    } while (cursor !== "0" && scanned < SCAN_LIMIT);

    const groups = [...counts.entries()]
      .map(([prefix, keys]) => ({ prefix, keys }))
      .sort((a, b) => b.keys - a.keys);
    return { scanned, groups };
  }
}

export function parseInfo(info: string): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const line of info.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf(":");
    if (separator > 0) fields[line.slice(0, separator)] = line.slice(separator + 1);
  }
  return fields;
}

function toNumber(value: string | undefined): number | null {
  if (value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
