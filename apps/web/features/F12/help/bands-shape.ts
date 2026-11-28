// ログイン後の画面の上の帯と画面いっぱいの形（K-957）の、口の答え → 部品の値（画面の外の純粋な関数・@/ を読まない）。
//   答えの形は getServiceStatusForMember の bands・components・maintenance_now（K-955・D-156.45）と listNotices（K-1004）。
//   時刻と状態の字は help-shape.ts（K-956）の jstWhen・windowOf・noticeView を使う（同じ読み替えを 2 つ作らない・D-156.10）。
//   ログイン前の稼働状況の読み替え（段 1 の to-incidents.ts）は形が違うので使わない。
//   止める日・止められた画面・中を見られている間の帯（stop・peek）は K-1008（stopView・peekView・gateOf の止めた後）
import { jstWhen, noticeView, windowOf, type NoticeIn, type StatusComponentIn } from "./help-shape";

/** 稼働状況の答えの帯の 1 つ（新しい順・頭が出る） */
export interface BandIn {
  kind: "incident" | "maintenance" | "stop" | "peek";
  /** お知らせの id。peek の運営の側は中を見るの許可の id（closePeek に渡す）・顧客の側は null（K-969） */
  notice_id?: string | null;
  title: string;
  state?: string;
  from?: string;
  to?: string;
  closable: boolean;
  /** この帯の後ろに重なっているお知らせの数 */
  more: number;
  /** 帯の 2 行目（K-955・D-156.45）。無ければ最新の続報・本文の 1 行目 */
  note?: string;
  /** 障害の番号「INC-<YYMM>-<NN>」（K-955・D-156.45） */
  ref?: string;
}
export interface BandsStatusIn {
  components: StatusComponentIn[];
  bands: BandIn[];
  maintenance_now: { from: string; to: string } | null;
}
export interface Picked {
  band: BandIn;
  /** 「ほか N 件のお知らせ」の N */
  others: number;
}
/** 帯の部品の値（どちらの種類でも欄の名前で読める：相手の種類の欄は無い） */
export type BandView =
  | {
      kind: "incident";
      title: string;
      state: string;
      note: string;
      href: string | null;
      window?: never;
      impact?: never;
    }
  | {
      kind: "maintenance";
      window: string;
      impact: string;
      href: string | null;
      title?: never;
      state?: never;
      note?: never;
    };
export type Gate =
  { kind: "maintenance"; window: string } | { kind: "down" } | { kind: "stopped"; since: string; reason: string };
/** 止める帯の部品の値（K-1008）：止める日が先なら帯・過ぎたら（ちょうどを含む）止められた画面 */
export type StopView =
  { mode: "soon"; day: string; reason: string } | { mode: "stopped"; since: string; reason: string };
/** 中を見られている間の帯の部品の値（K-1008）。ops＝運営の側（閉じる id あり）・customer＝顧客の側（閉じられない） */
export interface PeekView {
  side: "ops" | "customer";
  id: string | null;
  who: string;
  reason: string;
  /** 「<残りの分> 分」（切り上げ・0 より下は 0） */
  rest: string;
}
export interface DownViewValues {
  updated: string;
  note: string;
  since: string;
  no: string;
}

interface UpdateIn {
  state?: string;
  body?: string;
  at?: string;
}
/** 最新の続報（時刻のいちばん遅い物・同じ時刻なら後ろの物）。形の違う物は数えない */
function latestUpdate(n: NoticeIn | undefined): { body: string; at: string } | null {
  let last: { body: string; at: string } | null = null;
  for (const u of (n?.updates ?? []) as UpdateIn[]) {
    if (!u || typeof u.body !== "string" || typeof u.at !== "string") continue;
    if (!last || Date.parse(u.at) >= Date.parse(last.at)) last = { body: u.body, at: u.at };
  }
  return last;
}
const firstLine = (n: NoticeIn | undefined): string => n?.body.split(/\r?\n/)[0] ?? "";
/** 日本時間の「HH:MM」 */
const hhmm = (iso: string | undefined): string => (iso ? (jstWhen(iso, true).split(" ")[1] ?? "") : "");
/** 障害の様子の字（help-shape の表を noticeView 越しに使う。知らない値は空） */
const stateWord = (state: string | undefined): string =>
  noticeView({
    id: "",
    kind: "incident",
    title: "",
    body: "",
    state: (state ?? null) as NoticeIn["state"],
    published_at: "1970-01-01T00:00:00Z",
    unread: false,
    maintenance: null,
    updates: [],
  }).state ?? "";

