"use client";
// メンバー（K-420・画面 members・道 /members）。外枠（TicketShell）の中に、ワークスペースの管理の頭（WsHead）・第 2 ナビ（WsSub）・本文（MembersBody）。
//   見た目はモック /dev/mock/f8/inv-* と同じ部品（views.tsx）。動き：getWorkspaceMembers（K-419）を 1 回読む → グループごとの並び。
//   「＋ 招く」の小窓：足す（宛てをそろえて形を見る）・外す・グループと役割・ひとこと・リンク。送るのは createInvitations（K-419）、リンクは createInvitationLink（K-421）。
//   管理者として招く（口が 403・STEP_UP_REQUIRED）なら本人確認の取り直し（step-up.tsx）を出し、通ったら止まった操作を 1 回だけ送り直す。
//   口の断り方の出し分けは状態でなく答えの code と details：宛てごとの文（E-INV-009・010）と 51 人以上（E-INV-012）は欄の下、ほか（404・503 など）は小窓の上の赤い箱。書いた中身は残す。
//   K-931（段 12）：ゲストの人の行の「⋯」から 1 人だけ止める・戻す・外す（確かめと送るは guest-tab.tsx の useGuestGroupEditing）。
//   K-874（段 12）：見出しの下のタブ（メンバー／ゲスト・URL ?tab=guests）。開いたとき getWorkspaceMembers と listGuestGroups（K-876）を並べて 1 回ずつ読む。
//   ゲストを招く（役割 requester・guest_group_id・scope_id は送らない・D-155.38）・ゲストのグループを作る小窓（createGuestGroup・K-876）。
//   同じ中身の押し直しは同じ Idempotency-Key（中身を変えたら新しい鍵）。
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import type { Ops } from "@kaname/contracts";
import { CATALOG } from "@kaname/errors/catalog";
import { Loading, Toaster, useNotify } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import { StepUp } from "@/features/F1/security/step-up";
import { ONCE, TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { GuestGroupDialog } from "./guest-group-views";
import { GuestTabContent, useGuestGroupEditing } from "./guest-tab";
import { createGuestGroup, GUEST_GROUPS_KEY, GuestGroupsError, useGuestGroups } from "./use-guest-groups";
import { isEmail, MEMBERS_KEY, SCREEN, splitEmails, useMembers } from "./use-members";
import { GUEST_ROLE, InviteDialog, MembersBody, WsHead, WsSub, type InviteValues, type MemberGroup } from "./views";

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

const EMPTY: InviteValues = { typing: "", emails: [], group: "", role: "member", message: "" };

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

export function MembersPage() {
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
  const sending = useRef(false);
  const pending = useRef<Req | null>(null);

  const company = (who.data as { workspace_name?: string | null } | undefined)?.workspace_name?.trim() ?? "";

  const reset = () => {
    setDone(null);
    setCompanyErr(null);
    setLocalErr(null);
    setNoteErr(null);
    setServerErr(null);
    setNotice(null);
    setLink(null);
    setMore(false);
  };
  /** 中身を変えたら新しい冪等の鍵（同じ中身の押し直しは同じ鍵・K874-UI-011） */
  const edit = (f: (v: InviteValues) => InviteValues) => {
    idem.current = newKey();
    setForm(f);
  };
  const inboxOf = (id: string): string | undefined =>
    gview?.raw.find((g) => g.id === id)?.request_scope?.name ?? undefined;
  const openDialog = (preset?: MemberGroup) => {
    reset();
    idem.current = newKey();
    const guest = guestTab || Boolean(preset);
    const base: InviteValues = { ...EMPTY, group: view?.scopes[0]?.id ?? "" };
    setForm(
      !guest
        ? base
        : preset?.id
          ? withCompany({ ...base, role: GUEST_ROLE }, preset.name, preset.id, inboxOf(preset.id))
          : { ...base, role: GUEST_ROLE, company: "" },
    );
    setOpen(true);
  };
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
  /** 役割を変える：ゲストとほかの間を移るときはゲストのグループの選びを消す（K874-UI-017） */
  const pickRole = (role: string) => {
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
        setOpen(false);
        idem.current = newKey();
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
    <Toaster>
      <TicketShell screen="members" crumbs={[{ label: "ワークスペースの管理", disabled: true }, { label: "メンバー" }]}>
        {members.isPending || who.isPending ? (
          <Loading />
        ) : (
          <>
            <WsHead name={company} initial={company.slice(0, 1)} />
            <div className="k-me-wrap">
              <WsSub members={view?.count ?? 0} />
              {guestTab ? (
                <MembersBody
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
                  groups={view?.groups ?? []}
                  tabs={tabs}
                  inviteDisabled={!view}
                  onInvite={() => openDialog()}
                  {...(members.isError
                    ? { failure: { text: LOAD_FAILED, onRetry: () => void members.refetch() } }
                    : {})}
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
    </Toaster>
  );
}
