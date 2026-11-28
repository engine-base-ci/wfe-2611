// チケットの設定 › 種別を足す・直す・消す・並べる口（K-704・設計は 07_functional/段10-F9/土台-settings.md の 3 章）。
//   口は「入力の確かめ → DB の関数（app.ticket_kind_create / update / delete / reorder・関門 C2）を 1 つの取引で呼ぶ → 答えの形」だけ。
//   権限・名前の一意・数の上限・使っているチケットの数・並びの一致は DB の関数が確かめる（口と関数の 2 層：権限は関数も見る）。
//   名前とひな形は、入口が揃えた体（NFKC・前後の空白を落とした物）でなく画面が送ったままを使う（名前は NFKC にしない）。
//   断る：形の誤り 422（欄つき）／無い・見えない 404 E-PAGE-001／409 E-KND-001〜005（欄・details なし。E-KND-003 だけ detail に ticket_count）／
//         権限なし 403／DB の失敗 503 E-PAGE-003。ログに種別の名前・ひな形の中身を出さない（口の名前と例外の種類だけ）
import type pg from "pg";
import { validateDoc } from "@kaname/contracts";
import { withTenant } from "@kaname/db/context";
import { kanameError } from "@kaname/errors";
import type { Hook, HookArgs, HookReply } from "../../../contract/deps.js";

/** 見分けの色 8 つの鍵（04_design/DESIGN-kaname.md の data:） */
export const COLOR_KEYS = ["indigo", "teal", "amber", "coral", "sage", "plum", "lavender", "teal-light"] as const;
/** 名前の字数の上限（前後の空白を落とした後） */
export const NAME_MAX = 40;

type Detail = { field: string; message: string };
type Body = Record<string, unknown>;

const invalid = (details: Detail[]): HookReply => ({
  status: 422,
  body: { error: "validation_failed", code: "VALIDATION_ERROR", details },
});

/** 正本のエラー（field・details を付けない。detail は差し込む値があるときだけ） */
const bare = (code: string, status: number, detail?: Record<string, unknown>): HookReply => {
  const body: Body = { ...kanameError(code).toJSON() };
  if (detail) body["detail"] = detail;
  else delete body["detail"];
  return { status, body };
};

const unavailable = (): HookReply => bare("E-PAGE-003", 503);

/** DB の関数の断りの言葉 → 409 の番号 */
const CONFLICTS: Readonly<Record<string, string>> = {
  name_taken: "E-KND-001",
  limit: "E-KND-002",
  in_use: "E-KND-003",
  order_mismatch: "E-KND-004",
  last_kind: "E-KND-005",
};

/** 無い・消した・別の会社の種別（404 E-PAGE-001・欄・details なし） */
const notFoundKind = (): HookReply => bare("E-PAGE-001", 404);

/** DB の関数の答え { error } → 口の答え。知らない言葉は止める側（503） */
function refusal(r: Body, op: string): HookReply {
  const word = String(r["error"]);
  if (word === "forbidden") return { status: 403, body: { error: "forbidden", code: "FORBIDDEN" } };
  if (word === "invalid") return invalid([{ field: "body", message: "入力内容を確認してください" }]);
  const code = CONFLICTS[word];
  if (code) return bare(code, 409, word === "in_use" ? { ticket_count: Number(r["ticket_count"] ?? 0) } : undefined);
  console.error(`[ticket-kinds] ${op}：知らない答え（${word}）なので止める側に倒した`);
  return unavailable();
}

/** :id の行を読む口（直す・消す）の断り：行が無い（not_found）は 404 E-PAGE-001、ほかは refusal。
 *  作る・並べ替えの関数は not_found を返さないので refusal だけ（口ごとに読み替えを分ける・K-144 の SHAPE_010・ふるまいは同じ） */
function refusalOfRow(r: Body, op: string): HookReply {
  return String(r["error"]) === "not_found" ? notFoundKind() : refusal(r, op);
}

/** 答えの形（鍵ちょうど 6） */
export function toKindSetting(row: Body): Body {
  return {
    id: row["id"],
    name: row["name"],
    color_key: row["color_key"] ?? null,
    position: row["position"],
    is_builtin: row["is_builtin"],
    body_template: row["body_template"] ?? null,
  };
}

/** 画面が送ったままの体（読めなければ入口が揃えた体） */
async function sentBody(a: HookArgs): Promise<Body> {
  try {
    const raw: unknown = await a.c.req.json();
    if (typeof raw === "object" && raw !== null && !Array.isArray(raw)) return raw as Body;
  } catch {
    // 読めなければ入口が揃えた体を使う
  }
  return a.input;
}

const trimName = (v: string): string => v.trim();

function checkName(v: unknown, details: Detail[]): string | undefined {
  if (typeof v !== "string") {
    details.push({ field: "name", message: "名前を文字で送ってください" });
    return undefined;
  }
  const name = trimName(v);
  if (name.includes("\u0000")) details.push({ field: "name", message: "名前に使えない文字があります" });
  else if ([...name].length < 1 || [...name].length > NAME_MAX)
    details.push({ field: "name", message: `名前は 1〜${NAME_MAX} 字で送ってください` });
  else return name;
  return undefined;
}

