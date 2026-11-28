// K-895「依頼を断る（declineClientRequest）」の単体の試験
//   （口と DB・本物の Postgres・本物の行の守り・口の入口は createApp と契約の op・偽の画面のログイン・メールは試験の偽）。行 ID（K895-API-…）は 11_tickets/K-895.md の表の行と 1 対 1。
//   口の振る舞いは葉の hooks のファイル apps/api/src/hooks/client-requests-decline.ts の register（K-326）。道具は requests-world.ts（K-892）。
// 試験が決める口の形（契約は 05_flow/screen_api.d/K-895.py で作る）:
//   declineClientRequest  POST /api/v1/client_requests/:id/decline  body { reason: string（1〜2000・知らない欄は 422）} → 200 { data: { state: "done" } }
//     断り：見えない・無い・消した・別の会社・前の形は 404・E-GST-100／読むだけは 403／もう決まっている 409・E-GST-130／ゲストの文脈 403／ログインなし 401／503 E-PAGE-003
//     断ると依頼は declined（理由は依頼の行に残り出し手に見える）・取り消せない。出し手の受け箱（inapp・client_request.declined）に 1 件＋メール 1 通（リンクだけ）。メールが送れなくても 200
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { makeFixture, type Fixture, type Person } from "../fixture.js";
import {
  asJson,
  failOn,
  guest,
  hasNoDetail,
  inbox,
  mailer,
  mails,
  n,
  NO_SUCH,
  request,
  useHooks,
  world,
  type Json,
} from "./requests-world.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const ERRORS = (
  JSON.parse(readFileSync(join(ROOT, "07_qa/test-specs/errors.json"), "utf8")) as {
    errors: { id: string; message: string }[];
  }
).errors;
const msg = (code: string): string => ERRORS.find((e) => e.id === code)?.message ?? `（errors.json に ${code} が無い）`;

let f: Fixture;
beforeAll(async () => {
  f = await makeFixture([]);
  for (const h of [
    "client-requests-read",
    "client-requests-route-reply",
    "client-requests-accept",
    "client-requests-decline",
  ])
    await useHooks(f, h);
}, 60_000);
afterAll(async () => {
  await f?.close();
});

const decline = (
  id: string,
  body: unknown,
  p: Person | null,
  role: "member" | "client" = "member",
  headers: Record<string, string> = {},
) => f.req("POST", `/client_requests/${id}/decline`, { body, headers: { ...(p ? f.as(p, role) : {}), ...headers } });
const refused = async (r: Response, status: number, code: string): Promise<void> => {
  expect(r.status, await r.clone().text()).toBe(status);
  const j = await asJson(r);
  expect(j["code"]).toBe(code);
  expect(j["message"]).toBe(msg(code));
  expect(hasNoDetail(j)).toBe(true);
};
const row = async (rid: string) =>
  (
    await f.admin.query<{ state: string; decline_reason: string | null; ticket_id: string | null }>(
      "select state, decline_reason, ticket_id from client_requests where id = $1",
      [rid],
    )
  ).rows[0]!;
const audit = async (w: { tenantId: string }) =>
  (
    await f.admin.query<{ payload: Json }>(
      "select payload from audit_events where tenant_id = $1 and action = 'client_request.declined'",
      [w.tenantId],
    )
  ).rows.map((r) => r.payload);
const emailRows = (rid: string) =>
  f.admin.query<{ sent_at: Date | null; failed_at: Date | null }>(
    "select sent_at, failed_at from notifications where channel_id = 'email' and event_kind_id = 'client_request.declined' and payload->>'request_id' = $1",
    [rid],
  );
