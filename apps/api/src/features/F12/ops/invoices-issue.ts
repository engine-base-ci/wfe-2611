// 運営が月の請求書をまとめて出す（K-981・issueOpsInvoices・POST /api/v1/ops/invoices/issue・D-156.31・D-156.53・D-128.108）。
//   お金を持つ運営の人と本人確認の取り直し（15 分）は入口（契約の ops:money・step_up always）。入力の形（month・dry_run）も入口（422）。
//   opsTx の 1 取引で app.ops_invoices_issue を 1 回呼ぶ → 断りの言葉 → 番号。下書き（dry_run）は何も書かない。
//   出すときは会社ごとに請求書・運営と会社の記録・管理者への鈴を同じ取引で書く（どれかが落ちれば全部戻る・503）。
//   出すときだけ、先に会社ごとの請求書の PDF を作って置き（K-1013・withInvoicePdfs）、その参照を p_pdf で渡す。断り・失敗なら置いた PDF は消える。
//   下書きは PDF を作らない（p_pdf は空）。ログは場所と SQLSTATE だけ（会社の名前・額を出さない）
//   出し終えた（取引が確定した）後に、会社ごとの管理者へ PDF を付けたメールを送り（K-1109・mailInvoices）、送れた・送れなかった数を meta.mail に返す。
//   下書き・断り・503 では送らない。送れなくても請求書は戻さない
import type pg from "pg";
import { kanameError } from "@kaname/errors";
import type { HookArgs, HookReply } from "../../../contract/deps.js";
import { opsErrorReply, opsTx } from "./db.js";
import { withInvoicePdfs, type IssueAnswer, type IssuedPdf, type PdfDeps } from "./invoices-pdf.js";
import { mailInvoices, type MailDeps } from "./invoices-mail.js";

type Answer = IssueAnswer;

const WHERE = "invoices-issue";

/** 欄も details も付けない（控え帳） */
const conflict = (code: string): HookReply => ({ status: 409, body: kanameError(code).toJSON() });

/** DB の関数の断りの言葉 → 答え。知らない言葉は止める側（503） */
function replyOf(word: string): HookReply {
  if (word === "month_open") return conflict("E-BILL-002");
  if (word === "nothing_to_issue") return conflict("E-BILL-003");
  if (word === "changed") return conflict("E-BILL-006");
  console.error(`[ops] ${WHERE} の DB が断った（${/^[a-z_]+$/.test(word) ? word : "unknown"}）`);
  return { status: 503, body: kanameError("E-PAGE-003").toJSON() };
}

const call = (cl: pg.PoolClient, month: string, dry: boolean, pdf: Record<string, unknown>) =>
  cl
    .query<{ v: Answer }>("select app.ops_invoices_issue($1, $2, $3::jsonb) as v", [month, dry, JSON.stringify(pdf)])
    .then((q) => q.rows[0]?.v);

export function createIssueOpsInvoices(d: PdfDeps & Pick<MailDeps, "mailer">): (a: HookArgs) => Promise<HookReply> {
  return async (a) => {
    const month = typeof a.input["month"] === "string" ? a.input["month"] : "";
    const dry = a.input["dry_run"] === true;
    let r: Answer | undefined;
    let pdfs: IssuedPdf[] = [];
    if (dry) {
      try {
        r = await opsTx(d.appPool, a.ctx, (cl) => call(cl, month, true, {}));
      } catch (e) {
        return opsErrorReply(e, WHERE);
      }
    } else {
      const got = await withInvoicePdfs(d, a.ctx, month, (cl, pdf) => call(cl, month, false, pdf));
      if ("reply" in got) return got.reply;
      r = got.answer;
      pdfs = got.pdfs;
    }
    if (!r) return replyOf("empty");
    if (r.error !== undefined || r.data === undefined) return replyOf(String(r.error));
    if (dry) return { status: 201, body: { data: r.data } };
    const issued = Number((r.data as { count?: unknown }).count ?? pdfs.length);
    const mail = await mailInvoices({ appPool: d.appPool, mailer: d.mailer }, a.ctx, pdfs, issued);
    return { status: 201, body: { data: r.data, meta: { mail } } };
  };
}
