"use client";
// チケットの画面の外枠（K-60・K-138）。キャンバスどおりの新しい外枠（components/k の Shell・D-143.1）に載せる。
//   役と名前は前からある口（/api/auth-ext/me）を useMyRoles と同じ問い合わせ（鍵 ["me"]）で読む（契約の口 getMe は K-70）。
//     読み中・失敗（401 など）のあいだは役を渡さない：役の項目を出さない（useMyRoles は失敗を owner に倒すので、役の値だけは使わない）
//   外枠が読む口（グループ・承認待ちの数・PC）は 1 画面で 1 回ずつ。読み続けない（G-16）。失敗したら、その部分を出さないだけ（本文は出す）
//   本当の値が無い物（会社の名前・グループの件数・知らせの数）は空にする（嘘の値を書かない・D-144.2・D-144.3）。承認待ちの数はどの画面でも出す（D-144.5）
//   右の自分のAIのパネルは出さない（チケットは PC をつないでいなくても作れる・D-127.8）
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Shell, type Crumb, type Group } from "@/components/k";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { signOut } from "@/lib/auth";
import { me } from "@/lib/auth/ext";
import type { RoleId } from "@/lib/nav";
import { THEME_COOKIE, parseTheme, type Theme } from "@/lib/theme";

/** members.role_id → 主ナビの役（役ごとの並べ方は flow.json の sections_by_role） */
const ROLE_OF: Record<string, RoleId> = { owner: "R1", admin: "R1", staff: "R3", viewer: "R4", ops: "R6" };
/** グループの札の色（データの色の順に回す。キャンバスは 営業 teal・受託開発 plum・経理 amber） */
const TONES: Group["tone"][] = ["teal", "plum", "amber", "indigo", "coral", "sage", "lavender", "teal-light"];
/** 外枠の口は 1 画面で 1 回：自分では読み直さない */
const ONCE = { retry: false, staleTime: Infinity, refetchOnWindowFocus: false, refetchOnReconnect: false } as const;

interface ScopeRow {
  id: string;
  name: string;
  /** 番号の頭（EG など）。在れば札に使う（キャンバスの札と同じ物） */
  ticket_prefix?: string | null;
}
interface Scopes {
  rows: ScopeRow[];
  writable: number;
}

export interface TicketShellProps {
  /** いま見ている画面（flow の screen id）。左のメニューの今いる項目になる */
  screen: "tickets" | "approvals";
  /** 上の帯のいまの場所 */
  crumbs: Crumb[];
  /** 左のメニューの数（まとまりの鍵 → 数）。承認待ちの画面は自分で読んだ数を渡す（外枠は二重に読まない） */
  counts?: Partial<Record<string, number>>;
  /** 作るボタンを押したとき（一覧の画面はその場で作る面を開く）。無ければ /tickets?new=1 へ移る。書けるグループが無い人には出さない */
  onCreate?: () => void;
  children: ReactNode;
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${THEME_COOKIE}=`));
  return parseTheme(hit?.slice(THEME_COOKIE.length + 1));
}

function useShellData(screen: string, ownCount: boolean) {
  const signedIn = typeof window !== "undefined" && Boolean(getToken());
  const who = useQuery({ queryKey: ["me"], queryFn: me, enabled: signedIn, retry: false });
  const scopes = useQuery({
    queryKey: ["k138-shell", "scopes"],
    enabled: signedIn,
    ...ONCE,
    queryFn: async (): Promise<Scopes> => {
      const r = await call("listScopes", { screenId: screen });
      if (!r.ok) throw new Error(r.code);
      const writable = ((r.meta["writable"] as unknown[] | undefined) ?? []).length;
      return { rows: r.data as unknown as ScopeRow[], writable };
    },
  });
  const waiting = useQuery({
    queryKey: ["k138-shell", "approvals-count"],
    enabled: signedIn && !ownCount,
    ...ONCE,
    queryFn: async (): Promise<number> => {
      const r = await call("listApprovalQueue", { query: { limit: 1 }, screenId: screen });
      if (!r.ok) throw new Error(r.code);
      return Number(((r.meta["counts"] ?? {}) as { total?: number }).total ?? 0);
    },
  });
  const devices = useQuery({
    queryKey: ["k138-shell", "devices"],
    enabled: signedIn,
    ...ONCE,
    queryFn: async (): Promise<boolean> => {
      const r = await call("listMyDevices", { screenId: screen });
      if (!r.ok) throw new Error(r.code);
      return (r.data as unknown as { state: string }[]).some((d) => d.state === "live");
    },
  });
  return { who, scopes, waiting, devices };
}

export function TicketShell({ screen, crumbs, counts, onCreate, children }: TicketShellProps) {
  const ownCount = counts?.["approvals"] !== undefined;
  const { who, scopes, waiting, devices } = useShellData(screen, ownCount);
  // 役は口が答えたときだけ（読み中・失敗は役なし＝役の項目を出さない）
  const role = who.isSuccess ? (ROLE_OF[who.data.role_id ?? ""] ?? "R1") : undefined;
  const name = (who.isSuccess ? who.data.display_name : null) ?? "";
  const groups: Group[] = (scopes.data?.rows ?? []).map((s, i) => ({
    code: s.ticket_prefix || s.name.slice(0, 2),
    name: s.name,
    href: `/tickets?scope=${encodeURIComponent(s.id)}`,
    tone: TONES[i % TONES.length]!,
  }));
  const approvals = ownCount ? counts?.["approvals"] : waiting.data;
  const badges = { ...counts, ...(approvals !== undefined ? { approvals } : {}) };
  const canCreate = (scopes.data?.writable ?? 0) > 0;
  return (
    <Shell
      {...(role ? { role } : {})}
      screen={screen}
      crumbs={crumbs}
      workspace={{ name: "", initial: "" }}
      member={{ name, initial: name.slice(0, 1) }}
      groups={groups}
      badges={badges}
      bridgeConnected={devices.data === true}
      theme={readTheme()}
      {...(canCreate ? { onCreate: onCreate ?? (() => window.location.assign("/tickets?new=1")) } : {})}
      onSignOut={() => {
        void signOut().finally(() => window.location.assign("/login"));
      }}
    >
      <div data-ticket-shell>{children}</div>
    </Shell>
  );
}
