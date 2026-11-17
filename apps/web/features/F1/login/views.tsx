"use client";
// ログインの画面の見た目（段 2・K-74 の孫・枝 c/段2）。部品先行のモック（/dev/mock/f1）と本番の画面が同じこの部品を使う。
//   動き（口・押した後）は持たない：値と押したときの関数を呼ぶ側（本番は login-form、モックは決めた値）が渡す。
//   キャンバス AuthLogin・Auth2FA・AuthRecover・AuthAddPasskey。キャンバスに無い状態（ロック・止め・帯・別のアカウント・パスキーで入れない）は
//   同じ部品で足した（07_functional/段2-F1/機能分解.md の 2 章）
import Link from "next/link";
import { useRef, type ReactNode } from "react";
import { Fingerprint, KeyRound, UserCog } from "lucide-react";
import { Button, PasswordField, TextField } from "@/components/k";
import { AuthIcon, ChoiceCard, NoteBox, ResultBox, StatusStrip, type ServiceIncident } from "@/components/k/auth-parts";
import { AuthFrame, HELP_HREF } from "../sign-up/frame";
import { CodeBoxes } from "./code-boxes";
import "./login.css";
import "./views.css";

/** いまの様子の帯を入口の枠の上に横いっぱいで置く（帯が無ければ入口の枠だけ） */
export function AuthPage({ status = [], children }: { status?: readonly ServiceIncident[]; children: ReactNode }) {
  if (status.length === 0) return <AuthFrame>{children}</AuthFrame>;
  return (
    <div className="k-auth-status-page">
      <StatusStrip items={status} />
      <AuthFrame>{children}</AuthFrame>
    </div>
  );
}

function Alert({ msg }: { msg: string | null | undefined }) {
  return msg ? (
    <p role="alert" className="k-login-alert">
      {msg}
    </p>
  ) : null;
}

export interface LoginMainProps {
  email?: string;
  password?: string;
  /** 口の文（違う・ロック・送りすぎ）。止められたは LoginBlocked */
  msg?: string | null;
  /** パスキーで入れなかった（本人がやめた・時間切れ・この端末に無い） */
  passkeyFailed?: boolean;
  /** このブラウザはパスキーを使えない：出すがグレー（D-145.9）と一言 */
  passkeyUnsupported?: boolean;
  /** ロック中・送りすぎ：次へを押せない */
  locked?: boolean;
  busy?: boolean;
  status?: readonly ServiceIncident[];
  /** 別のアカウントでログイン中（`/login?next=…` を開いた） */
  signedInAs?: string | null;
  onPasskey?: () => void;
  onSubmit?: () => void;
  onRecover?: () => void;
}

/** ログイン（通常・失敗・ロック・パスキーで入れない・パスキーを使えない・別のアカウント） */
export function LoginMain(p: LoginMainProps) {
  return (
    <AuthPage status={p.status}>
      <form
        className="k-auth-form"
        data-auth="login"
        data-state={p.msg ? "e" : "n"}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          p.onSubmit?.();
        }}
      >
        <h1>ログイン</h1>
        {p.signedInAs ? (
          <NoteBox>
            いまは <b>{p.signedInAs}</b> でログイン中です。別のアカウントで入ると、今のログインは閉じます
          </NoteBox>
        ) : null}
        <Button
          type="button"
          size="lg"
          data-act="passkey"
          icon={<Fingerprint size={18} />}
          disabled={p.passkeyUnsupported}
          aria-disabled={p.passkeyUnsupported || undefined}
          onClick={p.onPasskey}
        >
          パスキーで入る
        </Button>
        <p className="k-auth-note k-login-pk-note">
          {p.passkeyUnsupported ? (
            "このブラウザはパスキーに対応していません。メールとパスワードで入ってください"
          ) : (
            <>
              指・顔・PC のロックで入る。いちばん安全で速い ・ この PC にパスキーが無いときは{" "}
              <button type="button" className="k-login-textbtn k-login-inline" onClick={p.onPasskey}>
                スマホで QR を読み取る
              </button>
            </>
          )}
        </p>
        {p.passkeyFailed ? (
          <p role="alert" className="k-login-alert">
            パスキーで入れませんでした。もう一度か、メールとパスワードで入ってください
          </p>
        ) : null}
        <div className="k-login-sep">
          <span aria-hidden="true" className="k-login-sep-line" />
          <span>またはメールとパスワード</span>
          <span aria-hidden="true" className="k-login-sep-line" />
        </div>
        <div className="k-login-bare">
          <TextField
            size="lg"
            label="メールアドレス"
            name="email"
            aria-label="メールアドレス"
            type="text"
            inputMode="email"
            autoComplete="email"
            placeholder="メール"
            defaultValue={p.email}
            aria-invalid={p.msg ? true : undefined}
          />
          <PasswordField
            size="lg"
            label="パスワード"
            name="password"
            aria-label="パスワード"
            autoComplete="current-password"
            placeholder="パスワード"
            defaultValue={p.password}
            aria-invalid={p.msg ? true : undefined}
          />
        </div>
        <Alert msg={p.msg} />
        <Button type="submit" size="lg" variant="outlined" loading={p.busy} disabled={p.locked}>
          次へ
        </Button>
        <div className="k-login-links">
          <Link href="/password-reset">パスワードを忘れた</Link>
          <button type="button" className="k-login-textbtn" onClick={p.onRecover}>
            端末をなくした
          </button>
        </div>
        <p className="k-auth-alt">
          はじめての方は <Link href="/signup">アカウントを作る</Link>
        </p>
      </form>
    </AuthPage>
  );
}

