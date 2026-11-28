// K-800「F10 の口の置き場（口の登録・種類ごとのファイルの空の形・契約の入力の作り直しと外す口・共通の確かめ・目録の直し）」の口の試験
//   （本物の DB・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン。土台 admin.harness.ts）。
//   行 ID（K800-API-…／K800-DB-…）は 11_tickets/K-800.md の表と 1 対 1。
//   この葉の試験は「空の形の答え（501）」を見ない：見ると、後ろの葉が口を本物にしたとき赤になる。入口（401・403・本人確認・道の id）と、
//   登録の鍵・契約・共通の DB の関数だけを見る。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { ENDPOINTS } from "@kaname/contracts";
import type { HookModule } from "../../../src/hooks/registry.js";
import { setupAdmin } from "./admin.harness.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "src");
const ROOT = join(HERE, "..", "..", "..", "..", "..");
const h = setupAdmin();

/** この葉が登録する 13 の口（束 G・A・C。getWorkspaceMembers は K-419 の hooks のまま・記録／設定／自分の設定は葉ごとの hooks） */
const OPS13 = [
  "createScope",
  "updateScope",
  "createLayer",
  "updateLayer",
  "resendInvitation",
  "revokeInvitation",
  "getMember",
  "updateMemberRole",
  "updateMemberGroups",
  "suspendMember",
  "resumeMember",
  "previewMemberRemoval",
  "removeMember",
];
const DROPPED = ["nudgeMember", "updateMemberPermissions", "createExport", "getExport"];
const NIL = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

/** 13 の口を、正しい形の体で叩く道（id は差し込む） */
const call13 = (id: string) =>
  [
    ["createScope", "POST", "/scopes", { name: "新しいグループ", ticket_prefix: "NG" }],
    ["updateScope", "PATCH", `/scopes/${id}`, { name: "直した名前" }],
    ["createLayer", "POST", "/layers", { label: "部門" }],
    ["updateLayer", "PATCH", `/layers/${id}`, { label: "チーム" }],
    ["resendInvitation", "POST", `/invitations/${id}/resend`, {}],
    ["revokeInvitation", "DELETE", `/invitations/${id}`, undefined],
    ["getMember", "GET", `/members/${id}`, undefined],
    ["updateMemberRole", "PATCH", `/members/${id}/role`, { role_key: "member" }],
    ["updateMemberGroups", "PATCH", `/members/${id}/groups`, { add_scope_ids: [NIL] }],
    ["suspendMember", "POST", `/members/${id}/suspend`, {}],
    ["resumeMember", "POST", `/members/${id}/resume`, {}],
    ["previewMemberRemoval", "GET", `/members/${id}/remove-preview`, undefined],
    ["removeMember", "POST", `/members/${id}/remove`, {}],
  ] as const;
/** 本人確認をいつも要る 5 つの口（D-154.18） */
const STEP_UP_OPS = ["updateMemberRole", "updateMemberGroups", "suspendMember", "resumeMember", "removeMember"];

describe("K-800 口の登録と契約", () => {
  it("K800-API-001 口の登録：hooks/f10-admin.ts の register が返す鍵はちょうど 13（契約から外す 4 口と getWorkspaceMembers を含まない・後ろの葉も登録の行を足さない）", async () => {
    const file = join(SRC, "hooks", "f10-admin.ts");
    expect(existsSync(file), "apps/api/src/hooks/f10-admin.ts がある").toBe(true);
    await h.ready();
    const m = (await import(file)) as { register: HookModule };
    const made = m.register.make({
      appPool: h.f.pool,
      config: { env: "test", webBaseUrl: "https://app.kaname.test", opsEmail: "ops@example.com" },
    } as never);
    expect(Object.keys(made).sort()).toEqual([...OPS13].sort());
    for (const dropped of [...DROPPED, "getWorkspaceMembers"]) expect(Object.keys(made)).not.toContain(dropped);
  });

  it("K800-API-002 契約から外した口：nudgeMember・updateMemberPermissions・createExport・getExport が契約に無い。removeMember は POST /api/v1/members/:id/remove", () => {
    const ops = new Map(ENDPOINTS.map((e) => [e.operationId, e]));
    for (const dropped of DROPPED) expect(ops.has(dropped), `${dropped} が契約に残っている`).toBe(false);
    expect(ops.get("removeMember")).toMatchObject({ method: "POST", path: "/api/v1/members/:id/remove" });
    expect(ops.get("createScope")?.perm).toMatchObject({ target: "scopes", ability: "edit" });
    expect(ops.get("updateMemberRole")?.perm).toMatchObject({ target: "members", ability: "edit", stepUp: "always" });
  });
});

