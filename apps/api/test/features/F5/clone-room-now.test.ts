// K-753「分身の今を読む口（getMyClone・getCloneNow）」の単体の試験（口・本物の DB）。名前の頭の行 ID（K753-API-…）は 11_tickets/K-753.md の表と 1 対 1。
//   土台は clone-room.harness.ts（本物の Postgres・本物の口の入口・偽の画面のログイン）。PC・チケット・実行・承認は DB に直に置く。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して赤を確かめない（D-128.143）。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { setupCloneRoom, type Json, type World } from "./clone-room.harness.js";

const h = setupCloneRoom();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..", "..");
const NOW_KEYS = ["current", "next", "pc", "stopped", "waiting_approvals"];
const ME_KEYS = ["full_name", "name", "pc", "since"];
const jst = (d = new Date()): string => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);

const now = async (w: World, who = w.me): Promise<Record<string, unknown>> => {
  const r = await h.call(who, "GET", "/clones/me/now");
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await h.json(r)).data ?? {}) as Record<string, unknown>;
};
const me = async (w: World, who = w.me): Promise<Record<string, unknown>> => {
  const r = await h.call(who, "GET", "/clones/me");
  expect(r.status, await r.clone().text()).toBe(200);
  return ((await h.json(r)).data ?? {}) as Record<string, unknown>;
};
const nextOf = (v: Record<string, unknown>) => v["next"] as { ticket_id: string; state: string }[];

