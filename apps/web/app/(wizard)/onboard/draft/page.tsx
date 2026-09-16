"use client";
// たたき台を確かめる（T-U-08・A07／A08）。目標・台帳・担当業務とAI社員のたたき台を会社のデータ（API）から。AI が変えるときだけ提案→承認、人が変えるときは即反映（D-012・D-025）
import Link from "next/link";
import { Button, Empty, Section, Table, Td, Th, Pill } from "@/components/ui";
import { WizardLayout } from "@/components/wizard/wizard-layout";
import { WIZARD_EXISTING } from "@/components/wizard/existing";
import { RequireSession } from "@/lib/auth/session";
import { useList } from "@/lib/api";
import { Building2 } from "lucide-react";
import type { Goals, LedgerDefinitions, Duties } from "@kaname/contracts";

export default function DraftPage() {
  return (
    <RequireSession
      fallback={
        <WizardLayout title="たたき台を確かめる" purpose="確かめています" existing={WIZARD_EXISTING}>
          <p className="text-[13.5px] text-[var(--on-sv)]">ログインを確かめています</p>
        </WizardLayout>
      }
    >
      <Draft />
    </RequireSession>
  );
}
function Draft() {
  const goals = useList<Goals>("goals", { limit: 50 }, "onboard-draft");
  const ledgers = useList<LedgerDefinitions>("ledger_definitions", { limit: 50 }, "onboard-draft");
  // 担当業務の一覧は契約に GET が無い（08_api：duties は POST だけ）。仕様の穴として T-U-08 の audit に書く。ここでは空として出す
  const duties = { data: { data: [] as Duties[] } };
  const empty =
    !goals.isPending && !ledgers.isPending && (goals.data?.data.length ?? 0) + (ledgers.data?.data.length ?? 0) === 0;
  return (
    <WizardLayout
      title="たたき台を確かめる"
      purpose="自分のAIが会話と資料から作りました。違うところを言えば直します。自分で直接触っても構いません。"
      existing={WIZARD_EXISTING}
    >
      {empty ? (
        <div data-state="empty">
          <Empty
            icon={<Building2 />}
            title="まだたたき台がありません"
            action={
              <Link href="/onboard/interview">
                <Button variant="outline">自分のAIと話す</Button>
              </Link>
            }
          >
            自分のAIと話すと、目標・台帳・担当業務・AI社員のたたき台がここに並びます。
          </Empty>
        </div>
      ) : (
        <div data-state="n">
          <Section title="目標のたたき台">
            <Table>
              <thead>
                <tr>
                  <Th>目標</Th>
                  <Th>期間</Th>
                  <Th numeric>目標値</Th>
                </tr>
              </thead>
              <tbody>
                {(goals.data?.data ?? []).map((g) => (
                  <tr key={g.id}>
                    <Td>{(g as { name?: string }).name ?? "—"}</Td>
                    <Td>
                      {g.period_start ?? ""}〜{g.period_end ?? ""}
                    </Td>
                    <Td numeric>{(g as { target_value?: number }).target_value ?? ""}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-[12.5px] text-[var(--on-sv)]">
              単位は目標ごとに違います。親子で単位が変わるところは、自分のAIが変換のしかたを訊きます。
            </p>
          </Section>
          <Section title="台帳のたたき台">
            <Table>
              <thead>
                <tr>
                  <Th>台帳</Th>
                  <Th>段階</Th>
                </tr>
              </thead>
              <tbody>
                {(ledgers.data?.data ?? []).map((l) => (
                  <tr key={l.id}>
                    <Td>{(l as { name?: string }).name ?? "—"}</Td>
                    <Td>
                      {Array.isArray((l as unknown as { stages?: unknown }).stages)
                        ? (l as unknown as { stages: string[] }).stages.join(" → ")
                        : ""}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <p className="mt-2 text-[12.5px] text-[var(--on-sv)]">台帳ごとに画面は作りません。定義が違うだけです。</p>
          </Section>
          <Section title="担当業務とAI社員">
            {(duties.data?.data ?? []).length ? (
              <ul className="divide-y divide-[var(--line-soft)]">
                {(duties.data?.data ?? []).map((d) => (
                  <li key={d.id} className="flex items-center gap-3 py-2 text-[13.5px]">
                    <span className="flex-1">{(d as { name?: string }).name ?? "—"}</span>
                    <Pill tone="ai">AI社員</Pill>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-[var(--on-sv)]">担当業務はまだありません。</p>
            )}
            <p className="mt-2 text-[12.5px] text-[var(--on-sv)]">
              AI社員は自分のAIが窓口になって指示を配り、上がってきたものを一次確認します。あなたが押すのは最後だけです。
            </p>
          </Section>
          <Section title="最初のルール">
            <ul className="list-disc space-y-1 pl-5 text-[13.5px]">
              <li>外に出るもの（メール・請求書・投稿）は必ずあなたが承認してから</li>
              <li>銀行はブラウザで触らない（会計ソフトの正規連携だけ）</li>
              <li>CAPTCHA は突破しない。出たら止まってあなたに渡す</li>
            </ul>
          </Section>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/settings/credentials">
              <Button>これでいく</Button>
            </Link>
            <Link href="/onboard/interview">
              <Button variant="outline">会話で直す</Button>
            </Link>
          </div>
        </div>
      )}
    </WizardLayout>
  );
}
