import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, parseEnv } from "node:util";
import { DEFAULTS, startFakePlatform } from "./fake-platform.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const backendDir = join(here, "..", "backend");
const requireFromBackend = createRequire(join(backendDir, "package.json"));

const { values: args } = parseArgs({
  options: {
    skus: { type: "string", default: "20000" },
    "latency-scale": { type: "string", default: "1" },
    "error-rate": { type: "string", default: String(DEFAULTS.errorRate) },
    "invalid-rate": { type: "string", default: String(DEFAULTS.invalidRate) },
    "sku-repeat-rate": { type: "string", default: String(DEFAULTS.skuRepeatRate) },
    "duplicate-rate": { type: "string", default: String(DEFAULTS.duplicateRate) },
    "send-concurrency": { type: "string", default: String(DEFAULTS.sendConcurrency) },
    "network-latency": { type: "string", default: String(DEFAULTS.networkLatencyMs) },
    "network-jitter": { type: "string", default: String(DEFAULTS.networkJitter) },
    "platform-port": { type: "string", default: String(DEFAULTS.port) },
    "backend-port": { type: "string", default: "4001" },
    "database": { type: "string", default: "sku_simulation" },
    "redis-db": { type: "string", default: "1" },
    "keep-data": { type: "boolean", default: false },
    "skip-build": { type: "boolean", default: false },
  },
});

const total = Number(args.skus);
const platformPort = Number(args["platform-port"]);
const backendPort = Number(args["backend-port"]);
const backendUrl = `http://localhost:${backendPort}`;
const logsDir = join(here, "logs");
const reportsDir = join(here, "reports");
mkdirSync(logsDir, { recursive: true });
mkdirSync(reportsDir, { recursive: true });

const env = existsSync(join(backendDir, ".env")) ? parseEnv(readFileSync(join(backendDir, ".env"), "utf8")) : {};
const baseDatabaseUrl = process.env.DATABASE_URL ?? env.DATABASE_URL;
const baseRedisUrl = process.env.REDIS_URL ?? env.REDIS_URL ?? "redis://localhost:6379";
if (!baseDatabaseUrl) throw new Error("DATABASE_URL não encontrado em backend/.env");

const databaseUrl = new URL(baseDatabaseUrl);
const mainDatabase = databaseUrl.pathname.slice(1);
databaseUrl.pathname = `/${args.database}`;
if (args.database === mainDatabase) throw new Error("Use um banco diferente do principal para a simulação");
const redisUrl = new URL(baseRedisUrl);
redisUrl.pathname = `/${args["redis-db"]}`;
if (args["redis-db"] === "0") throw new Error("Use um db do Redis diferente do principal (0) para a simulação");

const credentials = {
  username: process.env.DASHBOARD_USERNAME ?? env.DASHBOARD_USERNAME ?? "admin",
  password: process.env.DASHBOARD_PASSWORD ?? env.DASHBOARD_PASSWORD ?? "admin",
};

