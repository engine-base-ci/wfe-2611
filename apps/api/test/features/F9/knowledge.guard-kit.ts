// 段 10「AI が読んで守る」の試験（K-700 破られた数・K-701 完了を止める・K-695 見直すページ）が共有する小さな道具。
//   K-700 が運ぶ（carry）。K-701・K-695 は K-700 に依存するので同じ道具を読める。
//   中身は チケット・確認項目（必ず守るから入った行）・AI の仕事（bridge_jobs）を行の守りの外で入れる／仕事を終わらせる／破られた数とやり取りの行を読む。
//   会社・グループ・人の組み立ては K-687 の knowledge.requests-kit.ts の makeWorld を使う（K-700 は K-687 に依存する）。
//   名前の決めは 07_functional/段10-F9/土台-knowledge.md の 6 章と 11_tickets/K-700.md。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）。
import { createHash, randomUUID } from "node:crypto";
import type { KnowledgeHarness, Person } from "./knowledge.harness.js";
import { makeWorld, type World } from "./knowledge.requests-kit.js";

const sha = (s: string): string => createHash("sha256").update(s).digest("hex");
const rows = async <T>(h: KnowledgeHarness, sql: string, p: unknown[] = []): Promise<T[]> =>
  (await h.admin.query(sql, p)).rows as T[];

/** チケットを行の守りの外で入れる（段は鍵で選ぶ。既定は作業中） */
export const mkTicket = async (
  h: KnowledgeHarness,
  w: World,
  scope: string,
  who: Person,
  stage = "doing",
): Promise<string> => {
  const k = (
    await rows<{ id: string }>(h, "select id from ticket_kinds where tenant_id = $1 and deleted_at is null limit 1", [
      w.co.tenantId,
    ])
  )[0]!.id;
  const s = (
    await rows<{ id: string }>(h, "select id from ticket_stages where tenant_id = $1 and key = $2", [
      w.co.tenantId,
      stage,
    ])
  )[0]!.id;
  return (
    await rows<{ id: string }>(
      h,
      "insert into tickets (tenant_id, scope_id, number, kind_id, stage_id, title, assignee_member_id, created_by) values ($1, $2, '', $3, $4, '守る物の試験', $5, $5) returning id",
      [w.co.tenantId, scope, k, s, who.id],
    )
  )[0]!.id;
};

/** AI の仕事を「走っている」で置く。ticket があればチケットの仕事（作る段の実行の記録つき）・無ければ会話の仕事 */
export const mkJob = async (
  h: KnowledgeHarness,
  w: World,
  who: Person,
  scope: string,
  ticket: string | null,
): Promise<string> => {
  const session = (
    await rows<{ id: string }>(
      h,
      "insert into sessions (tenant_id, member_id, kind_id, device_label) values ($1, $2, 'bridge', 'PC') returning id",
      [w.co.tenantId, who.id],
    )
  )[0]!.id;
  const job = (
    await rows<{ id: string }>(
      h,
      `insert into bridge_jobs (tenant_id, scope_id, member_id, kind, state_id, prompt, started_at, taken_session_id, tool_token_hash)
       values ($1, $2, $3, $4, 'running', '試験', now(), $5, $6) returning id`,
      [w.co.tenantId, scope, who.id, ticket ? "ticket" : "chat", session, sha(randomUUID())],
    )
  )[0]!.id;
  if (ticket)
    await h.admin.query(
      "insert into action_runs (tenant_id, scope_id, ticket_id, phase, status_id, bridge_job_id, started_at, created_by) values ($1, $2, $3, 'make', 'running', $4, now(), $5)",
      [w.co.tenantId, scope, ticket, job, who.id],
    );
  return job;
};

/** AI が仕事の終わりを知らせた（PC が返した結末を仕事の行に書く＝本線の bridge_finish_job が最後にすること）。既定は結果つきの done */
export const finishJob = async (
  h: KnowledgeHarness,
  job: string,
  o: { state?: "done" | "stopped" | "cancelled"; result?: string | null } = {},
): Promise<void> => {
  await h.admin.query("update bridge_jobs set state_id = $2, result = $3, finished_at = now() where id = $1", [
    job,
    o.state ?? "done",
    o.result === undefined ? "請求書を作りました" : o.result,
  ]);
};

