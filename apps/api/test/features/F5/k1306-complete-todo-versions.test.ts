// K-1306「中間テスト 3（K-64）の古い期待を替える」の口の試験。名前の頭の行 ID は 11_tickets/K-1306.md の表と 1 対 1。
//   中間テスト 3 は、前の完了の小窓が送る形（実施事項の番号を全部・今の版）で完了にし、実施事項の区画の最新の版の字（ticket_section_versions）を読む。
//   その道を口の層で先に見る：完了で本文を書き換えない（D-150.42・K-566）ので、区画の版の行も字も完了の前後で同じ。
//   土台は approve-complete.harness.ts。テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { describe, expect, it } from "vitest";
import {
  setupApproveComplete,
  f,
  boss,
  complete,
  stageKeyOf,
  ticket,
  executed,
  completeBody,
} from "./approve-complete.harness.js";

setupApproveComplete();

const TODO = "- 見積を作る\n- 先方に送る";

/** 実施事項の区画の版の行（古い順・中間テスト 3 の todoNow と同じ表） */
const versionsOf = async (ticketId: string) =>
  (
    await f.admin.query<{ version: number; text: string }>(
      `select v.version, v.body->>'text' as text from ticket_section_versions v join ticket_sections s on s.id = v.section_id
        where s.ticket_id = $1 and s.section_key = 'todo' order by v.version`,
      [ticketId],
    )
  ).rows;

describe("K-1306 完了で実施事項の区画を書き換えない（中間テスト 3 の道）", () => {
  it("K1306-API-001 前の小窓の形（todo_checked [0, 1]・今の todo_version・確かめ印）で完了にすると 201・段は done。実施事項の区画の版の行は増えず、最新の版の字は作ったときの「- 見積を作る\\n- 先方に送る」のまま（「- [x]」の版を足さない）", async () => {
    const t = await ticket({ todo: TODO });
    await executed(t);
    const before = await versionsOf(t.id);
    expect(before.at(-1)?.text, "作ったときの実施事項").toBe(TODO);
    // 段5 の K-578 で完了の口の体から todo_checked・todo_version を外した（契約は strict なので送ると 422）。今の小窓と同じ体（確かめ印だけ）で完了にする
    const r = await complete(boss, t.id, await completeBody(t));
    expect(r.status, await r.clone().text()).toBe(201);
    expect(await stageKeyOf(t.id)).toBe("done");
    const after = await versionsOf(t.id);
    expect(after, "版の行も字も完了の前後で同じ").toEqual(before);
    expect(
      after.some((v) => v.text.includes("[x]")),
      "全部済みの印の版は無い",
    ).toBe(false);
  });
});
