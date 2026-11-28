// K-365 もう一度確かめる仕事をその PC に宛てる口（checkMyDeviceBrowser・POST /api/v1/bridge/devices/:id/browser-check・体は空の形）。
//   押した PC に宛てた小さな仕事（Chrome のタブの一覧を見るだけ・文は決まった BROWSER_CHECK_PROMPT）を 1 つ積む（D-120・代表の答え answer=0a262be577b2 ①）。
//   上限（1 分に 10 回・人ごと）・認証（401）・役（取引先と運営は 403）・同意し直しの止め・:id の形（uuid）・体の形（strict・知らない欄は 422）は契約の入口（op.ts）が先に確かめる。
//   PC はアカウントのもの（D-128.137・D-128.156）。入口の行の確かめから外し（scripts/ci/row_rules.mjs の ROW_EXEMPT）、持ち主は 1 つの文で 2 重に確かめる（D-128.166）：
//     1 つ目＝口：その人のアカウントの PC の一覧（app.bridge_devices）に :id が在るか ／ 2 つ目＝DB の関数（app.device_browser_check）が account_members で絞って積む。
//   どちらかで外れたら同じ 404。眠っている・返事がまだの PC には積まず 409（目録の where.state が browser_check_asleep のエラー）。
//   確かめの結果は答えに出さない（Bridge がその仕事の後に送る自己診断で PC の行に出る・会話には出さない）。答えは job_id だけ。
//   DB の失敗は 503・E-PAGE-003（1 つの文なので半分だけ積んだ形は無い）。ログに PC の id・人の id・DB の文を出さない
import type pg from "pg";
import { CATALOG, KanameError } from "@kaname/errors";
import { BROWSER_CHECK_PROMPT } from "../../../auth/conventions.js";
import type { HookArgs, HookReply } from "../../../contract/deps.js";

/** 眠っている・返事がまだの PC で押したときのエラーは、番号でなく目録の where.state で引く（番号は取り込む時点の空きで決まる） */
export const BROWSER_CHECK_ASLEEP_STATE = "browser_check_asleep";

const notFound: HookReply = { status: 404, body: { error: "not_found", code: "NOT_FOUND" } };

/** 目録から眠っている PC のエラーの番号を引く。無ければ起動の時点で落とす（目録と口が食い違ったまま動かさない） */
function asleepCode(): string {
  const hit = Object.values(CATALOG).find((x) => (x.where as { state?: unknown }).state === BROWSER_CHECK_ASLEEP_STATE);
  if (!hit)
    throw new Error(
      `目録に where.state が ${BROWSER_CHECK_ASLEEP_STATE} のエラーが無い（07_qa/test-specs/errors.d/K-365.json）`,
    );
  return hit.id;
}

// 2 重の確かめと積むのを 1 つの文で：1 つ目（口）が外れたら関数を呼ばず not_found、通っても関数が外せば not_found
const CHECK_SQL = `select case
    when exists (select 1 from jsonb_array_elements(app.bridge_devices($1)) e where e->>'id' = $2)
    then app.device_browser_check($1, $2::uuid, $3)
    else '{"state":"not_found"}'::jsonb
  end as v`;

/** 例外の種類だけ（DB の番号か名前）。文や値はログに出さない */
const kindOf = (e: unknown): string => {
  const x = e as { code?: unknown; name?: unknown } | null;
  return typeof x?.code === "string" ? x.code : typeof x?.name === "string" ? x.name : "Error";
};

export function createCheckDeviceBrowser(appPool: pg.Pool): (a: HookArgs) => Promise<HookReply> {
  const asleep: HookReply = { status: 409, body: new KanameError(asleepCode()).toJSON() };
  return async (a: HookArgs) => {
    let v: { state?: unknown; job_id?: unknown } | null;
    try {
      const r = await appPool.query<{ v: { state?: unknown; job_id?: unknown } | null }>(CHECK_SQL, [
        a.ctx.userId,
        a.id ?? "",
        BROWSER_CHECK_PROMPT,
      ]);
      v = r.rows[0]?.v ?? null;
    } catch (e) {
      console.error(`[ai-browser] 確かめの仕事を積めなかった（${kindOf(e)}）`);
      return { status: 503, body: new KanameError("E-PAGE-003").toJSON() };
    }
    if (v?.state === "asleep") return asleep;
    if (v?.state !== "queued" || typeof v.job_id !== "string") return notFound;
    return { status: 201, body: { data: { job_id: v.job_id } } };
  };
}
