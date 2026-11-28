// AI に渡すナレッジ（K-697・D-152.4・D-152.17・D-152.23）。PC が仕事を取る瞬間（bridge.ts の withExtras）に、その時のナレッジを足す。
//   中身は DB の関数 app.bridge_job_knowledge（→ app.knowledge_context）が決める：必ず守るは本文ごと全部・ほかは目次・会社 > グループ > 自分。
//   ここは文を組む純粋な関数（renderKnowledgeSection・knowledgeExtras）と、読み込み口（loadKnowledge）だけ。
//   ログに題名・本文・ページの id・PC の印を出さない（場所と例外の種類だけ）。渡す文に PC の印・道具の鍵・預かり物を入れない
import type pg from "pg";

/** 目次に載せる上限（DB の app.knowledge_context と同じ数） */
export const KNOWLEDGE_INDEX_MAX = 200;

export interface KnowledgeMust {
  id: string;
  title: string;
  place: string;
  shelf_name: string;
  body_text: string;
  truncated: boolean;
}

export interface KnowledgeIndexItem {
  id: string;
  title: string;
  desc: string;
  place: string;
}

export interface KnowledgeContext {
  must: KnowledgeMust[];
  index: KnowledgeIndexItem[];
  must_more: number;
  index_more: number;
}

const EMPTY: KnowledgeContext = { must: [], index: [], must_more: 0, index_more: 0 };

/** 読み込めなかった仕事に足す 1 文（ナレッジ無しと同じ形では渡さない） */
export const KNOWLEDGE_LOAD_FAILED =
  "会社のナレッジを読み込めませんでした。会社の決まりを確認できていないので、外に出す操作はしないでください。";

const attr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** 本文の中の閉じ札で枠を閉じさせない */
const inner = (s: string): string => s.replace(/<\/knowledge-page/gi, "<\\/knowledge-page");

const mustBlock = (ctx: KnowledgeContext): string[] => {
  if (ctx.must.length === 0) return [];
  const pages = ctx.must.map(
    (m) =>
      `<knowledge-page id="${attr(m.id)}" place="${attr(m.place)}" title="${attr(m.title)}">\n${inner(m.body_text)}\n</knowledge-page>`,
  );
  const more = ctx.must_more > 0 ? [`（ほか ${ctx.must_more} 件は目次に載せています）`] : [];
  return ["", `### 必ず守る（${ctx.must.length} 件）`, ...pages, ...more];
};

const indexBlock = (ctx: KnowledgeContext, canOpen: boolean): string[] => {
  if (ctx.index.length === 0) return [];
  const how = canOpen
    ? "読みたいページは、道具 knowledge_open にページ id を渡すと開いて読めます。見つからないときは、題名と説明から判断してください。"
    : "題名と説明から判断してください。";
  const lines = ctx.index.map((i) => `- 「${i.title}」（${i.place}・id: ${i.id}）${i.desc ? `：${i.desc}` : ""}`);
  const more = ctx.index_more > 0 ? [`（ほか ${ctx.index_more} 件は載せていません）`] : [];
  return ["", "### ナレッジの目次", how, ...lines, ...more];
};

/** 渡す文。ナレッジが無い（null・空）なら空の字 */
export function renderKnowledgeSection(ctx: KnowledgeContext | null, o: { canOpen: boolean }): string {
  if (!ctx || (ctx.must.length === 0 && ctx.index.length === 0)) return "";
  return [
    "## 会社のナレッジ",
    "下の「必ず守る」は、すべて守ってください。ページどうしが食い違うときは、会社 > グループ > 自分 の順で、上のページが効きます。",
    ...mustBlock(ctx),
    ...indexBlock(ctx, o.canOpen),
  ].join("\n");
}

type JobShape = { kind: string; conversation_id: string | null; prompt: string };

/** 取るときの足し方。section が空の字なら変えない・null（読み込めなかった）なら 1 文だけ足す。
 *  会話の仕事は決まり（conventions）の後ろ、ほかの仕事は prompt の後ろ。ログインの試しには足さない */
export function knowledgeExtras(
  job: JobShape,
  section: string | null,
  conventions: string | null,
): { prompt: string; conventions: string | null } {
  const same = { prompt: job.prompt, conventions };
  if (job.kind === "login_check" || section === "") return same;
  const add = section ?? KNOWLEDGE_LOAD_FAILED;
  const after = (base: string | null): string => (base ? `${base}\n\n${add}` : add);
  return job.conversation_id
    ? { prompt: job.prompt, conventions: after(conventions) }
    : { prompt: after(job.prompt), conventions };
}

/** 取った仕事のナレッジを読む。DB が答えない（その PC の仕事でない）ときは空。例外は null（読めなかった）を返し、ログは種類だけ */
export async function loadKnowledge(pool: pg.Pool, sid: string, jobId: string): Promise<KnowledgeContext | null> {
  try {
    const r = await pool.query<{ v: KnowledgeContext | null }>("select app.bridge_job_knowledge($1, $2) as v", [
      sid,
      jobId,
    ]);
    return r.rows[0]?.v ?? EMPTY;
  } catch (e) {
    console.error(`[knowledge] 渡す物を作れなかった（${(e as Error)?.name ?? "Error"}）`);
    return null;
  }
}
