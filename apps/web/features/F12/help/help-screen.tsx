"use client";
// 困ったとき・お知らせのホーム（K-956・画面 notices・道 /notices）。外枠（TicketShell）の中に、お知らせ・いまの稼働状況・自分の問い合わせ。
//   見た目はモック /dev/mock/f12-user/uh-help・uh-help-empty・uh-help-error と同じ部品（views.tsx の HelpHome）。
//   読む口 3 本を同時に 1 回ずつ。どれかが読めなければ読めなかった旨（E-PAGE-007）で、「もう一度」で 3 本を読み直す。
//   「問い合わせる」は問い合わせの道（/inquiry・K-953）ができていればそこへ、無ければ押せない形（D-145.9）
//   問い合わせを送った後（?sent=1・K-953）は上に「運営に届きました」
import { useSyncExternalStore } from "react";
import { Loading } from "@/components/k";
import { BUILT_ROUTES } from "@/lib/built-routes";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { inquiryView, noticeView, statusView } from "./help-shape";
import { useMyInquiries, useNotices, useServiceStatus } from "./use-help";
import { HelpHome } from "./views";

export const HELP_CRUMBS = [{ label: "困ったとき・お知らせ", href: "/notices" }];
const SENT = "運営に届きました";
export const NOTICE_HREF = (id: string): string => `/notices/${id}`;
const INQUIRY_HREF = (id: string): string => `/inquiry/${id}`;
const ASK = "/inquiry";

export function HelpScreen() {
  const notices = useNotices();
  const status = useServiceStatus();
  const inquiries = useMyInquiries();
  const all = [notices, status, inquiries];
  const failed = all.some((q) => q.isError);
  const ready = all.every((q) => q.isSuccess);
  const retry = (): void => {
    for (const q of all) void q.refetch();
  };
  const now = Date.now();
  const sent = useSentFlag();
  return (
    <TicketShell screen="notices" crumbs={HELP_CRUMBS}>
      {failed ? (
        <HelpHome notices={[]} statuses={[]} inquiries={[]} failed onRetry={retry} askHref={askOf()} />
      ) : ready ? (
        <HelpHome
          notices={(notices.data ?? []).map(noticeView)}
          statuses={(status.data?.components ?? []).map(statusView)}
          inquiries={(inquiries.data ?? []).map((q) => inquiryView(q, now))}
          noticeHref={NOTICE_HREF}
          inquiryHref={INQUIRY_HREF}
          askHref={askOf()}
          {...(sent ? { sent: SENT } : {})}
        />
      ) : (
        <Loading />
      )}
    </TicketShell>
  );
}

/** 問い合わせの道があるときだけ行き先を渡す（無ければ押せない形） */
const askOf = (): string | null => (BUILT_ROUTES.includes(ASK) ? ASK : null);

/** 送った直後か（道の ?sent=1）。道から読む（サーバーで描くときは出さない・道を読む仕組みで画面を動的にしない） */
const noSubscribe = (): (() => void) => () => undefined;
function useSentFlag(): boolean {
  return useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("sent") === "1",
    () => false,
  );
}
