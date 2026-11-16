"use client";
import { useState } from "react";
import { Button, Confirm, Dialog, Empty, Loading, TextField } from "@/components/k";

// 部品の大きさの見本（K-218・キャンバスの値）。tests/k/k218-design-parts.spec.ts の的。開発のページ（KANAME_DEV_PAGES のときだけ）
export default function KDesignPage() {
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  return (
    <main
      className="k-root"
      style={{ padding: "var(--k-s-lg)", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "var(--k-s-lg)" }}
    >
      <h1>部品の大きさ</h1>
      <section
        aria-label="ボタン"
        style={{ display: "flex", flexWrap: "wrap", gap: "var(--k-s-sm)", alignItems: "center" }}
      >
        <Button data-testid="btn-md">作る</Button>
        <Button data-testid="btn-lg" size="lg">
          次へ
        </Button>
        <Button data-testid="btn-outlined" variant="outlined">
          下書きのまま閉じる
        </Button>
      </section>
      <section aria-label="入力欄" style={{ display: "grid", gap: "var(--k-s-md)", maxWidth: "480px" }}>
        <div data-testid="field-md">
          <TextField label="題名" name="title" data-testid="input-md" />
        </div>
        <div data-testid="field-lg">
          <TextField label="メール" name="email" type="email" size="lg" data-testid="input-lg" />
        </div>
      </section>
      <section aria-label="小窓" style={{ display: "flex", flexWrap: "wrap", gap: "var(--k-s-sm)" }}>
        <Dialog
          title="完了にする"
          trigger={
            <Button data-testid="dlg-open" variant="outlined">
              小窓を開く
            </Button>
          }
          actions={
            <>
              <Button variant="outlined">やめる</Button>
              <Button>完了にする</Button>
            </>
          }
        >
          <p>実施事項が全部済んでいます。完了にしますか。</p>
        </Dialog>
        <Dialog
          title="共有の相手"
          description="このチケットを見られる人を選びます"
          trigger={
            <Button data-testid="dlg-plain-open" variant="outlined">
              足の無い小窓を開く
            </Button>
          }
        />
        <Button data-testid="confirm-open" variant="outlined" onClick={() => setConfirm(true)}>
          確かめを開く
        </Button>
        <Confirm
          open={confirm}
          onOpenChange={setConfirm}
          title="チケットを消しますか"
          description="消すと戻せません"
          confirmLabel="消す"
          onConfirm={() => setConfirm(false)}
        />
      </section>
      <div data-testid="empty-wrap" style={{ width: "900px", maxWidth: "100%" }}>
        <Empty title="まだチケットがありません" action={<Button>チケットを作る</Button>}>
          最初の 1 枚を作ると、ここに並びます
        </Empty>
      </div>
      <div data-testid="loading-wrap">
        <Button data-testid="loading-start" variant="outlined" onClick={() => setLoading(true)}>
          読み込みを出す
        </Button>
        {loading ? <Loading /> : null}
      </div>
    </main>
  );
}
