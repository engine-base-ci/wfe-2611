// 請求書の PDF を作って置く（K-1013・issueOpsInvoices の出すときだけ・D-156.31・D-156.59・D-156.60・関門 C2・C4）。
//   順：① opsTx で app.ops_invoice_lines(月)（宛名つきの行）→ 0 行なら PDF を作らずに出す（409 E-BILL-003 のまま）
//       ② 会社ごとに invoice_id を決め、renderInvoicePdf で作り、その会社の文脈で関門 C4 の置き場に置く（置き場の関門が証跡を書く）
//       ③ opsTx で app.ops_invoices_issue(月, false, 会社 → { invoice_id, pdf_ref, total })（K-981 の 1 取引）
//       ④ ② が 1 つでも置けない・③ が例外か断り（changed・nothing_to_issue・month_open）なら、置いた物を全部消してから答える（全部か無しか）
//   出す側の値は invoiceIssuer(cfg) の 1 か所から読む（今は設定の値。K-1107 が loadInvoiceIssuer(tx, cfg) に替える）。
//   出せたら、会社ごとに作った PDF の bytes と宛名・額・期限を答えと一緒に返す（K-1109 のメールが付ける・置いた中身と同じ物）
//   ログは場所と件数だけ（会社の名前・鍵・額を出さない）
import { randomUUID } from "node:crypto";
import type pg from "pg";
import type { Config } from "@kaname/config";
import type { TenantContext } from "@kaname/db/context";
import type { ObjectStore } from "@kaname/storage";
import { renderInvoicePdf, type InvoicePdfInput } from "@kaname/billing/invoice-pdf";
import { opsErrorReply, opsTx } from "./db.js";
import type { HookReply } from "../../../contract/deps.js";

const WHERE = "invoices-pdf";

/** 請求書の PDF の出す側（会社の情報・振込先・備考・登録番号） */
export interface InvoiceIssuer {
  name: string;
  address: string;
  contact: string;
  note: string;
  invoiceNo: string;
  payeeLines: readonly string[];
}

/** 出す側の値の 1 か所（D-156.60）。今は設定の値から作る */
export function invoiceIssuer(cfg: Pick<Config, "billing">): InvoiceIssuer {
  const b = cfg.billing as Partial<Config["billing"]>;
  return {
    name: b.issuer ?? "",
    address: b.issuerAddress ?? "",
    contact: b.issuerContact ?? "",
    note: b.note ?? "",
    invoiceNo: b.invoiceNo ?? "",
    payeeLines: b.payeeLines ?? [],
  };
}

/** app.ops_invoice_lines の 1 行（K-981） */
interface Line {
  workspace: { id: string; name: string };
  plan_name: string;
  amount: number;
  tax: number;
  prorated: number;
  total: number;
  contact?: { company?: string; attn?: string; email?: string } | null;
}
/** app.ops_invoices_issue の答え */
export type IssueAnswer = { data?: unknown; error?: unknown };
interface Placed {
  ctx: TenantContext;
  ref: string;
}
/** 出した会社ごとの PDF（K-1109 のメールが付ける）。bytes は置き場に置いた中身と同じ */
export interface IssuedPdf {
  tenantId: string;
  invoiceId: string;
  month: string;
  dueOn: string;
  total: number;
  /** 宛名の会社名（請求先の会社名・無ければワークスペースの名前） */
  company: string;
  bytes: Uint8Array;
}
export interface PdfDeps {
  appPool: pg.Pool;
  objects: ObjectStore;
  config: Pick<Config, "billing">;
}

/** 日本の暦の今日（YYYY-MM-DD） */
const jstToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo" }).format(new Date());
/** 期限：請求の月の翌月の末日（app.ops_invoices_issue の due_on と同じ） */
const dueOf = (month: string): string => {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m + 1, 0)).toISOString().slice(0, 10);
};
const str = (x: unknown): string => (typeof x === "string" ? x : "");

