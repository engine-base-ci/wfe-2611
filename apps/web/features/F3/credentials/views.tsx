"use client";
// 預けたログイン情報の画面の見た目（段 4・K-56 の下絵・枝 c/段4）。部品先行のモックと本番が同じこの部品を使う。動き（口を呼ぶ・押した後）は持たない。
//   キャンバス MeSecrets・MeSecretAdd・MeSecretEdit（04_design/canvas_gen/me.py）。代表の答え answer=ac0813ee7c21：
//   ① 扱うのは秘密だけ（ログイン情報と API キー）② 預ける先はワークスペースと個人（同じ名前なら個人が勝つ）
//   ③ 預けた後に PC が 1 回ログインして確かめる（結果を行に・コードを入れる所）④ 見本のチケットは入れない
//   代表の答え answer=e34268dbfbac：上書きでログイン情報を替えるときは ID とパスワードを両方入れ直す（上書きの小窓に「新しいログイン ID」）・
//   使われ方は「これまでに N 回 ・ 最後 MM/DD」だけ（使うもの・この 1 か月の回数・チケット番号は出さない）
//   段 1・段 2 の部品（components/k・setting-parts・auth-parts・F1/security の本人確認の取り直し）だけで組み、新しい見た目を書かない
import type { ReactNode } from "react";
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
  /** 行の操作（上書き・消す・コードを入れる・もう一度確かめる）を押せる。既定は押せない灰色（押せるようにするのは上書きと確かめの葉） */
  rowActionsReady?: boolean;
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

function rowActions(it: CredentialItem, p: CredentialsBodyProps): ReactNode {
  const off = !p.rowActionsReady;
  return (
    <>
      {it.state === "needs_code" ? (
        <RowButton variant="primary" disabled={off} onClick={() => p.onCode?.(it.id)}>
          コードを入れる
        </RowButton>
      ) : null}
      {it.state === "bad_password" || it.state === "captcha" ? (
        <RowButton disabled={off} onClick={() => p.onRecheck?.(it.id)}>
          もう一度確かめる
        </RowButton>
      ) : null}
      <RowButton disabled={off} onClick={() => p.onEdit?.(it.id)}>
        上書き
      </RowButton>
      <RowButton disabled={off} onClick={() => p.onRemove?.(it.id)}>
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

/** 預ける（小窓）。種類：ログイン情報（ID・パスワード・2 段階の種類）／API キー・値 */
export function AddCredentialDialog({
  open,
  kind,
  workspaceName,
  errors,
  onOpenChange,
}: {
  open: boolean;
  kind: "login" | "key";
  workspaceName: string;
  errors?: { name?: string; value?: string; destinations?: string };
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="ログイン情報を預ける"
      subtitle="保存したら、値は二度と見られない"
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange?.(false)}>
            やめる
          </Button>
          <Button>本人確認して保存</Button>
        </>
      }
    >
      <Select
        label="種類"
        name="kind"
        value={kind}
        options={[
          { value: "login", label: "ログイン情報（ID とパスワード）" },
          { value: "key", label: "API キー・値" },
        ]}
      />
      <TextField
        label="名前"
        name="name"
        defaultValue={kind === "login" ? "HACCHU_NAVI_LOGIN" : "FREEE_API_KEY"}
        hint="英大文字と _。分身はこの名前で頼む"
        error={errors?.name}
      />
      <TextField
        label="説明（任意）"
        name="description"
        defaultValue={kind === "login" ? "発注ナビのログイン" : "会計ソフトの API キー"}
      />
      {kind === "login" ? (
        <>
          <TextField label="ログイン ID" name="login" defaultValue="takamoto@engine-base.example" />
          <PasswordField label="パスワード" name="password" error={errors?.value} />
          <Select
            label="2 段階の種類"
            name="two_factor"
            value="sms"
            description="SMS・メール・スマホのときは、確かめるときに PC が止まってあなたにコードを頼む"
            options={[
              { value: "none", label: "なし" },
              { value: "totp", label: "認証アプリ（鍵を預ける）" },
              { value: "sms", label: "SMS" },
              { value: "email", label: "メール" },
              { value: "push", label: "スマホのアプリで承認" },
            ]}
          />
        </>
      ) : (
        <PasswordField label="値" name="value" error={errors?.value} />
      )}
      <TextField
        label="使える場所"
        name="destinations"
        defaultValue={kind === "login" ? "hacchu-navi.example" : "api.freee.co.jp"}
        hint="この宛先にだけ入れる・送る。ほかの所では使わない（カンマで複数）"
        error={errors?.destinations}
      />
      <Select
        label="預ける先"
        name="scope"
        value="workspace"
        options={[
          { value: "workspace", label: workspaceName },
          { value: "personal", label: "自分だけ" },
        ]}
      />
      <TextField label="期限（任意）" name="expires_at" defaultValue="2027/11/10" hint="近づいたら知らせる" />
      <NoteBox>保存の前にパスキーで本人確認を取り直します（15 分の内に確かめていれば省きます）</NoteBox>
    </Dialog>
  );
}

