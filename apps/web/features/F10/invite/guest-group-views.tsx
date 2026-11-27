"use client";
// ゲストのグループを選ぶ欄と、ゲストのグループを作る小窓（K-874・段 12 の下絵 /dev/mock/f11 の stage9/guest-group-views.tsx から移した本物の部品）。
//   代表の答え answer=9201e2b32d4e・answer=6fe309f41cc1：ゲストのグループは「作って、そこから選ぶ」。招くの小窓のゲストのグループの欄は、
//   既にあるゲストのグループから選ぶ選び肢で、最後の「＋ 新しいゲストのグループを作る」を選ぶと作る小窓（名前・依頼が届く社内のグループ）が開く。
//   依頼が届く社内のグループはゲストのグループに 1 つ持たせる（招くの小窓では選ばない・D-155.38・D-155.40）。
//   部品は値と「押したときの関数」を任意の props で受けて描くだけ（口は呼ばない・K874-UI-021）。関数が無ければ下絵の見た目だけの形。
//   名前を直す小窓と消す確かめは、押せる形にして口につなぐ手（on…）を受け取る（K-928）。手を渡さなければ見た目だけの形（下絵の mb-group-*）。
//   ゲストを止める／戻す／外す確かめは、手（onOpenChange・onConfirm）を渡すと押せる形（K-931）。渡さなければ見た目だけの形（下絵の mb-guest-*）
import type { ReactNode } from "react";
import { Button, Callout, Confirm, Dialog } from "@/components/k";

/** 選び肢の最後の 1 つの字（選ぶと作る小窓が開く） */
export const NEW_GUEST_GROUP = "＋ 新しいゲストのグループを作る";
/** 最後の 1 つの値。グループの名前とも id とも重ならない印（名前は前後の空白を取った 1〜80 字・id は uuid。制御文字で始まる物は無い） */
const NEW_VALUE = "\u0000new";
/** 選び肢の 1 つ（id は口のグループの id・見た目だけのときは名前） */
export interface GuestGroupOption {
  id: string;
  name: string;
}

/** 既にあるゲストのグループと、その依頼が届く社内のグループ（下絵の見本） */
export const GUEST_GROUPS: readonly { name: string; inbox: string }[] = [
  { name: "セイコー株式会社（ゲスト）", inbox: "営業" },
  { name: "京蟻システム株式会社（ゲスト）", inbox: "受託開発" },
];
/** 作る小窓の届け先の選び肢（値は口のグループの id・見た目だけのときは名前） */
export interface InboxOption {
  id: string;
  name: string;
}
const MOCK_INBOXES: readonly InboxOption[] = ["営業", "受託開発", "経理"].map((n) => ({ id: n, name: n }));

/** 招くの小窓のゲストのグループの欄。選びは id で持ち（valueId）、欄の値は名前（会社の中で名前は 1 つ・E-GST-002）。
 *  選ぶと onPick に id と名前が来る（最後の「＋ 新しいゲストのグループを作る」は id が null）。open で選び肢を開いた形（下絵だけ） */
