// 鈴の知らせの種類の表（K-461・D-151.5）。種類（event_kind_id）→ 札と行き先。DB に触らない純粋な表と関数だけ。
//   表に無い種類は一覧にも数にも出さない（読み飛ばす・P4）。新しい種類の書き手は、この表に 1 行足してから書く（足し忘れは試験 K461-API-016 が止める）。
//   札の言葉（「受ける？」「承認待ち」…）と行ごとの文は画面（K-467）が持つ。ここは札の名前と行き先だけ
import { isUuid } from "@kaname/contracts";

export type NoticeTag = "handover" | "approval" | "mention" | "stopped" | "write" | "setting";

export interface KindRule {
  tag: NoticeTag;
  /** チケットに結ぶ種類か（true なら今そのチケットが見えるときだけ出す・行き先は /tickets/<ticket_id>） */
  ticket: boolean;
  /** チケットに結ばない種類の行き先（無ければ押せない行） */
  href: string | null;
  /** 取り消し系だけ：チケットを消した後も出す。番号だけ（題名・チケットの id・行き先は出さない・D-148.5） */
  afterDelete?: true;
}

const ticketKind = (tag: NoticeTag): KindRule => ({ tag, ticket: true, href: null });
const settingKind = (href: string | null): KindRule => ({ tag: "setting", ticket: false, href });

export const KINDS: Readonly<Record<string, KindRule>> = {
  // 前から（0090・0100・0101）と段 7（K-385・K-387・K-390）・段 8（K-483）・段 5（K-440）
  "ticket.assigned": ticketKind("write"),
  "ticket.created": ticketKind("write"),
  "ticket.completed": ticketKind("write"),
  "ticket.mentioned": ticketKind("mention"),
  "ticket.message": ticketKind("write"),
  "ticket.stage_changed": ticketKind("write"),
  "ticket.decision": ticketKind("write"),
  "ticket.due_changed": ticketKind("write"),
  // ticket.sort_changed の payload の fields は priority・parent（K-440）／estimate_minutes（K-583）／field:<項目の id>（K-564）のどれか（混ざることもある）。
  //   fields・url は params に出さない（PARAM_KEYS は message_id だけを通す）。文は K-467 の表（項目を変えました）・K-602
  "ticket.sort_changed": ticketKind("write"),
  // 段 8（K-464・K-463）
  "ticket.stopped": ticketKind("stopped"),
  "approval.requested": ticketKind("approval"),
  // 段 6（K-733）：承認待ちを取り下げた知らせ（表に足すのは K-731・D-153.7）
  "approval.withdrawn": ticketKind("approval"),
  // 段 12（K-881・20261127094100）：チケットを見せる相手に足したグループのゲストへの知らせ。社内の鈴ではチケットが社内の人として見えるときだけ出るので、ゲスト宛てのこの行は社内の鈴に出ない（先方の場所での出し方は先方の場所の葉が持つ）
  "ticket.guest_shared": ticketKind("write"),
  // 段 9（K-402・K-408・K-409・K-410・K-406）：受ける？の札
  "handover.requested": ticketKind("handover"),
  "handover.offered": ticketKind("handover"),
  "handover.distributed": ticketKind("handover"),
  "handover.group_distributed": ticketKind("handover"),
  "handover.reminded": ticketKind("handover"),
  // 段 9（K-403・K-407・K-402・K-409・K-410）：書き込みの札
  "handover.accepted": ticketKind("write"),
  "handover.declined": ticketKind("write"),
  "handover.overdue": ticketKind("write"),
  "handover.managers": ticketKind("write"),
  "handover.reassigned": ticketKind("write"),
  "handover.distributed_done": ticketKind("write"),
  "handover.claimed": ticketKind("write"),
  // 取り消し系：チケットを消した後も出す（D-148.5）。番号だけ・押せない行
  "handover.withdrawn": { tag: "write", ticket: false, href: null, afterDelete: true },
  // 設定（前から：0083・0112・0089・20261119051731）
  "security.new_device": settingKind("/mfa-setup"),
  "security.admin_recovery_requested": settingKind(null), // 管理者が受け取る知らせ。本人の 2 段階認証の設定の道では用が足りない
  "bridge.connected": settingKind("/setup/bridge"),
  invitation_resend_requested: settingKind(null), // 開く画面がまだ無い
  // 秘密の置き場（K-354・20261119120700）：使える場所の外で渡そうとして止まったことを持ち主に知らせる。開く画面がまだ無い（K-357 が決めるまで押せない行）
  "credential.wrong_destination": settingKind(null),
  // 段 10 ナレッジの上げる・共有（K-687・D-152.2・D-152.13）。チケットに結ばない。頼まれた 2 つは管理の承認待ち（K-694 の道）を直接開き、ほかはナレッジの画面
  "knowledge.raise_requested": { tag: "approval", ticket: false, href: "/knowledge?view=admin&list=approvals" },
  "knowledge.share_requested": { tag: "approval", ticket: false, href: "/knowledge?view=admin&list=approvals" },
  "knowledge.raise_approved": { tag: "write", ticket: false, href: "/knowledge" },
  "knowledge.raise_declined": { tag: "write", ticket: false, href: "/knowledge" },
  "knowledge.share_approved": { tag: "write", ticket: false, href: "/knowledge" },
  "knowledge.share_declined": { tag: "write", ticket: false, href: "/knowledge" },
  "knowledge.share_ended": { tag: "write", ticket: false, href: "/knowledge" },
  // 請求先（K-959・D-156.30・D-156.41）：請求先を変えたら管理者全員に。押すと請求書の画面
  "billing.contact_changed": settingKind("/billing"),
  // 段 13（K-975）：運営が問い合わせに返した（問い合わせた本人だけ・D-156.28）。札に合う物が無いので setting。
  //   行き先は 困ったとき・お知らせ の一覧（1 件の道 /inquiry/<id> は表の行き先が固定なので組めない・申し送り）
  "inquiry.replied": settingKind("/notices"),
  // 運営が止める日を決めた（K-970・D-156.23）：その会社の管理者に。押せない行（止める日は画面の上の帯で確かめる）
  "workspace.stop_scheduled": settingKind(null),
  // 運営のひな形（K-1010・D-156.56）：既定のまま使っている会社の管理者だけに、ひな形の新しい版が届いたことを知らせる。行き先は選ぶ頁（K-1016）
  "template.update": settingKind("/settings/template-updates"),
  // 運営の請求（K-983・D-156.54）：期限を過ぎた・期限から 7 日の知らせ（管理者だけ・一覧を開いたときに追いついて出す）。文は画面の葉 K-960
  "billing.overdue": settingKind("/billing"),
  "billing.overdue_week": settingKind("/billing"),
  // 運営の請求（K-981・D-156.53）：運営が月の請求書を出したことを管理者に知らせる。行き先は請求書の画面（K-960）
  "billing.invoice_issued": settingKind("/billing"),
  // メンバーが抜けた（段11 K-838・D-154.25）：その会社のほかの有効な管理者に。押すと設定のメンバーの画面（決める人の答え answer=730d094adf6a）。
  //   6 つの札にメンバー・会社の動きの札は無いので、いちばん近い setting（管理者が受け取る会社の設定の動き・請求先や止める日と同じ）
  "member.left": settingKind("/members"),
  // 外された人の担当を引き継いだ（段11 K-848・D-154.6）：引き継ぎ先に。チケットに結ばず、押しても別の画面へは行かない（お知らせの一覧に留まる・
  //   決める人の答え answer=dd1a8dae13a0「お知らせでいい」）。札は handover（担当の受け渡し）
  "member.tickets_received": { tag: "handover", ticket: false, href: null },
};

