// K-996 中間（段 13・問い合わせの筋）：顧客が問い合わせる → 運営が受信箱で取って返す → 顧客が返事を読む → 済みにする（口の組）。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//   中の 1 本 1 本の分岐は単体の葉（K-949・K-951・K-952・K-973・K-974・K-975）が持つ。ここは、前の葉の結果を次の葉が読む所だけ：
//   顧客の状態（返事を待っている／返事あり／済み・D-156.25）と運営の状態（open・waiting・later・done）と受信箱の箱・外枠の数・鈴（D-156.28）が、
//   1 本の筋の上で揃って進むか。土台は K-973 の ops-inbox.harness.ts（顧客の側は K-949 の inquiry.harness.ts）を読むだけ（変えない）。
//   行 001〜010 は 1 本の筋で上から順に流れる（S に前の行の結果を持つ）。011〜013 は筋ごとに自分の会社を作る
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startOpsInbox, type OpsInbox } from "./ops-inbox.harness.js";
import type { World } from "./inquiry.harness.js";
import type { Person } from "../fixture.js";

type Row = Record<string, unknown>;
let t: OpsInbox;
let takamoto: Person; // 運営 高本（受信箱の担当）
let sano: Person; // 運営 佐野（取り合いの相手）
let w: World; // ミナト企画（田中＝問い合わせる人・山口＝管理者・先方の人）
const S: { id?: string } = {};

beforeAll(async () => {
  t = await startOpsInbox("k996", [
    "inquiry-read",
    "inquiry-reply",
    "ops-inbox-read",
    "ops-inbox-update",
    "ops-inbox-reply",
    "ops-workspaces",
  ]);
  takamoto = await t.ops("高本");
  sano = await t.ops("佐野");
  w = await t.world("ミナト企画");
});
afterAll(async () => {
  await t.close();
});

const data = async (r: Response) => {
  expect(r.status, await r.clone().text()).toBeLessThan(300);
  return (await t.json(r)).data as Row;
};
const box = async (name: string, who: Person = takamoto): Promise<string[]> => {
  // 上限の 100 件で読む（共用の DB で前の回の問い合わせが増えても、この回の 1 件が既定の 50 件から押し出されない）
  const r = await t.call(who, "GET", `/ops/inquiries?box=${name}&limit=100`);
  expect(r.status).toBe(200);
  return ((await t.json(r)).data as Row[]).map((x) => String(x["id"]));
};
const inbox = async () =>
  ((await data(await t.call(takamoto, "GET", "/ops/shell"))) as Row)["inbox"] as Row as Record<string, number>;
const mineList = async (who: Person = w.asker) =>
  (await data(await t.call(who, "GET", "/inquiries"))) as unknown as Row[];
const myOne = (who: Person = w.asker, id = S.id!) => t.call(who, "GET", `/inquiries/${id}`);
const opsOne = async (id = S.id!) => data(await t.call(takamoto, "GET", `/ops/inquiries/${id}`));
const bells = (who: Person) =>
  t.n(
    "select count(*) as n from notifications where member_id = $1 and event_kind_id = 'inquiry.replied' and channel_id = 'inapp'",
    [who.id],
  );
const stateOf = async (who: Person = w.asker, id = S.id!) =>
  (await mineList(who)).find((x) => x["id"] === id)?.["state"];

