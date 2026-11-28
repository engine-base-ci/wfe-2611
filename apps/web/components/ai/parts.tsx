"use client";
// 会話の部品は 1 組（D-066.1）：会話モード・右パネル・はじめの設定が同じものを使う
import { Check, ExternalLink, Pencil, Square, Undo2 } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Pill, type PillTone } from "@/components/ui/pill";

/** ① 質問の選択肢：チップ＋必ず「その他（自由に書く）」「あとで」（D-066.2） */
export function ChoiceChips({
  options,
  onPick,
  onOther,
  onLater,
}: {
  options: string[];
  onPick: (v: string) => void;
  onOther: () => void;
  onLater: () => void;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" data-part="choices">
      {options.map((o) => (
        <Button key={o} variant="outline" size="sm" onClick={() => onPick(o)}>
          {o}
        </Button>
      ))}
      <Button variant="ghost" size="sm" onClick={onOther}>
        その他（自由に書く）
      </Button>
      <Button variant="ghost" size="sm" onClick={onLater}>
        あとで
      </Button>
    </div>
  );
}

/** ② 承認カード：中身（宛先・金額・差分）を全部見せる。承認／直す／止める（D-066.3） */
export function ApprovalCard({
  title,
  rows,
  diff,
  onApprove,
  onFix,
  onStop,
  busy,
}: {
  title: string;
  rows: { label: string; value: ReactNode }[];
  diff?: ReactNode;
  onApprove: () => void;
  onFix: () => void;
  onStop: () => void;
  busy?: boolean;
}) {
  return (
    <div
      className="rounded-[var(--r-lg)] border border-[var(--line)] bg-[var(--card)] p-3.5 text-[13px]"
      data-part="approval"
    >
      <div className="mb-2 flex items-center gap-2">
        <Pill tone="warning">承認待ち</Pill>
        <b className="font-semibold">{title}</b>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <dt className="whitespace-nowrap text-[var(--on-sv)]">{r.label}</dt>
            <dd className="min-w-0 font-medium">{r.value}</dd>
          </div>
        ))}
      </dl>
      {diff ? (
        <div className="mt-2 rounded-[var(--r-md)] bg-[var(--surface)] p-2.5 font-[var(--font-code)] text-[12px] whitespace-pre-wrap">
          {diff}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-1.5">
        <Button size="sm" icon={<Check />} onClick={onApprove} disabled={busy}>
          承認する
        </Button>
        <Button size="sm" variant="outline" icon={<Pencil />} onClick={onFix} disabled={busy}>
          直す
        </Button>
        <Button size="sm" variant="danger" icon={<Square />} onClick={onStop} disabled={busy}>
          止める
        </Button>
      </div>
    </div>
  );
}

/** ③ 受領カード：何が変わった・どこ・取り消し（D-066.4）。取り消しはトーストにも載せる（sonner） */
export function ReceiptCard({
  what,
  where,
  href,
  onUndo,
  undoable = true,
}: {
  what: string;
  where: string;
  href?: string;
  onUndo?: () => void;
  undoable?: boolean;
}) {
  const undo = () => {
    onUndo?.();
    toast("取り消しました", { description: what });
  };
  return (
    <div
      className="rounded-[var(--r-lg)] border-l-[3px] border-[var(--tertiary)] bg-[var(--tertiary-c)] p-3 text-[13px] text-[var(--on-tertiary-c)]"
      data-part="receipt"
    >
      <div className="font-semibold">{what}</div>
      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px]">
        <span>{where}</span>
        {href ? (
          <a className="inline-flex items-center gap-1 font-semibold text-[var(--primary)]" href={href}>
            <ExternalLink className="size-3" />
            開く
          </a>
        ) : null}
        <span className="flex-1" />
        {undoable ? (
          <Button variant="ghost" size="sm" icon={<Undo2 />} onClick={undo}>
            取り消す
          </Button>
        ) : (
          <span className="text-[var(--on-sv)]">取り消せません（外に出ました）</span>
        )}
      </div>
    </div>
  );
}
export const showReceiptToast = (what: string, onUndo?: () => void) =>
  toast(what, onUndo ? { action: { label: "取り消す", onClick: onUndo } } : {});

/** ④ 自信と根拠（D-066.5）：高／中／低と、根拠（引用）を並べる */
export function Confidence({ level, basis }: { level: "high" | "mid" | "low"; basis?: ReactNode }) {
  const tone: PillTone = level === "high" ? "success" : level === "mid" ? "progress" : "warning";
  const label = level === "high" ? "自信あり" : level === "mid" ? "たぶん" : "確認したい";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12px] text-[var(--on-sv)]" data-part="confidence">
      <Pill tone={tone}>{label}</Pill>
      {basis}
    </div>
  );
}
/** 引用：台帳・記録の 1 件へのリンク。押すと中央に反映される画面へ */
export function Citation({ label, href, className }: { label: string; href: string; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[var(--sv)] px-2 py-0.5 text-[11.5px] font-semibold text-[var(--on-sv)] hover:bg-[var(--primary-c)] hover:text-[var(--on-primary-c)]",
        className,
      )}
      data-part="citation"
    >
      <ExternalLink className="size-3" />
      {label}
    </a>
  );
}
