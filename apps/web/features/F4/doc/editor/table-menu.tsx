"use client";
// 『表』のメニュー（K-568・Base UI Menu）。部品の表の命令を 5 つの組に全部並べる（項目の名前と並びは bar/use-table-commands.ts）。
//   開く・閉じる・Enter／↓／↑／Esc・外を押して閉じる・閉じたら『表』に戻る・画面の外にはみ出さない置き方は Base UI に任せる（帯のメニュー bar-menu.tsx と同じ作り。
//   bar-menu.tsx は組の区切りを持たないので、表はここで組む）。見た目は下絵 v2 の f4v2-editor-table と同じ k-f4d-pop・k-f4d-menu・k-f4d-menu-group。
//   押せない命令（表の外・列が 1 つだけの『列を消す』など）は押せない形（aria-disabled）。
//   マウスで選んだら命令が先に焦点を編集欄へ移す（続けて打てる）。キーボードで選んだら焦点は『表』に戻る
import { useState, type ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import { Menu as M } from "@base-ui/react/menu";
import { TABLE_GROUPS, TABLE_NAMES, useTableCommands } from "./bar/use-table-commands";

export interface TableMenuProps {
  /** 道具の名前＝メニューの名前（『表』） */
  label: string;
  editor: Editor | null;
  /** 帯の Tab の停止点（roving tabindex） */
  tabIndex: number;
  onFocusTool: () => void;
  /** 道具の中身（字と ▾） */
  children: ReactNode;
}

function stopBase(event: { preventBaseUIHandler: () => void }): void {
  event.preventBaseUIHandler();
}

export function TableMenu({ label, editor, tabIndex, onFocusTool, children }: TableMenuProps) {
  const [open, setOpen] = useState(false);
  const table = useTableCommands(editor);
  const disabled = !editor || !editor.isEditable;
  // native の disabled は渡さない（焦点が道具から落ちる）。開く手は Base UI の手前で止める（bar-menu.tsx と同じ）
  const stop = disabled
    ? { onClick: stopBase, onMouseDown: stopBase, onPointerDown: stopBase, onKeyDown: stopBase }
    : {};
  return (
    <M.Root open={open} onOpenChange={(next) => setOpen(next)} modal={false}>
      <M.Trigger
        aria-label={label}
        title={label}
        tabIndex={tabIndex}
        data-tool={label}
        aria-expanded={open}
        aria-disabled={disabled ? true : undefined}
        onFocus={onFocusTool}
        {...stop}
      >
        {children}
      </M.Trigger>
      <M.Portal>
        <M.Positioner className="k-popup-layer" align="start">
          <M.Popup aria-label={label} className="k-f4d-pop k-f4d-menu k-f4d-menu-live">
            {TABLE_GROUPS.map((group) => (
              <M.Group key={group[0]} className="k-f4d-menu-group">
                {group.map((cmd) => (
                  <M.Item
                    key={cmd}
                    nativeButton
                    render={<button type="button" />}
                    disabled={!table.can(cmd)}
                    closeOnClick
                    // キーボード（Enter・Space）の click は detail が 0
                    onClick={(event: { detail: number }) => void table.run(cmd, event.detail === 0)}
                  >
                    {TABLE_NAMES[cmd]}
                  </M.Item>
                ))}
              </M.Group>
            ))}
          </M.Popup>
        </M.Positioner>
      </M.Portal>
    </M.Root>
  );
}
