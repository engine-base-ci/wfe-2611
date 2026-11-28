"use client";
// ナレッジの木の操作の小窓（K-684・下絵 v2 に無かった物を足した・字は仮）：ページかフォルダを足す・別のフォルダへ動かす・
//   ページを消す確かめ・前の版を見る。見た目だけ（値は props・口は呼ばない）。押す関数は任意の props（無ければモックの形＝欄は読むだけ）
import type { ReactNode } from "react";
import { Button, Confirm, Dialog, NoticeBox, Select, TextField } from "@/components/k";
import "./knowledge.css";

const noop = (): void => undefined;

export interface FolderOption {
  value: string;
  label: string;
}

// ---------------------------------------------------------------- ページかフォルダを足す（木の「＋」）
export interface AddProps {
  /** 足す棚の名前（会社・営業・自分） */
  shelf: string;
  kind: "page" | "folder";
  name: string;
  /** 入れる場所（先頭は棚の直下） */
  folders: readonly FolderOption[];
  folder: string;
  /** 欄の下の赤字（空の名前・同じ場所に同じ名前・深すぎる） */
  error?: string | undefined;
  /** 小窓の上の赤い箱（そのほかの口の断り・網の切れ） */
  notice?: string | undefined;
  busy?: boolean;
  onKind?: (k: "page" | "folder") => void;
  onName?: (v: string) => void;
  onFolder?: (v: string) => void;
  onSubmit?: () => void;
  onClose?: () => void;
}

export function AddDialog(p: AddProps) {
  const page = p.kind === "page";
  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? undefined : (p.onClose ?? noop)())}
      title="ページかフォルダを足す"
      target={`${p.shelf}の棚`}
      actions={
        <>
          <Button variant="outlined" onClick={p.onClose ?? noop} disabled={p.busy}>
            やめる
          </Button>
          <Button onClick={p.onSubmit ?? noop} loading={Boolean(p.busy)}>
            {page ? "書き始める" : "足す"}
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {p.notice ? <NoticeBox>{p.notice}</NoticeBox> : null}
        <Select
          label="足す物"
          name="add_kind"
          options={[
            { value: "page", label: "ページ" },
            { value: "folder", label: "フォルダ" },
          ]}
          value={p.kind}
          onValueChange={(v) => (v === "page" || v === "folder" ? p.onKind?.(v) : undefined)}
        />
        <TextField
          label={page ? "題名" : "フォルダの名前"}
          name="add_name"
          value={p.name}
          maxLength={page ? 200 : 100}
          required
          error={p.error}
          {...(p.onName ? { onChange: (e) => p.onName?.(e.target.value) } : { readOnly: true })}
        />
        <Select
          label="入れる場所"
          name="add_folder"
          options={[...p.folders]}
          value={p.folder}
          onValueChange={(v) => (v ? p.onFolder?.(v) : undefined)}
        />
        <p className="k-f9-note">
          {page
            ? "ページは、書き終えるまで自分だけに見えます。題名はあとで直せます。"
            : "フォルダは、ページをまとめる入れ物です。中身が空のときだけ消せます。"}
        </p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- 別のフォルダへ動かす
export interface MoveProps {
  target: string;
  folders: readonly FolderOption[];
  folder: string;
  error?: string | undefined;
  busy?: boolean;
  /** 「動かす」を押せない（今の場所と同じ先） */
  submitDisabled?: boolean;
  onFolder?: (v: string) => void;
  onSubmit?: () => void;
  onClose?: () => void;
}

export function MoveDialog(p: MoveProps) {
  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? undefined : (p.onClose ?? noop)())}
      title="別のフォルダへ動かす"
      target={p.target}
      actions={
        <>
          <Button variant="outlined" onClick={p.onClose ?? noop} disabled={p.busy}>
            やめる
          </Button>
          <Button onClick={p.onSubmit ?? noop} loading={Boolean(p.busy)} disabled={Boolean(p.submitDisabled)}>
            動かす
          </Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {p.error ? <NoticeBox>{p.error}</NoticeBox> : null}
        <Select
          label="動かす先"
          name="move_folder"
          options={[...p.folders]}
          value={p.folder}
          onValueChange={(v) => (v ? p.onFolder?.(v) : undefined)}
        />
        <p className="k-f9-note">同じ棚の中だけ動かせます。別の棚へは「上の棚に上げる」を使います。</p>
      </div>
    </Dialog>
  );
}

// ---------------------------------------------------------------- ページを消す確かめ
export interface DeleteProps {
  target: string;
  error?: string | undefined;
  busy?: boolean;
  onSubmit?: () => void;
  onClose?: () => void;
}

export function DeleteDialog(p: DeleteProps) {
  return (
    <Confirm
      open
      onOpenChange={(o) => (o ? undefined : (p.onClose ?? noop)())}
      title="このページを消しますか"
      description={p.target}
      caution={["消すと、木から無くなります。元に戻す画面はありません。"]}
      confirmLabel="消す"
      busy={Boolean(p.busy)}
      onConfirm={p.onSubmit ?? noop}
    >
      {p.error ? <NoticeBox>{p.error}</NoticeBox> : null}
    </Confirm>
  );
}

// ---------------------------------------------------------------- 前の版を見る（読むだけ）
export interface VersionRow {
  version: number;
  /** 「11/18」のような日付 */
  at: string;
  by: string;
}
export interface VersionsProps {
  target: string;
  versions: readonly VersionRow[];
  selected: number;
  /** 選んだ版の本文（描いた物を渡す） */
  children: ReactNode;
  /** 小窓の上の赤い箱（一覧・本文の口の失敗） */
  error?: string | undefined;
  /** 版が 1 つも無いときの文（あれば版の欄と本文を出さない） */
  empty?: string | undefined;
  onSelect?: (version: number) => void;
  onClose?: () => void;
}

export function VersionsDialog(p: VersionsProps) {
  return (
    <Dialog
      open
      onOpenChange={(o) => (o ? undefined : (p.onClose ?? noop)())}
      title="前の版を見る"
      target={p.target}
      size="connect"
    >
      <div className="k-dialog-stack">
        {p.error ? <NoticeBox>{p.error}</NoticeBox> : null}
        {p.empty ? <p className="k-f9-note">{p.empty}</p> : null}
        {!p.empty && p.versions.length ? (
          <>
            <Select
              label="版"
              name="version"
              options={p.versions.map((v) => ({
                value: String(v.version),
                label: `版 ${v.version} ・ ${v.at} ・ ${v.by}`,
              }))}
              value={String(p.selected)}
              onValueChange={(v) => (v ? p.onSelect?.(Number(v)) : undefined)}
            />
            <section aria-label="この版の本文" className="k-f9-versionbody">
              {p.children}
            </section>
          </>
        ) : null}
        <p className="k-f9-note">読むだけです。この版に戻す操作はありません。</p>
      </div>
    </Dialog>
  );
}
