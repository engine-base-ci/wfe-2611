// 項目の変更を点の形に戻す口（restoreTicketItems・POST /api/v1/tickets/:id/item-changes/restore・K-576）の振る舞い。
//   入口が契約の形（from・to の 2 欄だけ・1 以上の整数・知らない欄は 422）を確かめた後、app.ticket_item_restore（関門 C2・C6）が
//   K-433 の点と正味の変わりを読み、戻せる物だけを各組の関数（期限と開始日・優先度・予定時間・会社の項目）を通して戻し、
//   まとめの行と証跡を書く（1 つの取引）。戻せなかった項目と訳は 200 の答えに返す（D-150.52）。
//   404・409 の体は { error, code, message, action } だけ（field・details・detail を付けない）。ログに題名・値・理由を出さない（例外の種類だけ）
import type pg from "pg";
import { KanameError } from "@kaname/errors";
import { withTenant } from "@kaname/db/context";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";
import { unavailable } from "../body/errors.js";
import { VERSION_MAX } from "../body/input.js";
import type { Detail } from "./input.js";

const NOT_FOUND: HookReply = { status: 404, body: { error: "not_found", code: "E-PAGE-001" } };
/** 無い・別の会社・見えない（入口の行の確かめの NOT_FOUND と同じ答え。入口はこの口の :id を読まない） */
const MISSING: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };
const FORBIDDEN: HookReply = { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };

/** 409 の体（正本の文を引く・欄を付けない） */
const conflict = (code: string): HookReply => {
  const e = new KanameError(code);
  return { status: 409, body: { error: "conflict", code, message: e.entry.message, action: e.entry.action } };
};

/** DB の答えの言葉 → HTTP の答え。知らない言葉と guard_failed は止める側（503）に倒す */
const REPLIES: Readonly<Record<string, () => HookReply>> = {
  not_found: () => NOT_FOUND,
  missing: () => MISSING,
  not_member: () => FORBIDDEN,
  not_writable: () => FORBIDDEN,
  done: () => conflict("E-ITM-001"),
  stale: () => conflict("E-ITM-002"),
  nothing: () => conflict("E-ITM-003"),
};

export type ItemRestoreChecked = { ok: true; from: number; to: number } | { ok: false; details: Detail[] };

/** 点の番号は DB の int（契約の VALUE_RANGES の maximum と同じ）。超える数は 422（DB の 22003 で 503 にしない） */
const isPoint = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v) && v >= 1 && v <= VERSION_MAX;

/** 入力の形（契約が先に断る物の重ねで、最後の砦）。from・to は 1 以上の整数・ほかの欄は受けない */
export function checkItemRestore(input: Record<string, unknown>): ItemRestoreChecked {
  const details: Detail[] = [];
  for (const k of ["from", "to"] as const)
    if (!isPoint(input[k])) details.push({ field: k, message: "点の番号は 1 以上 2147483647 以下の整数で送ってください" });
  for (const k of Object.keys(input))
    if (k !== "from" && k !== "to") details.push({ field: k, message: "この欄は受けません" });
  if (details.length > 0) return { ok: false, details };
  return { ok: true, from: input["from"] as number, to: input["to"] as number };
}

export function createRestoreTicketItems(appPool: pg.Pool): NonNullable<Hook["before"]> {
  return async (a: HookArgs): Promise<HookReply> => {
    const checked = checkItemRestore(a.input);
    if (!checked.ok)
      return { status: 422, body: { error: "validation_failed", code: "VALIDATION_ERROR", details: checked.details } };
    let v: Record<string, unknown>;
    try {
      v = await withTenant(
        appPool,
        a.ctx,
        async (cl) =>
          (
            await cl.query<{ v: Record<string, unknown> }>(
              "select app.ticket_item_restore($1::uuid, $2::int, $3::int) as v",
              [a.id, checked.from, checked.to],
            )
          ).rows[0]!.v,
      );
    } catch (ex) {
      console.error(`[ticket-item-restore] 戻せなかった（${(ex as Error)?.name ?? "Error"}）`);
      return unavailable();
    }
    const kind = v["error"];
    if (typeof kind === "string") {
      const reply = REPLIES[kind];
      if (reply) return reply();
      console.error(`[ticket-item-restore] 戻せなかった（${kind === "guard_failed" ? "guard_failed" : "unknown"}）`);
      return unavailable();
    }
    return {
      status: 200,
      body: { data: { changed: v["changed"] === true, restored: v["restored"] ?? [], skipped: v["skipped"] ?? [] } },
    };
  };
}