export function GuestGroupField({
  value,
  valueId,
  inbox,
  open = false,
  options,
  error,
  onPick,
}: {
  /** 選んだグループの名前（空＝まだ選んでいない） */
  value: string;
  /** 選んだグループの id（作った直後で一覧にまだ無いときも、この id で選び肢に出す） */
  valueId?: string;
  /** 選んだグループの依頼が届く社内のグループの名前（届け先が消えていれば無し・K874-UI-024） */
  inbox?: string;
  open?: boolean;
  /** 選び肢（既にあるゲストのグループ）。無ければ下絵の見本 */
  options?: readonly GuestGroupOption[];
  /** 欄の下の赤字（選んでいない・選んだグループがもう無い） */
  error?: string;
  /** 選んだとき（id と名前）。最後の「＋ 新しいゲストのグループを作る」は id が null */
  onPick?: (id: string | null, name: string) => void;
}) {
  const base = options ?? GUEST_GROUPS.map((g) => ({ id: g.name, name: g.name }));
  const opts = [
    ...base,
    ...(!value || base.some((g) => g.name === value) ? [] : [{ id: valueId ?? value, name: value }]),
  ];
  const list = opts.map((g) => g.name);
  return (
    <div className="k-field">
      <label className="k-label" htmlFor="inv-guest-group">
        ゲストのグループ<span className="k-field-required"> 必須</span>
      </label>
      <select
        id="inv-guest-group"
        className="k-input"
        value={value}
        aria-invalid={error ? true : undefined}
        onChange={(e) => {
          const v = e.target.value;
          if (v === NEW_VALUE) return onPick?.(null, NEW_GUEST_GROUP);
          const g = opts.find((o) => o.name === v);
          if (g) onPick?.(g.id, g.name);
        }}
      >
        {value ? null : <option value="">選ぶ</option>}
        {list.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        <option value={NEW_VALUE}>{NEW_GUEST_GROUP}</option>
      </select>
      {open ? (
        <div className="k-select-popup" role="listbox" aria-label="ゲストのグループ">
          {list.map((n) => (
            <div
              key={n}
              className="k-select-item"
              role="option"
              aria-selected={n === value}
              {...(n === value ? { "data-selected": "" } : {})}
            >
              <span className="k-select-check" aria-hidden="true">
                {n === value ? "✓" : ""}
              </span>
              {n}
            </div>
          ))}
          <div className="k-select-item" role="option" aria-selected={false}>
            <span className="k-select-check" aria-hidden="true" />
            {NEW_GUEST_GROUP}
          </div>
        </div>
      ) : null}
      {error ? <span className="k-err">{error}</span> : null}
      {inbox ? (
        <span className="k-inv-sub">{`このグループの依頼は ${inbox} に届く（作るときに決めた物）`}</span>
      ) : value ? null : (
        <span className="k-inv-sub">ゲストのグループを選ぶ。無ければ最後から作る</span>
      )}
    </div>
  );
}

/** ゲストのグループを作る小窓。fromInvite のときは、作ると招くの小窓に戻り、作ったグループが選ばれる */
export function GuestGroupDialog({
  name = "",
  inbox,
  fromInvite = false,
  error,
  inboxError,
  inboxes,
  busy = false,
  open = true,
  onName,
  onInbox,
  onCreate,
  onCancel,
}: {
  name?: string;
  /** 届け先の値（口のグループの id・見た目だけのときは名前）。無ければ最初の選び肢 */
  inbox?: string;
  fromInvite?: boolean;
  /** 名前の欄の誤り（空・同じ名前）・小窓の中の誤り（権限が無い） */
  error?: string;
  /** 届け先の欄の誤り（届け先の社内のグループがもう無い・K874-UI-025） */
  inboxError?: string;
  /** 届け先の選び肢。無ければ下絵の見本 */
  inboxes?: readonly InboxOption[];
  busy?: boolean;
  open?: boolean;
  onName?: (v: string) => void;
  onInbox?: (id: string) => void;
  onCreate?: () => void;
  /** 招くに戻る・やめる・Esc・右上の × */
  onCancel?: () => void;
}) {
  const list = inboxes ?? MOCK_INBOXES;
  const picked = inbox ?? (inboxes ? (list[0]?.id ?? "") : "営業");
  return (
    <Dialog
      title="ゲストのグループを作る"
      subtitle={fromInvite ? "作ると、招くの小窓に戻ってこのグループが選ばれる" : "先方の会社ごとに 1 つ作る"}
      open={open}
      onOpenChange={(o) => {
        if (!o && !busy) onCancel?.();
      }}
      actions={
        <>
          <Button variant="outlined" disabled={busy} {...(onCancel ? { onClick: onCancel } : {})}>
            {fromInvite ? "招くに戻る" : "やめる"}
          </Button>
          <Button loading={busy} {...(onCreate ? { onClick: onCreate } : {})}>
            作る
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <div className="k-field">
          <label className="k-label" htmlFor="gg-name">
            名前<span className="k-field-required"> 必須</span>
          </label>
          <input
            id="gg-name"
            className="k-input"
            value={name}
            placeholder="株式会社〇〇（ゲスト）"
            readOnly={!onName}
            aria-invalid={error ? true : undefined}
            onChange={(e) => onName?.(e.target.value)}
          />
          {error ? <span className="k-err">{error}</span> : null}
        </div>
        <div className="k-field">
          <label className="k-label" htmlFor="gg-inbox">
            依頼が届く社内のグループ<span className="k-field-required"> 必須</span>
          </label>
          <select
            id="gg-inbox"
            className="k-input"
            value={picked}
            aria-invalid={inboxError ? true : undefined}
            onChange={(e) => onInbox?.(e.target.value)}
          >
            {list.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          {inboxError ? <span className="k-err">{inboxError}</span> : null}
          <span className="k-inv-sub">
            このグループのゲストが出した依頼は、ここに届く。届いた依頼ごとに、社内で届け先を変えられる
          </span>
        </div>
        <Callout tone="info">
          ゲストのグループは見せ方のまとまりだけ。グループのゲストは、グループの依頼と、見せる相手にこのグループを選んだチケットを見る
        </Callout>
      </div>
    </Dialog>
  );
}

/** 名前を直す小窓（answer=695325c0630f・K-928）。ゲストのタブの行の「⋯」から開く。
 *  手（onChange・onSubmit・onCancel）を渡すと押せる形。直している間（saving）は「やめる」も押せず閉じない */
export function GuestGroupRenameDialog({
  name = "セイコー株式会社（ゲスト）",
  error,
  alert,
  saving = false,
  open = true,
  onChange,
  onSubmit,
  onCancel,
}: {
  name?: string;
  /** 名前の欄の誤り（空・同じ名前） */
  error?: string;
  /** 小窓の中の赤の知らせ（権限が無い・読めない など） */
  alert?: ReactNode;
  saving?: boolean;
  open?: boolean;
  onChange?: (name: string) => void;
  onSubmit?: () => void;
  onCancel?: () => void;
}) {
  return (
    <Dialog
      title="ゲストのグループの名前を直す"
      subtitle="直しても、中のゲストと見せているチケットはそのまま"
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) onCancel?.();
      }}
      actions={
        <>
          <Button variant="outlined" disabled={saving} onClick={() => (saving ? undefined : onCancel?.())}>
            やめる
          </Button>
          <Button loading={saving} onClick={() => (saving ? undefined : onSubmit?.())}>
            直す
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {alert ? <Callout tone="danger">{alert}</Callout> : null}
        <div className="k-field">
          <label className="k-label" htmlFor="gg-rename">
            名前<span className="k-field-required"> 必須</span>
          </label>
          <input
            id="gg-rename"
            className="k-input"
            value={name}
            readOnly={!onChange}
            onChange={(e) => onChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && onSubmit && !saving && !e.nativeEvent.isComposing) {
                e.preventDefault();
                onSubmit();
              }
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "gg-rename-err" : undefined}
          />
          {error ? (
            <span id="gg-rename-err" className="k-err">
              {error}
            </span>
          ) : null}
        </div>
      </div>
    </Dialog>
  );
}

