// K-692「上の棚に上げる」の形（画面の外の純粋な関数だけ・@/ を読まない・元の値を変えない）。
//   上げる先の棚のフォルダの選び・承認する人と帯の相手の字・帯の日時・頼む口の体・ひとことの確かめ・お知らせの字
import type { TreeAnswer, TreeNodeAnswer } from "./shape";

/** 入れるフォルダの「棚の直下」の値（口には folder_id を送らない） */
export const RAISE_ROOT = "root";
/** ひとことの上限（前後の空白を落とした字数） */
export const RAISE_MESSAGE_MAX = 1000;
const MESSAGE_TOO_LONG = "ひとことは 1,000 字までです";
const PATH_SEP = " › ";
const NAME_SEP = "・";
const COMPANY = "会社";

/** 口の答えの raise_to（上げる先） */
export interface RaiseTo {
  shelf: "group" | "company" | string;
  shelf_name: string;
  group_id: string | null;
  approver_names?: readonly string[];
}
export interface FolderChoice {
  value: string;
  label: string;
}

function folderChoicesOf(nodes: readonly TreeNodeAnswer[], parents: readonly string[]): FolderChoice[] {
  return nodes.flatMap((n) => {
    if (n.kind !== "folder") return [];
    const path = [...parents, n.name ?? ""];
    return [{ value: n.id, label: path.join(PATH_SEP) }, ...folderChoicesOf(n.children ?? [], path)];
  });
}

/** 上げる先の棚のフォルダだけを木の順に（先頭は棚の直下）。別の棚のフォルダは出さない */
export function raiseFolderChoices(tree: TreeAnswer | undefined, to: RaiseTo): FolderChoice[] {
  const root: FolderChoice = { value: RAISE_ROOT, label: `${to.shelf_name}（いちばん上）` };
  if (!tree) return [root];
  const nodes =
    to.shelf === "company" ? tree.company_nodes : (tree.groups.find((g) => g.id === to.group_id)?.nodes ?? []);
  return [root, ...folderChoicesOf(nodes, [])];
}

/** 承認する人の字（複数は「・」・会社は管理者・0 人は「ほかにいません」） */
export function approverText(names: readonly string[], shelf: string, shelfName: string): string {
  if (!names.length) return "ほかにいません";
  const who = names.map((n) => `${n}さん`).join(NAME_SEP);
  return shelf === "company" ? `${who}（管理者）` : `${who}（${shelfName}のマネージャー）`;
}

/** 帯の相手の字（承認待ち＝承認する人・断られた＝断った人） */
export function bandWho(req: { who_name: string; to_name: string }): string {
  const names = req.who_name.split(NAME_SEP).filter((n) => n.length > 0);
  return approverText(names, req.to_name === COMPANY ? "company" : "group", req.to_name);
}

/** 帯の日時（日本時間の「月/日 時:分」）。読めない値はそのまま */
export function bandAt(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const jst = new Date(t + 9 * 60 * 60 * 1000);
  const hh = String(jst.getUTCHours()).padStart(2, "0");
  const mm = String(jst.getUTCMinutes()).padStart(2, "0");
  return `${jst.getUTCMonth() + 1}/${jst.getUTCDate()} ${hh}:${mm}`;
}

/** 頼む口の体：グループ・フォルダ（棚の直下は送らない）・ひとこと（空は送らない） */
export function raiseBody(input: { groupId: string | null; folder: string; message: string }): {
  group_id?: string;
  folder_id?: string;
  message?: string;
} {
  const message = input.message.trim();
  return {
    ...(input.groupId ? { group_id: input.groupId } : {}),
    ...(input.folder && input.folder !== RAISE_ROOT ? { folder_id: input.folder } : {}),
    ...(message ? { message } : {}),
  };
}

/** ひとことの問題（無ければ null） */
export function messageProblem(message: string): string | null {
  return Array.from(message.trim()).length > RAISE_MESSAGE_MAX ? MESSAGE_TOO_LONG : null;
}

/** 頼んだあとのお知らせ（approved＝すぐ移った） */
export function raiseDoneText(state: string | undefined, toName: string): string {
  return state === "approved"
    ? `ページを${toName}の棚に上げました`
    : "上げるのを頼みました。承認されるとページが移ります";
}

/** 口の答えの raise_to を形にそろえる（形が違えば null） */
export function raiseToOf(raw: unknown): RaiseTo | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<RaiseTo>;
  if (typeof r.shelf !== "string" || typeof r.shelf_name !== "string") return null;
  return {
    shelf: r.shelf,
    shelf_name: r.shelf_name,
    group_id: typeof r.group_id === "string" ? r.group_id : null,
    approver_names: Array.isArray(r.approver_names) ? r.approver_names.filter((n) => typeof n === "string") : [],
  };
}
