// 運営のお知らせを書く・書き直す画面（K-1015）の 欄の値 ⇔ 口の体（純粋な関数・@/ を読まない）。
//   時刻は日本時間：欄は YYYY-MM-DDTHH:mm、口は YYYY-MM-DDTHH:mm:00+09:00。答えの形は K-1004・K-977（1 件 15 欄）。
//   出した後（published・resolved）は 種類・誰に・出す場所・出す日時 を変えない（K-1014 の 409 E-OPS-009 と同じ決め）

export type NoticeKind = "incident" | "maintenance" | "release";
export type NoticeState = "draft" | "scheduled" | "published" | "resolved";
export type Audience = "all" | "plans" | "workspaces";
export type Placement = "band" | "list";

/** 1 件の答えのうち、この画面が読む欄 */
export interface NoticeDetail {
  id: string;
  kind: NoticeKind;
  title: string;
  body: string;
  audience: { mode: Audience; plans: readonly string[]; workspaces: readonly { id: string; name: string }[] };
  state: NoticeState;
  placements: readonly Placement[];
  publish_at: string | null;
  maintenance: { from: string; to: string } | null;
  impact: string | null;
  reach: { workspaces: number; members: number };
}

/** 書く欄の値（どれも字のまま持つ） */
export interface NoticeForm {
  kind: NoticeKind;
  title: string;
  body: string;
  audience: Audience;
  plans: readonly string[];
  workspaces: readonly string[];
  list: boolean;
  band: boolean;
  when: "now" | "date";
  /** 出す日時（日本時間の YYYY-MM-DDTHH:mm） */
  at: string;
  /** メンテの始まり・終わり（日本時間の YYYY-MM-DDTHH:mm） */
  from: string;
  to: string;
  impact: string;
}

/** 作る・直すの口の体（契約の NoticesInput のうち、この画面が送る欄） */
export interface NoticeBody {
  kind?: NoticeKind;
  title?: string;
  body?: string;
  audience_mode?: Audience;
  audience_plans?: string[];
  audience_workspace_ids?: string[];
  placements?: Placement[];
  maintenance_from?: string;
  maintenance_to?: string;
  impact?: string | null;
  publish_at?: string | null;
}

export const KIND_LABEL: Readonly<Record<NoticeKind, string>> = {
  release: "リリース",
  incident: "障害",
  maintenance: "メンテ",
};
export const PLAN_LABEL: Readonly<Record<string, string>> = { free: "無料", team: "チーム", business: "ビジネス" };
export const PLAN_KEYS = ["free", "team", "business"] as const;

const JST_MS = 9 * 60 * 60 * 1000;
const pad = (n: number) => String(n).padStart(2, "0");

/** 時刻（ISO）→ 日本時間の YYYY-MM-DDTHH:mm（読めなければ空） */
export function toLocal(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t + JST_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}
/** 日本時間の YYYY-MM-DDTHH:mm → 口の形 YYYY-MM-DDTHH:mm:00+09:00 */
export const fromLocal = (v: string): string => `${v}:00+09:00`;
/** 日本時間の YYYY-MM-DDTHH:mm → MM/DD HH:mm（ボタンと選び肢の字） */
export const shortLocal = (v: string): string =>
  v.length >= 16 ? `${v.slice(5, 7)}/${v.slice(8, 10)} ${v.slice(11, 16)}` : "";

export function emptyForm(): NoticeForm {
  return {
    kind: "release",
    title: "",
    body: "",
    audience: "all",
    plans: [],
    workspaces: [],
    list: true,
    band: false,
    when: "now",
    at: "",
    from: "",
    to: "",
    impact: "",
  };
}

const placementsOf = (f: Pick<NoticeForm, "band" | "list">): Placement[] => [
  ...(f.band ? (["band"] as const) : []),
  ...(f.list ? (["list"] as const) : []),
];

/** 題と本文が空白だけでないか（［下書きにする］［出す］が押せるか） */
/** 誰に・出す場所・いつ出すか が送れる形か（誰にの選び肢が空・出す場所 0・日を決めたのに日時が空 は送れない） */
export const choicesReady = (f: NoticeForm): boolean =>
  !(f.audience === "plans" && f.plans.length === 0) &&
  !(f.audience === "workspaces" && f.workspaces.length === 0) &&
  (f.list || f.band) &&
  !(f.when === "date" && !f.at);

/** ［下書きにする］［出す］［書き直す］が押せるか。出した後（locked）は閉じた欄を送らないので 題・本文 だけを見る */
export const canSend = (f: NoticeForm, locked = false): boolean =>
  f.title.trim() !== "" && f.body.trim() !== "" && (locked || choicesReady(f));

