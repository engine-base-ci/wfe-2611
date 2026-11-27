"use client";
// メンバーの 1 人の画面の小窓の登録口（K-819）。操作（グループを移す・兼ねる・止める・戻す・外す）の小窓は後の葉が 1 行ずつ足す。
//   登録の無い操作のボタンは押せない形（disabledActions）。?do=<キー> で開いた直後に、そのキーの小窓があれば開き、URL から do を消す。
//   K819-UI-018 が登録の有無を字で読む（行の頭が 2 字下げの「キー:」）ので、DO_DIALOGS の中はこの形を守る
//   K-821：止める・戻す（SuspendBox・ResumeBox）。確かめ → 口（use-member-state.ts）→ 成功で詳細とメンバーの並びを読み直して知らせ・失敗は上の赤い箱
//   K-822：外す（RemoveBox）。下見 → 小窓か上の赤い箱 → 外す（use-member-remove.ts）→ 知らせて /members へ
import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, type ComponentType, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Callout, PAGE_ERROR, errorCodeOf, useNotify } from "@/components/k";
import type { CallErr } from "@/lib/api/call";
import { StepUp } from "@/features/F1/security/step-up";
import { MEMBERS_KEY } from "@/features/F10/invite/use-members";
import { RemoveDialog } from "./dialog-remove";
import { ResumeConfirm, SuspendConfirm } from "./dialogs-confirm";
import type { MemberAnswer } from "./member-shape";
import { reloadMember } from "./use-member";
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
    router.replace(q ? `${path}?${q}` : path, { scroll: false });
  }, [sp, router, path, open]);
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
