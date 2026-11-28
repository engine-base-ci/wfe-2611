// 運営の 1 社の小窓（中を見る・止める・再開・お知らせを送る）の値と体（K-972）。画面の外の純粋な関数（@/ を読まない）。
//   小窓の値 → 口の体（K-1006・K-1004 の入力の形）と、1 社の答え → 帯の字。日は日本の暦。字は下絵（tenant-dialogs.tsx・tenant-frame.tsx）が正

/** 1 社の答えのうち、小窓と帯が読む欄だけ（K-1006 の getOpsWorkspace の 14 欄の一部） */
export interface WsStop {
  reason_key: string;
  stop_on: string | null;
  stopped_at: string | null;
  noticed_at?: string | null;
}
export interface WsPeek {
  id: string;
  expires_at: string;
  /** 開いたときの理由の字（K-1006 の peek.reason・前からの行は null） */
  reason?: string | null;
}
export interface WsLike {
  name: string;
  state?: string | null;
  stop?: WsStop | null;
  peek?: WsPeek | null;
}
/** その会社の問い合わせ（listOpsWorkspaceInquiries の 1 行の一部） */
export interface WsInquiry {
  id: string;
  title: string;
  asker_name?: string | null;
  state?: string | null;
  created_at?: string | null;
}

const JST = "Asia/Tokyo";
const DAY_MS = 86_400_000;
const PEEK_MINUTES = [30, 60] as const;
const TITLE_MAX = 100;
const BODY_MAX = 4000;
const NOTE_MAX = 500;
const ADMIN_NOTICE_MAX = 2000;
const PEEK_REASON_MAX = 200;
const STOP_AFTER_DAYS = 7;

/** 日本の暦の日付（YYYY-MM-DD） */
export function jstDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: JST }).format(d);
}
/** YYYY-MM-DD → M/DD（月は 0 を付けない・日は 2 桁） */
export function mdOf(ymd: string): string {
  return `${Number(ymd.slice(5, 7))}/${ymd.slice(8, 10)}`;
}
/** 日本の暦で n 日後（YYYY-MM-DD） */
export function jstAfter(now: Date, days: number): string {
  return jstDate(new Date(now.getTime() + days * DAY_MS));
}
const trimmed = (s: string | null | undefined): string => (s ?? "").trim();

// ── 中を見る ─────────────────────────────────────────────

export interface PeekOption {
  value: string;
  label: string;
}
export interface PeekForm {
  /** 問い合わせなら inquiry:<id>・ほかは incident・billing・other */
  choice: string;
  minutes: number;
  /** ほか（書く）の字 */
  other: string;
}
export interface PeekBody {
  reason: string;
  minutes: number;
  inquiry_id?: string;
}
const INQ = "inquiry:";
const PEEK_FIXED: readonly PeekOption[] = [
  { value: "incident", label: "障害の調べ" },
  { value: "billing", label: "請求の確認" },
  { value: "other", label: "ほか（書く）" },
];

/** 理由の選び肢：済みでない問い合わせ（題・聞いた人・日）→ 障害の調べ・請求の確認・ほか（書く） */
export function peekReasons(inquiries: readonly WsInquiry[]): PeekOption[] {
  const open = inquiries.filter((q) => q.state !== "done");
  return [
    ...open.map((q) => {
      const who = trimmed(q.asker_name);
      const day = q.created_at ? mdOf(jstDate(new Date(q.created_at))) : "";
      const tail = [who, day].filter(Boolean).join("・");
      return { value: `${INQ}${q.id}`, label: `問い合わせ「${q.title}」${tail ? `（${tail}）` : ""}` };
    }),
    ...PEEK_FIXED,
  ];
}

/** 小窓の値 → 開く口の体。理由が空・見る時間が 30／60 でなければ null（送らない） */
export function peekBody(form: PeekForm, inquiries: readonly WsInquiry[]): PeekBody | null {
  if (!(PEEK_MINUTES as readonly number[]).includes(form.minutes)) return null;
  const { minutes } = form;
  if (form.choice.startsWith(INQ)) {
    const q = inquiries.find((x) => x.id === form.choice.slice(INQ.length));
    return q ? { reason: `問い合わせ「${q.title}」`, minutes, inquiry_id: q.id } : null;
  }
  const fixed = PEEK_FIXED.find((o) => o.value === form.choice && o.value !== "other");
  const reason = fixed ? fixed.label : form.choice === "other" ? trimmed(form.other) : "";
  if (!reason || reason.length > PEEK_REASON_MAX) return null;
  return { reason, minutes };
}

export interface PeekBandView {
  id: string;
  title: string;
  rest: string;
  reason?: string;
}
/** 見ている間の帯：期限の前だけ。残りの分は切り上げ */
export function peekBandView(ws: WsLike, now: Date): PeekBandView | null {
  const p = ws.peek;
  if (!p) return null;
  const left = new Date(p.expires_at).getTime() - now.getTime();
  if (!(left > 0)) return null;
  const view: PeekBandView = {
    id: p.id,
    title: `${ws.name} の中を見ています（見るだけ）`,
    rest: `残り ${Math.ceil(left / 60_000)} 分`,
  };
  const reason = trimmed(p.reason);
  return reason ? { ...view, reason } : view;
}