/** 作るの体。題・本文が空・誰にの選び肢が空・出す場所が 0・日を決めたのに日時が空 なら null（送らない） */
export function noticeBody(f: NoticeForm): NoticeBody | null {
  const title = f.title.trim();
  const body = f.body.trim();
  if (!title || !body) return null;
  const placements = placementsOf(f);
  if (placements.length === 0) return null;
  if (f.audience === "plans" && f.plans.length === 0) return null;
  if (f.audience === "workspaces" && f.workspaces.length === 0) return null;
  if (f.when === "date" && !f.at) return null; // すぐに出てしまわないように
  const impact = f.impact.trim();
  return {
    kind: f.kind,
    title,
    body,
    audience_mode: f.audience,
    ...(f.audience === "plans" ? { audience_plans: [...f.plans] } : {}),
    ...(f.audience === "workspaces" ? { audience_workspace_ids: [...f.workspaces] } : {}),
    placements,
    ...(f.kind === "maintenance" && f.from ? { maintenance_from: fromLocal(f.from) } : {}),
    ...(f.kind === "maintenance" && f.to ? { maintenance_to: fromLocal(f.to) } : {}),
    ...(f.kind === "maintenance" && impact ? { impact } : {}),
    ...(f.when === "date" && f.at ? { publish_at: fromLocal(f.at) } : {}),
  };
}

/** 出した後（published・resolved）は 種類・誰に・出す場所・いつ出すか を変えられない */
export const lockedOf = (d: Pick<NoticeDetail, "state">): boolean => d.state === "published" || d.state === "resolved";

/** 1 件 → 欄の値 */
export function formOf(d: NoticeDetail): NoticeForm {
  return {
    kind: d.kind,
    title: d.title,
    body: d.body,
    audience: d.audience.mode,
    plans: [...d.audience.plans],
    workspaces: d.audience.workspaces.map((w) => w.id),
    list: d.placements.includes("list"),
    band: d.placements.includes("band"),
    when: d.publish_at ? "date" : "now",
    at: d.publish_at ? toLocal(d.publish_at) : "",
    from: d.maintenance ? toLocal(d.maintenance.from) : "",
    to: d.maintenance ? toLocal(d.maintenance.to) : "",
    impact: d.impact ?? "",
  };
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** 誰にの値が変わったか */
function audienceDiff(base: NoticeForm, f: NoticeForm): NoticeBody {
  if (base.audience === f.audience && sameList(base.plans, f.plans) && sameList(base.workspaces, f.workspaces))
    return {};
  return {
    audience_mode: f.audience,
    ...(f.audience === "plans" ? { audience_plans: [...f.plans] } : {}),
    ...(f.audience === "workspaces" ? { audience_workspace_ids: [...f.workspaces] } : {}),
  };
}

/** 閉じる欄（種類・誰に・出す場所・出す日時）の変わった物 */
function lockedFieldsDiff(base: NoticeForm, f: NoticeForm): NoticeBody {
  const at = f.when === "date" && f.at ? fromLocal(f.at) : null;
  const baseAt = base.when === "date" && base.at ? fromLocal(base.at) : null;
  const placements = placementsOf(f);
  return {
    ...(f.kind !== base.kind ? { kind: f.kind } : {}),
    ...audienceDiff(base, f),
    ...(sameList(placements, placementsOf(base)) ? {} : { placements }),
    ...(at !== baseAt ? { publish_at: at } : {}),
  };
}

/** 直すの体：1 件の値と比べて変えた欄だけ。出した後は 種類・誰に・出す場所・出す日時 を入れない */
export function editBody(d: NoticeDetail, f: NoticeForm): NoticeBody {
  const base = formOf(d);
  const locked = lockedOf(d);
  const kind = locked ? d.kind : f.kind;
  const title = f.title.trim();
  const body = f.body.trim();
  const impact = f.impact.trim();
  const maint = kind === "maintenance";
  return {
    ...(title !== base.title.trim() ? { title } : {}),
    ...(body !== base.body.trim() ? { body } : {}),
    ...(maint && f.from !== base.from && f.from ? { maintenance_from: fromLocal(f.from) } : {}),
    ...(maint && f.to !== base.to && f.to ? { maintenance_to: fromLocal(f.to) } : {}),
    ...(maint && impact !== base.impact.trim() ? { impact: impact || null } : {}),
    ...(locked ? {} : lockedFieldsDiff(base, f)),
  };
}

/** 出す確かめの箇条（届く数・帯・メンテ中の画面・管理者へのメール） */
export function publishBullets(d: Pick<NoticeDetail, "kind" | "placements" | "reach">): string[] {
  const { workspaces, members } = d.reach;
  const maint = d.kind === "maintenance";
  return [
    ...(d.placements.includes("list")
      ? [`${workspaces} か所・延べ ${members} 人の「困ったとき・お知らせ」に出る`]
      : []),
    ...(d.placements.includes("band") ? ["画面の上の帯にも出る（閉じられる）"] : []),
    ...(maint ? ["メンテの間は、メンテナンス中の画面になる"] : []),
    ...(maint ? [`メンテなので、${workspaces} か所の管理者にメールも届く（使えなくなるため）`] : []),
  ];
}

/** 出す確かめの説明の 1 文（題と、誰に届くか） */
export function publishDescription(d: Pick<NoticeDetail, "title" | "audience">): string {
  const to =
    d.audience.mode === "all"
      ? "全部のワークスペース"
      : d.audience.mode === "plans"
        ? `${d.audience.plans.map((p) => PLAN_LABEL[p] ?? p).join("・")}のプランのワークスペース`
        : "選んだワークスペース";
  return `${d.title}。出すと、${to}の人に届きます`;
}

/** 見え方の帯の要約（本文の 1 行目。続きがあれば「…」） */
export function previewSub(body: string): string {
  const text = body.trim();
  const first = text.split("\n")[0] ?? "";
  return first.length < text.length ? `${first}…` : first;
}
