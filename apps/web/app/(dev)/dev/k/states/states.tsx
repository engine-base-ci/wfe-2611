"use client";
import { useState } from "react";
import {
  Button,
  Empty,
  ErrorPage,
  ErrorState,
  Loading,
  NoAccess,
  OfflineBanner,
  PAGE_ERROR,
  errorCodeOf,
} from "@/components/k";

function Wrap({ bare, children }: { bare: boolean; children: React.ReactNode }) {
  if (bare) return <div style={{ padding: "var(--k-s-lg) var(--k-s-md)" }}>{children}</div>;
  return (
    <main className="k-root" style={{ minHeight: "100dvh", padding: "var(--k-s-lg) var(--k-s-md)" }}>
      {children}
    </main>
  );
}

export function States({ page, bare = false }: { page: string | null; bare?: boolean }) {
  const [asked, setAsked] = useState(false);
  const [n, setN] = useState(0);
  if (page) return <ErrorPage code={page} acts={["/dev/k/states", "/dev/k/states"]} />;
  return (
    <Wrap bare={bare}>
      <div style={{ maxWidth: 880, margin: "0 auto", display: "grid", gap: "var(--k-s-md)" }}>
        {bare ? null : <h1 style={{ margin: 0, fontSize: "var(--k-text-h1)" }}>4 つの状態</h1>}
        <OfflineBanner />
        <section aria-label="空の見本" data-sample="empty">
          <Empty
            title="まだチケットがありません"
            action={
              <Button variant="primary" onClick={() => setN((x) => x + 1)}>
                チケットを作る
              </Button>
            }
          >
            作ると、自分の AI が手伝えるようになります
          </Empty>
          {n ? <p role="status">作る（見本 {n}）</p> : null}
        </section>
        <section aria-label="読み込み中の見本" data-sample="loading">
          <Loading delayMs={300} />
        </section>
        <section aria-label="失敗の見本" data-sample="error">
          <ErrorState
            code={errorCodeOf({ kind: "failed", code: "INTERNAL", status: 502 })}
            acts={[() => setN((x) => x + 1)]}
          />
        </section>
        <section aria-label="権限が無いの見本" data-sample="forbidden">
          <NoAccess acts={[() => setAsked(true), "/dev/k"]} />
          {asked ? <p role="status">頼みました（見本）</p> : null}
        </section>
        <nav aria-label="エラーの画面" style={{ display: "flex", flexWrap: "wrap", gap: "var(--k-s-sm)" }}>
          {Object.entries(PAGE_ERROR).map(([k, code]) => (
            <a key={k} href={`/dev/k/states?page=${code}`}>
              {k}
            </a>
          ))}
        </nav>
      </div>
    </Wrap>
  );
}
