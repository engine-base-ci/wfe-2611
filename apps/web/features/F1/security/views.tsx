"use client";
// ログインと安全（/mfa-setup・段 2・K-75 の孫・枝 c/段2）の見た目。部品先行のモックと本番が同じこの部品を使う。動きは持たない。
//   キャンバス MeLogin・MeLogin2FA・Me2FA・MeTotp・MeBackup・EdPasskey。ふだんは外枠の中（自分の設定の第 2 ナビ）、
//   登録の直後でパスキーも 2 段階も無い人（mfa_pending・D-128.141）は入口の枠で「付けるまで進めない」（聞くこと 3 の勧め (a)）。
//   入っている端末・最近の安全の記録は流れ F10 の機能なので、出すがグレー・値は空（D-145.9・D-144.3）
import { Fingerprint, KeyRound, Laptop, Smartphone } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { Button, Confirm, Dialog, PasswordField, TextField } from "@/components/k";
import { BackupCodes, ChoiceCard, NoteBox, QrBox, SecretText } from "@/components/k/auth-parts";
import {
  Pill,
  RowButton,
  SecuritySummary,
  SettingCard,
  SettingNote,
  SettingRow,
  Steps,
} from "@/components/k/setting-parts";
import { AuthFrame } from "../sign-up/frame";
import { CodeBoxes } from "../login/code-boxes";
import "../login/login.css";
import "../login/views.css";

export interface PasskeyItem {
  id: string;
  name: string;
  device: "laptop" | "phone";
  /** 「9/12 に作った ・ 最後に使った 今日 09:30」 */
  detail: string;
}

export interface SecurityState {
  passkeys: readonly PasskeyItem[];
  hasPassword: boolean;
  twoFactor: boolean;
  backupLeft: number | null;
  /** いま入っている入り方（安全の状態のカードの文） */
  via: "passkey" | "password";
  /** このブラウザはパスキーを付けられない */
  passkeyUnsupported?: boolean;
}

function DeviceIcon({ d }: { d: PasskeyItem["device"] }) {
  return d === "phone" ? <Smartphone size={16} /> : <Laptop size={16} />;
}

function summaryOf(s: SecurityState): { tone: "ok" | "warn"; title: string; detail: string } {
  if (s.passkeys.length > 0 || s.twoFactor)
    return {
      tone: "ok",
      title: "安全な状態です",
      detail: s.via === "passkey" ? "パスキーで入っている" : "パスワードと 2 段階認証で入っている",
    };
  return {
    tone: "warn",
    title: "入り方を 1 つ足してください",
    detail: "パスワードだけで入っています。パスキーか 2 段階認証を付けると、乗っ取られにくくなります",
  };
}

export interface SecurityBodyProps extends SecurityState {
  onAddPasskey?: () => void;
  onRename?: (id: string) => void;
  onRemove?: (id: string) => void;
  onPassword?: () => void;
  onTwoFactor?: () => void;
}

