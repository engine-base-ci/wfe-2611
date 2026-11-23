"use client";
// 預ける小窓の動き（K-372・画面 credentials）。見た目は部品 AddCredentialDialog（views.tsx）、取り直しは段 2 の StepUp（F1/security・K-318）。
//   「本人確認して保存」→ 体を作って createCredential を 1 回（送っている間は待ちの形・二度押しで 2 回呼ばない）。
//   201 → 小窓を閉じ、入れ物が一覧を読み直す（onCreated）。422 → 欄ごとの文・409 → 名前の欄の下に口の文・
//   403 STEP_UP_REQUIRED（1 回目）→ 小窓を閉じ getMySecurity を 1 回読み、取り直し。通ったら同じ体で 1 回だけやり直す。やめたら値のまま小窓に戻す。
//   403 E-CRED-007 は 1 回目でも取り直しを開かない（赤の知らせ）。2 回目の 403・503・ほかの失敗 → 赤の知らせ（口の文・無ければ正本の文）。
//   401 → 小窓に E-PAGE-005 の文（道は移らない）・網の切れ → E-PAGE-008 の文。どの失敗でも入れた値は残す
import { useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import { StepUp } from "@/features/F1/security/step-up";
import { fieldErrorsOf, toCreateBody, type CreateCredentialBody } from "./add-form";
import { AddCredentialDialog, EMPTY_CREDENTIAL, type AddCredentialErrors, type AddCredentialValues } from "./views";

const SCREEN = "credentials";
const STEP_UP_REASON = "ログイン情報を預ける前に、本人か確かめます";
const textOf = (code: string): string => CATALOG[code]?.message ?? "";

export interface AddCredentialDeps {
  workspaceName: string;
  /** 預けられた（入れ物が一覧を読み直し、段を通す） */
  onCreated: (layer: AddCredentialValues["layer"]) => Promise<void>;
}
export interface AddCredentialFlow {
  open: () => void;
  ui: ReactNode;
}

/** 失敗の答え → 小窓の欄の文か赤の知らせ */
function failureOf(r: CallErr): { errors: AddCredentialErrors; alert: string | null } {
  const text = r.message ?? textOf(errorCodeOf(r));
  if (r.status === 401) return { errors: {}, alert: textOf(PAGE_ERROR.sessionExpired) };
  if (r.kind === "invalid") {
    const errors = fieldErrorsOf(r.fields);
    return Object.keys(errors).length > 0 ? { errors, alert: null } : { errors: {}, alert: text };
  }
  if (r.kind === "conflict") return { errors: { name: text }, alert: null };
  return { errors: {}, alert: text };
}

export function useAddCredential(d: AddCredentialDeps): AddCredentialFlow {
  const [shown, setShown] = useState(false);
  const [values, setValues] = useState<AddCredentialValues>(EMPTY_CREDENTIAL);
  const [errors, setErrors] = useState<AddCredentialErrors>({});
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stepUp, setStepUp] = useState<{ withCode: boolean; withPasskey: boolean } | null>(null);
  const pending = useRef<CreateCredentialBody | null>(null);
  const sending = useRef(false);

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

  const run = async (body: CreateCredentialBody, retried: boolean): Promise<void> => {
    const r = await call("createCredential", { body, screenId: SCREEN, keepOn401: true });
    if (r.ok) {
      setShown(false);
      pending.current = null;
      await d.onCreated(body.layer === "personal" ? "personal" : "workspace");
      return;
    }
    if (r.kind === "step_up" && !retried) {
      pending.current = body;
      return openStepUp();
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
    if (sending.current) return;
    setErrors({});
    setAlert(null);
    const body = toCreateBody(values);
    void guarded(() => run(body, false));
  };

  const ui = (
    <>
      <AddCredentialDialog
        open={shown}
        values={values}
        workspaceName={d.workspaceName}
        errors={errors}
        error={alert}
        busy={busy}
        onValue={(patch) => setValues((v) => ({ ...v, ...patch }))}
        onSubmit={submit}
        onOpenChange={(o) => {
          if (!o) setShown(false); // やめる・Esc：何も送らない（次に開くと空）
        }}
      />
      <StepUp
        open={stepUp !== null}
        reason={STEP_UP_REASON}
        withCode={stepUp?.withCode ?? false}
        withPasskey={stepUp?.withPasskey ?? false}
        onDone={() => {
          setStepUp(null);
          const body = pending.current;
          if (body) void guarded(() => run(body, true));
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
    open: () => {
      setValues(EMPTY_CREDENTIAL);
      setErrors({});
      setAlert(null);
      setShown(true);
    },
    ui,
  };
}
