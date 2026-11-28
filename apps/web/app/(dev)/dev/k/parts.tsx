"use client";
import { useState } from "react";
import {
  Badge,
  Button,
  Callout,
  Confirm,
  Dialog,
  Select,
  Table,
  Tabs,
  TextArea,
  TextField,
  ThemeSwitch,
  Toaster,
  useNotify,
} from "@/components/k";
import type { Theme } from "@/lib/theme";

type Row = { id: string; title: string; owner: string; count: number; state: "success" | "warning" | "danger" };
const ROWS: Row[] = [
  { id: "t1", title: "見積を送る", owner: "高本", count: 3, state: "success" },
  { id: "t2", title: "請求の締め", owner: "佐藤", count: 12, state: "warning" },
  { id: "t3", title: "応募文の確認", owner: "鈴木", count: 1, state: "danger" },
];
const STATE = { success: "済み", warning: "待ち", danger: "止まっている" } as const;

/** 見本だけのときは自分で k-root の main を持つ。外枠の中に置くときは外枠の main の中身になる */
function Wrap({ bare, children }: { bare: boolean; children: React.ReactNode }) {
  if (bare) return <div style={{ padding: "var(--k-s-lg) var(--k-s-md)" }}>{children}</div>;
  return (
    <main className="k-root" style={{ minHeight: "100dvh", padding: "var(--k-s-lg) var(--k-s-md)" }}>
      {children}
    </main>
  );
}

export function PartsBody({ theme, bare = false }: { theme: Theme; bare?: boolean }) {
  const notify = useNotify();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);
  return (
    <Wrap bare={bare}>
      <div style={{ display: "flex", flexDirection: "column", gap: "var(--k-s-lg)", maxWidth: 880, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--k-s-md)", flexWrap: "wrap" }}>
          {bare ? null : (
            <h1 style={{ margin: 0, fontSize: "var(--k-text-h1)", lineHeight: "var(--k-lh-h1)" }}>部品の見本</h1>
          )}
          <ThemeSwitch initial={theme} />
        </div>

        <section aria-labelledby="h-btn">
          <h2 id="h-btn" style={{ fontSize: "var(--k-text-h3)" }}>
            ボタン
          </h2>
          <div style={{ display: "flex", gap: "var(--k-s-sm)", flexWrap: "wrap" }}>
            <Button
              loading={busy}
              onClick={() => {
                setBusy(true);
                setTimeout(() => setBusy(false), 600);
              }}
            >
              保存する
            </Button>
            <Button variant="secondary">下書き</Button>
            <Button variant="outlined">共有する</Button>
            <Button variant="ghost">あとで</Button>
            <Button variant="danger" onClick={() => setConfirm(true)}>
              消す
            </Button>
            <Button size="sm" variant="outlined">
              小さい
            </Button>
            <Button disabled>押せない</Button>
          </div>
          {done ? <p role="status">{done}</p> : null}
        </section>

        <section aria-labelledby="h-in" style={{ display: "grid", gap: "var(--k-s-md)" }}>
          <h2 id="h-in" style={{ fontSize: "var(--k-text-h3)" }}>
            入力・選ぶ
          </h2>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              setErr(title.trim() ? null : "件名を入れてください");
            }}
            style={{ display: "grid", gap: "var(--k-s-md)" }}
          >
            <TextField
              label="件名"
              name="title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={err}
              description="あとで直せます"
            />
            <TextArea label="中身" name="body" placeholder="書く" />
            <Select
              label="種類"
              name="kind"
              value={kind}
              onValueChange={setKind}
              options={[
                { value: "task", label: "タスク" },
                { value: "issue", label: "課題" },
                { value: "qa", label: "QA" },
                { value: "meeting", label: "会議", disabled: true },
              ]}
            />
            <div>
              <Button type="submit" variant="secondary">
                確かめる
              </Button>
            </div>
          </form>
        </section>

        <section aria-labelledby="h-tb">
          <h2 id="h-tb" style={{ fontSize: "var(--k-text-h3)" }}>
            表・札
          </h2>
          <Table
            caption="チケット（3 件）"
            rows={ROWS}
            rowKey={(r) => r.id}
            columns={[
              { key: "title", header: "件名", cell: (r) => r.title },
              { key: "owner", header: "担当", cell: (r) => r.owner },
              { key: "count", header: "回数", num: true, cell: (r) => r.count },
              { key: "state", header: "状態", cell: (r) => <Badge tone={r.state}>{STATE[r.state]}</Badge> },
            ]}
          />
          <div style={{ display: "flex", gap: "var(--k-s-sm)", flexWrap: "wrap", marginTop: "var(--k-s-sm)" }}>
            <Badge>下書き</Badge>
            <Badge tone="progress">進行中</Badge>
            <Badge tone="ai">分身が書いた</Badge>
          </div>
        </section>

        <section aria-labelledby="h-tabs">
          <h2 id="h-tabs" style={{ fontSize: "var(--k-text-h3)" }}>
            タブ
          </h2>
          <Tabs
            label="チケットの中"
            items={[
              { value: "body", label: "中身", panel: <p>中身のタブ</p> },
              { value: "log", label: "記録", panel: <p>記録のタブ</p> },
              { value: "files", label: "ファイル", panel: <p>ファイルのタブ</p> },
              { value: "locked", label: "まだ", panel: null, disabled: true },
            ]}
          />
        </section>

        <section aria-labelledby="h-nt" style={{ display: "grid", gap: "var(--k-s-sm)" }}>
          <h2 id="h-nt" style={{ fontSize: "var(--k-text-h3)" }}>
            知らせ・ダイアログ
          </h2>
          <Callout title="お知らせ">月末の締めは 25 日です</Callout>
          <Callout tone="warn">承認を待っているチケットが 2 件あります</Callout>
          <Callout tone="danger" title="送れませんでした">
            通信が切れました。もう一度送ってください
          </Callout>
          <div style={{ display: "flex", gap: "var(--k-s-sm)", flexWrap: "wrap" }}>
            <Button variant="outlined" onClick={() => notify("コピーしました")}>
              知らせを出す
            </Button>
            <Button variant="outlined" onClick={() => notify("保存できませんでした", { type: "error" })}>
              失敗の知らせ
            </Button>
            <Dialog
              title="共有の相手"
              description="このチケットを見られる人を選びます"
              trigger={<Button variant="outlined">ダイアログを開く</Button>}
            >
              <TextField label="相手のメール" name="share-email" type="email" />
            </Dialog>
          </div>
        </section>
      </div>
      <Confirm
        open={confirm}
        onOpenChange={setConfirm}
        title="チケットを消しますか"
        description="消すと戻せません"
        confirmLabel="消す"
        onConfirm={() => {
          setConfirm(false);
          setDone("消しました");
        }}
      />
    </Wrap>
  );
}

export function Parts({ theme }: { theme: Theme }) {
  return (
    <Toaster>
      <PartsBody theme={theme} />
    </Toaster>
  );
}
