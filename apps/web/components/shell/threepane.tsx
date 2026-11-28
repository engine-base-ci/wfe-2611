"use client";
import { ChevronLeft } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** 三画面（D-072）：左に一覧（380・1 行 48px・罫線）／中央に選んだ 1 件（640 以上）／右は自分のAI（AppShell が置く）。列ごとにスクロール。1023 以下は一覧と中身を切り替える */
export function ThreePane({
  queue,
  detail,
  selected,
  onBack,
  detailTitle,
}: {
  queue: ReactNode;
  detail: ReactNode;
  selected: boolean;
  onBack?: () => void;
  detailTitle?: string;
}) {
  const [tab, setTab] = useState<"queue" | "detail">("queue");
  const showDetail = selected && (tab === "detail" || true);
  return (
    <div className={cn("threepane", selected && "has-detail", showDetail && "show-detail")} data-threepane>
      <section className="queue" aria-label="一覧" onClickCapture={() => setTab("detail")}>
        {queue}
      </section>
      <section className="detail" aria-label={detailTitle ?? "選んだ 1 件"}>
        <button
          type="button"
          className="btn btn-g btn-sm detail-back"
          onClick={() => {
            setTab("queue");
            onBack?.();
          }}
        >
          <ChevronLeft /> 一覧へ
        </button>
        {detail}
      </section>
    </div>
  );
}
