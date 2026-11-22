"use client";
// 預けたログイン情報の画面の見た目（段 4・K-56 の下絵・枝 c/段4）。部品先行のモックと本番が同じこの部品を使う。動き（口を呼ぶ・押した後）は持たない。
//   キャンバス MeSecrets・MeSecretAdd・MeSecretEdit（04_design/canvas_gen/me.py）。代表の答え answer=ac0813ee7c21：
//   ① 扱うのは秘密だけ（ログイン情報と API キー）② 預ける先はワークスペースと個人（同じ名前なら個人が勝つ）
//   ③ 預けた後に PC が 1 回ログインして確かめる（結果を行に・コードを入れる所）④ 見本のチケットは入れない
//   代表の答え answer=e34268dbfbac：上書きでログイン情報を替えるときは ID とパスワードを両方入れ直す（上書きの小窓に「新しいログイン ID」）・
//   使われ方は「これまでに N 回 ・ 最後 MM/DD」だけ（使うもの・この 1 か月の回数・チケット番号は出さない）
//   段 1・段 2 の部品（components/k・setting-parts・auth-parts・F1/security の本人確認の取り直し）だけで組み、新しい見た目を書かない
import type { ChangeEvent, ReactNode } from "react";
import { KeyRound } from "lucide-react";
import { Button, Confirm, Dialog, PasswordField, Select, Tabs, TextField } from "@/components/k";
import { NoteBox, ResultBox } from "@/components/k/auth-parts";
import { Pill, RowButton, SettingCard, SettingNote, SettingRow, type PillTone } from "@/components/k/setting-parts";

/** ログインの確かめの結果（D-117・PC が 1 回ログインして確かめる） */
export type CheckState =
  | "ok"
  | "unchecked"
  | "checking"
  | "bad_password"
  | "needs_code"
  | "captcha"
  | "forbidden"
  | "no_pc"
  | "stopped"
  | "expiring";

export const CHECK_LABEL: Record<CheckState, { tone: PillTone; label: string }> = {
  ok: { tone: "success", label: "使える" },
  unchecked: { tone: "neutral", label: "まだ確かめていない" },
  checking: { tone: "neutral", label: "確かめている" },
  bad_password: { tone: "warning", label: "パスワードが違う" },
  needs_code: { tone: "warning", label: "コードが要る" },
  captcha: { tone: "warning", label: "画像の確認で止まった" },
  forbidden: { tone: "neutral", label: "規約で禁止・試さない" },
  no_pc: { tone: "neutral", label: "PC がつながると確かめる" },
  stopped: { tone: "warning", label: "止まった" },
  expiring: { tone: "warning", label: "期限が近い" },
};

export interface CredentialItem {
  id: string;
  /** 名前（英大文字と _。分身はこの名前で頼む） */
  name: string;
  description: string | null;
  /** ログイン情報（ID とパスワード）か、API キー・値 */
  kind: "login" | "key";
  /** 使える場所（宛先のドメイン） */
  destinations: readonly string[];
  /** 使われ方（「これまでに N 回 ・ 最後 MM/DD」・今日なら「最後 今日」・使っていなければ「まだ使っていない」） */
  usage: string;
  state: CheckState;
  /** 状態の補足（期限の日・止まった理由 など） */
  note?: string | null;
  /** 書ける（上書き・消すを押せる）。false は灰色（ワークスペースの物で書けない人）。既定は書ける */
  canEdit?: boolean;
}

export interface CredentialsBodyProps {
  /** ワークスペース（タブの 1 つ目）と個人（2 つ目）の名前 */
  workspaceName: string;
  personalName: string;
  /** 開いているタブ（"workspace" か "personal"） */
  tab: "workspace" | "personal";
  items: readonly CredentialItem[];
  /** 一覧を読めなかった（口の失敗） */
  failed?: boolean;
  /** タブを替えた（入れ物がタブを持つ。口は呼び直さない） */
  onTab?: (tab: "workspace" | "personal") => void;
  /** 行の操作（上書き・消す・コードを入れる・もう一度確かめる）を押せる。既定は押せない灰色 */
  rowActionsReady?: boolean;
  /** 「もう一度確かめる」を送っている行（答えまで押せない） */
  recheckingId?: string | null;
  onAdd?: () => void;
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
  onRecheck?: (id: string) => void;
  onCode?: (id: string) => void;
}

