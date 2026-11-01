// dev の受信箱（D-088）。送出先が使えないときでも、確認や再設定のリンクをここから押して先へ進める。
// 中身は API のログ（.dev-logs/api.log）。本番には出さない（(dev) の枠が notFound する）。
import { readFileSync } from "node:fs";
import { notFound } from "next/navigation";
import { WEB_ENV } from "@/lib/env";

export const dynamic = "force-dynamic";

type Row = {
  at: string;
  kind: "verify" | "reset";
  to: string;
  url: string;
  result: "送った" | "送れなかった" | "送らなかった（dev の抑止）" | "まだ";
  why: string;
};

const LOG = process.env["KANAME_API_LOG"] ?? "../../.dev-logs/api.log";

function read(): { rows: Row[]; error: string } {
  let text = "";
  for (const p of [LOG, "../../.dev-logs/api.log", ".dev-logs/api.log"]) {
    try {
      text = readFileSync(p, "utf8");
      break;
    } catch {
      /* 次を試す */
    }
  }
  if (!text)
    return { rows: [], error: `ログを読めませんでした（${LOG}）。bash scripts/dev/up.sh で立ち上げてください` };
  const lines = text.split("\n");
  const rows: Row[] = [];
  for (const ln of lines) {
    const m = /\[auth\] リンク（(verify|reset) → ([^）]+)）: (https?:\S+)/.exec(ln);
    if (!m) continue;
    rows.push({ at: "", kind: m[1] as Row["kind"], to: m[2]!, url: m[3]!, result: "まだ", why: "" });
  }
  // 同じ宛先・同じ種類は最後の 1 本だけ（古いリンクは使えない）
  const last = new Map<string, Row>();
  for (const r of rows) last.set(`${r.kind}:${r.to}`, r);
  // 送れたか（[mail] の行）を当てる。件名で「確認」と「再設定」を分ける（宛先だけだと取り違える）
  const kindOf = (subject: string): Row["kind"] | null =>
    subject.includes("確認") ? "verify" : subject.includes("再設定") ? "reset" : null;
  for (const ln of lines) {
    const m = /\[mail\] (送った|送れなかった|送らなかった)([^→]*)→ ([^（]+)（([^）]*)）(?::\s*(.*))?$/.exec(ln);
    if (!m) continue;
    const k = kindOf(m[4] ?? "");
    if (!k) continue;
    const r = last.get(`${k}:${(m[3] ?? "").trim()}`);
    if (!r) continue;
    r.result = m[1] === "送った" ? "送った" : m[1] === "送れなかった" ? "送れなかった" : "送らなかった（dev の抑止）";
    r.why =
      m[1] === "送れなかった" ? (m[5] ?? "") : m[1] === "送らなかった" ? "自動テストの宛先なので送っていません" : "";
  }
  return { rows: [...last.values()].reverse(), error: "" };
}

const JA: Record<Row["kind"], string> = { verify: "登録の確認", reset: "パスワードの再設定" };

export default function DevMailPage() {
  if (WEB_ENV.isProduction && !WEB_ENV.devPages) notFound();
  const { rows, error } = read();
  return (
    <main className="mx-auto max-w-[880px] px-6 py-10">
      <h1 className="text-[22px] font-bold tracking-[-0.015em]">dev の受信箱</h1>
      <p className="mt-2 text-[13.5px] leading-[1.9] text-[var(--on-sv)]">
        送ったメールのリンクをここから押せます。送出先が使えないときでも先へ進めます。
        <b>ローカルで確かめるためだけのものです。</b>
        同じ宛先の古いリンクは出しません（押しても使えないため）。
      </p>
      {error ? (
        <p className="mt-6 rounded-[var(--r-md)] bg-[#FDF2F2] p-4 text-[13.5px]">{error}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-[var(--r-md)] bg-[var(--sv)] p-4 text-[13.5px]">
          まだ 1 通もありません。/signup から申し込むとここに出ます。
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <li key={`${r.kind}:${r.to}`} className="rounded-[var(--r-md)] border border-[var(--sv)] p-4">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-[13px] font-semibold">{JA[r.kind]}</span>
                <span className="num text-[13px] text-[var(--on-sv)]">{r.to}</span>
                <span
                  className={`rounded-[var(--r-sm)] px-2 py-0.5 text-[11.5px] ${
                    r.result === "送った"
                      ? "bg-[#DCFCE7] text-[var(--st-success)]"
                      : r.result === "送れなかった"
                        ? "bg-[#FDF2F2] text-[var(--error)]"
                        : "bg-[var(--sv)] text-[var(--on-sv)]"
                  }`}
                >
                  {r.result}
                </span>
              </div>
              {r.why ? <p className="mt-1 text-[12px] text-[var(--on-sv)]">{r.why}</p> : null}
              <a
                className="mt-2 inline-block break-all text-[13px] font-semibold text-[var(--primary)] underline"
                href={r.url}
              >
                このリンクを開いて進む
              </a>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-8 text-[12px] text-[var(--on-sv)]">
        読み込み直すと最新になります。元は <span className="num">.dev-logs/api.log</span> です。
      </p>
    </main>
  );
}
