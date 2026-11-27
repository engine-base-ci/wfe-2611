"use client";
// 運営の人の画面（/ops/team・K-986）。一覧を読み → 部品（views-team.tsx）に形の値と押したときの関数を渡す。
//   足す・変える・外すは本人確認の取り直しが要る（D-128.70）：口が 403 STEP_UP_REQUIRED → getMySecurity を 1 回読み StepUp → 通ったら同じ体で 1 回だけやり直す。
//   やめたら何も送らず、入れた値のまま小窓に戻す。送っている間は 2 回目を送らない。書いたら一覧の鍵を捨てて 1 回読み直す。
//   自分・最後の 1 人の行は「変える」の中身と「外す」を押せない形（口を呼ばない・D-156.34）。口の 409 E-OPS-017／018 も同じ注意の箱で受ける
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { ErrorState, NoAccess, PageBody, PageHeader } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import type { CallErr } from "@/lib/api/call";
import { FALLBACKS } from "@/lib/nav";
import { StepUp } from "@/features/F1/security/step-up";
import {
  LOCK_TITLE,
  capFlags,
  capLabelOf,
  capsOfFlags,
  lastText,
  lockTextOf,
  removeLockOf,
  selfText,
  subOf,
  teamRowView,
  type OpsMemberRow,
} from "./team-shape";
import { TEAM_KEY, addMember, removeMember, stepUpShape, updateCaps, useOpsTeam } from "./use-ops-team";
import { TeamAddDialog, TeamEditDialog, TeamPage, TeamRemoveConfirm, type TeamLockText } from "./views-team";

const STEP_UP_REASON = "運営の人を変える前に、本人か確かめます"; // （仮）
const MAIL_FAILED = "招待のメールを送れませんでした。外してから足し直してください"; // （仮）
const textOf = (code: string): string => CATALOG[code]?.message ?? "";
const failText = (r: CallErr): string =>
  r.message ?? (textOf(r.code) || textOf(errorCodeOf(r)) || textOf(PAGE_ERROR.loadFailed));

type Write = { ok: true; meta: Record<string, unknown> } | { ok: false; err: CallErr };
type Open = { kind: "add" } | { kind: "edit"; id: string } | { kind: "remove"; id: string } | null;

function Frame({ children }: { children: ReactNode }) {
  return (
    <PageBody labelledBy="op-team-title">
      <PageHeader id="op-team-title" title="運営の人" sub="運営の場所に入れる人と、できること" />
      {children}
    </PageBody>
  );
}

/** 口が 409 で変えるのを断った → 注意の箱の字 */
function editRefusal(r: CallErr, row: OpsMemberRow): TeamLockText {
  if (r.code === "E-OPS-017") return { title: LOCK_TITLE, body: selfText(row) };
  if (r.code === "E-OPS-018") {
    const detail = r.body["detail"] as { cap?: unknown } | undefined;
    const cap = typeof detail?.cap === "string" ? capLabelOf(detail.cap) : "";
    return { title: textOf("E-OPS-018") || LOCK_TITLE, body: lastText(row.name, cap) };
  }
  return { title: failText(r), body: "" };
}