describe("K-996 問い合わせる → 運営が返す → 返事を読む → 済み（1 本の筋）", () => {
  it("K996-J-001 田中さんが「承認したのに動かない」を問い合わせると、運営の受信箱の未担当の箱に入り、外枠の未担当の数が 1 増える。田中さんの一覧では「返事を待っている」", async () => {
    const before = await inbox();
    const d = await data(
      await t.call(w.asker, "POST", "/inquiries", {
        topic: "trouble",
        title: "承認したのに動かない",
        body: "実行待ちのまま 1 時間たちます",
      }),
    );
    S.id = String(d["id"]);
    expect(d["state"]).toBe("waiting");
    expect(await box("unassigned")).toContain(S.id);
    expect((await inbox())["unassigned"]! - before["unassigned"]!).toBe(1);
    expect(await stateOf()).toBe("waiting");
  });

  it("K996-J-002 運営が 1 件を開くと、会社の名前・聞いた人・最初の内容と右の様子が読める。同じ会社の管理者からは見えない（本人だけ・D-156.25）", async () => {
    const d = await opsOne();
    expect((d["workspace"] as Row)["id"]).toBe(w.tenantId);
    expect((d["asker"] as Row)["name"]).toBe("田中");
    const msgs = d["messages"] as Row[];
    expect(msgs.map((m) => m["kind"])).toEqual(["customer"]);
    expect(msgs[0]!["body"]).toBe("実行待ちのまま 1 時間たちます");
    expect(d["workspace_status"]).toEqual(expect.objectContaining({ plan_name: expect.anything() }));
    expect((await myOne(w.admin)).status).toBe(404);
    expect((await mineList(w.admin)).some((x) => x["id"] === S.id)).toBe(false);
  });

  it("K996-J-003 高本さんが取ると、未担当の箱から自分の箱に移り、外枠の数も未担当 −1・自分 +1。佐野さんが取ろうとすると 409・E-OPS-005 で担当は高本さんのまま", async () => {
    const before = await inbox();
    const d = await data(await t.call(takamoto, "PATCH", `/ops/inquiries/${S.id}`, { take: true }));
    expect((d["owner"] as Row)["member_id"]).toBe(takamoto.id);
    expect(await box("unassigned")).not.toContain(S.id);
    expect(await box("mine")).toContain(S.id);
    const after = await inbox();
    expect([after["unassigned"]! - before["unassigned"]!, after["mine"]! - before["mine"]!]).toEqual([-1, 1]);
    const r = await t.call(sano, "PATCH", `/ops/inquiries/${S.id}`, { take: true });
    expect(r.status).toBe(409);
    expect((await t.json(r))["code"]).toBe("E-OPS-005");
    expect(((await opsOne())["owner"] as Row)["member_id"]).toBe(takamoto.id);
  });

  it("K996-J-004 社内メモを書くと運営の 1 件には出るが、田中さんの 1 件には字が無く、鈴も増えない・状態も変わらない", async () => {
    const b0 = await bells(w.asker);
    await data(await t.call(takamoto, "POST", `/ops/inquiries/${S.id}/notes`, { body: "Bridge の再起動を案内する" }));
    expect(((await opsOne())["messages"] as Row[]).map((m) => m["kind"])).toEqual(["customer", "note"]);
    const r = await myOne();
    expect(r.status).toBe(200);
    expect(await r.text()).not.toContain("Bridge の再起動を案内する");
    expect(await bells(w.asker)).toBe(b0);
    expect(await stateOf()).toBe("waiting");
  });

  it("K996-J-005 高本さんが返すと、田中さんの一覧は「返事あり」・返事の印が立ち、田中さんにだけ鈴が 1 つ（同じ会社の管理者には出ない）。運営の側は waiting で待ちの箱に入る", async () => {
    const b0 = await bells(w.asker);
    const a0 = await bells(w.admin);
    await data(
      await t.call(takamoto, "POST", `/ops/inquiries/${S.id}/replies`, {
        body: "PC の Bridge を一度閉じて開き直してください",
      }),
    );
    const row = (await mineList()).find((x) => x["id"] === S.id)!;
    expect(row["state"]).toBe("replied");
    expect(row["has_unread_reply"]).toBe(true);
    expect(await bells(w.asker)).toBe(b0 + 1);
    expect(await bells(w.admin)).toBe(a0);
    expect((await opsOne())["state"]).toBe("waiting");
    expect(await box("waiting")).toContain(S.id);
  });

  it("K996-J-006 田中さんが 1 件を開くと、やり取りは 自分の最初の内容 → 運営の返事 の 2 つ（社内メモは無い）。開いた後は返事の印が下りる", async () => {
    const d = await data(await myOne());
    const msgs = d["messages"] as Row[];
    expect(msgs.map((m) => m["from"])).toEqual(["me", "ops"]);
    expect(msgs[1]!["author_name"]).toBe("運営 高本");
    expect((await mineList()).find((x) => x["id"] === S.id)!["has_unread_reply"]).toBe(false);
  });

  it("K996-J-007 田中さんが返事を書くと、田中さんは「返事を待っている」に戻り、運営の側は open（担当は高本さんのまま・自分の箱）。運営の 1 件のやり取りは 客 → メモ → 返事 → 客 の順", async () => {
    await data(
      await t.call(w.asker, "POST", `/inquiries/${S.id}/messages`, { body: "開き直しても実行待ちのままです" }),
    );
    expect(await stateOf()).toBe("waiting");
    const d = await opsOne();
    expect(d["state"]).toBe("open");
    expect((d["owner"] as Row)["member_id"]).toBe(takamoto.id);
    expect((d["messages"] as Row[]).map((m) => m["kind"])).toEqual(["customer", "note", "reply", "customer"]);
    expect(await box("mine")).toContain(S.id);
  });

  it("K996-J-008 田中さんが済みにすると、運営の側も done で済みの箱に入り、自分の箱と外枠の自分の数から消える", async () => {
    const before = await inbox();
    await data(await t.call(w.asker, "POST", `/inquiries/${S.id}/resolve`, {}));
    expect(await stateOf()).toBe("done");
    expect((await opsOne())["state"]).toBe("done");
    expect(await box("done")).toContain(S.id);
    expect(await box("mine")).not.toContain(S.id);
    expect((await inbox())["mine"]! - before["mine"]!).toBe(-1);
  });

  it("K996-J-009 済みの後に田中さんが書くと開き直る：田中さんは「返事を待っている」・運営は open で自分の箱に戻る", async () => {
    await data(await t.call(w.asker, "POST", `/inquiries/${S.id}/messages`, { body: "また止まりました" }));
    expect(await stateOf()).toBe("waiting");
    expect((await opsOne())["state"]).toBe("open");
    expect(await box("mine")).toContain(S.id);
    expect(await box("done")).not.toContain(S.id);
  });

  it("K996-J-010 高本さんが返してから運営の側で済みにすると、田中さんの一覧も「済み」", async () => {
    await data(
      await t.call(takamoto, "POST", `/ops/inquiries/${S.id}/replies`, { body: "直しました。もう一度お試しください" }),
    );
    await data(await t.call(takamoto, "PATCH", `/ops/inquiries/${S.id}`, { state: "done" }));
    expect(await stateOf()).toBe("done");
    expect(await box("done")).toContain(S.id);
  });
});

