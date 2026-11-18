"use client";
// 2 段階認証を付ける（K-319・D-128.59・D-128.61）：本人確認のパスワード → startTwoFactor（体 { password }）→ QR と鍵の字 → 6 けた →
//   confirmTwoFactor → バックアップコード 10 個をいまだけ見せる。答えの token が在れば画面の印を差し替えてから読み直す（決め 9）。
//   始めるが 403・STEP_UP_REQUIRED なら同じ小窓で取り直し（stepUp）、通ったら始めるを 1 回だけ送り直す。
//   409・E-AUTH-020（パスワードがまだ無い）は呼ぶ側の「パスワードを決める」を開き、決め終わったら本人確認から続ける。
//   鍵・QR・6 けた・コードは画面の状態にだけ持つ（localStorage・sessionStorage・ログに出さない。保存はブラウザのダウンロードだけ）
import QRCode from "qrcode";
import { useRef, useState, type ReactNode } from "react";
import { call, type CallErr } from "@/lib/api/call";
import { setToken } from "@/lib/api/client";
import { EMPTY_CODE } from "../login/code-boxes";
import { msgOf, offline, SCREEN, toLogin } from "./common";
import { BackupDialog, StepUpDialog, TotpDialog } from "./views";

export const TWO_FACTOR_REASON = "2 段階認証を付ける前に、本人か確かめます";
const NO_PASSWORD = "E-AUTH-020";
const NO_CODES = "付きました。バックアップコードを作り直してください";
const BACKUP_FILE = "kaname-backup-codes.txt";
const BACKUP_HEAD = "Kaname のバックアップコード（1 つは 1 回だけ使えます）";

/** 鍵の字を 4 字ずつ空ける（手で入れやすく） */
export const groupSecret = (s: string): string => (s.replace(/\s+/g, "").match(/.{1,4}/g) ?? []).join(" ");
/** 失敗の文（欄の理由・口の文・正本の文） */
const failText = (r: CallErr, field?: string): string =>
  (field ? r.fields[field] : undefined) ?? r.message ?? msgOf(r.code);

export interface TwoFactorFlow {
  /** 「付ける」を押した */
  start: () => void;
  /** 本人確認の小窓から始める（パスワードを決め終わった後） */
  check: () => void;
  ui: ReactNode;
}
export interface TwoFactorDeps {
  hasPassword: boolean;
  reload: () => Promise<void>;
  notify: (text: string) => void;
  /** パスワードを決める小窓を開く（notice は小窓に出す文）。決め終わったら then */
  askSetPassword: (notice: string | null, then: () => void) => void;
  /** 付け終わった（呼ぶ側が読み直す） */
  onFinished: () => void;
}

