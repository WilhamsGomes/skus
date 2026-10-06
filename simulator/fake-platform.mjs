import { createHash, randomBytes } from "node:crypto";
import { EventEmitter } from "node:events";
import { createServer } from "node:http";

export const DEFAULTS = {
  port: 4100,
  total: 20_000,
  webhookOverride: null,
  enrichLimit: 3,
  latencyMinMs: 400,
  latencyMaxMs: 800,
  latencyScale: 1,
  errorRate: 0.1,
  invalidRate: 0.005,
  skuRepeatRate: 0.05,
  duplicateRate: 0.01,
  sendConcurrency: 50,
  networkLatencyMs: 350,
  networkJitter: 0.1,
  ackTargetMs: 600,
  ackTimeoutMs: 3000,
  retryAfterSeconds: 1,
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const id = (prefix) => `${prefix}${randomBytes(12).toString("hex").slice(0, 22)}`;

function hashInt(value, salt) {
  return createHash("sha256").update(`${salt}:${value}`).digest().readUInt32BE(0);
}

export function expectedEnrichment(sku) {
  return {
    price: Math.round((1 + (hashInt(sku, "price") % 300_000) / 100) * 100) / 100,
    stock: hashInt(sku, "stock") % 500,
  };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
}

function shuffle(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "content-type": "application/json", ...headers });
  res.end(JSON.stringify(body));
}

