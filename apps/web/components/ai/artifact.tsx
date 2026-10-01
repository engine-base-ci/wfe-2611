"use client";
// 成果物を会話の横で開く（D-106）。見た目は 06_mockup/_chat.py の artifact_panel（chat.css の .artifact／.artdock）。
//   文書（md）と表（csv）：見る／直す。保存すると新しい版（上書きしない・D-106.3）
//   版の一覧：押すとその版を開く。「この版に戻す」は前の版の中身で新しい版を作る（どの版も消さない・D-106.4）
//   画像・PDF・動画・音声：見るだけ（D-106.5）。落とすのは今の版を自由に（D-106.7）
import { Check, ChevronDown, Download, Eye, FileText, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AuthExtError, artifactDownload, artifactGet, artifactRename, artifactRevert, artifactSave, type Artifact } from "@/lib/auth/ext";
import { Markdown } from "./markdown";

const IMAGE = /^(png|jpe?g|gif|webp|svg)$/i;
const VIDEO = /^(mp4|webm|mov)$/i;
const AUDIO = /^(mp3|m4a|wav|ogg)$/i;
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const why = (e: unknown, fallback: string) => (e instanceof AuthExtError || e instanceof Error ? e.message : fallback);

/** CSV を行と列に分ける（"" で囲んだ値・改行を含む値も） */
export function parseCsv(src: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let q = false;
  const s = src.replace(/^\uFEFF/, "");
  const endRow = () => {
    row.push(cell);
    rows.push(row);
    row = [];
    cell = "";
  };
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    if (q) {
      if (ch === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      endRow();
    } else cell += ch;
  }
  if (cell || row.length) endRow();
  return rows.filter((r) => r.some((c) => c.trim()));
}

