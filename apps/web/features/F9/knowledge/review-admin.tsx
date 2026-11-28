"use client";
// K-696 ナレッジの管理の面「見直すページ」：口（use-review.ts）の答えを部品 ReviewView に渡す。
//   「開く」はそのページ・「書き方を直す」はそのページを書いている画面（?edit=1）・「並べて見る」はその行の下に上と下の本文を並べる。
//   本文は DocView（境界 B10）で描く。一覧の登録は admin-lists.ts の ADMIN_LISTS（K-694）
import type { ReactNode } from "react";
import type { Doc } from "@kaname/contracts";
import { Button, Loading, PAGE_ERROR, errorText } from "@/components/k";
import { DocView } from "@/features/F4/doc/editor";
import { ReviewView } from "./admin-views";
import type { AdminCtx } from "./admin-lists";
import { capNote, reviewEmptyText, reviewPageHref } from "./review-shape";
import { LoadFailed, PageNoAccess } from "./states";
import { useReview, type PairPage } from "./use-review";

const EMPTY_DOC = { type: "doc", content: [] } as const;
const Card = ({ children }: { children: ReactNode }) => <article className="k-f9-card">{children}</article>;

/** 並べる 1 列：題名・場所の見出しと本文（読めなければその列だけ知らせる） */
function PairColumn({
  title,
  place,
  state,
  onRetry,
}: {
  title: string;
  place: string;
  state: PairPage | undefined;
  onRetry: () => void;
}) {
  let body: ReactNode = <Loading delayMs={0} />;
  if (state?.status === "ready" && state.page) {
    const doc = (state.page.body?.doc ?? EMPTY_DOC) as Doc;
    body = <DocView doc={doc} ariaLabel={`${title}の本文`} />;
  } else if (state?.status === "error") {
    const code = state.error?.code ?? PAGE_ERROR.loadFailed;
    const t = errorText(code);
    body = (
      <div className="k-state" data-state="error" data-code={code} role="alert">
        <p className="k-state-title">{t.title}</p>
        {state.error?.noAccess ? null : (
          <div className="k-state-actions">
            <Button variant="outlined" size="sm" onClick={onRetry} aria-label="もう一度読む">
              {t.actions[0] ?? "もう一度"}
            </Button>
          </div>
        )}
      </div>
    );
  }
  return (
    <section className="k-f9-pair-col" aria-label={title}>
      <header>
        <b>{title}</b>
        <small>{place}</small>
      </header>
      {body}
    </section>
  );
}

export function ReviewAdmin(ctx: AdminCtx) {
  const rv = useReview();
  if (rv.status === "error" && rv.error) {
    return (
      <Card>
        {rv.error.noAccess ? (
          <PageNoAccess onBack={() => ctx.go("/knowledge")} />
        ) : (
          <LoadFailed code={rv.error.code} onRetry={rv.retry} />
        )}
      </Card>
    );
  }
  if (rv.status === "loading")
    return (
      <Card>
        <Loading delayMs={0} />
      </Card>
    );
  const { rows } = rv;
  const panes = Object.fromEntries(
    rows.conflicts
      .filter((r) => rv.openIds.has(r.id) && rows.pairs[r.id])
      .map((r) => {
        const { upperId, lowerId } = rows.pairs[r.id]!;
        return [
          r.id,
          <>
            <PairColumn
              title={r.upper}
              place={r.upperPlace}
              state={rv.pages.get(upperId)}
              onRetry={() => rv.retryPage(upperId)}
            />
            <PairColumn
              title={r.lower}
              place={r.lowerPlace}
              state={rv.pages.get(lowerId)}
              onRetry={() => rv.retryPage(lowerId)}
            />
          </>,
        ];
      }),
  );
  return (
    <ReviewView
      unused={rows.unused}
      conflicts={rows.conflicts}
      broken={rows.broken}
      openIds={rv.openIds}
      panes={panes}
      handlers={{
        open: (id) => ctx.go(reviewPageHref(id)),
        fix: (id) => ctx.go(reviewPageHref(id, true)),
        compare: rv.toggleCompare,
      }}
      limitNotes={{
        unused: capNote(rows.unused.length),
        conflicts: capNote(rows.conflicts.length),
        broken: capNote(rows.broken.length),
      }}
      emptyTexts={{
        unused: reviewEmptyText("unused"),
        conflicts: reviewEmptyText("conflicts"),
        broken: reviewEmptyText("broken"),
      }}
    />
  );
}
