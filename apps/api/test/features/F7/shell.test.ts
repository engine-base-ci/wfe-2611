// K-465「外枠の数と帯を 1 本で返す（getShell）」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K465-API-…）は 11_tickets/K-465.md の表の行に 1 対 1 で結ぶ。土台は K-461 の notify.harness.ts（F5 の承認と完了の土台の上）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.py の RESPONSES と 05_flow/screen_api.d/K-465.py で直す）:
//   getShell  GET /api/v1/shell（会社の人・120 回／分／人。取引先の人・運営は 403）
//     200 { data: Shell }・Cache-Control: private, no-store。Shell の鍵はちょうど 9 個（8 個＋任意の saved_views）：
//       member               { id, name, role_id }  … 自分（今の me の口の分）
//       workspace            { id, name }  … 今の会社（名前は前後の空白を取る）
//       approvals_waiting    整数  … app.approval_queue_count() の答えそのまま（段 9 が渡しを足して直しても同じ関数を使い続ける）
//       notifications_unread 整数  … K-461 の一覧に出る未読の数（自分宛て・inapp・種類が表にある・チケットの種類は今そのチケットが見える）
//       groups               [{ id, name, ticket_prefix, writable, open_count }]  … 自分に見えるグループ（作った順）。open_count＝そのグループとその下の
//                             グループの、完了でない・消していない・自分に見えるチケットの数。星付き・並べ替えの欄は無い（P9）
//       pc                   { connected, count }  … 自分の PC（アカウント全体）：つながっている物があるか・外していない台数
//       setup_left           整数  … はじめにやることの残り（使えない物・飛ばした物・済みの物・箱を閉じた後は数えない）
//       banner               { incidents, maintenance }  … app.public_service_status() の答えそのまま
//       saved_views          SavedView[]  … 保存した検索条件（K-475 の一覧と同じ文・同じ 13 個の鍵・名前の順・500 行まで）。契約では任意の鍵
//                             （外枠の答えに載せるのは、左のメニューの並びを口を増やさず出すため・K-479）。口は毎回この鍵を付ける
//   1 つの取引・文は 4 つ（本人と数と帯・グループと件数・未読の数・保存した条件）。どれかが失敗したら全体が 503 E-PAGE-003（部分の答えは返さない）
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  auth,
  breakWritable,
  delegated,
  f,
  json,
  lastSeen,
  limits,
  member,
  notice,
  one,
  outsider,
  req,
  rowsAs,
  setupNotify,
  team,
  ticket,
  ticketPayload,
  ready,
  type Person,
} from "./notify.harness.js";

setupNotify();

const HERE = dirname(fileURLToPath(import.meta.url));

const KEYS = [
  "approvals_waiting",
  "banner",
  "groups",
  "member",
  "notifications_unread",
  "pc",
  "saved_views",
  "setup_left",
  "workspace",
];
/** 保存した条件の 1 件の鍵（K-475 の答えと同じ 13 個ちょうど） */
const VIEW_KEYS = [
  "can_edit",
  "columns",
  "created_at",
  "density",
  "filters",
  "id",
  "member_id",
  "member_name",
  "mine",
  "name",
  "scope_id",
  "share",
  "updated_at",
];
const RUN = `k465-${Date.now().toString(36)}`;

interface Shell {
  member: { id: string; name: string; role_id: string | null };
  workspace: { id: string; name: string | null };
  approvals_waiting: number;
  notifications_unread: number;
  groups: { id: string; name: string; ticket_prefix: string | null; writable: boolean; open_count: number }[];
  pc: { connected: boolean; count: number };
  setup_left: number;
  banner: {
    incidents: { state: string; title: string; started_at: string }[];
    maintenance: Record<string, string> | null;
  };
  saved_views: Record<string, unknown>[];
}
const shellOf = async (p: Person, role = "member"): Promise<Response> =>
  req("GET", "/shell", { headers: auth(p, { role }) });
async function shell(p: Person): Promise<Shell> {
  const r = await shellOf(p);
  if (r.status !== 200) throw new Error(`getShell が ${r.status}：${await r.clone().text()}`);
  return (await json(r))["data"] as unknown as Shell;
}

