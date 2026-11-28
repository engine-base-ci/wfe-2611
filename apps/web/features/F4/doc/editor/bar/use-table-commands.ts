// 自前：表の道具（メニュー）の hook（K-568）。出来合いの表の UI（table-node）は有料 plan の部品で使えないので、部品（@tiptap/extension-table）の命令を並べた。
//   押せるかは部品の can() で決める。表を入れられるのは文書の直下の字の段だけ（K-584 の置ける親）。
//   見出しの行・列の切り替えは「今の行・今の列」に効かせる自前の 1 手（部品の toggleHeaderRow・toggleHeaderColumn は表の 1 行目・1 列目だけを替えるため）。
//   部品と同じく、見出しの行が在る表では列の切り替えは 1 行目を触らず、見出しの列が在る表では行の切り替えは 1 列目を触らない
import { useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { closeHistory } from "@tiptap/pm/history";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { isInTable, selectedRect } from "@tiptap/pm/tables";
import { atDocTop, focusNow } from "./use-block-button";
import { useEditorTick } from "./use-mark-button";

export type TableCommand =
  | "insertTable"
  | "addRowBefore"
  | "addRowAfter"
  | "addColumnBefore"
  | "addColumnAfter"
  | "deleteRow"
  | "deleteColumn"
  | "deleteTable"
  | "mergeCells"
  | "splitCell"
  | "toggleHeaderRow"
  | "toggleHeaderColumn"
  | "toggleHeaderCell";

/** メニューの並び（5 つの組） */
export const TABLE_GROUPS: readonly (readonly TableCommand[])[] = [
  ["insertTable"],
  ["addRowBefore", "addRowAfter", "addColumnBefore", "addColumnAfter"],
  ["deleteRow", "deleteColumn", "deleteTable"],
  ["mergeCells", "splitCell"],
  ["toggleHeaderRow", "toggleHeaderColumn", "toggleHeaderCell"],
];
/** 入れる表の大きさ（見出しの行 1 つ＋本文の行 2 つ・3 列） */
export const NEW_TABLE = { rows: 3, cols: 3, withHeaderRow: true } as const;
export const TABLE_NAMES: Record<TableCommand, string> = {
  insertTable: `表を入れる（${NEW_TABLE.rows} 行 × ${NEW_TABLE.cols} 列）`,
  addRowBefore: "行を上に足す",
  addRowAfter: "行を下に足す",
  addColumnBefore: "列を左に足す",
  addColumnAfter: "列を右に足す",
  deleteRow: "行を消す",
  deleteColumn: "列を消す",
  deleteTable: "表を消す",
  mergeCells: "セルをつなぐ",
  splitCell: "セルを分ける",
  toggleHeaderRow: "見出しの行にする",
  toggleHeaderColumn: "見出しの列にする",
  toggleHeaderCell: "見出しのセルにする",
};

type HeaderAxis = "row" | "column";
interface HeaderPlan {
  /** 替えるセルの位置（文書の頭から） */
  cells: number[];
  /** 見出しにするなら真・ふつうのセルに戻すなら偽 */
  toHeader: boolean;
}

/** 今の行（列）のセルを見出しに替える・戻す段取り。表の外・替えるセルが無いなら null */
function headerPlan(state: EditorState, axis: HeaderAxis): HeaderPlan | null {
  const header = state.schema.nodes["tableHeader"];
  if (!header || !isInTable(state)) return null;
  const rect = selectedRect(state);
  const { map, table, tableStart } = rect;
  const isHeader = (pos: number): boolean => table.nodeAt(pos)?.type === header;
  const headerRow = map.cellsInRect({ left: 0, top: 0, right: map.width, bottom: 1 }).every(isHeader);
  const headerColumn = map.cellsInRect({ left: 0, top: 0, right: 1, bottom: map.height }).every(isHeader);
  const cells =
    axis === "row"
      ? map.cellsInRect({ left: headerColumn ? 1 : 0, top: rect.top, right: map.width, bottom: rect.bottom })
      : map.cellsInRect({ left: rect.left, top: headerRow ? 1 : 0, right: rect.right, bottom: map.height });
  if (cells.length === 0) return null;
  return { cells: cells.map((pos) => tableStart + pos), toHeader: !cells.every(isHeader) };
}

function toggleHeaderAt(state: EditorState, tr: Transaction, axis: HeaderAxis, dispatch: boolean): boolean {
  const plan = headerPlan(state, axis);
  const type = state.schema.nodes[plan?.toHeader ? "tableHeader" : "tableCell"];
  if (!plan || !type) return false;
  if (dispatch) for (const pos of plan.cells) tr.setNodeMarkup(pos, type, tr.doc.nodeAt(pos)?.attrs);
  return true;
}

/** 選びが表の行（列）を全部おおっていないか。全部を消す命令は部品が流すときに断るので、押せるかはここで先に決める */
function leavesSome(state: EditorState, axis: HeaderAxis): boolean {
  if (!isInTable(state)) return false;
  const rect = selectedRect(state);
  return axis === "row"
    ? !(rect.top === 0 && rect.bottom === rect.map.height)
    : !(rect.left === 0 && rect.right === rect.map.width);
}

/** 表の命令は 1 つずつ戻せるように、前の変更とまとめない */
const ownStep = ({ tr }: { tr: Transaction }): boolean => {
  closeHistory(tr);
  return true;
};

const usable = (editor: Editor | null): editor is Editor =>
  !!editor && editor.isEditable && !!editor.schema.nodes["table"];

/** いまその命令を押せるか */
export function canTable(editor: Editor | null, cmd: TableCommand): boolean {
  if (!usable(editor)) return false;
  const can = editor.can();
  switch (cmd) {
    case "insertTable":
      return atDocTop(editor) && !editor.isActive("codeBlock") && can.insertTable(NEW_TABLE);
    case "deleteRow":
      return leavesSome(editor.state, "row") && can.deleteRow();
    case "deleteColumn":
      return leavesSome(editor.state, "column") && can.deleteColumn();
    case "toggleHeaderRow":
      return headerPlan(editor.state, "row") !== null;
    case "toggleHeaderColumn":
      return headerPlan(editor.state, "column") !== null;
    default:
      return can[cmd]();
  }
}

/** 命令を流す。keepFocus が真なら焦点を道具に残す（キーボードで選んだとき） */
export function runTable(editor: Editor | null, cmd: TableCommand, keepFocus = false): boolean {
  if (!usable(editor) || !canTable(editor, cmd)) return false;
  if (!keepFocus) focusNow(editor);
  const chain = (keepFocus ? editor.chain() : editor.chain().focus()).command(ownStep);
  switch (cmd) {
    case "insertTable":
      return chain.insertTable(NEW_TABLE).run();
    case "toggleHeaderRow":
      return chain.command(({ state, tr, dispatch }) => toggleHeaderAt(state, tr, "row", !!dispatch)).run();
    case "toggleHeaderColumn":
      return chain.command(({ state, tr, dispatch }) => toggleHeaderAt(state, tr, "column", !!dispatch)).run();
    default:
      return chain[cmd]().run();
  }
}

export interface TableState {
  can: (cmd: TableCommand) => boolean;
  run: (cmd: TableCommand, keepFocus?: boolean) => boolean;
}

/** 表のメニューの状態と命令 */
export function useTableCommands(editor: Editor | null): TableState {
  useEditorTick(editor);
  const can = useCallback((cmd: TableCommand) => canTable(editor, cmd), [editor]);
  const run = useCallback((cmd: TableCommand, keepFocus = false) => runTable(editor, cmd, keepFocus), [editor]);
  return { can, run };
}
