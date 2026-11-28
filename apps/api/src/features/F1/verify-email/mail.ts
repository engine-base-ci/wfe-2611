// K-52 確定の後の 1 通「【Kaname】登録が完了しました」（D-128.146）。送るのは関門 C6（@kaname/notify の NotifyGateway）だけ。
//   重なりは notifications の dedupe_key で止める（同じ本人に 2 通目を出さない・TP-MAIL-02）。送れなくても確定は止めない（G-15：送れたとは言わない）。
//   本文にパスワード・確認のリンクを入れない（TP-MAIL-03）。ログに宛先を出さない（印「宛先#…」・TP-REG-14）
import { mailTag } from "@kaname/auth/signup";
import { withTenant, type TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { NotifyGateway, type Transport } from "@kaname/notify";
import type { AuthPool } from "@kaname/auth/pending";

export const DONE_SUBJECT = "【Kaname】登録が完了しました";
export const DONE_KIND = "signup.completed";

export type DoneMailer = (m: { to: string; subject: string; text: string }) => Promise<void>;
export interface DoneMail {
  email: string;
  name: string;
  loginUrl: string;
  supportEmail: string;
}

/** 本文（名前・完了したこと・ログインの入口・登録したメール・問い合わせ先・送信専用） */
export function doneText(m: DoneMail): string {
  return [
    `${m.name} 様`,
    "",
    "Kaname の登録が完了しました。",
    "",
    `ログインの入口：${m.loginUrl}`,
    `登録したメールアドレス：${m.email}`,
    "",
    `この登録に心当たりが無い場合は、お手数ですが ${m.supportEmail} までお知らせください。`,
    "このメールは送信専用です。返信いただいてもお答えできません。",
  ].join("\n");
}

/** 完了のメールを送る。送れたら true。送れなかったら false（ログは宛先の印だけ） */
export async function sendDoneMail(
  d: { repo: Repository; appPool: AuthPool; mailer?: DoneMailer },
  ctx: TenantContext,
  m: DoneMail,
): Promise<boolean> {
  const memberId = ctx.userId;
  if (!d.mailer || !memberId) {
    console.error(`[verify-email] 完了のメールを送れなかった（送出先が無い）→ ${mailTag(m.email)}`);
    return false;
  }
  const mailer = d.mailer;
  const transport: Transport = {
    send: async (_ch, address) => {
      if (!address) throw new Error("宛先が無い");
      await mailer({ to: address, subject: DONE_SUBJECT, text: doneText(m) });
    },
  };
  const gw = new NotifyGateway(
    d.repo,
    transport,
    {
      resolve: async () => [{ memberId, kind: "human", address: m.email }],
      seen: async (key, c) =>
        withTenant(d.appPool, c, async (cl) => {
          const r = await cl.query("select 1 from notifications where dedupe_key = $1 limit 1", [key]);
          return (r.rowCount ?? 0) > 0;
        }),
      remember: async (key, c) => {
        await withTenant(d.appPool, c, async (cl) => {
          await cl.query(
            "insert into notifications (tenant_id, member_id, channel_id, event_kind_id, payload, dedupe_key, sent_at) values ($1, $2, 'email', $3, '{}'::jsonb, $4, now())",
            [c.tenantId, c.userId, DONE_KIND, key],
          );
        });
      },
    },
    { channelsOf: () => ["email"], maxAttempts: 2 },
  );
  try {
    const r = await gw.notify(
      { kind: DONE_KIND, payload: {}, dedupeKey: `${DONE_KIND}:${memberId}` },
      { memberIds: [memberId] },
      ctx,
    );
    const sent = r.deliveries.some((x) => x.status === "sent");
    if (!sent) console.error(`[verify-email] 完了のメールを送れなかった → ${mailTag(m.email)}`);
    return sent;
  } catch (e) {
    console.error(`[verify-email] 完了のメールを送れなかった → ${mailTag(m.email)}: ${(e as Error).name}`);
    return false;
  }
}