export function startFakePlatform(overrides = {}) {
  const options = { ...DEFAULTS, ...overrides };
  const events = new EventEmitter();
  const clients = new Map();
  const runs = new Map();
  const enrich = { inFlight: 0, maxInFlight: 0, calls: 0, got429: 0, served404: 0, served500: 0 };
  const callsBySku = new Map();
  const errorsBySku = new Map();

  const webhookFor = (client) => options.webhookOverride ?? client.webhook;
  const networkDelay = () =>
    Math.max(0, options.networkLatencyMs * (1 + (Math.random() * 2 - 1) * options.networkJitter));
  const bump = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);

  function createRun(cid) {
    const total = options.total;
    const items = [];
    for (let seq = 0; seq < total; seq++) {
      const source = items.length > 0 && Math.random() < options.skuRepeatRate
        ? items[Math.floor(Math.random() * items.length)]
        : null;
      if (source) {
        items.push({ seq, sku: source.sku, invalid: source.invalid });
        continue;
      }
      const invalid = Math.random() < options.invalidRate;
      items.push({ seq, sku: id(invalid ? "invalid-" : "sku-"), invalid });
    }

    const skuCount = new Map();
    const seqsBySku = new Map();
    for (const item of items) {
      skuCount.set(item.sku, (skuCount.get(item.sku) ?? 0) + 1);
      seqsBySku.set(item.sku, [...(seqsBySku.get(item.sku) ?? []), item.seq]);
    }

    const messages = shuffle(items.map((item) => item.seq));
    const duplicateCandidates = items.filter((item) => skuCount.get(item.sku) === 1 && !item.invalid);
    const duplicateSeqs = new Set();
    const duplicateCount = Math.round(total * options.duplicateRate);
    while (duplicateSeqs.size < Math.min(duplicateCount, duplicateCandidates.length)) {
      duplicateSeqs.add(duplicateCandidates[Math.floor(Math.random() * duplicateCandidates.length)].seq);
    }
    for (const seq of duplicateSeqs) {
      messages.splice(Math.floor(Math.random() * (messages.length + 1)), 0, seq);
    }

    const run = {
      runId: id("run"),
      cid,
      total,
      items,
      skuCount,
      seqsBySku,
      messages,
      duplicateSeqs,
      startedAt: Date.now(),
      dispatch: { sent: 0, acked: 0, failed: [], ackTimes: [], done: false },
      callbacks: 0,
    };
    runs.set(run.runId, run);
    return run;
  }

  async function dispatch(run, webhook) {
    let next = 0;
    let first = true;
    const worker = async () => {
      while (next < run.messages.length) {
        const seq = run.messages[next++];
        const item = run.items[seq];
        const warmup = first;
        first = false;
        const started = performance.now();
        const network = networkDelay();
        run.dispatch.sent++;
        try {
          await sleep(network / 2);
          const response = await fetch(`${webhook}/process`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ run_id: run.runId, seq, sku: item.sku }),
            signal: AbortSignal.timeout(Math.max(1, Math.round(options.ackTimeoutMs - network))),
          });
          await response.arrayBuffer();
          await sleep(network / 2);
          const ms = performance.now() - started;
          if (response.ok) {
            run.dispatch.acked++;
            if (!warmup) run.dispatch.ackTimes.push({ ms, seq });
          } else {
            run.dispatch.failed.push({ seq, status: response.status });
          }
        } catch (error) {
          run.dispatch.failed.push({
            seq,
            status: error?.name === "TimeoutError" ? "timeout" : "network",
            reason: String(error?.cause?.code ?? error?.message ?? error),
          });
        }
      }
    };
    await Promise.all(Array.from({ length: options.sendConcurrency }, worker));
    run.dispatch.done = true;
    events.emit("dispatched", run.runId);
  }

  function buildReport(run, body) {
    const received = new Map();
    const unknown = [];
    for (const entry of Array.isArray(body.result) ? body.result : []) {
      if (typeof entry?.seq === "number" && entry.seq >= 0 && entry.seq < run.total) received.set(entry.seq, entry);
      else unknown.push(entry?.seq ?? null);
    }

    const matched = [];
    const mismatched = [];
    const missing = [];
    for (const item of run.items) {
      const entry = received.get(item.seq);
      if (!entry) {
        missing.push(item.seq);
        continue;
      }
      const expected = item.invalid ? { price: null, stock: null } : expectedEnrichment(item.sku);
      const ok =
        entry.sku === item.sku &&
        (entry.price ?? null) === expected.price &&
        (entry.stock ?? null) === expected.stock;
      (ok ? matched : mismatched).push(item.seq);
    }

    const ackSorted = run.dispatch.ackTimes.map((entry) => entry.ms).sort((a, b) => a - b);
    const worst = run.dispatch.ackTimes.reduce((max, entry) => (!max || entry.ms > max.ms ? entry : max), null);
    const overTarget = run.dispatch.ackTimes.filter((entry) => entry.ms > options.ackTargetMs).map((entry) => entry.seq);
    const p95 = percentile(ackSorted, 95);

    const runSkus = [...run.skuCount.keys()];
    const enrichCalls = runSkus.reduce((sum, sku) => sum + (callsBySku.get(sku) ?? 0), 0);
    const skusWith500 = runSkus.filter((sku) => (errorsBySku.get(sku) ?? 0) > 0);
    const matchedSet = new Set(matched);
    const recovered = skusWith500.filter((sku) => run.seqsBySku.get(sku).every((seq) => matchedSet.has(seq))).length;
    const duplicateExtraCalls = [...run.duplicateSeqs].reduce((sum, seq) => {
      const sku = run.items[seq].sku;
      return sum + Math.max(0, (callsBySku.get(sku) ?? 0) - 1 - (errorsBySku.get(sku) ?? 0));
    }, 0);
    const repeatedSkuCalls = runSkus.reduce((sum, sku) => sum + Math.max(0, run.skuCount.get(sku) - 1), 0);

    const ackPass = p95 !== null && p95 <= options.ackTargetMs && run.dispatch.failed.length === 0;
    const resultPass = missing.length === 0 && mismatched.length === 0 && unknown.length === 0;
    const retryPass = recovered === skusWith500.length;
    const concurrencyPass = enrich.got429 === 0;
    const idempotencyPass = duplicateExtraCalls === 0 && received.size === run.total;
    const breakdown = {
      ack: { earned: ackPass ? 30 : 0, weight: 30 },
      retry: { earned: retryPass ? 15 : 0, weight: 15 },
      result: { earned: resultPass ? 30 : Math.floor((30 * matched.length) / run.total), weight: 30 },
      concurrency: { earned: concurrencyPass ? 10 : 0, weight: 10 },
      idempotency: { earned: idempotencyPass ? 15 : 0, weight: 15 },
    };

    return {
      ok: true,
      simulated: true,
      score: Object.values(breakdown).reduce((sum, entry) => sum + entry.earned, 0),
      attempt: run.callbacks,
      duration_ms: Date.now() - run.startedAt,
      ack: {
        pass: ackPass,
        p50: percentile(ackSorted, 50) === null ? null : Math.round(percentile(ackSorted, 50)),
        p95: p95 === null ? null : Math.round(p95),
        worst: worst ? { ms: Math.round(worst.ms), seq: worst.seq } : null,
        measured: ackSorted.length,
        target_ms: options.ackTargetMs,
        over_target: overTarget.slice(0, 50),
        over_target_count: overTarget.length,
        failed: run.dispatch.failed.slice(0, 50),
        failed_count: run.dispatch.failed.length,
      },
      result: {
        pass: resultPass,
        expected: run.total,
        matched,
        missing: missing.slice(0, 50),
        mismatched: mismatched.slice(0, 50),
        unknown: unknown.slice(0, 50),
        missing_count: missing.length,
        mismatched_count: mismatched.length,
      },
      retry: { pass: retryPass, forced_500: skusWith500.reduce((s, sku) => s + errorsBySku.get(sku), 0), skus_with_500: skusWith500.length, recovered },
      concurrency: { pass: concurrencyPass, limit: options.enrichLimit, got_429: enrich.got429, max_in_flight: enrich.maxInFlight },
      idempotency: { pass: idempotencyPass, duplicate_messages: run.duplicateSeqs.size, extra_calls: duplicateExtraCalls },
      enrich: {
        calls: enrichCalls,
        unique_skus: runSkus.length,
        invalid_skus: run.items.filter((item) => item.invalid).length,
        calls_a_sku_cache_would_save: repeatedSkuCalls,
      },
      breakdown,
    };
  }

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://fake");
      const parts = url.pathname.split("/").filter(Boolean);

      if (req.method === "POST" && url.pathname === "/register") {
        const { name, webhook } = await readJson(req);
        const client = { cid: id("cid"), token: randomBytes(16).toString("hex"), name, webhook };
        try {
          const response = await fetch(`${webhookFor(client)}/check`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token: client.token }),
            signal: AbortSignal.timeout(5000),
          });
          const body = await response.json().catch(() => null);
          if (!response.ok || body?.token !== client.token) {
            return send(res, 422, { error: "handshake_failed", reason: `check responded ${response.status}` });
          }
        } catch (error) {
          return send(res, 422, { error: "handshake_failed", reason: String(error?.message ?? error) });
        }
        clients.set(client.cid, client);
        events.emit("registered", client.cid);
        return send(res, 200, { cid: client.cid, token: client.token });
      }

      if (req.method === "POST" && parts[0] === "burst" && parts[1]) {
        const client = clients.get(parts[1]);
        if (!client || req.headers["x-token"] !== client.token) return send(res, 401, { error: "unauthorized" });
        const run = createRun(client.cid);
        send(res, 200, { run_id: run.runId, total: run.total, started_at: new Date(run.startedAt).toISOString() });
        events.emit("burst", run.runId);
        void dispatch(run, webhookFor(client));
        return;
      }

      if (req.method === "GET" && parts[0] === "enrich" && parts[1]) {
        const client = clients.get(req.headers["x-cid"]);
        if (!client || req.headers["x-token"] !== client.token) return send(res, 401, { error: "unauthorized" });
        const sku = decodeURIComponent(parts[1]);
        enrich.inFlight++;
        enrich.maxInFlight = Math.max(enrich.maxInFlight, enrich.inFlight);
        try {
          if (enrich.inFlight > options.enrichLimit) {
            enrich.got429++;
            return send(res, 429, { error: "too_many_requests" }, { "retry-after": String(options.retryAfterSeconds) });
          }
          enrich.calls++;
          bump(callsBySku, sku);
          const latency = (options.latencyMinMs + Math.random() * (options.latencyMaxMs - options.latencyMinMs)) * options.latencyScale;
          await sleep(latency);
          if (Math.random() < options.errorRate) {
            enrich.served500++;
            bump(errorsBySku, sku);
            return send(res, 500, { error: "transient" });
          }
          if (sku.startsWith("invalid-")) {
            enrich.served404++;
            return send(res, 404, { error: "sku_not_found" });
          }
          return send(res, 200, { sku, ...expectedEnrichment(sku) });
        } finally {
          enrich.inFlight--;
        }
      }

      if (req.method === "POST" && url.pathname === "/callback") {
        const body = await readJson(req);
        const client = clients.get(body.cid);
        if (!client || req.headers["x-token"] !== client.token) return send(res, 401, { error: "unauthorized" });
        const run = runs.get(body.run_id);
        if (!run) return send(res, 404, { error: "run_not_found" });
        run.callbacks++;
        const report = buildReport(run, body);
        events.emit("callback", { runId: run.runId, report });
        return send(res, 200, report);
      }

      send(res, 404, { error: "not_found" });
    } catch (error) {
      send(res, 500, { error: "fake_platform_error", reason: String(error?.message ?? error) });
    }
  });

  return new Promise((resolve) => {
    server.listen(options.port, () =>
      resolve({
        url: `http://localhost:${options.port}`,
        events,
        runs,
        enrich,
        close: () => new Promise((done) => server.close(() => done())),
      }),
    );
  });
}
