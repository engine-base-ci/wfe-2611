"use client";
// 完了の小窓（K-183・口は K165 の completeTicket）。上に完了の条件の本文、実施事項の項目ごとのチェック、
//   「完了の条件を満たしたことを確かめました」。済み（- [x]）の項目は入ったままで外せない（決める人の答え answer=bf373f5b265a）。
//   ブラウザ標準の検証は使わない（noValidate・required を付けない）。揃うまでは口を呼ばず、小窓の中に正本の文（E-VAL-022・E-VAL-023）。
//   口の 422（残りの項目・終わっていない子）は小窓の中に出し、閉じない。それ以外の断りは閉じて、呼んだ側が知らせて読み直す。
//   文は全部文字として出す（HTML を作らない）
//   形はキャンバス StCompleteModal（K-229）：頭の下に対象の行・完了の条件（12px・500 の見出しと 12px 灰の文）・実施事項は線の枠・その下に確かめのチェック
import { useRef, useState } from "react";
import { isUuid } from "@kaname/contracts";
import { Button, Checkbox, Dialog } from "@/components/k";
import { call, type CallErr } from "@/lib/api/call";
import { catalogMessage, messageOf } from "./message";
import { checkedNumbers, todoItems, type Problem } from "./complete-model";
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
  /** 頭の下の対象の行（「EG-133 11 月分の請求書を送る」） */
  target?: string;
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
  // 開いた時点の項目の並びと版を固定する。開いている間にチケットが読み直されても、古い並びのチェックを新しい版で送らない
  //   （その間に実施事項が変わっていれば、口が版の違いで 409・E-CONF-017 を返す）
  const [opened] = useState(() => ({ items: todoItems(todo.text), version: todo.version }));
  const { items } = opened;
  const [checked, setChecked] = useState<boolean[]>(() => items.map((x) => x.done));
  const [confirmed, setConfirmed] = useState(false);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [local, setLocal] = useState(false); // 今出している知らせが、口を呼ぶ前の確かめのものか
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
    const lacking = missing();
    setProblems(lacking);
    setLocal(lacking.length > 0);
    if (lacking.length) return;
    sending.current = true;
    setBusy(true);
    try {
      const r = await call("completeTicket", {
        params: { id: ticketId },
        body: {
          todo_checked: checkedNumbers(checked),
          todo_version: opened.version,
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
  /** チェックを入れ直したら、口を呼ぶ前の確かめの知らせは消す（口から来た 422 の明細は残す） */
  const edited = () => {
    if (local) setProblems([]);
    setLocal(false);
  };
  const toggle = (i: number, on: boolean) => {
    setChecked((c) => c.map((v, j) => (j === i ? on : v)));
    edited();
  };
  const confirm = (on: boolean) => {
    setConfirmed(on);
    edited();
  };
  /** 答えを待っている間は閉じない（開き直して 2 本目を送らせない） */
  const close = () => {
    if (!sending.current) onClose();
  };
  return { items, checked, toggle, confirmed, confirm, problems, busy, send, close };
}

export function CompleteDialog(props: Props) {
  const { todo, conditions, target } = props;
  const c = useComplete(props);
  return (
    <Dialog
      title="完了にする"
      {...(target ? { target } : {})}
      open
      onOpenChange={(open) => {
        if (!open) c.close(); // Esc・外側のクリック
      }}
      actions={
        <>
          <Button variant="outlined" onClick={c.close} disabled={c.busy}>
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
        <section aria-label={conditions.label} className="k63-cond">
          <p className="k-label">{conditions.label}</p>
          <p className="k63-text">{conditions.text}</p>
        </section>
        {c.items.length ? (
          <fieldset className="k-dialog-group">
            <legend>{todo.label}</legend>
            {c.items.map((x, i) => (
              <Checkbox
                key={i}
                size="sm"
                checked={c.checked[i] ?? false}
                disabled={x.done}
                onChange={(e) => c.toggle(i, e.target.checked)}
              >
                {x.text}
              </Checkbox>
            ))}
          </fieldset>
        ) : null}
        <Checkbox size="sm" checked={c.confirmed} onChange={(e) => c.confirm(e.target.checked)}>
          完了の条件を満たしたことを確かめました
        </Checkbox>
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
