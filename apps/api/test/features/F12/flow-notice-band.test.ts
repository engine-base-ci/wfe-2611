// K-997 中間（段 13・お知らせの筋）：運営がお知らせを書く → 出す → 顧客の一覧と上の帯に出る → 読んだ印／障害の続報 → 直った（口の組）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   中の 1 本 1 本の分岐は単体の葉（K-954・K-955・K-977・K-1014・K-978・K-979）が持つ。ここは、運営の口で書いた物を顧客の口が読む所だけ：
//   誰に（全部／プラン／ワークスペース・D-156.33）・出す場所（帯／一覧）・予定（出す日時を過ぎたら出る・時間で動く仕組みは使わない）・
//   既読（D-156.27）・障害の状態と続報・鈴に出さない（D-156.28）・メールは使えなくなるメンテだけ管理者へ。
//   土台は K-977 の ops-notice.harness.ts（会社と人は K-963 の ops-ws.harness.ts）を読むだけ（変えない）。
//   お知らせは運営の会社の行で共用の DB の全部が混ざるので、この回の題の頭（run）の行だけを見る（t.mine）。
//   行 001〜005 は 1 本の筋（障害）で上から順に流れる（S に前の行の結果を持つ）。006〜012 は筋ごとに自分のお知らせを作る
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startOpsNotices, type OpsNotices } from "./ops-notice.harness.js";
import type { Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

type Row = Record<string, unknown>;
let t: OpsNotices;
let takamoto: Person;
let a: Ws; // ミナト企画（チーム）
let b: Ws; // 北村デザイン（ビジネス）
let aStaff: Person;
const S: { incident?: string } = {};

beforeAll(async () => {
  t = await startOpsNotices("k997", [
    "ops-notices-write",
    "ops-notices-publish",
    "ops-notices-incident",
    "ops-notices-read",
    "notices-read",
    "service-status-member",
  ]);
  takamoto = await t.ops("高本");
  a = await t.ws("ミナト企画", { plan: "team" });
  b = await t.ws("北村デザイン", { plan: "business" });
  aStaff = await t.member(a, "メンバー");
});
afterAll(async () => {
  await t.close();
});

const at = (sec: number) => new Date(Date.now() + sec * 1000).toISOString();
const ok = async (r: Response) => {
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  return (await t.json(r)).data as Row;
};
/** 誰にの既定は、この回の 2 社（ミナト企画・北村デザイン）だけ。全部の会社に出すと、共用の DB のほかの会社の管理者にメールを出し、
 *  予定の時間・直っていない間はほかのファイルの帯にも出てしまう。体に audience_mode があるとき（J-008 のプラン）は既定の宛先を入れない
 *  （plans に audience_workspace_ids を付けると K-1014 の形の決まりで 422 になる） */
const make = async (body: Row) => {
  const who = body["audience_mode"]
    ? {}
    : { audience_mode: "workspaces", audience_workspace_ids: [a.tenantId, b.tenantId] };
  const d = await ok(
    await t.call(takamoto, "POST", "/ops/notices", {
      ...who,
      placements: ["band", "list"],
      ...body,
    }),
  );
  return String(d["id"]);
};
const publish = async (id: string) => ok(await t.call(takamoto, "POST", `/ops/notices/${id}/publish`, {}));
const seen = async (who: Person): Promise<Row[]> => t.mine((await t.json(await t.call(who, "GET", "/notices"))).data);
const one = async (who: Person, id: string) => (await seen(who)).find((x) => x["id"] === id);
const bands = async (who: Person): Promise<Row[]> =>
  ((await ok(await t.call(who, "GET", "/service-status")))["bands"] as Row[]) ?? [];
const band = async (who: Person, id: string) => (await bands(who)).find((x) => x["notice_id"] === id);
const opsRow = async (id: string) => ok(await t.call(takamoto, "GET", `/ops/notices/${id}`));
const bellsOf = (...ws: Ws[]) =>
  t.n("select count(*) as n from notifications where tenant_id = any($1::uuid[])", [ws.map((w) => w.tenantId)]);

describe("K-997 障害を出す → 帯と一覧 → 読む → 続報 → 直った（1 本の筋）", () => {
  it("K997-J-001 ミナト企画だけに向けた障害を下書きにすると、運営の一覧は下書き（届く数 1 社）。顧客の一覧にも上の帯にも出ない", async () => {
    S.incident = await make({
      kind: "incident",
      title: `${t.run} チケットの実行が止まっています`,
      body: "原因を調べています",
      audience_mode: "workspaces",
      audience_workspace_ids: [a.tenantId],
    });
    const d = await opsRow(S.incident);
    expect(d["state"]).toBe("draft");
    expect((d["reach"] as Row)["workspaces"]).toBe(1);
    expect(await one(a.admin, S.incident)).toBeUndefined();
    expect(await band(a.admin, S.incident)).toBeUndefined();
  });

  it("K997-J-002 出すと、ミナト企画の人の一覧に「まだ読んでいない」で出て、上の帯に「調べている」の障害が 1 つ（閉じられる）。北村デザインには一覧にも帯にも出ない。鈴もメールも増えない", async () => {
    const bell0 = await bellsOf(a, b);
    const mail0 = t.mails.calls.length;
    const d = await publish(S.incident!);
    expect([d["state"], d["incident_state"]]).toEqual(["published", "investigating"]);
    const row = (await one(a.admin, S.incident!))!;
    expect([row["unread"], row["state"]]).toEqual([true, "investigating"]);
    const bd = (await band(a.admin, S.incident!))!;
    expect([bd["kind"], bd["state"], bd["closable"]]).toEqual(["incident", "investigating", true]);
    expect(await one(b.admin, S.incident!)).toBeUndefined();
    expect(await band(b.admin, S.incident!)).toBeUndefined();
    expect(await bellsOf(a, b)).toBe(bell0);
    expect(t.mails.calls.length).toBe(mail0);
  });

  it("K997-J-003 続報（原因が分かった）を足すと、顧客の一覧の状態と続報・上の帯の状態が「identified」に揃う", async () => {
    await ok(
      await t.call(takamoto, "POST", `/ops/notices/${S.incident}/updates`, {
        state: "identified",
        body: "PC との接続の不具合です",
      }),
    );
    const row = (await one(a.admin, S.incident!))!;
    expect(row["state"]).toBe("identified");
    const ups = row["updates"] as Row[];
    expect([ups.at(-1)!["state"], ups.at(-1)!["body"]]).toEqual(["identified", "PC との接続の不具合です"]);
    expect((await band(a.admin, S.incident!))!["state"]).toBe("identified");
    expect((await opsRow(S.incident!))["incident_state"]).toBe("identified");
  });

  it("K997-J-004 管理者が開いて読んだ印を付けると、管理者の一覧では読んだ（unread false）。同じ会社のメンバーはまだ読んでいない", async () => {
    await ok(await t.call(a.admin, "POST", `/notices/${S.incident}/read`, {}));
    expect((await one(a.admin, S.incident!))!["unread"]).toBe(false);
    expect((await one(aStaff, S.incident!))!["unread"]).toBe(true);
    expect((await seen(aStaff)).some((x) => x["id"] === S.incident)).toBe(true);
  });

  it("K997-J-005 直ったにすると、上の帯から消え、顧客の一覧と運営の一覧は resolved。直った後の続報は 409・E-OPS-013", async () => {
    await ok(
      await t.call(takamoto, "POST", `/ops/notices/${S.incident}/updates`, { state: "resolved", body: "直りました" }),
    );
    expect(await band(a.admin, S.incident!)).toBeUndefined();
    expect((await one(a.admin, S.incident!))!["state"]).toBe("resolved");
    expect((await opsRow(S.incident!))["state"]).toBe("resolved");
    const r = await t.call(takamoto, "POST", `/ops/notices/${S.incident}/updates`, { state: "monitoring", body: "x" });
    expect(r.status).toBe(409);
    expect((await t.json(r))["code"]).toBe("E-OPS-013");
  });
});

describe("K-997 筋ごとのお知らせ", () => {
  it("K997-J-006 メンテを予定で出すと、出す口を押した時に届く会社（この回の 2 社）の管理者へメールが 1 通ずつ。予定の日時の前は顧客の一覧にも帯にも出ない・運営の一覧は scheduled", async () => {
    const mail0 = t.mails.calls.length;
    const id = await make({
      kind: "maintenance",
      title: `${t.run} 夜のメンテナンス`,
      body: "21 時から 1 時間使えません",
      impact: "全部の画面",
      maintenance_from: at(7200),
      maintenance_to: at(10800),
      publish_at: at(3600),
    });
    const d = await publish(id);
    expect(d["state"]).toBe("scheduled");
    const sent = t.mails.calls.slice(mail0).filter((m) => m.subject.includes("夜のメンテナンス"));
    expect(sent.length).toBe(2);
    expect(new Set(sent.map((m) => m.to)).size).toBe(2);
    expect(await one(a.admin, id)).toBeUndefined();
    expect(await band(a.admin, id)).toBeUndefined();
  });

  it("K997-J-007 時間の流れ：予定の日時を過ぎると（時間で動く仕組みなしに）顧客の一覧と上の帯に出て、運営の一覧も published。帯の from・to はメンテの時間", async () => {
    const id = await make({
      kind: "maintenance",
      title: `${t.run} 朝のメンテナンス`,
      body: "6 時から使えません",
      impact: "全部の画面",
      maintenance_from: at(3600),
      maintenance_to: at(7200),
      publish_at: at(600),
    });
    expect((await publish(id))["state"]).toBe("scheduled");
    await t.f.admin.query("update notices set publish_at = now() - interval '5 seconds' where id = $1", [id]);
    expect(await one(a.admin, id)).toBeDefined();
    const bd = (await band(b.admin, id))!;
    expect(bd["kind"]).toBe("maintenance");
    expect(Date.parse(String(bd["to"])) - Date.parse(String(bd["from"]))).toBe(3_600_000);
    expect((await opsRow(id))["state"]).toBe("published");
  });

  it("K997-J-008 誰に：プランで選んだ（ビジネスだけ）お知らせは北村デザインにだけ出る。1 社に送る（ミナト企画）お知らせはミナト企画にだけ出る", async () => {
    const plan = await make({
      kind: "release",
      title: `${t.run} ビジネスの新しい機能`,
      body: "使えるようになりました",
      audience_mode: "plans",
      audience_plans: ["business"],
      placements: ["list"],
    });
    await publish(plan);
    expect(await one(b.admin, plan)).toBeDefined();
    expect(await one(a.admin, plan)).toBeUndefined();
    const sent = await ok(
      await t.call(takamoto, "POST", `/ops/workspaces/${a.tenantId}/notices`, {
        title: `${t.run} ミナト企画さまへ`,
        body: "請求書の宛名を直しました",
        placements: ["list"],
      }),
    );
    const id = String(sent["id"]);
    expect(await one(a.admin, id)).toBeDefined();
    expect(await one(b.admin, id)).toBeUndefined();
  });

  it("K997-J-009 出す場所：一覧だけのお知らせは帯に出ず、帯だけのお知らせは一覧に出ない", async () => {
    const listOnly = await make({ kind: "release", title: `${t.run} 一覧だけ`, body: "x", placements: ["list"] });
    const bandOnly = await make({ kind: "incident", title: `${t.run} 帯だけ`, body: "y", placements: ["band"] });
    await publish(listOnly);
    await publish(bandOnly);
    expect(await one(a.admin, listOnly)).toBeDefined();
    expect(await band(a.admin, listOnly)).toBeUndefined();
    expect(await band(a.admin, bandOnly)).toBeDefined();
    expect(await one(a.admin, bandOnly)).toBeUndefined();
    await ok(
      await t.call(takamoto, "POST", `/ops/notices/${bandOnly}/updates`, { state: "resolved", body: "直りました" }),
    );
  });

  it("K997-J-010 出した後に題と本文を直すと顧客の一覧の字が変わる。誰にを変えようとすると 409・E-OPS-009 で、届く会社は変わらない", async () => {
    const id = await make({ kind: "release", title: `${t.run} 直す前`, body: "前の本文", placements: ["list"] });
    await publish(id);
    await ok(await t.call(takamoto, "PATCH", `/ops/notices/${id}`, { title: `${t.run} 直した後`, body: "後の本文" }));
    const row = (await one(a.admin, id))!;
    expect([row["title"], row["body"]]).toEqual([`${t.run} 直した後`, "後の本文"]);
    const r = await t.call(takamoto, "PATCH", `/ops/notices/${id}`, {
      audience_mode: "workspaces",
      audience_workspace_ids: [b.tenantId],
    });
    expect(r.status).toBe(409);
    expect((await t.json(r))["code"]).toBe("E-OPS-009");
    expect(await one(a.admin, id)).toBeDefined();
  });

  it("K997-J-011 帯の重なり：直っていない障害が 2 つあると、帯は新しい 1 つと「ほか 1 件」（more 1）", async () => {
    const old = await make({ kind: "incident", title: `${t.run} 古い障害`, body: "x" });
    await publish(old);
    await t.f.admin.query(
      "update status_incidents set started_at = now() - interval '10 minutes' where notice_id = $1",
      [old],
    );
    const fresh = await make({ kind: "incident", title: `${t.run} 新しい障害`, body: "y" });
    await publish(fresh);
    const incidents = (await bands(a.admin)).filter((x) => x["kind"] === "incident");
    expect(incidents).toHaveLength(1);
    expect(incidents[0]!["notice_id"]).toBe(fresh);
    expect(Number(incidents[0]!["more"])).toBeGreaterThanOrEqual(1);
    for (const id of [old, fresh])
      await ok(await t.call(takamoto, "POST", `/ops/notices/${id}/updates`, { state: "resolved", body: "直りました" }));
  });

  it("K997-J-012 守り：顧客の口からは、まだ出していない下書きの 1 件を読んだ印にできない（404）。運営のお知らせは一筋を通しても鈴に 1 行も出ない", async () => {
    const bell0 = await bellsOf(a, b);
    const id = await make({ kind: "release", title: `${t.run} 下書きのまま`, body: "z", placements: ["list"] });
    expect((await t.call(a.admin, "POST", `/notices/${id}/read`, {})).status).toBe(404);
    const pub = await make({ kind: "release", title: `${t.run} 鈴の確かめ`, body: "w", placements: ["band", "list"] });
    await publish(pub);
    expect(await bellsOf(a, b)).toBe(bell0);
  });
});
