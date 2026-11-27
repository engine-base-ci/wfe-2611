"use client";
// 【段 12 の足し】（下絵 app/(dev)/dev/mock/f11/stage9/ から本物へ移した物・K-874）ゲストのグループを選ぶ欄と、ゲストのグループを作る小窓（2026-11-23 代表の答え answer=9201e2b32d4e・answer=6fe309f41cc1）。
//   ゲストのグループは「作って、そこから選ぶ」。招くの小窓のゲストのグループの欄は、既にあるゲストのグループから選ぶ選び肢（▾）で、
//   最後の「＋ 新しいゲストのグループを作る」を押すと作る小窓（名前・依頼が届く社内のグループ）が開き、作るとそれが選ばれた形に戻る。
//   依頼が届く社内のグループはゲストのグループに 1 つ持たせる（招くの小窓では選ばない）。届いた依頼で社内が届け先を変える（▾）はそのまま
//   値を受け取って描くだけ。名前を直す小窓と消す確かめは、押せる形にして口につなぐ手（on…）を受け取る（K-928）。
//   手を渡さなければ見た目だけの形（下絵 /dev/mock/f11 の mb-group-* がそのまま使う）
import type { ReactNode } from "react";
import { Button, Callout, Confirm, Dialog } from "@/components/k";

/** 既にあるゲストのグループと、その依頼が届く社内のグループ（下絵の見本） */
export const GUEST_GROUPS: readonly { name: string; inbox: string }[] = [
  { name: "セイコー株式会社（ゲスト）", inbox: "営業" },
  { name: "京蟻システム株式会社（ゲスト）", inbox: "受託開発" },
];
const NEW_LABEL = "＋ 新しいゲストのグループを作る";
const INBOXES = ["営業", "受託開発", "経理"] as const;

/** 招くの小窓のゲストのグループの欄。open で選び肢を開いた形を出す */
export function GuestGroupField({ value, inbox, open = false }: { value: string; inbox?: string; open?: boolean }) {
  const names = [
    ...GUEST_GROUPS.map((g) => g.name),
    ...(GUEST_GROUPS.some((g) => g.name === value) || !value ? [] : [value]),
  ];
  return (
    <div className="k-field">
      <label className="k-label" htmlFor="inv-guest-group">
        ゲストのグループ<span className="k-field-required"> 必須</span>
      </label>
      <select id="inv-guest-group" className="k-input" value={value} onChange={() => undefined}>
        {value ? null : <option value="">選ぶ</option>}
        {names.map((n) => (
          <option key={n}>{n}</option>
        ))}
        <option>{NEW_LABEL}</option>
      </select>
      {open ? (
        <div className="k-select-popup" role="listbox" aria-label="ゲストのグループ">
          {names.map((n) => (
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
            {NEW_LABEL}
          </div>
        </div>
      ) : null}
      <span className="k-inv-sub">
        {inbox
          ? `このグループの依頼は ${inbox} に届く（作るときに決めた物）`
          : "ゲストのグループを選ぶ。無ければ最後から作る"}
      </span>
    </div>
  );
}

/** ゲストのグループを作る小窓。fromInvite のときは、作ると招くの小窓に戻り、作ったグループが選ばれる */
export function GuestGroupDialog({
  name = "",
  inbox = "営業",
  fromInvite = false,
  error,
}: {
  name?: string;
  inbox?: string;
  fromInvite?: boolean;
  /** 名前の欄の誤り（空・同じ名前） */
  error?: string;
}) {
  return (
    <Dialog
      title="ゲストのグループを作る"
      subtitle={fromInvite ? "作ると、招くの小窓に戻ってこのグループが選ばれる" : "先方の会社ごとに 1 つ作る"}
      open
      actions={
        <>
          <Button variant="outlined">{fromInvite ? "招くに戻る" : "やめる"}</Button>
          <Button>作る</Button>
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
            readOnly
            aria-invalid={error ? true : undefined}
          />
          {error ? <span className="k-err">{error}</span> : null}
        </div>
        <div className="k-field">
          <label className="k-label" htmlFor="gg-inbox">
            依頼が届く社内のグループ<span className="k-field-required"> 必須</span>
          </label>
          <select id="gg-inbox" className="k-input" value={inbox} onChange={() => undefined}>
            {INBOXES.map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
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

/** 【段 12 の足し】ゲストを 1 人だけ一時的に止める確かめ（代表の答え answer=03b52b9684c4・段 11 の suspendMember につなぐ） */
export function GuestSuspendConfirm({ name = "山田 花子" }: { name?: string }) {
  return (
    <Confirm
      open
      onOpenChange={() => undefined}
      onConfirm={() => undefined}
      tone="primary"
      title={`${name} さんを一時的に止めますか`}
      description="止めると、すぐ入れなくなります。出した依頼とやり取りは残ります。いつでも戻せます。"
      confirmLabel="本人確認して止める"
    />
  );
}

/** 【段 12 の足し】止めているゲストを戻す確かめ（段 11 の resumeMember につなぐ） */
export function GuestResumeConfirm({ name = "鈴木 健太" }: { name?: string }) {
  return (
    <Confirm
      open
      onOpenChange={() => undefined}
      onConfirm={() => undefined}
      tone="primary"
      title={`${name} さんを戻しますか`}
      description="また入れるようになります。本人は入り直します。"
      confirmLabel="本人確認して戻す"
    />
  );
}

/** 【段 12 の足し】ゲストを 1 人だけ外す確かめ（D-155.14・段 11 の removeMember につなぐ。ゲストは担当を持たないので引き継ぎ先は選ばない） */
export function GuestRemoveConfirm({ name = "山田 花子" }: { name?: string }) {
  return (
    <Confirm
      open
      onOpenChange={() => undefined}
      onConfirm={() => undefined}
      title={`${name} さんを外しますか`}
      caution={["外すと、すぐ入れなくなります。", "出した依頼とやり取りは残ります。"]}
      description="外したあとは元に戻せません。もう一度入ってもらうときは、招き直します。"
      confirmLabel="本人確認して外す"
    />
  );
}
