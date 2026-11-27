"use client";
// ログインと安全（K-318・画面 mfa-setup・道 /mfa-setup）。外枠（TicketShell）の中に、自分の設定の第 2 ナビ（MeSub・「ログインと安全」）と本文。
//   見た目はモック /dev/mock/f1/sec-* と同じ部品（views.tsx）。動き：getMySecurity を 1 回読む → 一覧。パスキーを足す・名前を変える・外す。
//   口が 403・STEP_UP_REQUIRED なら取り直しの小窓（step-up.tsx）を出し、通ったら止まった操作を 1 回だけやり直す。
//   2 段階の「付ける」（two-factor.tsx）とパスワードの「変える／決める」（change-password.tsx）は K-319。入っている端末・記録は流れ F10（グレー・口を呼ばない）。
//   mfa_pending（付けるまで進めない・K-319・D-128.141）：外枠も第 2 ナビも出さず、入口の枠の SecurityForced。付け終わって読み直した印が下りたら next（中の道だけ）か / へ。
//   ?back=1（ほかの画面から戻された・lib/mfa-gate.ts）なら戻された知らせ（口の文・無ければ決まった文）。箱の下のログアウトは signOut を 1 回呼んで /login へ
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ErrorState, Loading, MeSub, useNotify } from "@/components/k";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr, type CallResult } from "@/lib/api/call";
import { getToken } from "@/lib/api/client";
import { signOut } from "@/lib/auth";
import { clearMfaReason, mfaReason } from "@/lib/mfa-gate";
import { TicketShell } from "@/features/F4/create-ticket/ticket-shell";
import { usePasswordFlow } from "./change-password";
import { hereNow, msgOf, offline, SCREEN } from "./common";
import { safeNext } from "./next";
import { addPasskey, defaultPasskeyName, NETWORK_FAIL, passkeyFailText } from "./passkey";
import { StepUp } from "./step-up";
import { removeBlockOf, passkeyRows, toState, type MySecurityAnswer } from "./to-state";
import { useTwoFactor } from "./two-factor";
import {
  AddPasskeyDialog,
  PASSKEY_NAME_MAX,
  RemovePasskeyConfirm,
  RenamePasskeyDialog,
  SecurityBody,
  SecurityForced,
  SecurityHead,
} from "./views";

const expired = (): string => msgOf(PAGE_ERROR.sessionExpired);
/** 戻された知らせ（口の文が無いとき。文の番号は K-321 が正本に足す） */
const BACK_TEXT = "入り方を 1 つ足してから使い始めます";
const backNotice = (): string => mfaReason() || BACK_TEXT;
/** 書く口の失敗の文（401 はログイン切れ・欄の理由・口の文・正本の文） */
function writeFailText(r: CallErr, field?: string): string {
  if (r.status === 401) return expired();
  if (field && r.fields[field]) return r.fields[field]!;
  return r.message ?? msgOf(errorCodeOf(r));
}

type Pending = { kind: "add"; name: string } | { kind: "remove"; id: string; name: string };
const REASON: Record<Pending["kind"], string> = {
  add: "パスキーを足す前に、本人か確かめます",
  remove: "パスキーを外す前に、本人か確かめます",
};

function useSecurity() {
  const [sec, setSec] = useState<MySecurityAnswer | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const r = await call("getMySecurity", { screenId: SCREEN });
      if (r.ok) setSec(r.data as MySecurityAnswer);
      else setLoadErr(r.kind === "unauthenticated" ? PAGE_ERROR.sessionExpired : errorCodeOf(r));
    } catch {
      setLoadErr(NETWORK_FAIL); // 網が切れた（口に届かない）
    }
  }, []);
  return { sec, loadErr, load, setSec };
}

