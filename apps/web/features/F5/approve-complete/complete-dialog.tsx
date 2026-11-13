"use client";
// 完了の小窓（K-183・口は K165 の completeTicket）。上に完了の条件の本文、実施事項の項目ごとのチェック、
//   「完了の条件を満たしたことを確かめました」。済み（- [x]）の項目は入ったままで外せない（決める人の答え answer=bf373f5b265a）。
//   ブラウザ標準の検証は使わない（noValidate・required を付けない）。揃うまでは口を呼ばず、小窓の中に正本の文（E-VAL-022・E-VAL-023）。
//   口の 422（残りの項目・終わっていない子）は小窓の中に出し、閉じない。それ以外の断りは閉じて、呼んだ側が知らせて読み直す。
//   文は全部文字として出す（HTML を作らない）
import { useRef, useState } from "react";
import { isUuid } from "@kaname/contracts";
import { Button, Dialog } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { catalogMessage, messageOf } from "./message";
import { todoItems, type Problem } from "./complete-model";
import "./approve.css";

/** 小窓の中に出す 422（正本の ID）。ほかは呼んだ側の知らせ */
const IN_DIALOG = new Set(["E-VAL-022", "E-VAL-023", "E-VAL-024"]);

interface Props {
  ticketId: string;
  /** 実施事項の区画（見出し・本文・読んだ版）。区画が無ければ本文は空・版は 0 */
  todo: { label: string; text: string; version: number };
  /** 完了の条件の区画（見出し・本文） */
  conditions: { label: string; text: string };
  onClose: () => void;
  /** 完了にできた（201） */
  onDone: () => void | Promise<void>;
  /** 小窓の中に出さない断り（409 など）。小窓は閉じてある */
  onFailed: (r: CallErr) => void | Promise<void>;
}

/** 口の 422 の答え → 小窓の中の知らせ（文は正本、明細は口の答えをそのまま） */
function problemOf(r: CallErr): Problem {
  const details = Array.isArray(r.body["details"]) ? (r.body["details"] as Record<string, unknown>[]) : [];
  return {
    message: messageOf(r),
    items: details
      .filter((d) => d["field"] === "todo_checked" || d["field"] === "children")
      .map((d) => ({
        text: String(d["message"] ?? ""),
        ...(d["field"] === "children" && typeof d["id"] === "string" && isUuid(d["id"])
          ? { href: `/tickets/${d["id"]}` }
          : {}),
      })),
  };
}

/** 小窓の中の値（チェック・確かめ・知らせ）と「確かめて完了にする」。2 回押しでも口は 1 回 */
function useComplete({ ticketId, todo, onClose, onDone, onFailed }: Props) {
  const items = todoItems(todo.text);
  const [checked, setChecked] = useState<boolean[]>(() => items.map((x) => x.done));
  const [confirmed, setConfirmed] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false); // 答えが来るまで 2 本目を送らない（押せない間の click も含む）

  /** 揃っていない所（口を呼ぶ前の確かめ）。口と同じ文を正本から引く */
  const missing = (): Problem[] => {
    const left = items.filter((_, i) => !checked[i]).map((x) => ({ text: x.text }));
    return [
      ...(left.length ? [{ message: catalogMessage("E-VAL-022"), items: left }] : []),
      ...(confirmed ? [] : [{ message: catalogMessage("E-VAL-023"), items: [] }]),
    ];
  };
  const send = async () => {
    if (sending.current) return;
    const local = missing();
    setProblems(local);
    if (local.length) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("completeTicket", {
        params: { id: ticketId },
        body: {
          // 生成の型は並びの中身を string にするが、口は 0 からの整数だけを受ける（文字だと 422）。数で送る
          todo_checked: items.flatMap((_, i) => (checked[i] ? [i] : [])) as unknown as string[],
          todo_version: todo.version,
          conditions_confirmed: true,
        },
        screenId: "tickets",
      });
      if (r.ok) {
        onClose();
        await onDone();
        return;
      }
      if (r.status === 401) return; // 入り直しへ（共通の扱い）
      if (r.status === 422 && IN_DIALOG.has(r.code)) return setProblems([problemOf(r)]);
      onClose();
      await onFailed(r);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };
  const toggle = (i: number, on: boolean) => setChecked((c) => c.map((v, j) => (j === i ? on : v)));
  return { items, checked, toggle, confirmed, setConfirmed, problems, busy, send };
}

export function CompleteDialog(props: Props) {
  const { todo, conditions, onClose } = props;
  const c = useComplete(props);
  return (
    <Dialog
      title="完了にする"
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      actions={
        <>
          <Button variant="ghost" onClick={onClose}>
            やめる
          </Button>
          <Button onClick={() => void c.send()} loading={c.busy} disabled={c.busy}>
            確かめて完了にする
          </Button>
        </>
      }
    >
      <form
        className="k63-complete"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void c.send();
        }}
      >
        <section aria-label={conditions.label}>
          <p className="k-label">{conditions.label}</p>
          <p className="k63-text">{conditions.text}</p>
        </section>
        {c.items.length ? (
          <fieldset className="k63-checks">
            <legend className="k-label">{todo.label}</legend>
            {c.items.map((x, i) => (
              <label key={i} className="k63-check">
                <input
                  type="checkbox"
                  checked={c.checked[i] ?? false}
                  disabled={x.done}
                  onChange={(e) => c.toggle(i, e.target.checked)}
                />
                <span>{x.text}</span>
              </label>
            ))}
          </fieldset>
        ) : null}
        <label className="k63-check">
          <input type="checkbox" checked={c.confirmed} onChange={(e) => c.setConfirmed(e.target.checked)} />
          <span>完了の条件を満たしたことを確かめました</span>
        </label>
        {c.problems.length ? <Problems problems={c.problems} /> : null}
      </form>
    </Dialog>
  );
}

function Problems({ problems }: { problems: Problem[] }) {
  return (
    <div role="alert" className="k63-problems k-err">
      {problems.map((p, i) => (
        <div key={i}>
          <p>{p.message}</p>
          {p.items.length ? (
            <ul>
              {p.items.map((x, j) => (
                <li key={j}>
                  {x.href ? (
                    <a className="k-link" href={x.href}>
                      {x.text}
                    </a>
                  ) : (
                    x.text
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  );
}
