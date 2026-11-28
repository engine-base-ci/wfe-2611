// 運営が障害の続報を足す口（addIncidentUpdate・POST /api/v1/ops/notices/:id/updates）（K-979・関門 C2・D-125.127・D-156.28）。
//   認証・運営の人で notice を持つか（403）・入力の形（422：state は 4 つ・body 1〜4000 字・NUL・知らない鍵）・上限は契約の入口（op.ts）が先に確かめる。
//   ここでも state と body を確かめ（入口に頼らない 2 層目）、opsTx の 1 取引で DB の関数 app.ops_notice_incident_update を 1 回呼ぶ。
//   関数が続報の行・今の状態の行（直ったなら resolved_at）・運営の記録を同じ取引で書く。書けなければ全部戻る（503）。
//   答えは K-977 の app.ops_notice_detail を shape.ts で 16 欄にした物（自分で読み替えない）。鈴・メールは出さない
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../../contract/deps.js";
import { opsErrorReply, opsTx } from "../db.js";
import { toOpsNoticeDetail } from "./shape.js";

const INCIDENT_STATES = ["investigating", "identified", "monitoring", "resolved"] as const;
const BODY_MAX = 4000;

interface Issue {
  field: string;
  message: string;
}

const invalid = (details: Issue[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 正本のエラー。欄・details・detail を付けない（控え帳） */
const flat = (code: string, status: number): HookReply => {
  const body: Record<string, unknown> = { ...kanameError(code).toJSON() };
  delete body["detail"];
  return { status, body };
};

/** 関数の断りの言葉 → 答え。知らない言葉は止める側（503・言葉の頭だけをログに） */
function replyOf(word: string): HookReply {
  if (word === "not_live_incident") return flat("E-OPS-012", 409);
  if (word === "already_resolved") return flat("E-OPS-013", 409);
  console.error(`[notices] 続報を足せなかった（${word.slice(0, 40)}）`);
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
}

/** 2 層目の確かめ（入口が先に 422 で断る） */
function checkInput(raw: Record<string, unknown>): Issue[] {
  const issues: Issue[] = [];
  if (!(INCIDENT_STATES as readonly unknown[]).includes(raw["state"]))
    issues.push({ field: "state", message: INCIDENT_STATES.join("・") });
  const body = raw["body"];
  if (typeof body !== "string" || body.length === 0 || body.length > BODY_MAX || body.includes("\u0000"))
    issues.push({ field: "body", message: `1〜${BODY_MAX} 字` });
  return issues;
}

type Fn = { error?: string; data?: unknown } | null;

export function createAddIncidentUpdate(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const raw = (a.input ?? {}) as Record<string, unknown>;
    const issues = checkInput(raw);
    if (issues.length) return invalid(issues);
    let r: Fn;
    try {
      r = await opsTx(appPool, a.ctx, async (cl) => {
        const q = await cl.query<{ j: Fn }>("select app.ops_notice_incident_update($1::uuid, $2, $3) as j", [
          a.id ?? "",
          raw["state"],
          raw["body"],
        ]);
        return q.rows[0]?.j ?? null;
      });
    } catch (e) {
      return opsErrorReply(e, "notices");
    }
    if (!r) return replyOf("empty");
    if (r.error) return replyOf(r.error);
    return { status: 201, body: { data: toOpsNoticeDetail(r.data) } };
  };
}
