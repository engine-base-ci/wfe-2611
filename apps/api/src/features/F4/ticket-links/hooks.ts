// つながりの口（K-441・K-59 の葉）：listTicketLinks（読む）・createTicketLink（足す）・deleteTicketLink（外す）。
//   つながりは関連（向きなし・行は 1 つ）と派生元（from＝派生した側・to＝元）の 2 つだけ（D-125.50・D-128.80・D-150.16）。
//   どの口も withTenant の 1 取引・文 1 つ（DB の関数 1 回）。判定（会社・見える・書ける・消した・自分自身・重複・派生元の輪）は
//   DB の関数が持つ（security definer・migration 20261122094100）。口は答えの言葉を HTTP に直すだけ。
//   読む：片方が見えない人には番号だけ（D-128.115）。子の一覧も同じ答え（meta.children）で返す。
//   足す：見えて書ける 2 つのチケットだけ。外す：両端のどちらか 1 つに書ける人（相手が見えなくてもよい）。
//   知らせ・やり取りの 1 行は作らない（D-125.130・D-128.45）。ログに題名・番号を出さない（場所と例外の種類だけ）
import type pg from "pg";
import { withTenant } from "@kaname/db/context";
import type { Row } from "@kaname/db/repository";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { down, notFound, replyOf } from "./errors.js";
import { toChild, toLink } from "./shape.js";

/** 一覧に出すつながり・子の上限（DB の関数も同じ数で切る） */
export const LIST_MAX = 200;

/** 足す口が受ける欄は 2 つだけ（知らない欄は欄の名前で 422） */
const INPUT_FIELDS: readonly string[] = ["other_ticket_id", "kind"];

interface ListAnswer {
  items: unknown[];
  children: unknown[];
}

/** DB の失敗（つなげない・関数の例外）は 503・E-PAGE-003。書く口の取引は例外で全部戻る（何も残らない） */
async function guarded(where: string, run: () => Promise<HookReply>): Promise<HookReply> {
  try {
    return await run();
  } catch (e) {
    return down(where, e instanceof Error ? `例外（${e.name}）` : "例外");
  }
}

export function createTicketLinkHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    listTicketLinks: {
      before: async (a: HookArgs) =>
        guarded("つながりの一覧", async () => {
          if (!a.id) return notFound();
          const v = await withTenant(
            appPool,
            a.ctx,
            async (cl) =>
              (await cl.query<{ v: ListAnswer | null }>("select app.ticket_links_list($1::uuid) as v", [a.id])).rows[0]
                ?.v ?? null,
          );
          if (!v) return notFound();
          return {
            status: 200,
            body: {
              data: v.items.map(toLink),
              meta: { limit: LIST_MAX, children: v.children.map(toChild) },
            },
          };
        }),
    },
    createTicketLink: {
      // 知らない欄はその欄の名前で 422（入口の strict な形は欄の名前を出さないので、ここで先に断る）。形の確かめは入口が続けてする
      input: (raw: unknown) => {
        if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return { input: raw as Row };
        const unknown = Object.keys(raw).filter((k) => !INPUT_FIELDS.includes(k));
        if (unknown.length === 0) return { input: raw as Row };
        return {
          reply: {
            status: 422,
            body: {
              error: "validation_failed",
              code: "VALIDATION_ERROR",
              details: unknown.map((field) => ({ field, message: "知らない欄です" })),
            },
          },
        };
      },
      before: async (a: HookArgs) =>
        guarded("つながりを足す", async () => {
          if (!a.id) return notFound();
          const r = await withTenant(
            appPool,
            a.ctx,
            async (cl) =>
              (
                await cl.query<{ v: Record<string, unknown> }>("select app.ticket_link_add($1::uuid, $2::jsonb) as v", [
                  a.id,
                  JSON.stringify({ other_ticket_id: a.input["other_ticket_id"], kind: a.input["kind"] }),
                ])
              ).rows[0]!.v,
          );
          if (r["ok"] !== true) return replyOf(r, "つながりを足す");
          return { status: 201, body: { data: toLink(r["link"]) } };
        }),
    },
    deleteTicketLink: {
      before: async (a: HookArgs) =>
        guarded("つながりを外す", async () => {
          if (!a.id) return notFound();
          const r = await withTenant(
            appPool,
            a.ctx,
            async (cl) =>
              (await cl.query<{ v: Record<string, unknown> }>("select app.ticket_link_remove($1::uuid) as v", [a.id]))
                .rows[0]!.v,
          );
          if (r["ok"] !== true) return replyOf(r, "つながりを外す");
          return { status: 200, body: { data: { id: r["id"] } } };
        }),
    },
  };
}
