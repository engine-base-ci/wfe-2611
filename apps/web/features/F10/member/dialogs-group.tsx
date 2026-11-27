"use client";
// メンバーの 1 人の小窓（段 11・F10）：グループを移す・兼ねるグループを足す外す。
//   キャンバスに絵が無いので、画面に出る文は「仮」。足のボタンは「本人確認して〇〇」（本人確認の取り直しが先に入る）。
//   値は props で受け取って描くだけ。選びは部品の Select（components/k・下絵と同じ）。足すグループの選びに空の選び肢は置かない（選ぶまで ▾ は「選ぶ」・保存は押せない）。
//   入れ物（K-820）が足す任意の props：groups（選べるグループ）・value・onChange・onSubmit・onCancel・busy・notice・error・（兼ねる）onRemove・removed・addable。
//   渡さない呼び方（モック）は見本の 3 つのグループのまま
import { Button, Dialog, NoticeBox, Select } from "@/components/k";
import "./member.css";

export interface GroupChoice {
  /** 選びの値（入れ物はグループの id・モックは名前） */
  value: string;
  label: string;
}

const GROUP_OPTIONS: readonly GroupChoice[] = [
  { value: "営業", label: "営業" },
  { value: "受託開発", label: "受託開発" },
  { value: "経理", label: "経理" },
];
/** 移せるグループが無い（会社にグループが 1 つだけ）（仮） */
const NO_MOVE = "移せるグループがありません";

interface CommonProps {
  open: boolean;
  name: string;
  /** 選べるグループ（渡さなければ見本の 3 つ） */
  groups?: readonly GroupChoice[];
  /** グループの一覧を読んでいる（選びは押せない） */
  loading?: boolean;
  onSubmit?: () => void;
  onCancel?: () => void;
  /** 答えを待っている（足のボタンは押せない・閉じない） */
  busy?: boolean;
  /** 小窓の上の赤い箱 */
  error?: string | null;
  /** 足のボタンを押せない（選びが無い・変えていない） */
  submitDisabled?: boolean;
}

function Foot({
  submit,
  busy,
  disabled,
  onCancel,
  onSubmit,
}: {
  submit: string;
  busy: boolean | undefined;
  disabled: boolean | undefined;
  onCancel: (() => void) | undefined;
  onSubmit: (() => void) | undefined;
}) {
  return (
    <>
      <Button variant="outlined" disabled={busy} onClick={onCancel}>
        やめる
      </Button>
      <Button loading={busy} disabled={disabled} onClick={onSubmit}>
        {submit}
      </Button>
    </>
  );
}

const closeOf = (busy: boolean | undefined, onCancel: (() => void) | undefined) => (o: boolean) => {
  if (!o && !busy) onCancel?.();
};

/** グループを移す（本人確認が要る） */
export function MoveDialog({
  open,
  name,
  from,
  to,
  groups,
  loading,
  onChange,
  onSubmit,
  onCancel,
  busy,
  error,
  submitDisabled,
}: CommonProps & { from: string; to: string; onChange?: (v: string) => void }) {
  const options = groups ?? GROUP_OPTIONS;
  const none = !loading && options.length === 0;
  return (
    <Dialog
      title="グループを移す"
      subtitle={`${name} の、いまのグループ：${from}`}
      size="form"
      open={open}
      onOpenChange={closeOf(busy, onCancel)}
      actions={
        <Foot
          submit="本人確認して移す"
          busy={busy}
          disabled={submitDisabled || none}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      }
    >
      <div className="k-dialog-stack">
        {error ? <NoticeBox>{error}</NoticeBox> : null}
        {none ? (
          <p className="k-f10d-sub">{NO_MOVE}</p>
        ) : (
          <Select
            name="move-to"
            label="移す先のグループ"
            options={[...options]}
            value={to || null}
            disabled={loading}
            onValueChange={(v) => onChange?.(v ?? "")}
          />
        )}
        <p className="k-f10d-sub">役割はそのままです。担当しているチケットも、そのまま持ちます</p>
      </div>
    </Dialog>
  );
}

/** 兼ねるグループを足す・外す（本人確認が要る） */
export function AlsoDialog({
  open,
  name,
  also,
  add,
  groups,
  addable,
  loading,
  removed,
  onChange,
  onRemove,
  onSubmit,
  onCancel,
  busy,
  error,
  submitDisabled,
}: CommonProps & {
  /** 兼ねているグループ（名前・入れ物は id を value に） */
  also: readonly (string | GroupChoice)[];
  add: string;
  /** 足せるグループ（主でも兼ねてもいない。渡さなければ groups） */
  addable?: readonly GroupChoice[];
  /** 外す印を付けた兼ねるグループ（value）。行から消える */
  removed?: readonly string[];
  onChange?: (v: string) => void;
  onRemove?: (value: string) => void;
}) {
  const rows = also
    .map((g) => (typeof g === "string" ? { value: g, label: g } : g))
    .filter((g) => !removed?.includes(g.value));
  const options = addable ?? groups ?? GROUP_OPTIONS;
  return (
    <Dialog
      title="兼ねるグループを足す・外す"
      subtitle={`${name} は、ほかのグループも兼ねられる`}
      size="form"
      open={open}
      onOpenChange={closeOf(busy, onCancel)}
      actions={
        <Foot
          submit="本人確認して保存する"
          busy={busy}
          disabled={submitDisabled}
          onCancel={onCancel}
          onSubmit={onSubmit}
        />
      }
    >
      <div className="k-dialog-stack">
        {error ? <NoticeBox>{error}</NoticeBox> : null}
        <h3 className="k-f10d-h">兼ねているグループ</h3>
        {rows.length ? (
          rows.map((g) => (
            <div key={g.value} className="k-f10d-added">
              <span>{g.label}</span>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${g.label}を外す`}
                disabled={busy}
                onClick={() => onRemove?.(g.value)}
              >
                外す
              </Button>
            </div>
          ))
        ) : (
          <p className="k-f10d-sub">兼ねているグループはありません</p>
        )}
        <Select
          name="also-add"
          label="足すグループ"
          options={[...options]}
          value={add || null}
          disabled={loading}
          onValueChange={(v) => onChange?.(v ?? "")}
        />
      </div>
    </Dialog>
  );
}
