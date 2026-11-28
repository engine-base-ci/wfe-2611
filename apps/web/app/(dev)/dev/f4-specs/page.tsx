"use client";
// 確認項目の欄の置き場（K-450・開発用）。本物の部品 SpecsItem と本物の口の道具を、下絵と同じ外枠の中に出す。
//   クエリ mode=create|detail・ticket=<uuid>・count=<整数>（詳細の閉じた形の件数＝getTicket の spec_count）・n=<整数>（作る面に最初から持たせる行の数）。
//   詳細は右のパネル（k-detail-panel）の「確認項目」の区画に入れる（下絵 f4v2-specs と同じ幅）。作る面は作る面の並び（form.k-f4d-page）の中に入れ、
//   行の変わるたびに送る値（{"specs":[文の並び]}）を字で出す（口は呼ばない・作る口に送るのは K-442）。
//   ext=controlled|only（詳細のみ・試験の道具）：頁に「外から開く」を出す。controlled は addOpen を頁の状態につないだ SpecsItem、only は小窓だけの SpecAddOnly
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button } from "@/components/k";
import { Frame } from "@/app/(dev)/dev/mock/f4/frame";
import { SpecAddOnly } from "@/features/F4/specs/spec-add-only";
import { SpecsItem } from "@/features/F4/specs/specs-item";
import { parseTheme } from "@/lib/theme";

const CREATE_CRUMBS = [{ label: "チケット", href: "/tickets" }, { label: "チケットを作る" }];
const DETAIL_CRUMBS = [{ label: "チケット", href: "/tickets" }, { label: "確認項目" }];
const toInt = (v: string | null, fallback: number): number => {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};

function CreateHost({ n }: { n: number }) {
  const [lines, setLines] = useState<string[]>(() => Array.from({ length: n }, (_, i) => `確認項目 ${i + 1}`));
  return (
    <Frame theme={parseTheme(undefined)} crumbs={CREATE_CRUMBS}>
      <div className="k-root">
        <form className="k-f4d-page" noValidate onSubmit={(e) => e.preventDefault()}>
          <header className="k-f4d-head">
            <h1>チケットを作る</h1>
          </header>
          <section className="k-f4d-box" aria-label="項目の表">
            <SpecsItem mode="create" lines={lines} onChange={setLines} />
          </section>
          <output aria-label="送る値">{JSON.stringify({ specs: lines })}</output>
        </form>
      </div>
    </Frame>
  );
}

function DetailHost({ ticket, count, ext }: { ticket: string; count: number; ext: string | null }) {
  const [addOpen, setAddOpen] = useState(false);
  const outer = ext === "controlled" || ext === "only";
  return (
    <Frame theme={parseTheme(undefined)} crumbs={DETAIL_CRUMBS}>
      <div className="k-detail">
        <section className="k-root k-page" aria-labelledby="f4-specs-title">
          <h1 id="f4-specs-title">確認項目の置き場</h1>
          {outer ? (
            <Button variant="outlined" onClick={() => setAddOpen(true)}>
              外から開く
            </Button>
          ) : null}
        </section>
        <aside aria-label="チケットのパネル" className="k-detail-panel">
          <div className="k-detail-panel-body">
            <section aria-label="確認項目" className="k-detail-panel-sec">
              <h2>確認項目</h2>
              {ext === "only" ? null : ext === "controlled" ? (
                <SpecsItem
                  mode="detail"
                  ticketId={ticket}
                  count={count}
                  addOpen={addOpen}
                  onAddOpenChange={setAddOpen}
                />
              ) : (
                <SpecsItem mode="detail" ticketId={ticket} count={count} />
              )}
            </section>
          </div>
        </aside>
      </div>
      {ext === "only" ? <SpecAddOnly ticketId={ticket} open={addOpen} onOpenChange={setAddOpen} /> : null}
    </Frame>
  );
}

function SpecsHost() {
  const q = useSearchParams();
  if (q.get("mode") === "create") return <CreateHost n={Math.min(toInt(q.get("n"), 0), 50)} />;
  return <DetailHost ticket={q.get("ticket") ?? ""} count={toInt(q.get("count"), 0)} ext={q.get("ext")} />;
}

export default function F4SpecsPage() {
  return (
    <Suspense fallback={null}>
      <SpecsHost />
    </Suspense>
  );
}
