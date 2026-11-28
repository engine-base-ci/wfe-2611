"use client";
// 確かめの 2 つの動き（K-357・画面 credentials）：もう一度確かめる・コードを入れる（D-117：PC がログインの途中で止まって本人にコードを頼む）。
//   もう一度確かめる：checkCredentialLogin を 1 回（答えまで同じ行は押せない）→ 201 のあと入れ物が一覧を読み直す（札が確かめている）。
//     409（もう確かめている・失効）→ 読み直すだけ。ほかの失敗・網の切れ → 口の文の赤の知らせ（行はそのまま）。404 → 知らせて読み直す
//   コードを入れる：見た目は部品 CheckCodeDialog（views.tsx）。コードは NFKC → 空白を全部取って { request_ref, code }。スマホの承認（push）は欄を出さず { request_ref, approved: true }。
//     印（request_ref）が無いときは口を呼ばず、小窓の中に「もう一度確かめてください」を出す（K-630・契約で必須）。201 → 閉じて読み直す。422 → 欄の下に口の文（字は残す）。404（もう頼んでいない）→ 閉じて口の文の知らせ・読み直す。ほかの失敗 → 小窓の中の赤の知らせ。「あとで」は何も送らない
import { useRef, useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { PAGE_ERROR, errorCodeOf } from "@/components/k/error-of";
import { call, type CallErr } from "@/lib/api/call";
import type { CredentialRow } from "./to-item";
import { CheckCodeDialog } from "./views";

const SCREEN = "credentials";
/** 頼みの印（request_ref）が無いときに小窓の中へ出す文。口は印が必須（K-355 の契約）で必ず 422 になるので呼ばない（K-630） */
const NO_REQUEST_REF_TEXT = "コードの頼みが見つかりません。もう一度確かめてください";
const textOf = (code: string): string => CATALOG[code]?.message ?? "";
const messageOf = (r: CallErr): string => r.message ?? textOf(errorCodeOf(r));
type Via = "sms" | "email" | "push";
const viaOf = (twoFactor: string | null): Via => (twoFactor === "push" || twoFactor === "email" ? twoFactor : "sms");
/** コードの表記ゆらぎ：全角を半角に（NFKC）・空白を全部取る */
export const normalizeCode = (s: string): string => s.normalize("NFKC").replace(/\s+/g, "");

export interface CheckCredentialDeps {
  onChanged: () => Promise<void>;
  notifyError: (text: string) => void;
}
export interface CheckCredentialFlow {
  recheck: (id: string) => void;
  /** 「もう一度確かめる」を送っている行 */
  rechecking: string | null;
  openCode: (it: CredentialRow) => void;
  ui: ReactNode;
}

interface CodeTarget {
  id: string;
  name: string;
  via: Via;
  requestRef: string | null;
}

export function useCheckCredential(d: CheckCredentialDeps): CheckCredentialFlow {
  const [rechecking, setRechecking] = useState<string | null>(null);
  const rechecks = useRef(false);
  const [target, setTarget] = useState<CodeTarget | null>(null);
  const [shown, setShown] = useState(false);
  const [code, setCode] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [alert, setAlert] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const answering = useRef(false);

  const recheck = (id: string) => {
    if (rechecks.current) return;
    rechecks.current = true;
    setRechecking(id);
    void (async () => {
      try {
        const r = await call("checkCredentialLogin", { params: { id }, body: {}, screenId: SCREEN });
        if (r.ok || r.kind === "conflict") await d.onChanged();
        else if (r.kind === "not_found") {
          d.notifyError(messageOf(r));
          await d.onChanged();
        } else d.notifyError(messageOf(r));
      } catch {
        d.notifyError(textOf(PAGE_ERROR.offline)); // 網が切れた（口に届かない）
      } finally {
        rechecks.current = false;
        setRechecking(null);
      }
    })();
  };

  const submit = async () => {
    if (answering.current || !target) return;
    if (!target.requestRef) {
      setFieldError(null);
      setAlert(NO_REQUEST_REF_TEXT);
      return;
    }
    answering.current = true;
    setBusy(true);
    setFieldError(null);
    setAlert(null);
    try {
      const request_ref = target.requestRef;
      const body = target.via === "push" ? { request_ref, approved: true } : { request_ref, code: normalizeCode(code) };
      const r = await call("answerCredentialLoginCheck", {
        params: { id: target.id },
        body,
        screenId: SCREEN,
        keepOn401: true,
      });
      if (r.ok) {
        setShown(false);
        setCode("");
        await d.onChanged();
      } else if (r.kind === "not_found") {
        setShown(false);
        setCode("");
        d.notifyError(messageOf(r));
        await d.onChanged();
      } else if (r.kind === "invalid" && target.via !== "push") {
        setFieldError(r.fields["code"] ?? messageOf(r));
      } else {
        setAlert(r.status === 401 ? textOf(PAGE_ERROR.sessionExpired) : messageOf(r));
      }
    } catch {
      setAlert(textOf(PAGE_ERROR.offline)); // 網が切れた（口に届かない）：入れた字は残す
    } finally {
      answering.current = false;
      setBusy(false);
    }
  };

  return {
    recheck,
    rechecking,
    openCode: (it) => {
      setTarget({ id: it.id, name: it.name, via: viaOf(it.twoFactor), requestRef: it.requestRef });
      setCode("");
      setFieldError(null);
      setAlert(null);
      setShown(true);
    },
    ui: target ? (
      <CheckCodeDialog
        open={shown}
        name={target.name}
        via={target.via}
        code={code}
        error={fieldError}
        alert={alert}
        busy={busy}
        onCode={setCode}
        onSubmit={() => void submit()}
        onOpenChange={(o) => {
          if (!o) setShown(false); // あとで・Esc：何も送らない
        }}
      />
    ) : null,
  };
}
