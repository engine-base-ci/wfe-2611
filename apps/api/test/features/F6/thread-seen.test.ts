// K-384「最後にやり取りを開いた時刻を書く口（markTicketTimelineSeen・新しい口）」の単体の試験（口と DB・本物の Postgres）。
// テストの名前の頭の行 ID（K384-API-…）は 11_tickets/K-384.md の表の行に 1 対 1 で結ぶ。
// テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
//
// 試験が決める口の形（契約は 05_flow/screen_api.d/K-384.py に新しい口として足す）:
//   markTicketTimelineSeen  POST /api/v1/tickets/:id/timeline/seen（そのチケットを読める人・60 回／分／人）
//     体 { seen_at?: string（ISO の日時。画面が出したいちばん新しい行の時刻）}（strict・ほかの欄は 422）
//     201 { data: { ticket_id, seen_at } }・Cache-Control: private, no-store
//     書くのは app.ticket_thread_seen の自分の 1 行だけ（関数 app.ticket_thread_seen_mark）：新しい時刻＝ least(seen_at か今, 今)。前の時刻より前には戻さない（greatest）
//     何度呼んでも 1 行（人ごと・チケットごと）。答えの seen_at は書いた後の行の時刻
import { describe, expect, it } from "vitest";
import { setupThread, type Item, type Person, type Ticket } from "./thread.harness.js";

const h = setupThread(["ticket-timeline-seen", "ticket-timeline"]);

const mark = (p: Person | null, t: Ticket, body: unknown = {}) =>
  h.req(p, "POST", `/tickets/${t.id}/timeline/seen`, body);
const row = (t: Ticket, p: Person) =>
  h.one<{ s: Date; n: string } | undefined>(
    "select max(seen_at) as s, count(*) as n from app.ticket_thread_seen where ticket_id = $1 and member_id = $2",
    [t.id, p.id],
  );
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