/** 「中のゲスト（2 人・招待中 1）」の字。人も招待中も 0 なら出さない（止めている人も人に数える・K-928） */
export function guestCountText(guests: number, invited: number): string | null {
  if (guests === 0 && invited === 0) return null;
  const parts = [...(guests > 0 ? [`${guests} 人`] : []), ...(invited > 0 ? [`招待中 ${invited}`] : [])];
  return `中のゲスト（${parts.join("・")}）`;
}

/** ゲストのグループを消す確かめ（answer=695325c0630f・K-928）：中のゲストは入れなくなり、見せていたチケットから外れる。チケットは残る。
 *  手（onOpenChange・onConfirm）を渡すと押せる形。消している間（busy）は「やめる」も押せず閉じない */
export function GuestGroupDeleteConfirm({
  name = "セイコー株式会社（ゲスト）",
  guests = 2,
  invited = 1,
  open = true,
  busy = false,
  alert,
  onOpenChange = () => undefined,
  onConfirm = () => undefined,
}: {
  name?: string;
  /** 中のゲストの人数（止めている人も数える） */
  guests?: number;
  /** 招待中の数 */
  invited?: number;
  open?: boolean;
  busy?: boolean;
  /** 確かめの中の赤の知らせ（権限が無い・消せなかった など） */
  alert?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
}) {
  const count = guestCountText(guests, invited);
  return (
    <Confirm
      open={open}
      busy={busy}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={`ゲストのグループ「${name}」を消しますか`}
      caution={[
        ...(count ? [count] : []),
        "消すと、中のゲストは入れなくなります。",
        "見せていたチケットから外れます。チケットは残ります。",
      ]}
      description="消したあとは元に戻せません。もう一度使うときは、ゲストのグループを作り直して招きます。"
      confirmLabel="消す"
    >
      {alert ? <Callout tone="danger">{alert}</Callout> : null}
    </Confirm>
  );
}