/** 新しい会社・見る人（その会社の全体のグループの edit）・見るだけの人・グループを見られない人 */
async function world(prefix = "KS") {
  const co = await f.company(`K465 の会社 ${Math.random().toString(36).slice(2, 7)}`, prefix);
  const me = await member("見る人", { co });
  const viewer = await member("見るだけの人", { co, ability: "view" });
  const none = await member("何も無い人", { co, ability: null });
  return { co, me, viewer, none };
}
const mk = (
  co: { tenantId: string; rootScope: string },
  o: { assignee: Person; scope?: string; stage?: string; title?: string },
) =>
  ticket({
    tenant: co.tenantId,
    scope: o.scope ?? co.rootScope,
    assignee: o.assignee,
    creator: o.assignee,
    stage: o.stage ?? "doing",
    title: o.title ?? "チケット",
  });
const countFor = async (p: Person) =>
  Number((await rowsAs<{ n: number }>(p, "select app.approval_queue_count() as n"))[0]!.n);
/** 保存した条件を管理の接続で直に置く（書く口の確かめは K-475 の試験が持つ。ここは読む側の入力を作るだけ） */
const seedView = async (
  by: Person,
  name: string,
  o: { share?: "self" | "group"; scope?: string; deleted?: boolean; minutesAgo?: number } = {},
) =>
  (
    await one<{ id: string }>(
      `insert into saved_views (tenant_id, member_id, name, share, scope_id, filters, columns, density, deleted_at, created_at)
       values ($1, $2, $3, $4, $5, '{}'::jsonb, '[]'::jsonb, 'normal', case when $6::boolean then now() else null end,
               now() - make_interval(mins => $7::int))
       returning id`,
      [by.tenantId, by.id, name, o.share ?? "self", o.scope ?? null, o.deleted === true, o.minutesAgo ?? 0],
    )
  ).id;

