"use client";
// 上書きの小窓の動き（K-357・画面 credentials）。見た目は部品 EditCredentialDialog（views.tsx）、取り直しは段 2 の StepUp（F1/security・K-318）で、預ける小窓（add-credential.tsx・K-372）と同じ組み方。
//   「本人確認して上書き」→ 体を作って updateCredential を 1 回（送っている間は待ちの形・二度押しで 2 回呼ばない）。
//   200 → 小窓を閉じ、入れ物が一覧を読み直す。422 → 欄ごとの文。409（ほかが先に替えた）→ 小窓の赤の知らせ。404（もう消えている）→ 閉じて口の文の知らせ・読み直す。
//   403 STEP_UP_REQUIRED（1 回目）→ 小窓を閉じ getMySecurity を 1 回読み、取り直し。通ったら同じ体で 1 回だけやり直す。やめたら値のまま小窓に戻す。
//   403 E-CRED-007（書けない）は 1 回目でも取り直しを開かない。やり直しの失敗も 1 回目と同じ出し方（値は残す）。
//   401 → E-PAGE-005 の文・網の切れ → E-PAGE-008 の文（どちらも小窓の中・値は残す）
import { useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { StepUp } from "@/features/F1/security/step-up";
import { editErrorsOf, editValuesOf, toUpdateBody, type UpdateCredentialBody } from "./edit-form";
import type { CredentialRow } from "./to-item";
import { EditCredentialDialog, type EditCredentialErrors, type EditCredentialValues } from "./views";

const SCREEN = "credentials";
const STEP_UP_REASON = "ログイン情報を上書きする前に、本人か確かめます";
const textOf = (code: string): string => CATALOG[code]?.message ?? "";
const EMPTY: EditCredentialValues = {
  login: "",
  password: "",
  value: "",
  destinations: "",
  expires_on: "",
  reason: "",
};

export interface EditCredentialDeps {
  /** 上書けた・もう消えていた（入れ物が一覧を読み直す） */
  onChanged: () => Promise<void>;
  /** 小窓の外に出す知らせ（もう消えていた） */
  notifyError: (text: string) => void;
}
export interface EditCredentialFlow {
  open: (it: CredentialRow) => void;
  ui: ReactNode;
}

/** 失敗の答え → 小窓の欄の文か赤の知らせ */
function failureOf(r: CallErr): { errors: EditCredentialErrors; alert: string | null } {
  const text = r.message ?? textOf(errorCodeOf(r));
  if (r.status === 401) return { errors: {}, alert: textOf(PAGE_ERROR.sessionExpired) };
  if (r.kind === "invalid") {
    const errors = editErrorsOf(r.fields);
    return Object.keys(errors).length > 0 ? { errors, alert: null } : { errors: {}, alert: text };
  }
  return { errors: {}, alert: text };
}

export function useEditCredential(d: EditCredentialDeps): EditCredentialFlow {
  const [target, setTarget] = useState<CredentialRow | null>(null);
  const [shown, setShown] = useState(false);
  const [values, setValues] = useState<EditCredentialValues>(EMPTY);
  const [errors, setErrors] = useState<EditCredentialErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean } | null>(null);
  const pending = useRef<UpdateCredentialBody | null>(null);
  const sending = useRef(false);

  const close = () => {
    setShown(false);
    setValues(EMPTY); // 新しい値を残さない
    pending.current = null;
  };

  const showFailure = (r: CallErr) => {
    const f = failureOf(r);
    setErrors(f.errors);
    setAlert(f.alert);
    setShown(true);
  };

  const openStepUp = async () => {
    setShown(false); // 入れた値は持ったまま、取り直しの小窓へ
    const s = await call("getMySecurity", { screenId: SCREEN, keepOn401: true });
    const sec = s.ok ? s.data : {};
    setStepUp({ withCode: sec.two_factor === true, withPasskey: sec.has_password === false });
  };

  const run = async (id: string, body: UpdateCredentialBody, retried: boolean): Promise<void> => {
    const r = await call("updateCredential", { params: { id }, body, screenId: SCREEN, keepOn401: true });
    if (r.ok) {
      close();
      await d.onChanged();
      return;
    }
    if (r.kind === "step_up" && !retried) {
      pending.current = body;
      return openStepUp();
    }
    if (r.kind === "not_found") {
      close();
      d.notifyError(r.message ?? textOf(errorCodeOf(r)));
      await d.onChanged();
      return;
    }
    showFailure(r);
  };

  const guarded = async (job: () => Promise<void>) => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      await job();
    } catch {
      setErrors({});
      setAlert(textOf(PAGE_ERROR.offline)); // 網が切れた（口に届かない）：入れた値は残す
      setShown(true);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const submit = () => {
    if (sending.current || !target) return;
    setErrors({});
    setAlert(null);
    const body = toUpdateBody(target.kind, values);
    void guarded(() => run(target.id, body, false));
  };

  const ui = (
    <>
      {target ? (
        <EditCredentialDialog
          open={shown}
          item={target}
          values={values}
          errors={errors}
          error={alert}
          busy={busy}
          onValue={(patch) => setValues((v) => ({ ...v, ...patch }))}
          onSubmit={submit}
          onOpenChange={(o) => {
            if (!o) close(); // やめる・Esc：何も送らない（次に開くと今の値）
          }}
        />
      ) : null}
      <StepUp
        open={stepUp !== null}
        reason={STEP_UP_REASON}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        onDone={() => {
          setStepUp(null);
          const body = pending.current;
          if (body && target) void guarded(() => run(target.id, body, true));
        }}
        onCancel={() => {
          setStepUp(null);
          pending.current = null;
          setShown(true); // やめた：入れた値のまま小窓に戻す
        }}
      />
    </>
  );

  return {
    open: (it) => {
      setTarget(it);
      setValues(editValuesOf(it));
      setErrors({});
      setAlert(null);
      setShown(true);
    },
    ui,
  };
}