// ── 止める・再開 ─────────────────────────────────────────

export const STOP_REASONS = [
  { value: "unpaid", label: "請求が払われない" },
  { value: "violation", label: "規約に反する" },
  { value: "danger", label: "危ない使い方をしている" },
  { value: "request", label: "管理者から頼まれた" },
] as const;
export type StopReason = (typeof STOP_REASONS)[number]["value"];
export type StopMode = "scheduled" | "now";

export interface StopForm {
  reason: string;
  mode: StopMode;
  /** YYYY-MM-DD（日本の暦） */
  stopOn: string;
  /** 管理者へのお知らせ */
  notice: string;
  note: string;
}
export interface StopBody {
  reason_key: string;
  mode: StopMode;
  stop_on?: string;
  note?: string;
  admin_notice?: string;
}

const isReason = (v: string): boolean => STOP_REASONS.some((r) => r.value === v);
/** すぐ止めるは 規約に反する・危ない ときだけ */
export function canStopNow(reason: string): boolean {
  return reason === "violation" || reason === "danger";
}
/** 既定：請求が払われない・先に知らせて 7 日後（日本の暦）・お知らせは空 */
export function stopDefault(now: Date): StopForm {
  return { reason: "unpaid", mode: "scheduled", stopOn: jstAfter(now, STOP_AFTER_DAYS), notice: "", note: "" };
}
/** 小窓の値 → 止める口の体。理由が知らない・すぐで許されない理由・日が無いは null */
export function stopBody(form: StopForm): StopBody | null {
  if (!isReason(form.reason)) return null;
  if (form.mode === "now" && !canStopNow(form.reason)) return null;
  if (form.mode === "scheduled" && !/^\d{4}-\d{2}-\d{2}$/.test(form.stopOn)) return null;
  const note = trimmed(form.note);
  const notice = trimmed(form.notice);
  if (note.length > NOTE_MAX || notice.length > ADMIN_NOTICE_MAX) return null;
  return {
    reason_key: form.reason,
    mode: form.mode,
    ...(form.mode === "scheduled" ? { stop_on: form.stopOn } : {}),
    ...(note ? { note } : {}),
    ...(notice ? { admin_notice: notice } : {}),
  };
}
/** 押すボタンの字 */
export function stopLabel(form: Pick<StopForm, "mode" | "stopOn">): string {
  return form.mode === "now" ? "すぐ止める" : `${mdOf(form.stopOn)} に止める`;
}
/** 日を決めて止めた後の知らせ（仮の字） */
export function stopDoneText(form: Pick<StopForm, "mode" | "stopOn">): string | null {
  return form.mode === "scheduled" ? `${mdOf(form.stopOn)} に止めます` : null;
}
/** 今日から止める日まで何日か（日本の暦） */
export function daysUntil(now: Date, ymd: string): number {
  return Math.round((Date.parse(`${ymd}T00:00:00Z`) - Date.parse(`${jstDate(now)}T00:00:00Z`)) / DAY_MS);
}

export interface StopBandView {
  reason: string;
  /** 止めた日（M/DD・日本の暦） */
  since: string;
}
const reasonLabel = (key: string): string => STOP_REASONS.find((r) => r.value === key)?.label ?? key;
/** 止めている帯：止めた（stopped_at がある か 状態が stopped）ときだけ。止める予定だけは null */
export function stopBandView(ws: WsLike): StopBandView | null {
  const s = ws.stop;
  if (!s) return null;
  if (!s.stopped_at && ws.state !== "stopped") return null;
  const day = s.stopped_at ? jstDate(new Date(s.stopped_at)) : s.stop_on;
  if (!day) return null;
  return { reason: reasonLabel(s.reason_key), since: mdOf(day) };
}

// ── お知らせを送る ───────────────────────────────────────

export type NoticeWhere = "band" | "list" | "both";
export type NoticeTo = "all" | "admins";
export interface NoticeForm {
  title: string;
  body: string;
  where: string;
  to?: NoticeTo;
}
export interface NoticeBody {
  title: string;
  body: string;
  placements: ("band" | "list")[];
  admins_only?: true;
}
const PLACEMENTS: Record<NoticeWhere, ("band" | "list")[]> = {
  band: ["band"],
  list: ["list"],
  both: ["band", "list"],
};
export const NOTICE_WHERE: readonly { value: NoticeWhere; label: string }[] = [
  { value: "band", label: "画面の上の帯" },
  { value: "list", label: "お知らせの一覧" },
  { value: "both", label: "どちらも" },
];
/** 小窓の値 → お知らせの体。題か本文が空・長すぎる・管理者だけ × 帯は null（送らない・D-156.57） */
export function noticeBody(form: NoticeForm): NoticeBody | null {
  const title = trimmed(form.title);
  const body = trimmed(form.body);
  if (!title || !body || title.length > TITLE_MAX || body.length > BODY_MAX) return null;
  const placements = PLACEMENTS[form.where as NoticeWhere];
  if (!placements) return null;
  if (form.to === "admins") {
    if (form.where !== "list") return null;
    return { title, body, placements: [...placements], admins_only: true };
  }
  return { title, body, placements: [...placements] };
}