describe("K-384 最後に開いた時刻を書く", () => {
  it("K384-API-001 ふつう：初めて呼ぶと自分の 1 行ができ、時刻は今。201 と { ticket_id, seen_at }・Cache-Control に private と no-store", async () => {
    const t = await h.ticket();
    const before = Date.now();
    const r = await mark(h.boss, t);
    expect(r.status).toBe(201);
    const d = (await h.json(r)).data as Record<string, unknown>;
    expect(Object.keys(d).sort()).toEqual(["seen_at", "ticket_id"]);
    expect(d["ticket_id"]).toBe(t.id);
    const s = Date.parse(String(d["seen_at"]));
    expect(s).toBeGreaterThanOrEqual(before - 2_000);
    expect(s).toBeLessThanOrEqual(Date.now() + 2_000);
    const x = await row(t, h.boss);
    expect(Number(x!.n)).toBe(1);
    expect(x!.s.getTime()).toBe(s);
    const cc = r.headers.get("cache-control") ?? "";
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
  });

  it("K384-API-002 seen_at を渡すとその時刻を書く（画面が出したいちばん新しい行の時刻。その後に届いた書き込みは新しいまま残る）", async () => {
    const t = await h.ticket();
    const at = minutesAgo(30);
    const r = await mark(h.boss, t, { seen_at: at });
    expect(r.status).toBe(201);
    expect((await row(t, h.boss))!.s.getTime()).toBe(Date.parse(at));
  });

  it("K384-API-003 前には戻さない：今の行より前の時刻を渡しても行は変わらず、答えは今の行の時刻", async () => {
    const t = await h.ticket();
    const later = minutesAgo(5);
    await mark(h.boss, t, { seen_at: later });
    const r = await mark(h.boss, t, { seen_at: minutesAgo(60) });
    expect(r.status).toBe(201);
    expect(Date.parse(String(((await h.json(r)).data as Record<string, unknown>)["seen_at"]))).toBe(Date.parse(later));
    expect((await row(t, h.boss))!.s.getTime()).toBe(Date.parse(later));
  });

  it("K384-API-004 これからの時刻は今に直す（先の書き込みまで読んだことにしない）", async () => {
    const t = await h.ticket();
    const r = await mark(h.boss, t, { seen_at: new Date(Date.now() + 3_600_000).toISOString() });
    expect(r.status).toBe(201);
    expect((await row(t, h.boss))!.s.getTime()).toBeLessThanOrEqual(Date.now() + 2_000);
  });

  it("K384-API-005 何度呼んでも 1 行。人ごと・チケットごとに分かれ、ほかの人・ほかのチケットの行は変わらない", async () => {
    const t = await h.ticket();
    const u = await h.ticket();
    const writerAt = minutesAgo(90);
    await mark(h.writer, t, { seen_at: writerAt });
    for (let i = 0; i < 3; i++) expect((await mark(h.boss, t)).status).toBe(201);
    expect(Number((await row(t, h.boss))!.n)).toBe(1);
    expect((await row(t, h.writer))!.s.getTime()).toBe(Date.parse(writerAt));
    expect(Number((await row(u, h.boss))!.n)).toBe(0);
  });

  it("K384-API-006 閲覧のみの人・グループの外の担当者も書ける（読める人の口）", async () => {
    const t = await h.ticket({ assignee: h.stranger });
    expect((await mark(h.viewer, t)).status).toBe(201);
    expect((await mark(h.stranger, t)).status).toBe(201);
  });

  it("K384-API-007 守り：見えない人・別の会社の人・消したチケットは 404 で行を作らない。取引先の役は 403", async () => {
    const t = await h.ticket();
    for (const p of [h.stranger, h.outsider]) {
      expect((await mark(p, t)).status, p.id).toBe(404);
      expect(Number((await row(t, p))!.n)).toBe(0);
    }
    expect((await h.req(null, "POST", `/tickets/${t.id}/timeline/seen`, {}, h.f.as(h.boss, "client"))).status).toBe(
      403,
    );
    const gone = await h.ticket();
    await h.f.admin.query("update tickets set deleted_at = now(), deleted_by = $2 where id = $1", [gone.id, h.boss.id]);
    expect((await mark(h.boss, gone)).status).toBe(404);
    expect(Number((await row(gone, h.boss))!.n)).toBe(0);
  });

  it("K384-API-008 ログインしていない：401。上限（1 分に 60 回）を超えたら 429・retry_after_sec", async () => {
    const t = await h.ticket();
    expect((await mark(null, t)).status).toBe(401);
    const p = await h.person("上限を見る人");
    h.f.limits["markTicketTimelineSeen"] = 2;
    try {
      const codes: number[] = [];
      let last: Response | null = null;
      for (let i = 0; i < 3; i++) {
        last = await h.f.req("POST", `/tickets/${t.id}/timeline/seen`, {
          body: {},
          headers: p.auth,
          ip: "198.51.100.252",
        });
        codes.push(last.status);
      }
      expect(codes).toEqual([201, 201, 429]);
      expect(Number.isInteger((await h.json(last!))["retry_after_sec"])).toBe(true);
    } finally {
      h.f.limits["markTicketTimelineSeen"] = 10_000;
    }
  });

  it("K384-API-009 入力：seen_at が日時でない（字・数・空・暦に無い日・時差の範囲外）・知らない欄は 422 で、行を作らない", async () => {
    const t = await h.ticket();
    for (const body of [
      { seen_at: "きのう" },
      { seen_at: 12345 },
      { seen_at: "" },
      { seen_at: "2026-02-30T00:00:00Z" },
      { seen_at: "2026-11-22T10:00:00+16:00" },
      { member_id: h.writer.id },
    ]) {
      const r = await mark(h.boss, t, body);
      expect(r.status, JSON.stringify(body)).toBe(422);
    }
    expect(Number((await row(t, h.boss))!.n)).toBe(0);
    expect(Number((await row(t, h.writer))!.n)).toBe(0);
  });

  it("K384-API-010 失敗 × 守りの判定（見えるか）の所で例外になった：503・E-PAGE-003 で行を作らない（D-136.1）", async () => {
    const title = "K384 守りが壊れる";
    const t = await h.ticket({ title });
    await h.breakVisible(title, async () => {
      const r = await mark(h.boss, t);
      expect(r.status).toBe(503);
      expect((await h.json(r))["code"]).toBe("E-PAGE-003");
    });
    expect(Number((await row(t, h.boss))!.n)).toBe(0);
  });

  it("K384-API-011 S1 の失敗（行を書く所で DB が落ちた）：503・E-PAGE-003 で、行は前のまま（1 つの取引）", async () => {
    const t = await h.ticket({ title: "K384 書けない" });
    await mark(h.boss, t, { seen_at: minutesAgo(60) });
    const before = (await row(t, h.boss))!.s.getTime();
    await h.f.admin.query(`create or replace function app.k384_break() returns trigger language plpgsql as $$
      begin raise exception 'K384 の試験で書けなくした'; end $$`);
    await h.f.admin.query(
      `create trigger k384_break before insert or update on app.ticket_thread_seen for each row when (new.ticket_id = '${t.id}') execute function app.k384_break()`,
    );
    try {
      const r = await mark(h.boss, t);
      expect(r.status).toBe(503);
      const j = await h.json(r);
      expect(j["code"]).toBe("E-PAGE-003");
      expect(JSON.stringify(j)).not.toContain("書けなくした");
    } finally {
      await h.f.admin.query("drop trigger if exists k384_break on app.ticket_thread_seen");
    }
    expect((await row(t, h.boss))!.s.getTime()).toBe(before);
  });

  it("K384-API-012 書いた後に読む口を開くと、それより前の書き込みは新しくなく new_count は 0。後に届いた書き込みだけが新しい", async () => {
    const t = await h.ticket();
    await h.post(t, h.writer, { body: "前", at: 20 });
    await h.post(t, h.writer, { body: "前 2", at: 10 });
    expect((await mark(h.boss, t, { seen_at: minutesAgo(5) })).status).toBe(201);
    const a = await h.req(h.boss, "GET", `/tickets/${t.id}/timeline`);
    expect(((await h.json(a)).meta as Record<string, unknown>)["new_count"]).toBe(0);
    expect((((await h.json(a)).data ?? []) as Item[]).some((x) => x.message?.is_new)).toBe(false);
    const late = await h.post(t, h.writer, { body: "後", at: 0 });
    const b = await h.req(h.boss, "GET", `/tickets/${t.id}/timeline`);
    expect(((await h.json(b)).meta as Record<string, unknown>)["new_count"]).toBe(1);
    expect((((await h.json(b)).data ?? []) as Item[]).filter((x) => x.message?.is_new).map((x) => x.id)).toEqual([
      late,
    ]);
  });
});