async function giveEmail(p: Person, email: string): Promise<void> {
  const uid = randomUUID();
  await f.admin.query(
    'insert into kaname_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt", "twoFactorEnabled") values ($1, $2, $3, true, now(), now(), false)',
    [uid, "ゲスト", email],
  );
  await f.admin.query("update members set auth_user_id = $2 where id = $1", [p.id, uid]);
}
async function setup(tag: string, o: { email?: string; state?: "new" | "asking" } = {}) {
  const w = await world(f, tag);
  const a = await guest(f, w, "山田", w.gA);
  if (o.email) await giveEmail(a, o.email);
  const rid = await request(f, w, w.gA, a, {
    title: "見積もりの依頼",
    body: "秘密の依頼本文",
    state: o.state ?? "new",
  });
  return { w, a, rid };
}
const addr = () => `d-${randomUUID().slice(0, 6)}@guest.example`;

describe("K-895 依頼を断る（declineClientRequest）", () => {
  it("K895-API-001 断る：200・答えの鍵は state だけで done・DB は state declined・decline_reason は空白が取れた理由・ticket_id は空のまま・やり取りの行は増えない", async () => {
    const { w, rid } = await setup("001");
    const r = await decline(rid, { reason: "  今回は受けられません  " }, w.staff);
    expect(r.status, await r.clone().text()).toBe(200);
    expect(r.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    const d = (await asJson(r)).data as Json;
    expect(Object.keys(d)).toEqual(["state"]);
    expect(d["state"]).toBe("done");
    expect(await row(rid)).toEqual({ state: "declined", decline_reason: "今回は受けられません", ticket_id: null });
    expect(await n(f, "select count(*) as n from client_request_messages where client_request_id = $1", [rid])).toBe(0);
  });

  it("K895-API-002 入力：理由の長さ。2000 字は通る・2001 字は 422・何も変えない", async () => {
    const { w, a, rid } = await setup("002");
    expect((await decline(rid, { reason: "あ".repeat(2001) }, w.staff)).status).toBe(422);
    expect((await row(rid)).state).toBe("new");
    const rid2 = await request(f, w, w.gA, a, {});
    expect((await decline(rid2, { reason: "あ".repeat(2000) }, w.staff)).status).toBe(200);
  });

  it("K895-API-003 入力：理由が無い・空・空白だけ・全角空白だけ・数字・知らない欄・uuid でない道の :id はどれも 422・何も変えない・受け箱もメールも 0。全角英数は NFKC の字で入る", async () => {
    const { w, a, rid } = await setup("003", { email: addr() });
    const before = mails.length;
    for (const b of [
      {},
      { reason: "" },
      { reason: "   " },
      { reason: "　" },
      { reason: 3 },
      { reason: "x", state: "new" },
    ]) {
      expect((await decline(rid, b, w.staff)).status, JSON.stringify(b)).toBe(422);
    }
    expect((await decline("not-a-uuid", { reason: "x" }, w.staff)).status).toBe(422);
    expect((await row(rid)).state).toBe("new");
    expect(mails.length).toBe(before);
    expect(await inbox(f, a.id, "client_request.declined")).toBe(0);
    expect((await decline(rid, { reason: "ＡＢＣ　１２３" }, w.staff)).status).toBe(200);
    expect((await row(rid)).decline_reason).toBe("ABC 123");
  });

  it("K895-API-004 失敗：もう決まっている依頼（チケットにした・断った）を断るは 409・E-GST-130・正本の文・欄・details なし・何も変えない・受け箱もメールも 0", async () => {
    const { w, a } = await setup("004");
    const before = mails.length;
    for (const state of ["ticketed", "declined"] as const) {
      const rid = await request(f, w, w.gA, a, { state });
      const was = await row(rid);
      await refused(await decline(rid, { reason: "遅れた断り" }, w.staff), 409, "E-GST-130");
      expect(await row(rid)).toEqual(was);
    }
    expect(mails.length).toBe(before);
    expect(await inbox(f, a.id, "client_request.declined")).toBe(0);
  });

  it("K895-API-005 守り（権限・見えない依頼）：届け先で edit できる人・管理者は 200。読むだけの人は 403・別のグループの人・消した・別の会社・前の取引先の形・知らない id は 404・E-GST-100・ゲストの文脈は 403・ログインなしは 401・何も変えない", async () => {
    const { w, a, rid } = await setup("005");
    const dead = await request(f, w, w.gA, a, { deleted: true });
    const client = (
      await f.admin.query<{ id: string }>(
        "insert into clients (tenant_id, name) values ($1, '前の取引先') returning id",
        [w.tenantId],
      )
    ).rows[0]!.id;
    const legacy = (
      await f.admin.query<{ id: string }>(
        "insert into client_requests (tenant_id, client_id, title) values ($1, $2, '前の形') returning id",
        [w.tenantId, client],
      )
    ).rows[0]!.id;
    expect((await decline(rid, { reason: "読むだけ" }, w.viewer)).status).toBe(403);
    await refused(await decline(rid, { reason: "別のグループ" }, w.outsider), 404, "E-GST-100");
    for (const id of [dead, legacy, NO_SUCH])
      await refused(await decline(id, { reason: "x" }, w.boss), 404, "E-GST-100");
    expect((await decline(rid, { reason: "ゲスト" }, a, "client")).status).toBe(403);
    expect((await decline(rid, { reason: "誰か" }, null)).status).toBe(401);
    expect((await row(rid)).state).toBe("new");
    expect((await decline(rid, { reason: "管理者" }, w.boss)).status).toBe(200);
  });

  it("K895-API-006 断った後の読み（K-892）：一覧で state done・tag 断った・1 件の request に declined_reason が付く（ticket_id は無い）。asking の依頼も断れる", async () => {
    const { w, rid } = await setup("006", { state: "asking" });
    expect((await decline(rid, { reason: "お断りします" }, w.staff)).status).toBe(200);
    const list = (
      (await asJson(await f.req("GET", "/client_requests", { headers: f.as(w.staff, "member") }))).data as {
        items: { id: string; state: string; tag?: string }[];
      }
    ).items;
    expect(list.find((x) => x.id === rid)).toMatchObject({ state: "done", tag: "断った" });
    const one = (
      (await asJson(await f.req("GET", `/client_requests/${rid}`, { headers: f.as(w.staff, "member") }))).data as {
        request: Json;
      }
    ).request;
    expect(one["declined_reason"]).toBe("お断りします");
    expect(Object.keys(one)).not.toContain("ticket_id");
  });

  it("K895-API-007 受け箱：出し手の受け箱に 1 件（inapp・client_request.declined・payload は request_id と ref だけで理由・題は無い）。同じグループの別のゲスト・社内の人には入らない。出し手が抜けた人なら入らず断りは書く", async () => {
    const { w, a, rid } = await setup("007");
    const other = await guest(f, w, "同じグループの鈴木", w.gA);
    expect((await decline(rid, { reason: "秘密の理由" }, w.staff)).status).toBe(200);
    expect(await inbox(f, a.id, "client_request.declined")).toBe(1);
    expect(await inbox(f, other.id, "client_request.declined")).toBe(0);
    expect(await inbox(f, w.staff.id, "client_request.declined")).toBe(0);
    const p = (
      await f.admin.query<{ payload: Json }>(
        "select payload from notifications where member_id = $1 and event_kind_id = 'client_request.declined'",
        [a.id],
      )
    ).rows[0]!.payload;
    expect(p).toEqual({ request_id: rid, ref: rid });
    const rid2 = await request(f, w, w.gA, a, {});
    await f.admin.query("update members set deleted_at = now() where id = $1", [a.id]);
    expect((await decline(rid2, { reason: "抜けたあと" }, w.staff)).status).toBe(200);
    expect(await inbox(f, a.id, "client_request.declined")).toBe(1);
    expect((await row(rid2)).state).toBe("declined");
  });

  it("K895-API-008 メール：宛先が分かれば 1 通・件名は「Kaname：依頼について連絡が届きました」・本文は依頼の画面へのリンクだけ（理由・依頼の題・本文・社内の人の名前を載せない）・email の行が sent_at 付き。宛先が分からなければ送らず記録もしない", async () => {
    const to = addr();
    const { w, rid } = await setup("008", { email: to });
    const before = mails.length;
    expect((await decline(rid, { reason: "載せない理由" }, w.staff)).status).toBe(200);
    const sent = mails.slice(before);
    expect(sent.length).toBe(1);
    expect(sent[0]!.to).toBe(to);
    expect(sent[0]!.subject).toBe("Kaname：依頼について連絡が届きました");
    expect(sent[0]!.text).toContain(`/portal/requests/${rid}`);
    for (const secret of ["載せない理由", "見積もりの依頼", "秘密の依頼本文", "営業の人"])
      expect(sent[0]!.text + sent[0]!.subject, secret).not.toContain(secret);
    const rows = (await emailRows(rid)).rows;
    expect(rows.length).toBe(1);
    expect(rows[0]!.sent_at).not.toBeNull();
    const none = await setup("008 宛先なし");
    const b2 = mails.length;
    expect((await decline(none.rid, { reason: "宛先が無い" }, none.w.staff)).status).toBe(200);
    expect(mails.length).toBe(b2);
    expect((await emailRows(none.rid)).rows.length).toBe(0);
  });

  it("K895-API-009 失敗（手順 2・3 のメール）[残る]：メールが送れない：200・断りと inapp の受け箱は残り email の行に failed_at。結果を書けない：200・答えに宛ては出ない", async () => {
    const to = addr();
    const { w, a, rid } = await setup("009", { email: to });
    mailer.fail = true;
    try {
      expect((await decline(rid, { reason: "メールが落ちる" }, w.staff)).status).toBe(200);
    } finally {
      mailer.fail = false;
    }
    expect((await row(rid)).state).toBe("declined");
    expect(await inbox(f, a.id, "client_request.declined")).toBe(1);
    const rows = (await emailRows(rid)).rows;
    expect(rows.length).toBe(1);
    expect(rows[0]!.failed_at).not.toBeNull();
    const second = await setup("009 記録", { email: addr() });
    await failOn(f, "notifications", "new.channel_id = 'email'", async () => {
      const r = await decline(second.rid, { reason: "記録が落ちる" }, second.w.staff);
      expect(r.status).toBe(200);
      expect(JSON.stringify(await asJson(r))).not.toContain("guest.example");
    });
    expect((await row(second.rid)).state).toBe("declined");
  });

  it("K895-API-010 守り（証跡）：client_request.declined が 1 行・payload は request_id だけ（理由は無い）。断られた物は書かない", async () => {
    const { w, rid } = await setup("010");
    await decline(rid, { reason: "" }, w.staff);
    await decline(rid, { reason: "読むだけ" }, w.viewer);
    expect((await decline(rid, { reason: "証跡の理由" }, w.staff)).status).toBe(200);
    expect(await audit(w)).toEqual([{ request_id: rid }]);
  });

  it("K895-API-011 失敗（手順 1 の途中）：受け箱の行を書けなければ 503・E-PAGE-003・依頼は同じ状態のまま・理由も証跡も残らない（1 つの取引）・理由は答えに出ない・押し直せる", async () => {
    const { w, rid } = await setup("011");
    await failOn(f, "notifications", "new.event_kind_id = 'client_request.declined'", async () => {
      const r = await decline(rid, { reason: "落ちる理由" }, w.staff);
      expect(r.status).toBe(503);
      const j = await asJson(r);
      expect(j["code"]).toBe("E-PAGE-003");
      expect(JSON.stringify(j)).not.toContain("落ちる理由");
    });
    expect(await row(rid)).toEqual({ state: "new", decline_reason: null, ticket_id: null });
    expect((await audit(w)).length).toBe(0);
    expect((await decline(rid, { reason: "直った" }, w.staff)).status).toBe(200);
  });

  it("K895-API-012 操作の揺れ：同時に 2 本は片方が 200・もう片方が 409・E-GST-130・メールは 1 通", async () => {
    const { w, rid } = await setup("012", { email: addr() });
    const before = mails.length;
    const rs = await Promise.all([
      decline(rid, { reason: "同時 1" }, w.staff, "member", { "idempotency-key": randomUUID() }),
      decline(rid, { reason: "同時 2" }, w.boss, "member", { "idempotency-key": randomUUID() }),
    ]);
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409]);
    expect(mails.length - before).toBe(1);
  });

  it("K895-API-013 操作の揺れ：同じ冪等キーで 2 回は 200・同じ答え・メール 1 通。キーが違えば 2 回目は 409・E-GST-130", async () => {
    const { w, rid } = await setup("013", { email: addr() });
    const before = mails.length;
    const key = { "idempotency-key": randomUUID() };
    const [r1, r2] = [
      await decline(rid, { reason: "二度押し" }, w.staff, "member", key),
      await decline(rid, { reason: "二度押し" }, w.staff, "member", key),
    ];
    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(mails.length - before).toBe(1);
    await refused(
      await decline(rid, { reason: "別のキー" }, w.staff, "member", { "idempotency-key": randomUUID() }),
      409,
      "E-GST-130",
    );
  });

  it("K895-API-014 守り（取り消せない）：断った後、チケットにする（K-894）は 409・E-GST-120・返事・届け先の変更は 409・E-GST-110・もう一度断るは 409・E-GST-130。状態は declined のまま", async () => {
    const { w, rid } = await setup("014");
    await decline(rid, { reason: "お断り" }, w.staff);
    const as = f.as(w.staff, "member");
    await refused(
      await f.req("POST", `/client_requests/${rid}/accept`, {
        body: { assignee_member_id: w.staff.id, due_on: "2026-12-31", scope_id: w.reqScope },
        headers: as,
      }),
      409,
      "E-GST-120",
    );
    await refused(
      await f.req("POST", `/client_requests/${rid}/reply`, { body: { body: "あとから" }, headers: as }),
      409,
      "E-GST-110",
    );
    await refused(
      await f.req("PATCH", `/client_requests/${rid}`, { body: { route_id: w.reqScope }, headers: as }),
      409,
      "E-GST-110",
    );
    await refused(await decline(rid, { reason: "もう一度" }, w.staff), 409, "E-GST-130");
    expect((await row(rid)).state).toBe("declined");
  });

  it("K895-API-015 対象の状態：同じゲストのグループの別の依頼・別のグループの依頼は変わらない", async () => {
    const { w, a, rid } = await setup("015");
    const b = await guest(f, w, "別のグループの佐藤", w.gB);
    const [same, other] = [await request(f, w, w.gA, a, {}), await request(f, w, w.gB, b, {})];
    await decline(rid, { reason: "これだけ" }, w.staff);
    expect((await row(same)).state).toBe("new");
    expect((await row(other)).state).toBe("new");
  });

  it("K895-API-016 守り（上限）：同じ人が上限を超えたら 429・retry_after_sec は 1〜60 の整数・no-store", async () => {
    const { w, rid } = await setup("016");
    f.limits["declineClientRequest"] = 2;
    try {
      const rs = [];
      for (let i = 0; i < 3; i++) rs.push(await decline(rid, {}, w.staff));
      expect(rs[2]!.status).toBe(429);
      const j = await asJson(rs[2]!);
      expect(Number.isInteger(j["retry_after_sec"])).toBe(true);
      expect(j["retry_after_sec"] as number).toBeGreaterThanOrEqual(1);
      expect(j["retry_after_sec"] as number).toBeLessThanOrEqual(60);
      expect(rs[2]!.headers.get("cache-control") ?? "").toContain("no-store");
    } finally {
      delete f.limits["declineClientRequest"];
    }
  });

  it("K895-API-017 守り（no-store）：200・404・409 の答えに Cache-Control の private か no-store が付く", async () => {
    const { w, rid } = await setup("017");
    const [ok, gone, done] = [
      await decline(rid, { reason: "答え" }, w.staff),
      await decline(NO_SUCH, { reason: "x" }, w.boss),
      await decline(rid, { reason: "x" }, w.staff),
    ];
    for (const r of [ok, gone, done]) expect(r.headers.get("cache-control") ?? "").toMatch(/no-store|private/);
    expect([ok.status, gone.status, done.status]).toEqual([200, 404, 409]);
  });
});
