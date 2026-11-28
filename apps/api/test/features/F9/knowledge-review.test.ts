// K-695「見直すページを読む（使われていない・食い違っている・よく破られる の 3 つ）（getKnowledgeReview）」の単体の試験（口・DB の関数・本物の Postgres・本物の口の入口・偽の画面のログイン）。
//   行 ID は K695-API-NNN・K695-DB-001（チケット 11_tickets/K-695.md の表の行と 1 対 1）。名前の決めは 07_functional/段10-F9/土台-knowledge.md と K-695 の md。
//   土台は knowledge.harness.ts（K-675 が運ぶ）・道具は knowledge.requests-kit.ts（K-687）と knowledge.guard-kit.ts（K-700）。
//   見られる範囲は「自分が書ける棚の公開済みページ（自分の棚は除く）」：管理者＝会社の棚／マネージャー＝自分がマネージャーのグループの棚（K-695 の md の決め）。
//   使われていない・食い違い・破られた数の窓の境（90 日・30 日）は行の時刻を DB に直に入れて作る。題名は日本語。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。実装の前に流して確かめない（D-128.143）。
import pg from "pg";
import { describe, expect, it } from "vitest";
import { withTenant } from "@kaname/db/context";
import { setupKnowledge, type Person } from "./knowledge.harness.js";
import { allAudits, makeWorld, num, type World } from "./knowledge.requests-kit.js";
import { mkJob, mkTicket, pubPage } from "./knowledge.guard-kit.js";
import {
  BREACH_HOW,
  KNOWLEDGE_REVIEW_LIMIT,
  createGetKnowledgeReview,
  howText,
  pointText,
} from "../../../src/features/F9/knowledge/review.js";

const h = setupKnowledge();

type Json = Record<string, unknown>;
interface Unused {
  id: string;
  title: string;
  place: string;
  last_opened_at: string | null;
}
interface Place {
  id: string;
  title: string;
  place: string;
}
interface Conflict {
  id: string;
  upper: Place;
  lower: Place;
  point: string;
}
interface Broken {
  id: string;
  title: string;
  place: string;
  count: number;
  how: string;
}
interface Review {
  unused: Unused[];
  conflicts: Conflict[];
  broken: Broken[];
}

const ask = async (p: Person | null): Promise<Response> => {
  await h.ready();
  return h.req("GET", "/knowledge/review", p ? { headers: h.as(p) } : {});
};
const review = async (p: Person): Promise<Review> => {
  const r = await ask(p);
  expect(r.status).toBe(200);
  return (await h.json(r)).data as Review;
};
const reviewCount = async (p: Person): Promise<number | null> => {
  await h.ready();
  const r = await h.req("GET", "/knowledge/tree", { headers: h.as(p) });
  expect(r.status).toBe(200);
  const c = ((await h.json(r)).data as Json)["admin_counts"] as { review: number } | null;
  return c === null ? null : c.review;
};
const age = (page: string, days: number): Promise<unknown> =>
  h.admin.query(
    "update knowledge_page_versions set published_at = now() - ($2 || ' days')::interval where page_id = $1",
    [page, String(days)],
  );
