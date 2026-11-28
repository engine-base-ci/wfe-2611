"use client";
// 項目の表の置き場（K-569・開発用）。作る面の項目の表（ItemsTable）を、下絵と同じ外枠・同じ作る面の並び（form.k-f4d-page）の中に出す。
//   クエリ kind=<種別の id>（既定の種別）・slot=due（期限の差し込み口にボタンを渡す）。「作る」は送る前の確かめを通し、
//   通れば送る値（toPayload の結果）を字で出す（口は呼ばない・作る口に送るのは作る面を組む K-442）。
//   最初に種別の口・人の口・自分を同時に 1 回ずつ読む。詳細のパネルは /dev/f4-items/detail（K-1153）
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Button, Select } from "@/components/k";
import { Frame } from "@/app/(dev)/dev/mock/f4/frame";
import { checkFields, toPayload, type FieldValue } from "@/features/F4/items/field-values";
import { focusFirstError } from "@/features/F4/items/custom-rows";
import { ItemsTable, rowNameOf, type Person } from "@/features/F4/items/items-table";
import { useTicketFields, useTicketKinds } from "@/features/F4/items/use-ticket-fields";
import { ONCE } from "@/features/F4/create-ticket/ticket-shell";
import { call } from "@/lib/api/call";
import { me } from "@/lib/auth/ext";
import { parseTheme } from "@/lib/theme";

const CRUMBS = [{ label: "チケット", href: "/tickets" }, { label: "チケットを作る" }];

interface MemberRow extends Person {
  deleted_at?: string | null;
  suspended_at?: string | null;
  kind_id?: string;
}

async function readPeople(): Promise<Person[]> {
  const r = await call("listMembers", { query: { limit: 200 }, screenId: "tickets" });
  if (!r.ok) return [];
  return (r.data as unknown as MemberRow[])
    .filter((m) => !m.deleted_at && !m.suspended_at && (m.kind_id ?? "human") === "human")
    .map((m) => ({ id: m.id, display_name: m.display_name }));
}

function ItemsHost() {
  const q = useSearchParams();
  const { kinds, retry } = useTicketKinds();
  const [kind, setKind] = useState<string | null>(q.get("kind"));
  const { fields, state } = useTicketFields(kind);
  const who = useQuery({ queryKey: ["me"], queryFn: me, ...ONCE });
  const people = useQuery({ queryKey: ["f4-items", "members"], queryFn: readPeople, ...ONCE });
  const [values, setValues] = useState<Record<string, FieldValue>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState("");
  const [dueTouched, setDueTouched] = useState(false);
  const myId = who.data ? String(who.data.member_id) : null;

  const onChange = (key: string, value: FieldValue) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => {
      if (!(key in e)) return e;
      return Object.fromEntries(Object.entries(e).filter(([k]) => k !== key));
    });
  };
  const make = () => {
    const found = checkFields(fields, values, {
      priority: values.priority ?? null,
      priority_reason: values.priority_reason ?? null,
      estimate: values.estimate ?? null,
    });
    setErrors(found);
    const keys = Object.keys(found);
    if (keys.length > 0) {
      setSent("");
      const order = ["priority_reason", "estimate", ...fields.map((f) => f.id)].filter((k) => keys.includes(k));
      const names = order.map((k) => rowNameOf(fields, k)).filter((n): n is string => n !== null);
      requestAnimationFrame(() =>
        focusFirstError(document.querySelector<HTMLElement>('.k-f4d-grid[aria-label="項目"]'), names),
      );
      return;
    }
    setSent(JSON.stringify({ fields: toPayload(fields, values) }));
  };

  return (
    <Frame theme={parseTheme(undefined)} crumbs={CRUMBS}>
      <div className="k-root">
        <form className="k-f4d-page" noValidate onSubmit={(e) => e.preventDefault()}>
          <header className="k-f4d-head">
            <h1>チケットを作る</h1>
            <Button type="button" onClick={make}>
              作る
            </Button>
          </header>
          <div className="k-f4d-kind">
            <Select
              label="種別"
              name="kind"
              required
              value={kind}
              options={kinds.map((k) => ({ value: k.id, label: k.name }))}
              onValueChange={(v) => setKind(v)}
            />
          </div>
          <section className="k-f4d-box" aria-label="項目の表">
            <ItemsTable
              fields={fields}
              values={values}
              errors={errors}
              onChange={onChange}
              people={people.data ?? []}
              me={myId}
              customState={state}
              onRetry={retry}
              slots={
                q.get("slot") === "due"
                  ? {
                      due: (
                        <div className="k-f4d-inline">
                          <Button variant="outlined" size="sm" type="button" onClick={() => setDueTouched(true)}>
                            期限
                          </Button>
                          {dueTouched ? <span>期限を渡した</span> : null}
                        </div>
                      ),
                    }
                  : {}
              }
            />
          </section>
          <output aria-label="送る値">{sent}</output>
        </form>
      </div>
    </Frame>
  );
}

export default function F4ItemsPage() {
  return (
    <Suspense fallback={null}>
      <ItemsHost />
    </Suspense>
  );
}
