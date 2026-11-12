// K-161「承認待ちを見る（一覧と 1 件）」の単体の試験（口・本物の DB・本物の PC の印）。親 K-63 の試験を孫ごとに分けたもの（行 ID と中身は分ける前のまま・11_tickets/K-161.md の表のマスと分岐に 1 対 1）。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。土台・道具・決めた文は ./approve-complete.harness.ts。
import { describe, expect, it } from "vitest";
import {
  setupApproveComplete,
  CHECK_NONE,
  LIMIT_DEFAULT,
  b64url,
  ARTIFACT,
  f,
  limits,
  T,
  boss,
  json,
  auth,
  req,
  queue,
  detail,
  team,
  ticket,
  delegated,
  approvalRow,
  details,
  jstDate,
} from "./approve-complete.harness.js";

setupApproveComplete();

describe("K-63 承認して完了する：承認・差し戻し（口・本物の DB）", () => {
  it("K63-API-001 承認待ち × 承認待ちの画面を開く × 承認する人：自分が決めるものだけ、期限の早い順（期限なしは最後）。数は行の数と同じ。検査なしの印", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "一覧を見る人", ticketAbility: "edit" });
    const late = await ticket({ assignee: who, due: jstDate(10) });
    const none = await ticket({ assignee: who, due: null });
    const soon = await ticket({ assignee: who, due: jstDate(0) });
    const a1 = await delegated(late, { irreversible: false });
    const a2 = await delegated(none);
    const a3 = await delegated(soon);
    const r = await queue(who);
    expect(r.status).toBe(200);
    const j = await json(r);
    const rows = j.data as unknown as Record<string, unknown>[];
    expect(rows.map((x) => x["id"])).toEqual([a3.approvalId, a1.approvalId, a2.approvalId]);
    expect((j.meta!["counts"] as { total: number }).total).toBe(3);
    const first = rows[0]!;
    expect(first).toMatchObject({
      kind: "artifact",
      ticket_id: soon.id,
      ticket_number: soon.number,
      title: "11 月分の請求書を送る",
      from_member_id: a3.by.id,
      from_name: "山田",
      check_summary: CHECK_NONE,
      due_on: jstDate(0),
      irreversible: true,
      decide_inline: false,
      primary_action: "open",
      secondary_action: "return",
    });
    const inline = rows.find((x) => x["id"] === a1.approvalId)!;
    expect(inline).toMatchObject({ decide_inline: true, primary_action: "approve", irreversible: false });
  });
});

describe("K-63 承認して完了する：入力・失敗・守り（口・本物の DB）", () => {
  it("K63-API-040 入力 × 一覧の limit・cursor・sort が形違い（cursor は鍵の文字列だけ。位置の数・復号できない・3 つに分かれない・日付や uuid でない は 422・欄 cursor）", async () => {
    for (const q of [
      "?limit=0",
      "?limit=201",
      "?limit=abc",
      "?cursor=-1",
      "?cursor=x",
      "?cursor=5", // 位置の数は、共通の入口は通すがこの口は鍵でないので断る（D-131.9）
      `?cursor=${b64url("2026-11-10|x")}`, // 3 つに分かれない
      `?cursor=${b64url("きょう|2026-11-10T00:00:00Z|not-a-uuid")}`, // 日付・uuid でない
      "?sort=drop%20table",
      "?sort=nope",
    ]) {
      const r = await queue(boss, q);
      expect(r.status, q).toBe(422);
      if (q.startsWith("?cursor")) expect(details(await json(r)).map((x) => x.field)).toContain("cursor");
    }
    expect((await queue(boss, "?limit=1")).status).toBe(200);
  });

  it("K63-API-046 守り × 一覧・1 件を 1 分に 121 回：429・待つ秒数", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "上限 読む", ticketAbility: "edit" });
    const t = await ticket({ assignee: who });
    const d = await delegated(t);
    for (const [op, call] of [
      ["listApprovalQueue", () => queue(who)],
      ["getApproval", () => detail(who, d.approvalId)],
    ] as const) {
      limits[op] = 120;
      try {
        for (let i = 0; i < 120; i++) expect((await call()).status).toBe(200);
        const r = await call();
        expect(r.status, op).toBe(429);
        expect(Number((await json(r))["retry_after_sec"])).toBeGreaterThan(0);
      } finally {
        limits[op] = 10_000;
      }
    }
  });

  it("K63-API-050 守り × 1 件の中身：成果物の版・検査なしの印・取り消せないの注意・決められるか（承認する人は true）", async () => {
    const t = await ticket();
    const d = await delegated(t, { irreversible: true });
    const r = await detail(boss, d.approvalId);
    expect(r.status).toBe(200);
    const data = (await json(r)).data as Record<string, unknown>;
    expect(data["can_decide"]).toBe(true);
    expect(data["irreversible"]).toBe(true);
    expect(data["check_summary"]).toBe(CHECK_NONE);
    expect(data["checks"]).toEqual([]);
    expect(JSON.stringify(data["cautions"])).toContain("取り消せません");
    expect(data["artifact_version"]).toMatchObject({ text: ARTIFACT });
    expect(data["ticket"]).toMatchObject({ id: t.id, number: t.number, stage_key: "awaiting_approval" });
    expect(data["approval"]).toMatchObject({
      id: d.approvalId,
      decision: null,
      approver_member_id: boss.id,
      approver_name: "高本",
    });
  });
});

