import type { ReactNode } from "react";

// 空の状態（G18 empty）：何が無いか・次の一手を 1 行で。数字を出さない（時点の正直さ・L-007）
export function Empty({
  icon,
  title,
  children,
  action,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="px-5 py-14 text-center text-[var(--on-sv)]" data-empty>
      {icon ? <div className="mb-3.5 flex justify-center opacity-35 [&>svg]:size-[38px]">{icon}</div> : null}
      <h3 className="mb-1.5 text-[15px] font-bold text-[var(--on-surface)]">{title}</h3>
      {children ? <p className="mx-auto mb-[18px] max-w-[420px] text-[13px]">{children}</p> : null}
      {action}
    </div>
  );
}
