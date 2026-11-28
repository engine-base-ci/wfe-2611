// 運営のお知らせの画面（一覧・1 件・障害の続報・K-980）の、口の答え → 部品の値と、URL の絞り込みの読み書き。画面の外の純粋な関数（@/ を読まない）。
//   答えの形は 11_tickets/K-1004.md・K-977.md（一覧の 1 行・1 件）。字は下絵（views-notices.tsx の ROWS・NoticePage）が正。時刻は日本時間

// ---------------------------------------------------------------- 口の答えの形（使う欄だけ）
export type NoticeKind = "incident" | "maintenance" | "release";
export type NoticeState = "draft" | "scheduled" | "published" | "resolved";
export type IncidentState = "investigating" | "identified" | "monitoring" | "resolved";
export type NoticePlacement = "band" | "list";
export interface NoticeAudience {
  mode: "all" | "plans" | "workspaces";
  plans: readonly string[];
  workspaces: readonly { id: string; name: string }[];
}
export interface NoticeRowAnswer {
  id: string;
  kind: NoticeKind;
  title: string;
  audience: NoticeAudience;
  state: NoticeState;
  incident_state: IncidentState | null;
  placements: readonly NoticePlacement[];
  publish_at: string | null;
  published_at: string | null;
  author_name: string | null;
}
export interface NoticeUpdateAnswer {
  state: IncidentState;
  body: string;
  at: string;
}
export interface NoticeDetailAnswer extends NoticeRowAnswer {
  body: string;
  maintenance: { from: string; to: string } | null;
  impact: string | null;
  updates: readonly NoticeUpdateAnswer[];
}

// ---------------------------------------------------------------- 形の確かめ（違えば読めなかったとして扱う・G-15）
const KINDS: readonly NoticeKind[] = ["incident", "maintenance", "release"];
const STATES: readonly NoticeState[] = ["draft", "scheduled", "published", "resolved"];
const INCIDENT: readonly IncidentState[] = ["investigating", "identified", "monitoring", "resolved"];
const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const strOrNull = (v: unknown): boolean => v === null || isStr(v);
const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  isStr(v) && (list as readonly string[]).includes(v);

function isAudience(v: unknown): v is NoticeAudience {
  if (!isObj(v) || !oneOf(["all", "plans", "workspaces"] as const, v["mode"])) return false;
  const plans = v["plans"];
  const ws = v["workspaces"];
  return (
    Array.isArray(plans) &&
    plans.every(isStr) &&
    Array.isArray(ws) &&
    ws.every((w) => isObj(w) && isStr(w["id"]) && isStr(w["name"]))
  );
}

function isRow(v: unknown): v is NoticeRowAnswer {
  if (!isObj(v) || !isStr(v["id"]) || !isStr(v["title"])) return false;
  if (!oneOf(KINDS, v["kind"]) || !oneOf(STATES, v["state"])) return false;
  if (!(v["incident_state"] === null || oneOf(INCIDENT, v["incident_state"]))) return false;
  const pl = v["placements"];
  if (!Array.isArray(pl) || !pl.every((p) => oneOf(["band", "list"] as const, p))) return false;
  return (
    isAudience(v["audience"]) &&
    strOrNull(v["publish_at"]) &&
    strOrNull(v["published_at"]) &&
    strOrNull(v["author_name"])
  );
}

function isUpdate(v: unknown): v is NoticeUpdateAnswer {
  return isObj(v) && oneOf(INCIDENT, v["state"]) && isStr(v["body"]) && isStr(v["at"]);
}

/** 一覧の答えの data（行の並び）。形が違えば null */
export function noticeRowsOf(data: unknown): NoticeRowAnswer[] | null {
  return Array.isArray(data) && data.every(isRow) ? (data as NoticeRowAnswer[]) : null;
}

