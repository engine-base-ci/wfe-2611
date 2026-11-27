"use client";
// 運営の人（段 13・領域 ops・キャンバス OpTeam）と運営のログイン。値を受け取って描くだけ（口は呼ばない）。
//   押す関数・行・字は任意の props で受ける（K-986）。渡さない呼び方（モック）は下絵のまま
import { Fingerprint, Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button, Callout, Confirm, Dialog, PageBody, PageHeader, TextField } from "@/components/k";
import { NoteBox } from "@/components/k/auth-parts";
import "@/features/F1/sign-up/sign-up.css";
import { CapMark, Note, Person } from "./ops-parts";
import { CAP_LABELS, TEAM, type TeamPerson } from "./ops-sample";
import { RespTable, type RespColumn } from "@/features/F12/shared/resp-table";
import "../shared/choice.css";

const noop = () => undefined;

/** 一覧の 1 行（下絵の TeamPerson に、画面が渡す id と名前の下の字を足した形） */
export type TeamRow = TeamPerson & { id?: string; sub?: string };
const keyOf = (t: TeamRow): string => t.id ?? t.name;

interface RowActs {
  onEdit?: (id: string) => void;
  onRemove?: (id: string) => void;
  /** 外すを押せない訳（null なら押せる） */
  rowLock?: (id: string) => string | null;
}

function columnsOf({ onEdit, onRemove, rowLock }: RowActs): RespColumn<TeamRow>[] {
  return [
    {
      key: "who",
      header: "人",
      cell: (t) => (
        <Person initial={t.initial} sub={t.sub ?? `${t.role} ・ パスキー`}>
          {t.name}
        </Person>
      ),
    },
    ...CAP_LABELS.map((label, i) => ({
      key: `cap-${i}`,
      header: label,
      cell: (t: TeamRow) => <CapMark on={t.caps[i] === true} label={label} />,
    })),
    {
      key: "act",
      header: <span className="sr-only">操作</span>,
      card: "action",
      cell: (t) => {
        const lock = rowLock?.(keyOf(t)) ?? null;
        return (
          <span className="k-op-rowacts">
            <Button
              size="sm"
              variant="outlined"
              aria-label={`${t.name} さんのできることを変える`}
              onClick={() => onEdit?.(keyOf(t))}
            >
              変える
            </Button>
            <Button
              size="sm"
              variant="outlined"
              aria-label={`${t.name} さんを外す`}
              {...(lock ? { "aria-disabled": "true", title: lock } : {})}
              onClick={() => {
                if (!lock) onRemove?.(keyOf(t));
              }}
            >
              外す
            </Button>
          </span>
        );
      },
    },
  ];
}

export interface TeamPageProps extends RowActs {
  onAdd?: () => void;
  /** 一覧（渡さなければ下絵の 3 人） */
  rows?: readonly TeamRow[];
  /** 足した・外した後の知らせ（role=status） */
  status?: string | null;
}

/** 運営の人の一覧（できることの印・パスキー） */
export function TeamPage({ onAdd, rows, status, onEdit, onRemove, rowLock }: TeamPageProps) {
  return (
    <PageBody labelledBy="op-team-title">
      <PageHeader
        id="op-team-title"
        title="運営の人"
        sub="運営の場所に入れる人と、できること"
        actions={
          <Button icon={<Plus size={14} />} onClick={onAdd}>
            運営の人を足す
          </Button>
        }
      />
      <div className="k-op-body">
        {status ? (
          <p role="status" className="k-op-note-text">
            {status}
          </p>
        ) : null}
        <RespTable
          stack="wide"
          caption="運営の人とできること"
          columns={columnsOf({
            ...(onEdit ? { onEdit } : {}),
            ...(onRemove ? { onRemove } : {}),
            ...(rowLock ? { rowLock } : {}),
          })}
          rows={[...(rows ?? TEAM)]}
          rowKey={keyOf}
        />
        <Note>
          運営の人はパスキーでしか入れない。値段は案を作る人と決める人を分ける（自分の案は自分で決められない。「値段を決める」ができる人が
          1
          人しかいない間だけ、本人確認を取り直して自分で決められる）。「中を見る」「止める」「入金を記録」「値段を決める」の前には本人確認を取り直す。
          運営の人の操作はすべて、その相手のワークスペースの「記録」に残る
        </Note>
      </div>
    </PageBody>
  );
}

