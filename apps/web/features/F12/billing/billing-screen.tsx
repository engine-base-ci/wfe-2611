"use client";
// 請求書の画面（K-960・画面 billing・道 /billing）。外枠（TicketShell）の中に、支払い条件・振込先・請求先・請求書の表。
//   見た目はモック /dev/mock/f12-user の ub-bills・ub-bills-overdue・ub-bills-empty・ub-contact・ub-bills-noaccess と同じ部品（views.tsx）。
//   読む口 getBilling は 1 回。403 は「見られない」（E-PAGE-002）、ほかの失敗は「読めなかった」（E-PAGE-007・「もう一度」で読み直す）。
//   「PDF」は押すたびに downloadInvoicePdf（署名 URL は短い期限）→ 新しい窓。開けなければ表の上に知らせ
import { useRef, useState } from "react";
import { ErrorState, Loading, NoAccess, PAGE_ERROR, PageBody } from "@/components/k";
import { fetchFile } from "@/lib/api/call";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { billView, overdueText, termsText } from "./billing-shape";
import { EditContactDialog } from "./contact-dialog";
import { BillingReadError, useBilling } from "./use-billing";
import { Bills, type BillView } from "./views";

/** 「設定に戻る」と上の帯の「設定」の行き先（段 11 の設定の画面・切る段の決め 2026-11-23） */
const SETTINGS_HREF = "/settings/company";
export const BILLING_CRUMBS = [
  { label: "ワークスペースの管理" },
  { label: "設定", href: SETTINGS_HREF },
  { label: "請求書" },
];
const PDF_FAILED = "請求書を開けませんでした。もう一度お試しください。";

/** 開いてよい署名 URL（http か https だけ） */
const SIGNED_URL = /^https?:\/\//;

/** PDF を新しい窓で開く。開けたら true。
 *  口の答えが http(s) の署名 URL のときだけ開く。ほか（JSON でない答え・ほかの形の URL）は開かない
 *  （blob: の URL はこの画面と同じ生まれで開くので作らない・Q60 の指摘） */
async function openPdf(id: string): Promise<boolean> {
  const r = await fetchFile("downloadInvoicePdf", { id });
  if (!r.ok || r.kind !== "link" || !SIGNED_URL.test(r.url)) return false;
  window.open(r.url, "_blank", "noopener");
  return true;
}

export function BillingScreen() {
  const q = useBilling();
  const [editing, setEditing] = useState(false);
  const [pdfAlert, setPdfAlert] = useState<string | undefined>(undefined);
  const opening = useRef(false);

  const onPdf = async (b: BillView): Promise<void> => {
    if (!b.id || opening.current) return;
    opening.current = true;
    setPdfAlert(undefined);
    const ok = await openPdf(b.id).catch(() => false);
    opening.current = false;
    if (!ok) setPdfAlert(PDF_FAILED);
  };

  const body = (() => {
    if (q.isError) {
      const forbidden = q.error instanceof BillingReadError && q.error.forbidden;
      return (
        <PageBody labelledBy={forbidden ? "noaccess" : "billing-error"}>
          {forbidden ? (
            <NoAccess acts={["/tickets"]} />
          ) : (
            <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void q.refetch()]} />
          )}
        </PageBody>
      );
    }
    if (!q.data) return <Loading />;
    const b = q.data;
    const overdue = overdueText(b);
    return (
      <>
        <Bills
          terms={termsText(b)}
          bank={b.payee.lines}
          contact={b.contact}
          bills={b.invoices.map((inv) => ({ ...billView(inv), id: inv.id }))}
          {...(overdue ? { overdue } : {})}
          {...(b.free ? { free: true } : {})}
          backHref={SETTINGS_HREF}
          onPdf={(bill) => void onPdf(bill)}
          onEditContact={() => setEditing(true)}
          canEditContact={b.can_edit_contact}
          {...(pdfAlert ? { alert: pdfAlert } : {})}
        />
        {editing ? <EditContactDialog contact={b.contact} onClose={() => setEditing(false)} /> : null}
      </>
    );
  })();

  return (
    <TicketShell screen="billing" crumbs={BILLING_CRUMBS}>
      {body}
    </TicketShell>
  );
}
