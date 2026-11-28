// 請求書を出したときの、PDF を付けたメール（K-1109・issueOpsInvoices が出し終えた後・D-156.53・D-156.77・D-156.78・関門 C2・C6）。
//   順：① opsTx で app.ops_invoice_mail_targets(出した会社) → 会社ごとの管理者（member_id・email）
//       ② 管理者 1 人に 1 通ずつ deps.mailer（関門 C6 の送出の 1 か所・署名と返信先はそこが付ける）に PDF を付けて送る。1 通が落ちてもほかは送る
//       ③ 宛先の数で { sent, failed } を数えて返す（答えの meta.mail）
//   請求書は確定した後に呼ぶので、送れなくても請求書は戻さない（鈴と請求書の画面で見られる）。
//   ログは落ちた通数の 1 行だけ（宛先・会社の名前・額を出さない）
import type pg from "pg";
import type { TenantContext } from "@kaname/db/context";
import type { HookMailer } from "../../../hooks/registry.js";
import { opsTx } from "./db.js";
import type { IssuedPdf } from "./invoices-pdf.js";

export interface MailCount {
  sent: number;
  failed: number;
}
export interface MailDeps {
  appPool: pg.Pool;
  mailer?: HookMailer | undefined;
}
interface Target {
  tenant_id: string;
  admins: { member_id: string; email: string }[];
}

const yen = (n: number): string => `¥${Math.trunc(n).toLocaleString("ja-JP")}`;
/** YYYY-MM → [年, 月]（月は 0 を付けない） */
const ym = (month: string): [string, number] => [month.slice(0, 4), Number(month.slice(5, 7))];

/** 件名・本文・ファイルの名前（代表の答え D-156.77） */
export function invoiceMail(p: IssuedPdf): { subject: string; text: string; filename: string } {
  const [y, m] = ym(p.month);
  return {
    subject: `【Kaname】${y} 年 ${m} 月分の請求書`,
    text: [
      `${p.company} 御中`,
      "",
      `${y} 年 ${m} 月分の請求書をお送りします。`,
      `ご請求額：${yen(p.total)}（税込）`,
      `お支払い期限：${p.dueOn.replaceAll("-", "/")}`,
      "",
      "請求書は添付の PDF と、Kaname の 設定 › 請求書 でも見られます。",
    ].join("\n"),
    filename: `請求書_${p.month}.pdf`,
  };
}

/** 宛先を引く。引けなければ全部を送れなかった側に数える（請求書は出ている） */
async function targetsOf(d: MailDeps, ctx: TenantContext, pdfs: readonly IssuedPdf[]): Promise<Target[] | null> {
  try {
    return await opsTx(d.appPool, ctx, async (cl) => {
      const q = await cl.query<{ v: Target[] }>("select app.ops_invoice_mail_targets($1::uuid[]) as v", [
        pdfs.map((p) => p.tenantId),
      ]);
      return q.rows[0]?.v ?? [];
    });
  } catch {
    return null;
  }
}

/** 出した会社ごとに、管理者全員へ PDF を付けたメールを送る。
 *  issued は出した会社の数（答えの data.count）。宛先を引けなければ 1 通も送らず、どの会社にも届いていないので
 *  failed に出した会社の数を数える（送れなかった数の下限・PM の決め 2026-11-27・K1109-API-009） */
export async function mailInvoices(
  d: MailDeps,
  ctx: TenantContext,
  pdfs: readonly IssuedPdf[],
  issued: number = pdfs.length,
): Promise<MailCount> {
  const count: MailCount = { sent: 0, failed: 0 };
  if (pdfs.length === 0) return count;
  const targets = await targetsOf(d, ctx, pdfs);
  if (targets === null) {
    console.error("[ops] 請求書のメールの宛先を引けなかった");
    return { sent: 0, failed: issued };
  }
  const byTenant = new Map(targets.map((t) => [t.tenant_id, t.admins]));
  for (const p of pdfs) {
    const mail = invoiceMail(p);
    for (const a of byTenant.get(p.tenantId) ?? []) {
      try {
        if (!d.mailer) throw new Error("送出の 1 か所が無い");
        await d.mailer({
          to: a.email,
          subject: mail.subject,
          text: mail.text,
          attachments: [{ filename: mail.filename, content: p.bytes, contentType: "application/pdf" }],
        });
        count.sent += 1;
      } catch {
        count.failed += 1;
      }
    }
  }
  if (count.failed > 0) console.error(`[ops] 請求書のメールを送れなかった（${count.failed} 通）`);
  return count;
}
