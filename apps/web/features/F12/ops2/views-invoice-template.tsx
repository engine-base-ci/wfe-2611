"use client";
// 運営の請求書の型の設定（段 13・領域 ops2・絵は無い＝仮）：出す側の会社の情報・振込先・備考を運営が直す 1 枚の設定の頁。
//   置き場は 請求 の頭の［請求書の型］から入る。請求書の項目は普通の請求書と同じ（D-156.59）・型は 1 つで中身を運営が直す（D-156.60）。値を受け取って描くだけ
import { Button, Callout, PageBody, PageHeader, TextArea, TextField } from "@/components/k";
import { Card, Facts, Note } from "@/features/F12/ops/ops-parts";
import "@/features/F12/ops/ops.css";
import "./ops2.css";

/** 請求書に載る出す側の値（見本）。登録番号はインボイスの登録番号 */
export const INVOICE_TEMPLATE = {
  company: "Kaname 運営",
  address: "〒530-0001 大阪府大阪市北区梅田 1-1-1 梅田ビル 10 階",
  regNo: "T1234567890123",
  contact: "info@kaname.example",
  bank: "みらい銀行 梅田支店 普通 1234567 カナメウンエイ",
  note: "お振込手数料はご負担をお願いします。ご不明な点は「困ったとき・お知らせ」からお問い合わせください。",
} as const;

export type InvoiceTemplateMode = "view" | "edit" | "failed";
/** 部品の欄の値（入れ物が渡すときの形・見本と同じ鍵） */
export type InvoiceTemplateFields = { [K in keyof typeof INVOICE_TEMPLATE]: string };
export type InvoiceTemplateFieldName = keyof InvoiceTemplateFields;

export interface InvoiceTemplatePageProps {
  mode?: InvoiceTemplateMode;
  /** 出す値・欄の値（渡さなければ見本） */
  values?: InvoiceTemplateFields;
  /** 箱の右の字（「11/01 に 佐野 が直した」）。null なら出さない・渡さなければ見本の字 */
  aside?: string | null;
  /** 欄を書いた（渡したときだけ欄を書ける形にする） */
  onChange?: (name: InvoiceTemplateFieldName, value: string) => void;
  /** 欄ごとの誤りの字 */
  errors?: Partial<Record<InvoiceTemplateFieldName, string>>;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  /** 送っている間（ボタンを押せない） */
  busy?: boolean;
}

/** 請求書の型：見る（直すを押すと欄になる）・直す・保存できなかった（書いた値は残る） */
export function InvoiceTemplatePage({
  mode = "view",
  values,
  aside = "11/01 に 佐野 が直した",
  onChange,
  errors = {},
  onEdit,
  onCancel,
  onSave,
  busy = false,
}: InvoiceTemplatePageProps) {
  const t = values ?? INVOICE_TEMPLATE;
  const editing = mode !== "view";
  /** 欄の値の渡し方：onChange を渡したときだけ書ける欄（value）・渡さなければ今の見本の形（readOnly・defaultValue） */
  const bind = (name: InvoiceTemplateFieldName) =>
    onChange
      ? {
          value: t[name],
          onChange: (e: { target: { value: string } }) => onChange(name, e.target.value),
          ...(errors[name] ? { error: errors[name] } : {}),
        }
      : { readOnly: true, defaultValue: t[name] };
  return (
    <PageBody labelledBy="oq-invoice-template-title">
      <PageHeader
        id="oq-invoice-template-title"
        title="請求書の型"
        sub="すべての請求書に載る、出す側の会社の情報・振込先・備考"
        actions={
          editing ? (
            <>
              <Button variant="outlined" onClick={onCancel} disabled={busy}>
                やめる
              </Button>
              <Button onClick={onSave} disabled={busy}>
                保存する
              </Button>
            </>
          ) : (
            <Button variant="outlined" onClick={onEdit}>
              直す
            </Button>
          )
        }
      />
      <div className="k-op-body">
        {mode === "failed" ? (
          <Callout tone="danger" title="保存できませんでした">
            通信が切れたか、ほかの人が先に直しました。書いた値はそのまま残っています。もう一度「保存する」を押してください
          </Callout>
        ) : null}
        {editing ? (
          <Card title="出す側の会社">
            <div className="k-op-form">
              <TextField label="会社名" name="company" required {...bind("company")} />
              <TextField label="住所" name="address" required {...bind("address")} />
              <TextField
                label="登録番号"
                name="reg_no"
                required
                {...bind("regNo")}
                description="インボイスの登録番号（T と 13 けた）"
              />
              <TextField label="連絡先" name="contact" required {...bind("contact")} />
              <TextField label="振込先" name="bank" required {...bind("bank")} />
              <TextArea label="備考" name="note" hint="任意" rows={3} {...bind("note")} />
            </div>
          </Card>
        ) : (
          <Card title="出す側の会社" {...(aside ? { aside } : {})}>
            <Facts
              rows={[
                ["会社名", t.company],
                ["住所", t.address],
                ["登録番号", t.regNo],
                ["連絡先", t.contact],
                ["振込先", t.bank],
                ["備考", t.note],
              ]}
            />
          </Card>
        )}
        <Note>
          直すと、これから出す請求書に効きます（もう出した請求書は変わりません）。直したことは運営の記録に残ります。請求書の明細・消費税は、プランの値段から作ります
        </Note>
      </div>
    </PageBody>
  );
}
