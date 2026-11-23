"use client";
// 本文の道具の帯（本物・K-567）。道具の並びと名前は下絵と同じ BAR_GROUPS（features/F4/doc/bar-tools.tsx）を読む。
//   K-567 が動かす：戻す・やり直す・太字・斜体・下線・取り消し線・行の中のコード・リンク。
//   K-587 が動かす：見出し・並び（メニュー bar-menu.tsx）・引用・コードの囲み・区切りの線・左寄せ・中央・右寄せ・両端・上付き・下付き。
//     置けない場所（K-584 の置ける親の外）では押せない形（aria-disabled）。画像は押せない形のまま（ファイルを付ける仕組みが入るまで）。
//   K-568 が動かす：文字の色・背景の色（小さな画面 color-popover.tsx を帯の下に開く）・表（メニュー table-menu.tsx）。
//   Tab の停止点は 1 つ（最初は『太字』・押した後は最後にいた道具）で、← → で隣の道具へ移る（roving tabindex）。押された道具は aria-pressed
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { BAR_GROUPS, TOOL_NAMES, type BarTool } from "../bar-tools";
import { BarMenu, type BarMenuItem } from "./bar-menu";
import { COLOR_TOOL, ColorPopover, type ColorKind } from "./color-popover";
import { TableMenu } from "./table-menu";
import { focusNow, useBlockButton, type BlockKind } from "./bar/use-block-button";
import { useColorHighlight } from "./bar/use-color-highlight";
import { HEADING_LEVELS, useHeading } from "./bar/use-heading";
import { LIST_TYPES, useList, type ListType } from "./bar/use-list";
import { useMarkButton, type MarkType } from "./bar/use-mark-button";
import { useTextAlign, type TextAlign } from "./bar/use-text-align";
import { useTextColor } from "./bar/use-text-color";
import { useUndoRedo, type UndoRedoAction } from "./bar/use-undo-redo";

const WHY = "まだ使えません";
const MARKS: Record<string, MarkType> = {
  太字: "bold",
  斜体: "italic",
  下線: "underline",
  取り消し線: "strike",
  行の中のコード: "code",
};
const HISTORY: Record<string, UndoRedoAction> = { 戻す: "undo", やり直す: "redo" };
const BLOCKS: Record<string, BlockKind> = {
  引用: "blockquote",
  コードの囲み: "codeBlock",
  区切りの線: "horizontalRule",
};
const ALIGNS: Record<string, TextAlign> = { 左寄せ: "left", 中央: "center", 右寄せ: "right", 両端: "justify" };
/** 上付き・下付きは同時に付かない：付けるときにもう片方を外す */
const SCRIPTS: Record<string, readonly [MarkType, MarkType]> = {
  上付き: ["superscript", "subscript"],
  下付き: ["subscript", "superscript"],
};
const LIST_NAMES: Record<ListType, string> = { bulletList: "箇条書き", orderedList: "番号つき", taskList: "チェック" };
const COLORS: Record<string, ColorKind> = { [COLOR_TOOL.text]: "text", [COLOR_TOOL.background]: "background" };
const TABLE = "表";
const BODY = "本文";
const FIRST_STOP = "太字";

interface ToolProps {
  tool: BarTool;
  stop: string;
  onFocusTool: (name: string) => void;
  children?: ReactNode;
}

function Chev({ tool }: { tool: BarTool }) {
  return tool.pop ? (
    <svg className="k-f4d-chev" viewBox="0 0 10 6" aria-hidden="true" focusable="false">
      <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ) : null;
}

/** 道具のボタン。編集の選びを崩さないよう押し下げでは焦点を移さない。キーボードで押したときは焦点を道具に残す（← → で続けて動けるように） */
function ToolButton({
  tool,
  stop,
  onFocusTool,
  off,
  pressed,
  extra,
  onAct,
}: ToolProps & { off: boolean; pressed?: boolean; extra?: Record<string, unknown>; onAct?: () => void }) {
  const onClick = (e: MouseEvent<HTMLButtonElement>): void => {
    if (off || !onAct) return;
    const el = e.currentTarget;
    const byKey = e.detail === 0;
    onAct();
    if (byKey) el.focus();
  };
  return (
    <button
      type="button"
      aria-label={tool.name}
      title={off && !onAct ? WHY : tool.name}
      tabIndex={tool.name === stop ? 0 : -1}
      data-tool={tool.name}
      {...(tool.pop ? { "aria-haspopup": tool.pop } : {})}
      {...(off ? { "aria-disabled": true } : {})}
      {...(pressed === undefined ? {} : { "aria-pressed": pressed })}
      {...extra}
      onMouseDown={(e) => e.preventDefault()}
      onFocus={() => onFocusTool(tool.name)}
      onClick={onClick}
    >
      {tool.label}
      <Chev tool={tool} />
    </button>
  );
}

