"use client";
// ナレッジの小窓（中央に開く）：必ず守るの上限・上の棚に上げる・グループを選んで共有・似たページ。
//   見た目だけ（値は props・口は呼ばない）
import { ShieldCheck } from "lucide-react";
import { Button, Callout, Dialog, NoticeBox, Select, TextArea, errorText } from "@/components/k";
import type { PageBrief } from "./types";
import "./knowledge.css";

const noop = (): void => undefined;

// ---------------------------------------------------------------- 必ず守る：上限に届いた
export interface MustFullProps {
  /** 棚の名前（会社・営業・自分） */
  shelf: string;
  /** 上限の数（会社 30・グループ 20・個人 10。運営が後から変えられる） */
  limit: number;
  /** 付けようとしたページ */
  target: string;
  /** いま付いているページ（読める量だけ並べる） */
  pages: readonly { id: string; title: string; folder: string }[];
  /** いま付いている数（上限に届いたとき limit と同じ。並べた数より多いとき「ほか N 個」を出す） */
  count?: number;
  /** 以下は画面の葉（K-691）が渡す。渡さなければ今の形（下絵） */
  open?: boolean | undefined;
  /** 押した行のページを外す（続けて付けるのは画面の葉） */
  onRemove?: ((id: string) => void) | undefined;
  /** 閉じる・Esc・右上の× */
  onClose?: (() => void) | undefined;
  /** 口の答えを待つ間（「外す」はどれも押せない） */
  busy?: boolean | undefined;
  /** 赤い箱の正本の ID */
  error?: string | null | undefined;
}

