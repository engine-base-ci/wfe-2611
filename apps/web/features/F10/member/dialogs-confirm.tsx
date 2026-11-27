"use client";
// メンバーの 1 人の確かめの小窓（段 11・F10）：止める・戻す。
//   どれも本人確認を取り直す操作なので、足のボタンは「本人確認して〇〇」。キャンバスに絵が無い（画面に出る文は「仮」）。
//   Confirm をそのまま使う。押す関数は渡さない（下絵）
import { Confirm } from "@/components/k";

const noop = (): void => undefined;

export function SuspendConfirm({ name }: { name: string }) {
  return (
    <Confirm
      open
      title={`${name} さんを一時的に止めますか`}
      description="入れなくなり、分身も止まります。担当しているチケットはそのままです。いつでも戻せます"
      confirmLabel="本人確認して止める"
      onOpenChange={noop}
      onConfirm={noop}
    />
  );
}

export function ResumeConfirm({ name }: { name: string }) {
  return (
    <Confirm
      open
      tone="primary"
      title={`${name} さんを戻しますか`}
      description="また入れるようになり、分身も動きます。止めていたあいだの担当はそのままです"
      confirmLabel="本人確認して戻す"
      onOpenChange={noop}
      onConfirm={noop}
    />
  );
}