/** 本文（外枠の中のログインと安全）。題と補足は外枠の見出しの行（呼ぶ側） */
export function SecurityBody(p: SecurityBodyProps) {
  const sum = summaryOf(p);
  const needs2fa = p.hasPassword && p.passkeys.length === 0 && !p.twoFactor;
  return (
    <>
      <SecuritySummary tone={sum.tone} title={sum.title} detail={sum.detail} />
      <SettingCard title="入り方" labelledBy="sec-ways">
        <SettingRow
          name="パスキー"
          detail={
            p.passkeyUnsupported
              ? "このブラウザはパスキーに対応していません。別のブラウザか、2 段階認証を使ってください"
              : "指や顔で入る。フィッシングに強い（おすすめ）"
          }
          pill={
            <Pill tone={p.passkeys.length > 0 ? "success" : "neutral"}>
              {p.passkeys.length > 0 ? `${p.passkeys.length} つ` : "無し"}
            </Pill>
          }
          actions={
            <RowButton onClick={p.onAddPasskey} disabled={p.passkeyUnsupported}>
              足す
            </RowButton>
          }
        />
        <SettingRow
          name="パスワード"
          detail="使うなら 12 文字以上。パスキーを持たずパスワードだけで入る人は、2 段階認証が必ず要る"
          pill={
            <Pill tone={p.hasPassword ? "success" : "neutral"}>{p.hasPassword ? "使っている" : "使っていない"}</Pill>
          }
          actions={<RowButton onClick={p.onPassword}>{p.hasPassword ? "変える" : "決める"}</RowButton>}
        />
      </SettingCard>
      <SettingCard
        title="2 段階認証"
        labelledBy="sec-2fa"
        aside={
          p.passkeys.length > 0 && !p.twoFactor
            ? "いまはパスキーで入っているので、付けなくても 2 段階になっている"
            : null
        }
      >
        <SettingRow
          name="認証アプリ"
          detail={
            p.twoFactor
              ? `入るたびに認証アプリの 6 けたも打つ ・ バックアップコード 残り ${p.backupLeft ?? 0} 個`
              : "入るときに、パスキーやパスワードに加えて、スマホの認証アプリの 6 けたも打つ。付けるかどうかは自由（パスワードだけで入る人は必須）"
          }
          pill={
            <Pill tone={p.twoFactor ? "success" : needs2fa ? "warning" : "neutral"}>
              {p.twoFactor ? "付けている" : needs2fa ? "必須・付けていない" : "付けていない"}
            </Pill>
          }
          actions={
            p.twoFactor ? (
              <>
                <RowButton disabled title="外す（準備中）">
                  外す
                </RowButton>
                <RowButton disabled title="作り直す（準備中）">
                  コードを作り直す
                </RowButton>
              </>
            ) : (
              <RowButton variant="primary" onClick={p.onTwoFactor}>
                付ける
              </RowButton>
            )
          }
        />
      </SettingCard>
      {p.passkeys.length > 0 ? (
        <SettingCard title="パスキー" labelledBy="sec-passkeys">
          {p.passkeys.map((k) => (
            <SettingRow
              key={k.id}
              icon={<DeviceIcon d={k.device} />}
              name={k.name}
              detail={k.detail}
              actions={
                <>
                  <RowButton onClick={() => p.onRename?.(k.id)}>名前を変える</RowButton>
                  <RowButton onClick={() => p.onRemove?.(k.id)}>外す</RowButton>
                </>
              }
            />
          ))}
        </SettingCard>
      ) : null}
      <SettingCard
        title="入っている端末"
        labelledBy="sec-sessions"
        aside={
          <RowButton disabled title="この端末以外をすべて切る（準備中）">
            この端末以外をすべて切る
          </RowButton>
        }
      >
        <SettingRow disabled icon={<Laptop size={16} />} name="入っている端末の一覧" detail="準備中" />
        <SettingNote>
          操作がないと 12 時間で切れ、長くても 7 日で入り直す。場所や端末が急に変わったときも入り直す
        </SettingNote>
      </SettingCard>
      <SettingCard title="最近の安全の記録" labelledBy="sec-events">
        <SettingRow disabled icon={<KeyRound size={16} />} name="安全の記録" detail="準備中" />
      </SettingCard>
    </>
  );
}

/** 登録の直後：付けるまで先へ進めない（入口の枠・mfa_pending） */
export function SecurityForced({
  passkeyUnsupported = false,
  onPasskey,
  onTwoFactor,
  onSignOut,
  notice,
}: {
  passkeyUnsupported?: boolean;
  /** 人と共用の PC で閉じ込められないように（answer=9177d9dbe0d9 ③） */
  onSignOut?: () => void;
  /** ほかの画面を開こうとして戻されたとき（answer=6bdcb125e8f7 ⑮） */
  notice?: string | null;
  onPasskey?: () => void;
  onTwoFactor?: () => void;
}) {
  return (
    <AuthFrame foot="help">
      <div className="k-auth-form" data-auth="mfa-forced">
        <h1>入り方を 1 つ足してください</h1>
        {notice ? <NoteBox>{notice}</NoteBox> : null}
        <p className="k-auth-lead" data-kind="body">
          パスワードだけでは乗っ取られやすいので、どちらかを付けてから使い始めます。付け終わると、元の画面に進みます
        </p>
        <ChoiceCard
          icon={<Fingerprint size={16} />}
          title="パスキーを付ける（おすすめ）"
          desc={
            passkeyUnsupported
              ? "このブラウザはパスキーに対応していません。2 段階認証を使ってください"
              : "この端末の指・顔・PC のロックで入る。次からはパスワードも 6 けたも要らない"
          }
          onPick={onPasskey}
          disabled={passkeyUnsupported}
        />
        <ChoiceCard
          icon={<Smartphone size={16} />}
          title="2 段階認証を付ける"
          desc="入るたびに、パスワードに加えてスマホの認証アプリの 6 けたを打つ"
          onPick={onTwoFactor}
        />
        <NoteBox>
          付け終わるまで、ほかの画面には進めません。途中で閉じても、次にログインしたときにここから続けられます
        </NoteBox>
        <p className="k-auth-alt">
          <button type="button" className="k-login-textbtn" onClick={onSignOut}>
            ログアウト
          </button>
        </p>
      </div>
    </AuthFrame>
  );
}

