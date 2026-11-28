// 自分で直す口（K-742・契約の口 editApproval・POST /api/v1/approvals/:id/edit・体は { text, version }・D-153.28・関門 C2）。
//   承認する人（今の担当者）が成果物の字を直すと、成果物の区画に新しい版ができ、承認待ちのまま（承認の行は決めない）。
//   書くのは DB の関数 app.approval_self_edit の 1 取引だけ（区画の版・版の履歴・やり取りの 1 行・証跡）。お知らせは書かない。
//   字は書いたとおりに残す：入口（op.ts）は字を正規化するので、正規化の前の体（rawBody・K-62 の finishBridgeJob と同じ作り）を使う。
//   入力の形は口が自分で確かめる（入口の zod は値域と必須を読まない）：text が無い・文字でない・空白（全角も）だけ、
//   version が無い・1 以上の整数でない、はどれも 422（欄つき）。長さの上限は置かない（D-130.3・守りは送る量 1MB だけ）。
//   DB の答え：stale は 409・E-APR-020（今の版を載せる）・unchanged は 409・E-APR-021・text_empty は 422（欄 text）、
//   ほかは K-63 の replyOf。関数が例外（DB・証跡）は 503・E-PAGE-003（ログに字を出さない・取引ごと戻る）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { fromCatalog, invalid, replyOf } from "../approve-complete/errors.js";
import { rawBody } from "../delegate/bridge.js";

type Edited = {
  error?: string;
  current_version?: number;
  id?: string;
  ticket_id?: string;
  version?: number;
  edited_at?: string;
};
type Parsed = { text: string; version: number } | { reply: HookReply };

/** 体を確かめる。字は正規化の前の値（無ければ入口の値）、版は正規化の前の値で型まで見る（"1" のような文字は通さない） */
export function parseEdit(input: Record<string, unknown>, raw: Record<string, unknown>): Parsed {
  const text = typeof raw["text"] === "string" ? raw["text"] : input["text"];
  if (typeof text !== "string") return { reply: invalid("text", "直した成果物の字を文字で送ってください") };
  if (!/\S/.test(text)) return { reply: invalid("text", "直した成果物の字が空です") };
  const version = "version" in raw ? raw["version"] : input["version"];
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1)
    return { reply: invalid("version", "直す前に読んだ成果物の版を 1 以上の整数で送ってください") };
  return { text, version };
}

/** DB の答えの言葉 → 答え（この口だけの言葉を先に読み、ほかは K-63 の replyOf） */
function editReplyOf(r: Edited): HookReply {
  if (r.error === "stale") {
    const base = fromCatalog("E-APR-020", 409);
    return { ...base, body: { ...(base.body as Record<string, unknown>), current_version: r.current_version ?? null } };
  }
  if (r.error === "unchanged") return fromCatalog("E-APR-021", 409);
  if (r.error === "text_empty") return invalid("text", "直した成果物の字が空です");
  return replyOf(r, "成果物を自分で直す");
}

export function createApprovalEdit(pool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs): Promise<HookReply> => {
    const p = parseEdit(a.input, await rawBody(a));
    if ("reply" in p) return p.reply;
    let r: Edited | undefined;
    try {
      r = await withTenant(
        pool,
        a.ctx,
        async (cl) =>
          (await cl.query<{ v: Edited }>("select app.approval_self_edit($1, $2, $3) as v", [a.id, p.text, p.version]))
            .rows[0]?.v,
      );
    } catch (e) {
      console.error(`[approval-edit] 自分で直す：止める側に倒した（${(e as Error)?.name ?? "Error"}）`);
      return fromCatalog("E-PAGE-003", 503);
    }
    if (!r) return fromCatalog("E-PAGE-003", 503);
    if (r.error !== undefined) return editReplyOf(r);
    const { id, ticket_id, version, edited_at } = r;
    return { status: 201, body: { data: { id, ticket_id, version, edited_at } } };
  };
}