describe("K-63 承認して完了する：積む仕事の中身（口・本物の DB）", () => {
  it("K63-API-064 守り × 一覧を PC の印・取引先の人で呼ぶ：403（社内の人だけ）。何も書かない", async () => {
    const tm = await team("一覧を PC で呼ぶ人");
    const t = await ticket({ assignee: tm.by });
    const d = await delegated(t);
    const viaPc = await req("GET", "/approvals/queue", { headers: { "x-bridge-session": tm.pc.token } });
    expect(viaPc.status).toBe(403);
    const viaClient = await req("GET", "/approvals/queue", { headers: auth(tm.by, { role: "client" }) });
    expect(viaClient.status).toBe(403);
    expect(JSON.stringify(await json(viaClient))).not.toContain(d.approvalId);
    expect((await approvalRow(d.approvalId))["decision"]).toBeNull();
  });

  it("K63-API-066 承認待ち（21 件以上）× 一覧：1 回 20 件。続きは鍵の文字列（cursor）で最後の行の次から。間に新しい行が入っても重複・飛びが出ない。数は全部の数（D-131.9・G-16）", async () => {
    const who = await f.person(T.tenantId, T.rootScope, { name: "続きを読む人", ticketAbility: "edit" });
    const tm = await team("続きの任せた人");
    const all: string[] = [];
    for (let i = 0; i < 25; i++) {
      const t = await ticket({ assignee: who, due: jstDate(i), title: `続き ${i}` });
      all.push((await delegated(t, { by: tm })).approvalId);
    }
    const r1 = await queue(who);
    expect(r1.status).toBe(200);
    const j1 = await json(r1);
    const page1 = (j1.data as unknown as { id: string }[]).map((x) => x.id);
    expect(page1).toHaveLength(LIMIT_DEFAULT);
    expect(page1).toEqual(all.slice(0, LIMIT_DEFAULT)); // 期限の早い順
    expect(j1.meta).toMatchObject({ limit: LIMIT_DEFAULT, counts: { total: 25 } });
    const cursor = String(j1.meta!["cursor"]);
    expect(cursor).not.toMatch(/^[0-9]+$/); // 位置の数ではなく鍵の文字列
    expect(Buffer.from(cursor, "base64url").toString("utf8").split("|")).toHaveLength(3); // due_on・created_at・id
    // 間に新しい承認待ちが入る：1 つは 1 ページ目の中に入る期限（重複を出さない）・1 つは最後より後の期限（飛ばさない）
    const earlyT = await ticket({ assignee: who, due: jstDate(1), title: "割り込み 前" });
    const early = (await delegated(earlyT, { by: tm })).approvalId;
    const lateT = await ticket({ assignee: who, due: jstDate(40), title: "割り込み 後" });
    const late = (await delegated(lateT, { by: tm })).approvalId;
    const r2 = await queue(who, `?cursor=${encodeURIComponent(cursor)}`);
    expect(r2.status).toBe(200);
    const j2 = await json(r2);
    const page2 = (j2.data as unknown as { id: string }[]).map((x) => x.id);
    expect(page2).toEqual([...all.slice(LIMIT_DEFAULT), late]); // 1 ページ目の行は二度出ない・後に入った行は飛ばさない
    expect(page2).not.toContain(early);
    expect(new Set([...page1, ...page2]).size).toBe(page1.length + page2.length);
    expect(j2.meta!["cursor"]).toBeUndefined(); // 続きが無ければ cursor を返さない
    expect((j2.meta!["counts"] as { total: number }).total).toBe(27);
    // limit を指定すればその数（最大 200）
    const r3 = await queue(who, "?limit=3");
    expect(((await json(r3)).data as unknown[]).length).toBe(3);
    expect((await json(r3)).meta!["cursor"]).toBeTruthy();
  });
});