/** パスキーを足す（キャンバス EdPasskey） */
export function AddPasskeyDialog({
  open,
  error,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  error?: string | null;
  onOpenChange?: (o: boolean) => void;
  onAdd?: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="パスキーを足す"
      subtitle="この端末・スマホ・パスワード管理アプリに足せる"
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange?.(false)}>
            やめる
          </Button>
          <Button icon={<Fingerprint size={16} />} onClick={onAdd}>
            足す
          </Button>
        </>
      }
    >
      <TextField
        label="名前"
        name="passkey_name"
        defaultValue="MacBook Pro（Chrome）"
        hint="40 文字まで。あとで変えられる"
        error={error ?? undefined}
      />
      <NoteBox>「足す」を押すと、端末が指・顔・PC のロックを求めます。人と共用の端末には足さないでください</NoteBox>
    </Dialog>
  );
}

/** パスキーの名前を変える */
export function RenamePasskeyDialog({
  open,
  name,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="パスキーの名前を変える"
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange?.(false)}>
            やめる
          </Button>
          <Button>変える</Button>
        </>
      }
    >
      <TextField label="名前" name="passkey_name" defaultValue={name} hint="40 文字まで" />
    </Dialog>
  );
}

/** パスキーを外す（最後の入り方なら外せない理由を出し、外すボタンを押せない） */
export function RemovePasskeyConfirm({
  open,
  name,
  blocked,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  /** 外せない理由（最後の 1 つ・取り直しが要る のエラーの文。番号は口の葉が errors.json に足す）。在れば外すを押せない */
  blocked?: string | null;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Confirm
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={() => onOpenChange(false)}
      title="このパスキーを外しますか？"
      description={`「${name}」では入れなくなります。入っている端末は切れません`}
      confirmLabel="外す"
      tone="danger"
      caution={blocked ? [blocked] : undefined}
      confirmDisabled={Boolean(blocked)}
    />
  );
}

/** 本人確認の取り直し（StepUpDialog・D-128.162。外す・パスワードを変える・2 段階を始める の前） */
export function StepUpDialog({
  open,
  reason,
  withCode,
  error,
  onOpenChange,
}: {
  open: boolean;
  reason: string;
  withCode: boolean;
  error?: string | null;
  onOpenChange?: (o: boolean) => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="本人か確かめます"
      subtitle={reason}
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange?.(false)}>
            やめる
          </Button>
          <Button>確かめる</Button>
        </>
      }
    >
      <PasswordField
        label="パスワード"
        name="current_password"
        autoComplete="current-password"
        error={error ?? undefined}
      />
      {withCode ? (
        <>
          <p className="k-auth-note">認証アプリの 6 けた</p>
          <CodeBoxes code={["", "", "", "", "", ""]} onCode={() => undefined} inputs={inputs} />
        </>
      ) : null}
      <NoteBox>パスキーがあれば、パスワードの代わりにパスキーで確かめられます</NoteBox>
    </Dialog>
  );
}

