"use client";
// 運営のパスキーを付ける画面（段 13・領域 ops・下絵 op-setup×4・K-1003）：メールのリンク /ops/setup#token=… で開く。
//   運営のログインと同じ箱（k-auth）。運営の外枠は出さない。本人が名前を付けてからパスキーを付ける（D-156.66）。値を受け取って描くだけ。
//   印を読む・口を呼ぶのは入れ物（ops-setup-screen.tsx）。下の任意の props を渡さなければ下絵と同じ見本の形（名前の欄は読むだけ）
import { Fingerprint } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { Button, TextField } from "@/components/k";
import { NoteBox } from "@/components/k/auth-parts";
import "@/features/F1/sign-up/sign-up.css";
import "./ops-shell.css";
import "./ops.css";

export type OpsSetupMode = "ready" | "done" | "invalid" | "failed";

export interface OpsSetupProps {
  mode?: OpsSetupMode;
  /** 名前の欄の値（見本） */
  name?: string;
  /** 名前が空・空白だけで押したときの字（欄の誤りとして role alert で出す） */
  nameError?: string;
  /** 名前の欄が変わったとき（渡すと欄を書ける形にする・入れ物が使う） */
  onNameChange?: (name: string) => void;
  /** 「パスキーを付ける」を押したとき（入れ物が使う） */
  onSubmit?: () => void;
  /** 押している間（ボタンを押せない形にする） */
  busy?: boolean;
  /** 押した後の失敗の字（つながらない等・role alert）。mode="failed" の字より先に出す */
  alert?: string;
  /** 付けた後の「運営のログインへ」の行き先（既定は下絵の置き場） */
  loginHref?: string;
}

function Logo() {
  return (
    <div className="k-auth-logo">
      <span className="k-auth-mark" aria-hidden="true">
        K
      </span>
      <b>Kaname</b>
      <span className="k-op-tag">運営</span>
    </div>
  );
}

const FAILED =
  "パスキーを付けられませんでした。端末でやめたか、時間が切れました。もう一度「パスキーを付ける」を押してください";

function Body({
  mode,
  name,
  nameError,
  onNameChange,
  onSubmit,
  busy,
  alert,
  loginHref,
}: Required<Pick<OpsSetupProps, "mode" | "name">> & OpsSetupProps): ReactNode {
  if (mode === "done") {
    return (
      <>
        <h1>パスキーを付けました</h1>
        <p role="status" className="k-auth-note">
          パスキーを付けました。運営のログインから、パスキーで入ってください
        </p>
        <a className="k-btn" data-variant="primary" data-size="lg" href={loginHref ?? "/dev/mock/f12-ops/op-login"}>
          運営のログインへ
        </a>
      </>
    );
  }
  if (mode === "invalid") {
    return (
      <>
        <h1>パスキーを付ける</h1>
        <p role="alert" className="k-op-alert">
          このリンクは使えなくなりました。期限が切れたか、もう使われています。運営の管理者に、新しいリンクを送ってもらってください
        </p>
      </>
    );
  }
  return (
    <>
      <h1>パスキーを付ける</h1>
      <NoteBox>運営の場所はパスキーでしか入れません。この端末の指・顔・PC のロックでパスキーを付けてください</NoteBox>
      <TextField
        label="名前"
        name="name"
        required
        maxLength={40}
        {...(onNameChange
          ? { value: name, onChange: (e: ChangeEvent<HTMLInputElement>) => onNameChange(e.target.value) }
          : { readOnly: true, defaultValue: name })}
        description="運営の人の一覧と記録に出る名前（40 字まで）"
        error={nameError ?? null}
        errorAlert
      />
      <Button
        size="lg"
        icon={<Fingerprint size={18} />}
        {...(onSubmit ? { onClick: onSubmit } : {})}
        {...(busy ? { loading: true } : {})}
      >
        パスキーを付ける
      </Button>
      {alert || mode === "failed" ? (
        <p role="alert" className="k-op-alert">
          {alert ?? FAILED}
        </p>
      ) : null}
    </>
  );
}

/** パスキーを付ける：名前・注記・パスキーを付ける／付けた後／使えないリンク／付けられなかった */
export function OpsSetup({ mode = "ready", name = "佐藤 花子", ...rest }: OpsSetupProps): ReactNode {
  return (
    <div className="k-root k-auth">
      <Logo />
      <main className="k-auth-card" data-part="auth-box">
        <Body mode={mode} name={name} {...rest} />
      </main>
      <nav className="k-auth-foot" aria-label="Kaname について">
        <a href="/login">顧客のログインへ</a>
      </nav>
    </div>
  );
}
