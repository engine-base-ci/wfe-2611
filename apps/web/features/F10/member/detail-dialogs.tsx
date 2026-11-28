"use client";
// メンバーの 1 人の画面の小窓の登録口（K-819）。操作（グループを移す・兼ねる・止める・戻す・外す）の小窓は後の葉が 1 行ずつ足す。
//   登録の無い操作のボタンは押せない形（disabledActions）。?do=<キー> で開いた直後に、そのキーの小窓があれば開き、URL から do を消す。
//   K819-UI-018 が登録の有無を字で読む（行の頭が 2 字下げの「キー:」）ので、DO_DIALOGS の中はこの形を守る
//   K-821：止める・戻す（SuspendBox・ResumeBox）。確かめ → 口（use-member-state.ts）→ 成功で詳細とメンバーの並びを読み直して知らせ・失敗は上の赤い箱
//   K-822：外す（RemoveBox）。下見 → 小窓か上の赤い箱 → 外す（use-member-remove.ts）→ 知らせて /members へ
//   K-820：グループを移す（MoveDialogBox）・兼ねるグループを足す外す（AlsoDialogBox）。口と取り直しと失敗の出し分けは use-member-groups.ts。
//   成功は答えの groups で詳細の区画を差し替え（setQueryData）、並びの鍵に読み直しの印を付ける。もう居ないは閉じてから詳細を読み直す
import type { Route } from "next";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Callout, PAGE_ERROR, errorCodeOf, useNotify } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import { StepUp } from "@/features/F1/security/step-up";
import { MEMBERS_KEY } from "@/features/F10/invite/use-members";
import { RemoveDialog } from "./dialog-remove";
import { ResumeConfirm, SuspendConfirm } from "./dialogs-confirm";
import { AlsoDialog, MoveDialog } from "./dialogs-group";
import type { MemberAnswer } from "./member-shape";
import { memberKey, reloadMember } from "./use-member";
import { useMemberGroups, type MemberGroupRef } from "./use-member-groups";
import { useMemberRemove, type PageNotice } from "./use-member-remove";
import { useMemberState, type StateKind, type StateResult } from "./use-member-state";
import type { Action } from "./views";

export interface DoDialogProps {
  /** 開いている人の id */
  id: string;
  /** 口 getMember の答え */
  answer: MemberAnswer;
  /** 小窓を閉じる */
  onClose: () => void;
  /** 本文の上の赤い箱（Callout など）を出す・消す */
  onNotice: (n: ReactNode | null) => void;
}

export const DO_DIALOGS: Partial<Record<Action, ComponentType<DoDialogProps>>> = {
  // K-820 が move・also、K-821 が suspend・resume、K-822 が remove を「2 字下げの キー: 部品,」の 1 行で足す
  move: MoveDialogBox,
  also: AlsoDialogBox,
  suspend: SuspendBox,
  resume: ResumeBox,
  remove: RemoveBox,
};

const ACTIONS: readonly Action[] = ["move", "also", "suspend", "resume", "remove"];
const isAction = (v: string): v is Action => (ACTIONS as readonly string[]).includes(v);

/** そのキーの小窓が登録されているか */
export const openable = (a: Action): boolean => DO_DIALOGS[a] !== undefined;
/** 登録の無い操作（押せない形にする物） */
export const unregistered = (): Action[] => ACTIONS.filter((a) => !openable(a));

/** ?do=<キー> を 1 回だけ読んで消す。登録のあるキーなら open を呼ぶ（読み直しでは開き直さない） */
export function useDoParam(open: (a: Action) => void): void {
  const sp = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const seen = useRef(false);
  useEffect(() => {
    const raw = sp?.get("do");
    if (seen.current || !raw) return;
    seen.current = true;
    if (isAction(raw) && openable(raw)) open(raw);
    const rest = new URLSearchParams(sp.toString());
    rest.delete("do");
    const q = rest.toString();
    router.replace((q ? `${path}?${q}` : path) as Route, { scroll: false });
  }, [sp, router, path, open]);
}

const primaryOf = (groups: readonly MemberGroupRef[]) => groups.find((g) => g.primary);

/** 開いた直後に選びと失敗を初めに戻す（開き直すと書きかけは残らない） */
function useOnOpen(open: boolean, fn: () => void) {
  const was = useRef(false);
  const latest = useRef(fn);
  useEffect(() => {
    latest.current = fn;
  });
  useEffect(() => {
    if (open && !was.current) latest.current();
    was.current = open;
  }, [open]);
}

/** 書けた：答えの groups で詳細の区画を差し替え、詳細と並びの鍵には印だけ付ける（読み直すと差し替えた区画が前の答えに戻る） */
const groupsSetter = (qc: QueryClient, id: string) => (groups: MemberGroupRef[]) => {
  qc.setQueryData<MemberAnswer>(memberKey(id), (old) =>
    old
      ? { ...old, groups: groups.map((g) => ({ id: g.id, name: g.name, primary: g.primary, role: g.role ?? null })) }
      : old,
  );
  void qc.invalidateQueries({ queryKey: memberKey(id), refetchType: "none" });
  void qc.invalidateQueries({ queryKey: MEMBERS_KEY, refetchType: "none" });
};

