// EARS の対応表（07_qa/test-plan/ears-test-mapping.json）→ apps/api/test/generated/<slug>.test.ts。1 文 = 1 test（名前は対応表の test_function）。
// 検査は種類ごとに固定：ok（2xx）／shape（応答の形）／rejected_401／rejected_403（副作用なし）／conflict（冪等）／rejected_422（正規化してから判定）／rate_limited（retry_after_sec）／upstream_failed（副作用は記録の前・502 で記録しない）／not_found
import { mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.cwd();
const OUTDIR = "apps/api/test/generated";

const kindOf = (fn) => {
  const m = /_(ok|shape|rejected_401|rejected_403|rejected_422|conflict|rate_limited|upstream_failed|not_found)(?:_\d+)?$/.exec(fn);
  return m ? m[1] : "ok";
};
const q = (s) => JSON.stringify(s);
const WHO = `const who = e.auth === "ops" ? "ops" : "boss";`;
const CASE = {
  ok: () => `${WHO} const r = await h.call(e, who, await args(h, e, who)); expect([200, 201]).toContain(r.status); const b = (await r.json()) as { data: unknown }; expect(b.data).toBeDefined(); if (e.kind === "create") expect((b.data as { id: string }).id).toBeTruthy();`,
  shape: () => `${WHO} const r = await h.call(e, who, await args(h, e, who)); const b = (await r.json()) as Record<string, unknown>; if (r.status < 300) { expect(b).toHaveProperty("data"); if (e.kind === "list") { expect(Array.isArray(b["data"])).toBe(true); expect(b["meta"]).toHaveProperty("limit"); } } else { expect(b).toHaveProperty("error"); expect(b).toHaveProperty("code"); }`,
  rejected_401: () => `const a = await args(h, e, "boss"); const before = await h.count(e.table); const r = await h.call(e, "anon", a); expect(r.status).toBe(e.auth === "public" ? 200 : 401); if (e.auth !== "public") { expect(((await r.json()) as { code: string }).code).toBe("UNAUTHENTICATED"); expect(await h.count(e.table)).toBe(before); }`,
  rejected_403: () => `const a = await args(h, e, e.auth === "ops" ? "ops" : "boss"); const before = await h.count(e.table); const who = e.auth === "ops" ? "boss" : e.kind === "list" || e.kind === "get" ? "opsB" : "staff"; const r = await h.call(e, who, a); expect([403, 404]).toContain(r.status); expect(await h.count(e.table)).toBe(before);`,
  conflict: () => `if (e.kind !== "create") return; ${WHO} const a = await args(h, e, who); const k = { headers: { "idempotency-key": "k-" + Math.random().toString(36).slice(2) } }; const r1 = await h.call(e, who, { ...a, ...k }); expect([200, 201]).toContain(r1.status); const before = await h.count(e.table); const r2 = await h.call(e, who, { ...a, ...k }); expect(r2.status).toBe(r1.status); expect(await r2.json()).toEqual(await r1.clone().json()); expect(await h.count(e.table)).toBe(before); const r3 = await h.call(e, who, { ...a, body: { ...(a.body as object), __changed: 1 }, ...k }); expect(r3.status).toBe(409);`,
  rejected_422: () => `${WHO} if (e.kind === "list") { const r = await h.call(e, who, { query: { limit: "0" } }); expect(r.status).toBe(422); return; } if (e.kind === "get" || e.kind === "delete") { const r = await h.call(e, who, { id: "not-a-uuid" }); expect(r.status).toBe(422); return; } const a = await args(h, e, who); const before = await h.count(e.table); const r = await h.call(e, who, { ...a, body: { __unknown_field: "x", id: 12345 } }); expect(r.status).toBe(422); const b = (await r.json()) as { code: string; details: unknown[] }; expect(b.code).toBe("VALIDATION_ERROR"); expect(b.details.length).toBeGreaterThan(0); expect(await h.count(e.table)).toBe(before); const r2 = await h.call(e, who, { ...a, body: "{not json" }); expect(r2.status).toBe(422);`,
  rate_limited: (op) => `${WHO} h.limits[${q(op)}] = 2; const a = await args(h, e, who); await h.call(e, who, a); await h.call(e, who, a); const before = await h.count(e.table); const r = await h.call(e, who, a); expect(r.status).toBe(429); const b = (await r.json()) as { code: string; retry_after_sec: number }; expect(b.code).toBe("RATE_LIMITED"); expect(b.retry_after_sec).toBeGreaterThan(0); expect(await h.count(e.table)).toBe(before); delete h.limits[${q(op)}];`,
  upstream_failed: (op) => `${WHO} const a = await args(h, e, who); h.hooks[${q(op)}] = { effect: async () => ({ status: "failed", reason: "外部が完了信号を出さなかった", handoff: "人が確認する" }) }; const before = await h.count(e.table); const r = await h.call(e, who, a); expect(r.status).toBe(502); const b = (await r.json()) as { code: string; handoff: string }; expect(b.code).toBe("EXTERNAL_FAILED"); expect(b.handoff).toBeTruthy(); expect(await h.count(e.table)).toBe(before); delete h.hooks[${q(op)}];`,
  not_found: () => `if (e.kind === "list" || e.kind === "create") return; ${WHO} const r = await h.call(e, who, { ...(await args(h, e, who)), id: "0193c5a0-0000-7000-8000-000000000000" }); expect(r.status).toBe(404);`,
};

export function gen(root = ROOT) {
  const m = JSON.parse(readFileSync(join(root, "07_qa/test-plan/ears-test-mapping.json"), "utf8")).mappings;
  const eps = JSON.parse(readFileSync(join(root, "08_api/endpoints.json"), "utf8")).endpoints;
  const opOf = new Map(eps.map((e) => [`${e.method} ${e.path}`, e.implementation_path.split("::")[1]]));
  // まだ作っていない口（D-128.113）：表の素の読み書きで表が DB にあるもの、または hooks に振る舞いがあるものだけが「作った口」
  const repoSrc = readFileSync(join(root, "packages/db/src/repository.ts"), "utf8");
  const tables = new Set([...repoSrc.slice(repoSrc.indexOf("export const TABLES"), repoSrc.indexOf("] as const")).matchAll(/"([a-z_]+)"/g)].map((x) => x[1]));
  const hookDir = join(root, "apps/api/src/hooks");
  const hooked = new Set(readdirSync(hookDir).filter((f) => f.endsWith(".ts")).flatMap((f) => [...readFileSync(join(hookDir, f), "utf8").matchAll(/^\s{2,6}([a-z][A-Za-z]+): \{/gm)].map((x) => x[1])));
  const built = (e) => hooked.has(e.implementation_path.split("::")[1]) || (tables.has(e.table) && (e.path === `/api/v1/${e.table}` || e.path === `/api/v1/${e.table}/:id`));
  const epOf = new Map(eps.map((e) => [`${e.method} ${e.path}`, e]));
  const byFile = new Map();
  for (const x of m) byFile.set(x.test_file, [...(byFile.get(x.test_file) ?? []), x]);
  mkdirSync(join(root, OUTDIR), { recursive: true });
  for (const f of readdirSync(join(root, OUTDIR))) if (f.endsWith(".test.ts")) unlinkSync(join(root, OUTDIR, f));
  let n = 0;
  for (const [file, rows] of byFile) {
    const op = opOf.get(rows[0].endpoint);
    if (!op) continue;
    const isBuilt = built(epOf.get(rows[0].endpoint));
    const tests = isBuilt ? [] : [`  it("not_implemented_501", async () => {\n    // まだ作っていない口は、正しい役の人が呼んでも 501 で止まり、何も書かない（fail-closed・D-128.113）\n    const who = e.auth === "ops" ? "ops" : "boss";\n    if (e.auth === "public" || e.auth === "client" || e.auth === "device") return;\n    const before = await h.count("audit_events");\n    const r = await h.call(e, who, { ...(e.path.includes(":id") ? { id: "0193c5a0-0000-7000-8000-000000000000" } : {}), ...(e.method === "POST" || e.method === "PATCH" ? { body: {} } : {}) });\n    expect(r.status).toBe(501);\n    expect(await h.count("audit_events")).toBe(before);\n  });`];
    tests.push(...rows.map((x) => {
      n++;
      if (!isBuilt) return `  it.todo(${q(x.test_function + "（まだ作っていない口。作ったら本物の試験になる）")});`;
      const kind = kindOf(x.test_function);
      const skip = (kind === "rate_limited" && false) ? ".skip" : "";
      return `  it${skip}(${q(x.test_function)}, async () => {\n    // ${x.ears_text.replace(/\n/g, " ")}\n    ${CASE[kind](op)}\n  });`;
    }));
    const src = `// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。${rows[0].endpoint}
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
import { args } from "../args.js";

const e = endpointOf(${q(op)});
let h: Harness;
beforeAll(async () => {
  h = await makeHarness();
});
afterAll(async () => {
  await h.close();
});
describe(${q(rows[0].endpoint)}, () => {
${tests.join("\n")}
});
`;
    writeFileSync(join(root, file), src);
  }
  return { files: byFile.size, tests: n };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const r = gen();
  console.log(`[ears tests] ${r.files} files / ${r.tests} tests → ${OUTDIR}`);
}
