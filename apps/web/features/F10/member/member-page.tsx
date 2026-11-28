"use client";
// メンバーの 1 人（K-819・画面 member-detail・道 /members/<id>）。外枠（TicketShell）の中に、ワークスペースの管理の頭（WsHead）・
//   第 2 ナビ（WsSub・「メンバー」が今の場所）・本文（MemberPage）。モック /dev/mock/f10 の md-* の WsFrame と同じ組み立て。
//   管理者（R1・R2）だけ：役を読み終えるまでは読み込み中、見られない人は「この画面を見る権限がありません」（E-PAGE-002）で、口は呼ばない。
//   口 getMember を 1 回読む。404・422＝見つかりません（E-PAGE-001・メンバーへ）・403＝権限が無い・ほか＝読めない（もう一度読む）。
//   操作の小窓は detail-dialogs.tsx の登録（K-820〜K-822 が足す）。登録の無い操作は押せない形。?do=<キー> で開く
//   K-820：自分のとき、グループを移す・兼ねる（move・also）は ?do= でも開かない（口 409 E-MEM-003 を待たない）
//   K-822：自分は外せない（押せない形・title は部品の「自分は外せません…」）。登録の無い操作に足して渡す。外す小窓の中身は detail-dialogs.tsx の RemoveBox
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useState, type ReactNode } from "react";
import { Button, ErrorState, Loading, NoAccess, PAGE_ERROR, errorCodeOf, type Crumb } from "@/components/k";
import { me } from "@/lib/auth/ext";
import { useMyRoles } from "@/lib/auth/role";
import { BUILT_ROUTES } from "@/lib/built-routes";
import { ONCE, TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { WsHead, WsSub } from "@/features/F10/invite/views";
import { DO_DIALOGS, unregistered, useDoParam } from "./detail-dialogs";
import { toDetailData } from "./member-shape";
import { MemberLoadError, SCREEN, useMember } from "./use-member";
import { MemberPage, type Action } from "./views";

const ADMIN_ROLES = ["R1", "R2"];
const MEMBERS_PATH = "/members";
const AUDIT_PATH = "/audit";
const RETRY = "もう一度読む";
const SECTION_LABEL = "メンバーの 1 人";
/** 自分のときは開かない小窓（K-820。止める・外すの自分の扱いは本文の部品が持つ） */
const SELF_BLOCKED: readonly Action[] = ["move", "also"];

const crumbsOf = (name?: string): Crumb[] => [
  { label: "ワークスペースの管理", disabled: true },
  { label: "メンバー", href: MEMBERS_PATH },
  ...(name ? [{ label: name }] : []),
];

/** 本文の代わりに出す箱（読み込み中・権限・見つからない・読めない） */
function StateBox({ children }: { children: ReactNode }) {
  return (
    <section className="k-root k-page k-me-page k-inv-page" aria-label={SECTION_LABEL}>
      {children}
    </section>
  );
}

export function MemberDetailPage({ id }: { id: string }) {
  const { roles } = useMyRoles();
  const admin = roles?.some((r) => ADMIN_ROLES.includes(r)) ?? false;
  const member = useMember(id, admin);
  const err = member.error instanceof MemberLoadError ? member.error.r : null;
  const forbidden = roles !== undefined && (!admin || err?.status === 403);
  const name = member.data?.member.name;

  let body: ReactNode;
  if (roles === undefined) body = <Loading />;
  else if (forbidden)
    body = (
      <StateBox>
        <NoAccess />
      </StateBox>
    );
  else body = <AdminBody id={id} member={member} />;

  return (
    <TicketShell screen={SCREEN} crumbs={crumbsOf(name)}>
      {body}
    </TicketShell>
  );
}

function AdminBody({ id, member }: { id: string; member: ReturnType<typeof useMember> }) {
  const router = useRouter();
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const company = (who.data as { workspace_name?: string | null } | undefined)?.workspace_name?.trim() ?? "";
  const [open, setOpen] = useState<Action | null>(null);
  const [notice, setNotice] = useState<ReactNode | null>(null);
  const openDialog = useCallback((a: Action) => setOpen(a), []);
  useDoParam(openDialog);

  const recordsBuilt = BUILT_ROUTES.includes(AUDIT_PATH);
  // ?do= は答えを読む前に来るので、自分かどうかは開くときでなく描くときに見る
  const self = member.data?.member.self === true;
  const Dialog = open && !(self && SELF_BLOCKED.includes(open)) ? DO_DIALOGS[open] : undefined;
  // K-822：自分は外せない（押せない形・title は部品の「自分は外せません…」）。登録の無い操作に足して渡す
  const disabled: Action[] = [
    ...unregistered(),
    ...(self && !unregistered().includes("remove") ? (["remove"] as const) : []),
  ];

  let main: ReactNode;
  if (member.isPending) main = <Loading />;
  else if (member.isError) main = <Failure error={member.error} onRetry={() => void member.refetch()} />;
  else
    main = (
      <MemberPage
        d={toDetailData(member.data)}
        notice={notice}
        disabledActions={disabled /* K-822 */}
        onAction={(a) => {
          if (DO_DIALOGS[a]) setOpen(a);
        }}
        recordsDisabled={!recordsBuilt}
        onRecords={() => router.push(`${AUDIT_PATH}?member=${encodeURIComponent(id)}`)}
      />
    );

  return (
    <>
      <WsHead name={company} initial={company.slice(0, 1)} />
      <div className="k-me-wrap">
        <WsSub active="members" />
        {main}
      </div>
      {Dialog && member.data ? (
        <Dialog id={id} answer={member.data} onClose={() => setOpen(null)} onNotice={setNotice} />
      ) : null}
    </>
  );
}

/** 読めなかったとき：404・422＝見つかりません（メンバーへ）・ほか＝正本の 1 件と「もう一度読む」。
 *  口の答えでない誤り（網が切れた・つながらない等で投げられた）は読めない（E-PAGE-007）に回し、読み直せるようにする */
function Failure({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const r = error instanceof MemberLoadError ? error.r : null;
  if (r && (r.status === 404 || r.status === 422))
    return (
      <StateBox>
        <ErrorState code={PAGE_ERROR.notFound} acts={[MEMBERS_PATH]} />
      </StateBox>
    );
  return (
    <StateBox>
      <ErrorState code={r ? errorCodeOf(r) : PAGE_ERROR.loadFailed} />
      <div className="k-state-actions">
        <Button variant="primary" onClick={onRetry}>
          {RETRY}
        </Button>
      </div>
    </StateBox>
  );
}