function MarkTool(p: ToolProps & { editor: Editor | null; type: MarkType }) {
  const m = useMarkButton(p.editor, p.type);
  return <ToolButton {...p} off={!m.canToggle} pressed={m.isActive} onAct={m.handleMark} />;
}
function HistoryTool(p: ToolProps & { editor: Editor | null; action: UndoRedoAction }) {
  const h = useUndoRedo(p.editor, p.action);
  return <ToolButton {...p} off={!h.canExecute} onAct={h.handleAction} />;
}

function BlockTool(p: ToolProps & { editor: Editor | null; kind: BlockKind }) {
  const b = useBlockButton(p.editor, p.kind);
  // 区切りの線は押された形を持たない（aria-pressed を付けない）
  const pressed = b.isActive === undefined ? {} : { pressed: b.isActive };
  return <ToolButton {...p} off={!b.canToggle} {...pressed} onAct={b.handleToggle} />;
}
function AlignTool(p: ToolProps & { editor: Editor | null; align: TextAlign }) {
  const a = useTextAlign(p.editor, p.align);
  return <ToolButton {...p} off={!a.canAlign} pressed={a.isActive} onAct={a.handleTextAlign} />;
}
function ScriptTool(p: ToolProps & { editor: Editor | null; type: MarkType; other: MarkType }) {
  const { editor, type, other } = p;
  const m = useMarkButton(editor, type);
  const act = (): void => {
    if (!editor || !m.canToggle) return;
    focusNow(editor);
    editor.chain().focus().unsetMark(other).toggleMark(type).run();
  };
  return <ToolButton {...p} off={!m.canToggle} pressed={m.isActive} onAct={act} />;
}

// メニューの項目を選んだとき：キーボード（byKey）なら焦点を道具に残し、マウスなら命令が先に焦点を編集欄へ移す（続けて打てる）
function MenuTool({
  tool,
  stop,
  onFocusTool,
  editor,
  items,
}: ToolProps & { editor: Editor | null; items: BarMenuItem[] }) {
  return (
    <BarMenu
      label={tool.name}
      items={items}
      disabled={!editor}
      tabIndex={tool.name === stop ? 0 : -1}
      onFocusTool={() => onFocusTool(tool.name)}
    >
      {tool.label}
      <Chev tool={tool} />
    </BarMenu>
  );
}
function HeadingTool(p: ToolProps & { editor: Editor | null }) {
  const h = useHeading(p.editor);
  const items: BarMenuItem[] = [
    ...HEADING_LEVELS.map((level): BarMenuItem => ({
      name: `見出し ${level - 1}`,
      role: "menuitemradio",
      checked: h.level === level,
      disabled: !h.canSet(level),
      onSelect: (byKey) => void h.handleHeading(level, byKey),
    })),
    {
      name: BODY,
      role: "menuitemradio",
      checked: h.isBody,
      onSelect: (byKey) => void h.handleBody(byKey),
    },
  ];
  return <MenuTool {...p} items={items} />;
}
function ListTool(p: ToolProps & { editor: Editor | null }) {
  const l = useList(p.editor);
  const items = LIST_TYPES.map((type): BarMenuItem => ({
    name: LIST_NAMES[type],
    role: "menuitemcheckbox",
    checked: l.type === type,
    disabled: !l.canToggle(type),
    onSelect: (byKey) => void l.handleList(type, byKey),
  }));
  return <MenuTool {...p} items={items} />;
}

/** 文字の色・背景の色：押すと小さな画面を開く・閉じる。色を付けられない場所（コードの囲みの中など）では押せない形 */
function ColorTool(p: ToolProps & { editor: Editor | null; kind: ColorKind; open: boolean; onToggle: () => void }) {
  const text = useTextColor(p.editor);
  const background = useColorHighlight(p.editor);
  const canSet = (p.kind === "text" ? text : background).canSet;
  return <ToolButton {...p} off={!canSet} extra={{ "aria-expanded": p.open }} onAct={p.onToggle} />;
}
function TableTool({ tool, stop, onFocusTool, editor }: ToolProps & { editor: Editor | null }) {
  return (
    <TableMenu
      label={tool.name}
      editor={editor}
      tabIndex={tool.name === stop ? 0 : -1}
      onFocusTool={() => onFocusTool(tool.name)}
    >
      {tool.label}
      <Chev tool={tool} />
    </TableMenu>
  );
}