/** もう居ない：小窓を閉じてから詳細を読み直す（→ 見つかりません） */
const goneOf = (qc: QueryClient, id: string, onClose: () => void) => () => {
  onClose();
  void reloadMember(qc, id);
};

/** グループを移す（主の所属）。体は { primary_scope_id } だけ */
function MoveDialogBox({ id, answer, onClose }: DoDialogProps) {
  const notify = useNotify();
  const qc = useQueryClient();
  const name = answer.member.name;
  const groups: readonly MemberGroupRef[] = answer.groups;
  const open = true; // 登録口（K-819）は開いている間だけ小窓を描く
  const [to, setTo] = useState("");
  const g = useMemberGroups(id, { onChanged: groupsSetter(qc, id), onGone: goneOf(qc, id, onClose) });
  const { reset } = g;
  const from = primaryOf(groups);
  const options = (g.choices ?? []).filter((c) => c.id !== from?.id).map((c) => ({ value: c.id, label: c.name }));
  const value = options.some((o) => o.value === to) ? to : (options[0]?.value ?? "");
  useOnOpen(open, () => {
    setTo("");
    reset();
  });
  const submit = async () => {
    if (!value) return;
    const label = options.find((o) => o.value === value)?.label ?? "";
    const done = await g.send({ primary_scope_id: value });
    if (done) finish(label);
  };
  const finish = (label: string) => {
    onClose();
    notify(`${name} を ${label} に移しました`);
  };
  return (
    <>
      <MoveDialog
        open={open && g.stepUp === null}
        name={name}
        from={from?.name ?? ""}
        to={value}
        groups={options}
        loading={g.choices === null}
        onChange={setTo}
        onSubmit={() => void submit()}
        onCancel={onClose}
        busy={g.busy}
        error={g.error}
        submitDisabled={!value}
      />
      <StepUp
        open={open && g.stepUp !== null}
        reason="グループを移す前に、本人か確かめます"
        withCode={g.stepUp?.withCode ?? false}
        withPasskey={g.stepUp?.withPasskey ?? false}
        screenId="member-detail"
        onDone={() =>
          void g.retry().then((done) => {
            if (done) finish(options.find((o) => o.value === value)?.label ?? "");
          })
        }
        onCancel={g.cancelStepUp}
      />
    </>
  );
}

/** 兼ねるグループを足す・外す。体は足す分 add_scope_ids・外す分 remove_scope_ids（role_key は送らない） */
function AlsoDialogBox({ id, answer, onClose }: DoDialogProps) {
  const notify = useNotify();
  const qc = useQueryClient();
  const name = answer.member.name;
  const groups: readonly MemberGroupRef[] = answer.groups;
  const open = true; // 登録口（K-819）は開いている間だけ小窓を描く
  const [add, setAdd] = useState("");
  const [removed, setRemoved] = useState<string[]>([]);
  const g = useMemberGroups(id, { onChanged: groupsSetter(qc, id), onGone: goneOf(qc, id, onClose) });
  const { reset } = g;
  const also = groups.filter((x) => !x.primary).map((x) => ({ value: x.id, label: x.name }));
  const taken = new Set(groups.map((x) => x.id));
  const addable = (g.choices ?? []).filter((c) => !taken.has(c.id)).map((c) => ({ value: c.id, label: c.name }));
  const adding = addable.some((o) => o.value === add) ? add : "";
  const body = {
    ...(adding ? { add_scope_ids: [adding] } : {}),
    ...(removed.length ? { remove_scope_ids: [...removed] } : {}),
  };
  const changed = Object.keys(body).length > 0;
  useOnOpen(open, () => {
    setAdd("");
    setRemoved([]);
    reset();
  });
  const finish = () => {
    onClose();
    notify(`${name} の兼ねるグループを直しました`);
  };
  const submit = async () => {
    if (!changed) return;
    if (await g.send(body)) finish();
  };
  return (
    <>
      <AlsoDialog
        open={open && g.stepUp === null}
        name={name}
        also={also}
        add={adding}
        addable={addable}
        removed={removed}
        loading={g.choices === null}
        onChange={setAdd}
        onRemove={(v) => setRemoved((r) => (r.includes(v) ? r : [...r, v]))}
        onSubmit={() => void submit()}
        onCancel={onClose}
        busy={g.busy}
        error={g.error}
        submitDisabled={!changed}
      />
      <StepUp
        open={open && g.stepUp !== null}
        reason="兼ねるグループを直す前に、本人か確かめます"
        withCode={g.stepUp?.withCode ?? false}
        withPasskey={g.stepUp?.withPasskey ?? false}
        screenId="member-detail"
        onDone={() =>
          void g.retry().then((done) => {
            if (done) finish();
          })
        }
        onCancel={g.cancelStepUp}
      />
    </>
  );
}

// ---------------------------------------------------------------- 止める・戻す（K-821）
const msgOf = (code: string): string => CATALOG[code]?.message ?? "";
/** 詳細を読み直してから赤い箱を出す断り方（もう止まっている・もう戻っている・もう居ない） */
const RELOAD = ["E-MEM-009", "E-MEM-010", "E-MEM-002"];

