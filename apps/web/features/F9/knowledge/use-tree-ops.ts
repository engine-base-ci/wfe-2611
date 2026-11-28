"use client";
// K-684 木の操作と「…」の状態と口：ページかフォルダを足す（createKnowledgePage・K-679／createKnowledgeFolder・K-678）・
//   前の版を見る（listKnowledgeVersions・getKnowledgePageVersion・K-677・読むだけ）・リンクをコピー（口を呼ばない）・
//   別のフォルダへ動かす（updateKnowledgePage）・消す（deleteKnowledgePage・K-681）。
//   開いている小窓は 1 つ。状態は新しい値を作って入れ替える。答えを待つ間は二度目を送らない。
//   選択肢は口の木の答え（getKnowledgeTree）のフォルダから作り、同じ棚だけ（画面は口を足して探さない）
import { useEffect, useRef, useState } from "react";
import type { Doc } from "@kaname/contracts";
import { PAGE_ERROR, errorCodeOf, errorText } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import type { AddTarget, PageCtx } from "./page-slots";
import type { PageAnswer, TreeAnswer, TreeNodeAnswer } from "./shape";
import type { FolderOption, VersionRow } from "./tree-ops";
import type { ShelfKind } from "./types";

const SCREEN = "knowledge";
const ROOT = "root";
const MAX_DEPTH = 6;
const VERSIONS_LIMIT = 200;
const REFOCUS_FRAMES = 30;
const MORE_SEL = '.k-f9-acts button[aria-label="このページのほかの操作"]';
const NAME_SEL = '.k-dialog input[name="add_name"]';
/** 欄の下に出す口の断り（同じ場所に同じ名前・深さ 6 を超える） */
const FIELD_CODES: readonly string[] = ["E-KNW-020", "E-KNW-021"];

// 画面の字（仮・代表がまだ見ていない）
export const TEXT = {
  needTitle: "題名を入れてください",
  needFolderName: "フォルダの名前を入れてください",
  folderAdded: "フォルダを足しました",
  moved: "ページを動かしました",
  deleted: "ページを消しました",
  copied: "リンクをコピーしました",
  copyFailed: "コピーできませんでした。アドレスの欄から写してください",
  noVersions: "前の版はまだありません",
} as const;

const hrefOf = (id: string): string => `/knowledge/${encodeURIComponent(id)}`;

// ---------------------------------------------------------------- 選択肢（純粋な関数）
function shelfNodes(tree: TreeAnswer, target: AddTarget): readonly TreeNodeAnswer[] {
  if (target.shelf === "company") return tree.company_nodes;
  if (target.shelf === "me") return tree.my_nodes;
  return tree.groups.find((g) => g.id === target.group_id)?.nodes ?? [];
}

/** 棚の名前（会社・グループの名前・自分） */
export function shelfNameOf(tree: TreeAnswer | undefined, target: AddTarget): string {
  if (target.shelf === "company") return "会社";
  if (target.shelf === "me") return "自分";
  return tree?.groups.find((g) => g.id === target.group_id)?.name ?? "グループ";
}

/** 入れる場所・動かす先：棚の直下 → 棚の中のフォルダを木の順に（入れ子は「経理 › 請求」・最大 6 段）。同じ棚だけ */
export function folderOptions(tree: TreeAnswer | undefined, target: AddTarget): FolderOption[] {
  const root: FolderOption = { value: ROOT, label: `（${shelfNameOf(tree, target)}の棚の直下）` };
  if (!tree) return [root];
  const walk = (nodes: readonly TreeNodeAnswer[], path: readonly string[]): FolderOption[] =>
    nodes.flatMap((n) => {
      if (n.kind !== "folder" || path.length >= MAX_DEPTH) return [];
      const here = [...path, n.name ?? ""];
      return [{ value: n.id, label: here.join(" › ") }, ...walk(n.children ?? [], here)];
    });
  return [root, ...walk(shelfNodes(tree, target), [])];
}