export function MustFullDialog({
  shelf,
  limit,
  target,
  pages,
  count = pages.length,
  open = true,
  onRemove,
  onClose,
  busy = false,
  error,
}: MustFullProps) {
  const remove = (id: string) =>
    onRemove ? (busy ? { "aria-disabled": true as const } : { onClick: () => onRemove(id) }) : {};
  return (
    <Dialog
      open={open}
      onOpenChange={onClose ? (o) => (o ? undefined : onClose()) : noop}
      title="「必ず守る」は、これ以上付けられません"
      target={target}
      actions={
        <Button variant="outlined" {...(onClose ? { onClick: onClose } : {})}>
          閉じる
        </Button>
      }
    >
      <div className="k-dialog-stack">
        {error ? <NoticeBox>{errorText(error).entry.message}</NoticeBox> : null}
        <Callout tone="warn" title={`${shelf}の「必ず守る」は ${limit} 個までです`}>
          「必ず守る」のページは、AI に毎回全部渡します。多すぎると AI が守りきれなくなるので、上限があります。
          どれかを外すと、このページに付けられます。
        </Callout>
        <section aria-label="いま付いているページ" className="k-f9-pick">
          <h3 className="k-f9-pick-h">{`いま付いているページ（${count}）`}</h3>
          <ul className="k-f9-pick-list">
            {pages.map((p) => (
              <li key={p.id} className="k-f9-pick-row">
                <ShieldCheck size={14} aria-hidden="true" />
                <span className="k-f9-pick-main">
                  <b>{p.title}</b>
                  <small>{p.folder}</small>
                </span>
                <Button variant="outlined" size="sm" aria-label={`${p.title}の「必ず守る」を外す`} {...remove(p.id)}>
                  外す
                </Button>
              </li>
            ))}
          </ul>
          {count > pages.length ? <p className="k-f9-note">{`ほか ${count - pages.length} 個`}</p> : null}
        </section>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- 上の棚に上げる（頼む）
export interface RaiseProps {
  target: string;
  /** 上げる先の棚（営業／会社） */
  to: string;
  /** 承認する人 */
  approver: string;
  folders: readonly string[];
  folder: string;
  message: string;
  /** 以下は画面の葉（K-692）が渡す。渡さなければ今の形（下絵） */
  /** 入れるフォルダの選び（渡したときは folders の代わり・folder は選んだ value） */
  folderOptions?: readonly { value: string; label: string }[] | undefined;
  /** ひとことの欄の下の字 */
  messageError?: string | null | undefined;
  /** 入れるフォルダの欄の下の正本の ID */
  folderError?: string | null | undefined;
  /** 赤い箱の正本の ID */
  error?: string | null | undefined;
  /** 口の答えを待つ間（「上げるのを頼む」は押せない） */
  busy?: boolean | undefined;
  onFolder?: ((value: string) => void) | undefined;
  onMessage?: ((value: string) => void) | undefined;
  onSubmit?: (() => void) | undefined;
  /** やめる・Esc・右上の× */
  onClose?: (() => void) | undefined;
}

export function RaiseDialog({
  target,
  to,
  approver,
  folders,
  folder,
  message,
  folderOptions,
  messageError,
  folderError,
  error,
  busy = false,
  onFolder,
  onMessage,
  onSubmit,
  onClose,
}: RaiseProps) {
  const options = folderOptions ? [...folderOptions] : folders.map((f) => ({ value: f, label: f }));
  return (
    <Dialog
      open
      onOpenChange={onClose ? (o) => (o ? undefined : onClose()) : noop}
      title="上の棚に上げる"
      target={target}
      actions={
        <>
          <Button variant="outlined" {...(onClose ? { onClick: onClose } : {})}>
            やめる
          </Button>
          <Button disabled={busy} {...(onSubmit ? { onClick: onSubmit } : {})}>
            上げるのを頼む
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {error ? <NoticeBox>{errorText(error).entry.message}</NoticeBox> : null}
        <dl className="k-f9-facts">
          <div>
            <dt>上げる先</dt>
            <dd>{`${to}の棚`}</dd>
          </div>
          <div>
            <dt>承認する人</dt>
            <dd>{approver}</dd>
          </div>
        </dl>
        <Select
          label="入れるフォルダ"
          name="raise_folder"
          options={options}
          value={folder}
          onValueChange={onFolder ? (v) => (v === null ? undefined : onFolder(v)) : noop}
          error={folderError ? errorText(folderError).entry.message : undefined}
        />
        <TextArea
          label="ひとこと"
          name="raise_message"
          value={message}
          rows={2}
          error={messageError}
          {...(onMessage ? { onChange: (e) => onMessage(e.target.value) } : { readOnly: true })}
        />
        <p className="k-f9-note">
          承認されると、このページは{to}の棚に移り、{to}
          の人が読めるようになります。断られたときは、理由がこのページに出ます。
        </p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- グループを選んで共有
export interface ShareGroupRow {
  code: string;
  name: string;
  manager: string;
  checked: boolean;
  /** 状態の札の字（共有している・承認待ち・断られた）。字は画面の葉が決める */
  state?: string | undefined;
  /** 選べない行（チェックを押せない・K-693） */
  locked?: boolean | undefined;
}
export interface ShareProps {
  target: string;
  from: string;
  groups: readonly ShareGroupRow[];
  /** 以下は画面の葉（K-693）が渡す。onToggle を渡さなければ今の形（下絵：状態のある行は押せない） */
  onToggle?: ((code: string) => void) | undefined;
  onSubmit?: (() => void) | undefined;
  /** やめる・Esc・右上の× */
  onClose?: (() => void) | undefined;
  /** 口の答えを待つ間（ボタンとチェックは押せない） */
  busy?: boolean | undefined;
  /** 読む口の答えを待つ間（一覧は出さない） */
  loading?: boolean | undefined;
  /** 赤い箱の正本の ID（一覧が無いときは一覧を出さない） */
  error?: string | null | undefined;
  submitLabel?: string | undefined;
  submitDisabled?: boolean | undefined;
  /** 外すときの注意 */
  removeNote?: string | null | undefined;
}

export function ShareDialog({
  target,
  from,
  groups,
  onToggle,
  onSubmit,
  onClose,
  busy = false,
  loading = false,
  error,
  submitLabel,
  submitDisabled = false,
  removeNote,
}: ShareProps) {
  const live = Boolean(onToggle);
  const n = groups.filter((d) => d.checked && !d.state).length;
  const label = submitLabel ?? (n ? `${n} つのグループに共有を頼む` : "共有を頼む");
  const showList = !loading && !(live && error && !groups.length);
  return (
    <Dialog
      open
      onOpenChange={onClose ? (o) => (o ? undefined : onClose()) : noop}
      title="グループを選んで共有"
      target={target}
      actions={
        <>
          <Button variant="outlined" {...(onClose ? { onClick: onClose } : {})}>
            やめる
          </Button>
          <Button
            {...(live ? { disabled: busy || loading || submitDisabled } : {})}
            {...(onSubmit ? { onClick: onSubmit } : {})}
          >
            {label}
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {error ? <NoticeBox>{errorText(error).entry.message}</NoticeBox> : null}
        {loading ? (
          <p className="k-f9-note" role="status">
            読み込んでいます
          </p>
        ) : null}
        {showList && live && !groups.length && !error ? (
          <p className="k-f9-note">共有できるグループがありません</p>
        ) : null}
        {showList && groups.length ? (
          <fieldset className="k-f9-pick">
            <legend className="k-f9-pick-h">見せるグループ</legend>
            <ul className="k-f9-pick-list">
              {groups.map((d) => (
                <li key={d.code} className="k-f9-pick-row">
                  <input
                    type="checkbox"
                    id={`share-${d.code}`}
                    className="k-f9-checkbox"
                    {...(live
                      ? {
                          checked: d.checked,
                          disabled: busy || Boolean(d.locked),
                          onChange: () => onToggle?.(d.code),
                        }
                      : { defaultChecked: d.checked, disabled: Boolean(d.state) })}
                  />
                  <label htmlFor={`share-${d.code}`} className="k-f9-pick-main">
                    <b>{d.name}</b>
                    <small>{`承認する人：${d.manager}`}</small>
                  </label>
                  {d.state ? (
                    <span className="k-badge" data-tone="success">
                      {d.state}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}
        {removeNote ? <p className="k-f9-note">{removeNote}</p> : null}
        <p className="k-f9-note">
          元は 1 つのままです。{from}で直すと、共有先にも同じ内容が出ます。共有先では読むだけで、直せません。
          相手のグループのマネージャーが承認すると、そのグループの人に見えるようになります。
        </p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- 似たページ
export interface SimilarProps {
  /** いつ出たか：書き終えるとき／上げるのを頼むとき */
  when: "save" | "raise";
  target: string;
  pages: readonly PageBrief[];
  /** 以下は画面の葉（K-691）が渡す。渡さなければ今の形（下絵） */
  open?: boolean | undefined;
  onBack?: (() => void) | undefined;
  onProceed?: (() => void) | undefined;
  /** 「開く」（新しいタブ） */
  onOpen?: ((id: string) => void) | undefined;
  /** Esc・右上の× */
  onClose?: (() => void) | undefined;
}

export function SimilarDialog({ when, target, pages, open = true, onBack, onProceed, onOpen, onClose }: SimilarProps) {
  const click = (fn: (() => void) | undefined) => (fn ? { onClick: fn } : {});
  return (
    <Dialog
      open={open}
      onOpenChange={onClose ? (o) => (o ? undefined : onClose()) : noop}
      title="似たページがあります"
      target={target}
      actions={
        <>
          <Button variant="outlined" {...click(onBack)}>
            戻って直す
          </Button>
          <Button {...click(onProceed)}>{when === "save" ? "このまま作る" : "このまま頼む"}</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <p className="k-f9-note">
          同じことが 2 か所に書いてあると、AI がどちらを読めばよいか迷います。先に開いて確かめてください。
        </p>
        <ul className="k-f9-pick-list" aria-label="似たページ">
          {pages.map((p) => (
            <li key={p.id} className="k-f9-pick-row">
              <span className="k-f9-pick-main">
                <b>{p.title}</b>
                <small>{p.place}</small>
                <span className="k-f9-pick-desc">{p.desc}</span>
              </span>
              <Button
                variant="outlined"
                size="sm"
                aria-label={`${p.title}を開く`}
                {...click(onOpen ? () => onOpen(p.id) : undefined)}
              >
                開く
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