/** バックアップコードをブラウザの保存で渡す（1 行 1 つ） */
function downloadCodes(codes: readonly string[]): void {
  const blob = new Blob([`${BACKUP_HEAD}\n${codes.join("\n")}\n`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = BACKUP_FILE;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useTwoFactor(d: TwoFactorDeps): TwoFactorFlow {
  // 本人確認（mode check）と取り直し（mode step_up）は同じ小窓
  const [checkOpen, setCheckOpen] = useState(false);
  const [mode, setMode] = useState<"check" | "step_up">("check");
  const [password, setPassword] = useState("");
  const [checkErr, setCheckErr] = useState<string | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const started = useRef("");
  // QR と 6 けた
  const [totp, setTotp] = useState<{ qr: string; secret: string } | null>(null);
  const [code, setCode] = useState<string[]>([...EMPTY_CODE]);
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const [codeBusy, setCodeBusy] = useState(false);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  // バックアップコード（確かめの答えで 1 回だけ来る）
  const [codes, setCodes] = useState<string[] | null>(null);
  const sending = useRef(false);

  const openCheck = () => {
    setMode("check");
    setPassword("");
    setCheckErr(null);
    setCheckOpen(true);
  };
  const start = () => {
    if (!d.hasPassword) d.askSetPassword(null, openCheck);
    else openCheck();
  };

  const runStart = async (pw: string, retried: boolean) => {
    const r = await call("startTwoFactor", { body: { password: pw }, screenId: SCREEN, keepOn401: true });
    if (r.ok) {
      const uri = r.data.otpauth_uri ?? "";
      const qr = await QRCode.toString(uri, { type: "svg", margin: 0 });
      setTotp({ qr, secret: groupSecret(r.data.secret ?? "") });
      setCode([...EMPTY_CODE]);
      setCodeErr(null);
      setCheckOpen(false);
      return;
    }
    if (r.status === 401) return toLogin();
    if (r.kind === "step_up" && !retried) {
      setMode("step_up");
      setPassword("");
      setCheckErr(null);
      return;
    }
    if (r.status === 409 && r.code === NO_PASSWORD) {
      setCheckOpen(false);
      return d.askSetPassword(r.message ?? msgOf(NO_PASSWORD), openCheck);
    }
    if (r.status === 409) {
      setCheckOpen(false); // 別のタブで先に付けた（E-AUTH-017）
      d.notify(failText(r));
      return void d.reload();
    }
    setCheckErr(failText(r, "password"));
  };
  const runStepUp = async () => {
    const r = await call("stepUp", { body: { password }, screenId: SCREEN, keepOn401: true });
    if (r.ok) return runStart(started.current, true);
    if (r.status === 401 && r.code !== "STEP_UP_FAILED") return toLogin();
    setCheckErr(r.fields["password"] ?? r.message ?? msgOf("E-AUTH-021"));
  };
  const submitCheck = async () => {
    if (sending.current || !password) return;
    sending.current = true;
    setCheckBusy(true);
    setCheckErr(null);
    try {
      if (mode === "check") {
        started.current = password;
        await runStart(password, false);
      } else await runStepUp();
    } catch {
      setCheckErr(offline());
    } finally {
      sending.current = false;
      setCheckBusy(false);
    }
  };

  const clearCode = (text: string) => {
    setCodeErr(text);
    setCode([...EMPTY_CODE]);
    window.setTimeout(() => inputs.current[0]?.focus(), 0);
  };
  const confirm = async (value: string) => {
    if (sending.current) return;
    sending.current = true;
    setCodeBusy(true);
    setCodeErr(null);
    try {
      const r = await call("confirmTwoFactor", { body: { code: value }, screenId: SCREEN, keepOn401: true });
      if (r.ok) {
        if (r.data.token) setToken(r.data.token); // 新しい印に差し替えてから読み直す（差し替えないと次の読み直しが 401）
        setTotp(null);
        const got = Array.isArray(r.data.backup_codes) ? r.data.backup_codes : [];
        if (got.length > 0) return setCodes(got);
        d.notify(NO_CODES);
        return d.onFinished();
      }
      if (r.status === 401) return toLogin();
      if (r.status === 409) {
        setTotp(null);
        d.notify(failText(r));
        return void d.reload();
      }
      clearCode(failText(r, "code"));
    } catch {
      clearCode(offline());
    } finally {
      sending.current = false;
      setCodeBusy(false);
    }
  };
  const onCode = (next: string[]) => {
    setCode(next);
    if (next.every((c) => c !== "")) void confirm(next.join(""));
  };
  const closeBackup = () => {
    setCodes(null);
    d.onFinished();
  };

  const ui = (
    <>
      <StepUpDialog
        open={checkOpen}
        reason={TWO_FACTOR_REASON}
        withCode={false}
        error={checkErr}
        password={password}
        busy={checkBusy}
        onPassword={setPassword}
        onOpenChange={(o) => {
          if (!o) setCheckOpen(false);
        }}
        onSubmit={() => void submitCheck()}
      />
      <TotpDialog
        open={totp !== null}
        qrSvg={totp?.qr ?? ""}
        secret={totp?.secret ?? ""}
        code={code}
        error={codeErr}
        busy={codeBusy}
        inputs={inputs}
        onCode={onCode}
        onOpenChange={(o) => {
          if (!o) setTotp(null); // やめる：確かめは送らない
        }}
        onSubmit={() => {
          if (code.every((c) => c !== "")) void confirm(code.join(""));
        }}
      />
      <BackupDialog
        open={codes !== null}
        codes={codes ?? []}
        onOpenChange={(o) => {
          if (!o) closeBackup(); // 閉じると二度と出ない
        }}
        onDownload={() => downloadCodes(codes ?? [])}
        onCopy={() => void navigator.clipboard?.writeText((codes ?? []).join("\n")).catch(() => undefined)}
        onPrint={() => window.print()}
        onDone={closeBackup}
      />
    </>
  );
  return { start, check: openCheck, ui };
}
