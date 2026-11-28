// K-998 中間（段 13・お金の筋）：運営が月の請求書をまとめて出す → 顧客が読む → 入金を記録 → 払われた（取り消すと戻る）／
//   値段の案を作る → 影響を見る → 別の人が決める → 顧客の「選べるプラン」に変わる月が出る・いまの顧客にお知らせ（口の組）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   中の 1 本 1 本の分岐は単体の葉（K-958・K-981・K-982・K-983・K-1013・K-987〜K-990・K-1017・K-961）が持つ。ここは、運営の口で書いた物を
//   顧客の口が読む所だけ：請求書の状態 3 つ（お支払い待ち／払われた／期限を過ぎた・D-156.29）・入金の差と取り消し（D-156.32）・
//   金額（D-156.31）・決めた版の変わる月と知らせ（D-125.125・D-156.21）。
//   土台は 2 つを読むだけ（変えない）：請求は K-981 の billing-ops.harness.ts、値段の案は K-987 の ops-plans.harness.ts。
//   共用の DB なので請求の月は 2014 年の昔の月を使い、行は名前の頭（run）で見る。昔の月の期限（翌月の末日）は過ぎているので、出した請求書は「期限を過ぎた」から始まる。
//   B 行は 1 本の筋で上から順に流れる（SB に前の行の結果）。P 行も 1 本の筋（SP）。P-006 は自分の案を作る
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startBillingOps, jstDay, STEP, type BillingOps, type Who, type World } from "./billing-ops.harness.js";
import { startOpsPlans, PROPOSALS, type OpsPlans } from "./ops-plans.harness.js";
import type { Ws } from "./ops-ws.harness.js";
import type { Person } from "../fixture.js";

type Row = Record<string, unknown>;
const MONTH = "2014-03";
const NOTICE = "来年からチームの値段が変わります。くわしくは設定の「プランと支払い」をご覧ください";

let b: BillingOps;
let money: Who;
let w: World; // ミナト企画（チームの契約）
const SB: { invoice?: string } = {};

let p: OpsPlans;
let kimura: Person; // 案を作る人（決める人でもある）
let sato: Person; // 決める人
let team: Ws; // チームの顧客
const SP: { proposal?: string; existingFrom?: string; price?: number } = {};

beforeAll(async () => {
  b = await startBillingOps("k998b", [
    "ops-invoices-issue",
    "ops-invoice-payments",
    "ops-invoices-list",
    "billing-read",
  ]);
  money = await b.opsWho("佐野", ["money"]);
  w = await b.world("ミナト企画");
  await b.contract(w, "team", "2013-01-01");
  p = await startOpsPlans("k998p", [
    "ops-plans-write",
    "ops-plans-impact",
    "ops-plans-decide",
    "plans",
    "notices-read",
  ]);
  kimura = await p.ops("木村", ["plan_propose", "plan_decide"]);
  sato = await p.ops("佐藤", ["plan_decide"]);
  team = await p.ws("チームの会社", { plan: "team" });
});
afterAll(async () => {
  await p?.close();
  await b?.close();
});

const ok = async (r: Response, label = "") => {
  expect(r.status, `${label} ${await r.clone().text()}`).toBeLessThan(300);
  return (await r.json()) as Row & { data?: unknown };
};
const issue = (body: Row) => b.call(money, "POST", "/ops/invoices/issue", body, { stepUpAgoSec: STEP });
const pay = (id: string, body: Row) =>
  b.call(money, "POST", `/ops/invoices/${id}/payments`, body, { stepUpAgoSec: STEP });
const billing = async (who: Who = w.admin) => (await ok(await b.call(who, "GET", "/workspace/billing"))).data as Row;
const myInvoice = async (who: Who = w.admin) =>
  ((await billing(who))["invoices"] as Row[]).find((x) => x["id"] === SB.invoice);