/** 入れた先のフォルダとその上のフォルダの id（上から順・棚の直下なら空） */
export function folderPathOf(tree: TreeAnswer | undefined, target: AddTarget, folderId: string): string[] {
  if (!tree || folderId === ROOT) return [];
  const find = (nodes: readonly TreeNodeAnswer[], path: readonly string[]): string[] | null => {
    for (const n of nodes) {
      if (n.kind !== "folder") continue;
      const here = [...path, n.id];
      if (n.id === folderId) return here;
      const hit = find(n.children ?? [], here);
      if (hit) return hit;
    }
    return null;
  };
  return find(shelfNodes(tree, target), []) ?? [];
}

const targetOfPage = (p: PageAnswer): AddTarget =>
  p.place.shelf === "group" && p.place.group_id
    ? { shelf: "group", group_id: p.place.group_id }
    : { shelf: p.place.shelf as ShelfKind };
const sameShelf = (a: AddTarget, b: AddTarget): boolean =>
  a.shelf === b.shelf && (a.shelf !== "group" || a.group_id === b.group_id);

/** 月/日（日本時間） */
export function dayOf(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", month: "2-digit", day: "2-digit" }).format(d);
}

type Err = CallErr | "network";
/** 口の断り → 正本の ID（網の切れ＝E-PAGE-008・503＝E-PAGE-003） */
export function opErrorCode(err: Err): string {
  if (err === "network") return PAGE_ERROR.offline;
  if (err.status === 503) return PAGE_ERROR.down;
  return errorCodeOf(err);
}
const textOf = (code: string): string => errorText(code).entry.message;

// ---------------------------------------------------------------- 焦点
function focusLoop(find: () => HTMLElement | null): void {
  if (typeof window === "undefined") return;
  let n = 0;
  let held = 0;
  const step = (): void => {
    const el = find();
    if (el?.isConnected) {
      if (document.activeElement === el) held += 1;
      else {
        held = 0;
        el.focus();
      }
      if (held >= 2) return;
    }
    if (++n < REFOCUS_FRAMES) window.requestAnimationFrame(step);
  };
  window.requestAnimationFrame(step);
}

// ---------------------------------------------------------------- 状態
export type TreeOpsDialog =
  | { kind: "none" }
  | {
      kind: "add";
      target: AddTarget;
      addKind: "page" | "folder";
      name: string;
      folder: string;
      fieldError?: string;
      notice?: string;
    }
  | { kind: "move"; folder: string; notice?: string }
  | { kind: "delete"; notice?: string }
  | { kind: "versions"; list: readonly VersionRow[] | null; selected: number; body: Doc | null; notice?: string };

export interface UseTreeOps {
  dialog: TreeOpsDialog;
  busy: boolean;
  page: PageAnswer | undefined;
  options: readonly FolderOption[];
  currentFolder: string;
  openAdd: (target: AddTarget) => void;
  setAdd: (patch: { addKind?: "page" | "folder"; name?: string; folder?: string }) => void;
  submitAdd: () => Promise<void>;
  openMove: () => void;
  setMoveFolder: (v: string) => void;
  submitMove: () => Promise<void>;
  openDelete: () => void;
  submitDelete: () => Promise<void>;
  openVersions: () => void;
  pickVersion: (n: number) => void;
  copyLink: () => Promise<void>;
  close: () => void;
}

/** 口を呼ぶ（網の切れは "network"） */
async function run<T>(fn: () => Promise<T>): Promise<T | "network"> {
  try {
    return await fn();
  } catch {
    return "network";
  }
}