/** ゲストを止める／戻す／外す確かめが受ける手（K-931）。手を渡さなければ下絵の見た目だけの形 */
interface GuestActConfirmProps {
  name?: string;
  open?: boolean;
  /** 答えを待つ間（押せない・閉じない） */
  busy?: boolean;
  /** 確かめの中の赤の知らせ（権限が無い・送れなかった など） */
  alert?: ReactNode;
  onOpenChange?: (open: boolean) => void;
  onConfirm?: () => void;
}

/** ゲストを 1 人だけ一時的に止める確かめ（代表の答え answer=03b52b9684c4・K-931） */
export function GuestSuspendConfirm({
  name = "山田 花子",
  open = true,
  busy = false,
  alert,
  onOpenChange = () => undefined,
  onConfirm = () => undefined,
}: GuestActConfirmProps) {
  return (
    <Confirm
      open={open}
      busy={busy}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      tone="primary"
      title={`${name} さんを一時的に止めますか`}
      description="止めると、すぐ入れなくなります。出した依頼とやり取りは残ります。いつでも戻せます。"
      confirmLabel="本人確認して止める"
    >
      {alert ? <Callout tone="danger">{alert}</Callout> : null}
    </Confirm>
  );
}

/** 止めているゲストを戻す確かめ（K-931） */
export function GuestResumeConfirm({
  name = "鈴木 健太",
  open = true,
  busy = false,
  alert,
  onOpenChange = () => undefined,
  onConfirm = () => undefined,
}: GuestActConfirmProps) {
  return (
    <Confirm
      open={open}
      busy={busy}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      tone="primary"
      title={`${name} さんを戻しますか`}
      description="また入れるようになります。本人は入り直します。"
      confirmLabel="本人確認して戻す"
    >
      {alert ? <Callout tone="danger">{alert}</Callout> : null}
    </Confirm>
  );
}

/** ゲストを 1 人だけ外す確かめ（D-155.14・K-931。ゲストは担当を持たないので引き継ぎ先は選ばない） */
export function GuestRemoveConfirm({
  name = "山田 花子",
  open = true,
  busy = false,
  alert,
  onOpenChange = () => undefined,
  onConfirm = () => undefined,
}: GuestActConfirmProps) {
  return (
    <Confirm
      open={open}
      busy={busy}
      onOpenChange={onOpenChange}
      onConfirm={onConfirm}
      title={`${name} さんを外しますか`}
      caution={["外すと、すぐ入れなくなります。", "出した依頼とやり取りは残ります。"]}
      description="外したあとは元に戻せません。もう一度入ってもらうときは、招き直します。"
      confirmLabel="本人確認して外す"
    >
      {alert ? <Callout tone="danger">{alert}</Callout> : null}
    </Confirm>
  );
}