describe("K-996 筋ごとの会社", () => {
  it("K996-J-011 時間の流れ：運営が「後で」にすると後での箱に入り、顧客には「返事を待っている」のまま。顧客が書くと運営は open に戻り、後での日時は空になる", async () => {
    const v = await t.world("後で");
    const id = await t.asked(v, "請求書の宛名を変えたい", "billing");
    await data(await t.call(takamoto, "PATCH", `/ops/inquiries/${id}`, { take: true }));
    const later = new Date(Date.now() + 3_600_000).toISOString();
    await data(await t.call(takamoto, "PATCH", `/ops/inquiries/${id}`, { later_until: later }));
    expect(await box("later")).toContain(id);
    expect(await stateOf(v.asker, id)).toBe("waiting");
    await data(await t.call(v.asker, "POST", `/inquiries/${id}/messages`, { body: "急ぎです" }));
    const d = await opsOne(id);
    expect([d["state"], d["later_until"]]).toEqual(["open", null]);
    expect(await box("later")).not.toContain(id);
  });

  it("K996-J-012 守り：別の会社の人の一覧と 1 件に、この会社の問い合わせは出ない（404）。先方の権限の人は問い合わせを作れない（403）・受信箱の数も増えない", async () => {
    const a = await t.world("会社 A");
    const b = await t.world("会社 B");
    const id = await t.asked(a, "A の問い合わせ");
    expect((await mineList(b.asker)).some((x) => x["id"] === id)).toBe(false);
    expect((await myOne(b.asker, id)).status).toBe(404);
    const before = await inbox();
    const r = await t.call(a.guest, "POST", "/inquiries", { topic: "usage", title: "先方から", body: "書けますか" });
    expect(r.status).toBe(403);
    expect((await inbox())["unassigned"]).toBe(before["unassigned"]);
  });

  it("K996-J-013 記録：1 本の筋で、運営の記録に取る（inquiry.take）と返す（inquiry.reply）が残り、顧客の会社の記録に問い合わせる（inquiry.create）と済みにする（inquiry.resolve）が残る。どの記録にも内容の字が無い", async () => {
    const v = await t.world("記録");
    const id = await t.asked(v, "記録の筋");
    await data(await t.call(takamoto, "PATCH", `/ops/inquiries/${id}`, { take: true }));
    await data(await t.call(takamoto, "POST", `/ops/inquiries/${id}/replies`, { body: "記録に残らない字 1234" }));
    await data(await t.call(v.asker, "POST", `/inquiries/${id}/resolve`, {}));
    const ops = (
      await t.f.admin.query<{ action: string }>(
        "select action from ops_audit_events where target_tenant_id = $1 order by occurred_at",
        [v.tenantId],
      )
    ).rows.map((x) => x.action);
    expect(ops).toEqual(expect.arrayContaining(["inquiry.take", "inquiry.reply"]));
    const mine = (
      await t.f.admin.query<{ action: string; t: string }>(
        "select action, a::text as t from audit_events a where tenant_id = $1",
        [v.tenantId],
      )
    ).rows;
    for (const act of ["inquiry.create", "inquiry.resolve"])
      expect(
        mine.some((x) => x.action.includes(act)),
        act,
      ).toBe(true);
    expect(mine.some((x) => x.t.includes("記録に残らない字 1234"))).toBe(false);
  });
});