export function SecurityScreen({ add, next }: { add: boolean; next: string | null }) {
  const [ready, setReady] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const { sec, loadErr, load, setSec } = useSecurity();
  const started = useRef(false);
  const autoAdd = useRef(add);

  // 足す
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addErr, setAddErr] = useState<string | null>(null);
  const [addBusy, setAddBusy] = useState(false);
  // 名前を変える
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameErr, setRenameErr] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  // 外す
  const [removeId, setRemoveId] = useState<string | null>(null);
  /** 外すパスキーの名前（開いた時点の名前を持つ。別のタブで先に外され読み直しで行が消えても字が空にならない） */
  const [removeName, setRemoveName] = useState("");
  const [removeErr, setRemoveErr] = useState<string | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  // 取り直し
  const [pending, setPending] = useState<Pending | null>(null);
  const sending = useRef(false);
  // 付けるまで進めない
  const [back, setBack] = useState(false);
  const forcedSeen = useRef(false);
  const leaving = useRef(false);
  const notify = useNotify();
  const notifyText = (text: string, stay = false) => void notify(text, stay ? { type: "error" } : {});
  const password = usePasswordFlow({
    hasPassword: sec?.has_password === true,
    twoFactor: sec?.two_factor === true,
    reload: load,
    notify: notifyText,
  });
  const twoFactor = useTwoFactor({
    hasPassword: sec?.has_password === true,
    reload: load,
    notify: notifyText,
    askSetPassword: password.openSet,
    onFinished: ({ noCodes }) => {
      // コードが来なかったときは、付けるまで進めないから自動で移らず、一覧と知らせ（作り直しが要る）を見せる
      if (noCodes) forcedSeen.current = false;
      void load();
    },
  });

  // ログインしていなければ、問いを付けたままログインへ（口は呼ばない）
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!getToken()) {
      window.location.replace(`/login?next=${encodeURIComponent(hereNow())}`);
      return;
    }
    setUnsupported(typeof window.PublicKeyCredential !== "function");
    setBack(new URLSearchParams(window.location.search).get("back") === "1");
    setReady(true);
    void load();
  }, [load]);

  const openAdd = useCallback(() => {
    setAddName(defaultPasskeyName().slice(0, PASSKEY_NAME_MAX));
    setAddErr(null);
    setAddOpen(true);
  }, []);
  // ?add=passkey：開いた直後に 1 回だけ足す小窓を開く（ログインの「この PC にも」から・K-317）
  useEffect(() => {
    if (!sec || !autoAdd.current || unsupported) return;
    autoAdd.current = false;
    openAdd();
  }, [sec, unsupported, openAdd]);

  // 付けるまで進めない人が付け終わった（読み直した印が下りた）：next（中の道だけ）か / へ
  useEffect(() => {
    if (!sec) return;
    if (sec.mfa_pending === true) {
      forcedSeen.current = true;
      return;
    }
    if (!forcedSeen.current || leaving.current) return;
    leaving.current = true;
    clearMfaReason();
    window.location.assign(safeNext(next) ?? "/");
  }, [sec, next]);
  const leave = async () => {
    if (leaving.current) return;
    leaving.current = true;
    await signOut();
    window.location.assign("/login");
  };

  const afterAdd = () => {
    const to = safeNext(next);
    if (to) window.location.assign(to);
    else void load();
  };
  const runAdd = async (name: string, retried: boolean) => {
    const r = await addPasskey(name);
    if (r.ok) {
      setAddOpen(false);
      return afterAdd();
    }
    if (r.kind === "step_up" && !retried) {
      setAddOpen(false);
      return setPending({ kind: "add", name });
    }
    setAddErr(passkeyFailText(r, expired()));
    setAddOpen(true);
  };
  const submitAdd = async () => {
    const name = addName.trim();
    if (sending.current || !name) return;
    sending.current = true;
    setAddBusy(true);
    setAddErr(null);
    try {
      await runAdd(name, false);
    } finally {
      sending.current = false;
      setAddBusy(false);
    }
  };

  const openRename = (id: string) => {
    const row = sec ? passkeyRows(sec).find((k) => k.id === id) : undefined;
    setRenameValue(row?.name ?? "");
    setRenameErr(null);
    setRenameId(id);
  };
  const submitRename = async () => {
    const name = renameValue.trim();
    if (sending.current || !renameId || !name) return;
    sending.current = true;
    setRenameBusy(true);
    setRenameErr(null);
    try {
      const r = await call("renamePasskey", {
        params: { id: renameId },
        body: { name },
        screenId: SCREEN,
        keepOn401: true,
      });
      if (!r.ok) return setRenameErr(writeFailText(r, "name"));
      setRenameId(null);
      void load();
    } catch {
      setRenameErr(offline()); // 書いた値は残す
    } finally {
      sending.current = false;
      setRenameBusy(false);
    }
  };

  const openRemove = (id: string) => {
    const row = sec ? passkeyRows(sec).find((k) => k.id === id) : undefined;
    setRemoveName(row?.name ?? "");
    setRemoveErr(null);
    setRemoveId(id);
  };
  const runRemove = async (id: string, name: string, retried: boolean) => {
    let r: CallResult<"deletePasskey">;
    try {
      r = await call("deletePasskey", { params: { id }, screenId: SCREEN, keepOn401: true });
    } catch {
      setRemoveName(name);
      setRemoveId(id);
      return setRemoveErr(offline());
    }
    if (r.ok) {
      setRemoveId(null);
      return void load();
    }
    if (r.kind === "step_up" && !retried) {
      setRemoveId(null);
      return setPending({ kind: "remove", id, name });
    }
    setRemoveName(name);
    setRemoveId(id);
    setRemoveErr(writeFailText(r));
    if (r.kind === "conflict") void load(); // 別のタブで先に外した等：一覧を読み直す
  };
  const submitRemove = async () => {
    if (sending.current || !removeId) return;
    sending.current = true;
    setRemoveBusy(true);
    try {
      await runRemove(removeId, removeName, false);
    } finally {
      sending.current = false;
      setRemoveBusy(false);
    }
  };

  // 取り直しが通ったら、止まった操作を 1 回だけやり直す
  const resume = async (p: Pending) => {
    setPending(null);
    if (sending.current) return;
    sending.current = true;
    try {
      if (p.kind === "add") await runAdd(p.name, true);
      else await runRemove(p.id, p.name, true);
    } finally {
      sending.current = false;
    }
  };

  const frame = (body: ReactNode) => (
    <TicketShell screen={SCREEN} crumbs={[{ label: "自分の設定", disabled: true }, { label: "ログインと安全" }]}>
      <div className="k-me-wrap">
        <MeSub current="login" />
        <section className="k-page k-me-page" aria-labelledby="security-title">
          <SecurityHead />
          {body}
        </section>
      </div>
    </TicketShell>
  );

  if (!ready) return frame(<Loading />);
  if (loadErr)
    return frame(
      loadErr === PAGE_ERROR.sessionExpired ? (
        <ErrorState code={loadErr} acts={[`/login?next=${encodeURIComponent(hereNow())}`]} />
      ) : (
        <ErrorState
          code={loadErr}
          acts={[
            () => {
              setSec(null);
              void load();
            },
          ]}
        />
      ),
    );
  if (!sec) return frame(<Loading />);

  const state = toState(sec, new Date(), unsupported);
  const block = removeBlockOf(sec);
  const renameTarget = renameId ? state.passkeys.find((k) => k.id === renameId) : undefined;
  const forced = sec.mfa_pending === true;
  const dialogs = (
    <>
      {twoFactor.ui}
      {password.ui}
      <AddPasskeyDialog
        open={addOpen}
        value={addName}
        error={addErr}
        busy={addBusy}
        onValue={setAddName}
        onOpenChange={setAddOpen}
        onAdd={() => void submitAdd()}
      />
      <RenamePasskeyDialog
        open={renameId !== null}
        name={renameTarget?.name ?? ""}
        value={renameValue}
        error={renameErr}
        busy={renameBusy}
        onValue={setRenameValue}
        onOpenChange={(o) => {
          if (!o) setRenameId(null);
        }}
        onSubmit={() => void submitRename()}
      />
      <RemovePasskeyConfirm
        open={removeId !== null}
        name={removeName}
        blocked={removeErr ?? (block ? msgOf(block) : null)}
        busy={removeBusy}
        onOpenChange={(o) => {
          if (!o) setRemoveId(null);
        }}
        onConfirm={() => void submitRemove()}
      />
      <StepUp
        open={pending !== null}
        reason={pending ? REASON[pending.kind] : ""}
        withCode={state.twoFactor}
        withPasskey={!state.hasPassword}
        onDone={() => {
          if (pending) void resume(pending);
        }}
        onCancel={() => setPending(null)}
      />
    </>
  );
  if (forced)
    return (
      <>
        <SecurityForced
          passkeyUnsupported={unsupported}
          notice={back ? backNotice() : null}
          onPasskey={openAdd}
          onTwoFactor={twoFactor.start}
          onSignOut={() => void leave()}
        />
        {dialogs}
      </>
    );
  return frame(
    <>
      <SecurityBody
        {...state}
        onAddPasskey={openAdd}
        onRename={openRename}
        onRemove={openRemove}
        onPassword={password.open}
        onTwoFactor={twoFactor.start}
      />
      {dialogs}
    </>,
  );
}