/** AI が開いた記録（チケットの仕事の分）。daysAgo 日前・deleted なら消した記録 */
const opened = async (w: World, ticket: string, page: string, daysAgo: number, deleted = false): Promise<void> => {
  await h.admin.query(
    "insert into reference_logs (tenant_id, ticket_id, ref_type, ref_id, title, seen_at, deleted_at) values ($1, $2, 'page', $3, 't', now() - ($4 || ' days')::interval, case when $5::boolean then now() else null end)",
    [w.co.tenantId, ticket, page, String(daysAgo), deleted],
  );
};
/** 破られた数を 1 つ（チケットを新しく置いて、そのチケットの分として入れる） */
const breach = async (w: World, page: string, kind: string, daysAgo = 1): Promise<void> => {
  const t = await mkTicket(h, w, w.g1, w.mem1);
  await h.admin.query(
    "insert into knowledge_breaches (tenant_id, ticket_id, page_id, kind, created_at) values ($1, $2, $3, $4, now() - ($5 || ' days')::interval)",
    [w.co.tenantId, t, page, kind, String(daysAgo)],
  );
};
const ids = (rows: { id: string }[]): string[] => rows.map((r) => r.id).sort();
/** 公開済みのページを SQL でまとめて入れる（題名は prefix＋md5・本文は md5・days 日前に公開） */
// 題名は頭の字＋ md5。md5 の種にも頭の字を入れる（入れないと会社の c… と営業の g… が同じ md5 で 1 字違いになり、似ている題名の組として見つかる）
const bulk = async (w: World, scope: string, owner: Person, n: number, prefix: string, days = 0): Promise<void> => {
  await h.admin.query(
    `insert into knowledge_pages (tenant_id, scope_id, is_personal, owner_member_id, state, is_must, title, summary, position, current_version)
     select $1, $2, false, $3, 'published', false, $4 || md5($4 || g::text), '', 0, 1 from generate_series(1, $5::int) g`,
    [w.co.tenantId, scope, owner.id, prefix, n],
  );
  await h.admin.query(
    `insert into knowledge_page_versions (tenant_id, page_id, version, kind, body, author_member_id, published_at, published_by)
     select p.tenant_id, p.id, 1, 'published',
            jsonb_build_object('doc', jsonb_build_object('type', 'doc', 'content', jsonb_build_array(jsonb_build_object('type', 'paragraph', 'content',
              jsonb_build_array(jsonb_build_object('type', 'text', 'text', md5(p.id::text)))))), 'text', md5(p.id::text)),
            $3, now() - ($4 || ' days')::interval, $3
       from knowledge_pages p where p.tenant_id = $1 and p.title like $2 || '%'`,
    [w.co.tenantId, prefix, owner.id, String(days)],
  );
  // 本番では、まとめて入った行は自動の統計（autovacuum の analyze）が拾ってから読まれる。試験はすぐ読むので、入れた後に統計を取る
  //   （統計が無いと planner が 1 万行を小さい表と見て、見える・書けるの関数を全部の行で呼ぶ計画を選ぶ・統合の枝）
  await h.admin.query("analyze knowledge_pages, knowledge_page_versions");
};
const same = (a: string, b: string): Promise<number> =>
  h.admin.query<{ s: number }>("select similarity($1, $2) as s", [a, b]).then((r) => r.rows[0]!.s);

