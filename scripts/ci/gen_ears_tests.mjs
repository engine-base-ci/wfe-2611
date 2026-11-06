// EARS の対応表（07_qa/test-plan/ears-test-mapping.json）→ apps/api/test/generated/<slug>.test.ts。1 文 = 1 test（名前は対応表の test_function）。
// 検査は種類ごとに固定：ok（2xx）／shape（応答の形）／rejected_401／rejected_403（副作用なし）／terms_pending（同意し直しの 403・K-53）／conflict（冪等）／rejected_422（正規化してから判定）／rate_limited（retry_after_sec）／upstream_failed（副作用は記録の前・502 で記録しない）／not_found
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
const ROOT = process.cwd();
const OUTDIR = "apps/api/test/generated";

const kindOf = (fn) => {
  const m = /_(ok|shape|rejected_401|rejected_403|rejected_422|terms_pending|conflict|rate_limited|upstream_failed|not_found)(?:_\d+)?$/.exec(fn);
  return m ? m[1] : "ok";
};
const q = (s) => JSON.stringify(s);
const WHO = `const who = e.auth === "ops" ? "ops" : "boss";`;
const CASE = {
  ok: () => `${WHO} const r = await h.call(e, who, await args(h, e, who)); expect([200, 201]).toContain(r.status); const b = (await r.json()) as { data: unknown }; expect(b.data).toBeDefined(); if (e.kind === "create") expect((b.data as { id: string }).id).toBeTruthy();`,
  shape: () => `${WHO} const r = await h.call(e, who, await args(h, e, who)); const b = (await r.json()) as Record<string, unknown>; if (r.status < 300) { expect(b).toHaveProperty("data"); if (e.kind === "list") { expect(Array.isArray(b["data"])).toBe(true); expect(b["meta"]).toHaveProperty("limit"); } } else { expect(b).toHaveProperty("error"); expect(b).toHaveProperty("code"); }`,
  rejected_401: () => `const a = await args(h, e, "boss"); const before = await h.count(e.table); const r = await h.call(e, "anon", a); expect(r.status).toBe(e.auth === "public" ? 200 : 401); if (e.auth !== "public") { expect(((await r.json()) as { code: string }).code).toBe("UNAUTHENTICATED"); expect(await h.count(e.table)).toBe(before); }`,
  // 本人の口（self）の作成は、誰でも自分の分は作れる。403 の場面は「他人を持ち主にして作れない」（持ち主は呼んだ人になる・K-17）
  rejected_403: () => `if (e.kind === "create" && e.perm.word === "self") { const a = await args(h, e, "staff"); const r = await h.call(e, "staff", a); expect([201, 403, 404]).toContain(r.status); if (r.status === 201) { const d = ((await r.json()) as { data: Record<string, unknown> }).data; for (const c of ["owner_member_id", "opened_by_member_id", "member_id", "requested_by", "uploaded_by"]) if (c in d) expect(d[c], "持ち主は呼んだ人").toBe(h.S.staffA); } return; } const a = await args(h, e, e.auth === "ops" ? "ops" : "boss"); const before = await h.count(e.table); const who = e.auth === "ops" ? "boss" : e.kind === "list" || e.kind === "get" ? "opsB" : "staff"; const r = await h.call(e, who, a); expect([403, 404]).toContain(r.status); expect(await h.count(e.table)).toBe(before);`,
  // 同意し直し（K-53）：印の立ったセッション（harness の who の pending）で呼ぶと 403・E-AUTH-010。表の行の数は変わらない（副作用なし）
  terms_pending: () => `const a = await args(h, e, e.auth === "ops" ? "ops" : "boss"); const before = await h.count(e.table); const r = await h.call(e, "pending", a); expect(r.status).toBe(403); expect(((await r.json()) as { code: string }).code).toBe("E-AUTH-010"); expect(await h.count(e.table)).toBe(before);`,
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
  const okPath = join(root, "08_api/generic-ok.json");
  const genericOk = new Set(existsSync(okPath) ? JSON.parse(readFileSync(okPath, "utf8")).ok.map((x) => x.op) : []);
  const built = (e) => hooked.has(e.implementation_path.split("::")[1]) || (tables.has(e.table) && genericOk.has(`${e.method} ${e.path}`));
  const epOf = new Map(eps.map((e) => [`${e.method} ${e.path}`, e]));
  // 表の素の読み書き（generic）の口：authz.test.ts の 501 の確かめに入らない（packages/contracts/src/registry.ts が正本）
  const regSrc = readFileSync(join(root, "packages/contracts/src/registry.ts"), "utf8");
  const genericSet = new Set([...regSrc.matchAll(/"method": "(\w+)",\s*"path": "([^"]+)"[^{}]*?"generic": true/gs)].map((x) => `${x[1]} ${x[2]}`));
  // 本物の試験が別のファイルにある口（本物のログインの部品が要る など）。理由が空の行は使わない
  const elsePath = join(root, "07_qa/test-plan/ears-elsewhere.json");
  const elsewhere = new Map(
    Object.entries(existsSync(elsePath) ? JSON.parse(readFileSync(elsePath, "utf8")).ops : {}).filter(([, v]) => String(v.reason ?? "").trim() && v.file),
  );
  const byFile = new Map();
  for (const x of m) byFile.set(x.test_file, [...(byFile.get(x.test_file) ?? []), x]);
  mkdirSync(join(root, OUTDIR), { recursive: true });
  for (const f of readdirSync(join(root, OUTDIR))) if (f.endsWith(".test.ts")) unlinkSync(join(root, OUTDIR, f));
  let n = 0;
  for (const [file, rows] of byFile) {
    const op = opOf.get(rows[0].endpoint);
    if (!op) continue;
    const isBuilt = built(epOf.get(rows[0].endpoint));
    const away = elsewhere.get(op);
    if (away) {
      const body = rows.map((x) => {
        n++;
        const mark = away.covers?.[x.test_function];
        if (!mark) return `  // 本物の試験はまだ無い（${away.file}）：${x.ears_text.replace(/\n/g, " ")}\n  it.todo(${q(x.test_function)});`;
        return `  it(${q(x.test_function)}, () => {\n    // ${x.ears_text.replace(/\n/g, " ")}\n    // 本物の試験：${away.file} の「${mark}」（同じ CI の G3 で流れる）\n    expect(readFileSync(${q(away.file)}, "utf8")).toContain(${q(mark)});\n  });`;
      });
      writeFileSync(join(root, file), `// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json・ears-elsewhere.json）。手で直さない。${rows[0].endpoint}
// ${away.reason}
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe(${q(rows[0].endpoint)}, () => {
${body.join("\n")}
});
`);
      continue;
    }
    if (!isBuilt) {
      // まだ作っていない口：試験の置き場（it.todo）だけを置き、試験用のサーバーは立ち上げない（D-128.148）。
      //   「501 で止まり何も書かない」は apps/api/src/contract/authz.test.ts の「まだ作っていない口は止まる」が全部の口を 1 回の立ち上げで確かめる
      if (genericSet.has(rows[0].endpoint)) throw new Error(`${rows[0].endpoint} は表の素の読み書き（generic）で、まだ作っていない。authz.test.ts の 501 の確かめに入らないので、08_api/generic-ok.json に足すか振る舞いを作る`);
      n += rows.length;
      writeFileSync(join(root, file), `// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。${rows[0].endpoint}
// まだ作っていない口。501 で止まることは apps/api/src/contract/authz.test.ts が確かめる。作ったら本物の試験になる（D-128.148）
import { describe, it } from "vitest";

describe(${q(rows[0].endpoint)}, () => {
${rows.map((x) => `  // ${x.ears_text.replace(/\n/g, " ")}\n  it.todo(${q(x.test_function)});`).join("\n")}
});
`);
      continue;
    }
    const tests = [];
    tests.push(...rows.map((x) => {
      n++;
      const kind = kindOf(x.test_function);
      const skip = (kind === "rate_limited" && false) ? ".skip" : "";
      return `  it${skip}(${q(x.test_function)}, async () => {\n    // ${x.ears_text.replace(/\n/g, " ")}\n    ${CASE[kind](op)}\n  });`;
    }));
    const src = `// 生成物（scripts/ci/gen_ears_tests.mjs ← 07_qa/test-plan/ears-test-mapping.json）。手で直さない。${rows[0].endpoint}
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeHarness, endpointOf, type Harness } from "../harness.js";
${tests.some((t) => t.includes("args(")) ? 'import { args } from "../args.js";\n' : ""}
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
