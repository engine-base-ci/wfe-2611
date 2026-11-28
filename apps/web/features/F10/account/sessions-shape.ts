// ログインと安全の「入っている端末」「最近の安全の記録」（K-842）：口 listMySessions の答え → 画面の字。
//   純粋な関数だけ（@/ を読まない・今の時刻は引数）。時刻は日本時間で出す。字の多くは仮（チケットの申し送り）

export interface SessionItem {
  id: string;
  kind: "web" | "bridge" | "api";
  name: string;
  place: string | null;
  issued_at: string;
  last_seen_at: string;
  current: boolean;
}
export interface SecurityEvent {
  id: string;
  kind: string;
  occurred_at: string;
  device: string | null;
  place: string | null;
}
/** 口 listMySessions の data（K-836 の「画面が使う答えの形」） */
export interface SessionsAnswer {
  sessions: SessionItem[];
  events: SecurityEvent[];
}

/** 端末の 1 行（login.tsx の Device と同じ形） */
export interface DeviceRow {
  id: string;
  name: string;
  where: string;
  last: string;
  here?: boolean;
  doubt?: boolean;
  icon?: "laptop" | "phone" | "monitor";
}

/** 最後に使ったのがこれより前の端末に「見覚えは？」（D-154.79） */
export const DOUBT_DAYS = 7;
const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const JST = 9 * HOUR;
const NO_NAME = "名前の分からない端末";
const NO_PLACE = "場所は分からない";
const PHONE = /iPhone|iPad|Android/;
/** 知らない kind の字（内部の名前を画面に出さない） */
const EVENT_OTHER = "安全に関わる操作をした";
export const EVENTS_EMPTY = "まだ記録はありません";

export const EVENT_TEXT: Readonly<Record<string, string>> = {
  passkey_added: "パスキーを足した",
  passkey_removed: "パスキーを外した",
  password_changed: "パスワードを変えた",
  step_up: "本人確認を取り直した",
  sessions_revoked: "端末を切った",
  suspicious_connection: "場所か端末が急に変わったので、入り直しにした",
  ip_changed: "つないでいる場所が変わった",
  email_changed: "ログインのメールを変えた",
  bridge_connected: "PC をつないだ",
  device_removed: "PC を外した",
  login_blocked: "止められていて入れなかった",
};

const pad = (n: number): string => String(n).padStart(2, "0");
/** 日本時間の年月日と時分 */
function jst(ms: number): { y: number; m: number; d: number; hh: string; mm: string } {
  const t = new Date(ms + JST);
  return {
    y: t.getUTCFullYear(),
    m: t.getUTCMonth() + 1,
    d: t.getUTCDate(),
    hh: pad(t.getUTCHours()),
    mm: pad(t.getUTCMinutes()),
  };
}
const msOf = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};
/** 日本時間の「M/D」 */
export function monthDay(iso: string): string {
  const t = jst(msOf(iso));
  return `${t.m}/${t.d}`;
}

/** 最後に使った：1 時間未満＝N 分前・24 時間未満＝N 時間前・それより前＝M/D */
export function whenText(iso: string, now: number): string {
  const diff = now - msOf(iso);
  if (diff < HOUR) return `${Math.max(1, Math.floor(diff / MIN))} 分前`;
  if (diff < DAY) return `${Math.floor(diff / HOUR)} 時間前`;
  return monthDay(iso);
}

const nameOf = (s: SessionItem): string => s.name.trim() || NO_NAME;
const iconOf = (s: SessionItem): DeviceRow["icon"] => (PHONE.test(s.name) ? "phone" : s.current ? "laptop" : "monitor");

export function toDevices(answer: SessionsAnswer, now: number): DeviceRow[] {
  return answer.sessions.map((s) => ({
    id: s.id,
    name: nameOf(s),
    where: s.place ?? NO_PLACE,
    last: s.current ? "いま" : whenText(s.last_seen_at, now),
    here: s.current,
    doubt: !s.current && now - msOf(s.last_seen_at) > DOUBT_DAYS * DAY,
    icon: iconOf(s),
  }));
}

/** 記録の時刻：今日なら「今日 HH:mm」・ほかは「MM/DD HH:mm」（日本時間） */
export function eventWhen(iso: string, now: number): string {
  const t = jst(msOf(iso));
  const n = jst(now);
  if (t.y === n.y && t.m === n.m && t.d === n.d) return `今日 ${t.hh}:${t.mm}`;
  return `${pad(t.m)}/${pad(t.d)} ${t.hh}:${t.mm}`;
}

/** 記録の行（[時刻, 字]・答えの順） */
export function toEvents(answer: SessionsAnswer, now: number): [string, string][] {
  return answer.events.map((e) => {
    const text = EVENT_TEXT[e.kind] ?? EVENT_OTHER;
    return [eventWhen(e.occurred_at, now), e.device ? `${text}（${e.device}）` : text];
  });
}

/** 「この端末以外をすべて切る」の説明に並べる名前（4 台を超えたら先頭 3 つ＋ほか N 台） */
function othersText(others: readonly SessionItem[]): string {
  const names = others.map(nameOf);
  if (names.length <= 4) return names.join("と");
  return `${names.slice(0, 3).join("と")} ほか ${names.length - 3} 台`;
}

/** 確かめの小窓の題と説明（1 つ切る・この端末以外をすべて切る） */
export function revokeTexts(
  target: SessionItem | "all",
  sessions: readonly SessionItem[],
): { title: string; description: string } {
  if (target === "all") {
    const others = sessions.filter((s) => !s.current);
    return {
      title: "この端末以外をすべて切ります",
      description: `${othersText(others)} が切れます。この端末はそのまま使えます。切れた端末は、入り直すまで使えません`,
    };
  }
  const day = monthDay(target.issued_at);
  const head = target.place ? `${target.place} で ${day} に入った端末です。` : `${day} に入った端末です。`;
  const pc = target.kind === "bridge" ? "。PC の接続も切れ、この PC で動いている分身の仕事は止まります" : "";
  return {
    title: `${nameOf(target)} を切ります`,
    description: `${head}切ると、この端末は入り直すまで使えません。覚えがなければ、パスワードかパスキーも見直してください${pc}`,
  };
}

/** 切ったあとの知らせ */
export function revokedText(target: SessionItem | "all", revoked: number): string {
  return target === "all" ? `${revoked} 台の端末を切りました` : `${nameOf(target)} を切りました`;
}