describe("K-695 見直すページを読む", () => {
  it("K695-API-001 マネージャーが開くと 200・鍵は unused・conflicts・broken だけ。3 つとも 1 件ずつで、行の鍵と場所の字（会社 › フォルダ）が土台どおり", async () => {
    const w = await makeWorld(h, "k695-001");
    const folder = await h.folder({ scope: w.co.rootScope, owner: w.boss, name: "経理" });
    const old = await pubPage(h, w.g1, w.mgr1, "古い手順");
    await age(old, 100);
    const up = await pubPage(h, w.co.rootScope, w.boss, "経費の精算", { text: "上限 5 万円", folder });
    const lo = await h.page({
      scope: w.g1,
      owner: w.mgr1,
      title: "経費の精算（営業）",
      text: "上限 10 万円",
      copiedFrom: up,
    });
    const bk = await pubPage(h, w.g1, w.mgr1, "メールの書き方", { must: true });
    await breach(w, bk, "ai_unchecked");
    await breach(w, bk, "ai_unchecked");
    const r = await review(w.mgr1);
    expect(Object.keys(r).sort()).toEqual(["broken", "conflicts", "unused"]);
    expect(r.unused).toEqual([{ id: old, title: "古い手順", place: "営業", last_opened_at: null }]);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0]).toEqual({
      id: `${up}:${lo}`,
      upper: { id: up, title: "経費の精算", place: "会社 › 経理" },
      lower: { id: lo, title: "経費の精算（営業）", place: "営業" },
      point: "会社は「上限 5 万円」、営業は「上限 10 万円」と書いてあります",
    });
    expect(r.broken).toEqual([
      { id: bk, title: "メールの書き方", place: "営業", count: 2, how: howText("ai_unchecked", 2) },
    ]);
  });

  it("K695-API-002 見られるのは管理者と、どれかのグループのマネージャーだけ。メンバー・閲覧のみ・どこにも入っていない人は 403（体は { error, code } だけ）。役を外された直後・付けられた直後も次の読みから変わる", async () => {
    const w = await makeWorld(h, "k695-002");
    for (const p of [w.boss, w.boss2, w.mgr1, w.mgr2]) expect((await ask(p)).status).toBe(200);
    for (const p of [w.mem1, w.view1, w.mem2, w.mem3, w.none]) {
      const r = await ask(p);
      expect(r.status).toBe(403);
      expect(await h.json(r)).toEqual({ error: "forbidden", code: "FORBIDDEN" });
    }
    const setRole = (p: Person, role: string): Promise<unknown> =>
      h.admin.query("update scope_memberships set role = $2 where member_id = $1", [p.id, role]);
    await setRole(w.mgr2, "member");
    expect((await ask(w.mgr2)).status).toBe(403);
    await setRole(w.mem2, "manager");
    expect((await ask(w.mem2)).status).toBe(200);
  });

  it("K695-API-003 使われていない：AI が開いていない時間が長い順（1 度も開かれていないページが先）。last_opened_at は最後に開かれた時刻（ISO・UTC）か null", async () => {
    const w = await makeWorld(h, "k695-003");
    const t = await mkTicket(h, w, w.g1, w.mem1);
    const never = await pubPage(h, w.g1, w.mgr1, "1 度も開かれない");
    const long = await pubPage(h, w.g1, w.mgr1, "ずっと前に開かれた");
    const short = await pubPage(h, w.g1, w.mgr1, "少し前に開かれた");
    for (const [p, d] of [
      [never, 200],
      [long, 300],
      [short, 100],
    ] as const)
      await age(p, d);
    await opened(w, t, long, 150);
    await opened(w, t, long, 120);
    await opened(w, t, short, 95);
    const r = (await review(w.mgr1)).unused;
    expect(r.map((x) => x.id)).toEqual([never, long, short]);
    expect(r[0]!.last_opened_at).toBeNull();
    const lastLong = (
      await h.admin.query<{ d: Date }>("select max(seen_at) as d from reference_logs where ref_id = $1", [long])
    ).rows[0]!.d;
    expect(r[1]!.last_opened_at).toMatch(/Z$/);
    expect(new Date(r[1]!.last_opened_at!).getTime()).toBe(lastLong.getTime());
  });

  it("K695-API-004 窓の境：公開から 89 日は出ない・91 日は出る。90 日のうちに開かれていれば出ない（会話の仕事で開いた記録も数える）。消した記録は数えない", async () => {
    const w = await makeWorld(h, "k695-004");
    const t = await mkTicket(h, w, w.g1, w.mem1);
    const young = await pubPage(h, w.g1, w.mgr1, "公開して 89 日");
    const edge = await pubPage(h, w.g1, w.mgr1, "公開して 91 日");
    const recent = await pubPage(h, w.g1, w.mgr1, "89 日前に開かれた");
    const chat = await pubPage(h, w.g1, w.mgr1, "会話で開かれた");
    const dropped = await pubPage(h, w.g1, w.mgr1, "消した記録だけ");
    for (const [p, d] of [
      [young, 89],
      [edge, 91],
      [recent, 200],
      [chat, 200],
      [dropped, 200],
    ] as const)
      await age(p, d);
    await opened(w, t, recent, 89);
    await opened(w, t, dropped, 10, true);
    const job = await mkJob(h, w, w.mem1, w.g1, null);
    await h.admin.query(
      "insert into reference_logs (tenant_id, ticket_id, bridge_job_id, member_id, ref_type, ref_id, title, seen_at) values ($1, null, $2, $3, 'page', $4, 't', now() - interval '10 days')",
      [w.co.tenantId, job, w.mem1.id, chat],
    );
    expect(ids((await review(w.mgr1)).unused)).toEqual(ids([{ id: edge }, { id: dropped }]));
  });

  it("K695-API-005 使われていないに出ない物：必ず守る・自分の棚・まだ公開していない・消した・公開から 90 日たっていない・ほかのグループの棚・会社の棚（マネージャーには）", async () => {
    const w = await makeWorld(h, "k695-005");
    const mk = async (
      scope: string,
      owner: Person,
      title: string,
      o: NonNullable<Parameters<typeof pubPage>[4]> = {},
    ): Promise<string> => {
      const p = await pubPage(h, scope, owner, title, o);
      await age(p, 200);
      return p;
    };
    const ok = await mk(w.g1, w.mgr1, "出る");
    await mk(w.g1, w.mgr1, "必ず守る", { must: true });
    await mk(w.mem1.scopeId, w.mem1, "自分の棚", { personal: true });
    await mk(w.g2, w.mgr2, "受託開発の棚");
    await mk(w.co.rootScope, w.boss, "会社の棚");
    const gone = await mk(w.g1, w.mgr1, "消した");
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    await h.page({ scope: w.g1, owner: w.mgr1, state: "draft", title: "書きかけ" });
    await pubPage(h, w.g1, w.mgr1, "公開したばかり");
    expect((await review(w.mgr1)).unused.map((x) => x.id)).toEqual([ok]);
  });

  it("K695-API-006 見られる範囲：管理者は会社の棚、マネージャーは自分がマネージャーのグループの棚。ほかのグループのマネージャーには出ない", async () => {
    const w = await makeWorld(h, "k695-006");
    const c = await pubPage(h, w.co.rootScope, w.boss, "会社のページ");
    const a = await pubPage(h, w.g1, w.mgr1, "営業のページ");
    const b = await pubPage(h, w.g2, w.mgr2, "受託開発のページ");
    for (const p of [c, a, b]) await age(p, 200);
    expect((await review(w.boss)).unused.map((x) => x.id)).toEqual([c]);
    expect((await review(w.boss2)).unused.map((x) => x.id)).toEqual([c]);
    expect((await review(w.mgr1)).unused.map((x) => x.id)).toEqual([a]);
    expect((await review(w.mgr2)).unused.map((x) => x.id)).toEqual([b]);
  });

  it("K695-API-007 一覧の上限は各 50 件。51 件以上あっても 50 件で、並びは決まっている（開かれていない時間が長い順・題名・id）", async () => {
    const w = await makeWorld(h, "k695-007");
    expect(KNOWLEDGE_REVIEW_LIMIT).toBe(50);
    await bulk(w, w.g1, w.mgr1, 52, "u", 200);
    const a = (await review(w.mgr1)).unused;
    const b = (await review(w.mgr1)).unused;
    expect(a).toHaveLength(50);
    expect(a.map((x) => x.id)).toEqual(b.map((x) => x.id));
    const titles = a.map((x) => x.title);
    expect(titles).toEqual([...titles].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0)));
  });

  it("K695-API-008 食い違っている①：グループのページが会社のページの写しで、本文が違うと 1 行。最初に違う行が点に出る。本文が同じなら出ない", async () => {
    const w = await makeWorld(h, "k695-008");
    const up = await pubPage(h, w.co.rootScope, w.boss, "経費の精算", { text: "共通の行\n上限 5 万円\n最後の行" });
    const lo = await h.page({
      scope: w.g1,
      owner: w.mgr1,
      title: "経費の精算（営業）",
      text: "共通の行\n上限 10 万円\n最後の行",
      copiedFrom: up,
    });
    const same = await h.page({
      scope: w.g1,
      owner: w.mgr1,
      title: "営業の決まり",
      text: "共通の行\n上限 5 万円\n最後の行",
      copiedFrom: up,
    });
    const r = (await review(w.mgr1)).conflicts;
    expect(r.map((x) => x.id)).toEqual([`${up}:${lo}`]);
    expect(r[0]!.upper.id).toBe(up);
    expect(r[0]!.lower.id).toBe(lo);
    expect(r[0]!.point).toBe("会社は「上限 5 万円」、営業は「上限 10 万円」と書いてあります");
    expect(r.some((x) => x.lower.id === same)).toBe(false);
  });

  it("K695-API-009 食い違っている②：題名と説明がほぼ同じで本文が違う会社のページとグループのページを 1 行にする。本文が同じ・似ていない・同じ棚どうしは出ない", async () => {
    const w = await makeWorld(h, "k695-009");
    const sim = await same("経費の精算ルール 経費の精算ルールの説明", "経費の精算ルール 経費の精算ルールの説明");
    const far = await same("経費の精算ルール 経費の精算ルールの説明", "出張の手配 出張の手配の説明");
    expect(sim).toBeGreaterThanOrEqual(0.5);
    expect(far).toBeLessThan(0.5);
    const up = await pubPage(h, w.co.rootScope, w.boss, "経費の精算ルール", { text: "上限 5 万円" });
    const lo = await pubPage(h, w.g1, w.mgr1, "経費の精算ルール", { text: "上限 10 万円" });
    await pubPage(h, w.g1, w.mgr1, "出張の手配", { text: "別の話" });
    const dupUp = await pubPage(h, w.co.rootScope, w.boss, "同じ中身", { text: "全く同じ" });
    await pubPage(h, w.g1, w.mgr1, "同じ中身", { text: "全く同じ" });
    await pubPage(h, w.g1, w.mgr1, "グループどうし", { text: "営業の言い分" });
    await pubPage(h, w.g2, w.mgr2, "グループどうし", { text: "開発の言い分" });
    const r = (await review(w.mgr1)).conflicts;
    expect(r.map((x) => x.id)).toEqual([`${up}:${lo}`]);
    expect(r[0]!.point).toBe("会社は「上限 5 万円」、営業は「上限 10 万円」と書いてあります");
    expect(r.some((x) => x.upper.id === dupUp)).toBe(false);
  });

  it("K695-API-010 同じ組は 1 行（写しで、しかも題名が同じ）。自分の棚の写しは出さない（自分の棚は本人だけの物）", async () => {
    const w = await makeWorld(h, "k695-010");
    const up = await pubPage(h, w.co.rootScope, w.boss, "経費の精算ルール", { text: "上限 5 万円" });
    const lo = await h.page({
      scope: w.g1,
      owner: w.mgr1,
      title: "経費の精算ルール",
      text: "上限 10 万円",
      copiedFrom: up,
    });
    await h.page({
      scope: w.mem1.scopeId,
      owner: w.mem1,
      personal: true,
      title: "経費の精算ルール",
      text: "上限 20 万円",
      copiedFrom: up,
    });
    const r = (await review(w.mgr1)).conflicts;
    expect(r.map((x) => x.id)).toEqual([`${up}:${lo}`]);
    expect((await review(w.boss)).conflicts).toEqual([]);
  });

  it("K695-API-011 食い違いが見える人：両方のページを読めて、どちらかを書ける人だけ。営業の組は営業のマネージャーだけ・受託開発の組は受託開発のマネージャーだけ・管理者（グループに入っていない）には出ない", async () => {
    const w = await makeWorld(h, "k695-011");
    const u1 = await pubPage(h, w.co.rootScope, w.boss, "経費の精算", { text: "5 万円" });
    const l1 = await h.page({
      scope: w.g1,
      owner: w.mgr1,
      title: "経費の精算（営業）",
      text: "10 万円",
      copiedFrom: u1,
    });
    const u2 = await pubPage(h, w.co.rootScope, w.boss, "出張の手配", { text: "前日まで" });
    const l2 = await h.page({
      scope: w.g2,
      owner: w.mgr2,
      title: "出張の手配（開発）",
      text: "前々日まで",
      copiedFrom: u2,
    });
    expect((await review(w.mgr1)).conflicts.map((x) => x.id)).toEqual([`${u1}:${l1}`]);
    expect((await review(w.mgr2)).conflicts.map((x) => x.id)).toEqual([`${u2}:${l2}`]);
    expect((await review(w.boss)).conflicts).toEqual([]);
  });

  it("K695-API-012 最初に違う行（DB の関数 app.kn_first_diff）：複数行の途中・片方が長いとき・片方が空・全部同じ（空の組）", async () => {
    const d = async (a: string, b: string): Promise<string[]> =>
      (await h.admin.query<{ v: string[] }>("select app.kn_first_diff($1, $2) as v", [a, b])).rows[0]!.v;
    expect(await d("a\nb\nc", "a\nB\nc")).toEqual(["b", "B"]);
    expect(await d("a\nb", "a\nb\nc")).toEqual(["", "c"]);
    expect(await d("a\nb\nc", "a\nb")).toEqual(["c", ""]);
    expect(await d("", "x")).toEqual(["", "x"]);
    expect(await d("a\nb", "a\nb")).toEqual([]);
  });

  it("K695-API-013 点の文（pointText）と破られ方の文（howText）：棚の名前と最初に違う行を入れる。行が無い側は（この行はありません）・長い行は 60 字で切って … を付ける・破られ方は種類ごとの決まった文", async () => {
    expect(pointText("会社", "営業", "上限 5 万円", "上限 10 万円")).toBe(
      "会社は「上限 5 万円」、営業は「上限 10 万円」と書いてあります",
    );
    expect(pointText("会社", "営業", "", "追加の行")).toBe(
      "会社は「（この行はありません）」、営業は「追加の行」と書いてあります",
    );
    expect(pointText("会社", "営業", "あ".repeat(100), "い")).toBe(
      `会社は「${"あ".repeat(60)}…」、営業は「い」と書いてあります`,
    );
    expect(pointText("会社", "営業", "あ".repeat(60), "い")).toBe(
      `会社は「${"あ".repeat(60)}」、営業は「い」と書いてあります`,
    );
    expect(howText("ai_unchecked", 3)).toBe(
      "いちばん多い：AI が終わりを知らせたのに、チェックが付いていなかった（3 回）",
    );
    expect(BREACH_HOW).toEqual({
      ai_unchecked: "AI が終わりを知らせたのに、チェックが付いていなかった",
      human_unchecked: "AI が付けたチェックを人が外した",
      ai_self_reported: "AI が守れていなかったと知らせて直した",
    });
  });

  it("K695-API-014 よく破られる：この 30 日の破られた数の多い順（同じ数なら題名・id）。31 日前の分は数えない", async () => {
    const w = await makeWorld(h, "k695-014");
    const a = await pubPage(h, w.g1, w.mgr1, "あの決まり", { must: true });
    const b = await pubPage(h, w.g1, w.mgr1, "いの決まり", { must: true });
    const c = await pubPage(h, w.g1, w.mgr1, "うの決まり", { must: true });
    const d = await pubPage(h, w.g1, w.mgr1, "えの決まり", { must: true });
    for (let i = 0; i < 5; i += 1) await breach(w, c, "ai_unchecked", 29);
    for (let i = 0; i < 2; i += 1) await breach(w, b, "ai_unchecked");
    for (let i = 0; i < 2; i += 1) await breach(w, a, "ai_unchecked");
    await breach(w, d, "ai_unchecked", 1);
    for (let i = 0; i < 6; i += 1) await breach(w, d, "ai_unchecked", 31);
    const r = (await review(w.mgr1)).broken;
    expect(r.map((x) => [x.id, x.count])).toEqual([
      [c, 5],
      [a, 2],
      [b, 2],
      [d, 1],
    ]);
  });

  it("K695-API-015 よく破られるに出ない物：今は必ず守るでないページ・消したページ・自分の棚のページ・自分が書けない棚のページ（管理者には会社の棚だけ・マネージャーには自分のグループだけ）", async () => {
    const w = await makeWorld(h, "k695-015");
    const ok = await pubPage(h, w.g1, w.mgr1, "出る", { must: true });
    const unmust = await pubPage(h, w.g1, w.mgr1, "必ず守るでなくなった", { must: true });
    await h.admin.query("update knowledge_pages set is_must = false where id = $1", [unmust]);
    const gone = await pubPage(h, w.g1, w.mgr1, "消した", { must: true });
    await h.admin.query("update knowledge_pages set deleted_at = now() where id = $1", [gone]);
    const mine = await pubPage(h, w.mem1.scopeId, w.mem1, "自分の", { must: true, personal: true });
    const dev = await pubPage(h, w.g2, w.mgr2, "受託開発の", { must: true });
    const co = await pubPage(h, w.co.rootScope, w.boss, "会社の", { must: true });
    for (const p of [ok, unmust, gone, mine, dev, co]) await breach(w, p, "ai_unchecked");
    expect((await review(w.mgr1)).broken.map((x) => x.id)).toEqual([ok]);
    expect((await review(w.mgr2)).broken.map((x) => x.id)).toEqual([dev]);
    expect((await review(w.boss)).broken.map((x) => x.id)).toEqual([co]);
  });

  it("K695-API-016 破られ方（how）：いちばん多い種類とその数。同じ数なら ai_unchecked・human_unchecked・ai_self_reported の順。count は全部の種類の合計", async () => {
    const w = await makeWorld(h, "k695-016");
    const a = await pubPage(h, w.g1, w.mgr1, "あ", { must: true });
    const b = await pubPage(h, w.g1, w.mgr1, "い", { must: true });
    for (const k of ["ai_unchecked", "ai_unchecked", "ai_unchecked", "human_unchecked", "human_unchecked"])
      await breach(w, a, k);
    for (const k of ["human_unchecked", "human_unchecked", "ai_unchecked", "ai_unchecked", "ai_self_reported"])
      await breach(w, b, k);
    const r = (await review(w.mgr1)).broken;
    expect(r.map((x) => [x.id, x.count, x.how])).toEqual([
      [a, 5, howText("ai_unchecked", 3)],
      [b, 5, howText("ai_unchecked", 2)],
    ]);
  });

  it("K695-API-017 木の管理の数 admin_counts.review は 3 つの一覧の行の数の合計（管理者・マネージャーだけ・ほかは null）", async () => {
    const w = await makeWorld(h, "k695-017");
    const old = await pubPage(h, w.g1, w.mgr1, "古い手順");
    await age(old, 100);
    const up = await pubPage(h, w.co.rootScope, w.boss, "経費の精算", { text: "5 万円" });
    await h.page({ scope: w.g1, owner: w.mgr1, title: "経費の精算（営業）", text: "10 万円", copiedFrom: up });
    const bk = await pubPage(h, w.g1, w.mgr1, "メールの書き方", { must: true });
    await breach(w, bk, "ai_unchecked");
    const r = await review(w.mgr1);
    expect(await reviewCount(w.mgr1)).toBe(r.unused.length + r.conflicts.length + r.broken.length);
    expect(await reviewCount(w.mgr1)).toBe(3);
    expect(await reviewCount(w.boss)).toBe(0);
    for (const p of [w.mem1, w.view1, w.none]) expect(await reviewCount(p)).toBeNull();
  });

  it("K695-API-018 管理の数も一覧と同じ上限で数える（51 件以上の使われていないページがあっても数は 50）", async () => {
    const w = await makeWorld(h, "k695-018");
    await bulk(w, w.g1, w.mgr1, 52, "u", 200);
    expect((await review(w.mgr1)).unused).toHaveLength(50);
    expect(await reviewCount(w.mgr1)).toBe(50);
  });

  it("K695-API-019 何も無いとき：3 つとも空の並び・管理の数は 0", async () => {
    const w = await makeWorld(h, "k695-019");
    expect(await review(w.mgr1)).toEqual({ unused: [], conflicts: [], broken: [] });
    expect(await reviewCount(w.mgr1)).toBe(0);
  });

  it("K695-API-020 ログインしていない：401", async () => {
    expect((await ask(null)).status).toBe(401);
  });

  it("K695-API-021 上限を超えると 429（1 分 120 回の上限を 2 に差し替えた 3 回目）", async () => {
    const w = await makeWorld(h, "k695-021");
    h.limits["getKnowledgeReview"] = 2;
    try {
      expect((await ask(w.mgr1)).status).toBe(200);
      expect((await ask(w.mgr1)).status).toBe(200);
      const r = await ask(w.mgr1);
      expect(r.status).toBe(429);
      const sec = (await h.json(r))["retry_after_sec"] as number;
      expect(Number.isInteger(sec) && sec >= 1 && sec <= 60).toBe(true);
    } finally {
      delete h.limits["getKnowledgeReview"];
    }
  });

  it("K695-API-022 読むだけ：何度読んでも、証跡・お知らせ・AI が開いた記録・破られた数・確認項目・ページの行・やり取りが 1 つも増えも変わりもしない", async () => {
    const w = await makeWorld(h, "k695-022");
    const old = await pubPage(h, w.g1, w.mgr1, "古い手順");
    await age(old, 100);
    const bk = await pubPage(h, w.g1, w.mgr1, "メールの書き方", { must: true });
    await breach(w, bk, "ai_unchecked");
    const snap = async (): Promise<(number | string)[]> => [
      await allAudits(h, w),
      ...(await Promise.all(
        [
          "notifications",
          "reference_logs",
          "knowledge_breaches",
          "test_specs",
          "ticket_messages",
          "knowledge_page_versions",
        ].map((t) => num(h, `select count(*) as n from ${t} where tenant_id = $1`, [w.co.tenantId])),
      )),
      // ページの行の中身の印（updated_at・題名・本文の頭など全部）：待たずに、読む前後で 1 字も変わらないことを見る
      (
        await h.admin.query<{ s: string }>(
          "select coalesce(md5(string_agg(t::text, ',' order by t.id)), '') as s from knowledge_pages t where t.tenant_id = $1",
          [w.co.tenantId],
        )
      ).rows[0]!.s,
    ];
    const before = await snap();
    await review(w.mgr1);
    await review(w.mgr1);
    expect(await snap()).toEqual(before);
  });

  it("K695-API-023 別の会社の物は混ざらない（同じ形の 2 つの会社が、それぞれ自分のページだけを見る）", async () => {
    const a = await makeWorld(h, "k695-023-a");
    const b = await makeWorld(h, "k695-023-b");
    const pa = await pubPage(h, a.g1, a.mgr1, "古い手順");
    const pb = await pubPage(h, b.g1, b.mgr1, "古い手順");
    await age(pa, 100);
    await age(pb, 100);
    const ba = await pubPage(h, a.g1, a.mgr1, "メール", { must: true });
    const bb = await pubPage(h, b.g1, b.mgr1, "メール", { must: true });
    await breach(a, ba, "ai_unchecked");
    await breach(b, bb, "ai_unchecked");
    const ra = await review(a.mgr1);
    const rb = await review(b.mgr1);
    expect(ra.unused.map((x) => x.id)).toEqual([pa]);
    expect(rb.unused.map((x) => x.id)).toEqual([pb]);
    expect(ra.broken.map((x) => x.id)).toEqual([ba]);
    expect(rb.broken.map((x) => x.id)).toEqual([bb]);
  });

  it("K695-API-024 DB に繋がらないとき：503 E-PAGE-003・ログに題名を出さない（読むだけなので何も残らない）", async () => {
    const w = await makeWorld(h, "k695-024");
    await pubPage(h, w.g1, w.mgr1, "ひみつの題名");
    const dead = new pg.Pool({ connectionString: "postgres://nobody:nothing@127.0.0.1:1/none", max: 1 });
    try {
      const before = createGetKnowledgeReview(dead);
      const out: { reply?: { status: number; body: Json } } = {};
      const logs = await h.captureLogs(async () => {
        out.reply = (await before({ ctx: w.mgr1.ctx, input: {}, id: "", repo: h.repo } as never)) as never;
      });
      expect(out.reply?.status).toBe(503);
      expect(out.reply?.body["code"]).toBe("E-PAGE-003");
      expect(logs).not.toContain("ひみつの題名");
    } finally {
      await dead.end().catch(() => undefined);
    }
  });

  it("K695-API-025 重さ（1 万ページ）：会社に 500・営業に 9,500 の公開済みページと、食い違う組 3 つがあるとき、200・組 3 つが見つかる（1 回の読みの時間は記録だけで落とす条件にしない。測った時間は作る段が申し送りに書く）", async () => {
    const w = await makeWorld(h, "k695-025");
    await bulk(w, w.co.rootScope, w.boss, 500, "c");
    await bulk(w, w.g1, w.mgr1, 9500, "g");
    const pairs: string[] = [];
    for (const [i, name] of ["経費精算", "出張手配", "名刺発注"].entries()) {
      const up = await pubPage(h, w.co.rootScope, w.boss, name, { text: `上 ${i}` });
      const lo = await pubPage(h, w.g1, w.mgr1, name, { text: `下 ${i}` });
      pairs.push(`${up}:${lo}`);
    }
    await h.ready();
    const t0 = Date.now();
    const r = await h.req("GET", "/knowledge/review", { headers: h.as(w.mgr1) });
    const ms = Date.now() - t0;
    expect(r.status).toBe(200);
    const data = (await h.json(r)).data as Review;
    expect(ids(data.conflicts)).toEqual([...pairs].sort());
    expect(data.unused.length).toBeLessThanOrEqual(50);
    // 時間は落とす条件にしない（台が混むと遅くなる）。作る段が測って申し送りに書く
    console.info(`[K695-API-025] 1 万ページの見直し：${ms} ms`);
  }, 120_000);

  it("K695-API-026 2 層目：口を通さず DB の関数を直に呼んでも、書けない人（メンバー）には 0 行・管理の数 0。マネージャーには同じ行が返る", async () => {
    const w = await makeWorld(h, "k695-026");
    const old = await pubPage(h, w.g1, w.mgr1, "古い手順");
    await age(old, 100);
    const asP = <T>(p: Person, sql: string): Promise<T[]> =>
      withTenant(h.pool, p.ctx, async (cl) => (await cl.query(sql)).rows as T[]);
    expect(await asP(w.mem1, "select id from app.kn_review_unused(50)")).toEqual([]);
    expect(await asP(w.mem1, "select 1 from app.kn_review_conflicts(50)")).toEqual([]);
    expect(await asP(w.mem1, "select 1 from app.kn_review_broken(50)")).toEqual([]);
    expect(await asP<{ n: number }>(w.mem1, "select app.kn_review_count() as n")).toEqual([{ n: 0 }]);
    expect(await asP<{ id: string }>(w.mgr1, "select id from app.kn_review_unused(50)")).toEqual([{ id: old }]);
    expect(await asP<{ n: number }>(w.mgr1, "select app.kn_review_count() as n")).toEqual([{ n: 1 }]);
  });

  it("K695-DB-001 日本語の題名の似ている度合いが数えられる DB で、食い違いの探しを速くする索引と 4 つの関数が在り、アプリの接続に実行を渡している（G-11）", async () => {
    expect(await same("経費の精算", "経費の精算書")).toBeGreaterThan(0);
    expect(
      await num(
        h,
        "select count(*) as n from pg_indexes where tablename = 'knowledge_pages' and indexname = 'knowledge_pages_head_trgm_idx'",
      ),
    ).toBe(1);
    for (const f of [
      "app.kn_review_unused(integer)",
      "app.kn_review_conflicts(integer)",
      "app.kn_review_broken(integer)",
      "app.kn_review_count()",
    ])
      expect(
        (await h.admin.query<{ v: boolean }>(`select has_function_privilege('kaname_app', '${f}', 'execute') as v`))
          .rows[0]!.v,
      ).toBe(true);
  });
});
