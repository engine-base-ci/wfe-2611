// K-602「項目が変わったお知らせ（ticket.sort_changed）の読み方：fields が 4 通りの名前で来ても鈴の行に出ない」の単体の試験
// テストの名前の頭の行 ID（K602-API-…）は 11_tickets/K-602.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 背景：段 5 の K-440（優先度・親）・K-583（予定時間）・K-564（会社の項目）が同じ種類 ticket.sort_changed を書く。
//   payload は { ticket_id, number, url, message_id, fields } だけ（題名・値の字は入れない）。fields は
//   priority・parent（K-440）／estimate_minutes（K-583）／field:<項目の id>（K-564）の並び。K-461 の読み方は fields・url を params に通さず、
//   params は message_id だけ。行はお知らせを置く（管理の接続で直に）ところから始め、書き手の確かめは書き手の葉の試験が持つ。
import { describe, expect, it } from "vitest";
import {
  f,
  member,
  notice,
  one,
  pageOf,
  ready,
  setupNotify,
  T,
  ticket,
} from "./notify.harness.js";

setupNotify();

const FIELD_ID = "5b0c1d2e-3f40-4a51-8b62-73849a5b6c7d";
/** 段 5 の 3 つの書き手が書く payload（題名を持たない・fields の中身が違う） */
const sortPayload = (t: { id: string; number: string }, fields: string[], messageId: string) => ({
  ticket_id: t.id,
  number: t.number,
  url: `/tickets/${t.id}`,
  message_id: messageId,
  fields,
});

describe("K-602 項目が変わったお知らせの読み方", () => {
  it("K602-API-001 4 通りの fields（優先度と親・予定時間・会社の項目・混ぜた）：どれも 1 行ずつ出て、tag は write・行き先は /tickets/<id>・番号は出て題名は null・params は message_id だけ", async () => {
    await ready();
    const p = await member("読む人");
    const writer = await member("変えた人");
    const t = await ticket({ assignee: p, title: "項目を変えるチケット" });
    const shapes: [string, string[]][] = [
      ["m-1", ["priority", "parent"]],
      ["m-2", ["estimate_minutes"]],
      ["m-3", [`field:${FIELD_ID}`]],
      ["m-4", ["priority", `field:${FIELD_ID}`, "estimate_minutes"]],
    ];
    const ids: string[] = [];
    let age = shapes.length;
    for (const [mid, fields] of shapes) {
      ids.push(
        await notice(p, {
          kind: "ticket.sort_changed",
          payload: sortPayload(t, fields, mid),
          actor: writer.id,
          ageMin: age--,
        }),
      );
    }
    const page = await pageOf(p);
    expect(page.data.map((x) => x.id)).toEqual([...ids].reverse());
    for (const [i, [mid]] of shapes.entries()) {
      const item = page.data.find((x) => x.id === ids[i])!;
      expect(item).toMatchObject({
        kind: "ticket.sort_changed",
        tag: "write",
        href: `/tickets/${t.id}`,
        ticket_id: t.id,
        number: t.number,
        title: null,
        read: false,
        params: { message_id: mid },
      });
      expect(item.actor).toEqual({ id: writer.id, name: expect.any(String) });
      expect(Object.keys(item).sort()).toEqual(
        ["actor", "created_at", "href", "id", "kind", "number", "params", "read", "read_at", "tag", "ticket_id", "title"].sort(),
      );
    }
  });

  it("K602-API-002 fields と url は答えのどこにも出ない：params に fields・url・field:<id>・priority の字が無く、答えの字全体にも項目の id が無い", async () => {
    await ready();
    const p = await member("読む人");
    const t = await ticket({ assignee: p, title: "漏れの無いチケット" });
    await notice(p, {
      kind: "ticket.sort_changed",
      payload: sortPayload(t, ["priority", "parent", "estimate_minutes", `field:${FIELD_ID}`], "m-9"),
      ageMin: 1,
    });
    const page = await pageOf(p);
    const item = page.data[0]!;
    expect(Object.keys(item.params)).toEqual(["message_id"]);
    expect("fields" in item.params).toBe(false);
    expect("url" in item.params).toBe(false);
    const text = JSON.stringify(page);
    for (const leak of [FIELD_ID, "field:", "estimate_minutes", '"priority"', '"parent"']) expect(text).not.toContain(leak);
  });

  it("K602-API-003 見えないチケットの項目のお知らせは出ない（チケットの種類は今そのチケットが見えるときだけ）：権限の無いグループ・消したチケット。担当者でなければ見えるチケットの行だけ出る", async () => {
    await ready();
    const p = await member("読む人");
    const other = await member("担当の人");
    const seen = await ticket({ assignee: other, title: "見えるチケット" });
    const sc = await one<{ id: string }>(
      "insert into scopes (tenant_id, name, ticket_prefix) values ($1, '見えないグループ', 'ZY') returning id",
      [T.tenantId],
    );
    const hidden = await ticket({ assignee: other, scope: sc.id, title: "見えないチケット" });
    const n1 = await notice(p, { kind: "ticket.sort_changed", payload: sortPayload(seen, ["priority"], "m-a"), ageMin: 2 });
    await notice(p, { kind: "ticket.sort_changed", payload: sortPayload(hidden, ["priority"], "m-b"), ageMin: 1 });
    expect((await pageOf(p)).data.map((x) => x.id)).toEqual([n1]);
    await f.admin.query("update tickets set deleted_at = now() where id = $1", [seen.id]);
    expect((await pageOf(p)).data).toEqual([]);
  });
});
