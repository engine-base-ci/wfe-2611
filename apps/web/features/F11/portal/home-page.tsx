"use client";
// ゲストの場所のホーム /portal（K-911）。2 つの箱（依頼・見せてもらったチケット）・お知らせ・はじめの画面（ようこそ）・期限切れ・見られない。
//   部品（home.tsx・work.tsx）は口を呼ばない。ここが読んだ値を渡す
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { HomeBody, type RequestItem, type WorkItem } from "./home";
import {
  PORTAL_HOME_KEY,
  usePortalHome,
  usePortalNotices,
  type PortalHomeData,
  type PortalRead,
} from "./use-portal-home";
import { NotVisible, SessionExpired, Welcome } from "./work";

const TZ = "Asia/Tokyo";
const day = (d: Date) => d.toLocaleDateString("ja-JP", { timeZone: TZ });

/** 出した時刻：今日なら「今日 10:20」、ほかは「10/12」 */
export function whenOf(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (day(d) === day(now))
    return `今日 ${d.toLocaleTimeString("ja-JP", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false })}`;
  return d.toLocaleDateString("ja-JP", { timeZone: TZ, month: "numeric", day: "numeric" });
}

const requestsOf = (h: PortalHomeData): RequestItem[] =>
  h.requests.map((r) => {
    const when = whenOf(r.created_at);
    return {
      id: r.id,
      title: r.title,
      meta: when ? `${r.from_name} ・ ${when}` : r.from_name,
      badge: r.badge,
      href: `/portal/requests/${encodeURIComponent(r.id)}`,
    };
  });
const worksOf = (h: PortalHomeData): WorkItem[] =>
  h.tickets.map((t) => ({
    id: t.id,
    title: t.title,
    meta: t.stage,
    href: `/portal/tickets/${encodeURIComponent(t.id)}`,
  }));

export function PortalHomePage() {
  const router = useRouter();
  const home = usePortalHome();
  const notices = usePortalNotices();
  const queryClient = useQueryClient();
  // 「やり取りを始める」：残っているホームの答えの first_visit を済みにする（口は呼び直さない）。
  //   別の道へ行って /portal に戻っても、外枠と同じ鍵の答えが済みのままなので、ようこそは二度と出ない
  const markStarted = () =>
    queryClient.setQueryData<PortalRead<PortalHomeData>>(PORTAL_HOME_KEY, (prev) =>
      prev && prev.ok ? { ok: true, data: { ...prev.data, first_visit: false } } : prev,
    );
  const toNew = () => router.push("/portal/requests/new");

  if (home.isPending) return <HomeBody phase="loading" requests={[]} works={[]} groupName="" onNewRequest={toNew} />;
  const r = home.data;
  if (!r || !r.ok) {
    const kind = r?.err.kind;
    if (kind === "unauthenticated")
      return <SessionExpired onRelogin={() => router.push(`/login?next=${encodeURIComponent("/portal")}`)} />;
    if (kind === "forbidden") return <NotVisible groupName="" onBack={() => router.push("/")} />;
    return (
      <HomeBody
        phase="failed"
        requests={[]}
        works={[]}
        groupName=""
        onNewRequest={toNew}
        onRetry={() => void home.refetch()}
      />
    );
  }
  const h = r.data;
  if (h.first_visit) return <Welcome name={h.me.name} inviter={null} onStart={markStarted} />;
  const notice = notices.data?.[0];
  return (
    <HomeBody
      notice={notice ? { title: notice.title, body: notice.body } : undefined}
      requests={requestsOf(h)}
      works={worksOf(h)}
      groupName={h.group_name}
      onNewRequest={toNew}
    />
  );
}
