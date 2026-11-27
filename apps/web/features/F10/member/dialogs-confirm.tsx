"use client";
// メンバーの 1 人の確かめの小窓（段 11・F10）：止める・戻す。
//   どれも本人確認を取り直す操作なので、足のボタンは「本人確認して〇〇」。キャンバスに絵が無い（画面に出る文は「仮」）。
//   Confirm をそのまま使う。押す関数は渡さない（下絵）
//   画面が口につながったあと（K-821）：busy（答えを待つ間は押せない）・onConfirm・onCancel を任意の props で受ける。渡さない呼び方（下絵）は今のまま
import { Confirm } from "@/components/k";

const noop = (): void => undefined;

export interface MemberConfirmProps {
  name: string;
  /** 答えを待っている（主ボタンは処理中・やめるも押せない） */
  busy?: boolean;
  /** 「本人確認して〇〇」を押したとき */
  onConfirm?: () => void;
  /** やめる・Esc・外を押して閉じたとき */
  onCancel?: () => void;
}

const closeOf = (onCancel?: () => void) => (open: boolean) => {
  if (!open) (onCancel ?? noop)();
};

export function SuspendConfirm({ name, busy = false, onConfirm = noop, onCancel }: MemberConfirmProps) {
  return (
    <Confirm
      open
      title={`${name} さんを一時的に止めますか`}
      description="入れなくなり、分身も止まります。担当しているチケットはそのままです。いつでも戻せます"
      confirmLabel="本人確認して止める"
      busy={busy}
      onOpenChange={closeOf(onCancel)}
      onConfirm={onConfirm}
    />
  );
}

export function ResumeConfirm({ name, busy = false, onConfirm = noop, onCancel }: MemberConfirmProps) {
  return (
    <Confirm
      open
      tone="primary"
      title={`${name} さんを戻しますか`}
      description="また入れるようになり、分身も動きます。止めていたあいだの担当はそのままです"
      confirmLabel="本人確認して戻す"
      busy={busy}
      onOpenChange={closeOf(onCancel)}
      onConfirm={onConfirm}
    />
  );
}
