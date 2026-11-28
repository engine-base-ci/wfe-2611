// 運営が受信箱の問い合わせに返す（replyOpsInquiry・POST /api/v1/ops/inquiries/:id/replies）と
//   社内メモを書く（addOpsInquiryNote・POST /api/v1/ops/inquiries/:id/notes）（K-975・関門 C2・C6・D-156.25・D-156.28・D-156.40・D-125.130）。
//   振る舞いの本体は DB の関数 app.ops_inquiry_reply・app.ops_inquiry_note（20261128011500_ops_inbox_reply.sql）。
//   返す：opsTx の 1 取引で ① 関数（書き込み・状態・担当・運営の記録）② 関門 C6（@kaname/notify の NotifyGateway）で問い合わせた本人に
//     inapp の inquiry.replied を 1 通（送り口は同じ取引の接続で app.inquiry_reply_notice を呼ぶ・メールは送らない）
//     ③ 送れなければ例外にして取引ごと戻す → 503 E-PAGE-003（返したと言わない・G-15）④ 送れたら commit して 201 { data }。
//   社内メモ：opsTx で関数を 1 回 → 201 { data }。顧客には出さない（見え方 ops_only・鈴なし）。
//   ほかの人が担当の問い合わせに返すのは 409 E-OPS-005（欄なし・何も書かない）。ログは場所と SQLSTATE か断りの言葉だけ（本文を出さない）
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { kanameError } from "@kaname/errors";
import { NotifyGateway, type Transport } from "@kaname/notify";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";
import { OPS_INQUIRY_MESSAGE_KEYS } from "./inbox-shape.js";
import { isUuid } from "@kaname/contracts";
import { overMax, TEXT_MAX } from "../inquiries/errors.js";

export const REPLIED_KIND = "inquiry.replied";

export interface InboxReplyDeps {
  appPool: pg.Pool;
  repo: Repository;
}

type Json = Record<string, unknown>;
type Fn = { error?: string; data?: unknown; asker?: unknown; tenant?: unknown } | null;

interface Issue {
  field: string;
  message: string;
}

const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 正本のエラー。欄・details・detail を付けない（在るかを漏らさない・控え帳） */
const flat = (code: string, status: number): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code).toJSON() };
  delete body["detail"];
  return { status, body };
};

const unavailable = (where: string, word: string): HookReply => {
  console.error(`[ops] ${where} を書けなかった（${word.slice(0, 40)}）`);
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
};

/** 関数の断りの言葉 → 答え。知らない言葉は止める側（503） */
function replyOf(word: string, where: string): HookReply {
  if (word === "taken") return flat("E-OPS-005", 409);
  if (word === "empty") return invalid([{ field: "body", message: "空白だけは送れない" }]);
  return unavailable(where, word);
}

/** OpsInquiryMessage の 6 欄（鍵の並びは契約と同じ・知らない鍵は落とす） */
function toMessage(src: unknown): Json {
  const o = (src ?? {}) as Json;
  const m = Object.fromEntries(OPS_INQUIRY_MESSAGE_KEYS.map((k) => [k, o[k] ?? null]));
  return { ...m, attachments: Array.isArray(m["attachments"]) ? m["attachments"] : [] };
}

/** 入口の形の確かめ（:id が uuid・body が 4000 字までの文字・契約の VALUE_RANGES）。契約の入口が先に断るが、ここでも見る（2 層目） */
function checkInput(a: HookArgs): Issue[] {
  const issues: Issue[] = [];
  if (!isUuid(a.id ?? "")) issues.push({ field: "id", message: "uuid の形" });
  const body = ((a.input ?? {}) as Json)["body"];
  if (typeof body !== "string") issues.push({ field: "body", message: "文字" });
  else if (overMax(body, TEXT_MAX)) issues.push({ field: "body", message: `${TEXT_MAX} 字までで送ってください` });
  return issues;
}

