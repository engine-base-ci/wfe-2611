"use client";
// 帯のメニューの部品（K-587・Base UI Menu）。帯の道具（見出し・並び。K-568 の表も使う）を押すと、その道具の下に項目の箱が開く。
//   開く・閉じる・Enter／Space／↓／↑／Esc・外を押して閉じる・閉じたら道具に戻る・画面の外にはみ出さない置き方は Base UI に任せる。
//   箱は帯の中に閉じ込めず（帯は狭い幅で横に送られる）、重なりの置き場 k-popup-layer に、送られた帯の押した道具の下へ出す。
//   見た目は下絵と同じ k-f4d-pop・k-f4d-menu（extra.css）で、足りない物だけ editor.css。
//   項目をマウスで選んだら、使う側が閉じる前に焦点を編集欄へ移す（続けて打てる。焦点がもう箱の外に在るので Base UI は道具へ戻さない）。
//   キーボードで選んだら焦点は箱の中のままなので、閉じると道具に戻る（← → で続けて動ける）
import { useState, type ReactNode } from "react";
import { Menu as M } from "@base-ui/react/menu";

export interface BarMenuItem {
  name: string;
  role: "menuitemradio" | "menuitemcheckbox" | "menuitem";
  /** 選んでいる項目（menuitemradio・menuitemcheckbox） */
  checked?: boolean;
  /** 置けない場所などで押せない形 */
  disabled?: boolean;
  /** 選んだとき。byKey が真ならキーボードで選んだ（焦点は道具に戻る）。偽ならマウスで、使う側がこの中で焦点を編集欄へ移す */
  onSelect: (byKey: boolean) => void;
}

export interface BarMenuProps {
  /** 道具の名前＝メニューの名前 */
  label: string;
  items: readonly BarMenuItem[];
  /** 道具そのものが押せない形（編集の部品がまだ無いなど） */
  disabled?: boolean;
  /** 帯の Tab の停止点（roving tabindex） */
  tabIndex: number;
  onFocusTool: () => void;
  /** 道具の中身（字と ▾） */
  children: ReactNode;
}

function stopBase(event: { preventBaseUIHandler: () => void }) {
  event.preventBaseUIHandler();
}

export function BarMenu({ label, items, disabled = false, tabIndex, onFocusTool, children }: BarMenuProps) {
  const [open, setOpen] = useState(false);
  // native の disabled は渡さない（焦点が道具から落ちる）。開く手は Base UI の手前で止める（components/k/menu.tsx と同じ）
  const stop = disabled
    ? { onClick: stopBase, onMouseDown: stopBase, onPointerDown: stopBase, onKeyDown: stopBase }
    : {};
  // キーボード（Enter・Space）の click は detail が 0
  const select = (item: BarMenuItem, event: { detail: number }): void => item.onSelect(event.detail === 0);
  const radioValue = items.find((i) => i.role === "menuitemradio" && i.checked)?.name ?? "";
  const renderItem = (item: BarMenuItem): ReactNode => {
    const common = {
      nativeButton: true,
      render: <button type="button" />,
      disabled: item.disabled ?? false,
      closeOnClick: true,
      onClick: (event: { detail: number }) => select(item, event),
    };
    if (item.role === "menuitemradio")
      return (
        <M.RadioItem key={item.name} value={item.name} {...common}>
          {item.name}
        </M.RadioItem>
      );
    if (item.role === "menuitemcheckbox")
      return (
        <M.CheckboxItem key={item.name} checked={item.checked ?? false} {...common}>
          {item.name}
        </M.CheckboxItem>
      );
    return (
      <M.Item key={item.name} {...common}>
        {item.name}
      </M.Item>
    );
  };
  const radios = items.filter((i) => i.role === "menuitemradio");
  const others = items.filter((i) => i.role !== "menuitemradio");
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
            {radios.length > 0 ? <M.RadioGroup value={radioValue}>{radios.map(renderItem)}</M.RadioGroup> : null}
            {others.map(renderItem)}
          </M.Popup>
        </M.Positioner>
      </M.Portal>
    </M.Root>
  );
}