export function TeamScreen() {
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const list = useOpsTeam();
  const [open, setOpen] = useState<Open>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [addAlert, setAddAlert] = useState<string | null>(null);
  const [editAlert, setEditAlert] = useState<TeamLockText | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean } | null>(null);
  const pending = useRef<(() => Promise<void>) | null>(null);
  const sending = useRef(false);

  const relogin = list.data?.kind === "login";
  useEffect(() => {
    if (relogin) router.replace(`/ops/login?next=${encodeURIComponent(pathname)}`);
  }, [relogin, router, pathname]);

  const close = () => {
    setOpen(null);
    setAddAlert(null);
    setEditAlert(null);
  };
  const reread = () => qc.invalidateQueries({ queryKey: TEAM_KEY });

  /** 書く口を呼ぶ。取り直しが要れば 1 回だけ取り直してから同じ体でやり直す */
  const send = (job: () => Promise<Write>, done: (w: Write) => Promise<void> | void, retried = false) => {
    const run = async () => {
      const w = await job();
      if (!w.ok && w.err.kind === "step_up" && !retried) {
        pending.current = () => send(job, done, true);
        setStepUp(await stepUpShape());
        return;
      }
      if (!w.ok && w.err.status === 401) {
        router.replace(`/ops/login?next=${encodeURIComponent(pathname)}`);
        return;
      }
      await done(w);
    };
    return guarded(run);
  };
  const guarded = async (run: () => Promise<void>) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await run();
    } catch {
      setStatus(textOf(PAGE_ERROR.offline)); // 網が切れた（口に届かない）
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const asWrite = async (p: Promise<{ ok: true; meta: Record<string, unknown> } | CallErr>): Promise<Write> => {
    const r = await p;
    return r.ok ? { ok: true, meta: r.meta } : { ok: false, err: r };
  };

  if (list.isPending || relogin) return null;
  const res = list.data;
  if (res?.kind === "forbidden")
    return (
      <PageBody labelledBy="op-team-title">
        <PageHeader id="op-team-title" title="運営の人" sub={FALLBACKS.forbidden.title} />
        <NoAccess />
      </PageBody>
    );
  if (res?.kind !== "ok")
    return (
      <Frame>
        <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => void list.refetch()]} />
      </Frame>
    );

  const rows = res.rows;
  const byId = (id: string) => rows.find((r) => r.member_id === id);
  const editing = open?.kind === "edit" ? byId(open.id) : undefined;
  const removing = open?.kind === "remove" ? byId(open.id) : undefined;
  const hidden = stepUp !== null; // 取り直しの間は小窓を閉じて値を持つ

  const onAdd = (v: { email: string; caps: boolean[] }) => {
    setAddAlert(null);
    const body = { email: v.email, caps: capsOfFlags(v.caps) };
    void send(
      () => asWrite(addMember(body)),
      async (w) => {
        if (!w.ok) return setAddAlert(failText(w.err));
        close();
        setStatus(w.meta["mail_sent"] === false ? MAIL_FAILED : `${body.email} に招待を送りました`);
        await reread();
      },
    );
  };
  const onSave = (row: OpsMemberRow) => (flags: boolean[]) => {
    setEditAlert(null);
    const caps = capsOfFlags(flags);
    void send(
      () => asWrite(updateCaps(row.member_id, caps)),
      async (w) => {
        if (!w.ok) return setEditAlert(editRefusal(w.err, row));
        close();
        await reread();
      },
    );
  };
  const onRemove = (row: OpsMemberRow) => () =>
    void send(
      () => asWrite(removeMember(row.member_id)),
      async (w) => {
        close();
        if (!w.ok) return setStatus(failText(w.err));
        await reread();
      },
    );

  return (
    <>
      <TeamPage
        rows={rows.map((r) => ({ ...teamRowView(r), id: r.member_id, sub: subOf(r) }))}
        status={status}
        onAdd={() => {
          setStatus(null);
          setOpen({ kind: "add" });
        }}
        onEdit={(id) => setOpen({ kind: "edit", id })}
        onRemove={(id) => setOpen({ kind: "remove", id })}
        rowLock={(id) => {
          const r = byId(id);
          return r ? removeLockOf(r) : null;
        }}
      />
      {open?.kind === "add" ? (
        <TeamAddDialog open={!hidden} busy={busy} alert={addAlert} onSend={onAdd} onClose={close} />
      ) : null}
      {editing ? (
        <TeamEditDialog
          key={editing.member_id}
          open={!hidden}
          person={`${editing.name} ・ ${teamRowView(editing).role}`}
          caps={capFlags(editing.caps)}
          locked={lockTextOf(editing)}
          alert={editAlert}
          busy={busy}
          onSave={onSave(editing)}
          onClose={close}
        />
      ) : null}
      {removing ? (
        <TeamRemoveConfirm
          open={!hidden}
          name={removing.name}
          busy={busy}
          onConfirm={onRemove(removing)}
          onClose={close}
        />
      ) : null}
      <StepUp
        open={stepUp !== null}
        reason={STEP_UP_REASON}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        screenId="ops-team"
        onDone={() => {
          setStepUp(null);
          const again = pending.current;
          pending.current = null;
          if (again) void again();
        }}
        onCancel={() => {
          setStepUp(null);
          pending.current = null; // やめた：何も送らず、入れた値のまま小窓に戻す
        }}
      />
    </>
  );
}