/** 出す帯：閉じた印のある閉じられる帯を飛ばした並びの頭。ほか N 件＝残りの帯の数＋その帯の more。無ければ null */
export function pickBand(bands: BandIn[], closed: ReadonlySet<string>): Picked | null {
  const shown = bands.filter((b) => !(b.closable && b.notice_id && closed.has(b.notice_id)));
  const band = shown[0];
  if (!band) return null;
  return { band, others: shown.length - 1 + (band.more ?? 0) };
}

/** 帯の部品の値。お知らせ（一覧の答えにその notice_id の物）が無ければ「詳しく」の行き先は null（見つからないにしない・G-04） */
export function bandView(band: BandIn, notice: NoticeIn | undefined): BandView {
  const href = notice && band.notice_id ? `/notices/${band.notice_id}` : null;
  if (band.kind === "maintenance") {
    const window = band.from && band.to ? windowOf(band.from, band.to) : band.title;
    return { kind: "maintenance", window, impact: notice?.maintenance?.impact ?? firstLine(notice), href };
  }
  const title = band.from ? `${band.title}（${jstWhen(band.from, true)}〜）` : band.title;
  const note = band.note ?? latestUpdate(notice)?.body ?? firstLine(notice);
  return { kind: "incident", title, state: stateWord(band.state), note, href };
}

/** 止めた後でも開ける道（困ったとき・お知らせと問い合わせとその下・D-156.23）。止めるのは口の入口で、ここは見せ方だけ */
const OPEN_WHEN_STOPPED = ["/notices", "/inquiry"] as const;
const openWhenStopped = (path: string): boolean =>
  OPEN_WHEN_STOPPED.some((p) => path === p || path.startsWith(`${p}/`));
const MINUTE_MS = 60_000;
/** 時刻の字が読めなければ NaN（比べると常に偽） */
const timeOf = (iso: string | undefined): number => (iso ? Date.parse(iso) : Number.NaN);

/** 止める帯 → 止める日の帯（止める日が先）か止められた画面（止めた後）の値 */
export function stopView(band: BandIn, now: number): StopView {
  const from = timeOf(band.from);
  const day = band.from ? jstWhen(band.from, false) : "";
  return from > now ? { mode: "soon", day, reason: band.title } : { mode: "stopped", since: day, reason: band.title };
}

/** 中を見られている間の帯の値。notice_id があれば運営の側、null か欄が無ければ顧客の側 */
export function peekView(band: BandIn, now: number): PeekView {
  const left = Math.max(0, Math.ceil((timeOf(band.to) - now) / MINUTE_MS));
  const id = typeof band.notice_id === "string" && band.notice_id !== "" ? band.notice_id : null;
  return {
    side: id ? "ops" : "customer",
    id,
    who: band.title,
    reason: band.state ?? "",
    rest: `${Number.isFinite(left) ? left : 0} 分`,
  };
}

/** 画面いっぱいの形：メンテ中が先・画面（key web）が止まっていれば障害・止めた後の止める帯があれば止められた画面
 *  （now と path を渡したときだけ・止めた後でも開ける道は通す）・ほかは null */
export function gateOf(status: BandsStatusIn, now?: number, path?: string): Gate | null {
  const m = status.maintenance_now;
  if (m) return { kind: "maintenance", window: windowOf(m.from, m.to) };
  if (status.components.some((c) => c.key === "web" && c.state === "down")) return { kind: "down" };
  if (now === undefined || path === undefined || openWhenStopped(path)) return null;
  for (const b of status.bands) {
    if (b.kind !== "stop") continue;
    const v = stopView(b, now);
    if (v.mode === "stopped") return { kind: "stopped", since: v.since, reason: v.reason };
  }
  return null;
}

/** 止める日の帯（止める日が先の stop の帯の頭）。無ければ null */
export function stopSoonOf(bands: BandIn[], now: number): Extract<StopView, { mode: "soon" }> | null {
  for (const b of bands) {
    if (b.kind !== "stop") continue;
    const v = stopView(b, now);
    if (v.mode === "soon") return v;
  }
  return null;
}

/** 中を見られている間の帯の頭（期限を過ぎた物も含む：期限で読み直して消える）。無ければ null */
export function peekOf(bands: BandIn[]): BandIn | null {
  return bands.find((b) => b.kind === "peek") ?? null;
}

/** 障害の画面の字：更新は最新の続報の時刻（無ければ始まり）・障害の番号は帯の ref（無ければ notice_id の頭 8 字を大文字） */
export function downView(band: BandIn | undefined, notice: NoticeIn | undefined): DownViewValues {
  const last = latestUpdate(notice);
  return {
    updated: hhmm(last?.at ?? band?.from),
    note: last?.body ?? "",
    since: hhmm(band?.from),
    no: band?.ref ?? (band?.notice_id ?? "").slice(0, 8).toUpperCase(),
  };
}
