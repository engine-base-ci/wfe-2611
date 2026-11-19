"use client";
// 段 2（F1 の残り）の詳細のモック（部品先行・枝 c/段2）。本番と同じ部品（features/F1/*/views.tsx・components/k）を、決めた値で並べる。
//   1 つの id ＝ 1 つの状態。値は作り込みの値だが、件数や名前の嘘は本番と同じ決まりで出さない（本当の値が無い所は「準備中」）
import { useState, type ReactNode } from "react";
import { CATALOG } from "@kaname/errors/catalog";
import { Shell, MeSub, Toaster } from "@/components/k";
import type { ServiceIncident } from "@/components/k/auth-parts";
import { LoginAdded, LoginBlocked, LoginCode, LoginMain, LoginRecover } from "@/features/F1/login/views";
import { PasswordReset } from "@/features/F1/password-reset/views";
import { HelpView } from "@/features/F1/help/help-view";
import { waitText } from "@/features/F1/sign-up/wait-text";
import {
  AddPasskeyDialog,
  BackupDialog,
  ChangePasswordDialog,
  RemovePasskeyConfirm,
  RenamePasskeyDialog,
  SecurityBody,
  SecurityForced,
  SecurityHead,
  StepUpDialog,
  TotpDialog,
  type SecurityState,
} from "@/features/F1/security/views";
import type { Theme } from "@/lib/theme";

const msg = (id: string, fallback: string): string => CATALOG[id as keyof typeof CATALOG]?.message ?? fallback;

const INCIDENT: ServiceIncident = { kind: "incident", title: "分身の実行が遅れています", when: "11/18 10:20 から" };
const MAINT: ServiceIncident = {
  kind: "maintenance",
  title: "メンテナンス中です。この間は使えません",
  when: "11/20 3:00 まで",
};
const EMAIL = "takamoto@engine-base.example";
const OPS = "info@engine-base.com";

const PASSKEY_USER: SecurityState = {
  passkeys: [
    {
      id: "pk1",
      name: "MacBook Pro（Touch ID）",
      device: "laptop",
      detail: "9/12 に作った ・ 最後に使った 今日 09:30",
    },
    { id: "pk2", name: "iPhone（Face ID）", device: "phone", detail: "9/12 に作った ・ 最後に使った 11/1" },
  ],
  hasPassword: false,
  twoFactor: false,
  backupLeft: null,
  via: "passkey",
};
const PASSWORD_ONLY: SecurityState = {
  passkeys: [],
  hasPassword: true,
  twoFactor: false,
  backupLeft: null,
  via: "password",
};
const PASSWORD_2FA: SecurityState = {
  passkeys: [],
  hasPassword: true,
  twoFactor: true,
  backupLeft: 9,
  via: "password",
};
const ONE_PASSKEY: SecurityState = { ...PASSKEY_USER, passkeys: PASSKEY_USER.passkeys.slice(0, 1), hasPassword: true };
const CODES = [
  "7KQM-2XPA",
  "Q9RT-6LMV",
  "H2DW-8NCE",
  "P5XB-3JFU",
  "M8ZK-1TQS",
  "C4VN-7HRY",
  "W6GE-9PLD",
  "T3JA-5BXK",
  "R1UF-4MWZ",
  "E7LC-2YQN",
];

export interface MockEntry {
  id: string;
  screen: "login" | "password-reset" | "mfa-setup" | "help";
  label: string;
  /** どのチケット（画面の葉）がこの状態を本物にするか（07_functional/段2-F1/切り方.md） */
  ticket: string;
}