/** 送れなかった（取引ごと戻すための例外）。外に出すのは種類だけ */
class NotSent extends Error {
  constructor(readonly word: string) {
    super("送れなかった");
    this.name = "NotSent";
  }
}

/** 関門 C6 で問い合わせた本人に inapp を 1 通。送り口は同じ取引の接続（cl）で受け箱の行を書く。送れたら true（deliveries に sent があるときだけ） */
async function notifyAsker(
  repo: Repository,
  cl: pg.PoolClient,
  ctx: TenantContext,
  inquiryId: string,
  messageId: string,
  asker: string,
): Promise<boolean> {
  const inbox: Transport = {
    send: async () => {
      const r = await cl.query<{ n: number }>("select app.inquiry_reply_notice($1::uuid) as n", [messageId]);
      if (r.rows[0]?.n !== 1) throw new Error("受け箱の行を書けなかった");
    },
  };
  const gw = new NotifyGateway(
    repo,
    inbox,
    {
      resolve: async () => [{ memberId: asker, kind: "human", address: null }],
      // 返事ごとに違う鍵（書き込みの id）。受け箱の重なりは関数が dedupe_key で見る
      seen: async () => false,
      remember: async () => undefined,
    },
    // 1 回だけ：同じ取引の中で落ちた文の後は、送り直しても取引が止まっているので通らない
    { channelsOf: () => ["inapp"], maxAttempts: 1 },
  );
  const r = await gw.notify(
    { kind: REPLIED_KIND, payload: { inquiry_id: inquiryId }, dedupeKey: `${REPLIED_KIND}:${messageId}` },
    { memberIds: [asker] },
    ctx,
  );
  return r.deliveries.some((x) => x.status === "sent");
}

export function createReplyOpsInquiry(d: InboxReplyDeps): (a: HookArgs) => Promise<HookReply> {
  const where = "inbox-reply";
  return async (a) => {
    const issues = checkInput(a);
    if (issues.length) return invalid(issues);
    const id = a.id as string;
    const body = (a.input as Json)["body"] as string;
    try {
      return await opsTx(d.appPool, a.ctx, async (cl) => {
        const r = (await cl.query<{ j: Fn }>("select app.ops_inquiry_reply($1::uuid, $2) as j", [id, body])).rows[0]?.j;
        if (!r) throw new NotSent("empty-answer");
        if (r.error) return replyOf(r.error, where);
        const data = toMessage(r.data);
        const asker = typeof r.asker === "string" ? r.asker : "";
        const tenant = typeof r.tenant === "string" ? r.tenant : "";
        if (!asker || !tenant || typeof data["id"] !== "string") throw new NotSent("no-asker");
        // 関門 C6 は送り先の会社の文脈で動く（人と役割は運営の人のまま）
        const ctx: TenantContext = { ...a.ctx, tenantId: tenant };
        let sent: boolean;
        try {
          sent = await notifyAsker(d.repo, cl, ctx, id, data["id"], asker);
        } catch (e) {
          throw new NotSent((e as Error)?.name ?? "Error");
        }
        if (!sent) throw new NotSent("not-sent");
        return { status: 201, body: { data } };
      });
    } catch (e) {
      if (e instanceof NotSent) return unavailable(where, e.word);
      return opsErrorReply(e, where);
    }
  };
}

export function createAddOpsInquiryNote(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  const where = "inbox-note";
  return async (a) => {
    const issues = checkInput(a);
    if (issues.length) return invalid(issues);
    let r: Fn | undefined;
    try {
      r = await opsTx(appPool, a.ctx, async (cl) => {
        const q = await cl.query<{ j: Fn }>("select app.ops_inquiry_note($1::uuid, $2) as j", [
          a.id,
          (a.input as Json)["body"],
        ]);
        return q.rows[0]?.j;
      });
    } catch (e) {
      return opsErrorReply(e, "inbox-reply");
    }
    if (!r) return unavailable(where, "empty-answer");
    if (r.error) return replyOf(r.error, where);
    return { status: 201, body: { data: toMessage(r.data) } };
  };
}