describe("K-753 分身の今を読む", () => {
  it("K753-API-001 getMyClone：呼ばれたい名前・表示の名前・いつから・PC（まだつないでいない）。鍵はちょうど 4 つ", async () => {
    const w = await h.world("k753-001");
    const v = await me(w);
    expect(Object.keys(v).sort()).toEqual(ME_KEYS);
    expect(v).toMatchObject({ name: "高本", full_name: "高本 聖斗", since: jst(), pc: { state: "none", label: null } });
    expect(Object.keys(v["pc"] as object).sort()).toEqual(["label", "state"]);
  });

  it("K753-API-002 呼ばれたい名前が空なら表示の名前が name になる。clones の行が在れば、その作った日（メンバーより前なら）が since になる", async () => {
    const w = await h.world("k753-002");
    await h.f.admin.query("update members set call_name = null where id = $1", [w.me.id]);
    expect(await me(w)).toMatchObject({ name: "高本 聖斗", full_name: "高本 聖斗" });
    await h.f.admin.query("update members set call_name = '   ' where id = $1", [w.me.id]);
    expect(await me(w)).toMatchObject({ name: "高本 聖斗" });
    await h.f.admin.query("update members set created_at = '2026-09-20T00:00:00Z' where id = $1", [w.me.id]);
    await h.f.admin.query(
      "insert into clones (tenant_id, owner_member_id, created_at) values ($1, $2, '2026-09-12T03:00:00Z')",
      [w.tenantId, w.me.id],
    );
    expect(await me(w)).toMatchObject({ since: "2026-09-12" });
  });

  it("K753-API-003 PC の状態：生きている知らせが新しい＝live・古い＝asleep・最初の知らせがまだ＝none・外した＝none", async () => {
    const w = await h.world("k753-003");
    await h.pc(w.me, { alive: false });
    expect((await me(w))["pc"]).toEqual({ state: "none", label: null });
    await h.pc(w.me, { label: "外した PC", revoked: true, ageSec: 1 });
    expect((await me(w))["pc"]).toEqual({ state: "none", label: null });
    await h.pc(w.me, { label: "高本の MacBook", ageSec: 200 });
    expect((await me(w))["pc"]).toEqual({ state: "asleep", label: "高本の MacBook" });
    await h.pc(w.me, { label: "事務所の iMac", ageSec: 10 });
    expect((await me(w))["pc"]).toEqual({ state: "live", label: "事務所の iMac" });
  });

  it("K753-API-004 PC の名前は外していない PC のうち最後の知らせがいちばん新しい物。ほかの人の PC は自分の PC にならない", async () => {
    const w = await h.world("k753-004");
    await h.pc(w.me, { label: "古い PC", ageSec: 500 });
    await h.pc(w.me, { label: "新しい PC", ageSec: 100 });
    await h.pc(w.other, { label: "佐藤の PC", ageSec: 1 });
    expect((await me(w))["pc"]).toEqual({ state: "asleep", label: "新しい PC" });
    expect((await me(w, w.other))["pc"]).toEqual({ state: "live", label: "佐藤の PC" });
    expect(((await now(w))["pc"] as { state: string }).state).toBe("asleep");
  });

  it("K753-API-005 切り替わりの瞬間（75 秒の境目）：知らせた直後と 74 秒は live・76 秒は asleep（実行の 1 件の pc と同じ境目）", async () => {
    const w = await h.world("k753-005");
    const sid = await h.pc(w.me, { ageSec: 0 });
    expect(((await now(w))["pc"] as { state: string }).state).toBe("live");
    await h.f.admin.query("update sessions set last_seen_at = now() - interval '74 seconds' where id = $1", [sid]);
    expect(((await now(w))["pc"] as { state: string }).state).toBe("live");
    await h.f.admin.query("update sessions set last_seen_at = now() - interval '76 seconds' where id = $1", [sid]);
    expect(((await now(w))["pc"] as { state: string }).state).toBe("asleep");
  });

  it("K753-API-006 getCloneNow：何もしていない（PC は生きている）。鍵はちょうど 5 つ・current は null・next は空・待っている物は 0", async () => {
    const w = await h.world("k753-006");
    await h.pc(w.me);
    const v = await now(w);
    expect(Object.keys(v).sort()).toEqual(NOW_KEYS);
    expect(v).toMatchObject({ current: null, next: [], waiting_approvals: 0, stopped: 0, pc: { state: "live" } });
  });

  it("K753-API-007 いま：走っている（running・asking）自分の実行。題名・番号・始めた時刻・いちばん新しい途中の 1 行（無ければ null）", async () => {
    const w = await h.world("k753-007");
    const t = await h.ticket(w, { title: "発注ナビの応募文を作る" });
    await h.run(w, t.id, {
      status: "running",
      createdMinAgo: 3,
      progress: ["見積を読んでいます", "応募文を書いています"],
    });
    const cur = (await now(w))["current"] as Record<string, unknown>;
    expect(Object.keys(cur).sort()).toEqual(["progress", "started_at", "ticket_id", "ticket_number", "title"]);
    expect(cur).toMatchObject({
      ticket_id: t.id,
      ticket_number: t.number,
      title: "発注ナビの応募文を作る",
      progress: "応募文を書いています",
    });
    expect(Number.isNaN(Date.parse(String(cur["started_at"])))).toBe(false);
    const t2 = await h.ticket(w);
    await h.run(w, t2.id, { status: "asking", createdMinAgo: 1 });
    expect(((await now(w))["current"] as Record<string, unknown>)["ticket_id"]).toBe(t2.id);
    expect(((await now(w))["current"] as Record<string, unknown>)["progress"]).toBeNull();
  });

  it("K753-API-008 自分の分身の物だけ：ほかの人が作った実行・チケットの今の実行がほかの人の物のとき（任せ直された）は数えない", async () => {
    const w = await h.world("k753-008");
    const t1 = await h.ticket(w);
    await h.run(w, t1.id, { status: "running", by: w.other });
    const t2 = await h.ticket(w);
    await h.run(w, t2.id, { status: "stopped", createdMinAgo: 10, errorSummary: "止まった" });
    await h.run(w, t2.id, { status: "queued", createdMinAgo: 2, by: w.other });
    const v = await now(w);
    expect(v).toMatchObject({ current: null, next: [], stopped: 0 });
    const theirs = await now(w, w.other);
    expect((theirs["current"] as { ticket_id: string }).ticket_id).toBe(t1.id);
    expect(nextOf(theirs).map((x) => x.ticket_id)).toEqual([t2.id]);
  });

  it("K753-API-009 このあと：順番待ち（作る段・queued）は queued・承認済みで実行待ち（execute・queued）は approved。古い順・いま動いている物は入らず・10 件まで", async () => {
    const w = await h.world("k753-009");
    const cur = await h.ticket(w);
    await h.run(w, cur.id, { status: "running", createdMinAgo: 90 });
    const a = await h.ticket(w);
    await h.run(w, a.id, { status: "queued", phase: "execute", createdMinAgo: 50 });
    const b = await h.ticket(w);
    await h.run(w, b.id, { status: "queued", phase: "make", createdMinAgo: 40 });
    const v = await now(w);
    expect(nextOf(v)).toEqual([
      expect.objectContaining({ ticket_id: a.id, state: "approved" }),
      expect.objectContaining({ ticket_id: b.id, state: "queued" }),
    ]);
    expect(Object.keys(nextOf(v)[0]!).sort()).toEqual(["state", "ticket_id", "ticket_number", "title"]);
    for (let i = 0; i < 10; i += 1) await h.run(w, (await h.ticket(w)).id, { status: "queued", createdMinAgo: 30 - i });
    expect(nextOf(await now(w))).toHaveLength(10);
  });

  it("K753-API-010 止まった：今の実行が止まった（stopped）チケットだけ stopped に数え、next には queued・approved の後ろに state stopped で出る。後の実行が終わった・自分で直すで引き取った物は数えない", async () => {
    const w = await h.world("k753-010");
    const s1 = await h.ticket(w);
    await h.run(w, s1.id, { status: "stopped", createdMinAgo: 20, errorSummary: "PC が閉じました" });
    const s2 = await h.ticket(w);
    await h.run(w, s2.id, { status: "stopped", createdMinAgo: 15 });
    await h.run(w, s2.id, { status: "done", createdMinAgo: 5, finishedMinAgo: 4 });
    const s3 = await h.ticket(w);
    await h.run(w, s3.id, { status: "stopped", createdMinAgo: 12, takenOver: true });
    const q = await h.ticket(w);
    await h.run(w, q.id, { status: "queued", createdMinAgo: 1 });
    const v = await now(w);
    expect(v["stopped"]).toBe(1);
    expect(nextOf(v).map((x) => `${x.state}:${x.ticket_id}`)).toEqual([`queued:${q.id}`, `stopped:${s1.id}`]);
  });

  it("K753-API-011 完了したチケット・消したチケット・取り下げでやめた（cancelled）実行は、止まった・このあとに数えない", async () => {
    const w = await h.world("k753-011");
    const done = await h.ticket(w, { completed: true, stage: "done" });
    await h.run(w, done.id, { status: "stopped" });
    const gone = await h.ticket(w, { deleted: true });
    await h.run(w, gone.id, { status: "stopped" });
    const cancelled = await h.ticket(w);
    await h.run(w, cancelled.id, { status: "cancelled", phase: "execute", finishedMinAgo: 1 });
    expect(await now(w)).toMatchObject({ stopped: 0, next: [], current: null });
  });

  it("K753-API-012 見えないチケット（権限の無いグループ B）の実行は、いま・このあと・止まったのどれにも出ない", async () => {
    const w = await h.world("k753-012");
    const hidden = await h.ticket(w, { scope: w.scopeB, assignee: w.outsider });
    await h.run(w, hidden.id, { status: "running" });
    const hidden2 = await h.ticket(w, { scope: w.scopeB, assignee: w.outsider });
    await h.run(w, hidden2.id, { status: "stopped" });
    expect(await now(w)).toMatchObject({ current: null, next: [], stopped: 0 });
  });

  it("K753-API-013 あなたを待っている承認は、承認待ちの数（app.approval_queue_count）と同じ。自分が決める承認だけ・決めた物は数えない", async () => {
    const w = await h.world("k753-013");
    const t1 = await h.ticket(w);
    await h.approval(w, t1.id);
    const t2 = await h.ticket(w);
    const a2 = await h.approval(w, t2.id);
    const t3 = await h.ticket(w, { assignee: w.other });
    await h.approval(w, t3.id, { approver: w.other });
    expect((await now(w))["waiting_approvals"]).toBe(2);
    await h.f.admin.query(
      "update approvals set decision = 'approve', decided_at = now(), status_id = 'approved' where id = $1",
      [a2],
    );
    expect((await now(w))["waiting_approvals"]).toBe(1);
    expect((await now(w, w.other))["waiting_approvals"]).toBe(1);
  });

  it("K753-API-014 PC が閉じている（PS3）：pc は asleep。current は DB のままで、口は書き換えない・止めない", async () => {
    const w = await h.world("k753-014");
    await h.pc(w.me, { ageSec: 300 });
    const t = await h.ticket(w);
    const r = await h.run(w, t.id, { status: "running" });
    const v = await now(w);
    expect(v).toMatchObject({ pc: { state: "asleep" }, current: { ticket_id: t.id } });
    const row = await h.f.admin.query<{ status_id: string }>("select status_id from action_runs where id = $1", [r.id]);
    expect(row.rows[0]!.status_id).toBe("running");
  });

  it("K753-API-015 PC がまだ（PS0）：pc は none・current も next も stopped も 0・待っている承認だけは数える", async () => {
    const w = await h.world("k753-015");
    const t = await h.ticket(w);
    await h.approval(w, t.id);
    const v = await now(w);
    expect(v).toMatchObject({
      pc: { state: "none", label: null },
      current: null,
      next: [],
      stopped: 0,
      waiting_approvals: 1,
    });
  });

  it("K753-API-016 答えは Cache-Control に private と no-store（認証の要る答え）", async () => {
    const w = await h.world("k753-016");
    for (const path of ["/clones/me", "/clones/me/now"]) {
      const cc = (await h.call(w.me, "GET", path)).headers.get("cache-control") ?? "";
      expect(cc, path).toMatch(/private/);
      expect(cc, path).toMatch(/no-store/);
    }
  });

  it("K753-API-017 読むだけ：何度読んでも実行・仕事・承認・やり取り・証跡・PC の行が増えも変わりもしない", async () => {
    const w = await h.world("k753-017");
    const t = await h.ticket(w);
    await h.run(w, t.id, { status: "stopped" });
    await h.pc(w.me);
    const snap = () =>
      h.count(
        `select (select count(*) from action_runs where tenant_id = $1) + (select count(*) from bridge_jobs where tenant_id = $1)
              + (select count(*) from approvals where tenant_id = $1) + (select count(*) from ticket_messages where tenant_id = $1)
              + (select count(*) from audit_events where tenant_id = $1) + (select coalesce(sum(extract(epoch from updated_at)), 0) from action_runs where tenant_id = $1)::bigint as n`,
        [w.tenantId],
      );
    const before = await snap();
    await now(w);
    await me(w);
    await now(w);
    expect(await snap()).toBe(before);
  });

  it("K753-API-018 ログインしていない：どちらの口も 401", async () => {
    await h.world("k753-018");
    for (const path of ["/clones/me", "/clones/me/now"])
      expect((await h.call(null, "GET", path)).status, path).toBe(401);
  });

  it("K753-API-019 止められた・外された人（G-14）：どちらの口も 403 で中身を返さない", async () => {
    const w = await h.world("k753-019");
    const t = await h.ticket(w, { title: "漏らしてはいけない題名" });
    await h.run(w, t.id, { status: "running" });
    await h.f.admin.query("update members set suspended_at = now() where id = $1", [w.me.id]);
    for (const path of ["/clones/me", "/clones/me/now"]) {
      const r = await h.call(w.me, "GET", path);
      expect(r.status, path).toBe(403);
      expect(await r.text()).not.toContain("漏らしてはいけない題名");
    }
  });

  it("K753-API-020 DB の読みが落ちる：503・E-PAGE-003（何も返さない）。ログに題名を出さない", async () => {
    const w = await h.world("k753-020");
    const t = await h.ticket(w, { title: "ログに出してはいけない題名" });
    await h.run(w, t.id, { status: "running" });
    await h.call(w.me, "GET", "/clones/me/now");
    const orig = (
      await h.f.admin.query<{ def: string }>("select pg_get_functiondef('app.clone_now()'::regprocedure) as def")
    ).rows[0]!.def;
    await h.f.admin.query(
      "create or replace function app.clone_now() returns jsonb language plpgsql stable security definer set search_path = public, app, pg_temp as $$ begin raise exception 'K753 の試験が起こした失敗'; end $$",
    );
    try {
      let status = 0;
      let body: Json = {};
      const logs = await h.captureLogs(async () => {
        const r = await h.call(w.me, "GET", "/clones/me/now");
        status = r.status;
        body = await h.json(r);
      });
      expect(status).toBe(503);
      expect(body).toMatchObject({ code: "E-PAGE-003" });
      expect(body.data).toBeUndefined();
      expect(logs).not.toContain("ログに出してはいけない題名");
    } finally {
      await h.f.admin.query(orig);
    }
  });

  it("K753-API-021 契約と登録：RESPONSES に getMyClone・getCloneNow の鍵が決めたとおり在り、hooks のファイルが 2 つの口を register する", () => {
    const api =
      readFileSync(join(ROOT, "05_flow", "screen_api.py"), "utf8") +
      readFileSync(join(ROOT, "05_flow", "screen_api.d", "K-753.py"), "utf8");
    expect(api).toMatch(
      /"getMyClone": \("MyClone", \{[^}]*"name": "string"[^}]*"full_name": "string"[^}]*"since": "string"[^}]*"pc": "object"/,
    );
    expect(api).toMatch(
      /"getCloneNow": \("CloneNow", \{[^}]*"pc": "object"[^}]*"current": "object\?"[^}]*"next": "array"[^}]*"waiting_approvals": "integer"[^}]*"stopped": "integer"/,
    );
    const hooks = readFileSync(join(ROOT, "apps", "api", "src", "hooks", "clone-room.ts"), "utf8");
    expect(hooks).toContain("getMyClone");
    expect(hooks).toContain("getCloneNow");
    expect(hooks).toMatch(/name: "cloneRoomHooks"/);
  });
});