/** 状態の一覧（索引の頁と、/dev/mock/f1/<id> の両方が読む） */
export const MOCKS: readonly MockEntry[] = [
  { id: "login-n", screen: "login", label: "ログイン：通常", ticket: "K-316" },
  { id: "login-e", screen: "login", label: "ログイン：違うパスワード（残り回数）", ticket: "K-316" },
  { id: "login-lock", screen: "login", label: "ログイン：ロック中（新しい文）", ticket: "K-316" },
  { id: "login-wait", screen: "login", label: "ログイン：送りすぎ（あと何秒）", ticket: "K-316" },
  { id: "login-m", screen: "login", label: "確認のコード", ticket: "K-316" },
  { id: "login-m-error", screen: "login", label: "確認のコード：違う", ticket: "K-316" },
  { id: "login-backup", screen: "login", label: "バックアップコードで入る", ticket: "K-316" },
  { id: "login-code-lock", screen: "login", label: "確認のコード：5 回違えて止め", ticket: "K-316" },
  { id: "login-tf-expired", screen: "login", label: "確認のコード：時間が過ぎた", ticket: "K-316" },
  { id: "login-suspended-member", screen: "login", label: "止められた人", ticket: "K-316" },
  { id: "login-suspended-ws", screen: "login", label: "止められたワークスペース", ticket: "K-316" },
  { id: "login-pk-failed", screen: "login", label: "パスキーで入れなかった", ticket: "K-317" },
  { id: "login-pk-unsupported", screen: "login", label: "パスキーに対応していないブラウザ", ticket: "K-317" },
  { id: "login-added", screen: "login", label: "スマホで入った後：この PC にも付ける？", ticket: "K-317" },
  { id: "login-recover", screen: "login", label: "端末をなくしたとき（パスワードの前）", ticket: "K-317" },
  {
    id: "login-recover-ready",
    screen: "login",
    label: "端末をなくしたとき（パスワードを通った直後）",
    ticket: "K-317",
  },
  { id: "login-recover-sent", screen: "login", label: "端末をなくしたとき：管理者に頼んだ", ticket: "K-317" },
  { id: "login-recover-no-admin", screen: "login", label: "端末をなくしたとき：ほかに管理者がいない", ticket: "K-317" },
  { id: "login-recover-failed", screen: "login", label: "端末をなくしたとき：送れなかった", ticket: "K-317" },
  { id: "login-other-account", screen: "login", label: "別のアカウントでログイン中", ticket: "K-317" },
  { id: "login-status-incident", screen: "login", label: "いまの様子：障害", ticket: "K-317" },
  { id: "login-status-both", screen: "login", label: "いまの様子：障害とメンテナンス", ticket: "K-317" },
  { id: "reset-ask", screen: "password-reset", label: "再設定：メールを入れる", ticket: "K-320" },
  { id: "reset-ask-error", screen: "password-reset", label: "再設定：メールの形が違う", ticket: "K-320" },
  { id: "reset-sent", screen: "password-reset", label: "再設定：送りました（60 秒待つ）", ticket: "K-320" },
  { id: "reset-signed-in", screen: "password-reset", label: "再設定：ログイン中に開いた", ticket: "K-320" },
  { id: "reset-new", screen: "password-reset", label: "再設定：新しいパスワード", ticket: "K-320" },
  { id: "reset-new-error", screen: "password-reset", label: "再設定：2 つが違う", ticket: "K-320" },
  { id: "reset-done", screen: "password-reset", label: "再設定：済んだ", ticket: "K-320" },
  {
    id: "reset-done-other",
    screen: "password-reset",
    label: "再設定：済んだ（別のアカウントでログイン中）",
    ticket: "K-320",
  },
  { id: "reset-dead", screen: "password-reset", label: "再設定：リンクがもう使えない", ticket: "K-320" },
  { id: "reset-invalid", screen: "password-reset", label: "再設定：リンクが正しくない", ticket: "K-320" },
  { id: "sec-passkey", screen: "mfa-setup", label: "ログインと安全：パスキーの人", ticket: "K-318" },
  { id: "sec-password", screen: "mfa-setup", label: "ログインと安全：パスワードだけ（足りない）", ticket: "K-318" },
  { id: "sec-password-2fa", screen: "mfa-setup", label: "ログインと安全：パスワードと 2 段階", ticket: "K-318" },
  { id: "sec-forced", screen: "mfa-setup", label: "登録の直後：付けるまで進めない", ticket: "K-319" },
  { id: "sec-forced-back", screen: "mfa-setup", label: "登録の直後：ほかの画面から戻された", ticket: "K-319" },
  { id: "sec-add", screen: "mfa-setup", label: "パスキーを足す", ticket: "K-318" },
  { id: "sec-add-dup", screen: "mfa-setup", label: "パスキーを足す：もう付いている", ticket: "K-318" },
  { id: "sec-rename", screen: "mfa-setup", label: "パスキーの名前を変える", ticket: "K-318" },
  { id: "sec-remove", screen: "mfa-setup", label: "パスキーを外す", ticket: "K-318" },
  { id: "sec-remove-last", screen: "mfa-setup", label: "パスキーを外す：最後の入り方", ticket: "K-318" },
  { id: "sec-stepup", screen: "mfa-setup", label: "本人確認の取り直し（2 段階あり）", ticket: "K-318" },
  { id: "sec-totp", screen: "mfa-setup", label: "2 段階認証を付ける", ticket: "K-319" },
  { id: "sec-totp-error", screen: "mfa-setup", label: "2 段階認証を付ける：コードが違う", ticket: "K-319" },
  { id: "sec-backup", screen: "mfa-setup", label: "バックアップコード（いまだけ）", ticket: "K-319" },
  { id: "sec-password-change", screen: "mfa-setup", label: "パスワードを変える", ticket: "K-319" },
  { id: "sec-password-set", screen: "mfa-setup", label: "パスワードを決める（パスキーだけの人）", ticket: "K-319" },
  { id: "help-n", screen: "help", label: "困ったとき：ふつう", ticket: "K-315" },
  { id: "help-incident", screen: "help", label: "困ったとき：障害とメンテナンス", ticket: "K-315" },
  { id: "help-unknown", screen: "help", label: "困ったとき：稼働状況を読めない", ticket: "K-315" },
];

