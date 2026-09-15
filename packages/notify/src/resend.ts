// メールの送出（関門 C6 の中だけ）。Resend。鍵が無い環境では email を送らず inapp だけ（起動時の存在確認で「無い」を明示する）
import { Resend } from "resend";
import type { Channel, NotifyEvent, Transport } from "./index.js";

export interface MailLike {
  send(msg: {
    from: string;
    to: string;
    subject: string;
    text: string;
  }): Promise<{ error: { message: string } | null }>;
}
export function resendMail(apiKey: string): MailLike {
  const r = new Resend(apiKey);
  return { send: async (m) => ({ error: (await r.emails.send(m)).error ?? null }) };
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