/** 見出し。「預ける」は出すが、addReady が無ければ灰色で押せない（押せるようにするのは預ける小窓の葉・D-145.9） */
export function CredentialsHead({ onAdd, addReady = false }: { onAdd?: () => void; addReady?: boolean }) {
  return (
    <header className="k-page-head">
      <h1 id="credentials-title">預けたログイン情報</h1>
      <p className="k-desc">分身が使うパスワードと鍵。名前で呼び、値は誰にも見せない</p>
      <Button icon={<KeyRound size={16} />} onClick={onAdd} disabled={!addReady}>
        預ける
      </Button>
    </header>
  );
}

/** もう一度確かめるを出す札（ログイン情報だけ。鍵は確かめる物が無い） */
const RECHECKABLE: readonly CheckState[] = ["bad_password", "captcha", "stopped", "unchecked"];

function rowActions(it: CredentialItem, p: CredentialsBodyProps): ReactNode {
  const off = !p.rowActionsReady;
  const locked = off || it.canEdit === false;
  return (
    <>
      {it.state === "needs_code" ? (
        <RowButton variant="primary" disabled={off} onClick={() => p.onCode?.(it.id)}>
          コードを入れる
        </RowButton>
      ) : null}
      {it.kind === "login" && RECHECKABLE.includes(it.state) ? (
        <RowButton disabled={off || p.recheckingId === it.id} onClick={() => p.onRecheck?.(it.id)}>
          もう一度確かめる
        </RowButton>
      ) : null}
      <RowButton disabled={locked} onClick={() => p.onEdit?.(it.id)}>
        上書き
      </RowButton>
      <RowButton disabled={locked} onClick={() => p.onRemove?.(it.id)}>
        消す
      </RowButton>
    </>
  );
}

function List({ p }: { p: CredentialsBodyProps }) {
  if (p.failed)
    return (
      <ResultBox tone="bad">
        預けたログイン情報を読めませんでした。少し待ってから、このページをもう一度開いてください
      </ResultBox>
    );
  if (p.items.length === 0)
    return (
      <SettingCard title="まだ預けていません" labelledBy="cred-empty">
        <SettingNote>
          分身にログインさせたいサービスのパスワードや API キーを、名前を付けて預けます。値は PC
          の実行器だけが使い、画面にも分身の会話にも出ません
        </SettingNote>
      </SettingCard>
    );
  return (
    <SettingCard title={`${p.items.length} 件`} labelledBy="cred-list">
      {p.items.map((it) => (
        <SettingRow
          key={it.id}
          icon={<KeyRound size={18} />}
          name={<code>{it.name}</code>}
          detail={
            <>
              {it.description ?? (it.kind === "login" ? "ログイン情報" : "API キー・値")}
              {it.destinations.length ? <> ・ 使える場所：{it.destinations.join("・")}</> : null}
              <br />
              {it.usage}
              {it.note ? <> ・ {it.note}</> : null}
            </>
          }
          pill={<Pill tone={CHECK_LABEL[it.state].tone}>{CHECK_LABEL[it.state].label}</Pill>}
          actions={rowActions(it, p)}
        />
      ))}
    </SettingCard>
  );
}

