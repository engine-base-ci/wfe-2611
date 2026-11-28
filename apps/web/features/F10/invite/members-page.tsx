"use client";
// メンバー（K-420・K-818・画面 members・道 /members）。外枠（TicketShell）の中に、ワークスペースの管理の頭（WsHead）・第 2 ナビ（WsSub）・本文（F10 の MembersPage）。
//   K-818：本文を段 11 の部品 features/F10/members に替えた。グループごとの行（初めは自分の主のグループだけ開く・読み直しでは触らない）・役割の ▾（use-role-change.ts）・
//   行の「⋯」（行き先はメンバーの 1 人の画面 /members/<id>・?do=…）・最後に使った日・上の 1 行（members-shape.ts）。見られない人（管理者でない）は外枠の中に NoAccess（並びの口を呼ばない）
//   見た目はモック /dev/mock/f8/inv-* と同じ部品（views.tsx）。動き：getWorkspaceMembers（K-419）を 1 回読む → グループごとの並び。
//   「＋ 招く」の小窓：足す（宛てをそろえて形を見る）・外す・グループと役割・ひとこと・リンク。送るのは createInvitations（K-419）、リンクは createInvitationLink（K-421）。
//   管理者として招く（口が 403・STEP_UP_REQUIRED）なら本人確認の取り直し（step-up.tsx）を出し、通ったら止まった操作を 1 回だけ送り直す。
//   口の断り方の出し分けは状態でなく答えの code と details：宛てごとの文（E-INV-009・010）と 51 人以上（E-INV-012）は欄の下、ほか（404・503 など）は小窓の上の赤い箱。書いた中身は残す。
//   K-809：招待中の行の「送り直す」「取り消す」（use-invite-rows.ts・取り消す前に Confirm）と、各グループの「＋ このグループに招く」（招く小窓をそのグループを選んだ形で開く）。
//   K-805：「＋ グループ」→ グループを足す小窓（use-group-add.ts・GroupDialog）。並びが読めない間は押せない。
//   K-806：グループの見出しの「直す」・頭の「並びを替える」・層の名前と並びを直す小窓（use-group-edit.ts）。層の小窓は足す小窓の層 ▾ から開き、閉じたら足す小窓へ戻る。
//   K-931（段 12）：ゲストの人の行の「⋯」から 1 人だけ止める・戻す・外す（確かめと送るは guest-tab.tsx の useGuestGroupEditing）。
//   K-874（段 12）：見出しの下のタブ（メンバー／ゲスト・URL ?tab=guests）。開いたとき getWorkspaceMembers と listGuestGroups（K-876）を並べて 1 回ずつ読む。
//   メンバーのタブは段 11 の本文（F10/members の MembersPage）の差し込み口 tabs に載せ、ゲストのタブは invite/views の MembersBody（guest）。
//   ゲストを招く（役割 requester・guest_group_id・scope_id は送らない・D-155.38）・ゲストのグループを作る小窓（createGuestGroup・K-876）。
//   同じ中身の押し直しは同じ Idempotency-Key（中身を変えたら新しい鍵）。
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import type { Ops } from "@kaname/contracts";
import { CATALOG } from "@kaname/errors/catalog";
import { Band, Callout, Confirm, Loading, NoAccess, useNotify } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import { RequireRole, useMyRoles } from "@/lib/auth/role";
import { StepUp } from "@/features/F1/security/step-up";
import { ONCE, TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { isEmail, MEMBERS_KEY, SCREEN, splitEmails, useMembers } from "./use-members";
import { GuestGroupDialog } from "./guest-group-views";
import { GuestTabContent, useGuestGroupEditing } from "./guest-tab";
import { createGuestGroup, GUEST_GROUPS_KEY, GuestGroupsError, useGuestGroups } from "./use-guest-groups";
import {
  GUEST_ROLE,
  InviteDialog,
  MembersBody as GuestsBody,
  WsHead,
  WsSub,
  type InviteValues,
  type MemberGroup,
} from "./views";
import { bandOf, initialOpen, toGroups } from "@/features/F10/members/members-shape";
import { useRoleChange, type RoleResult } from "@/features/F10/members/use-role-change";
import type { MoreAction } from "@/features/F10/members/person-row";
import { useInviteRows } from "@/features/F10/members/use-invite-rows";
import { GroupDialog, LayersDialog, ReorderDialog } from "@/features/F10/members/group-dialogs";
import { peopleOf, useGroupAdd } from "@/features/F10/members/use-group-add"; // K-805
import { useGroupEdit } from "@/features/F10/members/use-group-edit"; // K-806
import { MembersPage as MembersBody, groupKey, type GroupData, type PendingButton } from "@/features/F10/members/views";

const LOAD_FAILED = "メンバーを読み込めませんでした";
const NEED_ONE = "メールを 1 つ以上入れてください";
const STEP_UP_REASON = "管理者として招く前に、本人か確かめます";
const COPIED = "招待のリンクをコピーしました";
const COPY_FAILED = "コピーできませんでした。リンクを選んでコピーしてください";
const NOTE_TOO_LONG = "ひとことは 500 字までです";
/** ひとことの上限（口 createInvitations と invitations_message_len と同じ 500・数え方も口と同じく字ごと） */
const MESSAGE_MAX = 500;
const msgOf = (code: string): string => CATALOG[code]?.message ?? "";
// ゲスト（K-874）の文。番号は正本（errors.json・K-876 が足す E-GST-*）から引き、無いときだけ下絵の字
const msgOr = (code: string, fallback: string): string => msgOf(code) || fallback;
const PICK_GUEST_GROUP = "ゲストのグループを選んでください";
const NEED_NAME = "名前を入れてください";
const GUEST_GROUP_GONE = () => msgOr("E-GST-001", "このゲストのグループは見つかりません");
const GUEST_GROUP_DUP = () => msgOr("E-GST-002", "同じ名前のゲストのグループがあります。別の名前にしてください");
const INBOX_GONE = () => msgOr("E-GST-003", "このグループは見つかりません");
const CREATE_FORBIDDEN = "ゲストのグループを作る権限がありません";
const GUEST_TITLE = "ゲスト";
const GUEST_SUB =
  "ゲストのグループごとに並ぶ。グループのゲストは誰でも依頼を出せ、グループの依頼と見せたチケットをグループ全員が見る（チケットは直せない）";
const created = (name: string): string => `ゲストのグループ「${name}」を作りました`;
const newKey = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
const EMPTY_GROUP = "このグループにはまだ人がいません";
/** まだ押せない入口（無い。「＋ グループ」は K-805・「並びを替える」「直す」は K-806・「＋ このグループに招く」は K-809 でつないだ） */
const PENDING: readonly PendingButton[] = [];
/** 見られる役（管理者・R1・R2） */
const CAN_SEE = ["R1", "R2"];
/** 「⋯」の行き先（メンバーの 1 人の画面・小窓は K-819 の ?do=） */
const DO_OF: Record<Exclude<MoreAction, "role">, string> = {
  tickets: "",
  move: "?do=move",
  also: "?do=also",
  suspend: "?do=suspend",
  resume: "?do=resume",
  remove: "?do=remove",
};
/** 赤い箱と並びの読み直しが要る断り方（相手かグループがもう変わった） */
const STALE = ["E-MEM-002", "E-MEM-006", "E-MEM-007"];

const EMPTY: InviteValues = { typing: "", emails: [], group: "", role: "member", message: "" };

/** 招待中の行に招待の id を持たせる（送り直す・取り消すが指す・K-809） */
const withInvitedId = (g: GroupData): GroupData => ({
  ...g,
  rows: g.rows.map((r) => (r.invitedLeft ? { ...r, invitedId: r.id } : r)),
});

/** 欄に打った字を足す。形の違う字は並びに入れず、欄に残して理由を返す（同じ宛ては 1 つ） */
function absorb(v: InviteValues): { values: InviteValues; error: string | null } {
  const parts = splitEmails(v.typing);
  if (parts.length === 0) return { values: v, error: null };
  const good = parts.filter(isEmail);
  const bad = parts.filter((p) => !isEmail(p));
  const emails = [...v.emails, ...good.filter((e, i) => !v.emails.includes(e) && good.indexOf(e) === i)];
  if (bad.length === 0) return { values: { ...v, emails, typing: "" }, error: null };
  const typing = good.length === 0 ? v.typing : bad.join(", ");
  return { values: { ...v, emails, typing }, error: bad.map((b) => `${b} はメールの形ではありません`).join("。") };
}

/** 口が断ったときの宛てごとの文を「。」でつなぐ。E-INV-010 は detail.already の宛て（details は付かない・K-419）、E-INV-009 は details の email と message */
function detailText(r: CallErr): string {
  if (r.code === "E-INV-010") {
    const raw = (r.body["detail"] as { already?: unknown } | undefined)?.already;
    const already = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
    return already.map((email) => `${email} は${msgOf("E-INV-010")}`).join("。");
  }
  const d = Array.isArray(r.body["details"]) ? (r.body["details"] as { email?: string; message?: string }[]) : [];
  return d
    .filter((x) => x.email && x.message)
    .map((x) => `${x.email} は${x.message}`)
    .join("。");
}

/** 小窓の上の赤い箱に出す文（401 はログイン切れ・正本の文・口の文の順） */
function noticeOf(r: CallErr): string {
  if (r.status === 401) return msgOf(PAGE_ERROR.sessionExpired);
  return msgOf(r.code) || r.message || msgOf(errorCodeOf(r));
}

interface Sent {
  email: string;
  mail: string;
}
const sentText = (sent: Sent[], n: number): string =>
  n > 1 ? `${n} 人に招待を送りました` : `${sent[0]?.email ?? ""} に招待を送りました`;
const failedText = (sent: Sent[]): string | undefined => {
  const failed = sent.filter((s) => s.mail === "failed").map((s) => s.email);
  return failed.length ? `${failed.join("・")} にはメールが届きませんでした。もう一度招いてください` : undefined;
};

/** 止まった操作を取り直しのあとで 1 回だけ送り直すために、送る中身ごと持つ */
type Req =
  | { kind: "invite"; body: Ops["createInvitations"]["body"]; guest: boolean }
  | { kind: "link"; body: Ops["createInvitationLink"]["body"] };

/** ゲストのグループを作る小窓の中身 */
interface Create {
  open: boolean;
  /** 招くの小窓から開いた（作ると招くに戻り、作ったグループが選ばれる） */
  fromInvite: boolean;
  name: string;
  inbox: string;
  error: string | null;
  inboxError: string | null;
  busy: boolean;
}
const CLOSED: Create = {
  open: false,
  fromInvite: false,
  name: "",
  inbox: "",
  error: null,
  inboxError: null,
  busy: false,
};

/** ゲストの欄を除いた中身（役割を移るとき・選び直すときに前の選びを残さない） */
const baseOf = (f: InviteValues): InviteValues => ({
  typing: f.typing,
  emails: f.emails,
  group: f.group,
  role: f.role,
  message: f.message,
});
/** ゲストのグループを選んだ形。選びは id で持つ（送るときに名前から探さない）。届け先が無ければ届け先の字は出さない（K874-UI-024） */
const withCompany = (f: InviteValues, company: string, companyId?: string, inbox?: string): InviteValues => ({
  ...baseOf(f),
  company,
  ...(companyId ? { companyId } : {}),
  ...(inbox ? { inbox } : {}),
});

/** メンバー／ゲストのタブ（URL を状態にする。押しても読み直さない） */
function Tabs({ guest, members, guests }: { guest: boolean; members: number; guests: number }) {
  return (
    <nav className="k-inv-tabs" aria-label="メンバーとゲスト">
      <Link className="k-inv-tab" href="/members" scroll={false} aria-current={guest ? undefined : "page"}>
        {`メンバー ${members}`}
      </Link>
      <Link className="k-inv-tab" href="/members?tab=guests" scroll={false} aria-current={guest ? "page" : undefined}>
        {`ゲスト ${guests}`}
      </Link>
    </nav>
  );
}

/** 見られる人かを先に見る（見られない人には並びの口を呼ばない） */
export function MembersPage() {
  const router = useRouter();
  const { roles, isGuest } = useMyRoles();
  // ゲスト（requester）は社内の外枠に入れず「いまの権限では開けません」と戻る先 /portal（K-877・RequireRole の形）
  if (isGuest) return <RequireRole screen="members">{null}</RequireRole>;
  if (roles === undefined)
    return (
      <TicketShell screen="members" crumbs={[{ label: "ワークスペースの管理", disabled: true }, { label: "メンバー" }]}>
        <Loading />
      </TicketShell>
    );
  if (!roles.some((r) => CAN_SEE.includes(r)))
    return (
      <TicketShell screen="members" crumbs={[{ label: "メンバー" }]}>
        <section aria-label="メンバー">
          <NoAccess acts={[() => router.back(), "/tickets"]} />
        </section>
      </TicketShell>
    );
  return <MembersScreen />;
}

interface RoleNote {
  title?: string;
  text: string;
}

function MembersScreen() {
  const router = useRouter();
  const qc = useQueryClient();
  const notify = useNotify();
  const members = useMembers();
  const guests = useGuestGroups(); // 並びの口と並べて 1 回ずつ（直列にしない・K874-UI-002）
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const view = members.data;
  const guestTab = useSearchParams().get("tab") === "guests";
  const gview = guests.data;
  const editing = useGuestGroupEditing(); // グループの「⋯」の名前を直す・消す（K-928）
  const [create, setCreate] = useState<Create>(CLOSED);
  const [done, setDone] = useState<string | null>(null);
  const [companyErr, setCompanyErr] = useState<string | null>(null);
  const idem = useRef<string>(newKey());
  const createKey = useRef<string>(newKey());
  const creating = useRef(false);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<InviteValues>(EMPTY);
  const [localErr, setLocalErr] = useState<string | null>(null);
  const [noteErr, setNoteErr] = useState<string | null>(null);
  const [serverErr, setServerErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean } | null>(null);
  const rows = useInviteRows({ reload: () => void qc.invalidateQueries({ queryKey: MEMBERS_KEY }) });
  const sending = useRef(false);
  const people = useMemo(() => peopleOf(view?.answer.groups), [view]); // K-805
  const groupAdd = useGroupAdd({ people }); // K-805
  const addDialog = groupAdd.dialog;
  // K-806：層の小窓は足す小窓の層 ▾ から開き、閉じたら足す小窓（書きかけのまま）へ戻る。名前を直した層を選んでいたら新しい名前に付け替える
  const groupEdit = useGroupEdit({
    people,
    onLayersClosed: (renamed) => {
      const now = renamed?.[addDialog.values.layer];
      if (now) addDialog.onLayer(now);
    },
    onAddLayer: () => addDialog.onNewLayer(""),
  });
  const pending = useRef<Req | null>(null);

  // ---- グループの開き閉じ（鍵はグループの id・初めは自分の主のグループだけ・読み直しでは触らない）
  const answer = view?.answer;
  const groups = useMemo<GroupData[]>(() => (answer ? toGroups(answer).map(withInvitedId) : []), [answer]);
  const [openGroups, setOpenGroups] = useState<string[] | null>(null);
  const opened = openGroups ?? (answer ? initialOpen(groups, answer) : []);
  const toggle = (key: string) =>
    setOpenGroups(opened.includes(key) ? opened.filter((k) => k !== key) : [...opened, key]);
  const band = answer ? bandOf(answer) : null;
  const suspended = useMemo(
    () => new Set((answer?.groups ?? []).flatMap((g) => g.members.filter((p) => p.suspended).map((p) => p.id))),
    [answer],
  );

  // ---- 役割を変える（結果の出し分けは答えの code で決める）
  const [roleNote, setRoleNote] = useState<RoleNote | null>(null);
  const reread = () => void qc.invalidateQueries({ queryKey: MEMBERS_KEY });
  const onRoleResult = (r: RoleResult) => {
    const { name, to } = r.target;
    if (r.ok) {
      notify(`${name}の役割を ${to} にしました`);
      return reread();
    }
    if (!r.error) return setRoleNote({ text: msgOf(PAGE_ERROR.offline) });
    if (r.error.code === "E-MEM-004")
      return setRoleNote({
        title: "役割を変えられません",
        text: `${name}は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、変えてください`,
      });
    setRoleNote({ text: noticeOf(r.error) });
    if (STALE.includes(r.error.code)) reread();
  };
  const role = useRoleChange({ onResult: onRoleResult });
  const rowActs = {
    busy: role.busy,
    suspended,
    hrefOf: (row: { id: string }) => `/members/${row.id}`,
    onRole: (g: GroupData, row: GroupData["rows"][number], to: GroupData["rows"][number]["role"]) => {
      if (row.role === to) return;
      setRoleNote(null);
      role.change({
        key: `${groupKey(g)}:${row.id}`,
        id: row.id,
        name: row.name,
        groupId: g.id ?? "",
        from: row.role,
        to,
      });
    },
    onMore: (_g: GroupData, row: { id: string }, a: MoreAction) => {
      if (a !== "role") router.push(`/members/${row.id}${DO_OF[a]}`);
    },
  };

  const company = (who.data as { workspace_name?: string | null } | undefined)?.workspace_name?.trim() ?? "";

  const reset = () => {
    setLocalErr(null);
    setNoteErr(null);
    setServerErr(null);
    setNotice(null);
    setLink(null);
    setMore(false);
    setDone(null);
    setCompanyErr(null);
  };
  /** 中身を変えたら新しい冪等の鍵（同じ中身の押し直しは同じ鍵・K874-UI-011） */
  const edit = (f: (v: InviteValues) => InviteValues) => {
    idem.current = newKey();
    setForm(f);
  };
  const inboxOf = (id: string): string | undefined =>
    gview?.raw.find((g) => g.id === id)?.request_scope?.name ?? undefined;
  /** 招く小窓を開く。
   *   社内のグループの id（string）を渡せばそのグループを選んだ形（変えられる・K-809）。
   *   ゲストのグループ（MemberGroup）を渡すか、ゲストのタブから開けば役割「ゲスト」（K-874）。何も渡さなければ先頭のグループ */
  const openDialog = (preset?: string | MemberGroup) => {
    reset();
    idem.current = newKey();
    const guestPreset = typeof preset === "object" ? preset : undefined;
    const groupId = typeof preset === "string" ? preset : undefined;
    const guest = guestTab || Boolean(guestPreset);
    const base: InviteValues = { ...EMPTY, group: groupId ?? view?.scopes[0]?.id ?? "" };
    setForm(
      !guest
        ? base
        : guestPreset?.id
          ? withCompany({ ...base, role: GUEST_ROLE }, guestPreset.name, guestPreset.id, inboxOf(guestPreset.id))
          : { ...base, role: GUEST_ROLE, company: "" },
    );
    setOpen(true);
  };
  const inviteGroup = (key: string) => {
    const g = groups.find((x) => groupKey(x) === key);
    if (g?.id) openDialog(g.id);
  };
  /** 招待の id → 宛て（知らせと確かめの字） */
  const emailOf = (id: string): string =>
    groups.flatMap((g) => g.rows).find((r) => r.invitedLeft && r.id === id)?.email ?? "";
  const close = () => {
    if (sending.current) return;
    setOpen(false);
  };

  // ---- 欄の動き
  const typing = (v: string) => {
    setLocalErr(null);
    setForm((f) => ({ ...f, typing: v }));
  };
  const add = () => {
    const r = absorb(form);
    edit(() => r.values);
    setLocalErr(r.error);
    if (r.values.emails.length !== form.emails.length) setServerErr(null);
  };
  const remove = (email: string) => {
    setServerErr(null);
    edit((f) => ({ ...f, emails: f.emails.filter((e) => e !== email) }));
  };
  const pick = (patch: Partial<InviteValues>) => {
    setLink(null); // 作ったリンクは選んだグループと役割のもの（変えたら出さない）
    edit((f) => ({ ...f, ...patch }));
  };
  /** 役割を変える：ゲストとほかの間を移るときはゲストのグループの選びを消す（K874-UI-017）。作ったリンクも出さない */
  const pickRole = (role: string) => {
    setLink(null);
    setCompanyErr(null);
    setDone(null);
    edit((f) => {
      const rest = { ...baseOf(f), role };
      return role === GUEST_ROLE ? { ...rest, company: "" } : rest;
    });
  };
  /** ゲストのグループを選ぶ。最後の「＋ 新しいゲストのグループを作る」は作る小窓を開く（招くの小窓は隠す・中身は残す） */
  const pickCompany = (id: string | null, name: string) => {
    setCompanyErr(null);
    setDone(null);
    if (id === null) return openCreate(true);
    edit((f) => withCompany(f, name, id, inboxOf(id)));
  };

  // ---- 口を呼ぶ（招く・リンク）。403・STEP_UP_REQUIRED は取り直しの後に 1 回だけ送り直す
  const askStepUp = async () => {
    const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
    const sec = s.ok ? s.data : {};
    setStepUp({ withCode: sec.two_factor === true, withPasskey: sec.has_password === false });
  };

  const showFailure = (r: CallErr) => {
    if (r.code === "E-INV-009" || r.code === "E-INV-010") setServerErr(detailText(r) || msgOf(r.code));
    else if (r.code === "E-INV-012") setServerErr(msgOf(r.code));
    else setNotice(noticeOf(r));
  };

  const run = async (req: Req, retried: boolean): Promise<void> => {
    if (sending.current) return;
    sending.current = true;
    const setWait = req.kind === "invite" ? setBusy : setLinkBusy;
    setWait(true);
    setNotice(null);
    setServerErr(null);
    try {
      const r =
        req.kind === "invite"
          ? await call("createInvitations", { body: req.body, idempotencyKey: idem.current, screenId: SCREEN })
          : await call("createInvitationLink", { body: req.body, screenId: SCREEN });
      if (r.ok) {
        pending.current = null;
        if (req.kind === "link") return setLink((r.data as unknown as { url?: string }).url ?? null);
        const sent = (r.data as unknown as { invitations?: Sent[] }).invitations ?? [];
        idem.current = newKey();
        setOpen(false);
        const failed = failedText(sent);
        notify(sentText(sent, req.body.emails.length), failed ? { description: failed } : {});
        void qc.invalidateQueries({ queryKey: req.guest ? GUEST_GROUPS_KEY : MEMBERS_KEY });
        return;
      }
      if (req.kind === "invite" && req.guest && r.code === "E-GST-001") {
        // 選んだゲストのグループが消されていた：選びを空に戻し、一覧を読み直す（K874-UI-010）。メールは残す
        setCompanyErr(GUEST_GROUP_GONE());
        edit((f) => {
          return withCompany(f, "");
        });
        void qc.invalidateQueries({ queryKey: GUEST_GROUPS_KEY });
        return;
      }
      if (r.kind === "step_up" && !retried) {
        pending.current = req;
        return await askStepUp();
      }
      showFailure(r);
    } catch {
      setNotice(msgOf(PAGE_ERROR.offline)); // 網が切れた（口に届かない）：書いた中身は残す
    } finally {
      sending.current = false;
      setWait(false);
    }
  };

  const send = () => {
    if (sending.current) return;
    const r = absorb(form);
    setForm(r.values);
    setLocalErr(r.error);
    if (r.error) return;
    if (r.values.emails.length === 0) return setLocalErr(NEED_ONE);
    const message = r.values.message.trim();
    if (Array.from(message).length > MESSAGE_MAX) return setNoteErr(NOTE_TOO_LONG);
    setNoteErr(null);
    const guest = r.values.role === GUEST_ROLE;
    const guestGroupId = guest ? r.values.companyId : undefined;
    if (guest && !guestGroupId) return setCompanyErr(PICK_GUEST_GROUP); // 選ぶまで口を呼ばない（K874-UI-007）
    setCompanyErr(null);
    // ゲスト：guest_group_id と役割 requester だけ（依頼の届け先は招待に持たせない・D-155.38）。メンバー：今までどおり scope_id
    const where = guest ? { guest_group_id: guestGroupId } : { scope_id: r.values.group };
    void run(
      {
        kind: "invite",
        guest,
        body: {
          emails: [...r.values.emails],
          ...where,
          role_key: r.values.role,
          ...(message ? { message } : {}),
        } as Ops["createInvitations"]["body"],
      },
      false,
    );
  };
  // ---- ゲストのグループを作る（K-874・口は K-876 の createGuestGroup）
  const openCreate = (fromInvite: boolean) => {
    createKey.current = newKey();
    setCreate({ ...CLOSED, open: true, fromInvite, inbox: view?.scopes[0]?.id ?? "" });
  };
  const editCreate = (patch: Partial<Create>) => {
    createKey.current = newKey();
    setCreate((c) => ({ ...c, ...patch, error: null, inboxError: null }));
  };
  const cancelCreate = () => {
    if (creating.current) return;
    if (create.fromInvite)
      edit((f) => {
        return withCompany(f, ""); // 作らずに戻る：選びは空（K874-UI-013）
      });
    setCreate(CLOSED);
  };
  const submitCreate = async () => {
    if (creating.current) return; // 二度押しは招く側（sending）と同じく ref で止める（同じ描画の間に 2 回来ても 1 回）
    const name = create.name.trim();
    if (!name) return setCreate((c) => ({ ...c, error: NEED_NAME, inboxError: null }));
    creating.current = true;
    setCreate((c) => ({ ...c, busy: true, error: null, inboxError: null }));
    try {
      const r = await createGuestGroup({ name, request_scope_id: create.inbox }, createKey.current);
      if (r.ok) {
        const inbox = view?.scopes.find((s) => s.id === create.inbox)?.name;
        void qc.invalidateQueries({ queryKey: GUEST_GROUPS_KEY });
        if (create.fromInvite) {
          edit((f) => withCompany(f, r.group.name, r.group.id, inbox)); // 返ってきた id を選びに入れる（一覧の読み直しを待たずに送れる）
          setCompanyErr(null);
          setDone(created(r.group.name));
        } else notify(created(r.group.name));
        setCreate(CLOSED);
        return;
      }
      if (r.code === "E-GST-002") return setCreate((c) => ({ ...c, busy: false, error: GUEST_GROUP_DUP() }));
      if (r.code === "E-GST-003") {
        // 届け先の社内のグループが消されていた：小窓は閉じず、選び肢を読み直す（K874-UI-025）
        void qc.invalidateQueries({ queryKey: MEMBERS_KEY });
        return setCreate((c) => ({ ...c, busy: false, inboxError: INBOX_GONE() }));
      }
      if (r.status === 403) return setCreate((c) => ({ ...c, busy: false, error: CREATE_FORBIDDEN }));
      setCreate((c) => ({ ...c, busy: false, error: noticeOf(r) }));
    } catch {
      setCreate((c) => ({ ...c, busy: false, error: msgOf(PAGE_ERROR.offline) }));
    } finally {
      creating.current = false;
    }
  };
  const makeLink = () => void run({ kind: "link", body: { scope_id: form.group, role_key: form.role } }, false);
  const copy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(
      () => void notify(COPIED),
      () => void notify(COPY_FAILED, { type: "error" }),
    );
  };

  const emailsError = [localErr, serverErr].filter(Boolean).join("。");
  const guestErr = guests.error instanceof GuestGroupsError ? guests.error.result : null;
  const guestState = guests.isPending
    ? null
    : guestErr?.status === 403
      ? "forbidden"
      : guests.isError
        ? "failed"
        : (gview?.groups.length ?? 0) === 0
          ? "empty"
          : null;
  const tabs = <Tabs guest={guestTab} members={view?.count ?? 0} guests={gview?.count ?? 0} />;
  return (
    <TicketShell screen="members" crumbs={[{ label: "ワークスペースの管理", disabled: true }, { label: "メンバー" }]}>
      {members.isPending || who.isPending ? (
        <Loading />
      ) : (
        <>
          <WsHead name={company} initial={company.slice(0, 1)} />
          <div className="k-me-wrap">
            <WsSub members={view?.count ?? 0} />
            {guestTab ? (
              <GuestsBody
                groups={gview?.groups ?? []}
                guest
                title={GUEST_TITLE}
                sub={GUEST_SUB}
                tabs={tabs}
                inviteDisabled={!view}
                onInvite={() => openDialog()}
                onCreateGroup={() => openCreate(false)}
                onInviteGroup={(g) => openDialog(g)}
                onRenameGroup={(g) => {
                  const a = gview?.raw.find((x) => x.id === g.id);
                  if (a) editing.startRename(a);
                }}
                onDeleteGroup={(g) => {
                  const a = gview?.raw.find((x) => x.id === g.id);
                  if (a) editing.startDelete(a);
                }}
                onGuestAct={(act, r) => editing.startGuest(act, r)}
                {...(guests.isPending
                  ? { content: <Loading /> }
                  : guestState
                    ? { content: <GuestTabContent state={guestState} onRetry={() => void guests.refetch()} /> }
                    : {})}
              />
            ) : (
              <MembersBody
                groups={groups}
                tabs={tabs}
                open={opened}
                onToggle={toggle}
                band={band ? <Band tone="wait" title={band.title} {...(band.sub ? { sub: band.sub } : {})} /> : null}
                emptyText={EMPTY_GROUP}
                disabledButtons={PENDING}
                inviteDisabled={!view}
                onInvite={() => openDialog()}
                onAddGroup={groupAdd.open /* K-805 */}
                addGroupDisabled={!view /* K-805：並びが読めない間は押せない */}
                onEditGroup={groupEdit.openEdit /* K-806：鍵は groupKey */}
                onReorder={groupEdit.openOrder /* K-806 */}
                rowActs={rowActs}
                {...(roleNote || rows.notice || groupEdit.pageNotice
                  ? {
                      notice: (
                        <>
                          {
                            groupEdit.pageNotice ? (
                              <Callout tone="danger">{groupEdit.pageNotice}</Callout>
                            ) : null /* K-806 */
                          }
                          {rows.notice ? <Callout tone={rows.notice.tone}>{rows.notice.text}</Callout> : null}
                          {roleNote ? (
                            <Callout tone="danger" {...(roleNote.title ? { title: roleNote.title } : {})}>
                              {roleNote.text}
                            </Callout>
                          ) : null}
                        </>
                      ),
                    }
                  : {})}
                onInviteGroup={inviteGroup}
                onResend={(id) => void rows.resend(id, emailOf(id))}
                onRevoke={(id) => rows.askRevoke(id, emailOf(id))}
                resentIds={rows.resentIds}
                busyId={rows.busyId}
                {...(members.isError ? { failure: { text: LOAD_FAILED, onRetry: () => void members.refetch() } } : {})}
              />
            )}
          </div>
        </>
      )}
      <InviteDialog
        open={open && stepUp === null && !create.open}
        values={form}
        errors={{
          ...(emailsError ? { emails: emailsError } : {}),
          ...(noteErr ? { message: noteErr } : {}),
          ...(companyErr ? { company: companyErr } : {}),
        }}
        {...(done ? { done } : {})}
        companies={gview?.raw.map((g) => ({ id: g.id, name: g.name })) ?? []}
        onCompany={pickCompany}
        {...(notice ? { notice } : {})}
        {...(link ? { link } : {})}
        more={more}
        groups={view?.scopes ?? []}
        busy={busy}
        linkBusy={linkBusy}
        onTyping={typing}
        onAdd={add}
        onRemove={remove}
        onGroup={(group) => pick({ group })}
        onRole={pickRole}
        onMessage={(message) => {
          setNoteErr(null);
          edit((f) => ({ ...f, message }));
        }}
        onMore={setMore}
        onLink={makeLink}
        onCopy={copy}
        onSend={send}
        onCancel={close}
      />
      <GuestGroupDialog
        open={create.open}
        fromInvite={create.fromInvite}
        name={create.name}
        inbox={create.inbox}
        inboxes={view?.scopes ?? []}
        busy={create.busy}
        {...(create.error ? { error: create.error } : {})}
        {...(create.inboxError ? { inboxError: create.inboxError } : {})}
        onName={(name) => editCreate({ name })}
        onInbox={(inbox) => editCreate({ inbox })}
        onCreate={() => void submitCreate()}
        onCancel={cancelCreate}
      />
      <GroupDialog
        {...addDialog}
        open={addDialog.open && !groupEdit.layers.open /* K-806：層の小窓の間は隠す（書きかけは残る） */}
        editLayersOption={addDialog.editLayersOption === "hide" ? "hide" : "show" /* K-806 */}
        onEditLayers={groupEdit.openLayers /* K-806 */}
      />
      <GroupDialog {...groupEdit.edit} /* K-806 */ />
      <ReorderDialog {...groupEdit.order} /* K-806 */ />
      <LayersDialog {...groupEdit.layers} /* K-806 */ />
      <Confirm
        open={rows.ask !== null}
        title="招待を取り消しますか"
        description={`${rows.ask?.email ?? ""} に送った招待は使えなくなります。招待のリンクも使えなくなります`}
        confirmLabel="招待を取り消す"
        busy={rows.revoking}
        onOpenChange={(o) => {
          if (!o) rows.cancelRevoke();
        }}
        onConfirm={() => void rows.revoke()}
      />
      <StepUp
        open={role.stepUp.open}
        reason={role.stepUp.reason}
        withCode={role.stepUp.withCode}
        withPasskey={role.stepUp.withPasskey}
        onDone={role.stepUp.onDone}
        onCancel={role.stepUp.onCancel}
      />
      <StepUp
        open={stepUp !== null}
        reason={STEP_UP_REASON}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        onDone={() => {
          setStepUp(null);
          const req = pending.current;
          if (req) void run(req, true);
        }}
        onCancel={() => {
          setStepUp(null);
          pending.current = null;
        }}
      />
      {editing.dialogs}
    </TicketShell>
  );
}