const backendEnv = {
  ...process.env,
  PORT: String(backendPort),
  DATABASE_URL: databaseUrl.toString(),
  REDIS_URL: redisUrl.toString(),
  PLATFORM_BASE_URL: `http://localhost:${platformPort}`,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const log = (message) => console.log(`[${new Date().toLocaleTimeString("pt-BR")}] ${message}`);
const fmt = (n) => new Intl.NumberFormat("pt-BR").format(n);
const duration = (ms) => {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}min ${seconds % 60}s`;
};

function run(command, options) {
  const result = spawnSync(command, { stdio: "pipe", shell: true, ...options });
  if (result.status !== 0) {
    throw new Error(`${command} falhou:\n${result.stdout}\n${result.stderr}`);
  }
}

async function resetData() {
  const { Client } = requireFromBackend("pg");
  const client = new Client({ connectionString: databaseUrl.toString() });
  await client.connect();
  await client.query("TRUNCATE callback_deliveries, batch_items, batch_runs, registrations");
  await client.end();

  const Redis = requireFromBackend("ioredis");
  const redis = new Redis(redisUrl.toString());
  await redis.flushdb();
  redis.disconnect();
}

async function api(path, init = {}, token) {
  const response = await fetch(`${backendUrl}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} → ${response.status} ${JSON.stringify(body)}`);
  return body;
}

async function waitForBackend(child) {
  for (let attempt = 0; attempt < 120; attempt++) {
    if (child.exitCode !== null) throw new Error(`Backend encerrou (código ${child.exitCode}); veja simulator/logs/backend.log`);
    try {
      const { accessToken } = await api("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
      return accessToken;
    } catch {
      await sleep(500);
    }
  }
  throw new Error("Backend não respondeu em 60 s; veja simulator/logs/backend.log");
}

let backend;
let platform;

async function shutdown(code) {
  if (backend && backend.exitCode === null) backend.kill();
  if (platform) await platform.close();
  process.exit(code);
}

process.on("SIGINT", () => {
  log("Interrompido. Encerrando backend e plataforma falsa…");
  void shutdown(130);
});

try {
  log(
    `Simulação: ${fmt(total)} SKUs · latência do /enrich ×${args["latency-scale"]} · ` +
      `túnel ${args["network-latency"]} ms ±${Math.round(Number(args["network-jitter"]) * 100)}% · ` +
      `banco ${args.database} · Redis db ${args["redis-db"]}`,
  );

  if (!args["skip-build"]) {
    log("Compilando o backend em backend/.sim-dist…");
    run("npx tsc -p tsconfig.build.json --outDir .sim-dist", { cwd: backendDir });
  }

  log("Aplicando migrations no banco da simulação…");
  run("npx prisma migrate deploy", { cwd: backendDir, env: backendEnv });

  if (!args["keep-data"]) {
    log("Limpando dados de simulações anteriores (somente banco e Redis da simulação)…");
    await resetData();
  }

  platform = await startFakePlatform({
    port: platformPort,
    total,
    webhookOverride: backendUrl,
    latencyScale: Number(args["latency-scale"]),
    errorRate: Number(args["error-rate"]),
    invalidRate: Number(args["invalid-rate"]),
    skuRepeatRate: Number(args["sku-repeat-rate"]),
    duplicateRate: Number(args["duplicate-rate"]),
    sendConcurrency: Number(args["send-concurrency"]),
    networkLatencyMs: Number(args["network-latency"]),
    networkJitter: Number(args["network-jitter"]),
  });
  log(`Plataforma falsa em ${platform.url}`);

  const backendLog = createWriteStream(join(logsDir, "backend.log"));
  backend = spawn(process.execPath, [join(".sim-dist", "main.js")], { cwd: backendDir, env: backendEnv });
  backend.stdout.pipe(backendLog);
  backend.stderr.pipe(backendLog);
  log(`Backend da simulação subindo em ${backendUrl} (log em simulator/logs/backend.log)…`);
  const token = await waitForBackend(backend);

  const registration = await api(
    "/registration",
    { method: "POST", body: JSON.stringify({ name: "Simulação local", webhook: "https://simulador.local" }) },
    token,
  );
  log(`Registrado na plataforma falsa: cid ${registration.cid}`);

  const callback = new Promise((resolve) => platform.events.on("callback", resolve));
  const ticket = await api("/batches", { method: "POST" }, token);
  log(`Lote ${ticket.runId} solicitado com ${fmt(ticket.total)} itens`);

  const startedAt = Date.now();
  let lastFinished = 0;
  let lastAt = startedAt;
  let report;
  const progress = setInterval(async () => {
    try {
      const fakeRun = platform.runs.get(ticket.runId);
      const { data } = await api("/dashboard/runs?limit=1", {}, token);
      const items = data[0]?.items ?? { enriched: 0, failed: 0 };
      const finished = items.enriched + items.failed;
      const now = Date.now();
      const rate = ((finished - lastFinished) / (now - lastAt)) * 1000;
      lastFinished = finished;
      lastAt = now;
      const eta = rate > 0 ? duration(((total - finished) / rate) * 1000) : "—";
      log(
        `enviados ${fmt(fakeRun?.dispatch.acked ?? 0)}/${fmt(fakeRun?.messages.length ?? 0)} · ` +
          `finalizados ${fmt(finished)}/${fmt(total)} · ${rate.toFixed(1)} itens/s · ` +
          `em voo no /enrich ${platform.enrich.inFlight} (máx ${platform.enrich.maxInFlight}) · ` +
          `429 ${platform.enrich.got429} · restante ~${eta}`,
      );
    } catch (error) {
      log(`progresso indisponível: ${error.message}`);
    }
  }, 5000);

  ({ report } = await callback);
  clearInterval(progress);

  const elapsed = Date.now() - startedAt;
  const file = join(reportsDir, `${ticket.runId}.json`);
  writeFileSync(file, JSON.stringify(report, null, 2));

  console.log("");
  console.log("Relatório da simulação (avaliador local, não o oficial)");
  console.log(`  score             ${report.score}/100`);
  console.log(`  duração           ${duration(report.duration_ms)} (${(total / (elapsed / 1000)).toFixed(1)} itens/s)`);
  console.log(`  ACK               p50 ${report.ack.p50} ms · p95 ${report.ack.p95} ms · pior ${report.ack.worst?.ms} ms · falhas ${report.ack.failed_count}`);
  console.log(`  resultado         ${fmt(report.result.matched.length)}/${fmt(report.result.expected)} corretos · ${report.result.missing_count} faltando · ${report.result.mismatched_count} divergentes`);
  console.log(`  retry             ${report.retry.forced_500} erros 500 em ${report.retry.skus_with_500} SKUs · ${report.retry.recovered} recuperados`);
  console.log(`  concorrência      máx ${report.concurrency.max_in_flight} em voo · ${report.concurrency.got_429} respostas 429`);
  console.log(`  idempotência      ${report.idempotency.duplicate_messages} mensagens duplicadas · ${report.idempotency.extra_calls} chamadas extras`);
  console.log(`  /enrich           ${fmt(report.enrich.calls)} chamadas para ${fmt(report.enrich.unique_skus)} SKUs únicos · cache por SKU evitaria ${fmt(report.enrich.calls_a_sku_cache_would_save)}`);
  console.log(`  arquivo           ${file}`);

  await shutdown(0);
} catch (error) {
  console.error(`\nFalha na simulação: ${error.message}`);
  await shutdown(1);
}
