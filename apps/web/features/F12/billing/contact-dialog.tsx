"use client";
// 請求先を変える小窓（K-960）。見た目は部品 views.tsx の ContactDialog（モック ub-contact と同じ）。
//   開くと今の 3 欄を入れる。「保存する」は画面で確かめ（billing-shape.ts の contactErrors）、誤りがあれば欄の下に字を出して口を呼ばない。
//   <form> で送らない（onClick）ので、ブラウザの標準の確かめに止められず、画面の字が必ず出る（L-003 G-01）。
//   422 は欄ごとの口の字を欄の下に・ほかの失敗は小窓の中に知らせ（打った値は残す）。送っている間は 2 回目を送らない
import { useRef, useState } from "react";
import { PAGE_ERROR, errorText } from "@/components/k";
import { contactErrors, type ContactIn } from "./billing-shape";
import { useSaveContact } from "./use-billing";
import { ContactDialog, type ContactField } from "./views";

const FIELDS: readonly ContactField[] = ["company", "attn", "email"];
const downText = (): string => {
  const t = errorText(PAGE_ERROR.down);
  return `${t.title}${t.body}`;
};

export function EditContactDialog({ contact, onClose }: { contact: ContactIn; onClose: () => void }) {
  const save = useSaveContact();
  const [values, setValues] = useState<ContactIn>(contact);
  const [errors, setErrors] = useState<Partial<Record<ContactField, string>>>({});
  const [alert, setAlert] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);

  const onSave = async (): Promise<void> => {
    if (sending.current) return;
    const checked = contactErrors(values);
    setErrors(checked.errors);
    setAlert(undefined);
    if (Object.keys(checked.errors).length > 0) return;
    sending.current = true;
    setBusy(true);
    const r = await save(checked.values);
    sending.current = false;
    setBusy(false);
    if (r.ok) {
      onClose();
      return;
    }
    const fieldErrors = Object.fromEntries(FIELDS.filter((f) => r.fields[f]).map((f) => [f, r.fields[f]!]));
    if (Object.keys(fieldErrors).length > 0) setErrors(fieldErrors);
    else setAlert(downText());
  };

  return (
    <ContactDialog
      contact={contact}
      values={values}
      errors={errors}
      {...(alert ? { alert } : {})}
      busy={busy}
      onChange={(field, value) => setValues((v) => ({ ...v, [field]: value }))}
      onSave={() => void onSave()}
      onCancel={() => {
        if (!sending.current) onClose();
      }}
    />
  );
}
