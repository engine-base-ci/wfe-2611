"use client";
// 自分のPCをつなぐ（T-U-09・A09）。状態：接続中（n）／つながった（ok）／つながらない（ng）／運用中（s）。接続コードは API が発行、Bridge が入れる。claim は T-I-*
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Section, Table, Td, Th, Pill } from "@/components/ui";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { useList } from "@/lib/api";
import { bridgePair } from "@/lib/auth/ext";
import type { Sessions } from "@kaname/contracts";

const WHAT = [
  "あなたのPCで、あなたのブラウザ・あなたのログイン済みセッションを使って動く。だから CAPTCHA や bot 検知に到達しない（本人の環境・本人のペース）",
  "PCが閉じている間は動きません。起きたときに溜まった分を順に片づけます（サーバー経路は段階2）",
  "資格情報を読まない（預かり先の番号だけを受け取る）",
  "銀行をブラウザで触らない",
  "利用規約で自動操作を禁じるサービスは操作しない",
];
export default function BridgeSetupPage() {
  return (
    <RequireSession
      fallback={
        <WizardLayout title="自分のPCをつなぐ" purpose="確かめています" existing={WIZARD_EXISTING}>
          <p className="text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>
        </WizardLayout>
      }
    >
      <Bridge />
    </RequireSession>
  );
}
function Bridge() {
  const sessions = useList<Sessions>("sessions", { limit: 50 }, "bridge-setup");
  const bridges = (sessions.data?.data ?? []).filter((s) => s.kind_id === "bridge" && !s.revoked_at);
  const [code, setCode] = useState<string | null>(null);
  const [tries, setTries] = useState(0);
  const [pairError, setPairError] = useState<string | null>(null);
  useEffect(() => {
    bridgePair().then(
      (r) => setCode(r.code),
      (e: Error) => setPairError(e.message),
    );
  }, []);
  const state = sessions.isPending ? "loading" : bridges.length ? "ok" : tries > 0 ? "ng" : "n";
  const recheck = async () => {
    setTries((t) => t + 1);
    await sessions.refetch();
  };
  return (
    <WizardLayout
      title="自分のPCをつなぐ"
      purpose="自分のAIもAI社員も、あなたのPCで・あなたのサブスクで動きます。つながるまで自分のAIは話せません。API は使いません。"
      existing={WIZARD_EXISTING}
    >
      {state === "ok" ? (
        <div data-state="ok" data-requires="bridge">
          <p className="text-[15px] font-semibold text-[var(--st-success)]">つながりました</p>
          <Section title="接続">
            <Table>
              <thead>
                <tr>
                  <Th>端末</Th>
                  <Th>登録</Th>
                  <Th>最後の応答</Th>
                  <Th>状態</Th>
                </tr>
              </thead>
              <tbody>
                {bridges.map((b) => (
                  <tr key={b.id}>
                    <Td>{b.device_label ?? "この PC"}</Td>
                    <Td>{b.issued_at ? new Date(b.issued_at).toLocaleDateString("ja-JP") : ""}</Td>
                    <Td>{b.last_seen_at ? new Date(b.last_seen_at).toLocaleString("ja-JP") : ""}</Td>
                    <Td>
                      <Pill tone="success">接続中</Pill>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Section>
          <div className="mt-6">
            <Link href="/onboard/interview">
              <Button>自分のAIと話すへ</Button>
            </Link>
          </div>
        </div>
      ) : (
        <div data-state={state}>
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <Section title="手順">
              <ol className="space-y-4 text-[14px]">
                <li>
                  <b>1. インストーラを入れる</b>
                  <div className="text-[13px] text-[var(--on-sv)]">
                    ダウンロードして開く。管理者権限は要りません（macOS Apple Silicon / Intel・Windows 10 以降）。配布は
                    Bridge の版が出てから
                  </div>
                </li>
                <li>
                  <b>2. ブラウザの許可を出す</b>
                  <div className="text-[13px] text-[var(--on-sv)]">Bridge が Chrome を操作するための許可を1回だけ</div>
                </li>
                <li>
                  <b>3. 接続コードを入れる</b>
                  <div className="mt-1 flex items-center gap-3">
                    <code
                      className="num rounded-[var(--r-md)] bg-[var(--sv)] px-3 py-1.5 font-[var(--font-code)] text-[20px] tracking-[0.12em]"
                      data-pair-code
                    >
                      {code ?? (pairError ? "発行できませんでした" : "…")}
                    </code>
                    <span className="text-[13px] text-[var(--on-sv)]">
                      この画面の番号を Bridge に入れる（10 分で失効）
                    </span>
                  </div>
                </li>
                <li>
                  <b>4. 自己診断</b>
                  <div className="text-[13px] text-[var(--on-sv)]">Bridge が自分で確かめて、結果をここに返す</div>
                </li>
              </ol>
              {state === "ng" ? (
                <p
                  className="mt-4 rounded-[var(--r-md)] bg-[#fbebd6] px-3 py-2 text-[13px] text-[var(--st-warning)]"
                  role="status"
                >
                  <b>つながっていません。</b> Bridge
                  を入れて接続コードを入れたあと、もう一度確かめてください。急がなくて大丈夫です。
                </p>
              ) : null}
              <div className="mt-5 flex flex-wrap gap-2">
                <Button onClick={recheck}>接続を確かめる</Button>
                <Link href="/onboard/draft">
                  <Button variant="ghost">あとでやる（自分のAIはまだ話せません）</Button>
                </Link>
              </div>
            </Section>
            <Section title="Bridge が何をするか・しないか">
              <ul className="list-disc space-y-1.5 pl-5 text-[13px]">
                {WHAT.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Section>
          </div>
        </div>
      )}
    </WizardLayout>
  );
}