export interface DocBarLiveProps {
  editor: Editor | null;
  /** リンクの小さな入力を開く・閉じる */
  onLink: () => void;
  linkOpen: boolean;
  linkActive: boolean;
}

export function DocBarLive({ editor, onLink, linkOpen, linkActive }: DocBarLiveProps) {
  const [stop, setStop] = useState(FIRST_STOP);
  const [color, setColor] = useState<ColorKind | null>(null);
  const bar = useRef<HTMLDivElement>(null);
  const onFocusTool = useCallback((name: string) => setStop(name), []);
  // リンクの小さな入力と色の小さな画面は同時に開かない
  useEffect(() => {
    if (linkOpen) setColor(null);
  }, [linkOpen]);
  const toggleColor = (kind: ColorKind): void => {
    if (linkOpen) onLink();
    setColor((now) => (now === kind ? null : kind));
  };
  const closeColor = useCallback(
    (toTool: boolean) => {
      if (toTool && color)
        bar.current?.querySelector<HTMLButtonElement>(`button[data-tool="${COLOR_TOOL[color]}"]`)?.focus();
      setColor(null);
    },
    [color],
  );
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    // 開いたメニューの中のキー（React の木では帯の子だが、画面では帯の外に出している）は帯の動きにしない
    if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return;
    e.preventDefault();
    const at = TOOL_NAMES.indexOf(stop);
    const last = TOOL_NAMES.length - 1;
    const next =
      e.key === "Home"
        ? 0
        : e.key === "End"
          ? last
          : e.key === "ArrowRight"
            ? (at + 1) % TOOL_NAMES.length
            : (at - 1 + TOOL_NAMES.length) % TOOL_NAMES.length;
    const name = TOOL_NAMES[next]!;
    setStop(name);
    bar.current?.querySelector<HTMLButtonElement>(`button[data-tool="${name}"]`)?.focus();
  };
  const render = (t: BarTool): ReactNode => {
    const common = { tool: t, stop, onFocusTool };
    const mark = MARKS[t.name];
    if (mark) return <MarkTool key={t.name} {...common} editor={editor} type={mark} />;
    const action = HISTORY[t.name];
    if (action) return <HistoryTool key={t.name} {...common} editor={editor} action={action} />;
    const block = BLOCKS[t.name];
    if (block) return <BlockTool key={t.name} {...common} editor={editor} kind={block} />;
    const align = ALIGNS[t.name];
    if (align) return <AlignTool key={t.name} {...common} editor={editor} align={align} />;
    const script = SCRIPTS[t.name];
    if (script) return <ScriptTool key={t.name} {...common} editor={editor} type={script[0]} other={script[1]} />;
    if (t.name === "見出し") return <HeadingTool key={t.name} {...common} editor={editor} />;
    if (t.name === "並び") return <ListTool key={t.name} {...common} editor={editor} />;
    if (t.name === TABLE) return <TableTool key={t.name} {...common} editor={editor} />;
    const kind = COLORS[t.name];
    if (kind)
      return (
        <ColorTool
          key={t.name}
          {...common}
          editor={editor}
          kind={kind}
          open={color === kind}
          onToggle={() => toggleColor(kind)}
        />
      );
    if (t.name === "リンク")
      return (
        <ToolButton
          key={t.name}
          {...common}
          off={!editor}
          pressed={linkActive}
          extra={{ "aria-haspopup": "dialog", "aria-expanded": linkOpen }}
          onAct={onLink}
        />
      );
    return <ToolButton key={t.name} {...common} off />;
  };
  return (
    <>
      <div ref={bar} role="toolbar" aria-label="本文の道具" className="k-f4d-bar" onKeyDown={onKeyDown}>
        {BAR_GROUPS.map((group, gi) => (
          <span key={gi} className="k-f4d-bar-group" role="group">
            {group.map(render)}
          </span>
        ))}
      </div>
      {editor && color ? <ColorPopover key={color} kind={color} editor={editor} onClose={closeColor} /> : null}
    </>
  );
}