/** 本文：値は見えない の知らせ・ワークスペースと個人のタブ・一覧 */
export function CredentialsBody(p: CredentialsBodyProps) {
  return (
    <>
      <NoteBox>
        保存した値はあなたにも分身にも見えません。分身は名前で頼むだけで、値を入れるのは PC
        の実行器です。入れてよいのは「使える場所」だけ。預けたら PC が 1 回ログインして確かめます
      </NoteBox>
      <Tabs
        label="預ける先"
        value={p.tab}
        onValueChange={(v) => p.onTab?.(v === "personal" ? "personal" : "workspace")}
        items={[
          { value: "workspace", label: "ワークスペース", panel: p.tab === "workspace" ? <List p={p} /> : null },
          { value: "personal", label: "自分だけ", panel: p.tab === "personal" ? <List p={p} /> : null },
        ]}
      />
      {/* 注は li なので ul の中に置く（一覧の項目として読み上げられる・カードの中の注と同じ並びの形） */}
      <ul className="k-set-list">
        <SettingNote>
          ワークスペース（{p.workspaceName}）の物は、ここの分身みんなが使えます。自分だけ（{p.personalName}
          ）の物は、あなたの分身の実行でだけ使えます。同じ名前が両方にあれば、自分だけの方を使います
        </SettingNote>
      </ul>
    </>
  );
}

/** 2 段階の種類（ログイン情報のときだけ） */
export type CredentialTwoFactor = "none" | "totp" | "sms" | "email" | "push";
/** 預ける小窓の欄（口の欄の名前と同じ。欄ごとの文はこの名前で受ける） */
export type CredentialField =
  | "name"
  | "description"
  | "login"
  | "password"
  | "value"
  | "two_factor"
  | "totp_secret"
  | "destinations"
  | "expires_on";
/** 預ける小窓に入れた値（入れたままの字。直し方と送る形は入れ物が持つ） */
export interface AddCredentialValues {
  kind: "login" | "key";
  layer: "workspace" | "personal";
  name: string;
  description: string;
  login: string;
  password: string;
  value: string;
  two_factor: CredentialTwoFactor;
  totp_secret: string;
  destinations: string;
  expires_on: string;
}
/** 開いたときの値：ログイン情報・ワークスペース・2 段階 なし・欄は空 */
export const EMPTY_CREDENTIAL: AddCredentialValues = {
  kind: "login",
  layer: "workspace",
  name: "",
  description: "",
  login: "",
  password: "",
  value: "",
  two_factor: "none",
  totp_secret: "",
  destinations: "",
  expires_on: "",
};
export type AddCredentialErrors = Partial<Record<CredentialField, string>>;

const TWO_FACTORS: readonly CredentialTwoFactor[] = ["none", "totp", "sms", "email", "push"];
const asTwoFactor = (v: string | null): CredentialTwoFactor => TWO_FACTORS.find((t) => t === v) ?? "none";

/** 預ける（小窓）。種類：ログイン情報（ID・パスワード・2 段階の種類）／API キー・値。
 *  欄はブラウザの自動入力と保存を止める（本人の Kaname のパスワードを外のサイトの物として預けない・外のサイトの値をブラウザに残さない・D-128.57）。
 *  値と押す関数は入れ物（本番は credentials-screen・モックは mocks.tsx）が渡す。error は小窓の赤の知らせ（口の文） */
