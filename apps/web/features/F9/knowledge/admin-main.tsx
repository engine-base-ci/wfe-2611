"use client";
// K-694 ナレッジの管理の面（本文の場所）：一覧の登録（admin-lists.ts）から、いまの一覧を選んで描く。
//   承認待ち（ApprovalsAdmin）は口（use-approvals.ts）の答えを部品 ApprovalsView に渡す。本文は DocView（境界 B10）で描く
import type { ReactNode } from "react";
import type { Doc } from "@kaname/contracts";
import { Loading } from "@/components/k";
import { DocView } from "@/features/F4/doc/editor";
import { ApprovalsView } from "./admin-views";
import type { AdminCtx, AdminListEntry } from "./admin-lists";
import type { AdminListKey } from "./approvals-shape";
import { LoadFailed, PageNoAccess } from "./states";
import { useApprovals } from "./use-approvals";

const Card = ({ children }: { children: ReactNode }) => <article className="k-f9-card">{children}</article>;

export function ApprovalsAdmin(ctx: AdminCtx) {
  const a = useApprovals(ctx, true);
  if (a.status === "error" && a.error) {
    return (
      <Card>
        {a.error.noAccess ? (
          <PageNoAccess onBack={() => ctx.go("/knowledge")} />
        ) : (
          <LoadFailed code={a.error.code} onRetry={a.retry} />
        )}
      </Card>
    );
  }
  if (a.status === "loading")
    return (
      <Card>
        <Loading delayMs={0} />
      </Card>
    );
  const bodies = Object.fromEntries(
    [...a.bodies].map(([id, doc]) => [id, <DocView key={id} doc={doc as Doc} ariaLabel="本文" />]),
  );
  return (
    <ApprovalsView
      items={a.items}
      bodies={bodies}
      openIds={a.openIds}
      busyIds={a.busyIds}
      handlers={{
        approve: a.approve,
        startDecline: a.startDecline,
        cancelDecline: a.cancelDecline,
        decline: a.decline,
        reason: a.setReason,
        toggleBody: a.toggleBody,
      }}
    />
  );
}

/** いまの一覧（登録の無い一覧は最初の登録にする）。登録は入れ物が admin-lists.ts の ADMIN_LISTS を渡す */
export function AdminMain({
  list,
  ctx,
  lists,
}: {
  list: AdminListKey;
  ctx: AdminCtx;
  lists: readonly AdminListEntry[];
}) {
  const entry = lists.find((l) => l.key === list) ?? lists[0];
  if (!entry) return null;
  const View = entry.View;
  return <View {...ctx} />;
}
