"use client";
// 届いた依頼の下絵の描き手。描き手 B が書く。値は features/F11/requests/ の部品へ渡すだけ
import type { ReactNode } from "react";
import { Empty, ErrorState, Loading, NoAccess, PAGE_ERROR, type Crumb } from "@/components/k";
import { AskDialog, CreateTicketDialog, DeclineDialog } from "@/features/F11/requests/dialogs";
import { RequestList } from "@/features/F11/requests/list";
import { BackToRequests, RequestDetail, type RequestDetailProps } from "@/features/F11/requests/views";
import type { Theme } from "@/lib/theme";
import { CuFrame } from "./render-cu-frame";
import type { ProductState } from "./types";

const CRUMBS: Crumb[] = [{ label: "届いた依頼" }];

function Screen({
  theme,
  ps,
  current,
  main,
  dialog,
  rows,
  mobile,
}: {
  theme: Theme;
  ps: ProductState;
  current?: string;
  main: ReactNode;
  dialog?: ReactNode;
  rows?: Parameters<typeof RequestList>[0]["rows"];
  /** スマホ（767 以下）で出す画面：一覧だけ／開いた依頼だけ。無ければ両方（依頼が 0 件の空の形） */
  mobile?: "list" | "detail";
}) {
  return (
    <CuFrame theme={theme} ps={ps} screen="requests" crumbs={CRUMBS} {...(dialog ? { dialog } : {})}>
      <div className="k-root k-f11q-wrap" {...(mobile ? { "data-mobile": mobile } : {})}>
        <RequestList {...(rows ? { rows } : {})} {...(current ? { current } : {})} />
        {main}
      </div>
    </CuFrame>
  );
}

const Detail = (p: RequestDetailProps) => <RequestDetail {...p} />;

export function renderRq(id: string, theme: Theme): ReactNode | null {
  const S = (
    ps: ProductState,
    p: RequestDetailProps = {},
    dialog?: ReactNode,
    current = "r1",
    mobile: "list" | "detail" = "detail",
  ) => (
    <Screen
      theme={theme}
      ps={ps}
      current={current}
      mobile={mobile}
      main={<Detail ps={ps} {...p} />}
      {...(dialog ? { dialog } : {})}
    />
  );
  switch (id) {
    case "rq-list":
      // 一覧の画面ではどの依頼も開いていない（PC の右は先頭の依頼の形のまま）
      return S("PS2", {}, undefined, "", "list");
    case "rq-new":
      return S("PS2");
    case "rq-new-ps0":
      return S("PS0");
    case "rq-asking":
      return S("PS2", { status: "asking" }, undefined, "r2");
    case "rq-done":
      return S("PS2", { status: "done" }, undefined, "r4");
    case "rq-empty":
      return (
        <Screen
          theme={theme}
          ps="PS0"
          rows={[]}
          main={
            <section className="k-f11q-detail" aria-label="依頼">
              <Empty title="届いた依頼はまだありません">
                ゲストが「ゲストの場所」から依頼を出すと、ここに届きます。
              </Empty>
            </section>
          }
        />
      );
    case "rq-loading":
      return (
        <Screen
          theme={theme}
          ps="PS2"
          mobile="detail"
          main={
            <section className="k-f11q-detail" aria-label="依頼">
              <BackToRequests />
              <Loading label="届いた依頼を読み込んでいます…" delayMs={0} />
            </section>
          }
        />
      );
    case "rq-failed":
      return (
        <CuFrame theme={theme} ps="PS2" screen="requests" crumbs={CRUMBS}>
          <section className="k-root k-f11c-page k-f11c-msg-page">
            <ErrorState code={PAGE_ERROR.loadFailed} acts={[() => undefined]} />
          </section>
        </CuFrame>
      );
    case "rq-noaccess":
      return (
        <CuFrame theme={theme} ps="PS2" screen="requests" crumbs={CRUMBS}>
          <section className="k-root k-f11c-page k-f11c-msg-page">
            <NoAccess acts={["/today"]} />
          </section>
        </CuFrame>
      );
    case "rq-readonly":
      return S("PS2", { canAct: false });
    case "rq-edited":
      return S("PS2", { edited: true });
    case "rq-route":
      return S("PS2", { menuOpen: true });
    case "rq-create":
      return S("PS2", {}, <CreateTicketDialog />);
    case "rq-create-bad":
      return S("PS2", {}, <CreateTicketDialog phase="bad" />);
    case "rq-saving":
      return S("PS2", {}, <CreateTicketDialog phase="saving" />);
    case "rq-accepted":
      return S("PS2", { phase: "accepted" });
    case "rq-accept-failed":
      return S("PS2", {}, <CreateTicketDialog phase="failed" />);
    case "rq-ask":
      return S("PS2", {}, <AskDialog />);
    case "rq-ask-error":
      return S("PS2", {}, <AskDialog phase="error" />);
    case "rq-decline":
      return S("PS2", {}, <DeclineDialog />);
    case "rq-decline-error":
      return S("PS2", {}, <DeclineDialog phase="error" />);
    case "rq-declined":
      return S("PS2", { phase: "declined" });
    default:
      return null;
  }
}