export function AddCredentialDialog({
  open,
  values,
  workspaceName,
  errors,
  error,
  busy = false,
  onValue,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  values: AddCredentialValues;
  workspaceName: string;
  errors?: AddCredentialErrors;
  error?: string | null;
  busy?: boolean;
  /** 欄を替えた（替えた欄だけ） */
  onValue?: (patch: Partial<AddCredentialValues>) => void;
  onSubmit?: () => void;
  onOpenChange?: (o: boolean) => void;
}) {
  const v = values;
  const text = (
    k: "name" | "description" | "login" | "password" | "value" | "totp_secret" | "destinations" | "expires_on",
  ) => ({
    value: v[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => onValue?.({ [k]: e.target.value }),
    error: errors?.[k],
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && busy) return; // 送っている間は閉じない
        onOpenChange?.(o);
      }}
      title="ログイン情報を預ける"
      subtitle="保存したら、値は二度と見られない"
      actions={
        <>
          <Button variant="outlined" disabled={busy} onClick={() => onOpenChange?.(false)}>
            やめる
          </Button>
          <Button loading={busy} onClick={onSubmit}>
            本人確認して保存
          </Button>
        </>
      }
    >
      {error ? <ResultBox tone="bad">{error}</ResultBox> : null}
      <Select
        label="種類"
        name="kind"
        value={v.kind}
        onValueChange={(k) => onValue?.({ kind: k === "key" ? "key" : "login" })}
        options={[
          { value: "login", label: "ログイン情報（ID とパスワード）" },
          { value: "key", label: "API キー・値" },
        ]}
      />
      <TextField label="名前" name="name" hint="英大文字と _。分身はこの名前で頼む" {...text("name")} />
      <TextField label="説明（任意）" name="description" {...text("description")} />
      {v.kind === "login" ? (
        <>
          <TextField label="ログイン ID" name="login" autoComplete="off" {...text("login")} />
          <PasswordField label="パスワード" name="password" autoComplete="new-password" {...text("password")} />
          <Select
            label="2 段階の種類"
            name="two_factor"
            value={v.two_factor}
            onValueChange={(t) => onValue?.({ two_factor: asTwoFactor(t) })}
            error={errors?.two_factor}
            description="SMS・メール・スマホのときは、確かめるときに PC が止まってあなたにコードを頼む"
            options={[
              { value: "none", label: "なし" },
              { value: "totp", label: "認証アプリ（鍵を預ける）" },
              { value: "sms", label: "SMS" },
              { value: "email", label: "メール" },
              { value: "push", label: "スマホのアプリで承認" },
            ]}
          />
          {v.two_factor === "totp" ? (
            <PasswordField
              label="認証アプリの鍵"
              name="totp_secret"
              autoComplete="new-password"
              {...text("totp_secret")}
            />
          ) : null}
        </>
      ) : (
        <PasswordField label="値" name="value" autoComplete="new-password" {...text("value")} />
      )}
      <TextField
        label="使える場所"
        name="destinations"
        hint="この宛先にだけ入れる・送る。ほかの所では使わない（カンマで複数）"
        {...text("destinations")}
      />
      <Select
        label="預ける先"
        name="layer"
        value={v.layer}
        onValueChange={(l) => onValue?.({ layer: l === "personal" ? "personal" : "workspace" })}
        options={[
          { value: "workspace", label: workspaceName },
          { value: "personal", label: "自分だけ" },
        ]}
      />
      <TextField label="期限（任意）" name="expires_on" hint="近づいたら知らせる" {...text("expires_on")} />
      <NoteBox>保存の前にパスキーで本人確認を取り直します（15 分の内に確かめていれば省きます）</NoteBox>
    </Dialog>
  );
}

/** 上書きの小窓に入れた値（入れたままの字。直し方と送る形は入れ物が持つ） */
export interface EditCredentialValues {
  login: string;
  password: string;
  value: string;
  destinations: string;
  expires_on: string;
  reason: string;
}
export type EditCredentialField = keyof EditCredentialValues;
export type EditCredentialErrors = Partial<Record<EditCredentialField, string>>;

/** 上書き（小窓）：新しい値（ログイン情報は新しいログイン ID と新しいパスワードの両方）・使える場所・期限・なぜ上書きするか。
 *  値と押す関数は入れ物（本番は edit-credential・モックは mocks.tsx）が渡す。error は小窓の赤の知らせ（口の文） */
