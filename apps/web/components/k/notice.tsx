"use client";
// 知らせ（K-24）。2 つ：
//   Callout … 画面の中の帯（正本 components.callout-*）。危ない知らせは role="alert"、ほかは role="status"
//   Toaster / notify / dismissNotify / useNotify … 小さな知らせ（コピーした・保存した・消した直後の「元に戻す」）。sonner（技術の選定 D-067）。
//   読み上げに伝わる。Alt+T で知らせの束に移れ、閉じるボタンはいつも出す。sonner を直に読むのはこのファイルだけ（置き場の鍵・長さ・見た目の class を 1 か所に）
import { Toaster as Sonner, toast } from "sonner";
import { createContext, useContext, type ReactNode } from "react";

export type CalloutTone = "info" | "warn" | "danger";
export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: CalloutTone;
  title?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="k-callout" data-tone={tone} role={tone === "danger" ? "alert" : "status"}>
      <div>
        {title ? <div className="k-callout-title">{title}</div> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}

const TOASTER_ID = "k";

/** 置き場の中にいるか（外枠 TicketShell も画面も Toaster で包むので、入れ子になったら内側は置き場を出さない。同じ id の置き場が 2 つあると知らせが 2 枚出る） */
const InToaster = createContext(false);

/** 小さな知らせの置き場。画面の木の上に 1 つ。前の画面の置き場（components/providers）とは名前で分ける */
export function Toaster({ children }: { children: ReactNode }) {
  const inside = useContext(InToaster);
  if (inside) return <>{children}</>;
  return (
    <InToaster.Provider value>
      {children}
      <Sonner
        id={TOASTER_ID}
        position="bottom-center"
        closeButton
        containerAriaLabel="お知らせ"
        mobileOffset={{ bottom: "calc(var(--k-c-shell-tabs-height) + var(--k-s-sm))" }}
        toastOptions={{
          unstyled: true,
          closeButtonAriaLabel: "閉じる",
          classNames: {
            toast: "k-toast",
            title: "k-toast-title",
            description: "k-toast-desc",
            closeButton: "k-toast-close",
            actionButton: "k-toast-action",
          },
        }}
      />
    </InToaster.Provider>
  );
}

/** 知らせに付けるボタン（「元に戻す」など）。押すと onClick を呼び、知らせは閉じる */
export interface NotifyAction {
  label: string;
  onClick: () => void;
}
/** 知らせの出し方。duration を渡さなければ、ふつうは 5 秒・失敗（error）は自分で閉じるまで残す */
export interface NotifyOptions {
  description?: string;
  type?: "info" | "error";
  action?: { label: string; onClick: () => void };
  duration?: number;
}
/** ふつうの知らせが出ている長さ */
const INFO_MS = 5000;

/** 知らせを出し、知らせの鍵を返す（dismissNotify で閉じるときに使う）。
 *  読み上げと探し方のため、題を role の付いた要素で包む（失敗は alert・ふつうは status。sonner は role を付けないのでここ 1 か所で付ける） */
export function notify(title: string, o: NotifyOptions = {}): string | number {
  const isError = o.type === "error";
  return (isError ? toast.error : toast)(<span role={isError ? "alert" : "status"}>{title}</span>, {
    toasterId: TOASTER_ID,
    ...(o.description ? { description: o.description } : {}),
    ...(o.action ? { action: { label: o.action.label, onClick: o.action.onClick } } : {}),
    duration: o.duration ?? (isError ? Infinity : INFO_MS),
    className: isError ? "k-toast k-toast-error" : "k-toast",
  });
}

/** 出した知らせを閉じる（鍵は notify が返した値） */
export function dismissNotify(id: string | number): void {
  toast.dismiss(id);
}

/** 画面の部品が使う入口（毎回同じ関数を返す）。部品の外から出すときは notify を直に呼ぶ */
export function useNotify() {
  return notify;
}