function CheckChoice({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (on: boolean) => void;
}) {
  return (
    <label className="k-op-choice" data-disabled={disabled || undefined}>
      {onChange ? (
        <input
          type="checkbox"
          name="caps"
          value={label}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
      ) : (
        <input type="checkbox" name="caps" value={label} defaultChecked={checked} disabled={disabled} />
      )}
      <span className="k-op-choice-text">
        <b>{label}</b>
      </span>
    </label>
  );
}

function CapChoices({
  caps,
  disabled,
  onChange,
}: {
  caps: readonly boolean[];
  disabled?: boolean;
  onChange?: (caps: boolean[]) => void;
}) {
  return (
    <fieldset className="k-op-fieldset">
      <legend>できること</legend>
      <div className="k-op-checks">
        {CAP_LABELS.map((l, i) => (
          <CheckChoice
            key={l}
            label={l}
            checked={caps[i] === true}
            {...(disabled ? { disabled } : {})}
            {...(onChange ? { onChange: (on: boolean) => onChange(caps.map((c, j) => (j === i ? on : c))) } : {})}
          />
        ))}
      </div>
    </fieldset>
  );
}

const ADD_DEFAULT: readonly boolean[] = [true, false, false, false, false, false, false, false, false];

export interface TeamAddDialogProps {
  onClose?: () => void;
  /** 開いているか（既定は開く。取り直しの間は閉じて、入れた値を持ったまま戻す） */
  open?: boolean;
  /** 送っている間（2 回目を送らない） */
  busy?: boolean;
  /** 招待を送る（渡さなければ下絵のまま・送らない） */
  onSend?: (v: { email: string; caps: boolean[] }) => void;
  /** 断られた字（小窓の中に出す） */
  alert?: string | null;
}

/** 運営の人を足す小窓：メール・できること 9 つ・パスキーの登録の案内 */
export function TeamAddDialog({ onClose = noop, open = true, busy = false, onSend, alert }: TeamAddDialogProps) {
  const [email, setEmail] = useState("");
  const [caps, setCaps] = useState<boolean[]>([...ADD_DEFAULT]);
  const live = onSend !== undefined;
  const blocked = live && (email.trim() === "" || !caps.some(Boolean));
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="connect"
      title="運営の人を足す"
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          <Button
            loading={busy}
            {...(blocked ? { "aria-disabled": "true" } : {})}
            onClick={() => {
              if (live && !blocked && !busy) onSend({ email: email.trim(), caps });
            }}
          >
            招待を送る
          </Button>
        </>
      }
    >
      <div className="k-op-form">
        {live ? (
          <TextField
            label="メールアドレス"
            name="mail"
            type="email"
            placeholder="例：suzuki@kaname.example"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        ) : (
          <TextField label="メールアドレス" name="mail" type="email" placeholder="例：suzuki@kaname.example" />
        )}
        <CapChoices caps={live ? caps : ADD_DEFAULT} {...(live ? { onChange: setCaps } : {})} />
        <Callout tone="info" title="パスキーの登録">
          招待のメールのリンクから、本人がパスキーを登録します。登録するまでは運営の場所に入れません。足したことは記録に残ります
        </Callout>
        {alert ? (
          <p role="alert" className="k-op-alert">
            {alert}
          </p>
        ) : null}
      </div>
    </Dialog>
  );
}

/** 注意の箱の字 */
export interface TeamLockText {
  title: string;
  body: string;
}

export interface TeamEditDialogProps {
  onClose?: () => void;
  open?: boolean;
  /** 「<名前> ・ <役>」 */
  person?: string;
  /** その人のできること（9 つの順の真偽） */
  caps?: readonly boolean[];
  /** 押せない訳（自分・最後の 1 人）。null なら変えられる */
  locked?: TeamLockText | null;
  onSave?: (caps: boolean[]) => void;
  busy?: boolean;
  /** 口が断ったときの注意の箱 */
  alert?: TeamLockText | null;
}