export interface LoginCodeProps {
  /** 6 つの枠に入っている数字（モックは途中まで） */
  code?: readonly string[];
  backup?: boolean;
  backupValue?: string;
  msg?: string | null;
  /** 6 けたを 5 回違えた・待ちの印が切れた：入るを押せない */
  stopped?: boolean;
  busy?: boolean;
  onCode?: (next: string[]) => void;
  onToggleBackup?: () => void;
  onRestart?: () => void;
  /** 端末をなくした（管理者に頼む・answer=9177d9dbe0d9 ④） */
  onLost?: () => void;
}

/** 確認のコード（6 けた・バックアップコード・止め・待ちの印が切れた） */
export function LoginCode(p: LoginCodeProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <AuthFrame>
      <form className="k-auth-form" data-auth="login" data-state="m" noValidate onSubmit={(e) => e.preventDefault()}>
        {p.backup ? (
          <>
            <h1>バックアップコードで入る</h1>
            <p className="k-auth-lead" data-kind="body">
              2 段階認証を付けたときに保管したバックアップコードの 1 つを入れてください。1 つ使うと消える
            </p>
            <TextField
              size="lg"
              label="バックアップコード"
              name="backup_code"
              aria-label="バックアップコード"
              autoComplete="off"
              placeholder="例：7KQM-2XPA"
              defaultValue={p.backupValue}
            />
          </>
        ) : (
          <>
            <h1>確認のコード</h1>
            <p className="k-auth-lead" data-kind="body">
              2 段階認証を付けているので、認証アプリ（Google Authenticator・1Password など）に出ている 6
              けたの数字を入れてください
            </p>
            <CodeBoxes
              code={p.code ?? ["", "", "", "", "", ""]}
              onCode={p.onCode ?? (() => undefined)}
              inputs={inputs}
            />
            <p className="k-auth-note">数字は 30 秒ごとに変わる ・ 6 つそろうと自動で進む</p>
          </>
        )}
        <Alert msg={p.msg} />
        {p.stopped && p.onRestart ? (
          <Button type="button" size="lg" variant="outlined" onClick={p.onRestart}>
            最初からログインし直す
          </Button>
        ) : (
          <Button type="submit" size="lg" loading={p.busy} disabled={p.stopped}>
            入る
          </Button>
        )}
        <div className="k-auth-alt k-login-alt-col">
          <button type="button" className="k-login-textbtn" onClick={p.onToggleBackup}>
            {p.backup ? "認証アプリの 6 けたで入る" : "認証アプリが使えない"}
          </button>
          <button type="button" className="k-login-textbtn" onClick={p.onLost}>
            端末をなくした
          </button>
          <span className="k-login-muted">この画面は 2 段階認証を付けている人だけに出る</span>
        </div>
      </form>
    </AuthFrame>
  );
}

export interface LoginRecoverProps {
  /** 管理者に頼んだ結果（sent＝頼んだ・already＝もう頼んである・failed＝送れなかった） */
  asked?: "sent" | "already" | "failed" | "no_admin" | null;
  /** パスワードを通った直後の待ちの印があるか（無ければ「管理者に頼む」は押せず、先にパスワードを求める） */
  canAsk?: boolean;
  onBack?: () => void;
  onBackup?: () => void;
  onAsk?: () => void;
}