/** 1 件の答えの data。形が違えば null */
export function noticeDetailOf(data: unknown): NoticeDetailAnswer | null {
  if (!isRow(data)) return null;
  const d = data as unknown as Record<string, unknown>;
  const m = d["maintenance"];
  const mOk = m === null || (isObj(m) && isStr(m["from"]) && isStr(m["to"]));
  const ups = d["updates"];
  const upsOk = Array.isArray(ups) && ups.every(isUpdate);
  return isStr(d["body"]) && strOrNull(d["impact"]) && mOk && upsOk ? (data as NoticeDetailAnswer) : null;
}

/** 外枠の答えの data から、運営の人ができること（caps）。読めなければ空 */
export function capsOf(shellData: unknown): string[] {
  if (!isObj(shellData)) return [];
  const op = shellData["operator"];
  if (!isObj(op) || !Array.isArray(op["caps"])) return [];
  return op["caps"].filter(isStr);
}

// ---------------------------------------------------------------- 字
const JST_MS = 9 * 3_600_000;
const DASH = "—";
const DOT = " ・ ";
const pad2 = (n: number): string => String(n).padStart(2, "0");
const jst = (iso: string): Date => new Date(Date.parse(iso) + JST_MS);
const mmdd = (iso: string): string => {
  const d = jst(iso);
  return `${pad2(d.getUTCMonth() + 1)}/${pad2(d.getUTCDate())}`;
};
const hhmm = (iso: string): string => {
  const d = jst(iso);
  return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
};
const at = (iso: string): string => `${mmdd(iso)} ${hhmm(iso)}`;

const KIND_LABEL: Record<NoticeKind, string> = { incident: "障害", maintenance: "メンテ", release: "リリース" };
const PLAN_LABEL: Record<string, string> = { free: "無料", team: "チーム", business: "ビジネス" };
export const STEP_LABELS = ["調べている", "原因が分かった", "様子を見ている", "直った"] as const;
const STEP_OF: Record<IncidentState, number> = { investigating: 0, identified: 1, monitoring: 2, resolved: 3 };
const STATE_LABEL: Record<IncidentState, string> = {
  investigating: "調べている",
  identified: "原因が分かった",
  monitoring: "様子を見ている",
  resolved: "直った",
};
const PLACE_LABEL: Record<NoticePlacement, string> = { list: "お知らせの一覧", band: "上の帯" };
const PLACE_ORDER: readonly NoticePlacement[] = ["list", "band"];
const MAX_WS_NAMES = 2;

export type NoticeTone = "neutral" | "progress" | "warning" | "success";
export interface NoticeRowView {
  id: string;
  kind: string;
  title: string;
  to: string;
  state: string;
  tone: NoticeTone;
  by: string;
}

/** 誰に（一覧の字）：全部／プランの名前を「・」で／ワークスペースは 2 つまで名前・3 つからは「<1 つ目> ほか N か所」 */
function toLabel(a: NoticeAudience): string {
  if (a.mode === "plans") return a.plans.map((p) => PLAN_LABEL[p] ?? p).join("・");
  if (a.mode === "workspaces") {
    const names = a.workspaces.map((w) => w.name);
    if (names.length <= MAX_WS_NAMES) return names.join("・");
    return `${names[0]} ほか ${names.length - 1} か所`;
  }
  return "全部";
}

const isResolved = (r: Pick<NoticeRowAnswer, "state" | "incident_state">): boolean =>
  r.state === "resolved" || r.incident_state === "resolved";

/** 状態の字と札の色 */
function stateOf(r: NoticeRowAnswer): { state: string; tone: NoticeTone } {
  if (r.state === "draft") return { state: "下書き", tone: "neutral" };
  if (r.state === "scheduled")
    return { state: `予定${DOT}${r.publish_at ? at(r.publish_at) : DASH} に出す`, tone: "progress" };
  const since = r.published_at ? `${at(r.published_at)}〜` : DASH;
  if (r.kind === "incident" && isResolved(r)) return { state: `直った${DOT}${since}`, tone: "success" };
  if (r.state === "resolved") return { state: `直った${DOT}${since}`, tone: "success" };
  if (r.kind === "incident")
    return { state: `${STATE_LABEL[r.incident_state ?? "investigating"]}${DOT}${since}`, tone: "warning" };
  return { state: `出した ${r.published_at ? mmdd(r.published_at) : DASH}`, tone: "success" };
}

