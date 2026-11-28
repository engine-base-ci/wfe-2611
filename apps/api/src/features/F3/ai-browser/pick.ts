// K-364 AI が使うブラウザを PC ごとに選ぶ口（updateMyDevice・PATCH /api/v1/bridge/devices/:id・体は { browser } だけ）。
//   選べる値は 3 つ：自分の Chrome（chrome・既定）／Bridge 専用のブラウザ（dedicated）／使わない（off）（D-119・D-120）。
//   上限（1 分に 60 回・人ごと）・認証（401）・役（取引先と運営は 403）・同意し直しの止め・:id の形（uuid）・体の形（strict・NFKC と前後の空白を落とす）は契約の入口（op.ts）が先に確かめる。
//   PC はアカウントのもの（D-128.137・D-128.156）。入口の行の確かめから外し（scripts/ci/row_rules.mjs の ROW_EXEMPT）、持ち主は 1 つの文で 2 重に確かめる（D-128.166）：
//     1 つ目＝口：その人のアカウントの PC の一覧（app.bridge_devices）に :id が在るか ／ 2 つ目＝DB の関数（app.device_set_browser）が account_members で絞って書く。
//   どちらかで外れたら同じ 404（他の人の PC・外した PC・消した PC・無い PC を見分けさせない）。
//   選んだ値は次の生きている知らせ（sendHeartbeat の答えの browser）で Bridge に渡る。走っている仕事のブラウザは変えない。
//   DB の失敗は 503・E-PAGE-003（1 つの文なので半分だけ書いた形は無い）。ログに PC の id・人の id・DB の文を出さない
import type pg from "pg";
import { KanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

/** 選べる値（sessions.browser の check と同じ 3 つ） */
export const DEVICE_BROWSERS = ["chrome", "dedicated", "off"] as const;
export type DeviceBrowser = (typeof DEVICE_BROWSERS)[number];

/** 422 の文（Bridge の窓から選ぶ口 K-366 も使う） */
export const BROWSER_REJECTED_MESSAGE = "chrome・dedicated・off のどれかを選んでください";

const browserRejected: HookReply = {
  status: 422,
  body: {
    error: "validation_failed",
    code: "VALIDATION_ERROR",
    details: [{ field: "browser", message: BROWSER_REJECTED_MESSAGE }],
  },
};
const notFound: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };

/** 入口が NFKC と前後の空白を落とした後の値が 3 つのどれかなら、その値。違えば null */
export function deviceBrowserOf(v: unknown): DeviceBrowser | null {
  return typeof v === "string" && (DEVICE_BROWSERS as readonly string[]).includes(v) ? (v as DeviceBrowser) : null;
}

// 2 重の確かめと書くのを 1 つの文で：1 つ目（口）が外れたら関数を呼ばず null、通っても関数が外せば null
const PICK_SQL = `select case
    when exists (select 1 from jsonb_array_elements(app.bridge_devices($1)) e where e->>'id' = $2)
    then app.device_set_browser($1, $2::uuid, $3)
  end as v`;

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

export function createPickDeviceBrowser(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  return async (a: HookArgs) => {
    const browser = deviceBrowserOf(a.input["browser"]);
    if (browser === null) return browserRejected;
    let v: unknown;
    try {
      const r = await appPool.query<{ v: unknown }>(PICK_SQL, [a.ctx.userId, a.id ?? "", browser]);
      v = r.rows[0]?.v ?? null;
    } catch (e) {
      console.error(`[ai-browser] 選び直しを書けなかった（${kindOf(e)}）`);
      return { status: 503, body: new KanameError("E-PAGE-003").toJSON() };
    }
    const row = v as { id?: unknown; browser?: unknown } | null;
    if (!row || typeof row.id !== "string") return notFound;
    return { status: 200, body: { data: { id: row.id, browser: row.browser } } };
  };
}