const TEXT: Record<StateKind, { done: string; stepUp: string }> = {
  suspend: { done: "を一時的に止めました", stepUp: "を一時的に止める前に、本人か確かめます" },
  resume: { done: "を戻しました", stepUp: "を戻す前に、本人か確かめます" },
};

function noticeOf(name: string, e: CallErr | null): ReactNode {
  if (!e) return <Callout tone="danger">{msgOf(PAGE_ERROR.offline)}</Callout>;
  // 最後の管理者（止めるときだけ断られる・字は下絵 md-remove-last-admin と同じ言い方・仮）
  if (e.code === "E-MEM-004")
    return (
      <Callout tone="danger" title="止められません">
        {`${name}は、いまの管理者の最後の 1 人です。先にほかの人を管理者にしてから、止めてください`}
      </Callout>
    );
  const text =
    e.status === 401 ? msgOf(PAGE_ERROR.sessionExpired) : msgOf(e.code) || e.message || msgOf(errorCodeOf(e));
  const info = e.code === "E-MEM-009" || e.code === "E-MEM-010";
  return <Callout tone={info ? "info" : "danger"}>{text}</Callout>;
}

function StateBox({ kind, id, answer, onClose, onNotice }: DoDialogProps & { kind: StateKind }) {
  const qc = useQueryClient();
  const notify = useNotify();
  const name = answer.member.name;
  const self = kind === "suspend" && answer.member.self;
  const onResult = (r: StateResult) => {
    onClose();
    void qc.invalidateQueries({ queryKey: MEMBERS_KEY });
    if (r.ok) {
      notify(`${name} ${TEXT[kind].done}`);
      void reloadMember(qc, id);
      return;
    }
    onNotice(noticeOf(name, r.error));
    if (r.error && RELOAD.includes(r.error.code)) void reloadMember(qc, id);
  };
  const s = useMemberState(id, kind, onResult);
  // 自分は止められない（?do=suspend で来ても開かない）
  useEffect(() => {
    if (self) onClose();
  }, [self, onClose]);
  if (self) return null;
  const Box = kind === "suspend" ? SuspendConfirm : ResumeConfirm;
  return (
    <>
      {s.stepUp ? null : (
        <Box
          name={name}
          busy={s.busy}
          onConfirm={() => {
            onNotice(null);
            s.confirm();
          }}
          onCancel={onClose}
        />
      )}
      <StepUp
        open={s.stepUp !== null}
        reason={`${name} ${TEXT[kind].stepUp}`}
        withCode={s.stepUp?.withCode ?? false}
        withPasskey={s.stepUp?.withPasskey ?? false}
        onDone={s.stepUpDone}
        onCancel={s.stepUpCancel}
      />
    </>
  );
}

function SuspendBox(p: DoDialogProps) {
  return <StateBox {...p} kind="suspend" />;
}
function ResumeBox(p: DoDialogProps) {
  return <StateBox {...p} kind="resume" />;
}

// ---------------------------------------------------------------- 外す（K-822）
const calloutOf = (n: PageNotice): ReactNode => (
  <Callout tone="danger" {...(n.title ? { title: n.title } : {})}>
    {n.text}
  </Callout>
);

/** ワークスペースから外す：下見 → 小窓か上の赤い箱 → 外す（取り直しは StepUp で 1 回だけ送り直す）→ 知らせて /members へ。
 *  自分（answer.member.self）なら下見も呼ばずに閉じる（?do=remove でも開かない・ボタンは入れ物が disabledActions で押せない形にする） */
function RemoveBox({ id, answer, onClose, onNotice }: DoDialogProps) {
  const self = Boolean(answer.member.self);
  useEffect(() => {
    if (self) onClose();
  }, [self, onClose]);
  if (self) return null;
  return <RemoveFlow id={id} name={answer.member.name} onClose={onClose} onNotice={onNotice} />;
}

function RemoveFlow({
  id,
  name,
  onClose,
  onNotice,
}: Pick<DoDialogProps, "id" | "onClose" | "onNotice"> & { name: string }) {
  const router = useRouter();
  const notify = useNotify();
  const qc = useQueryClient();
  const r = useMemberRemove({
    memberId: id,
    memberName: name,
    onClose,
    onNotice: (n) => onNotice(n ? calloutOf(n) : null),
    onRemoved: (text) => {
      onClose();
      notify(text);
      void qc.invalidateQueries({ queryKey: ["k819", "member", id] });
      router.push("/members");
    },
  });
  return (
    <>
      {r.ready ? <RemoveDialog {...r.dialog} open={r.stepUp === null} /> : null}
      <StepUp
        open={r.stepUp !== null}
        reason={r.reason}
        withCode={r.stepUp?.withCode ?? false}
        withPasskey={r.stepUp?.withPasskey ?? false}
        screenId="member-detail"
        onDone={r.onStepUpDone}
        onCancel={r.onStepUpCancel}
      />
    </>
  );
}
