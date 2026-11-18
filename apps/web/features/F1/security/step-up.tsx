"use client";
// 本人確認の取り直し（K-318・D-128.162）。口が 403・STEP_UP_REQUIRED を返したら呼ぶ側がこれを開き、通ったら止まった操作を 1 回だけやり直す。
//   パスワードのある人はパスワード（2 段階の人は 6 けたも）で stepUp に { password } ／ { password, code }。
//   パスワードの無い人（パスキーだけ）はパスキーで確かめる（generate-authenticate-options → 端末 → stepUp { passkey }・頭 x-passkey-challenge・K-309）。
//   違うとき（401・STEP_UP_FAILED）はログアウトにせず、欄の下に口の文で小窓を閉じない。「やめる」は何も送らない。K-91 も同じ部品を使う
import { useRef, useState } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { EMPTY_CODE } from "../login/code-boxes";
import { passkeyFailText, stepUpWithPasskey } from "./passkey";
import { StepUpDialog } from "./views";

const expiredText = (): string => CATALOG[PAGE_ERROR.sessionExpired]?.message ?? "";
const failedText = (): string => CATALOG["E-AUTH-021"]?.message ?? "";

export interface StepUpProps {
  open: boolean;
  /** 「パスキーを外す前に、本人か確かめます」など */
  reason: string;
  /** 2 段階を付けている（6 けたも打つ） */
  withCode: boolean;
  /** パスワードが無い（パスキーで確かめる） */
  withPasskey: boolean;
  /** 通った（呼ぶ側が止まった操作を 1 回だけやり直す） */
  onDone: () => void;
  /** やめた（何も送らない） */
  onCancel: () => void;
}

export function StepUp({ open, reason, withCode, withPasskey, onDone, onCancel }: StepUpProps) {
  const [password, setPassword] = useState("");
  const [code, setCode] = useState<string[]>([...EMPTY_CODE]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const reset = () => {
    setPassword("");
    setCode([...EMPTY_CODE]);
    setError(null);
  };
  const finish = (ok: boolean) => {
    reset();
    if (ok) onDone();
    else onCancel();
  };

  const submit = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError(null);
    try {
      if (withPasskey) {
        const r = await stepUpWithPasskey();
        if (r.ok) return finish(true);
        setError(passkeyFailText(r, expiredText()));
        return;
      }
      const body = withCode ? { password, code: code.join("") } : { password };
      const r = await call("stepUp", { body, screenId: "mfa-setup", keepOn401: true });
      if (r.ok) return finish(true);
      if (r.status === 401 && r.code !== "STEP_UP_FAILED") setError(expiredText());
      else setError(r.fields["password"] ?? r.fields["code"] ?? r.message ?? failedText());
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <StepUpDialog
      open={open}
      reason={reason}
      withCode={withCode}
      withPasskey={withPasskey}
      error={error}
      password={password}
      code={code}
      busy={busy}
      onPassword={setPassword}
      onCode={setCode}
      onOpenChange={(o) => {
        if (!o) finish(false);
      }}
      onSubmit={() => void submit()}
    />
  );
}