describe("K800-API-004〜006 入口の共通（本人確認・権限・道の id）", () => {
  it("K800-API-004 本人確認：5 つの口は、取り直しが無い・16 分前なら 403 STEP_UP_REQUIRED。1 分前なら止まらない", async () => {
    await h.ready();
    const w = await h.world();
    for (const [op, method, path, body] of call13(w.member.id).filter(([o]) => STEP_UP_OPS.includes(o))) {
      const opts = (su?: number) => ({ ...(body === undefined ? {} : { body }), ...(su === undefined ? {} : { su }) });
      for (const su of [undefined, h.suAgo(16)]) {
        const r = await h.call(w.admin, method, path, opts(su));
        expect(r.status, `${op}`).toBe(403);
        expect((await h.json(r)).code, `${op}`).toBe("STEP_UP_REQUIRED");
      }
      const ok = await h.call(w.admin, method, path, opts(h.suAgo(1)));
      expect((await h.json(ok)).code, `${op} の 1 分前`).not.toBe("STEP_UP_REQUIRED");
    }
  });

  it("K800-API-005 権限：メンバー・閲覧のみは 13 の口すべてで 403・マネージャーは書く口で 403・ログインしていなければ 401", async () => {
    await h.ready();
    const w = await h.world();
    const su = h.suNow();
    for (const [op, method, path, body] of call13(w.member.id)) {
      const opts = { ...(body === undefined ? {} : { body }), su };
      for (const p of [w.member, w.viewer]) expect((await h.call(p, method, path, opts)).status, `${op}`).toBe(403);
      if (!["getMember", "previewMemberRemoval"].includes(op))
        expect((await h.call(w.mgr, method, path, opts)).status, `${op}（マネージャー）`).toBe(403);
      const anon = await Promise.resolve(
        h.f.req(method, path.startsWith("/") ? path : `/${path}`, {
          ...(body === undefined ? {} : { body }),
        }),
      );
      expect(anon.status, `${op}（ログインしていない）`).toBe(401);
    }
  });

  it("K800-API-006 道の id：uuid でない id は、権限が正しくても 422（DB に届かない）。別の会社の管理者が指しても中身は返らない", async () => {
    await h.ready();
    const w = await h.world();
    const su = h.suNow();
    for (const [op, method, path, body] of call13("not-a-uuid").filter(
      ([o]) => !["createScope", "createLayer"].includes(o),
    )) {
      const r = await h.call(w.admin, method, path, { ...(body === undefined ? {} : { body }), su });
      expect(r.status, `${op}`).toBe(422);
    }
    const r = await h.call(w.outsider, "GET", `/members/${w.member.id}`, { su });
    expect([403, 404, 501]).toContain(r.status);
    expect(JSON.stringify(await h.json(r))).not.toContain(w.member.name);
  });
});

describe("K800-DB 共通の確かめ（DB の関数）", () => {
  it("K800-DB-007 守り：共通の関数（app.admin_lock・admin_target・admin_admin_count・admin_is_last_admin）は kaname_app から直に呼べない", async () => {
    await h.ready();
    for (const call of [
      "select app.admin_lock()",
      `select app.admin_target('${NIL}')`,
      "select app.admin_admin_count()",
      `select app.admin_is_last_admin('${NIL}')`,
    ])
      await expect(h.f.pool.query(call), call).rejects.toThrow(/permission denied/);
  });

  it("K800-DB-008 相手を読む app.admin_target：管理者・止めた人は状態つき・招待中の人（行ごと）・外した人（status left）・消した人・別の会社の人・AI は null", async () => {
    await h.ready();
    const w = await h.world();
    const t = async (id: string) =>
      (await h.asOwner<{ v: Record<string, unknown> | null }>(w.admin, "select app.admin_target($1) as v", [id]))[0]!.v;
    expect(await t(w.admin.id)).toMatchObject({
      id: w.admin.id,
      name: "高本 聖斗",
      state: "active",
      is_admin: true,
      is_self: true,
    });
    expect(await t(w.member.id)).toMatchObject({ state: "active", is_admin: false, is_self: false });
    expect(await t(w.stopped.id)).toMatchObject({ state: "suspended" });
    const invited = await h.make(w, "invited", "招待中の人", { status: "invited" });
    const left = await h.make(w, "left", "外した人", { status: "left" });
    const gone = await h.make(w, "gone", "消した人");
    await h.f.admin.query("update members set deleted_at = now() where id = $1", [gone.id]);
    const ai = (
      await h.one<{ id: string }>(
        "insert into members (tenant_id, scope_id, kind_id, display_name) values ($1, $2, 'ai_employee', 'AI') returning id",
        [w.tenantId, w.eg],
      )
    ).id;
    for (const id of [invited.id, left.id, gone.id, w.outsider.id, ai, randomUUID()])
      expect(await t(id), id).toBeNull();
  });

  it("K800-DB-009 最後の管理者：管理者 2 人なら数は 2・どちらも最後ではない。止めた管理者は数えず、残る 1 人が最後になる。owner の印だけの人も管理者に数える", async () => {
    await h.ready();
    const w = await h.world();
    const count = async () => (await h.asOwner<{ n: number }>(w.admin, "select app.admin_admin_count() as n"))[0]!.n;
    const last = async (id: string) =>
      (await h.asOwner<{ v: boolean }>(w.admin, "select app.admin_is_last_admin($1) as v", [id]))[0]!.v;
    expect(await count()).toBe(2);
    expect(await last(w.admin.id)).toBe(false);
    await h.f.admin.query(
      "update tenant_memberships set status = 'suspended' where member_id = $1 and tenant_id = $2",
      [w.admin2.id, w.tenantId],
    );
    expect(await count()).toBe(1);
    expect(await last(w.admin.id)).toBe(true);
    expect(await last(w.member.id)).toBe(false);
    // 所属の行を持たない owner（会社を作った人）も管理者
    await h.f.admin.query("delete from tenant_memberships where member_id = $1", [w.admin.id]);
    expect(await count()).toBe(1);
  });

  it("K800-DB-010 会社ごとの錠 app.admin_lock：同じ会社の 2 つ目の取引は前の確定まで待つ（待ち時間の上限で 55P03）。別の会社は待たない", async () => {
    await h.ready();
    const w = await h.world();
    const open = async (tenantId: string) => {
      const cl = await h.f.admin.connect();
      await cl.query("begin");
      await cl.query("select set_config('app.tenant_id', $1, true)", [tenantId]);
      return cl;
    };
    const a = await open(w.tenantId);
    const b = await open(w.tenantId);
    const c = await open(w.other.tenantId);
    try {
      await a.query("select app.admin_lock()");
      await b.query("set local lock_timeout = '300ms'");
      await expect(b.query("select app.admin_lock()")).rejects.toMatchObject({ code: "55P03" });
      await b.query("rollback");
      await c.query("set local lock_timeout = '300ms'");
      await expect(c.query("select app.admin_lock()")).resolves.toBeTruthy();
    } finally {
      for (const cl of [a, b, c]) {
        await cl.query("rollback").catch(() => undefined);
        cl.release();
      }
    }
  });
});

