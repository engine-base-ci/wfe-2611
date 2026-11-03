// 権限の試験（ゼロトラストの決まり ZT1・ZT2・ZT4・ZT10・D-128.112）。
// 契約（@kaname/contracts の ENDPOINTS）と「誰が呼べるか」（08_api/endpoints.json の permission）を毎回読んで回すので、API が増えても古くならない。
//   1) 役の段（いま実装済み）：ログインしていない・役が合わない人は、どの API も 401／403 で止まり、hooks（副作用）まで届かない
//   2) 権限の言葉の段（read／write／admin／self／assignee／approver／recipient／manager／ops:<できること>）と本人確認の取り直し：
//      まだ入口に無いので it.todo で 1 本ずつ並べる。数は zt_gate.py が「実装の残り」に出す（0 になるまで本番に出さない）
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { ENDPOINTS, type EndpointDef } from "@kaname/contracts";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import type { Vars } from "../middleware/tenant.js";
import type { ContractDeps } from "./deps.js";
import { op } from "./op.js";

type Role = TenantContext["role"];
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
type Perm = { who: string; scope: string; step_up: boolean | string };
const PERMS = new Map<string, Perm>(
  (
    JSON.parse(readFileSync(join(ROOT, "08_api", "endpoints.json"), "utf8")) as {
      endpoints: { operation_id?: string; permission?: Perm }[];
    }
  ).endpoints
    .filter((e) => e.operation_id && e.permission)
    .map((e) => [e.operation_id!, e.permission!]),
);

const A = "0193c5a0-0000-7000-8000-00000000000a";
const U = "0193c5a0-0000-7000-8000-000000000001";
const ctxOf = (role: Role): TenantContext =>
  role === "anonymous" ? { tenantId: null, userId: null, role } : { tenantId: A, userId: U, role };

/** 入口だけを試す小さなアプリ。副作用に届いたら印を付ける（届いてはいけない） */
function appFor(e: EndpointDef, role: Role, opsAllowed = false, withHook = true) {
  let reached = false;
  const repo = { opsAllowed: async () => opsAllowed, hasColumn: () => false } as unknown as Repository;
  const deps: ContractDeps = {
    hooks: withHook
      ? {
          [e.operationId]: {
            before: async () => {
              reached = true;
              return { status: 418, body: {} };
            },
          },
        }
      : {},
    limiter: () => ({ take: () => true }),
    idempotency: { get: () => undefined, set: () => undefined },
  };
  const app = new Hono<Vars>();
  app.use("*", async (c, next) => {
    c.set("ctx", ctxOf(role));
    c.set("repo", repo);
    await next();
  });
  const m = e.method.toLowerCase() as "get" | "post" | "patch" | "delete" | "put";
  app[m](e.path, op(deps, e.operationId));
  return { app, reached: () => reached };
}
const urlOf = (e: EndpointDef) => e.path.replace(/:(\w+)/g, (_, n: string) => (n === "id" ? A : `x-${n}`));
async function hit(e: EndpointDef, role: Role, opsAllowed = false, withHook = true) {
  const { app, reached } = appFor(e, role, opsAllowed, withHook);
  const init: RequestInit = { method: e.method, headers: { "content-type": "application/json" } };
  if (e.method === "POST" || e.method === "PATCH" || e.method === "PUT") init.body = "{}";
  const r = await app.request(urlOf(e), init);
  return { status: r.status, reached: reached() };
}

/** 役ごとに「止まるべき人」 */
const MUST_STOP: Record<EndpointDef["auth"], Role[]> = {
  public: [],
  member: ["anonymous", "client", "device"],
  ops: ["anonymous", "member", "client", "device"],
  client: ["anonymous", "member", "ops", "device"],
  device: ["anonymous", "member", "ops", "client"],
};

describe("権限の試験：役の段（契約の全 API）", () => {
  it("契約の API は全部「誰が呼べるか」を持ち、役と権限の言葉が合っている", () => {
    const bad: string[] = [];
    for (const e of ENDPOINTS) {
      const p = PERMS.get(e.operationId);
      if (!p) {
        bad.push(`${e.method} ${e.path} に権限が無い`);
        continue;
      }
      const want =
        p.who === "public"
          ? "public"
          : p.who.startsWith("ops:")
            ? "ops"
            : p.who === "client"
              ? "client"
              : p.who === "device"
                ? "device"
                : "member";
      if (want !== e.auth) bad.push(`${e.method} ${e.path}：権限 ${p.who} なのに契約の役は ${e.auth}`);
    }
    expect(bad).toEqual([]);
  });

  const cases = ENDPOINTS.flatMap((e) => MUST_STOP[e.auth].map((role) => [e, role] as const));
  it.each(cases.map(([e, role]) => [`${e.method} ${e.path}`, e.auth, role, e] as const))(
    "%s（%s）は %s を止め、副作用に届かせない",
    async (_name, _auth, role, e) => {
      const r = await hit(e, role);
      expect(r.status).toBe(role === "anonymous" ? 401 : 403);
      expect(r.reached).toBe(false);
    },
  );

  it.each(ENDPOINTS.filter((e) => e.auth === "member").map((e) => [`${e.method} ${e.path}`, e] as const))(
    "%s：運営は「中を見る」の許可が無ければ止まる",
    async (_name, e) => {
      const r = await hit(e, "ops", false);
      expect(r.status).toBe(403);
      expect(r.reached).toBe(false);
    },
  );
});

describe("まだ作っていない口は止まる（fail-closed・D-128.113）", () => {
  const RIGHT: Record<EndpointDef["auth"], Role> = {
    public: "anonymous",
    member: "member",
    ops: "ops",
    client: "client",
    device: "device",
  };
  it.each(ENDPOINTS.filter((e) => !e.generic).map((e) => [`${e.method} ${e.path}`, e] as const))(
    "%s：振る舞い（hooks）が無ければ、正しい役の人が呼んでも 501 で、表の素の読み書きに落ちない",
    async (_name, e) => {
      const r = await hit(e, RIGHT[e.auth], true, false);
      expect(r.status).toBe(501);
    },
  );
});

describe("権限の試験：権限の言葉の段と本人確認（作る段で 1 本ずつ実装する）", () => {
  for (const e of ENDPOINTS) {
    const p = PERMS.get(e.operationId);
    if (!p || p.who === "public") continue;
    it.todo(`${e.method} ${e.path}：権限 ${p.who} の外の人は止まる（${p.scope}）`);
    if (p.step_up)
      it.todo(
        `${e.method} ${e.path}：直前（15 分以内）の本人確認が無ければ 403（${p.step_up === true ? "いつも" : p.step_up}）`,
      );
  }
});
