"use client";
// 依頼のやり取り /portal/requests/:id（K-912）。読みと書きは use-request-thread、見た目は部品 RequestThread（口を呼ばない）。
//   見えない依頼・別のグループの依頼は「見られない」（あるかどうかも伝えない・題や名前は出さない）
//   会社の名前（帯の字）は外枠のホームの読みの tenant_name だけ。ホームの読みが済むまで中身を出さない（読めなければ K-911 のホームと同じ読めない形）
import { useRouter } from "next/navigation";
import { ErrorState, PAGE_ERROR, errorCodeOf } from "@/components/k";
import { whenOf } from "./home-page";
import { RequestThread, type ThreadView } from "./request";
import { usePortalHome } from "./use-portal-home";
import { useRequestThread, type PortalRequestData } from "./use-request-thread";
import { NotVisible, SessionExpired } from "./work";

function viewOf(d: PortalRequestData, group: string): ThreadView {
  const when = whenOf(d.request.created_at);
  const who = when ? `${d.request.from_name}が${when} に出した` : `${d.request.from_name}が出した`;
  return {
    title: d.request.title,
    sub: group ? `${who} ・ ${group}の皆さんにも見えます` : who,
    state: d.request.state,
    ...(d.request.declined_reason ? { declinedReason: d.request.declined_reason } : {}),
    messages: d.messages,
    canWrite: d.can_write,
  };
}

export function RequestPage({ id }: { id: string }) {
  const router = useRouter();
  const home = usePortalHome();
  const h = home.data?.ok ? home.data.data : null;
  const t = useRequestThread(id);
  const toHome = () => router.push("/portal");
  const relogin = () => router.push(`/login?next=${encodeURIComponent(`/portal/requests/${id}`)}`);

  if (t.expired) return <SessionExpired onRelogin={relogin} />;
  if (t.read.isPending) return null;
  const r = t.read.data;
  if (!r || !r.ok) {
    const kind = r?.err.kind;
    if (kind === "unauthenticated") return <SessionExpired onRelogin={relogin} />;
    if (kind === "not_found" || kind === "forbidden" || !r)
      return <NotVisible what="この依頼" groupName="" onBack={toHome} />;
    return <ErrorState code={errorCodeOf(r.err)} acts={[() => void t.read.refetch()]} />;
  }
  if (home.isPending) return null;
  if (!h) {
    const kind = home.data?.ok === false ? home.data.err.kind : undefined;
    if (kind === "unauthenticated") return <SessionExpired onRelogin={relogin} />;
    if (kind === "forbidden") return <NotVisible groupName="" onBack={() => router.push("/")} />;
    return <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void home.refetch()]} />;
  }
  return (
    <RequestThread
      thread={viewOf(r.data, h.group_name)}
      reply={t.reply}
      onReplyChange={t.setReply}
      onSend={t.send}
      sending={t.sending}
      replyError={t.replyError}
      sendError={t.sendError}
    />
  );
}