describe("K800-API 答えの言葉と目録", () => {
  it("K800-API-011 gate.ts の replyOf：言葉 → 状態と番号が 1 か所にある（404 は欄・details を付けない・409 は details を付けない・知らない言葉は 503 E-PAGE-003）", async () => {
    const m = (await import(join(SRC, "features", "F10", "admin", "gate.ts"))) as {
      replyOf: (v: { error: string; [k: string]: unknown }) => { status: number; body: Record<string, unknown> };
    };
    const r = (error: string, extra: Record<string, unknown> = {}) => m.replyOf({ error, ...extra });
    expect(r("forbidden")).toMatchObject({ status: 403 });
    expect(r("member_gone")).toMatchObject({ status: 404, body: { code: "E-MEM-002" } });
    expect(r("self_role")).toMatchObject({ status: 409, body: { code: "E-MEM-003" } });
    expect(r("last_admin")).toMatchObject({ status: 409, body: { code: "E-MEM-004" } });
    expect(r("scope_gone")).toMatchObject({ status: 404, body: { code: "E-MEM-006" } });
    expect(r("group_prefix")).toMatchObject({ status: 409, body: { code: "E-GRP-010" } });
    expect(r("limit_groups")).toMatchObject({ status: 409, body: { code: "E-GRP-012" } });
    for (const word of ["member_gone", "scope_gone", "group_gone", "layer_gone"]) {
      const body = r(word).body;
      expect(body["field"], word).toBeUndefined();
      expect(body["details"], word).toBeUndefined();
    }
    for (const word of ["self_role", "last_admin", "group_prefix", "limit_groups"])
      expect(r(word).body["details"], word).toBeUndefined();
    expect(r("言葉が違う")).toMatchObject({ status: 503, body: { code: "E-PAGE-003" } });
  });

  it("K800-API-012 目録の直し：createScope・updateScope・createLayer・updateLayer の持ち主は F10・listMySessions ほかの画面の印は account（mfa-setup でない）・K-70 の apis に入っている", () => {
    const cat = JSON.parse(readFileSync(join(ROOT, "03_architecture/catalog.json"), "utf8")) as {
      api?: { op: string; flows?: string[] }[];
    };
    const flowsOf = (op: string) => (cat.api ?? []).find((a) => a.op === op)?.flows ?? [];
    for (const op of ["createScope", "updateScope", "createLayer", "updateLayer"]) {
      expect(flowsOf(op), op).toContain("F10");
      expect(flowsOf(op), op).not.toContain("F9");
    }
    const eps = JSON.parse(readFileSync(join(ROOT, "08_api/endpoints.json"), "utf8")) as
      { operation_id: string; screens?: string[] }[] | { endpoints: { operation_id: string; screens?: string[] }[] };
    const list = Array.isArray(eps) ? eps : eps.endpoints;
    for (const op of ["listMySessions", "revokeMySession", "revokeOtherSessions"]) {
      const screens = list.find((e) => e.operation_id === op)?.screens ?? [];
      expect(screens, op).toContain("account");
      expect(screens, op).not.toContain("mfa-setup");
    }
    const k70 = readFileSync(join(ROOT, "11_tickets/K-70.md"), "utf8");
    for (const op of ["createScope", "updateScope", "createLayer", "updateLayer"]) expect(k70, op).toContain(op);
    for (const op of DROPPED)
      expect(k70, `${op} は K-70 の apis から外す`).not.toMatch(new RegExp(`apis:.*\\b${op}\\b`));
  });
});