export function EditCredentialDialog({
  open,
  item,
  values,
  errors,
  error,
  busy = false,
  onValue,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  item: CredentialItem;
  values: EditCredentialValues;
  errors?: EditCredentialErrors;
  error?: string | null;
  busy?: boolean;
  onValue?: (patch: Partial<EditCredentialValues>) => void;
  onSubmit?: () => void;
  onOpenChange?: (o: boolean) => void;
}) {
  const text = (k: EditCredentialField) => ({
    value: values[k],
    onChange: (e: ChangeEvent<HTMLInputElement>) => onValue?.({ [k]: e.target.value }),
    error: errors?.[k],
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && busy) return; // 送っている間は閉じない
        onOpenChange?.(o);
      }}
      title={`${item.name} を上書きする`}
      subtitle="前の値は消え、戻せない。見ることもできない"
      actions={
        <>
          <Button variant="outlined" disabled={busy} onClick={() => onOpenChange?.(false)}>
            やめる
          </Button>
          <Button loading={busy} onClick={onSubmit}>
            本人確認して上書き
          </Button>
        </>
      }
    >
      {error ? <ResultBox tone="bad">{error}</ResultBox> : null}
      {item.kind === "login" ? (
        <>
          <TextField
            label="新しいログイン ID"
            name="login"
            hint="パスワードだけを替えるときも、ID とパスワードを両方入れる"
            autoComplete="off"
            {...text("login")}
          />
          <PasswordField label="新しいパスワード" name="password" autoComplete="new-password" {...text("password")} />
        </>
      ) : (
        <PasswordField label="新しい値" name="value" autoComplete="new-password" {...text("value")} />
      )}
      <TextField label="使える場所" name="destinations" {...text("destinations")} />
      <TextField label="期限（任意）" name="expires_on" {...text("expires_on")} />
      <TextField label="なぜ上書きするか（任意・記録に残る）" name="reason" {...text("reason")} />
      <NoteBox>このあと実行される分から新しい値を使います。上書きしたら、PC がもう一度ログインして確かめます</NoteBox>
    </Dialog>
  );
}

/** 消す（確かめ）。error は確かめの小窓の赤の知らせ（口の文・閉じない） */
export function RemoveCredentialConfirm({
  open,
  name,
  error,
  busy = false,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  error?: string | null;
  busy?: boolean;
  onConfirm?: () => void;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Confirm
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm ?? (() => onOpenChange(false))}
      busy={busy}
      title={`${name} を消しますか？`}
      description="分身はこの名前を使えなくなります。いま実行中のものも、次に使う時点で止まります"
      confirmLabel="消す"
      tone="danger"
      caution={["消した値は戻せません。同じ名前でもう一度預けられます"]}
    >
      {error ? <ResultBox tone="bad">{error}</ResultBox> : null}
    </Confirm>
  );
}

/** 確かめの途中で PC がコードを頼んでいる（SMS・メール・スマホ）。コードは PC にだけ渡る（D-117）。
 *  error はコードの欄の下の文（形の誤り）、alert は小窓の赤の知らせ（ほかの失敗） */
export function CheckCodeDialog({
  open,
  name,
  via,
  code = "",
  error,
  alert,
  busy = false,
  onCode,
  onSubmit,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  via: "sms" | "email" | "push";
  code?: string;
  error?: string | null;
  alert?: string | null;
  busy?: boolean;
  onCode?: (code: string) => void;
  onSubmit?: () => void;
  onOpenChange?: (o: boolean) => void;
}) {
  const how = via === "sms" ? "SMS で届いた" : via === "email" ? "メールで届いた" : "スマホのアプリの";
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && busy) return; // 送っている間は閉じない
        onOpenChange?.(o);
      }}
      title={`${name} のコードを入れる`}
      subtitle={`PC がログインの途中で止まっています。${how}コードを入れてください`}
      actions={
        <>
          <Button variant="outlined" disabled={busy} onClick={() => onOpenChange?.(false)}>
            あとで
          </Button>
          <Button loading={busy} onClick={onSubmit}>
            PC に渡す
          </Button>
        </>
      }
    >
      {alert ? <ResultBox tone="bad">{alert}</ResultBox> : null}
      {via === "push" ? (
        <NoteBox>スマホのアプリで「承認」を押してから、「PC に渡す」を押してください</NoteBox>
      ) : (
        <TextField
          label="コード"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={code}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onCode?.(e.target.value)}
          error={error ?? undefined}
        />
      )}
      <NoteBox>コードは PC にだけ渡り、Kaname には残りません。10 分のあいだに入れないと、確かめを止めます</NoteBox>
    </Dialog>
  );
}
