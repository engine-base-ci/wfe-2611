"use client";
// 知らせ（KN-104）。2 つ：
//   Callout … 画面の中の帯（正本 components.callout-*）。危ない知らせは role="alert"、ほかは role="status"
//   Toaster / useNotify … 小さな知らせ（コピーした・保存した）。Base UI Toast。読み上げに伝わる。
//     束にマウスを乗せるか F6 で移ると広がり、「閉じる」が押せる（広がる前は読み上げから隠す：Base UI の作り）
import { Toast } from "@base-ui-components/react/toast";
import type { ReactNode } from "react";

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

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((t) => (
    <Toast.Root key={t.id} toast={t} className="k-toast">
      <div>
        <Toast.Title />
        <Toast.Description />
      </div>
      <Toast.Close className="k-toast-close" aria-label="閉じる">
        ×
      </Toast.Close>
    </Toast.Root>
  ));
}

/** 小さな知らせの置き場。画面の木の上に 1 つ */
export function Toaster({ children }: { children: ReactNode }) {
  return (
    <Toast.Provider timeout={5000}>
      {children}
      <Toast.Portal>
        <Toast.Viewport className="k-toast-viewport" aria-label="知らせ">
          <ToastList />
        </Toast.Viewport>
      </Toast.Portal>
    </Toast.Provider>
  );
}

/** 知らせを出す。失敗の知らせ（error）は自分で閉じるまで残す */
export function useNotify() {
  const m = Toast.useToastManager();
  return (title: string, o: { description?: string; type?: "info" | "error" } = {}) =>
    m.add({ title, description: o.description, type: o.type ?? "info", timeout: o.type === "error" ? 0 : 5000 });
}