/** 鈴に出してよい種類（表の鍵） */
export const KNOWN_KINDS: readonly string[] = Object.keys(KINDS);
/** チケットに結ぶ種類（今そのチケットが見えるときだけ出す）。取り消し系は含まない */
export const TICKET_KINDS: readonly string[] = KNOWN_KINDS.filter((k) => KINDS[k]!.ticket);

/** params に通す欄（種類ごとに分けず全体の 1 つの集まり・D-151.5）。ここに無い欄（本文・url・due_on・device・session_id …）は出さない。
 *  ticket_id・number・title は params に入れない（答えの上に出るので） */
export const PARAM_KEYS: ReadonlySet<string> = new Set([
  "approval_id",
  "decision_id",
  "action",
  "device_label",
  "from_name",
  "handover_id",
  "job_id",
  "message_id",
  "reason",
  "reply_due",
  "stage",
]);

/** 行き先：チケットに結ぶ種類は ticket_id が uuid の形のときだけ /tickets/<id>（それ以外は null）。
 *  結ばない種類は表の href（無ければ null）。取り消し系・表に無い種類は必ず null（押して知らない所へ飛ばさない） */
export function hrefOf(kind: string, payload: Record<string, unknown> | null | undefined): string | null {
  const rule = KINDS[kind];
  if (!rule || rule.afterDelete) return null;
  if (!rule.ticket) return rule.href;
  const id = payload?.["ticket_id"];
  return typeof id === "string" && isUuid(id) ? `/tickets/${id}` : null;
}
