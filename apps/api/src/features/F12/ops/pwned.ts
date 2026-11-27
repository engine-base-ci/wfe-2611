// K-995 照合が使えなかった登録の回収の口（D-128.134・D-128.146・D-156.35）。
//   一覧 listOpsPwned（GET /api/v1/ops/pwned）：まだ確かめていない会社を 1 行ずつ（日時・ワークスペース・人・件数）。
//   確かめた ackOpsPwned（POST /api/v1/ops/workspaces/:id/pwned/ack）：その会社に確かめた印・運営の記録。
//     確かめていない会社が 0 になったら運営の会社にも印（照合が次に落ちたとき、また 1 通メールが出る）。
//   上限（429）・認証（401）・同意し直し（403）・運営の人か（403）・:id と体の形（422）・運営の会社を指す（404）は契約の入口（op.ts・K-1001）が先に確かめる。
//   DB の関数（20261128013500_ops_pwned.sql）が頭で app.ops_require('any')・app.ops_target を呼ぶ（2 層目・K-947）。
//   DB の断りは opsErrorReply（42501 → 403・P0002 → 404・ほか → 503 E-PAGE-003）。答えに出来事の中身（理由・メール）を入れない
import type pg from "pg";
import { KanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";

/** 確かめる物が無い（もう確かめた・出来事が無い）。欄なし */
const NOTHING_TO_ACK = "E-OPS-026";

interface ListAnswer {
  data: unknown[];
}
interface AckAnswer {
  acknowledged_at?: string;
  remaining?: number;
  error?: string;
}

const isList = (v: unknown): v is ListAnswer =>
  typeof v === "object" && v !== null && Array.isArray((v as { data?: unknown }).data);

export function createListOpsPwned(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    try {
      const out = await opsTx(appPool, a.ctx, async (client) => {
        const r = await client.query<{ r: unknown }>("select app.ops_pwned_list() as r");
        return r.rows[0]?.r ?? null;
      });
      if (!isList(out)) return opsErrorReply(new Error("答えの形が違う"), "pwned");
      return { status: 200, body: { data: out.data } };
    } catch (e) {
      return opsErrorReply(e, "pwned");
    }
  };
}

export function createAckOpsPwned(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const tenant = a.id ?? "";
    let out: AckAnswer | null;
    try {
      out = await opsTx(appPool, a.ctx, async (client) => {
        const r = await client.query<{ r: AckAnswer | null }>("select app.ops_pwned_ack($1) as r", [tenant]);
        return r.rows[0]?.r ?? null;
      });
    } catch (e) {
      return opsErrorReply(e, "pwned");
    }
    if (out?.error === "none") return { status: 409, body: new KanameError(NOTHING_TO_ACK).toJSON() };
    if (typeof out?.acknowledged_at !== "string" || typeof out.remaining !== "number") {
      return opsErrorReply(new Error("答えの形が違う"), "pwned");
    }
    return { status: 200, body: { data: { acknowledged_at: out.acknowledged_at, remaining: out.remaining } } };
  };
}
