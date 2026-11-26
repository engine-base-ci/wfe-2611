// お知らせの 1 行の文・丸い印・札（K-467・11_tickets/K-467.md の文の表）。口は文を返さない（K-461）：種類と params・番号・起こした人から作る。純な関数。
//   params の欄の名前は K-461 の PARAM_KEYS に合わせた。文に使うのは reply_due・reason・from_name だけ（行き先は口の href が決める）。
//   段 7・段 9 の葉が種類を足すときは、K-461 の kinds.ts と同じ回にこの表へ 1 行足す（足さない種類は札ごとの汎用の文になる）。
import { mmddOf, whenOf } from "./notice-time";
import type { NoticeAvatarTone, NoticeItem, NoticeKind, NoticePerson } from "./notice-types";

/** 一覧の口（listNotifications）の 1 件。形を確かめた後の型 */
export interface NoticeRaw {
  id: string;
  kind: string;
  tag: string;
  href: string | null;
  number: string | null;
  actor: { id: string; name: string } | null;
  params: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);
const strOrNull = (x: unknown): x is string | null => x === null || typeof x === "string";

/** 口の答えの 1 件の形を確かめる（形が違う 1 件は読み飛ばす） */
export function rawOf(x: unknown): NoticeRaw | null {
  if (!isObj(x)) return null;
  const { id, kind, tag, href, number, actor, params, read, created_at } = x;
  if (typeof id !== "string" || typeof kind !== "string" || typeof tag !== "string") return null;
  if (typeof read !== "boolean" || typeof created_at !== "string") return null;
  if (!strOrNull(href ?? null) || !strOrNull(number ?? null)) return null;
  if (params !== undefined && !isObj(params)) return null;
  const who = isObj(actor) && typeof actor["id"] === "string" && typeof actor["name"] === "string" ? actor : null;
  if (actor !== null && actor !== undefined && who === null) return null;
  return {
    id,
    kind,
    tag,
    href: (href as string | null | undefined) ?? null,
    number: (number as string | null | undefined) ?? null,
    actor: who ? { id: who["id"] as string, name: who["name"] as string } : null,
    params: (params as Record<string, unknown> | undefined) ?? {},
    read,
    created_at,
  };
}

/** 人で絞る候補（meta.actors）の形を確かめる */
export function peopleOf(x: unknown): NoticePerson[] {
  if (!Array.isArray(x)) return [];
  return x.flatMap((p) =>
    isObj(p) && typeof p["id"] === "string" && typeof p["name"] === "string" ? [{ id: p["id"], name: p["name"] }] : [],
  );
}

const SETTING_KINDS = new Set(["bridge.connected", "invitation_resend_requested"]);
const isSetting = (kind: string) => kind.startsWith("security.") || SETTING_KINDS.has(kind);

/** 口の札（K-461 の tag）→ 画面の札の種類 */
const TAG_KIND: Record<string, NoticeKind> = {
  handover: "handover",
  approval: "approval",
  mention: "mention",
  stopped: "stopped",
  write: "due",
  setting: "setting",
};
export const kindOf = (r: Pick<NoticeRaw, "kind" | "tag">): NoticeKind =>
  isSetting(r.kind) ? "setting" : (TAG_KIND[r.tag] ?? "due");

/** 人の色：スレッドの人の印（features/F6/thread/to-items.ts）と同じ決め方にして、同じ人は画面をまたいで同じ色にする */
const PERSON_TONES: readonly NoticeAvatarTone[] = ["lavender", "indigo", "teal"];
const toneOfPerson = (id: string): NoticeAvatarTone =>
  PERSON_TONES[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % PERSON_TONES.length]!;

/** 呼び方は「姓」（表示名の最初の空白の前。空白が無ければ全部） */
const callOf = (name: string): string => name.trim().split(/\s/)[0] ?? name;

const textParam = (p: Record<string, unknown>, k: string): string | null => {
  const v = p[k];
  return typeof v === "string" && v.trim() !== "" ? v : typeof v === "number" ? String(v) : null;
};

function personName(r: NoticeRaw): string | null {
  if (r.actor) return callOf(r.actor.name);
  const from = textParam(r.params, "from_name");
  return from ? callOf(from) : null;
}

