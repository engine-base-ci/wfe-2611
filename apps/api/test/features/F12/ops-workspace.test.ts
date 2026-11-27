// K-966 運営が 1 社を読む（getOpsWorkspace・GET /api/v1/ops/workspaces/:id／listOpsWorkspaceMembers・GET /api/v1/ops/workspaces/:id/members）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   答えの形は K-1006 の「画面が使う答えの形」（1 社は 14 欄・メンバーは 8 欄）。数と種類だけで中身（チケット・会話・預けたログイン情報の値）を返さない（D-156.3）。
//   止める印は K-963 が足した tenants の 4 列（書くのは K-970。ここでは DB に直に置く）。読むだけなので運営の記録は書かない
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { withTenant, type TenantContext } from "@kaname/db/context";
import { startOpsWs, isFlat, MEMBER_KEYS, OPS_TENANT, WS_KEYS, type OpsWs, type Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

let t: OpsWs;
let opsAll: Person;
let opsNoInquiry: Person;
let w: Ws;

beforeAll(async () => {
  t = await startOpsWs("k966", ["ops-workspace", "ops-workspaces"]); // K966-API-020 が一覧の口（listOpsWorkspaces）も呼ぶ
  opsAll = await t.ops("全部");
  opsNoInquiry = await t.ops("お金だけ", ["money"]);
  w = await t.ws("ミナト企画", { plan: "team", members: 3 });
});
afterAll(async () => {
  await t.close();
});

type Row = Record<string, unknown>;
const ws = async (id: string, who: Person = opsAll) => {
  const r = await t.call(who, "GET", `/ops/workspaces/${id}`);
  return { r, b: await t.json(r) };
};
const members = async (id: string, who: Person = opsAll) => {
  const r = await t.call(who, "GET", `/ops/workspaces/${id}/members`);
  return { r, b: await t.json(r) };
};
const authOf = async (p: Person) =>
  (await t.row<{ a: string }>("select auth_user_id as a from members where id = $1", [p.id]))!.a;

describe("K-966 1 社（getOpsWorkspace）", () => {
  it("K966-API-001 答えは 14 欄。名前・プランの名前・状態 active・管理者の名前・人数 { count }・済んでいない問い合わせ { open }・止める印 null・中を見る null", async () => {
    const { r, b } = await ws(w.tenantId);
    expect(r.status, JSON.stringify(b)).toBe(200);
    const d = b.data as Row;
    expect(Object.keys(d).sort()).toEqual(WS_KEYS);
    expect([d["id"], d["name"], d["plan_name"], d["state"]]).toEqual([w.tenantId, w.name, "チーム", "active"]);
    expect(d["admin"]).toEqual({ name: "管理者 ミナト企画" });
    expect(Object.keys(d["members"] as Row)).toEqual(["count"]);
    expect(d["inquiries"]).toEqual({ open: 0 });
    expect([d["stop"], d["peek"]]).toEqual([null, null]);
  });

  it("K966-API-002 数：PC がつながる人（いま / 人数）・今月の実行の数（上限は持たない＝割合の欄が無い・D-156.63）・ファイルの量（消した物は数えない・上限の欄が無い）", async () => {
    const x = await t.ws("数", { members: 2 });
    await t.pc(x, x.admin, { alive: true });
    await t.run_(x, { status: "done" });
    await t.run_(x, { status: "done" });
    await t.f.admin.query(
      `insert into attachments (tenant_id, scope_id, owner_type, size, name, mime, deleted_at)
       values ($1, $2, 'inquiry', 1000, 'a.png', 'image/png', null), ($1, $2, 'inquiry', 500, 'b.png', 'image/png', now())`,
      [x.tenantId, x.rootScope],
    );
    const d1 = (await ws(x.tenantId)).b.data as Row;
    expect(d1["pc"]).toEqual({ connected: 1, total: 2 });
    expect(d1["runs_month"]).toEqual({ count: 2 });
    expect(d1["files"]).toEqual({ bytes: 1000 });
  });

  it("K966-API-003 止まった実行：直近 7 日の数と、その前の 7 日の数（14 日より前は数えない）", async () => {
    const x = await t.ws("止まった");
    for (const d of [1, 2, 3]) await t.run_(x, { status: "stopped", daysAgo: d });
    await t.run_(x, { status: "stopped", daysAgo: 9 });
    await t.run_(x, { status: "stopped", daysAgo: 20 });
    await t.run_(x, { status: "done", daysAgo: 1 });
    expect(((await ws(x.tenantId)).b.data as Row)["stuck_runs"]).toEqual({ count_7d: 3, prev_week: 1 });
  });

  it("K966-API-004 最近のこと：問い合わせが届いた・請求書を出した・入金を記録した・メンバーが増えた、の新しい順に 5 件まで。鍵は at・label・detail（請求書は「期限 MM/DD」・メンバーは null・D-156.47）。字に問い合わせの内容は入らない", async () => {
    const x = await t.ws("最近");
    await t.inquiry(x, { state: "open", title: "承認したのに動かない" });
    const inv = await t.invoice(x, { amount: 16500, dueDaysAgo: -10 });
    // 土台の請求書は出した時刻が 20 日前なので、今に寄せて新しい 5 件に入れる（出来事の時刻は issued_at のまま・PM の決め 2026-11-25）
    await t.f.admin.query("update invoices set issued_at = now() where id = $1", [inv]);
    await t.f.admin.query(
      "insert into payments (tenant_id, invoice_id, paid_on, amount) values ($1, $2, current_date, 16500)",
      [x.tenantId, inv],
    );
    for (let i = 0; i < 3; i++) await t.member(x, `増えた ${i}`);
    const recent = ((await ws(x.tenantId)).b.data as Row)["recent"] as Row[];
    expect(recent.length).toBe(5);
    for (const e of recent) expect(Object.keys(e).sort()).toEqual(["at", "detail", "label"]);
    const bill = recent.find((e) => String(e["label"]).includes("月分の請求書を出した"));
    expect(String(bill?.["detail"])).toMatch(/^期限 \d{2}\/\d{2}$/);
    for (const e of recent.filter((x) => String(x["label"]).startsWith("メンバーが"))) expect(e["detail"]).toBeNull();
    const at = recent.map((e) => new Date(String(e["at"])).getTime());
    expect([...at].sort((a, b) => b - a)).toEqual(at);
    const labels = recent.map((e) => String(e["label"])).join("\n");
    expect(labels).toMatch(/メンバーが 1 人増えた（\d+ 人）/);
    expect(labels).not.toMatch(/朝から実行待ち/);
  });

  it("K966-API-005 止める印：止める予定の会社は stop に 理由・止める日・先に知らせた時刻（止めた時刻は null）で状態 active。止める日が今日になると止めた時刻が無くても stopped（D-156.49）。止めた会社は stopped", async () => {
    const x = await t.ws("止める予定");
    await t.f.admin.query(
      "update tenants set stop_on = '2099-11-29', stop_reason_key = 'violation', stop_noticed_at = '2026-11-22T01:00:00Z' where id = $1",
      [x.tenantId],
    );
    const d = (await ws(x.tenantId)).b.data as Row;
    expect(d["state"]).toBe("active");
    expect(d["stop"]).toEqual({
      reason_key: "violation",
      stop_on: "2099-11-29",
      stopped_at: null,
      noticed_at: "2026-11-22T01:00:00.000Z",
    });
    await t.f.admin.query("update tenants set stop_on = (now() at time zone 'Asia/Tokyo')::date where id = $1", [
      x.tenantId,
    ]);
    expect(((await ws(x.tenantId)).b.data as Row)["state"]).toBe("stopped");
    await t.f.admin.query("update tenants set stopped_at = '2026-11-29T00:00:00Z' where id = $1", [x.tenantId]);
    const s = (await ws(x.tenantId)).b.data as Row;
    expect(s["state"]).toBe("stopped");
    expect((s["stop"] as Row)["stopped_at"]).toBe("2026-11-29T00:00:00.000Z");
  });

  it("K966-API-006 中を見る：自分が開いた閉じていない期限内の許可だけ { id, expires_at, reason }（reason は許可の理由の字・帯の「理由：…」）。ほかの運営の人の許可・閉じた・期限切れは null", async () => {
    const x = await t.ws("中を見る");
    const grant = async (who: Person, o: { closed?: boolean; expired?: boolean } = {}) => {
      const om = (await t.row<{ id: string }>("select id from ops_members where member_id = $1", [who.id]))!.id;
      return (await t.row<{ id: string }>(
        `insert into support_access_grants (tenant_id, scope, ops_member_id, reason, expires_at, closed_at)
         values ($1, 'read', $2, '問い合わせの確かめ', now() + make_interval(mins => $3), $4) returning id`,
        [x.tenantId, om, o.expired ? -1 : 30, o.closed ? new Date().toISOString() : null],
      ))!.id;
    };
    await grant(opsNoInquiry);
    await grant(opsAll, { closed: true });
    await grant(opsAll, { expired: true });
    expect(((await ws(x.tenantId)).b.data as Row)["peek"]).toBeNull();
    const id = await grant(opsAll);
    const p = ((await ws(x.tenantId)).b.data as Row)["peek"] as Row;
    expect(Object.keys(p).sort()).toEqual(["expires_at", "id", "reason"]);
    expect(p["id"]).toBe(id);
    expect(p["reason"]).toBe("問い合わせの確かめ");
  });

  it("K966-API-007 指す会社が無い・見えない：運営の会社・無い uuid・作りかけ・消した会社は 404 で欄・details を付けない", async () => {
    const half = await t.ws("作りかけ");
    await t.f.admin.query("update tenants set half_made_at = now() where id = $1", [half.tenantId]);
    const gone = await t.ws("消した");
    await t.f.admin.query("update tenants set deleted_at = now() where id = $1", [gone.tenantId]);
    for (const id of [OPS_TENANT, randomUUID(), half.tenantId, gone.tenantId]) {
      for (const get of [ws, members]) {
        const { r, b } = await get(id);
        expect(r.status, id).toBe(404);
        expect(isFlat(b)).toBe(true);
      }
    }
  });

  it("K966-API-008 道の id の形の誤り（uuid でない・NUL）は 2 本とも 422・欄 id", async () => {
    for (const bad of ["abc", "%00"]) {
      for (const path of [`/ops/workspaces/${bad}`, `/ops/workspaces/${bad}/members`]) {
        const r = await t.call(opsAll, "GET", path);
        expect(r.status, path).toBe(422);
        expect(JSON.stringify(await t.json(r))).toMatch(/"id"/);
      }
    }
  });

  it("K966-API-009 中身を返さない：チケットの題・会話・預けたログイン情報の名前が答えに無い", async () => {
    const x = await t.ws("中身");
    await t.inquiry(x, { state: "open", title: "見せない題" });
    const s = JSON.stringify((await ws(x.tenantId)).b.data);
    expect(s).not.toMatch(/tickets|conversation|credential|GMAIL_WORK/);
  });
});

describe("K-966 1 社のメンバー（listOpsWorkspaceMembers）", () => {
  it("K966-API-010 1 行は 8 欄。役割の順（管理者 → マネージャー → メンバー → 閲覧のみ → ゲスト）・同じ役は名前の順。抜けた人は出ない。ゲスト（role requester）の役割の字は「ゲスト」・PC は none", async () => {
    const x = await t.ws("メンバー順");
    const v = await t.member(x, "い 閲覧", { role: "viewer" });
    const m2 = await t.member(x, "う メンバー");
    const m1 = await t.member(x, "あ メンバー");
    const mg = await t.member(x, "え マネージャー", { role: "manager" });
    const gone = await t.member(x, "お 抜けた");
    const guest = await t.member(x, "あ ゲスト", { role: "requester" });
    await t.f.admin.query("update tenant_memberships set status = 'left' where member_id = $1", [gone.id]);
    const { r, b } = await members(x.tenantId);
    expect(r.status).toBe(200);
    const rows = b.data as Row[];
    for (const e of rows) expect(Object.keys(e).sort()).toEqual(MEMBER_KEYS);
    expect(rows.map((e) => e["member_id"])).toEqual([x.admin.id, mg.id, m1.id, m2.id, v.id, guest.id]);
    expect(rows.map((e) => e["role_label"])).toEqual([
      "管理者",
      "マネージャー",
      "メンバー",
      "メンバー",
      "閲覧のみ",
      "ゲスト",
    ]);
    expect(rows.at(-1)!["pc"]).toBe("none");
    expect(JSON.stringify(rows)).not.toContain("依頼する側");
  });

  it("K966-API-011 メール・本人確認（kaname_auth の emailVerified）・入り方（パスキー・パスワード・2 段階）・最後に入った（画面のセッション）", async () => {
    const x = await t.ws("入り方");
    const mail = `yamamoto-${randomUUID().slice(0, 6)}@example.test`;
    const p = await t.member(x, "山本 由美", { authEmail: mail, verified: false });
    const au = await authOf(p);
    await t.f.admin.query(
      `insert into kaname_auth.passkey (id, name, "publicKey", "userId", "credentialID", counter, "deviceType", "backedUp", transports, "createdAt")
       values ($1, 'k966', 'x', $2, $3, 0, 'singleDevice', false, 'internal', now())`,
      [randomUUID(), au, randomUUID()],
    );
    const seen = (await t.row<{ at: Date }>(
      "insert into sessions (tenant_id, member_id, kind_id, last_seen_at) values ($1, $2, 'web', now() - interval '3 days') returning last_seen_at as at",
      [x.tenantId, p.id],
    ))!.at;
    const e = ((await members(x.tenantId)).b.data as Row[]).find((y) => y["member_id"] === p.id)!;
    expect([e["name"], e["email"], e["verified"]]).toEqual(["山本 由美", mail, false]);
    expect(e["login_methods"]).toEqual(["passkey"]);
    expect(new Date(String(e["last_seen_at"])).getTime()).toBe(seen.getTime());
  });

  it("K966-API-012 PC：生きている知らせが 90 秒の内＝connected・つないだが切れている＝paired・つないでいない＝never・閲覧のみ／ゲスト＝none", async () => {
    const x = await t.ws("PC");
    const on = await t.member(x, "あ つながる");
    const off = await t.member(x, "い 切れた");
    const no = await t.member(x, "う まだ");
    const view = await t.member(x, "え 閲覧", { role: "viewer" });
    await t.pc(x, on, { alive: true });
    await t.pc(x, off, { alive: false });
    const rows = (await members(x.tenantId)).b.data as Row[];
    const pcOf = (p: Person) => rows.find((y) => y["member_id"] === p.id)!["pc"];
    expect([pcOf(on), pcOf(off), pcOf(no), pcOf(view)]).toEqual(["connected", "paired", "never", "none"]);
  });

  it("K966-API-013 できること：メンバーは問い合わせ（inquiry）を持つ人だけ（持たない人は 403）。1 社は運営の人なら誰でも 200", async () => {
    expect((await members(w.tenantId, opsNoInquiry)).r.status).toBe(403);
    expect((await ws(w.tenantId, opsNoInquiry)).r.status).toBe(200);
  });
});

describe("K-966 守りと失敗", () => {
  it("K966-API-014 入口：ログインなしは 2 本とも 401・会社の人（その会社の管理者でも）は 403", async () => {
    for (const path of [`/ops/workspaces/${w.tenantId}`, `/ops/workspaces/${w.tenantId}/members`]) {
      expect((await t.call(null, "GET", path)).status).toBe(401);
      expect((await t.call(w.admin, "GET", path)).status).toBe(403);
    }
  });

  it("K966-API-015 関数の中の 2 層目（G-02）：会社の人の文脈で直に呼ぶと 42501。読んでも運営の記録・会社の記録は増えない", async () => {
    const asMember: TenantContext = { tenantId: w.tenantId, userId: w.admin.id, role: "member" };
    for (const sql of ["select app.ops_workspace($1)", "select app.ops_workspace_members($1)"]) {
      const e = await withTenant(t.f.pool, asMember, (c) => c.query(sql, [w.tenantId])).then(
        () => null,
        (x: { code?: string }) => x,
      );
      expect(e?.code, sql).toBe("42501");
    }
    const before = await t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1", [w.tenantId]);
    await ws(w.tenantId);
    await members(w.tenantId);
    expect(await t.n("select count(*) as n from ops_audit_events where target_tenant_id = $1", [w.tenantId])).toBe(
      before,
    );
  });

  it("K966-API-016 DB が落ちる（関数が無い）：2 本とも 503・E-PAGE-003 で、関数の名前を出さない", async () => {
    await t.f.admin.query("alter function app.ops_workspace(uuid) rename to ops_workspace_k966_saved");
    await t.f.admin.query("alter function app.ops_workspace_members(uuid) rename to ops_workspace_members_k966_saved");
    try {
      for (const get of [ws, members]) {
        const { r, b } = await get(w.tenantId);
        expect(r.status).toBe(503);
        expect(b["code"]).toBe("E-PAGE-003");
        expect(JSON.stringify(b)).not.toMatch(/ops_workspace/);
      }
    } finally {
      await t.f.admin.query("alter function app.ops_workspace_k966_saved(uuid) rename to ops_workspace");
      await t.f.admin.query(
        "alter function app.ops_workspace_members_k966_saved(uuid) rename to ops_workspace_members",
      );
    }
  });

  it("K966-API-018 中を見るの理由の字：開いたときの字をそのまま返す（「」入り・200 字ちょうどを切らない・前後を詰めない）。新しい許可は理由が必ず入る（0078 の reason_ck）ので null の行は作らない", async () => {
    const x = await t.ws("理由の字");
    const om = (await t.row<{ id: string }>("select id from ops_members where member_id = $1", [opsAll.id]))!.id;
    const put = async (reason: string) => {
      await t.f.admin.query(
        "update support_access_grants set closed_at = now() where tenant_id = $1 and closed_at is null",
        [x.tenantId],
      );
      await t.f.admin.query(
        `insert into support_access_grants (tenant_id, scope, ops_member_id, reason, expires_at)
         values ($1, 'read', $2, $3, now() + interval '30 minutes')`,
        [x.tenantId, om, reason],
      );
      return ((await ws(x.tenantId)).b.data as Row)["peek"] as Row;
    };
    const quoted = "問い合わせ「承認したのに動かない」";
    expect((await put(quoted))["reason"]).toBe(quoted);
    const long = "あ".repeat(199) + "」";
    expect([...long].length).toBe(200);
    expect((await put(long))["reason"]).toBe(long);
    const spaced = " 障害の調べ ";
    const p = await put(spaced);
    expect(Object.keys(p).sort()).toEqual(["expires_at", "id", "reason"]);
    expect(p["reason"]).toBe(spaced);
  });

  it("K966-API-019 理由はその許可を開いた運営の人だけに出す：同じ会社を読むほかの運営の人は peek null で理由の字が答えに無い・会社の人（管理者）は 403 で理由の字が無い", async () => {
    const x = await t.ws("理由を見せない");
    const other = await t.ops("ほかの運営の人");
    const om = (await t.row<{ id: string }>("select id from ops_members where member_id = $1", [opsAll.id]))!.id;
    const secret = "請求の確認「k966-019-ひみつ」";
    await t.f.admin.query(
      `insert into support_access_grants (tenant_id, scope, ops_member_id, reason, expires_at)
       values ($1, 'read', $2, $3, now() + interval '30 minutes')`,
      [x.tenantId, om, secret],
    );
    expect((((await ws(x.tenantId)).b.data as Row)["peek"] as Row)["reason"]).toBe(secret);
    const seen = await ws(x.tenantId, other);
    expect(seen.r.status).toBe(200);
    expect((seen.b.data as Row)["peek"]).toBeNull();
    expect(JSON.stringify(seen.b)).not.toContain("k966-019");
    const r = await t.call(x.admin, "GET", `/ops/workspaces/${x.tenantId}`);
    expect(r.status).toBe(403);
    expect(JSON.stringify(await t.json(r))).not.toContain("k966-019");
  });

  it("K966-API-020 人数：一覧の members.count と同じ数（K-961 の app.tenant_seat_count：消していない人のメンバーのうちゲストでない人）。ゲストを足しても変わらず、メンバーを 1 人消すと 1 減る", async () => {
    const x = await t.ws("人数", { members: 3 });
    await t.pc(x, x.admin, { alive: true });
    const n0 = ((await ws(x.tenantId)).b.data as Row)["members"] as Row;
    const row = async () => {
      const r = await t.call(opsAll, "GET", `/ops/workspaces?q=${encodeURIComponent(x.name)}`);
      const items = (await t.json(r)).data as Row[];
      return (items.find((i) => i["id"] === x.tenantId)!["members"] as Row)["count"];
    };
    expect(n0["count"]).toBe(await row());
    await t.member(x, "ゲスト 人数", { role: "requester" });
    expect((((await ws(x.tenantId)).b.data as Row)["members"] as Row)["count"]).toBe(n0["count"]);
    const one = (await t.row<{ id: string }>(
      `select member_id as id from tenant_memberships
        where tenant_id = $1 and role = 'member' and deleted_at is null order by created_at, member_id limit 1`,
      [x.tenantId],
    ))!.id;
    await t.f.admin.query("update members set deleted_at = now() where id = $1", [one]);
    await t.f.admin.query("update tenant_memberships set status = 'left' where tenant_id = $1 and member_id = $2", [
      x.tenantId,
      one,
    ]);
    const n1 = (((await ws(x.tenantId)).b.data as Row)["members"] as Row)["count"] as number;
    expect(n1).toBe((n0["count"] as number) - 1);
    expect(n1).toBe(await row());
  });

  it("K966-API-021 済んでいない問い合わせの数（タブ「問い合わせ N」）：open・waiting・later を数え、done・消した問い合わせ・ほかの会社の問い合わせは数えない。数だけで題を返さない", async () => {
    const x = await t.ws("問い合わせの数");
    const y = await t.ws("ほかの会社の問い合わせ");
    const count = async () => (((await ws(x.tenantId)).b.data as Row)["inquiries"] as Row)["open"];
    expect(await count()).toBe(0);
    await t.inquiry(x, { state: "open", title: "k966-021-題" });
    await t.inquiry(x, { state: "waiting" });
    await t.inquiry(x, { state: "later" });
    await t.inquiry(x, { state: "done" });
    const gone = await t.inquiry(x, { state: "open" });
    await t.f.admin.query("update inquiries set deleted_at = now() where id = $1", [gone]);
    await t.inquiry(y, { state: "open" });
    expect(await count()).toBe(3);
    const d = (await ws(x.tenantId)).b;
    expect(Object.keys((d.data as Row)["inquiries"] as Row)).toEqual(["open"]);
    expect(JSON.stringify(d)).not.toContain("k966-021");
    const money = await ws(x.tenantId, opsNoInquiry);
    expect(money.r.status).toBe(200);
    expect(((money.b.data as Row)["inquiries"] as Row)["open"]).toBe(3);
  });

  it("K966-API-017 上限：getOpsWorkspace を上限まで呼んだ次が 429・retry_after_sec は 1〜60 の整数", async () => {
    t.f.limits["getOpsWorkspace"] = 1;
    try {
      const ip = "203.0.113.166";
      const get = () => t.f.req("GET", `/ops/workspaces/${w.tenantId}`, { headers: opsAll.auth, ip });
      expect((await get()).status).toBe(200);
      const r = await get();
      expect(r.status).toBe(429);
      const s = (await t.json(r))["retry_after_sec"];
      expect(Number.isInteger(s) && (s as number) >= 1 && (s as number) <= 60).toBe(true);
    } finally {
      delete t.f.limits["getOpsWorkspace"];
    }
  });
});
