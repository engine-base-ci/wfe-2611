"use client";
// パスワードを変える・決める（K-319・D-128.141・D-087・answer=9177d9dbe0d9 ②）。
//   変える：今のパスワードと新しいパスワード 2 回 → changePassword を 1 回。今の画面は残り、ほかの端末と PC は口（K-312）が切る。
//   決める：パスワードの無い人（パスキーだけ）が新しいパスワード 2 回 → setMyPassword を 1 回。決め終わったら読み直し、2 段階の「付ける」から来たときは続ける。
//   新しいパスワードは 12 文字以上・2 つが同じかは画面で止める（口を呼ばない）。漏れたパスワードの照合は口。
//   403・STEP_UP_REQUIRED は取り直しの小窓（step-up.tsx。パスキーだけの人はパスキーで）の後に 1 回だけ送り直す
import { useRef, useState, type ReactNode } from "react";
import { call, type CallErr } from "@/lib/api/call";
import { msgOf, offline, SCREEN, toLogin } from "./common";
import { StepUp } from "./step-up";
import { ChangePasswordDialog, type PasswordErrors, type PasswordValues } from "./views";

const MIN_LENGTH = 12;
const TOO_SHORT = "E-VAL-005";
const NOT_SAME = "2 つのパスワードが違います";
const CHANGED = "パスワードを変えました。ほかの端末と PC は入り直しになります";
const REASON = {
  change: "パスワードを変える前に、本人か確かめます",
  set: "パスワードを決める前に、本人か確かめます",
} as const;
const EMPTY: PasswordValues = { current: "", next: "", again: "" };

type Mode = keyof typeof REASON;
export interface PasswordFlow {
  /** 「変える」（パスワードのある人）・「決める」（無い人） */
  open: () => void;
  /** 決める小窓を開く（notice は小窓に出す文）。決め終わったら then（2 段階の「付ける」から） */
  openSet: (notice: string | null, then: () => void) => void;
  ui: ReactNode;
}
export interface PasswordDeps {
  hasPassword: boolean;
  twoFactor: boolean;
  reload: () => Promise<void>;
  notify: (text: string) => void;
}

/** 画面で止める入力の誤り（無ければ null） */
export function checkNewPassword(v: PasswordValues): PasswordErrors | null {
  if ([...v.next].length < MIN_LENGTH) return { next: msgOf(TOO_SHORT) };
  if (v.next !== v.again) return { again: NOT_SAME };
  return null;
}
/** 口の 422 の欄の理由 → 小窓の欄 */
const fieldErrors = (r: CallErr): PasswordErrors | null => {
  const e: PasswordErrors = {};
  if (r.fields["current_password"]) e.current = r.fields["current_password"];
  if (r.fields["new_password"]) e.next = r.fields["new_password"];
  return e.current || e.next ? e : null;
};

export function usePasswordFlow(d: PasswordDeps): PasswordFlow {
  const [mode, setMode] = useState<Mode | null>(null);
  const [shown, setShown] = useState(false);
  const [values, setValues] = useState<PasswordValues>(EMPTY);
  const [errors, setErrors] = useState<PasswordErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState(false);
  const then = useRef<(() => void) | null>(null);
  const sending = useRef(false);

  const begin = (m: Mode, n: string | null, next: (() => void) | null) => {
    then.current = next;
    setMode(m);
    setValues(EMPTY);
    setErrors({});
    setNotice(n);
    setShown(true);
  };
  const close = () => {
    setShown(false);
    setMode(null);
    then.current = null;
  };

  const run = async (m: Mode, v: PasswordValues, retried: boolean): Promise<void> => {
    const r =
      m === "change"
        ? await call("changePassword", {
            body: { current_password: v.current, new_password: v.next },
            screenId: SCREEN,
            keepOn401: true,
          })
        : await call("setMyPassword", { body: { new_password: v.next }, screenId: SCREEN, keepOn401: true });
    if (r.ok) {
      const after = then.current;
      close();
      if (m === "change") return d.notify(CHANGED);
      await d.reload();
      return after?.();
    }
    if (r.status === 401) return toLogin();
    if (r.kind === "step_up" && !retried) {
      setShown(false); // 書いた値は持ったまま、取り直しの小窓へ
      return setStepUp(true);
    }
    if (r.status === 409) {
      close(); // 別のタブで先に決めた（CONFLICT）
      d.notify(r.message ?? msgOf(r.code));
      return void d.reload();
    }
    setShown(true);
    const fe = fieldErrors(r);
    if (fe) return setErrors(fe);
    setNotice(r.message ?? msgOf(r.code));
  };
  const guarded = async (job: () => Promise<void>) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await job();
    } catch {
      setShown(true);
      setNotice(offline()); // 網が切れた：書いた値は残す
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const submit = () => {
    if (!mode || sending.current) return;
    setNotice(null);
    const bad = checkNewPassword(values);
    if (bad) return setErrors(bad);
    setErrors({});
    void guarded(() => run(mode, values, false));
  };

  const ui = (
    <>
      <ChangePasswordDialog
        open={shown}
        hasPassword={mode !== "set"}
        values={values}
        errors={errors}
        notice={notice}
        busy={busy}
        onValues={setValues}
        onOpenChange={(o) => {
          if (!o) close();
        }}
        onSubmit={submit}
      />
      <StepUp
        open={stepUp}
        reason={mode ? REASON[mode] : ""}
        withCode={d.twoFactor}
        withPasskey={mode === "set"}
        onDone={() => {
          setStepUp(false);
          if (mode) void guarded(() => run(mode, values, true));
        }}
        onCancel={() => {
          setStepUp(false);
          setShown(true); // やめた：書いた値のまま小窓に戻す
        }}
      />
    </>
  );
  return {
    open: () => begin(d.hasPassword ? "change" : "set", null, null),
    openSet: (n, next) => begin("set", n, next),
    ui,
  };
}