const opsRow = async () =>
  b
    .mine((await ok(await b.call(money, "GET", `/ops/invoices?month=${MONTH}`))).data)
    .find((x) => x["id"] === SB.invoice);

describe("K-998 請求書を出す → 読む → 入金 → 払われた（1 本の筋）", () => {
  it("K998-B-001 下書き：その会社の行はチームの値段＋税 10%（15,000 → 16,500）。まだ請求書は無く、顧客の請求書の一覧にも出ない", async () => {
    const j = await ok(await issue({ month: MONTH, dry_run: true }));
    const line = b.mine((j.data as Row)["lines"]).find((l) => (l["workspace"] as Row)["id"] === w.tenantId)!;
    expect([line["amount"], line["tax"], line["total"]]).toEqual([15000, 1500, 16500]);
    expect(await b.invoiceOf(w, MONTH)).toBeUndefined();
    expect(((await billing())["invoices"] as Row[]).length).toBe(0);
  });

  it("K998-B-002 出すと、管理者と「プランと支払い」の人の請求書の一覧に出る（16,500・期限を過ぎた・表の上の注意）。ほかの人は見られない（403）。管理者にだけ鈴が 1 つ。運営の請求の一覧も期限を過ぎた・入金を記録できる", async () => {
    await ok(await issue({ month: MONTH }));
    SB.invoice = String((await b.invoiceOf(w, MONTH))!["id"]);
    const mine = (await myInvoice())!;
    expect([mine["month"], mine["amount_total"], mine["state"]]).toEqual([MONTH, 16500, "overdue"]);
    expect(((await billing())["overdue"] as Row)["count"]).toBeGreaterThanOrEqual(1);
    expect((await myInvoice(w.payer))!["id"]).toBe(SB.invoice);
    expect((await b.call(w.staff, "GET", "/workspace/billing")).status).toBe(403);
    expect(await b.bells(w, "billing.invoice_issued")).toEqual({ admin: 1, payer: 0, staff: 0 });
    const o = (await opsRow())!;
    expect([o["state"], o["can_record_payment"]]).toEqual(["overdue", true]);
  });

  it("K998-B-003 請求書の PDF：顧客の管理者が開くと 200 で、開く先（url）と期限が返る", async () => {
    const j = await ok(await b.call(w.admin, "GET", `/invoices/${SB.invoice}/pdf`));
    expect(Object.keys(j.data as Row).sort()).toEqual(["expires_at", "url"]);
  });

  it("K998-B-004 足りない入金（6,500）は顧客にも運営にも払われたにならない（期限を過ぎたのまま）。運営の行の差は 10,000", async () => {
    await ok(await pay(SB.invoice!, { amount: 6500, paid_on: jstDay() }));
    expect((await myInvoice())!["state"]).toBe("overdue");
    const o = (await opsRow())!;
    expect([o["state"], o["paid_total"], o["difference"]]).toEqual(["overdue", 6500, 10000]);
  });

  it("K998-B-005 残り（10,000）を記録すると、顧客の一覧は払われた（paid_on は入金の日）・運営は paid で記録できない・顧客の表の上の注意からこの請求書が外れる", async () => {
    const before = ((await billing())["overdue"] as Row | null)?.["count"] as number | undefined;
    await ok(await pay(SB.invoice!, { amount: 10000, paid_on: jstDay() }));
    const mine = (await myInvoice())!;
    expect([mine["state"], mine["paid_on"]]).toEqual(["paid", jstDay()]);
    const o = (await opsRow())!;
    expect([o["state"], o["can_record_payment"]]).toEqual(["paid", false]);
    const after = ((await billing())["overdue"] as Row | null)?.["count"] as number | undefined;
    expect((after ?? 0) - (before ?? 0)).toBe(-1);
  });

  it("K998-B-006 打ち間違いを取り消すと、打ち消しの行が足され（元は消えない）、顧客の一覧はまた期限を過ぎたに戻る・運営は記録できる", async () => {
    const last = (await b.row<{ id: string }>(
      "select id from payments where invoice_id = $1 and amount > 0 order by created_at desc limit 1",
      [SB.invoice],
    ))!.id;
    await ok(await pay(SB.invoice!, { amount: 10000, paid_on: jstDay(), reverses_payment_id: last }));
    expect(await b.n("select count(*) as n from payments where invoice_id = $1", [SB.invoice])).toBe(3);
    expect((await myInvoice())!["state"]).toBe("overdue");
    expect((await opsRow())!["can_record_payment"]).toBe(true);
  });

  it("K998-B-007 同じ月をもう一度出すと、この会社の請求書は増えない（出す物が無ければ 409・E-BILL-003）", async () => {
    const before = await b.n("select count(*) as n from invoices where tenant_id = $1 and issued_at is not null", [
      w.tenantId,
    ]);
    const r = await issue({ month: MONTH });
    if (r.status === 409) expect(((await r.json()) as Row)["code"]).toBe("E-BILL-003");
    else expect(r.status).toBe(201);
    expect(
      await b.n("select count(*) as n from invoices where tenant_id = $1 and issued_at is not null", [w.tenantId]),
    ).toBe(before);
  });
});

