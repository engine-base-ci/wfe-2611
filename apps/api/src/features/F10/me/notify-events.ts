// 知らせの出来事の名前の一覧（K-837・D-154.24・D-154.60）。知らせの設定の口（features/F10/me/notify.ts）と、
//   保存した受け方を読んで受け箱・メールを出す側（F7・K-67）が同じ一覧を読む（1 か所に置く）。画面の字は画面の葉が key から出す。
//   既定のベル・メールは下絵 me-notify のとおり。new_device（新しい端末で入った）は安全のため止められない（fixed）

export type NotifyChannel = "bell" | "mail";

export interface NotifyEvent {
  key: string;
  bell: boolean;
  mail: boolean;
  fixed: boolean;
}

/** 出来事 7 つ（画面に並べる順） */
export const NOTIFY_EVENTS: readonly NotifyEvent[] = [
  { key: "approval_waiting", bell: true, mail: true, fixed: false }, // 承認を待っている
  { key: "mentioned", bell: true, mail: true, fixed: false }, // @ で呼ばれた・やり取りで知らせる人にされた
  { key: "handed_over", bell: true, mail: true, fixed: false }, // 渡された・配られた
  { key: "clone_stopped", bell: true, mail: true, fixed: false }, // 分身が止まった・落ちて直せない
  { key: "clone_finished", bell: true, mail: false, fixed: false }, // 分身が実行を終えた
  { key: "ticket_changed", bell: true, mail: false, fixed: false }, // 自分が担当・承認するチケットが動いた
  { key: "new_device", bell: true, mail: true, fixed: true }, // 新しい端末で入った（止められない）
];

export const NOTIFY_EVENT_KEYS: readonly string[] = NOTIFY_EVENTS.map((e) => e.key);

/** 静かにする時間の決まった形 */
export const QUIET_PRESETS: readonly string[] = ["weekdays_night_weekend", "every_night", "weekend_only", "off"];
export const QUIET_PRESET_DEFAULT = "weekdays_night_weekend";

/** 止めていても知らせる急ぎの出来事 */
export const URGENT_OVERRIDES: readonly string[] = ["approval_due_today", "clone_stopped"];

/** メールのまとめの既定（読んでいないものを 30 分ごとにまとめて送る） */
export const EMAIL_DIGEST_DEFAULT = true;