function pdfInput(l: Line, invoiceId: string, month: string, issuedOn: string, iss: InvoiceIssuer): InvoicePdfInput {
  return {
    invoiceId,
    month,
    issuedOn,
    dueOn: dueOf(month),
    workspaceName: l.workspace.name,
    contact: { company: str(l.contact?.company), attn: str(l.contact?.attn), email: str(l.contact?.email) },
    planName: l.plan_name,
    amount: Number(l.amount),
    tax: Number(l.tax),
    prorated: Number(l.prorated),
    total: Number(l.total),
    payeeLines: iss.payeeLines,
    invoiceNo: iss.invoiceNo,
    issuer: { name: iss.name, address: iss.address, contact: iss.contact, note: iss.note },
  };
}

/** 置いた物を全部消す。消せなかった物があればログ 1 行（件数だけ） */
async function cleanUp(objects: ObjectStore, placed: readonly Placed[]): Promise<void> {
  let failed = 0;
  for (const p of placed) {
    try {
      const r = await objects.delete(p.ctx, p.ref);
      if (r.status !== "done") failed += 1;
    } catch {
      failed += 1;
    }
  }
  if (failed > 0) console.error(`[ops] ${WHERE} の後片付けに失敗した（${failed} 件）`);
}

const unavailable = (why: string): HookReply => {
  console.error(`[ops] ${WHERE} の${why}`);
  return { status: 503, body: { error: "unavailable", code: "E-PAGE-003" } };
};

/**
 * 出すときだけ：PDF を作って置き、issue(p_pdf) で請求書を書く。断り・失敗のときは置いた PDF を消す。
 * 答えは issue の答え（呼べたとき）か、口の答え（置けない・DB が落ちた＝503）
 */
export async function withInvoicePdfs(
  d: PdfDeps,
  ctx: TenantContext,
  month: string,
  issue: (cl: pg.PoolClient, pdf: Record<string, unknown>) => Promise<IssueAnswer | undefined>,
): Promise<{ answer: IssueAnswer | undefined; pdfs: IssuedPdf[] } | { reply: HookReply }> {
  let lines: Line[];
  try {
    lines = await opsTx(
      d.appPool,
      ctx,
      async (cl) => (await cl.query<{ v: Line[] }>("select app.ops_invoice_lines($1) as v", [month])).rows[0]?.v ?? [],
    );
  } catch (e) {
    return { reply: opsErrorReply(e, WHERE) };
  }
  const iss = invoiceIssuer(d.config);
  const issuedOn = jstToday();
  const placed: Placed[] = [];
  const pdf: Record<string, unknown> = {};
  const made: IssuedPdf[] = [];
  for (const l of lines) {
    const invoiceId = randomUUID();
    const tctx: TenantContext = { tenantId: l.workspace.id, userId: ctx.userId, role: "ops", stepUpAt: null };
    try {
      const bytes = await renderInvoicePdf(pdfInput(l, invoiceId, month, issuedOn, iss));
      const r = await d.objects.put(tctx, bytes, { contentType: "application/pdf", retentionDays: null });
      if (r.status !== "done") {
        await cleanUp(d.objects, placed);
        return { reply: unavailable("置き場に置けなかった") };
      }
      placed.push({ ctx: tctx, ref: r.value.ref });
      pdf[l.workspace.id] = { invoice_id: invoiceId, pdf_ref: r.value.ref, total: Number(l.total) };
      made.push({
        tenantId: l.workspace.id,
        invoiceId,
        month,
        dueOn: dueOf(month),
        total: Number(l.total),
        company: str(l.contact?.company) || l.workspace.name,
        bytes,
      });
    } catch {
      await cleanUp(d.objects, placed);
      return { reply: unavailable("PDF を作れなかった") };
    }
  }
  let answer: IssueAnswer | undefined;
  try {
    answer = await opsTx(d.appPool, ctx, (cl) => issue(cl, pdf));
  } catch (e) {
    await cleanUp(d.objects, placed);
    return { reply: opsErrorReply(e, WHERE) };
  }
  if (!answer || answer.error !== undefined || answer.data === undefined) {
    await cleanUp(d.objects, placed);
    return { answer, pdfs: [] };
  }
  return { answer, pdfs: made };
}