const ME_LOCK: TeamLockText = {
  title: "この人のできることは変えられません",
  body: "自分のできることは自分では変えられません。また「運営の人」ができるのは高本さん 1 人だけなので、最後の 1 人として外すこともできません。 別の運営の人に「運営の人」を渡してから、その人に変えてもらってください",
};

/** できることを変える小窓：自分のは変えられない・最後の 1 人は外せない（渡さなければ高本さんが自分を開いた形） */
export function TeamEditDialog({
  onClose = noop,
  open = true,
  person,
  caps: initial,
  locked,
  onSave,
  busy = false,
  alert,
}: TeamEditDialogProps) {
  const live = onSave !== undefined;
  const lock = live ? (locked ?? null) : ME_LOCK;
  const [caps, setCaps] = useState<boolean[]>([...(initial ?? TEAM[0]?.caps ?? [])]);
  const box = alert ?? lock;
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      size="connect"
      title="できることを変える"
      target={person ?? "高本 聖斗 ・ 運営の管理者"}
      actions={
        <>
          <Button variant="outlined" onClick={onClose}>
            やめる
          </Button>
          {lock ? (
            <Button aria-disabled="true" disabled title={live ? lock.title : "自分のできることは変えられません"}>
              変える
            </Button>
          ) : (
            <Button
              loading={busy}
              {...(caps.some(Boolean) ? {} : { "aria-disabled": "true" })}
              onClick={() => {
                if (!busy && caps.some(Boolean)) onSave?.(caps);
              }}
            >
              変える
            </Button>
          )}
        </>
      }
    >
      <div className="k-op-form">
        <CapChoices caps={caps} {...(lock ? { disabled: true } : { onChange: setCaps })} />
        {box ? (
          <Callout tone="warn" title={box.title}>
            {box.body}
          </Callout>
        ) : null}
      </div>
    </Dialog>
  );
}

/** 外す確かめ（渡さなければ下絵の佐野さん） */
export function TeamRemoveConfirm({
  onClose = noop,
  onConfirm = noop,
  open = true,
  name = "佐野 美穂",
  busy = false,
}: {
  onClose?: () => void;
  onConfirm?: () => void;
  open?: boolean;
  name?: string;
  busy?: boolean;
}) {
  return (
    <Confirm
      open={open}
      onOpenChange={(o) => !o && onClose()}
      onConfirm={onConfirm}
      busy={busy}
      confirmLabel="外す"
      title={`${name} さんを運営の人から外す`}
      caution={["外すとすぐ、運営の場所に入れなくなります", "登録していたパスキーも使えなくなります"]}
      description="これまでの操作の記録は残ります。もう一度入れるには、運営の人を足し直します。外したことは記録に残ります"
    />
  );
}

/** 運営のログイン（パスキーで入る・パスキーしか使えない）。運営の外枠は出さない */
/** 運営のログイン。見本は押しても何もしない。本番の頁（app/(ops)/ops/login・K-946）が押したときの動きと押している間を渡す */
export function OpsLogin({
  failed = false,
  busy = false,
  onPasskey,
}: {
  failed?: boolean;
  busy?: boolean;
  onPasskey?: () => void;
}): ReactNode {
  return (
    <div className="k-root k-auth">
      <div className="k-auth-logo">
        <span className="k-auth-mark" aria-hidden="true">
          K
        </span>
        <b>Kaname</b>
        <span className="k-op-tag">運営</span>
      </div>
      <main className="k-auth-card" data-part="auth-box">
        <h1>運営のログイン</h1>
        <NoteBox>
          顧客の方は、こちらではなく Kaname のログインから入ってください。運営の場所は運営の人だけが入れます
        </NoteBox>
        <Button size="lg" icon={<Fingerprint size={18} />} loading={busy} onClick={onPasskey}>
          パスキーで入る
        </Button>
        <p className="k-auth-note">
          指・顔・PC のロックで入ります。運営の場所は、パスキーしか使えません（メールとパスワードでは入れません）
        </p>
        {failed ? (
          <p role="alert" className="k-op-alert">
            パスキーで入れませんでした。もう一度試してください。入れないときは運営の管理者に、パスキーの登録し直しを頼んでください
          </p>
        ) : null}
      </main>
      <nav className="k-auth-foot" aria-label="Kaname について">
        <a href="/login">顧客のログインへ</a>
      </nav>
    </div>
  );
}
