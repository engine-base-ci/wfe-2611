"use client";
import { Check, Inbox } from "lucide-react";
import { Button, Empty, Field, Input, Metric, Pill, Section, StoppedBanner, Table, Td, Th } from "@/components/ui";

// 部品の見本（T-US-05）。治具が hover／focus・24px の的・コントラストを測る
export default function DevUi() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <StoppedBanner
        reason="PC が閉じています。"
        action={
          <Button variant="outline" size="sm">
            直す
          </Button>
        }
      />
      <Section title="ボタン（1 画面 1 主アクション）">
        <div className="flex flex-wrap gap-2">
          <Button icon={<Check />}>承認する</Button>
          <Button variant="secondary">配る</Button>
          <Button variant="outline">直す</Button>
          <Button variant="ghost">あとで</Button>
          <Button variant="danger">止める</Button>
          <Button size="sm">小さい</Button>
          <Button disabled>押せない</Button>
        </div>
      </Section>
      <Section title="札（状態は面）">
        <div className="flex flex-wrap gap-2">
          <Pill tone="success">承認済み</Pill>
          <Pill tone="warning">承認待ち</Pill>
          <Pill tone="danger">止まった</Pill>
          <Pill tone="progress">作業中</Pill>
          <Pill tone="neutral">下書き</Pill>
          <Pill tone="ai">AI社員</Pill>
        </div>
      </Section>
      <Section title="数字">
        <div className="grid gap-6 sm:grid-cols-3">
          <Metric label="受注" value={8} unit="件" sub="目標 10 件・残り 3 週" tone="warn" />
          <Metric label="売上" value="4,200,000" unit="円" sub="先月比 +12%" tone="ok" />
          <Metric label="未収" value={2} unit="件" sub="7 日超" tone="bad" />
        </div>
      </Section>
      <Section title="表（数値列は右寄せ）">
        <Table>
          <thead>
            <tr>
              <Th>案件</Th>
              <Th>状態</Th>
              <Th numeric>金額</Th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <Td>セイコー</Td>
              <Td>
                <Pill tone="warning">提案中</Pill>
              </Td>
              <Td numeric>1,200,000</Td>
            </tr>
            <tr>
              <Td>京蟻</Td>
              <Td>
                <Pill tone="success">受注</Pill>
              </Td>
              <Td numeric>380,000</Td>
            </tr>
          </tbody>
        </Table>
      </Section>
      <Section title="入力欄">
        <Field label="メールアドレス" help="全角や空白は直して通します">
          {(id) => <Input id={id} type="email" placeholder="you@example.com" />}
        </Field>
        <Field label="会社名" error="会社名を入れてください。1 文字以上">
          {(id) => <Input id={id} invalid defaultValue="" />}
        </Field>
      </Section>
      <Section title="空の状態">
        <Empty
          icon={<Inbox />}
          title="まだ承認待ちはありません"
          action={
            <Button variant="outline" size="sm">
              自分のAIに頼む
            </Button>
          }
        >
          AI社員が動くと、ここに並びます。
        </Empty>
      </Section>
    </main>
  );
}