function checkColor(v: unknown, details: Detail[]): string | undefined {
  if (typeof v === "string" && (COLOR_KEYS as readonly string[]).includes(v)) return v;
  details.push({ field: "color_key", message: `色は ${COLOR_KEYS.join("・")} のどれかで送ってください` });
  return undefined;
}

/** ひな形は文書の木か null。木の決まりは validateDoc（K-561）。根の節は type と content だけ（text は受けない） */
function checkTemplate(v: unknown, details: Detail[]): unknown {
  if (v === null || v === undefined) return null;
  const checked = validateDoc(v);
  const rootKeys = typeof v === "object" ? Object.keys(v as Body) : [];
  if (!checked.ok || rootKeys.some((k) => k !== "type" && k !== "content")) {
    details.push({ field: "body_template", message: "本文のひな形の形が決まりに合いません" });
    return undefined;
  }
  return checked.doc;
}

/** DB の関数を 1 つの取引で呼び、答えを口の答えにする。落ちたら 503（同じ取引なので何も書かない） */
async function run(
  appPool: pg.Pool,
  a: HookArgs,
  op: string,
  sql: string,
  params: unknown[],
  ok: (data: unknown) => HookReply,
  refuse: (r: Body, op: string) => HookReply = refusal,
): Promise<HookReply> {
  let r: Body;
  try {
    r = await withTenant(appPool, a.ctx, async (cl) => (await cl.query<{ r: Body }>(sql, params)).rows[0]!.r);
  } catch (ex) {
    console.error(`[ticket-kinds] ${op}：書けなかった（${(ex as Error)?.name ?? "Error"}）`);
    return unavailable();
  }
  if (r["error"] !== undefined) return refuse(r, op);
  return ok(r["data"]);
}

const one =
  (status: number) =>
  (data: unknown): HookReply => ({
    status,
    body: { data: toKindSetting((data ?? {}) as Body) },
  });

export function createKindHooks(appPool: pg.Pool): Record<string, Hook> {
  return {
    createTicketKind: {
      before: async (a) => {
        const raw = await sentBody(a);
        const details: Detail[] = [];
        const name = checkName(raw["name"], details);
        const color = checkColor(raw["color_key"], details);
        const tpl = checkTemplate(raw["body_template"], details);
        if (details.length) return invalid(details);
        return run(
          appPool,
          a,
          "createTicketKind",
          "select app.ticket_kind_create($1, $2, $3::jsonb) as r",
          [name, color, tpl === null ? null : JSON.stringify(tpl)],
          one(201),
        );
      },
    },
    updateTicketKind: {
      // 入口（op.ts の 4.1・行に結ぶ言葉）が :id の行を見つけられないときも、この口の決め（404 E-PAGE-001・欄なし）で返す（統合の枝）
      rowMissing: notFoundKind,
      before: async (a) => {
        const raw = await sentBody(a);
        const details: Detail[] = [];
        const patch: Body = {};
        if ("name" in raw) patch["name"] = checkName(raw["name"], details);
        if ("color_key" in raw) patch["color_key"] = checkColor(raw["color_key"], details);
        if ("body_template" in raw) patch["body_template"] = checkTemplate(raw["body_template"], details);
        if (!("name" in raw) && !("color_key" in raw) && !("body_template" in raw))
          details.push({ field: "body", message: "名前・色・本文のひな形のどれかを送ってください" });
        if (details.length) return invalid(details);
        return run(
          appPool,
          a,
          "updateTicketKind",
          "select app.ticket_kind_update($1::uuid, $2::jsonb) as r",
          [a.id, JSON.stringify(patch)],
          one(200),
          refusalOfRow,
        );
      },
    },
    deleteTicketKind: {
      // 入口（op.ts の 4.1・行に結ぶ言葉）が :id の行を見つけられないときも、この口の決め（404 E-PAGE-001・欄なし）で返す（統合の枝）
      rowMissing: notFoundKind,
      before: async (a) =>
        run(
          appPool,
          a,
          "deleteTicketKind",
          "select app.ticket_kind_delete($1::uuid) as r",
          [a.id],
          (data) => ({ status: 200, body: { data: { id: ((data ?? {}) as Body)["id"] } } }),
          refusalOfRow,
        ),
    },
    reorderTicketKinds: {
      before: async (a) => {
        const ids = a.input["kind_ids"];
        if (!Array.isArray(ids) || ids.length === 0)
          return invalid([{ field: "kind_ids", message: "種別の id を 1 つ以上の並びで送ってください" }]);
        return run(
          appPool,
          a,
          "reorderTicketKinds",
          "select app.ticket_kind_reorder($1::uuid[]) as r",
          [ids],
          (data) => ({
            status: 200,
            body: { data: ((data ?? []) as Body[]).map(toKindSetting) },
          }),
        );
      },
    },
  };
}
