// K-358 預けたログイン情報の前の道すじ（apps/api/src/auth/ext.ts の /api/auth-ext/vault/*・/bridge/credentials/*・/bridge/code）を消した。
//   本番と同じ bootApi（土台 F1/login.harness.ts）。消した道は、ログインの有無に関わらず 404（道が無い）になる。
//   画面の道具（apps/web/lib/auth/ext.ts）と Bridge（apps/bridge/src）にも前の道の字が残っていない。
//   Bridge の loop.ts は前の道を頭（/api/auth-ext）なしの "/bridge/credentials/check-result" で呼んでいたので、引用符のすぐ後に
//   /bridge/credentials/… が来る形も見る（契約の口 /api/v1/bridge/credentials/resolve・/v1/bridge/credentials/<id>/check-result は
//   前に v1 が付くので当たらない）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { setupLogin } from "../F1/login.harness.js";
// 作り物の秘密の値は _fake/secrets.ts に置いて import する（.gitleaks.toml が置き場だけを外す・K-328）
import { K358_UNKNOWN_DEVICE_TOKEN } from "../../_fake/secrets.js";

const h = setupLogin("k358");
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const GONE: [string, string, unknown][] = [
  ["GET", "/api/auth-ext/vault/credentials", undefined],
  ["POST", "/api/auth-ext/vault/credentials", { service_name: "x", login: "a", password: "b" }],
  ["POST", `/api/auth-ext/vault/credentials/${ID}/login-check`, {}],
  ["POST", `/api/auth-ext/vault/credentials/${ID}/answer`, { request_id: "r1", code: "123456" }],
  ["POST", "/api/auth-ext/bridge/code", { job_id: ID, request_id: "r1" }],
  ["POST", "/api/auth-ext/bridge/credentials/check-result", { job_id: ID, state: "ok" }],
  ["POST", "/api/auth-ext/bridge/credentials/resolve", { job_id: ID, credential_id: ID }],
];

describe("K-358 前の道すじを消した", () => {
  it("K358-API-001 前の 7 本（一覧・預ける・確かめ直す・答える・PC がコードを取る・結果・取り出す）は、頭なし・PC の印つきのどちらでも 404", async () => {
    for (const [method, path, body] of GONE) {
      const plain = await h.req(method, path, body);
      expect(plain.status, `${method} ${path}`).toBe(404);
      const withPc = await h.req(method, path, body, { headers: { "x-bridge-session": K358_UNKNOWN_DEVICE_TOKEN } });
      expect(withPc.status, `${method} ${path}（PC の印）`).toBe(404);
    }
  }, 60_000);

  it("K358-API-002 画面の道具と Bridge に前の道の字が無い：apps/web/lib・apps/web/app・apps/web/features・apps/bridge/src のどのファイルにも /vault/credentials・auth-ext/bridge/credentials・引用符で始まる /bridge/code・頭なしの /bridge/credentials/resolve と /bridge/credentials/check-result が無い", () => {
    const walk = (dir: string): string[] =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
        const p = join(dir, e.name);
        if (e.isDirectory()) return e.name === "node_modules" ? [] : walk(p);
        return /\.(ts|tsx)$/.test(e.name) ? [p] : [];
      });
    const files = ["apps/web/lib", "apps/web/app", "apps/web/features", "apps/bridge/src"].flatMap((d) =>
      walk(join(ROOT, d)),
    );
    expect(files.length).toBeGreaterThan(20);
    const hits = files.filter((f) =>
      /\/vault\/credentials|auth-ext\/bridge\/credentials|["'`]\/bridge\/code["'`]|["'`]\/bridge\/credentials\/(resolve|check-result)["'`]/.test(
        readFileSync(f, "utf8"),
      ),
    );
    expect(hits.map((f) => f.replace(ROOT, ""))).toEqual([]);
  });
});