describe("K-465 外枠の数と帯を 1 本で返す", () => {
  it("K465-API-001 答えの形：鍵はちょうど 9 個（saved_views を含む）・型は決めたとおり。星付きや並べ替えの欄は無い", async () => {
    await ready();
    const w = await world();
    await mk(w.co, { assignee: w.me });
    await seedView(w.me, "形を見る条件");
    const s = await shell(w.me);
    expect(Object.keys(s).sort()).toEqual(KEYS);
    expect(Number.isInteger(s.approvals_waiting)).toBe(true);
    expect(Number.isInteger(s.notifications_unread)).toBe(true);
    expect(Number.isInteger(s.setup_left)).toBe(true);
    expect(Array.isArray(s.groups)).toBe(true);
    expect(Object.keys(s.pc).sort()).toEqual(["connected", "count"]);
    expect(Object.keys(s.banner).sort()).toEqual(["incidents", "maintenance"]);
    expect(Object.keys(s.member).sort()).toEqual(["id", "name", "role_id"]);
    expect(Object.keys(s.workspace).sort()).toEqual(["id", "name"]);
    for (const g of s.groups)
      expect(Object.keys(g).sort()).toEqual(["id", "name", "open_count", "ticket_prefix", "writable"]);
    expect(Array.isArray(s.saved_views)).toBe(true);
    expect(s.saved_views).toHaveLength(1);
    for (const v of s.saved_views) expect(Object.keys(v).sort()).toEqual(VIEW_KEYS);
    for (const key of Object.keys(s)) expect(key).not.toMatch(/star|pinned|favorite/i);
  });

  it("K465-API-002 自分と会社：member は自分の id・名前・役、workspace は今の会社の id と名前（前後の空白を取る）。別の会社の人には別の会社が出る", async () => {
    await ready();
    const w = await world();
    await f.admin.query("update tenants set name = $2 where id = $1", [w.co.tenantId, "  空白つきの会社  "]);
    const s = await shell(w.me);
    const row = await one<{ display_name: string; role_id: string | null }>(
      "select display_name, role_id from members where id = $1",
      [w.me.id],
    );
    expect(s.member).toEqual({ id: w.me.id, name: row.display_name, role_id: row.role_id });
    expect(s.workspace).toEqual({ id: w.co.tenantId, name: "空白つきの会社" });
    const o = await shell(outsider);
    expect(o.workspace.id).toBe(outsider.tenantId);
    expect(o.workspace.id).not.toBe(w.co.tenantId);
    expect(JSON.stringify(o)).not.toContain("空白つきの会社");
  });

  it("K465-API-003 承認待ちの数：承認する人（担当者）には app.approval_queue_count() と同じ数が出る。決めると減る。承認する人でない人は 0", async () => {
    await ready();
    const w = await world();
    const a = await mk(w.co, { assignee: w.me, stage: "awaiting_approval", title: "承認待ち 1" });
    const b = await mk(w.co, { assignee: w.me, stage: "awaiting_approval", title: "承認待ち 2" });
    const tm = await team("AI を動かす人", w.co);
    await delegated(a, { by: tm });
    const d = await delegated(b, { by: tm });
    expect((await shell(w.me)).approvals_waiting).toBe(2);
    expect(await countFor(w.me)).toBe(2);
    expect((await shell(w.viewer)).approvals_waiting).toBe(0);
    const ok = await req("POST", `/approvals/${d.approvalId}/approve`, { body: {}, headers: auth(w.me) });
    expect(ok.status, await ok.clone().text()).toBe(201);
    expect((await shell(w.me)).approvals_waiting).toBe(1);
    expect(await countFor(w.me)).toBe(1);
  });

  it("K465-API-004 未読の数：自分宛ての未読だけ。読んだ行・別の人宛て・メールの印の行・知らない種類・見えないチケットの行は数えない。一覧の未読と同じ数", async () => {
    await ready();
    const w = await world();
    const other = await member("別の人", { co: w.co });
    const seen = await mk(w.co, { assignee: w.me, title: "見えるチケット" });
    const hidden = await mk(w.co, { assignee: other, title: "消したチケット" });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [hidden.id]);
    await notice(w.me, { kind: "bridge.connected", payload: { device_label: "PC" }, ageMin: 5 });
    await notice(w.me, { kind: "approval.requested", payload: ticketPayload(seen, "見えるチケット"), ageMin: 4 });
    await notice(w.me, { kind: "bridge.connected", readAgoDays: 1, payload: { device_label: "読んだ" } });
    await notice(other, { kind: "bridge.connected", payload: { device_label: "別の人" } });
    await notice(w.me, { kind: "bridge.connected", channel: "email" });
    await notice(w.me, { kind: "future.unknown_kind" });
    await notice(w.me, { kind: "approval.requested", payload: ticketPayload(hidden, "消したチケット") });
    expect((await shell(w.me)).notifications_unread).toBe(2);
    const list = (await json(await req("GET", "/notifications?unread=true", { headers: auth(w.me) }))) as unknown as {
      data: unknown[];
    };
    expect(list.data).toHaveLength(2);
    await f.admin.query("update notifications set read_at = now() where member_id = $1 and read_at is null", [w.me.id]);
    expect((await shell(w.me)).notifications_unread).toBe(0);
    expect((await shell(other)).notifications_unread).toBe(1);
  });

  it("K465-API-005 グループの件数：完了でない・消していない・自分に見えるチケットだけ数える（完了・消した物は数えない）", async () => {
    await ready();
    const w = await world("KC");
    await mk(w.co, { assignee: w.me, title: "作業中 1" });
    await mk(w.co, { assignee: w.me, title: "作業中 2" });
    await mk(w.co, { assignee: w.me, stage: "awaiting_approval", title: "承認待ち" });
    await mk(w.co, { assignee: w.me, stage: "done", title: "完了" });
    const gone = await mk(w.co, { assignee: w.me, title: "消した" });
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [gone.id]);
    const g = (await shell(w.me)).groups.find((x) => x.id === w.co.rootScope)!;
    expect(g.open_count).toBe(3);
    expect(g.ticket_prefix).toBe("KC");
    expect(g.name).toContain("K465 の会社");
  });

  it("K465-API-006 下のグループも数える：親のグループの件数には、下のグループのチケットも入る（一覧でグループを選んだときの件数と同じ）。一部の枝しか見られない人でも、見える親の件数は一覧と同じで、見えない枝の分は入らない", async () => {
    await ready();
    const w = await world();
    const child = await one<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, '下のグループ', 'KD', $2) returning id",
      [w.co.tenantId, w.co.rootScope],
    );
    await mk(w.co, { assignee: w.me, title: "親のチケット" });
    await mk(w.co, { assignee: w.me, scope: child.id, title: "子のチケット 1" });
    await mk(w.co, { assignee: w.me, scope: child.id, title: "子のチケット 2" });
    const gs = (await shell(w.me)).groups;
    expect(gs.find((x) => x.id === w.co.rootScope)!.open_count).toBe(3);
    expect(gs.find((x) => x.id === child.id)!.open_count).toBe(2);
    const listed = (await json(
      await req("GET", `/tickets?view=all&scope_id=${w.co.rootScope}&limit=100`, { headers: auth(w.me) }),
    )) as unknown as {
      data: unknown[];
    };
    expect(listed.data).toHaveLength(3);
    // 一部の枝しか見られない人：親 P（下に C）だけに view を持つ。兄弟の S は見えず、件数にも一覧にも入らない
    const scope = (name: string, prefix: string, parent: string) =>
      one<{ id: string }>(
        "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, $2, $3, $4) returning id",
        [w.co.tenantId, name, prefix, parent],
      );
    const p = await scope("見える親", "KP", w.co.rootScope);
    const c = await scope("見える親の下", "KC", p.id);
    const sib = await scope("見えない兄弟", "KS2", w.co.rootScope);
    await mk(w.co, { assignee: w.me, scope: p.id, title: "P のチケット" });
    await mk(w.co, { assignee: w.me, scope: c.id, title: "C のチケット" });
    await mk(w.co, { assignee: w.me, scope: sib.id, title: "S のチケット" });
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'view')",
      [w.co.tenantId, w.none.id, p.id],
    );
    const seen = (await shell(w.none)).groups;
    expect(seen.map((x) => x.id).sort()).toEqual([p.id, c.id].sort());
    expect(seen.find((x) => x.id === p.id)!.open_count).toBe(2);
    const partial = (await json(
      await req("GET", `/tickets?view=all&scope_id=${p.id}&limit=100`, { headers: auth(w.none) }),
    )) as unknown as { data: unknown[] };
    expect(partial.data).toHaveLength(2);
  });

  it("K465-API-007 見えるグループだけ：見られないグループは出ない（件数も漏れない）。見られる人には出る。何も見られない人は groups が空で、ほかの欄は出る", async () => {
    await ready();
    const w = await world();
    const sc = await one<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '見えないグループ', 'ZZ') returning id",
      [w.co.tenantId],
    );
    await mk(w.co, { assignee: w.viewer, scope: sc.id, title: "見えないグループのチケット" });
    await f.admin.query(
      "insert into permissions (tenant_id, grantee_member_id, target_kind_id, scope_id, ability_id) values ($1, $2, 'tickets', $3, 'edit')",
      [w.co.tenantId, w.viewer.id, sc.id],
    );
    expect((await shell(w.me)).groups.map((x) => x.id)).not.toContain(sc.id);
    expect(JSON.stringify(await shell(w.me))).not.toContain("見えないグループ");
    expect((await shell(w.viewer)).groups.map((x) => x.id)).toContain(sc.id);
    const none = await shell(w.none);
    expect(none.groups).toEqual([]);
    expect(none.workspace.id).toBe(w.co.tenantId);
  });

  it("K465-API-008 書けるか：writable は tickets の edit を持つグループだけ true（見るだけの人は false）。作った順に並ぶ", async () => {
    await ready();
    const w = await world();
    const second = await one<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix, parent_id) values ($1, '2 番目', 'K2', $2) returning id",
      [w.co.tenantId, w.co.rootScope],
    );
    const mine = (await shell(w.me)).groups;
    expect(mine.map((x) => x.id)).toEqual([w.co.rootScope, second.id]);
    expect(mine.every((x) => x.writable === true)).toBe(true);
    const theirs = (await shell(w.viewer)).groups;
    expect(theirs.map((x) => x.id)).toEqual([w.co.rootScope, second.id]);
    expect(theirs.every((x) => x.writable === false)).toBe(true);
  });

  it("K465-API-009 PC：つながっている PC があれば connected true・外していない台数を数える。閉じている（最後の知らせが古い）と false・PC が無ければ 0 台", async () => {
    await ready();
    const w = await world();
    const tm = await team("PC を持つ人", w.co);
    expect((await shell(w.me)).pc).toEqual({ connected: false, count: 0 });
    await lastSeen(tm.pc.sid, 1);
    expect((await shell(tm.by)).pc).toEqual({ connected: true, count: 1 });
    await lastSeen(tm.pc.sid, 300);
    expect((await shell(tm.by)).pc).toEqual({ connected: false, count: 1 });
    // まだ一度も知らせていない PC（つないだばかり・waiting）も 1 台に数える。外した PC は数えない
    await f.admin.query("update sessions set alive_at = null where id = $1", [tm.pc.sid]);
    expect((await shell(tm.by)).pc).toEqual({ connected: false, count: 1 });
    await f.admin.query("update sessions set revoked_at = now(), revoke_reason_id = 'device_removed' where id = $1", [
      tm.pc.sid,
    ]);
    expect((await shell(tm.by)).pc).toEqual({ connected: false, count: 0 });
  });

  it("K465-API-010 はじめにやることの残り：PC を預けていない新しい人は 2（PC・ログイン情報。パスキーは使えないので数えない）。PC をつなぐと 1・「あとで」で飛ばすと 0。箱を閉じていれば 0", async () => {
    await ready();
    const w = await world();
    expect((await shell(w.me)).setup_left).toBe(2);
    const tm = await team("PC を持つ人", w.co);
    await lastSeen(tm.pc.sid, 1);
    expect((await shell(tm.by)).setup_left).toBe(1);
    await f.admin.query("update members set setup_skipped_keys = array['credentials'] where id = $1", [tm.by.id]);
    expect((await shell(tm.by)).setup_left).toBe(0);
    await f.admin.query("update members set setup_dismissed_at = now() where id = $1", [w.me.id]);
    expect((await shell(w.me)).setup_left).toBe(0);
  });

  it("K465-API-011 帯：直っていない障害と今中のメンテナンスが app.public_service_status() と同じ形で出る。直ると消える", async () => {
    await ready();
    const w = await world();
    const base = (await shell(w.me)).banner;
    expect(Array.isArray(base.incidents)).toBe(true);
    const n = await one<{ id: string }>(
      `insert into notices (kind_id, title, body, state, maintenance_from, maintenance_to, target_tenant_id, target_plan_ids, placements)
       values ('incident', $1, $2, 'published', null, null, null, null, '{list,banner}') returning id`,
      [`${RUN} 障害`, `${RUN} 運営だけの本文`],
    );
    const i = await one<{ id: string }>(
      `insert into status_incidents (notice_id, state, started_at, resolved_at, note, body)
       values ($1, 'investigating', now() - interval '10 minutes', null, $2, $3) returning id`,
      [n.id, `${RUN} メモ`, `${RUN} 本文`],
    );
    const m = await one<{ id: string }>(
      `insert into notices (kind_id, title, body, state, maintenance_from, maintenance_to, target_tenant_id, target_plan_ids, placements)
       values ('incident', $1, $2, 'published', now() - interval '1 hour', now() + interval '1 hour', null, null, '{list,banner}') returning id`,
      [`${RUN} メンテナンス`, `${RUN} 運営だけの本文`],
    );
    try {
      const s = await shell(w.me);
      const mine = s.banner.incidents.filter((x) => x.title.startsWith(RUN));
      expect(mine.map((x) => x.title)).toEqual([`${RUN} 障害`]);
      expect(Object.keys(mine[0]!).sort()).toEqual(["started_at", "state", "title"]);
      expect(s.banner.maintenance).not.toBeNull();
      expect(Object.keys(s.banner.maintenance!).sort()).toEqual(["from", "title", "to"]);
      expect(JSON.stringify(s.banner)).not.toContain("運営だけの本文");
      expect(JSON.stringify(s.banner)).not.toContain(`${RUN} メモ`);
      await f.admin.query("update status_incidents set state = 'resolved', resolved_at = now() where id = $1", [i.id]);
      expect((await shell(w.me)).banner.incidents.filter((x) => x.title.startsWith(RUN))).toEqual([]);
    } finally {
      await f.admin.query("update notices set deleted_at = now() where id = any($1::uuid[])", [[n.id, m.id]]);
    }
  });

  it("K465-API-012 取引先の人・運営の人は 403（社内の外枠だけ・P11）。ログインしていなければ 401", async () => {
    await ready();
    const w = await world();
    expect((await shellOf(w.me, "client")).status).toBe(403);
    expect((await shellOf(w.me, "ops")).status).toBe(403);
    const r = await req("GET", "/shell");
    expect(r.status).toBe(401);
    expect((await json(r))["data"]).toBeUndefined();
  });

  it("K465-API-013 上限：同じ人が上限を超えたら 429 と retry_after_sec（1〜60 の整数）", async () => {
    await ready();
    const w = await world();
    limits["getShell"] = 2;
    try {
      expect((await shellOf(w.me)).status).toBe(200);
      expect((await shellOf(w.me)).status).toBe(200);
      const r = await shellOf(w.me);
      expect(r.status).toBe(429);
      const s = Number((await json(r))["retry_after_sec"]);
      expect(Number.isInteger(s) && s >= 1 && s <= 60).toBe(true);
    } finally {
      delete limits["getShell"];
    }
  });

  it("K465-API-014 貯めない：Cache-Control に private と no-store", async () => {
    await ready();
    const w = await world();
    const r = await shellOf(w.me);
    expect(r.status).toBe(200);
    const cc = r.headers.get("cache-control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });

  it("K465-API-015 失敗（DB を読む）：数を数える途中で DB が落ちたら 503 E-PAGE-003 で、部分の答え（数だけ・グループだけ）を返さない", async () => {
    await ready();
    const w = await world();
    const t = await mk(w.co, { assignee: w.me, stage: "awaiting_approval", title: "K465 の守りを壊すチケット" });
    const tm = await team("AI を動かす人", w.co);
    await delegated(t, { by: tm });
    await breakWritable("K465 の守りを壊すチケット", async () => {
      const r = await shellOf(w.me);
      expect(r.status).toBe(503);
      const body = await json(r);
      expect(body["code"]).toBe("E-PAGE-003");
      expect(body["data"]).toBeUndefined();
    });
    expect((await shell(w.me)).approvals_waiting).toBe(1);
  });

  it("K465-API-016 読むだけ：何度読んでも行は変わらない（知らせの read_at・承認・チケット・PC の最後の知らせ）", async () => {
    await ready();
    const w = await world();
    const tm = await team("PC を持つ人", w.co);
    await lastSeen(tm.pc.sid, 1);
    const id = await notice(tm.by, { kind: "bridge.connected", payload: { device_label: "PC" } });
    const snap = async () =>
      JSON.stringify({
        n: await one<Record<string, unknown>>("select read_at, updated_at from notifications where id = $1", [id]),
        s: await one<Record<string, unknown>>("select alive_at from sessions where id = $1", [tm.pc.sid]),
        m: await one<Record<string, unknown>>(
          "select setup_dismissed_at, setup_skipped_keys from members where id = $1",
          [tm.by.id],
        ),
      });
    const before = await snap();
    await shell(tm.by);
    await shell(tm.by);
    expect(await snap()).toBe(before);
  });

  it("K465-API-017 保存した条件：自分の物と、見えるグループの全員向けの物だけが名前の順に出る。消した物・同僚の自分だけの物・見えないグループ向けの物・別の会社の物は出ない。1 件の鍵は 13 個で、表の列（tenant_id など）は出ない。条件が無い人は空の配列", async () => {
    await ready();
    const w = await world();
    const mate = await member("同僚", { co: w.co });
    const hiddenScope = await one<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '見えない保存先のグループ', 'ZV') returning id",
      [w.co.tenantId],
    );
    await seedView(w.me, "B 自分の条件", { minutesAgo: 3 });
    await seedView(w.me, "A 自分の条件", { minutesAgo: 5 });
    await seedView(mate, "C 同僚が見せた条件", { share: "group", scope: w.co.rootScope });
    await seedView(mate, "D 同僚だけの条件");
    await seedView(mate, "E 見えないグループ向け", { share: "group", scope: hiddenScope.id });
    await seedView(w.me, "F 消した条件", { deleted: true });
    await seedView(outsider, "G 別の会社の条件");
    const views = (await shell(w.me)).saved_views;
    expect(views.map((v) => v["name"])).toEqual(["A 自分の条件", "B 自分の条件", "C 同僚が見せた条件"]);
    for (const v of views) expect(Object.keys(v).sort()).toEqual(VIEW_KEYS);
    expect(views.map((v) => v["mine"])).toEqual([true, true, false]);
    const text = JSON.stringify(views);
    for (const hidden of ["同僚だけの条件", "見えないグループ向け", "消した条件", "別の会社の条件"])
      expect(text).not.toContain(hidden);
    for (const col of ["tenant_id", "created_by", "updated_by", "deleted_at"]) expect(text).not.toContain(col);
    expect((await shell(w.viewer)).saved_views.map((v) => v["name"])).toEqual(["C 同僚が見せた条件"]);
    expect((await shell(w.none)).saved_views).toEqual([]);
  });

  it("K465-API-018 速さの台帳の試験（k237_perf_budget.test.ts）が、口を手で組む所に getShell の振る舞い（hooks/shell.ts の shellHooks）を差している：差さないと台帳に足す /api/v1/shell の行（K-466）が 501 になる。ほかの 5 つの口も差したまま", () => {
    const src = readFileSync(join(HERE, "..", "..", "k237_perf_budget.test.ts"), "utf8");
    expect(src).toContain('"hooks", "shell.ts"');
    expect(src).toMatch(/\.\.\.shellHooks\b/);
    expect(src.match(/\.\.\.\w*[Hh]ooks\b/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
  });
});
