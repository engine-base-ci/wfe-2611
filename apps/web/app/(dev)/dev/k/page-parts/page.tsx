import { Button, PageBody, PageHeader, Prose, Row, Section, TextLink } from "@/components/k";

// ページの型の見本（K-217）。形は今の 4 画面と同じ入れ子（section.k-root.k-page の中に帯と本文）。tests/k/k217-page-parts.spec.ts の的
const LONG = "あ".repeat(150) + "x".repeat(150);

export default function KPagePartsPage() {
  return (
    <PageBody labelledBy="page-parts-title">
      <PageHeader
        id="page-parts-title"
        title="チケット"
        sub="すべてのグループ"
        actions={<Button>＋ チケットを作る</Button>}
      />
      <Section title="目的">
        <p>取引先の 1 社を開き、今月の見積の状態を確かめます。</p>
        <Prose>{"1 行目の文\n2 行目の文"}</Prose>
        <Prose>{LONG}</Prose>
      </Section>
      <Section title="実施事項">
        <ul className="k-list">
          <li>見積を送る</li>
          <li>請求を締める</li>
        </ul>
        <p>
          <TextLink href="#detail">取引先の 1 社を開く</TextLink>
        </p>
        <Row>
          <Button>保存する</Button>
          <Button variant="secondary">やめる</Button>
        </Row>
      </Section>
      <div data-testid="bare">
        <h1>クラスの無い見出し 1</h1>
        <h2>クラスの無い見出し 2</h2>
        <h3>クラスの無い見出し 3</h3>
      </div>
    </PageBody>
  );
}
