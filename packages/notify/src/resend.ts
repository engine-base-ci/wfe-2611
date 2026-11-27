// メールの送出（関門 C6 の中だけ）。Resend。鍵が無い環境では email を送らず inapp だけ（起動時の存在確認で「無い」を明示する）
import { Resend } from "resend";
import type { Channel, NotifyEvent, Transport } from "./index.js";

/** メールに付けるファイル（K-1109・請求書の PDF など） */
export interface MailAttachment {
  filename: string;
  content: Uint8Array;
  contentType: string;
}
/** 付けるファイルの合計の上限（Resend の上限 40MB より手前で止める） */
export const MAIL_ATTACH_MAX = 10 * 1024 * 1024;

export interface MailLike {
  send(msg: {
    from: string;
    to: string;
    subject: string;
    text: string;
    /** 返信したときの宛先（差出人とは別に持てる・D-096.5） */
    replyTo?: string;
    /** 付けるファイル（任意・無い・空なら付けない） */
    attachments?: MailAttachment[];
  }): Promise<{ error: { message: string } | null }>;
}
export function resendMail(apiKey: string): MailLike {
  const r = new Resend(apiKey);
  return {
    send: async ({ attachments, ...m }) => {
      if (!attachments || attachments.length === 0) {
        return { error: (await r.emails.send(m)).error ?? null };
      }
      const total = attachments.reduce((n, a) => n + a.content.byteLength, 0);
      if (total > MAIL_ATTACH_MAX) throw new Error("添付が大きすぎる");
      const files = attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.content),
        contentType: a.contentType,
      }));
      return { error: (await r.emails.send({ ...m, attachments: files })).error ?? null };
    },
  };
}
/** email は Resend、それ以外（inapp／push／chat）は inbox（通知の表）に書く側へ委ねる */
export function resendTransport(
  mail: MailLike | null,
  from: string,
  inbox: (channel: Channel, memberId: string, event: NotifyEvent) => Promise<void>,
): Transport {
  return {
    async send(channel, address, memberId, event) {
      if (channel !== "email") return inbox(channel, memberId, event);
      if (!mail) throw new Error("メールの送出先が設定されていない（RESEND_API_KEY）"); // 黙って成功にしない（G-15）
      if (!address) throw new Error("宛先のメールアドレスが無い");
      const r = await mail.send({
        from,
        to: address,
        subject: String(event.payload["title"] ?? event.kind),
        text: String(event.payload["body"] ?? JSON.stringify(event.payload)),
      });
      if (r.error) throw new Error(`メールの送出に失敗: ${r.error.message}`);
    },
  };
}

/** 送れなかった理由を 2 つに分ける（D-088.5）。
 *  recipient＝宛先の側（受信箱が満杯・存在しない・拒否された。相手に直してもらう）
 *  provider ＝こちらの側（送出先が落ちている・1 日の上限・鍵が無効。相手のせいにしない）
 *  文面の判定なので、当たらなければ provider 側に倒す（相手を責めない方へ倒す） */
export function classifyMailError(message: string): "recipient" | "provider" {
  const m = (message || "").toLowerCase();
  const recipient = [
    "invalid `to`",
    "invalid to",
    "recipient",
    "mailbox",
    "quota exceeded (mailbox",
    "5.1.1",
    "5.2.2",
    "does not exist",
    "rejected",
  ];
  const provider = ["daily", "quota", "rate limit", "api key", "unauthorized", "forbidden", "timeout"];
  if (provider.some((k) => m.includes(k)) && !m.includes("mailbox")) return "provider";
  return recipient.some((k) => m.includes(k)) ? "recipient" : "provider";
}