const ASKED: Record<"sent" | "already" | "failed" | "no_admin", { tone: "ok" | "bad"; text: string }> = {
  no_admin: {
    tone: "ok",
    text: "頼んだことを記録しました。ほかに管理者がいないので、運営が本人を確かめて戻します。困ったときから運営に連絡してください",
  },
  sent: { tone: "ok", text: "管理者に頼みました。戻してもらったら、もう一度ログインしてください" },
  already: { tone: "ok", text: "もう頼んであります。管理者が戻すまで、お待ちください" },
  failed: { tone: "bad", text: "送れませんでした。もう一度押してください" },
};

/** 端末をなくしたとき（キャンバス AuthRecover） */
export function LoginRecover(p: LoginRecoverProps) {
  const asked = p.asked ? ASKED[p.asked] : null;
  return (
    <AuthFrame>
      <div className="k-auth-form" data-auth="recover">
        <button type="button" className="k-login-textbtn k-login-back" onClick={p.onBack}>
          ← ログインに戻る
        </button>
        <h1 className="k-login-h-left">端末をなくしたとき</h1>
        <p className="k-auth-lead k-login-left" data-kind="body">
          パスキーの端末や認証アプリが使えないときは、次のどちらかで入れます。SMS では入れません（乗っ取りに弱いため）。
        </p>
        <ChoiceCard
          icon={<KeyRound size={16} />}
          title="バックアップコードで入る"
          desc="2 段階認証を付けたときに保存した 10 個のコードのうち 1 つを入れる。1 つは 1 回だけ使える"
          onPick={p.onBackup}
        />
        <ChoiceCard
          icon={<UserCog size={16} />}
          title="ワークスペースの管理者に再設定を頼む"
          desc={
            p.canAsk
              ? "管理者が本人であることを確かめて、入り方を作り直す。頼んだこと・作り直したことは記録に残る"
              : "先にメールとパスワードで入ってから頼めます（本人だと分かってから管理者に届ける）"
          }
          onPick={p.onAsk}
          disabled={!p.canAsk || p.asked === "sent" || p.asked === "already" || p.asked === "no_admin"}
        />
        {asked ? <ResultBox tone={asked.tone}>{asked.text}</ResultBox> : null}
        <NoteBox>
          入れたら、すぐに新しいパスキーを付け、なくした端末を「ログインと安全」から取り消してください。なくした端末の分身の作業は止まります。
          管理者があなた 1 人のときは、運営が本人を確かめて戻します（<Link href={HELP_HREF}>困ったとき</Link>）
        </NoteBox>
      </div>
    </AuthFrame>
  );
}

/** スマホのパスキーで入った直後：この PC にもパスキーを付ける？（キャンバス AuthAddPasskey） */
export function LoginAdded({ onAdd, onSkip }: { onAdd?: () => void; onSkip?: () => void }) {
  return (
    <AuthFrame>
      <div className="k-auth-form" data-auth="added">
        <div className="k-login-center">
          <AuthIcon tone="solid">✓</AuthIcon>
        </div>
        <h1>入れました</h1>
        <p className="k-auth-lead" data-kind="body">
          この PC にもパスキーを付けると、次からはスマホを使わずに、この PC の指紋・顔・ロックだけで入れます
        </p>
        <Button type="button" size="lg" icon={<Fingerprint size={18} />} onClick={onAdd}>
          この PC にパスキーを付ける
        </Button>
        <Button type="button" size="lg" variant="outlined" onClick={onSkip}>
          今回はしない
        </Button>
        <p className="k-auth-note">
          人と共用の PC なら付けないでください ・ あとから 自分の設定 › ログインと安全 でも付けられる
        </p>
      </div>
    </AuthFrame>
  );
}

/** 止められた人・会社（パスワードが合ったときだけ出す・D-128.141 の文） */
export function LoginBlocked({ msg, onBack }: { msg: string; onBack?: () => void }) {
  return (
    <AuthFrame>
      <div className="k-auth-form" data-auth="blocked">
        <h1>ログインできません</h1>
        <ResultBox tone="bad">{msg}</ResultBox>
        <Button type="button" size="lg" variant="outlined" onClick={onBack}>
          ログインの画面に戻る
        </Button>
        <p className="k-auth-alt">
          わからないときは <Link href={HELP_HREF}>困ったとき</Link>
        </p>
      </div>
    </AuthFrame>
  );
}
