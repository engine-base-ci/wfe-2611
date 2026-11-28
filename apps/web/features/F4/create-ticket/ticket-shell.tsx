"use client";
// チケットの画面の外枠（K-60・K-138・K-466）。キャンバスどおりの新しい外枠（components/k の Shell・D-143.1）に載せる。
//   外枠が読む口は getShell（GET /api/v1/shell・K-465）の 1 本だけ（D-151.7・P8・D-128.111）。前の 4 本（me・listScopes・listApprovalQueue・listMyDevices）は読まない。
//     1 画面で 1 回：読み続けない・窓に戻っても読み直さない（G-16）。役・名前・会社・承認待ちの数・グループと件数・ベルの数・PC の印・書けるグループは全部この答えから
//   getShell が失敗したとき（500・答えの形が違う・鍵が欠ける）は役が分からないので、役の項目・数・グループ・PC の印・作るボタン・会社の印を出さない（嘘の値を出さない）。
//     本文は出す。自分で読み直さない。401 は call が入り直し（/login?next=）へ移す（K138-SH-021）
//   グループの口（作る面の選択肢・一覧の見出し）は同じ問い合わせ（SCOPES_KEY = SHELL_KEY）の答えを使う（口を 2 つにしない）
//   グループの件数・ベルの数は 0 のとき出さない（D-144.3）。承認待ちの数はどの画面でも出す（D-144.5）。承認待ちの画面は自分で読んだ数を渡す（K138-SH-027）
//   グループの行の行き先は差し込み口 groupHref（K-599・K-480 が本物にする）。null のあいだはグレーで押せない（D-145.18）
//   PC の状態は、画面が自分で PC の一覧を読み続けるとき（PC をつなぐ・K-220）は画面の答えを受け取る
//   障害の帯（答えの banner）は読まない（F12 が本文つきで描く・K-466 の決定）。保存した条件（任意の鍵 saved_views）は通すだけ（K-479 が読む）
//   小さなお知らせの置き場（Toaster）は全体で 1 か所、ここに置く（useNotify を使う画面が全部これを使う）
//   右の自分のAIのパネルは出さない（チケットは PC をつないでいなくても作れる・D-127.8）
//   右上の自分のメニューと左上のワークスペースの切り替えの中身は F10 の部品（K-844）。口 getMe は箱を開いたときだけ読む（外枠の口を増やさない）
//   障害・メンテの帯と画面いっぱいの形の差し込み口はここ 1 か所（K-957・D-156.10）：ServiceGate が外枠ごと包み（メンテ中・画面が止まっているなら外枠を描かない）、
//     ServiceBands が本文の前に帯を 1 つ並べる（帯が無ければ何も描かない）
import { useQuery, type QueryClient } from "@tanstack/react-query";
import { useSyncExternalStore, type ReactNode } from "react";
import { Shell, Toaster, type Crumb, type Group } from "@/components/k";
import { ServiceBands, ServiceGate } from "@/features/F12/help/service-bands";
import * as F7 from "@/features/F7/shell-slots";
import { MeMenuBox, OrgMenuBox } from "@/features/F10/account/me-menu";
import { call } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { signOut } from "@/lib/auth";
import type { RoleId } from "@/lib/nav";
import { THEME_COOKIE, parseTheme, type Theme } from "@/lib/theme";

