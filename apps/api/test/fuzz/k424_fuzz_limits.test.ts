// K-424 の試験：契約 fuzz（G36）の的だけ、口の回数の上限を大きくし、入口の上限に当たった回を記録する（apps/api/test/fuzz/limits.ts）。
//   行 ID は K424-FZ-NNN（11_tickets/K-424.md の行の表と 1 対 1）。本物の DB の上の試験の土台（makeHarness）を使う行は FZ-003・FZ-004
import { mkdtempSync, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENDPOINTS } from "@kaname/contracts";
import { makeHarness, endpointOf } from "../harness.js";
import { FUZZ_PER_MINUTE, applyFuzzLimits, fuzzLimits, isEntryLimited, recordEntryLimited } from "./limits.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("K-424 的の上限", () => {
  it("K424-FZ-001 全部の口に、契約の一番大きい上限よりずっと大きい上限が入る", () => {
    const t = fuzzLimits(ENDPOINTS);
    expect(Object.keys(t).sort()).toEqual(ENDPOINTS.map((e) => e.operationId).sort());
    for (const e of ENDPOINTS) expect(t[e.operationId], e.operationId).toBe(FUZZ_PER_MINUTE);
    const maxContract = Math.max(...ENDPOINTS.map((e) => e.rateLimit.perMinute));
    expect(FUZZ_PER_MINUTE).toBeGreaterThanOrEqual(maxContract * 1000);
  });

  it("K424-FZ-002 契約の上限の値は変わらず、毎回新しい表を返す", () => {
    const before = ENDPOINTS.map((e) => [e.operationId, e.rateLimit.perMinute]);
    const a = fuzzLimits(ENDPOINTS);
    const b = fuzzLimits(ENDPOINTS);
    expect(a).not.toBe(b);
    expect(ENDPOINTS.map((e) => [e.operationId, e.rateLimit.perMinute])).toEqual(before);
    const lim: Record<string, number> = { other: 3 };
    applyFuzzLimits({ limits: lim }, ENDPOINTS);
    expect(lim["other"]).toBe(3);
    expect(lim["getServiceStatus"]).toBe(FUZZ_PER_MINUTE);
  });

  it("K424-FZ-003 的の上限を入れた土台では、契約で 1 分 10 回の口を 11 回叩いても 429 にならない", async () => {
    const h = await makeHarness();
    try {
      applyFuzzLimits(h, ENDPOINTS);
      const e = endpointOf("getServiceStatus");
      expect(e.rateLimit.perMinute).toBe(10);
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) statuses.push((await h.call(e, "anon")).status);
      expect(statuses).toHaveLength(11);
      expect(statuses.filter((s) => s === 429)).toEqual([]);
    } finally {
      await h.close();
    }
  });

  it("K424-FZ-004 上限を入れない土台（本番と同じ契約の上限）では、11 回目が 429・RATE_LIMITED になる", async () => {
    const h = await makeHarness();
    try {
      const e = endpointOf("getServiceStatus");
      for (let i = 0; i < 10; i++) expect((await h.call(e, "anon")).status, `${i + 1} 回目`).not.toBe(429);
      const r = await h.call(e, "anon");
      expect(r.status).toBe(429);
      expect(((await r.json()) as { code: string }).code).toBe("RATE_LIMITED");
    } finally {
      await h.close();
    }
  });

  it("K424-FZ-005 的のサーバーは、上限の差し替えと入口の 429 の記録を差して立つ", () => {
    const src = readFileSync(join(HERE, "server.ts"), "utf8");
    expect(src).toContain('from "./limits.js"');
    expect(src).toMatch(/applyFuzzLimits\(h,\s*ENDPOINTS\)/);
    expect(src).toMatch(/fetch:\s*recordEntryLimited\(h\.fetch,\s*process\.env\["FUZZ_LIMITED"\]\)/);
    // 差し替えは hooks を差した後・サーバーを立てる前
    expect(src.indexOf("applyFuzzLimits(h")).toBeGreaterThan(src.indexOf('buildHooks(HOOK_MODULES, fuzzDeps, "fuzz")'));
    expect(src.indexOf("applyFuzzLimits(h")).toBeLessThan(src.indexOf("const srv = serve("));
  });
});

