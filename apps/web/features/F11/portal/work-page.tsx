"use client";
// ゲストの場所の見せてもらったチケット /portal/tickets/:id（K-913）。部品（work.tsx）は口を呼ばない。ここが読んだ値と動きを渡す。
//   出し分けは状態コードだけ：401 → 期限切れの形（「入り直す」で /login）・403／404 → 「この仕事は見られません」（あるかどうかを伝えない）・ほか → 読めなかった形
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ErrorState, PAGE_ERROR } from "@/components/k";
import { usePortalHome } from "./use-portal-home";
import { usePortalTicket, usePortalTicketSend } from "./use-portal-ticket";
import { NotVisible, SessionExpired, WorkDetail } from "./work";

const HOME = "/portal";
const SEND_FAILED = "送れませんでした";

export function PortalWorkPage({ id }: { id: string }) {
  const router = useRouter();
  const q = usePortalTicket(id);
  const home = usePortalHome();
  const me = home.data?.ok ? home.data.data.me.name : "";
  const { send, busy } = usePortalTicketSend(id, me ? `${me} 様` : "");
  const [after, setAfter] = useState<"gone" | "expired" | null>(null);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const sending = useRef(false);
  const toHome = () => router.push(HOME);
  const relogin = () => router.push(`/login?next=${encodeURIComponent(`${HOME}/tickets/${id}`)}`);

  if (q.isPending) return <p className="k-f11p-note">読み込んでいます</p>;
  const r = q.data;
  const kind = after ?? (r && !r.ok ? r.err.kind : null);
  if (kind === "expired" || kind === "unauthenticated") return <SessionExpired onRelogin={relogin} />;
  if (kind === "gone" || kind === "not_found" || kind === "forbidden")
    return <NotVisible what="この仕事" groupName="" onBack={toHome} />;
  if (!r || !r.ok) return <ErrorState code={PAGE_ERROR.loadFailed} heading={1} acts={[() => void q.refetch()]} />;

  const onSend = async (text: string): Promise<boolean> => {
    if (sending.current) return false;
    sending.current = true;
    try {
      const res = await send(text);
      if (res === "sent") {
        setSendErr(null);
        return true;
      }
      if (res === "gone" || res === "expired") setAfter(res);
      else setSendErr(SEND_FAILED);
      return false;
    } finally {
      sending.current = false;
    }
  };
  return (
    <WorkDetail
      ticket={r.data.ticket}
      messages={r.data.messages}
      onSend={onSend}
      onBack={toHome}
      busy={busy}
      error={sendErr}
    />
  );
}