type TextOf = (who: string | null, num: string, r: NoticeRaw) => string;
const byWho =
  (withWho: (who: string, num: string) => string, without: (num: string) => string): TextOf =>
  (who, num) =>
    who ? withWho(who, num) : without(num);

const WRITE: TextOf = byWho(
  (w, n) => `${w}さんが ${n} に書き込みました`,
  (n) => `${n} に書き込みがありました`,
);
const HANDOVER: TextOf = byWho(
  (w, n) => `${w}さんから ${n} の渡しのお知らせがあります`,
  (n) => `${n} の渡しのお知らせがあります`,
);
const APPROVAL: TextOf = (_w, n) => `${n} の確認が終わり、あなたの承認を待っています`;
const MENTION: TextOf = byWho(
  (w, n) => `${w}さんが ${n} であなたを @ しました`,
  (n) => `${n} であなたが @ されました`,
);
const STOPPED: TextOf = (_w, n, r) => {
  const reason = textParam(r.params, "reason");
  return reason ? `${n} が止まりました：${reason}` : `${n} が止まりました`;
};
const SETTING: TextOf = () => "設定のお知らせがあります";

/** 種類ごとの文（固有の文がある種類） */
const KIND_TEXT: Record<string, TextOf> = {
  "handover.requested": (who, n, r) => {
    const due = textParam(r.params, "reply_due");
    const mmdd = due ? mmddOf(due) : null;
    const head = who ? `${who}さんが ${n} を渡しました` : `${n} が渡されました`;
    return mmdd ? `${head}。返事の期限 ${mmdd}` : head;
  },
  "approval.requested": APPROVAL,
  "ticket.mentioned": MENTION,
  "ticket.stopped": STOPPED,
  // 期限を変えたお知らせは日付を持たない（P13）：括弧「（期限を … に）」は出さない
  "ticket.due_changed": WRITE,
  "ticket.sort_changed": byWho(
    (w, n) => `${w}さんが ${n} の項目を変えました`,
    (n) => `${n} の項目が変わりました`,
  ),
  "ticket.completed": byWho(
    (w, n) => `${w}さんが ${n} を完了しました`,
    (n) => `${n} が完了しました`,
  ),
  "handover.withdrawn": byWho(
    (w, n) => `${w}さんが ${n} の渡しを取り消しました`,
    (n) => `${n} の渡しが取り消されました`,
  ),
  "security.new_device": () => "新しい PC からログインがありました。心当たりが無いときは設定で確かめてください",
};
/** 固有の文が無い種類は札ごとの汎用の文 */
const TAG_TEXT: Record<NoticeKind, TextOf> = {
  handover: HANDOVER,
  approval: APPROVAL,
  mention: MENTION,
  due: WRITE,
  stopped: STOPPED,
  operator: WRITE,
  setting: SETTING,
};

/** 押せる行き先は口が組んだ「/」で始まる道だけ（「//」や外の住所は押せない行にする） */
const safeHref = (href: string | null): string | undefined =>
  href && href.startsWith("/") && !href.startsWith("//") && !href.startsWith("/\\") ? href : undefined;

function avatarOf(r: NoticeRaw, kind: NoticeKind, who: string | null): NoticeItem["avatar"] {
  if (kind === "setting") return { initial: "設", tone: "plum" };
  if (kind === "approval" || kind === "stopped") return { initial: "AI", tone: "ai" };
  if (r.actor && who) return { initial: who.slice(0, 1), tone: toneOfPerson(r.actor.id) };
  if (who) return { initial: who.slice(0, 1), tone: "indigo" };
  return { initial: "AI", tone: "ai" };
}

/** 口の 1 件 → 部品が描く 1 行 */
export function noticeItemOf(r: NoticeRaw, now: Date): NoticeItem {
  const kind = kindOf(r);
  const who = personName(r);
  const num = r.number ?? "チケット";
  const text = (KIND_TEXT[r.kind] ?? TAG_TEXT[kind])(who, num, r);
  const href = safeHref(r.href);
  const label = kind === "setting" ? undefined : (r.number ?? undefined);
  return {
    id: r.id,
    kind,
    avatar: avatarOf(r, kind, who),
    text,
    ...(label ? { label } : {}),
    when: whenOf(r.created_at, now),
    unread: !r.read,
    ...(href ? { href } : {}),
  };
}
