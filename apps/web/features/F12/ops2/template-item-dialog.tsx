"use client";
// ひな形の新しい版の 1 つを直す・足す小窓（K-1111）。種別＝名前・色・本文のひな形／状態＝名前・色／項目＝名前・必須・説明（足すときだけ種類）。
//   ［保存する］は直し（Edits）に入れるだけで口は呼ばない。入れられないとき（名前が空・種別は 10 まで）は小窓を閉じず中身を残し、小窓の中に赤字を出す。
//   段 10 の部品（TextField・Select・DocEditor・色の見本の形）を使う。色は段 10 の 8 つの字（K-704・K-1010 の契約と同じ）。
//   小窓の中身の下絵は無い（仮・下絵が来たら字と並びだけを合わせる）
import { Check } from "lucide-react";
import { useState } from "react";
import type { Doc } from "@kaname/contracts";
import { Button, Dialog, NoticeBox, Select, TextArea, TextField } from "@/components/k";
import { DocEditor } from "@/features/F4/doc/editor";
import "@/features/F9/settings/settings.css";
import type { Part, TemplateItem } from "./template-edit-shape";

/** 色（段 10 の 8 つの字と名前） */
export const TONES: readonly { key: string; name: string }[] = [
  { key: "indigo", name: "藍" },
  { key: "teal", name: "青緑" },
  { key: "amber", name: "黄土" },
  { key: "coral", name: "珊瑚" },
  { key: "sage", name: "若草" },
  { key: "plum", name: "葡萄" },
  { key: "lavender", name: "藤" },
  { key: "teal-light", name: "浅葱" },
];
export const toneName = (key: string | undefined): string => TONES.find((t) => t.key === key)?.name ?? "—";

/** 項目の種類（段 10 の 7 つと金額・K-1010 の契約の字と画面の字・金額は answer=6280a4739b6e） */
export const FIELD_TYPES: readonly { key: string; name: string }[] = [
  { key: "short_text", name: "1 行" },
  { key: "long_text", name: "複数行" },
  { key: "number", name: "数" },
  { key: "money", name: "金額" },
  { key: "date", name: "日付" },
  { key: "select", name: "1 つ選ぶ" },
  { key: "multi_select", name: "複数選ぶ" },
  { key: "check", name: "チェック" },
];
export const fieldTypeName = (key: string | undefined): string => FIELD_TYPES.find((t) => t.key === key)?.name ?? "—";

const NAME_MAX = 40;
const DESC_MAX = 200;
const NAME_INVALID = `名前を 1〜${NAME_MAX} 字で入れてください`; // （仮）
const DESC_INVALID = `説明は ${DESC_MAX} 字までです`; // （仮）
const EMPTY_DOC: Doc = { type: "doc", content: [{ type: "paragraph" }] } as Doc;
const isDoc = (v: unknown): v is Doc =>
  v !== null &&
  typeof v === "object" &&
  (v as { type?: unknown }).type === "doc" &&
  Array.isArray((v as { content?: unknown }).content);

function ColorRadios({ value, name, onChange }: { value: string; name: string; onChange: (k: string) => void }) {
  return (
    <div className="k-f9s-colors">
      <p className="k-label" id={`${name}-label`}>
        色
      </p>
      <div className="k-f9s-swatches" role="radiogroup" aria-labelledby={`${name}-label`}>
        {TONES.map((t) => (
          <label key={t.key} className="k-f9s-swatch" data-tone={t.key} title={t.name}>
            <input
              type="radio"
              name={name}
              aria-label={t.name}
              checked={t.key === value}
              onChange={() => onChange(t.key)}
            />
            <Check size={14} aria-hidden="true" />
          </label>
        ))}
      </div>
    </div>
  );
}

export interface TemplateItemDialogProps {
  open: boolean;
  part: Part;
  partName: string;
  /** 直す物（無ければ足す） */
  item: TemplateItem | null;
  /** 足すときの鍵（足した物の key） */
  newKey: string;
  /** 直しに入れる。入れられなければ小窓の中に出す字を返す（入れたら null） */
  onSave: (item: TemplateItem) => string | null;
  onClose: () => void;
}

/** 開くたびに中身を作り直す（key を変えて渡す） */
export function TemplateItemDialog(p: TemplateItemDialogProps) {
  const base = p.item;
  const [name, setName] = useState(base?.name ?? "");
  const [tone, setTone] = useState(base?.color_key ?? TONES[0]!.key);
  const [doc, setDoc] = useState<Doc | null>(isDoc(base?.body_template) ? base.body_template : null);
  const [fieldType, setFieldType] = useState(base?.field_type ?? FIELD_TYPES[0]!.key);
  const [required, setRequired] = useState(base?.required ?? false);
  const [desc, setDesc] = useState(base?.description ?? "");
  const [nameError, setNameError] = useState<string | null>(null);
  const [descError, setDescError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const adding = base === null;
  const title = adding ? `${p.partName}を足す` : `${p.partName}「${base.name}」を直す`;

  const itemOf = (n: string): TemplateItem => {
    const key = base?.key ?? p.newKey;
    if (p.part === "kind")
      return { ...base, key, name: n, color_key: tone, body_template: doc ?? base?.body_template ?? null };
    if (p.part === "state") return { ...base, key, name: n, color_key: tone };
    return {
      options: [],
      kind_keys: [],
      ...base,
      key,
      name: n,
      field_type: base?.field_type ?? fieldType,
      required,
      description: desc,
    };
  };
  const submit = () => {
    const n = name.trim();
    const badName = n.length < 1 || n.length > NAME_MAX;
    const badDesc = p.part === "field" && desc.length > DESC_MAX;
    setNameError(badName ? NAME_INVALID : null);
    setDescError(badDesc ? DESC_INVALID : null);
    if (badName || badDesc) return;
    setNotice(p.onSave(itemOf(n)));
  };

  return (
    <Dialog
      open={p.open}
      onOpenChange={(o) => (o ? undefined : p.onClose())}
      title={title}
      actions={
        <>
          <Button variant="outlined" onClick={p.onClose}>
            やめる
          </Button>
          <Button onClick={submit}>保存する</Button>
        </>
      }
    >
      <form
        className="k-dialog-stack"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        {notice ? (
          <div role="alert">
            <NoticeBox>{notice}</NoticeBox>
          </div>
        ) : null}
        <TextField
          label="名前"
          name="template_item_name"
          value={name}
          required
          maxLength={NAME_MAX}
          error={nameError}
          onChange={(e) => setName(e.target.value)}
        />
        {p.part !== "field" ? <ColorRadios value={tone} name="template_item_tone" onChange={setTone} /> : null}
        {p.part === "kind" ? (
          <div className="k-field">
            <p className="k-label">本文のひな形</p>
            <DocEditor doc={doc ?? EMPTY_DOC} onChange={setDoc} ariaLabel="本文のひな形の中身" />
          </div>
        ) : null}
        {p.part === "field" && adding ? (
          <Select
            label="種類"
            name="template_item_type"
            options={FIELD_TYPES.map((t) => ({ value: t.key, label: t.name }))}
            value={fieldType}
            onValueChange={(v) => setFieldType(v ?? FIELD_TYPES[0]!.key)}
          />
        ) : null}
        {p.part === "field" ? (
          <>
            <label className="k-f9s-check">
              <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} />
              必須
            </label>
            <TextArea
              label="説明"
              name="template_item_desc"
              value={desc}
              error={descError}
              onChange={(e) => setDesc(e.target.value)}
            />
          </>
        ) : null}
      </form>
    </Dialog>
  );
}