export function useTreeOps(ctx: PageCtx, notifyError: (text: string) => void): UseTreeOps {
  const [dialog, setDialog] = useState<TreeOpsDialog>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const opener = useRef<(() => HTMLElement | null) | null>(null);
  const verSeq = useRef(0);
  const page = ctx.page;
  const tree = ctx.tree;
  const pageTarget = page ? targetOfPage(page) : undefined;
  const currentFolder = page?.place.folder_id ?? ROOT;
  const optionsTarget: AddTarget | undefined = dialog.kind === "add" ? dialog.target : pageTarget;
  const options = optionsTarget ? folderOptions(tree, optionsTarget) : [];

  // 足す小窓は題名の欄に焦点（先頭の「足す物」ではなく）
  const isAdd = dialog.kind === "add";
  useEffect(() => {
    if (isAdd) focusLoop(() => document.querySelector<HTMLElement>(NAME_SEL));
  }, [isAdd]);

  const begin = (): boolean => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    return true;
  };
  const end = (): void => {
    busyRef.current = false;
    setBusy(false);
  };
  const close = (): void => {
    if (busyRef.current) return;
    verSeq.current += 1;
    setDialog({ kind: "none" });
    const find = opener.current;
    opener.current = null;
    if (find) focusLoop(find);
  };
  const closeDone = (): void => {
    verSeq.current += 1;
    opener.current = null;
    setDialog({ kind: "none" });
  };
  const fromMore = (): void => {
    opener.current = () => document.querySelector<HTMLElement>(MORE_SEL);
  };

  // ---------------------------------------------------------------- 足す
  const openAdd = (target: AddTarget): void => {
    const el = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    opener.current = () => el;
    const folder = page && pageTarget && sameShelf(pageTarget, target) ? currentFolder : ROOT;
    setDialog({ kind: "add", target, addKind: "page", name: "", folder });
  };
  const setAdd = (patch: { addKind?: "page" | "folder"; name?: string; folder?: string }): void =>
    setDialog((d) => {
      if (d.kind !== "add") return d;
      if (patch.name === undefined && patch.addKind === undefined) return { ...d, ...patch };
      return { ...d, ...patch, fieldError: undefined };
    });
  const submitAdd = async (): Promise<void> => {
    if (dialog.kind !== "add") return;
    const d = dialog;
    const isPage = d.addKind === "page";
    if (!d.name.trim()) {
      setDialog({ ...d, fieldError: isPage ? TEXT.needTitle : TEXT.needFolderName });
      return;
    }
    if (!begin()) return;
    const where = {
      shelf: d.target.shelf,
      ...(d.target.shelf === "group" && d.target.group_id ? { group_id: d.target.group_id } : {}),
    };
    const folderId = d.folder === ROOT ? undefined : d.folder;
    try {
      const r = await run(() =>
        isPage
          ? call("createKnowledgePage", {
              body: { ...where, ...(folderId ? { folder_id: folderId } : {}), title: d.name },
              screenId: SCREEN,
            })
          : call("createKnowledgeFolder", {
              body: { ...where, ...(folderId ? { parent_folder_id: folderId } : {}), name: d.name },
              screenId: SCREEN,
            }),
      );
      if (r === "network" || !r.ok) {
        const code = opErrorCode(r === "network" ? "network" : r);
        const field = FIELD_CODES.includes(code);
        setDialog({ ...d, fieldError: field ? textOf(code) : undefined, notice: field ? undefined : textOf(code) });
        return;
      }
      closeDone();
      ctx.reload({ tree: true });
      if (isPage) {
        const id = (r.data as { id?: string } | undefined)?.id;
        if (id) ctx.go(hrefOf(id));
      } else {
        ctx.revealFolders(folderPathOf(tree, d.target, d.folder));
        ctx.notify(TEXT.folderAdded);
      }
    } finally {
      end();
    }
  };

  // ---------------------------------------------------------------- 動かす
  const openMove = (): void => {
    if (!page) return;
    fromMore();
    setDialog({ kind: "move", folder: currentFolder });
  };
  const setMoveFolder = (v: string): void => setDialog((d) => (d.kind === "move" ? { ...d, folder: v } : d));
  const submitMove = async (): Promise<void> => {
    if (dialog.kind !== "move" || !page || dialog.folder === currentFolder) return;
    const d = dialog;
    if (!begin()) return;
    try {
      const r = await run(() =>
        call("updateKnowledgePage", {
          params: { id: page.id },
          body: { folder_id: d.folder === ROOT ? null : d.folder },
          screenId: SCREEN,
        }),
      );
      if (r === "network" || !r.ok) {
        setDialog({ ...d, notice: textOf(opErrorCode(r === "network" ? "network" : r)) });
        return;
      }
      closeDone();
      ctx.reload();
      ctx.notify(TEXT.moved);
      focusLoop(() => document.querySelector<HTMLElement>(MORE_SEL));
    } finally {
      end();
    }
  };

  // ---------------------------------------------------------------- 消す
  const openDelete = (): void => {
    if (!page) return;
    fromMore();
    setDialog({ kind: "delete" });
  };
  const submitDelete = async (): Promise<void> => {
    if (dialog.kind !== "delete" || !page) return;
    if (!begin()) return;
    try {
      const r = await run(() => call("deleteKnowledgePage", { params: { id: page.id }, screenId: SCREEN }));
      if (r === "network" || !r.ok) {
        setDialog({ kind: "delete", notice: textOf(opErrorCode(r === "network" ? "network" : r)) });
        return;
      }
      closeDone();
      ctx.go("/knowledge");
      ctx.reload({ tree: true });
      ctx.notify(TEXT.deleted);
    } finally {
      end();
    }
  };

  // ---------------------------------------------------------------- 前の版（読むだけ）
  const loadBody = async (seq: number, id: string, n: number): Promise<void> => {
    const r = await run(() => call("getKnowledgePageVersion", { params: { id, v: String(n) }, screenId: SCREEN }));
    if (seq !== verSeq.current) return;
    if (r === "network" || !r.ok) {
      const notice = textOf(opErrorCode(r === "network" ? "network" : r));
      setDialog((d) => (d.kind === "versions" ? { ...d, body: null, notice } : d));
      return;
    }
    const body = (r.data.body as { doc?: unknown } | undefined)?.doc as Doc | undefined;
    setDialog((d) => {
      if (d.kind !== "versions") return d;
      return { ...d, notice: undefined, body: body ?? { type: "doc", content: [] } };
    });
  };
  const openVersions = (): void => {
    if (!page) return;
    fromMore();
    const seq = ++verSeq.current;
    const id = page.id;
    setDialog({ kind: "versions", list: null, selected: 0, body: null });
    void (async () => {
      const r = await run(() =>
        call("listKnowledgeVersions", { params: { id }, query: { limit: VERSIONS_LIMIT }, screenId: SCREEN }),
      );
      if (seq !== verSeq.current) return;
      if (r === "network" || !r.ok) {
        const notice = textOf(opErrorCode(r === "network" ? "network" : r));
        setDialog((d) => (d.kind === "versions" ? { ...d, notice } : d));
        return;
      }
      const list: VersionRow[] = [...(r.data ?? [])]
        .filter((v) => typeof v.version === "number")
        .sort((a, b) => (b.version ?? 0) - (a.version ?? 0))
        .map((v) => ({ version: v.version ?? 0, at: dayOf(v.published_at), by: v.by_name || "—" }));
      const first = list[0]?.version ?? 0;
      setDialog((d) => (d.kind === "versions" ? { ...d, list, selected: first } : d));
      if (list.length) await loadBody(seq, id, first);
    })();
  };
  const pickVersion = (n: number): void => {
    if (dialog.kind !== "versions" || !page || n === dialog.selected) return;
    const seq = ++verSeq.current;
    setDialog({ ...dialog, selected: n, body: null });
    void loadBody(seq, page.id, n);
  };

  // ---------------------------------------------------------------- リンクをコピー（口を呼ばない）
  const copyLink = async (): Promise<void> => {
    if (!page) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${hrefOf(page.id)}`);
      ctx.notify(TEXT.copied);
    } catch {
      notifyError(TEXT.copyFailed);
    }
  };

  return {
    dialog,
    busy,
    page,
    options,
    currentFolder,
    openAdd,
    setAdd,
    submitAdd,
    openMove,
    setMoveFolder,
    submitMove,
    openDelete,
    submitDelete,
    openVersions,
    pickVersion,
    copyLink,
    close,
  };
}