/** 一覧の 1 行の値 */
export function noticeRowView(r: NoticeRowAnswer): NoticeRowView {
  return {
    id: r.id,
    kind: KIND_LABEL[r.kind],
    title: r.title,
    to: toLabel(r.audience),
    ...stateOf(r),
    by: r.author_name ?? DASH,
  };
}

/** 1 件の頭の下の字：「<種類> ・ <誰に> ・ <時刻か 下書き か 予定>」 */
export function headSub(d: NoticeRowAnswer): string {
  const to = d.audience.mode === "all" ? "全部のワークスペース" : toLabel(d.audience);
  let when: string;
  if (d.state === "draft") when = "下書き";
  else if (d.state === "scheduled") when = `予定 ${d.publish_at ? at(d.publish_at) : DASH}`;
  else when = d.published_at ? `${at(d.published_at)}〜` : DASH;
  return [KIND_LABEL[d.kind], to, when].join(DOT);
}

export interface NoticeSteps {
  labels: string[];
  current: number;
}
/** 障害の状態の段（障害でなければ null） */
export function stepsOf(d: NoticeRowAnswer): NoticeSteps | null {
  if (d.kind !== "incident") return null;
  return { labels: [...STEP_LABELS], current: STEP_OF[d.incident_state ?? "investigating"] };
}

/** 出している場所のカードの字（メンテの時間と、出している場所） */
export function placeView(d: NoticeDetailAnswer): { maint: string | null; where: string } {
  const m = d.kind === "maintenance" ? d.maintenance : null;
  const maint = m ? `メンテの時間 ${at(m.from)}〜${hhmm(m.to)}` : null;
  const where =
    d.state === "draft"
      ? "まだ出していません"
      : PLACE_ORDER.filter((p) => d.placements.includes(p))
          .map((p) => PLACE_LABEL[p])
          .join(DOT);
  return { maint, where };
}

/** これまで（続報の記録）：新しい順 */
export function feedOf(updates: readonly NoticeUpdateAnswer[]): { at: string; text: string; detail: string }[] {
  return [...updates]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .map((u) => ({ at: at(u.at), text: STATE_LABEL[u.state], detail: u.body }));
}

// ---------------------------------------------------------------- URL の絞り込み
export type NoticeChip = "all" | "incident" | "maintenance" | "release" | "draft";
export interface NoticesQuery {
  chip: NoticeChip;
}

/** URL → 札（知らない値は すべて） */
export function noticesQuery(params: URLSearchParams): NoticesQuery {
  const kind = params.get("kind");
  if (oneOf(KINDS, kind)) return { chip: kind };
  if (params.get("state") === "draft") return { chip: "draft" };
  return { chip: "all" };
}

/** 札 → URL の問い合わせ（すべては何も書かない）。一覧の口の問い合わせも同じ */
export function noticesSearch(q: NoticesQuery): string {
  if (q.chip === "all") return "";
  if (q.chip === "draft") return "?state=draft";
  return `?kind=${q.chip}`;
}

// ---------------------------------------------------------------- 続報の体
const STEP_STATE: Record<string, Exclude<IncidentState, "investigating">> = {
  原因が分かった: "identified",
  様子を見ている: "monitoring",
  直った: "resolved",
};

/** 続報の体：選び肢の字 → state・本文は前後の空白を落とす。空（か知らない選び肢）なら null（送れない） */
export function updateBody(form: {
  step: string;
  body: string;
}): { state: Exclude<IncidentState, "investigating">; body: string } | null {
  const state = STEP_STATE[form.step];
  const body = form.body.trim();
  return state && body ? { state, body } : null;
}