/** 外枠の中のログインと安全（モックの外枠は決めた値の Shell。本番は TicketShell） */
function SecurityPage({ theme, state, dialog }: { theme: Theme; state: SecurityState; dialog?: ReactNode }) {
  return (
    <Toaster>
      <Shell
        role="R1"
        screen="mfa-setup"
        crumbs={[{ label: "自分の設定", disabled: true }, { label: "ログインと安全" }]}
        workspace={{ name: "ENGINE BASE", initial: "E" }}
        member={{ name: "高本", initial: "高" }}
        bridgeConnected
        theme={theme}
      >
        <div className="k-me-wrap">
          <MeSub current="login" />
          <section className="k-page k-me-page" aria-labelledby="security-title">
            <SecurityHead />
            <SecurityBody {...state} />
          </section>
        </div>
      </Shell>
      {dialog}
    </Toaster>
  );
}

function CodeOf({ n }: { n: number }) {
  const [code, setCode] = useState<string[]>(["4", "8", "2", "9", "", ""].map((d, i) => (i < n ? d : "")));
  return <LoginCode code={code} onCode={setCode} />;
}

/** id の状態を描く */
export function MockView({ id, theme, qrSvg }: { id: string; theme: Theme; qrSvg: string }) {
  const noop = () => undefined;
  switch (id) {
    case "login-n":
      return <LoginMain />;
    case "login-e":
      return <LoginMain email={EMAIL} password="wrongpassword" msg={msg("E-AUTH-001", "")} />;
    case "login-lock":
      return <LoginMain email={EMAIL} locked msg="15 分間ロックしました。15 分たってから、もう一度入ってください" />;
    case "login-wait":
      return <LoginMain email={EMAIL} locked msg={waitText(42)} />;
    case "login-m":
      return <CodeOf n={4} />;
    case "login-m-error":
      return <LoginCode msg={msg("E-AUTH-004", "")} />;
    case "login-backup":
      return <LoginCode backup backupValue="7KQM-2XPA" />;
    case "login-code-lock":
      return (
        <LoginCode stopped msg="コードを 5 回違えたので 15 分止めました。15 分たってから、もう一度入ってください" />
      );
    case "login-tf-expired":
      return <LoginCode stopped msg="時間が過ぎました。最初からログインし直してください" onRestart={noop} />;
    case "login-suspended-member":
      return <LoginBlocked msg="このアカウントは、いま止められています。ワークスペースの管理者に聞いてください" />;
    case "login-suspended-ws":
      return (
        <LoginBlocked msg="このワークスペースは、いま止められています。データは残っています。管理者か運営に連絡してください" />
      );
    case "login-pk-failed":
      return <LoginMain passkeyFailed />;
    case "login-pk-unsupported":
      return <LoginMain passkeyUnsupported />;
    case "login-added":
      return <LoginAdded />;
    case "login-recover":
      return <LoginRecover />;
    case "login-recover-ready":
      return <LoginRecover canAsk />;
    case "login-recover-sent":
      return <LoginRecover canAsk asked="sent" />;
    case "login-recover-no-admin":
      return <LoginRecover canAsk asked="no_admin" />;
    case "login-recover-failed":
      return <LoginRecover canAsk asked="failed" />;
    case "login-other-account":
      return <LoginMain signedInAs="kimura@engine-base.example" />;
    case "login-status-incident":
      return <LoginMain status={[INCIDENT]} />;
    case "login-status-both":
      return <LoginMain status={[INCIDENT, MAINT]} />;
    case "reset-ask":
      return <PasswordReset step="ask" />;
    case "reset-ask-error":
      return (
        <PasswordReset step="ask" email="takamoto@engine-base" msg={msg("E-VAL-004", "メールアドレスの形が違います")} />
      );
    case "reset-sent":
      return <PasswordReset step="sent" email={EMAIL} waitSec={48} />;
    case "reset-signed-in":
      return <PasswordReset step="ask" signedIn />;
    case "reset-new":
      return <PasswordReset step="new" />;
    case "reset-new-error":
      return <PasswordReset step="new" msg="2 つのパスワードが違います" />;
    case "reset-done":
      return <PasswordReset step="done" />;
    case "reset-done-other":
      return <PasswordReset step="done" otherAccount />;
    case "reset-dead":
      return <PasswordReset step="dead" />;
    case "reset-invalid":
      return <PasswordReset step="invalid" />;
    case "sec-passkey":
      return <SecurityPage theme={theme} state={PASSKEY_USER} />;
    case "sec-password":
      return <SecurityPage theme={theme} state={PASSWORD_ONLY} />;
    case "sec-password-2fa":
      return <SecurityPage theme={theme} state={PASSWORD_2FA} />;
    case "sec-forced":
      return <SecurityForced />;
    case "sec-forced-back":
      return <SecurityForced notice="入り方を 1 つ足してから使い始めます" />;
    case "sec-add":
      return <SecurityPage theme={theme} state={PASSKEY_USER} dialog={<AddPasskeyDialog open />} />;
    case "sec-add-dup":
      return (
        <SecurityPage
          theme={theme}
          state={PASSKEY_USER}
          dialog={<AddPasskeyDialog open error="このパスキーは、もうこの端末に付いています" />}
        />
      );
    case "sec-rename":
      return (
        <SecurityPage
          theme={theme}
          state={PASSKEY_USER}
          dialog={<RenamePasskeyDialog open name="MacBook Pro（Touch ID）" />}
        />
      );
    case "sec-remove":
      return (
        <SecurityPage
          theme={theme}
          state={PASSKEY_USER}
          dialog={<RemovePasskeyConfirm open name="iPhone（Face ID）" onOpenChange={noop} />}
        />
      );
    case "sec-remove-last":
      return (
        <SecurityPage
          theme={theme}
          state={ONE_PASSKEY}
          dialog={
            <RemovePasskeyConfirm
              open
              name="MacBook Pro（Touch ID）"
              blocked="パスワードで入るには 2 段階認証が要ります。先に 2 段階認証を付けてください"
              onOpenChange={noop}
            />
          }
        />
      );
    case "sec-stepup":
      return (
        <SecurityPage
          theme={theme}
          state={PASSWORD_2FA}
          dialog={<StepUpDialog open withCode reason="パスワードを変える前に、本人か確かめます" />}
        />
      );
    case "sec-totp":
      return (
        <SecurityPage
          theme={theme}
          state={PASSWORD_ONLY}
          dialog={<TotpDialog open qrSvg={qrSvg} secret="JBSW Y3DP EHPK 3PXP" code={["5", "1", "", "", "", ""]} />}
        />
      );
    case "sec-totp-error":
      return (
        <SecurityPage
          theme={theme}
          state={PASSWORD_ONLY}
          dialog={<TotpDialog open qrSvg={qrSvg} secret="JBSW Y3DP EHPK 3PXP" error={msg("E-AUTH-004", "")} />}
        />
      );
    case "sec-backup":
      return <SecurityPage theme={theme} state={PASSWORD_2FA} dialog={<BackupDialog open codes={CODES} />} />;
    case "sec-password-change":
      return <SecurityPage theme={theme} state={PASSWORD_2FA} dialog={<ChangePasswordDialog open />} />;
    case "sec-password-set":
      return (
        <SecurityPage theme={theme} state={PASSKEY_USER} dialog={<ChangePasswordDialog open hasPassword={false} />} />
      );
    case "help-n":
      return <HelpView status={[]} opsEmail={OPS} />;
    case "help-incident":
      return <HelpView status={[INCIDENT, MAINT]} opsEmail={OPS} />;
    case "help-unknown":
      return <HelpView status={null} opsEmail={OPS} />;
    default:
      return <p>この状態はありません：{id}</p>;
  }
}