export type CheckBy = "ai" | "human" | null;
/** 必ず守るから入った確認項目の行（source = knowledge）を入れる。by＝チェックの付き方（ai＝AI が付けた・human＝人が付けた・null＝付いていない） */
export const guardSpec = async (
  h: KnowledgeHarness,
  w: World,
  ticket: string,
  page: string,
  who: Person,
  o: { by?: CheckBy; title?: string; source?: "knowledge" | "manual"; deleted?: boolean } = {},
): Promise<string> => {
  const by = o.by ?? null;
  const source = o.source ?? "knowledge";
  return (
    await rows<{ id: string }>(
      h,
      `insert into test_specs (tenant_id, ticket_id, title, source, source_ref_id, created_by, checked_at, checked_by_ai, checked_by_member_id, deleted_at)
       values ($1, $2, $3, $4, $5, $6, case when $7::text is null then null else now() end, coalesce($7::text = 'ai', false),
               case when $7::text = 'human' then $6::uuid else null end, case when $8::boolean then now() else null end) returning id`,
      [
        w.co.tenantId,
        ticket,
        o.title ?? `『${page.slice(0, 8)}』を守った`,
        source,
        source === "knowledge" ? page : null,
        who.id,
        by,
        o.deleted ?? false,
      ],
    )
  )[0]!.id;
};

/** AI がチェックを付けた（段 6 の道具が書く形：checked_at と checked_by_ai だけ） */
export const aiCheck = async (h: KnowledgeHarness, spec: string): Promise<void> => {
  await h.admin.query(
    "update test_specs set checked_at = now(), checked_by_ai = true, checked_by_member_id = null where id = $1",
    [spec],
  );
};
/** 人がチェックを外した（K-435 の関数が書く形：3 つとも空に戻す） */
export const humanUncheck = async (h: KnowledgeHarness, spec: string): Promise<void> => {
  await h.admin.query(
    "update test_specs set checked_at = null, checked_by_ai = false, checked_by_member_id = null, version = version + 1 where id = $1",
    [spec],
  );
};

export interface BreachRow {
  id: string;
  tenant_id: string;
  ticket_id: string;
  page_id: string;
  test_spec_id: string | null;
  kind: string;
  created_at: Date;
}
export const breachRows = (h: KnowledgeHarness, ticket: string): Promise<BreachRow[]> =>
  rows<BreachRow>(
    h,
    "select id, tenant_id, ticket_id, page_id, test_spec_id, kind, created_at from knowledge_breaches where ticket_id = $1 order by created_at, id",
    [ticket],
  );

export interface BreachLine {
  kind: string;
  author_member_id: string | null;
  body: string;
  changes: { field: string; from: string | null; to: string; note: string | null; page_id: string }[];
}
export const breachLines = (h: KnowledgeHarness, ticket: string): Promise<BreachLine[]> =>
  rows<BreachLine>(
    h,
    "select kind, author_member_id, body, changes from ticket_messages where ticket_id = $1 and changes->0->>'field' = 'knowledge_breach' order by created_at, id",
    [ticket],
  );

export const pubPage = (
  h: KnowledgeHarness,
  scope: string,
  owner: Person,
  title: string,
  o: { text?: string; must?: boolean; personal?: boolean; summary?: string; folder?: string | null } = {},
): Promise<string> =>
  h.page({
    scope,
    owner,
    state: "published",
    title,
    text: o.text ?? `${title}の本文`,
    summary: o.summary ?? `${title}の説明`,
    must: o.must ?? false,
    ...(o.personal === undefined ? {} : { personal: o.personal }),
    ...(o.folder === undefined ? {} : { folder: o.folder }),
  });

/** 営業のチケット 1 枚と、効く範囲の必ず守るのページ 3 つ（会社・営業・営業メンバーの自分）と、それぞれの未チェックの確認項目と、走っている AI の仕事（job: false なら仕事は置かない＝job は空の文字） */
export interface Scene {
  w: World;
  ticket: string;
  job: string;
  pages: { co: string; gp: string; me: string };
  specs: { co: string; gp: string; me: string };
}
export const scene = async (h: KnowledgeHarness, label: string, o: { job?: boolean } = {}): Promise<Scene> => {
  const w = await makeWorld(h, label);
  const ticket = await mkTicket(h, w, w.g1, w.mem1);
  const co = await pubPage(h, w.co.rootScope, w.boss, "請求書の送り方", { must: true });
  const gp = await pubPage(h, w.g1, w.mgr1, "営業の型", { must: true });
  const me = await pubPage(h, w.mem1.scopeId, w.mem1, "自分の工夫", { must: true, personal: true });
  const specs = {
    co: await guardSpec(h, w, ticket, co, w.mem1, { title: "『請求書の送り方』を守った" }),
    gp: await guardSpec(h, w, ticket, gp, w.mem1, { title: "『営業の型』を守った" }),
    me: await guardSpec(h, w, ticket, me, w.mem1, { title: "『自分の工夫』を守った" }),
  };
  const job = o.job === false ? "" : await mkJob(h, w, w.mem1, w.g1, ticket);
  return { w, ticket, job, pages: { co, gp, me }, specs };
};
