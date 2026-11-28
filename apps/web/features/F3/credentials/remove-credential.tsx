"use client";
// 消すの確かめの動き（K-357・画面 credentials）。見た目は部品 RemoveCredentialConfirm（views.tsx）。本人確認の取り直しは無い（K-353）。
//   「消す」→ deleteCredential を 1 回（送っている間は待ちの形・二度押しで 2 回呼ばない）。200 → 閉じて入れ物が一覧を読み直す。
//   404（もう消えている）→ 閉じて読み直す。ほかの失敗・401・網の切れ → 確かめの小窓に口の文の赤の知らせ（閉じない・行は残る）。「やめる」は何も送らない
import { useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call } from "@/lib/api/call";
import { RemoveCredentialConfirm } from "./views";

const SCREEN = "credentials";
const textOf = (code: string): string => CATALOG[code]?.message ?? "";

export interface RemoveCredentialFlow {
  open: (id: string, name: string) => void;
  ui: ReactNode;
}

export function useRemoveCredential(onChanged: () => Promise<void>): RemoveCredentialFlow {
  const [target, setTarget] = useState<{ id: string; name: string } | null>(null);
  const [shown, setShown] = useState(false);
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const confirm = async () => {
    if (sending.current || !target) return;
    sending.current = true;
    setBusy(true);
    setAlert(null);
    try {
      const r = await call("deleteCredential", { params: { id: target.id }, screenId: SCREEN, keepOn401: true });
      if (r.ok || r.kind === "not_found") {
        setShown(false);
        await onChanged();
        return;
      }
      setAlert(r.status === 401 ? textOf(PAGE_ERROR.sessionExpired) : (r.message ?? textOf(errorCodeOf(r))));
    } catch {
      setAlert(textOf(PAGE_ERROR.offline)); // 網が切れた（口に届かない）
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return {
    open: (id, name) => {
      setTarget({ id, name });
      setAlert(null);
      setShown(true);
    },
    ui: target ? (
      <RemoveCredentialConfirm
        open={shown}
        name={target.name}
        error={alert}
        busy={busy}
        onConfirm={() => void confirm()}
        onOpenChange={(o) => {
          if (!o) setShown(false); // やめる・Esc：何も送らない
        }}
      />
    ) : null,
  };
}