/** members.role_id → 主ナビの役（役ごとの並べ方は flow.json の sections_by_role）。ここに無い値は役を渡さない */
const ROLE_OF: Record<string, RoleId> = { owner: "R1", admin: "R1", staff: "R3", viewer: "R4", ops: "R6" };
/** グループの札の色（データの色の順に回す。キャンバスは 営業 teal・受託開発 plum・経理 amber） */
const TONES: Group["tone"][] = ["teal", "plum", "amber", "indigo", "coral", "sage", "lavender", "teal-light"];
/** 外枠の口は 1 画面で 1 回：自分では読み直さない */
export const ONCE = {
  retry: false,
  staleTime: Infinity,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export interface ScopeRow {
  id: string;
  name: string;
  tenant_id?: string;
  /** 番号の頭（EG など）。在れば札に使う（キャンバスの札と同じ物） */
  ticket_prefix?: string | null;
}
export interface Scopes {
  rows: ScopeRow[];
  /** 書けるグループの id */
  writable: string[];
}

/** getShell の答えのグループ（K-465 の試験の形） */
export interface ShellGroup {
  id: string;
  name: string;
  ticket_prefix: string | null;
  writable: boolean;
  open_count: number;
}
/** getShell の答え（K-465 の試験 apps/api/test/features/F7/shell.test.ts の形。契約の型 Shell は鍵の中身を決めていないので、ここで形を決めて確かめる） */
export interface ShellAnswer {
  member: { id?: string; name: string | null; role_id: string | null };
  workspace: { id?: string; name: string | null };
  approvals_waiting: number;
  notifications_unread: number;
  groups: ShellGroup[];
  pc: { connected: boolean; count?: number };
  setup_left?: number;
  banner?: unknown;
  /** 任意の鍵（保存した条件・K-479 が読む）。外枠は読まない・形を確かめない */
  saved_views?: unknown;
}
/** 外枠の問い合わせの答え：getShell の答えに、グループの口の前の形（rows・writable）を足す */
export type ShellData = ShellAnswer & Scopes;

/** 外枠の口の問い合わせの鍵（外枠と作る面の選択肢・一覧の見出しで分け合う） */
export const SHELL_KEY = ["k138-shell", "shell"] as const;
/** グループの問い合わせの鍵（名前を残す。中身は外枠と同じ問い合わせ） */
export const SCOPES_KEY = SHELL_KEY;

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isGroup = (g: unknown): g is ShellGroup =>
  isObj(g) && typeof g["id"] === "string" && typeof g["name"] === "string" && typeof g["open_count"] === "number";

/** 答えの形を確かめる（鍵が欠ける・形が違う答えは読めない扱い。saved_views は見ない） */
export function isShell(data: unknown): data is ShellAnswer {
  if (!isObj(data)) return false;
  return (
    isObj(data["member"]) &&
    isObj(data["workspace"]) &&
    typeof data["approvals_waiting"] === "number" &&
    typeof data["notifications_unread"] === "number" &&
    Array.isArray(data["groups"]) &&
    data["groups"].every(isGroup) &&
    isObj(data["pc"])
  );
}

export async function readShell(screen: string): Promise<ShellData> {
  const r = await call("getShell", { screenId: screen });
  if (!r.ok) throw Object.assign(new Error(r.code), { result: r });
  const data: unknown = r.data;
  if (!isShell(data)) throw new Error("shell-shape");
  const rows: ScopeRow[] = data.groups.map((g) => ({ id: g.id, name: g.name, ticket_prefix: g.ticket_prefix }));
  const writable = data.groups.filter((g) => g.writable).map((g) => g.id);
  return { ...data, rows, writable };
}
/** グループを読む（名前を残す：作る面・一覧・詳細はこの名前で読む。答えは外枠と同じ問い合わせ） */
export const readScopes = readShell;

/** 承認待ちの口の問い合わせの鍵（一覧の右の列「自分の承認を待っているもの」だけが使う・K-235。外枠は読まない） */
export const APPROVALS_KEY = ["k138-shell", "approvals"] as const;
export const APPROVALS_LIMIT = 5;
export interface ApprovalsAnswer {
  rows: Record<string, unknown>[];
  total: number;
}
export async function readApprovals(screen: string): Promise<ApprovalsAnswer> {
  const r = await call("listApprovalQueue", { query: { limit: APPROVALS_LIMIT }, screenId: screen });
  if (!r.ok) throw new Error(r.code);
  const total = Number(((r.meta["counts"] ?? {}) as { total?: number }).total ?? 0);
  return { rows: r.data as unknown as Record<string, unknown>[], total };
}

/** 作る面がグループを読む（外枠が読んでいれば同じ答えを使い、口を 2 回呼ばない） */
export const fetchScopes = (qc: QueryClient, screen: string): Promise<Scopes> =>
  qc.fetchQuery({ queryKey: SCOPES_KEY, queryFn: () => readScopes(screen), ...ONCE });

export interface TicketShellProps {
  /** いま見ている画面（flow の screen id）。左のメニューの今いる項目になる */
  screen:
    | "tickets"
    | "approvals"
    | "bridge-setup"
    | "mfa-setup"
    | "credentials"
    | "audit"
    | "account"
    | "company-settings"
    | "member-detail"
    | "members"
    | "ai-activity"
    | "clone-chat"
    | "requests"
    | "notices"
    | "billing"
    | "masters"
    | "knowledge";
  /** 上の帯のいまの場所 */
  crumbs: Crumb[];
  /** 左のメニューの数（まとまりの鍵 → 数）。承認待ちの画面は自分で読んだ数を渡す（外枠は二重に読まない） */
  counts?: Partial<Record<string, number>>;
  /** 作るボタンを押したとき（一覧の画面はその場で作る面を開く）。無ければ /tickets?new=1 へ移る。書けるグループが無い人には出さない */
  onCreate?: () => void;
  /** 画面が読んだ PC の状態（true＝つながっている・null＝まだ読んでいる）。渡されたら外枠は答えの pc を使わない（K-220） */
  bridgeConnected?: boolean | null;
  /** 左のバーを 56 に畳ませる（一覧で横に詳細を開いた 1024〜1279・K-252） */
  railed?: boolean;
  children: ReactNode;
}

function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${THEME_COOKIE}=`));
  return parseTheme(hit?.slice(THEME_COOKIE.length + 1));
}

// ログインの印（token）は手元にだけ在る。組み立て（サーバー）の描画は「無い」で描き、画面に載ってから手元の値で描き直す。
//   その場で window を見ると、サーバーの HTML（探す欄が disabled）と最初の描画（使える）が食い違い、
//   React は食い違った属性を直さないので、探す欄が押せないまま残っていた（K-471・K-592）
const noSubscribe = () => () => undefined;
const useSignedIn = (): boolean =>
  useSyncExternalStore(
    noSubscribe,
    () => getToken() !== null,
    () => false,
  );

/** 外枠の口を 1 本だけ読む。ログイン前は呼ばない */
function useShellData(screen: string) {
  const signedIn = useSignedIn();
  const shell = useQuery({ queryKey: SHELL_KEY, queryFn: () => readShell(screen), enabled: signedIn, ...ONCE });
  return { signedIn, shell };
}

/** グループの札の色（左のメニューの札と同じ色の順・グループの一覧の見出しの札にも使う） */
export const scopeTone = (rows: ScopeRow[], id: string): Group["tone"] =>
  TONES[
    Math.max(
      0,
      rows.findIndex((s) => s.id === id),
    ) % TONES.length
  ]!;

/** getShell のグループ → 左のメニューの行（件数 0 は数を出さない・行き先は差し込み口 groupHref） */
function toGroup(g: ShellGroup, i: number): Group {
  const to = F7.groupHref(g.id);
  return {
    code: g.ticket_prefix || g.name.slice(0, 1),
    name: g.name,
    href: to ?? `/tickets?scope=${encodeURIComponent(g.id)}`,
    tone: TONES[i % TONES.length]!,
    pending: to === null,
    ...(g.open_count > 0 ? { count: g.open_count } : {}),
  };
}

export function TicketShell({ screen, crumbs, counts, onCreate, bridgeConnected, railed, children }: TicketShellProps) {
  const ownCount = counts?.["approvals"] !== undefined;
  const ownBridge = bridgeConnected !== undefined;
  const { signedIn, shell } = useShellData(screen);
  const data = shell.isSuccess ? shell.data : null;
  // 段 8 の差し込み口（K-599）。ベルの数は getShell の値（押し方は K-467）
  const notice = F7.useNoticeSlot({ unread: data?.notifications_unread, enabled: signedIn });
  const search = F7.useSearchSlot({ enabled: signedIn });
  // 役は口が答え、値が分かるときだけ（読み中・失敗・知らない値は役なし＝役の項目を出さない）
  const roleId = data?.member.role_id;
  const role = roleId ? ROLE_OF[roleId] : undefined;
  const name = data?.member.name ?? "";
  const company = data?.workspace.name?.trim() ?? "";
  const groups: Group[] = (data?.groups ?? []).map(toGroup);
  const approvals = ownCount ? counts?.["approvals"] : data?.approvals_waiting;
  const notices = data && data.notifications_unread > 0 ? data.notifications_unread : undefined;
  const badges = { ...counts, ...(approvals !== undefined ? { approvals } : {}) };
  const canCreate = (data?.writable.length ?? 0) > 0;
  const pcOn = ownBridge ? bridgeConnected === true : data?.pc.connected === true;
  const theme = readTheme();
  const leave = () => {
    void signOut().finally(() => window.location.assign("/login"));
  };
  return (
    <ServiceGate>
      <Toaster>
        <Shell
          {...notice.shellProps}
          {...search.shellProps}
          belowGroups={<F7.SavedViewSlot enabled={signedIn} />}
          {...(role ? { role } : {})}
          screen={screen}
          crumbs={crumbs}
          workspace={{ name: company, initial: company.slice(0, 1) }}
          member={{ name, initial: name.slice(0, 1) }}
          groups={groups}
          badges={badges}
          {...(notices !== undefined ? { notices } : {})}
          bridgeConnected={pcOn}
          theme={theme}
          {...(railed ? { railed } : {})}
          {...(canCreate ? { onCreate: onCreate ?? (() => window.location.assign("/tickets?new=1")) } : {})}
          onSignOut={leave}
          meMenu={
            <MeMenuBox screen={screen} fallbackName={name} bridgeConnected={pcOn} theme={theme} onSignOut={leave} />
          }
          orgMenu={<OrgMenuBox screen={screen} workspaceName={company} />}
        >
          <div data-ticket-shell>
            <ServiceBands screen={screen} />
            {children}
          </div>
          <F7.NoticeSlot slot={notice} />
          <F7.SearchSlot slot={search} />
        </Shell>
      </Toaster>
    </ServiceGate>
  );
}