describe("K-424 入口の 429 の見分けと記録", () => {
  it("K424-FZ-006 入口の 429（RATE_LIMITED）だけを数え、ほかの 429・200・JSON でない 429 は数えない。体はあとで読める", async () => {
    const limited = json(429, { code: "RATE_LIMITED", retry_after_sec: 60 });
    expect(await isEntryLimited(limited)).toBe(true);
    expect(((await limited.json()) as { code: string }).code).toBe("RATE_LIMITED");
    expect(await isEntryLimited(json(429, { code: "E-AUTH-002" }))).toBe(false);
    expect(await isEntryLimited(json(200, { code: "RATE_LIMITED" }))).toBe(false);
    expect(await isEntryLimited(new Response("Too Many Requests", { status: 429 }))).toBe(false);
  });

  it("K424-FZ-007 包んだ fetch は、入口の 429 の要求だけを「方法 道」の 1 行で記録し、答えはそのまま返す", async () => {
    const log = join(mkdtempSync(join(tmpdir(), "k424-")), "limited.log");
    const inner = (req: Request) =>
      new URL(req.url).pathname.endsWith("/busy")
        ? json(429, { code: "RATE_LIMITED", retry_after_sec: 60 })
        : json(200, { data: { ok: true } });
    const f = recordEntryLimited(inner, log);
    const a = await f(new Request("http://127.0.0.1/api/v1/busy?x=1", { method: "POST" }));
    const b = await f(new Request("http://127.0.0.1/api/v1/fine"));
    expect(a.status).toBe(429);
    expect(((await a.json()) as { code: string }).code).toBe("RATE_LIMITED");
    expect(b.status).toBe(200);
    expect(((await b.json()) as { data: { ok: boolean } }).data.ok).toBe(true);
    expect(readFileSync(log, "utf8")).toBe("POST /api/v1/busy\n");
  });

  it("K424-FZ-008 記録の置き場が無い（手で的を立てた）ときは何も書かず、答えはそのまま返す", async () => {
    // 置き場が無いときに、今いるフォルダへ「undefined」などの名前で書く誤りを見る（書き先になりうる所の前後を比べる）
    const cwd = process.cwd();
    const before = readdirSync(cwd).sort();
    const f = recordEntryLimited(() => json(429, { code: "RATE_LIMITED" }), undefined);
    const r = await f(new Request("http://127.0.0.1/api/v1/busy"));
    expect(r.status).toBe(429);
    expect(((await r.json()) as { code: string }).code).toBe("RATE_LIMITED");
    const g = recordEntryLimited(() => json(429, { code: "RATE_LIMITED" }), "");
    expect((await g(new Request("http://127.0.0.1/api/v1/busy"))).status).toBe(429);
    expect(readdirSync(cwd).sort()).toEqual(before);
    expect(existsSync(join(cwd, "undefined"))).toBe(false);
  });

  it("K424-FZ-009 本番のコード（apps/api/src）は的の上限の差し替えを読まない", () => {
    const src = join(HERE, "..", "..", "src");
    const hits: string[] = [];
    const walk = (d: string): void => {
      for (const n of readdirSync(d)) {
        const p = join(d, n);
        if (statSync(p).isDirectory()) walk(p);
        else if (
          /\.tsx?$/.test(n) &&
          /fuzz\/limits|FUZZ_PER_MINUTE|applyFuzzLimits|fuzzLimits/.test(readFileSync(p, "utf8"))
        )
          hits.push(p);
      }
    };
    walk(src);
    expect(hits).toEqual([]);
  });
});