function CsvTable({ text }: { text: string }) {
  const [head = [], ...body] = useMemo(() => parseCsv(text), [text]);
  const [sort, setSort] = useState<{ col: number; asc: boolean } | null>(null);
  const rows = useMemo(() => {
    if (!sort) return body;
    const n = (v: string) => (/^-?[\d,.]+$/.test(v.trim()) ? Number(v.replace(/,/g, "")) : null);
    return [...body].sort((a, b) => {
      const x = a[sort.col] ?? "";
      const y = b[sort.col] ?? "";
      const nx = n(x);
      const ny = n(y);
      const c = nx !== null && ny !== null ? nx - ny : x.localeCompare(y, "ja");
      return sort.asc ? c : -c;
    });
  }, [body, sort]);
  return (
    <div className="mtable" data-art-table>
      <div className="tscroll">
        <table>
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={`${h}-${i}`} aria-sort={sort?.col === i ? (sort.asc ? "ascending" : "descending") : "none"}>
                  <button type="button" onClick={() => setSort((s) => (s?.col === i ? { col: i, asc: !s.asc } : { col: i, asc: true }))}>
                    {h}
                    {sort?.col === i ? <ChevronDown style={sort.asc ? undefined : { transform: "rotate(180deg)" }} /> : null}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {head.map((_, j) => (
                  <td key={j}>{r[j] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Viewer({ a }: { a: Artifact }) {
  if (a.editable) return a.format === "csv" ? <CsvTable text={a.text ?? ""} /> : <Markdown text={a.text ?? ""} />;
  if (!a.url) return <p className="muted">中身を開けませんでした。落としてから開いてください</p>;
  if (IMAGE.test(a.format)) return <img className="amedia" src={a.url} alt={a.title} />;
  if (VIDEO.test(a.format)) return <video className="amedia" src={a.url} controls />;
  if (AUDIO.test(a.format)) return <audio src={a.url} controls style={{ width: "100%" }} />;
  if (/^pdf$/i.test(a.format)) return <iframe className="apdf" src={a.url} title={a.title} />;
  return <p className="muted">この種類はここでは見られません。落として開いてください</p>;
}

export function ArtifactPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [viewing, setViewing] = useState<number | null>(null);
  const q = useQuery({ queryKey: ["agent-artifact", id, viewing], queryFn: () => artifactGet(id, viewing) });
  const a = q.data;
  const old = !!a && a.viewing !== a.current_version;
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [naming, setNaming] = useState<string | null>(null);
  useEffect(() => {
    setMode("view");
    setDraft(null);
    setViewing(null);
  }, [id]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !busy && draft === null && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, draft, onClose]);

  const done = (next: Artifact, msg: string) => {
    qc.setQueryData(["agent-artifact", id, null], next);
    void qc.invalidateQueries({ queryKey: ["agent-artifacts"] });
    setViewing(null);
    setDraft(null);
    setMode("view");
    toast(msg);
  };
  const run = async (f: () => Promise<Artifact>, msg: (a: Artifact) => string, fail: string) => {
    setBusy(true);
    try {
      const next = await f();
      done(next, msg(next));
    } catch (e) {
      // 保存できなかったときは直した中身を残す（E-ART-002）
      toast(why(e, fail));
    } finally {
      setBusy(false);
    }
  };
  const save = () => void run(() => artifactSave(id, draft ?? a?.text ?? ""), (n) => `版 ${n.current_version} として残しました`, "保存できませんでした");
  const revert = (v: number) => void run(() => artifactRevert(id, v), (n) => `版 ${v} の中身で版 ${n.current_version} を作りました`, "戻せませんでした");
  const rename = async () => {
    const t = naming?.trim();
    setNaming(null);
    if (!t || !a || t === a.title) return;
    try {
      await artifactRename(id, t);
      void qc.invalidateQueries({ queryKey: ["agent-artifact", id] });
      void qc.invalidateQueries({ queryKey: ["agent-artifacts"] });
    } catch (e) {
      toast(why(e, "名前を直せませんでした"));
    }
  };
  const download = async () => {
    try {
      const f = await artifactDownload(id, old ? a?.viewing : null);
      const url = URL.createObjectURL(f.blob);
      const el = document.createElement("a");
      el.href = url;
      el.download = f.name;
      el.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast(why(e, "落とせませんでした"));
    }
  };

  const editing = mode === "edit" && !!a?.editable && !old;
  return (
    <aside className="artifact" aria-label="横で開いた成果物" data-artifact={id}>
      <div className="ah">
        <FileText />
        {naming !== null ? (
          <input
            aria-label="成果物の名前"
            value={naming}
            maxLength={80}
            autoFocus
            onFocus={(e) => e.currentTarget.select()}
            onChange={(e) => setNaming(e.target.value)}
            onBlur={() => void rename()}
            onKeyDown={(e) => (e.key === "Enter" ? void rename() : e.key === "Escape" ? setNaming(null) : undefined)}
          />
        ) : (
          <button type="button" className="atitle" title="名前を直す" onClick={() => a && setNaming(a.title)} data-art-title>
            {a?.title ?? "成果物"}
          </button>
        )}
        {a ? <span className="v">版 {a.current_version}</span> : null}
        <button type="button" className="aclose" title="閉じる" aria-label="成果物を閉じる" onClick={onClose} data-art-close>
          <X />
        </button>
      </div>
      {q.isPending ? (
        <div className="ab muted">読んでいます</div>
      ) : q.isError || !a ? (
        <div className="ab">
          <p>{why(q.error, "この成果物を開けませんでした")}</p>
        </div>
      ) : (
        <>
          {old ? (
            <div className="aold" role="status" data-art-old>
              版 {a.viewing} を見ています（いまは版 {a.current_version}）
              <Button size="sm" onClick={() => revert(a.viewing)} disabled={busy} data-art-revert-here>
                この版に戻す
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setViewing(null)}>
                いまの版を見る
              </Button>
            </div>
          ) : null}
          {a.editable && !old ? (
            <div className="atabs" role="tablist" aria-label="見る・直す">
              <button type="button" role="tab" aria-selected={!editing} className={!editing ? "on" : undefined} onClick={() => setMode("view")}>
                見る
              </button>
              <button type="button" role="tab" aria-selected={editing} className={editing ? "on" : undefined} onClick={() => setMode("edit")} data-art-edit>
                直す
              </button>
            </div>
          ) : null}
          {editing ? (
            <textarea className="aedit" aria-label="成果物の中身" value={draft ?? a.text ?? ""} onChange={(e) => setDraft(e.target.value)} data-art-text />
          ) : (
            <div className="ab">
              {!a.editable ? (
                <div className="aview">
                  <Eye />
                  この種類は見るだけです（直せません）
                </div>
              ) : null}
              <Viewer a={a} />
            </div>
          )}
          <details className="avers" open>
            <summary>版の一覧（{a.versions.length}）</summary>
            <ol>
              {a.versions.map((v) => (
                <li key={v.version} className={v.version === a.current_version ? "on" : undefined} data-art-version={v.version}>
                  <button type="button" className="vopen" title="この版を開く" onClick={() => setViewing(v.version === a.current_version ? null : v.version)}>
                    版 {v.version}
                  </button>
                  <span className="muted">
                    {hhmm(v.at)} · {v.by || "自分"}
                    {v.reverted_from ? ` · 版 ${v.reverted_from} に戻した` : ""}
                  </span>
                  {v.version === a.current_version ? (
                    <span className="now">いまの版</span>
                  ) : a.editable ? (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => revert(v.version)} data-art-revert={v.version}>
                      この版に戻す
                    </Button>
                  ) : null}
                </li>
              ))}
            </ol>
          </details>
          <div className="af">
            {editing ? (
              <Button size="sm" icon={<Check />} onClick={save} disabled={busy || draft === null || draft === a.text} data-art-save>
                保存（新しい版にする）
              </Button>
            ) : null}
            <Button size="sm" variant="outline" icon={<Download />} onClick={() => void download()} data-art-download>
              {old ? `版 ${a.viewing} を落とす` : "いまの版を落とす"}
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}
