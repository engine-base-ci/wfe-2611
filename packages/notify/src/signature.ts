// メールの末尾（署名）と返信先（D-096）。送り出す 1 か所（関門 C6）で全部のメールに付ける。
// 画面・特商法表記と同じ値を読む（運営者の情報は設定値の 1 か所だけ：@kaname/config の operator）。
// 載せるもの：サービス名・会社名・代表者名・お問い合わせ（D-096.2）。
// 載せないもの：電話（携帯を全利用者に配らない・D-096.3）・住所（手続きのメールでは要らない・D-096.4）。
import type { MailLike } from "./resend.js";

export interface Operator {
  /** サービス名（半角 Kaname だけ） */
  service: string;
  company: string;
  representative: string;
  /** お問い合わせの届け先（返信先と同じ） */
  email: string;
  /** 持っているが、メールには載せない（特商法表記・請求書で使う） */
  phone?: string | null;
  /** 持っているが、メールには載せない（宣伝メール・有料化の前に決め直す） */
  address?: string | null;
}

const RULE = "――――――――――";

/** 署名の文面。電話と住所は引数に入っていても書かない（載せないと決めたものを、渡し忘れで漏らさない） */
export function mailSignature(o: Operator): string {
  return [
    RULE,
    o.service,
    `運営：${o.company}（代表 ${o.representative}）`,
    `お問い合わせ：${o.email}（このメールに返信しても届きます）`,
  ].join("\n");
}

/** 本文の末尾に署名を 1 回だけ付ける（二重に付けない） */
export function withSignature(text: string, o: Operator): string {
  const sig = mailSignature(o);
  return text.includes(sig) ? text : `${text.replace(/\s+$/, "")}\n\n${sig}\n`;
}

/** 送出の 1 か所を包み、署名と返信先を必ず付ける（関門 C6 の横断的関心事） */
export function signedMail(inner: MailLike, o: Operator, replyTo: string): MailLike {
  return {
    send: (m) => inner.send({ ...m, text: withSignature(m.text, o), replyTo: m.replyTo ?? replyTo }),
  };
}