describe("K-998 値段の案 → 影響 → 決める → 変わる月（1 本の筋）", () => {
  it("K998-P-001 木村さんがチームの値上げの案（90 日前に知らせる）を作って回すと waiting。顧客の選べるプランは今の値段のまま・変わるの印は無い", async () => {
    const plan = await p.plan("team");
    SP.price = plan.price + 3000;
    const d = (
      await ok(
        await p.act(kimura, "POST", PROPOSALS, {
          plan_key: "team",
          price_monthly: SP.price,
          member_limit: plan.members + 2,
          existing_policy: "after_days",
          notice_days: 90,
          new_from: null,
          reason: `${p.run} 人数の上限に当たる会社が多いため`,
        }),
        "作る",
      )
    ).data as Row;
    SP.proposal = String(d["id"]);
    expect(
      ((await ok(await p.act(kimura, "POST", `${PROPOSALS}/${SP.proposal}/submit`, {}))).data as Row)["state"],
    ).toBe("waiting");
    const cur = ((await ok(await p.act(team.admin, "GET", "/workspace/plans"))).data as Row[]).find(
      (x) => x["current"] === true,
    )!;
    expect([cur["price_monthly"], cur["upcoming"]]).toEqual([plan.price, null]);
  });

  it("K998-P-002 影響を見ると、この回のチームの会社が変わる会社に在り、その会社の変わる月は案全体の変わる月（existing_from）と同じ", async () => {
    const d = (await ok(await p.act(kimura, "GET", `${PROPOSALS}/${SP.proposal}/impact`))).data as Row;
    SP.existingFrom = String(d["existing_from"]);
    const row = ((d["by_workspace"] ?? []) as Row[]).find((x) => (x["workspace"] as Row)["id"] === team.tenantId);
    expect(row).toBeDefined();
    expect(row!["from_month"]).toBe(SP.existingFrom);
    expect([row!["after_price"], d["immediate"]]).toEqual([SP.price, false]);
  });

  it("K998-P-003 自分の案は決められない（ほかに決める人が居る）：木村さんが決めると 409・E-OPS-022。佐藤さんが本人確認を取り直して決めると decided", async () => {
    const self = await p.act(
      kimura,
      "POST",
      `${PROPOSALS}/${SP.proposal}/decide`,
      { notice_body: NOTICE },
      { stepUpAgoSec: STEP },
    );
    expect(self.status).toBe(409);
    expect(((await self.json()) as Row)["code"]).toBe("E-OPS-022");
    const d = (
      await ok(
        await p.act(
          sato,
          "POST",
          `${PROPOSALS}/${SP.proposal}/decide`,
          { notice_body: NOTICE },
          { stepUpAgoSec: STEP },
        ),
        "決める",
      )
    ).data as Row;
    expect(d["state"]).toBe("decided");
  });

  it("K998-P-004 決めた後、チームの顧客の選べるプランに「変わる」が出る（新しい値段・変わる月は影響の月・今の値段はそのまま）。顧客のお知らせに決めた文が出る・鈴は増えない", async () => {
    const plan = await p.plan("team");
    const cur = ((await ok(await p.act(team.admin, "GET", "/workspace/plans"))).data as Row[]).find(
      (x) => x["current"] === true,
    )!;
    expect(cur["price_monthly"]).not.toBe(SP.price);
    const up = cur["upcoming"] as Row;
    expect([up["price_monthly"], up["from_month"]]).toEqual([SP.price, SP.existingFrom]);
    expect(plan.version).toBeGreaterThanOrEqual(2);
    const notices = ((await ok(await p.act(team.admin, "GET", "/notices"))).data as Row[]).filter(
      (x) => x["body"] === NOTICE,
    );
    expect(notices.length).toBeGreaterThanOrEqual(1);
    expect(await p.n("select count(*) as n from notifications where tenant_id = $1", [team.tenantId])).toBe(0);
  });

  it("K998-P-005 ずっと今の値段（keep）のビジネスの案を決めても、ビジネスの顧客の選べるプランに「変わる」は出ず、お知らせも増えない", async () => {
    const biz = await p.ws("ビジネスの会社", { plan: "business" });
    const plan = await p.plan("business");
    const d = (
      await ok(
        await p.act(kimura, "POST", PROPOSALS, {
          plan_key: "business",
          price_monthly: plan.price + 5000,
          member_limit: plan.members,
          existing_policy: "keep",
          new_from: null,
          reason: `${p.run} 新しく入る会社だけ上げる`,
        }),
      )
    ).data as Row;
    const id = String(d["id"]);
    await ok(await p.act(kimura, "POST", `${PROPOSALS}/${id}/submit`, {}));
    const n0 = ((await ok(await p.act(biz.admin, "GET", "/notices"))).data as Row[]).length;
    await ok(await p.act(sato, "POST", `${PROPOSALS}/${id}/decide`, { notice_body: NOTICE }, { stepUpAgoSec: STEP }));
    const cur = ((await ok(await p.act(biz.admin, "GET", "/workspace/plans"))).data as Row[]).find(
      (x) => x["current"] === true,
    )!;
    expect(cur["upcoming"]).toBeNull();
    expect(((await ok(await p.act(biz.admin, "GET", "/notices"))).data as Row[]).length).toBe(n0);
  });

  it("K998-P-006 差し戻すと returned で顧客には何も出ず、作った人が直すと下書きに戻る（もう一度回せる）", async () => {
    const plan = await p.plan("free");
    const d = (
      await ok(
        await p.act(kimura, "POST", PROPOSALS, {
          plan_key: "free",
          price_monthly: plan.price,
          member_limit: plan.members + 1,
          existing_policy: "after_days",
          notice_days: 30,
          new_from: null,
          reason: `${p.run} 無料の人数を 1 人増やす`,
        }),
      )
    ).data as Row;
    const id = String(d["id"]);
    await ok(await p.act(kimura, "POST", `${PROPOSALS}/${id}/submit`, {}));
    const back = (await ok(await p.act(sato, "POST", `${PROPOSALS}/${id}/return`, { reason: "上げ幅を見直す" })))
      .data as Row;
    expect(back["state"]).toBe("returned");
    const again = (await ok(await p.act(kimura, "PATCH", `${PROPOSALS}/${id}`, { member_limit: plan.members + 2 })))
      .data as Row;
    expect(again["state"]).toBe("draft");
    expect(((await ok(await p.act(kimura, "POST", `${PROPOSALS}/${id}/submit`, {}))).data as Row)["state"]).toBe(
      "waiting",
    );
  });
});