/** 2 段階認証を付ける（キャンバス MeTotp・Me2FA：本人確認 → QR → 6 けた） */
export function TotpDialog({
  open,
  qrSvg,
  secret,
  code = ["", "", "", "", "", ""],
  error,
  onOpenChange,
}: {
  open: boolean;
  qrSvg: string;
  secret: string;
  code?: readonly string[];
  error?: string | null;
  onOpenChange?: (o: boolean) => void;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      size="connect"
      title="2 段階認証を付ける"
      subtitle="付けると、入るたびに認証アプリの 6 けたも打つ"
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange?.(false)}>
            やめる
          </Button>
          <Button>確かめる</Button>
        </>
      }
    >
      <Steps
        items={[
          { title: "本人確認", desc: "パスワードで確かめました", state: "done" },
          {
            title: "認証アプリで QR を読み取る（この 1 回だけ）",
            state: "done",
            body: (
              <div className="k-set-step-body">
                <QrBox svg={qrSvg} label="認証アプリで読み取る QR" />
                <span>
                  Google Authenticator・1Password などで読み取る
                  <br />
                  読み取れないときは手で入れる：
                  <br />
                  <SecretText>{secret}</SecretText>
                </span>
              </div>
            ),
          },
          {
            title: "アプリに出た 6 けたを入れる",
            state: "now",
            body: (
              <>
                <CodeBoxes code={code} onCode={() => undefined} inputs={inputs} />
                {error ? (
                  <p role="alert" className="k-login-alert">
                    {error}
                  </p>
                ) : (
                  <p className="k-auth-note">合っていれば、バックアップコードが出て、付け終わる</p>
                )}
              </>
            ),
          },
        ]}
      />
    </Dialog>
  );
}

/** バックアップコード（キャンバス MeBackup：いまだけ表示） */
export function BackupDialog({
  open,
  codes,
  onOpenChange,
}: {
  open: boolean;
  codes: readonly string[];
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="バックアップコード"
      subtitle="端末をなくしたときに入るためのコード。いまだけ表示する"
      actions={<Button>保存したので閉じる</Button>}
    >
      <BackupCodes
        codes={codes}
        actions={
          <>
            <RowButton>ダウンロード（.txt）</RowButton>
            <RowButton>写す</RowButton>
            <RowButton>印刷</RowButton>
          </>
        }
      />
      <NoteBox>
        <b>この画面を閉じると、二度と表示されません。</b>
        パスワード管理アプリか、紙に書いて安全な所にしまってください。1 つは 1 回だけ使えます
      </NoteBox>
    </Dialog>
  );
}

/** パスワードを変える（今の画面は残し、ほかの端末・ワークスペース・PC は切る・D-128.141） */
export function ChangePasswordDialog({
  open,
  error,
  hasPassword = true,
  onOpenChange,
}: {
  open: boolean;
  /** パスワードが無い人（パスキーだけ）は「パスワードを決める」：今のパスワードの欄を出さない（answer=9177d9dbe0d9 ②） */
  hasPassword?: boolean;
  error?: string | null;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={hasPassword ? "パスワードを変える" : "パスワードを決める"}
      subtitle={
        hasPassword
          ? "変えると、この画面のほかの端末と PC はすべて入り直しになる"
          : "パスキーに加えて、パスワードでも入れるようになる。決めたら 2 段階認証も付けられる"
      }
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange?.(false)}>
            やめる
          </Button>
          <Button>{hasPassword ? "変える" : "決める"}</Button>
        </>
      }
    >
      {hasPassword ? (
        <PasswordField label="今のパスワード" name="current_password" autoComplete="current-password" />
      ) : null}
      <PasswordField
        label="新しいパスワード"
        name="new_password"
        autoComplete="new-password"
        hint="12 文字以上・漏れたことのあるパスワードは使えない"
      />
      <PasswordField
        label="もう一度"
        name="new_password_again"
        autoComplete="new-password"
        error={error ?? undefined}
      />
    </Dialog>
  );
}

/** 外枠の中の本文の頭（題と補足）。外枠は呼ぶ側（本番は TicketShell、モックは Shell） */
export function SecurityHead({ children }: { children?: ReactNode }) {
  return (
    <header className="k-page-head">
      <h1 id="security-title">ログインと安全</h1>
      <p className="k-desc">大事な変更の前には、本人確認を取り直す</p>
      {children}
    </header>
  );
}