/** 上書き（小窓）：新しい値（ログイン情報は新しいログイン ID と新しいパスワードの両方）・使える場所・期限・なぜ上書きするか */
export function EditCredentialDialog({
  open,
  item,
  onOpenChange,
}: {
  open: boolean;
  item: CredentialItem;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${item.name} を上書きする`}
      subtitle="前の値は消え、戻せない。見ることもできない"
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange?.(false)}>
            やめる
          </Button>
          <Button>本人確認して上書き</Button>
        </>
      }
    >
      {item.kind === "login" ? (
        <>
          <TextField
            label="新しいログイン ID"
            name="login"
            hint="パスワードだけを替えるときも、ID とパスワードを両方入れる"
          />
          <PasswordField label="新しいパスワード" name="password" />
        </>
      ) : (
        <PasswordField label="新しい値" name="value" />
      )}
      <TextField label="使える場所" name="destinations" defaultValue={item.destinations.join(", ")} />
      <TextField label="期限（任意）" name="expires_at" defaultValue="2027/11/10" />
      <TextField
        label="なぜ上書きするか（任意・記録に残る）"
        name="reason"
        defaultValue={item.kind === "login" ? "サービスの側でパスワードを変えたため" : "会計ソフトで作り直したため"}
      />
      <NoteBox>このあと実行される分から新しい値を使います。上書きしたら、PC がもう一度ログインして確かめます</NoteBox>
    </Dialog>
  );
}

/** 消す（確かめ） */
export function RemoveCredentialConfirm({
  open,
  name,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  onOpenChange: (o: boolean) => void;
}) {
  return (
    <Confirm
      open={open}
      onOpenChange={onOpenChange}
      onConfirm={() => onOpenChange(false)}
      title={`${name} を消しますか？`}
      description="分身はこの名前を使えなくなります。いま実行中のものも、次に使う時点で止まります"
      confirmLabel="消す"
      tone="danger"
      caution={["消した値は戻せません。同じ名前でもう一度預けられます"]}
    />
  );
}

/** 確かめの途中で PC がコードを頼んでいる（SMS・メール）。コードは PC にだけ渡る（D-117） */
export function CheckCodeDialog({
  open,
  name,
  via,
  error,
  onOpenChange,
}: {
  open: boolean;
  name: string;
  via: "sms" | "email" | "push";
  error?: string | null;
  onOpenChange?: (o: boolean) => void;
}) {
  const how = via === "sms" ? "SMS で届いた" : via === "email" ? "メールで届いた" : "スマホのアプリの";
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={`${name} のコードを入れる`}
      subtitle={`PC がログインの途中で止まっています。${how}コードを入れてください`}
      actions={
        <>
          <Button variant="outlined" onClick={() => onOpenChange?.(false)}>
            あとで
          </Button>
          <Button>PC に渡す</Button>
        </>
      }
    >
      {via === "push" ? (
        <NoteBox>スマホのアプリで「承認」を押してから、「PC に渡す」を押してください</NoteBox>
      ) : (
        <TextField
          label="コード"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          error={error ?? undefined}
        />
      )}
      <NoteBox>コードは PC にだけ渡り、Kaname には残りません。10 分のあいだに入れないと、確かめを止めます</NoteBox>
    </Dialog>
  );
}
