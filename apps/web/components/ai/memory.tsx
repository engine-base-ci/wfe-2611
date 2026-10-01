"use client";
// 記憶の毎朝のまとめ（D-105.2〜D-105.5）と、上の層へ上げる候補・確認待ち（D-105.6・D-105.9）。
// 見た目はモック（06_mockup/_memdigest.py）と同じ class（chat.css の DIGEST_CSS）。
//   「今日」の一番上：昨日の会話をまとめる（押したときだけ始まる・溜まっている量を出す）→ 覚えた／まとめた（前と後・戻す）／
//   上の層に上げる候補（上げ先を変えて送る）／捨てた（拾い直す）／上の層で変わったこと
//   記憶の画面の「確認待ち」：上がってきた記憶と、メンバー同士の食い違い（並べて片方を選ぶ）
import "./chat.css";
import { AlertTriangle, Brain, Check, Layers, Pencil, Play, Route as RouteIcon, Send, Trash2, Undo2 } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  memoryDelete,
  memoryDigest,
  memoryDigestPick,
  memoryDigestStart,
  memoryDigestUndo,
  memoryEdit,
  memoryReviews,
  proposalDecide,
  proposalSend,
  type DigestStatus,
  type Review,
} from "@/lib/auth/ext";

const KIND: Record<string, string> = { rule: "決まり", preference: "好み・やり方", example: "OK をもらった実例" };
const md = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${d.getMonth() + 1}/${d.getDate()}`;
};
const hhmm = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : `${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
};
async function act(f: () => Promise<unknown>, done: string, fail: string, after: () => void) {
  try {
    await f();
    toast(done);
  } catch (e) {
    toast(`${fail}（${e instanceof Error ? e.message : "理由は分かりません"}）`);
  } finally {
    after();
  }
}

/** 「今日」の一番上（D-105.2）。押さない日は溜まり、溜まっている量を出す。結果はその下に出す */
export function MemoryDigest() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["memory-digest"],
    queryFn: memoryDigest,
    refetchInterval: (x) => (x.state.data?.running ? 3_000 : 60_000),
  });
  const reload = () => void qc.invalidateQueries({ queryKey: ["memory-digest"] });
  const [starting, setStarting] = useState(false);
  const s = q.data;
  if (!s) return null;
  const start = async () => {
    setStarting(true);
    await act(memoryDigestStart, "まとめ始めました（あなたの PC で）", "まとめを始められませんでした", reload);
    setStarting(false);
  };
  return (
    <div className="kc" data-part="memory-digest">
      {s.running ? (
        <div className="dgbar" role="status" aria-busy="true" data-digest="running">
          <Brain />
          <div>
            <b>昨日の会話をまとめています…</b>
            <div className="muted">会話 {s.running.conversations} を読んでいます（あなたの PC で）</div>
          </div>
        </div>
      ) : s.pending ? (
        <div className="dgbar" data-digest="pending">
          <Brain />
          <div>
            <b>昨日の会話をまとめる</b>
            <div className="muted">
              溜まっている分：{s.pending.days} 日分・会話 {s.pending.conversations}（記憶に使わない会話は読みません）
            </div>
          </div>
          <Button icon={<Play />} onClick={() => void start()} disabled={starting} data-digest-start>
            まとめる
          </Button>
        </div>
      ) : null}
      {s.last ? <DigestResultView s={s} reload={reload} /> : null}
      {s.upper.length ? <UpperChanges s={s} /> : null}
    </div>
  );
}

function Item({ title, meta, children }: { title: React.ReactNode; meta: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="it">
      <div className="body">
        {title}
        <span className="muted">{meta}</span>
      </div>
      <div className="acts">{children}</div>
    </div>
  );
}

function Editable({ id, body, reload }: { id: string; body: string; reload: () => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  if (edit !== null)
    return (
      <form
        className="flex gap-1"
        onSubmit={(e) => {
          e.preventDefault();
          if (!edit.trim()) return;
          void act(() => memoryEdit(id, edit.trim()), "直しました", "直せませんでした", () => (setEdit(null), reload()));
        }}
      >
        <input
          className="min-w-0 flex-1 rounded-[var(--r-sm)] border border-[var(--line)] bg-[var(--card)] px-2 py-1 text-[16px] md:text-[14px]"
          value={edit}
          aria-label="覚えることを直す"
          autoFocus
          onChange={(e) => setEdit(e.target.value)}
        />
        <Button size="sm" type="submit">
          決める
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setEdit(null)}>
          やめる
        </Button>
      </form>
    );
  return (
    <>
      <Button size="sm" variant="ghost" icon={<Pencil />} onClick={() => setEdit(body)}>
        直す
      </Button>
      <Button size="sm" variant="ghost" icon={<Trash2 />} onClick={() => void act(() => memoryDelete(id), "消しました", "消せませんでした", reload)}>
        消す
      </Button>
    </>
  );
}

/** 結果（D-105.4）：覚えた／まとめた（前と後）／上の層に上げる候補（上げ先を変えて送る）／捨てた（拾い直す） */
function DigestResultView({ s, reload }: { s: DigestStatus; reload: () => void }) {
  const last = s.last!;
  const r = last.result;
  const [target, setTarget] = useState<Record<string, string>>({});
  const scopeName = (id: string) => s.scopes.find((x) => x.id === id)?.name ?? "上の層";
  const sent = new Set(s.proposals.map((p) => p.proposal_id));
  const group = (icon: React.ReactNode, title: string, n: number, rows: React.ReactNode, cls = "") =>
    n ? (
      <div className={`grp ${cls}`}>
        <b>
          {icon}
          {title}
          <span className="n">{n}</span>
        </b>
        {rows}
      </div>
    ) : null;
  const nothing = !r.remembered.length && !r.merged.length && !r.propose.length && !r.discarded.length;
  return (
    <section className="dg" aria-label="昨日の会話から覚えたこと" data-digest="result">
      <div className="dgh">
        <h2>昨日の会話から覚えたこと</h2>
        <span className="muted">
          {md(last.from_on)}〜{md(last.to_on)} · 会話 {last.conversations} · {hhmm(last.finished_at)} にまとめた
        </span>
      </div>
      {nothing ? <p className="muted">新しく覚えることはありませんでした。</p> : null}
      {group(
        <Check />,
        "覚えた（あなたの記憶）",
        r.remembered.length,
        r.remembered.map((x) => (
          <Item key={x.memory_id} title={<b>{x.body}</b>} meta={`${KIND[x.kind ?? ""] ?? "好み・やり方"}${x.source ? ` · ${x.source === "拾い直した" ? "捨てたものから拾い直した" : `${x.source} から`}` : ""}`}>
            <Editable id={x.memory_id} body={x.body} reload={reload} />
          </Item>
        )),
      )}
      {group(
        <Layers />,
        "まとめた（前と後を残しています）",
        r.merged.length,
        r.merged.map((x) => (
          <div className="it" key={x.memory_id}>
            <div className="body">
              <b>{x.title}</b>
              <div className="ba">
                <div className="b">{x.before.map((b) => b.body).join(" ／ ")}</div>
                <div className="a">{x.body}</div>
              </div>
            </div>
            <div className="acts">
              <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => void act(() => memoryDigestUndo(last.id, x.memory_id), "前に戻しました", "戻せませんでした", reload)}>
                戻す
              </Button>
            </div>
          </div>
        )),
      )}
      {group(
        <RouteIcon />,
        "上の層に上げる候補（送るまで上がりません）",
        r.propose.length,
        r.propose.map((x) => {
          const already = sent.has(x.proposal_id);
          const to = target[x.proposal_id] ?? x.target_scope_id;
          return (
            <Item
              key={x.proposal_id}
              title={<b>{x.body}</b>}
              meta={
                <>
                  上げ先{" "}
                  <label className="to">
                    <Layers />
                    <select
                      aria-label="上げ先の層"
                      value={to}
                      disabled={already}
                      onChange={(e) => setTarget((t) => ({ ...t, [x.proposal_id]: e.target.value }))}
                      style={{ background: "transparent", font: "inherit" }}
                    >
                      {s.scopes.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {x.why ? ` · ${x.why}` : ""}
                  {already ? " · 送りました" : ""}
                </>
              }
            >
              {already ? null : (
                <Button
                  size="sm"
                  icon={<Send />}
                  onClick={() => void act(() => proposalSend(x.proposal_id, to), `「${scopeName(to)}」の確認者に送りました`, "送れませんでした", reload)}
                  data-propose-send
                >
                  送る
                </Button>
              )}
            </Item>
          );
        }),
      )}
      {group(
        <Trash2 />,
        "捨てた（今回だけの話）",
        r.discarded.length,
        r.discarded.map((x, i) => (
          <Item key={`${i}-${x.text}`} title={<span>{x.text}</span>} meta={x.why}>
            <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => void act(() => memoryDigestPick(last.id, i), "記憶に入れました", "拾い直せませんでした", reload)}>
              拾い直す
            </Button>
          </Item>
        )),
      )}
      {s.proposals.length ? (
        <div className="grp">
          <b>
            <Send />
            送った候補
            <span className="n">{s.proposals.length}</span>
          </b>
          {s.proposals.map((p) => (
            <Item
              key={p.proposal_id}
              title={<b>{p.title}</b>}
              meta={`${p.target_scope} · ${p.state === "sent" ? `確認待ち（${p.reviewer ?? "確認者"}）` : p.state === "accepted" ? "OK になりました（上の層で効いています）" : "差し戻されました（あなたの記憶として効いています）"}${p.conflict ? " · 食い違いあり" : ""}`}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}

/** 上の層で変わったこと（D-105.7）。自分の記憶とぶつかるときは、決まりは上の層ほど強い（D-105.8） */
function UpperChanges({ s }: { s: DigestStatus }) {
  return (
    <section className="dg" aria-label="上の層で変わったこと" data-digest="upper" style={{ marginTop: 14 }}>
      <div className="grp cf">
        <b>
          <AlertTriangle />
          上の層で変わったこと
          <span className="n">{s.upper.length}</span>
        </b>
        {s.upper.map((u) => (
          <Item
            key={u.id}
            title={<b>{`${u.scope}：${u.body}`}</b>}
            meta={`${u.title} · ${KIND[u.kind] ?? ""}${u.kind === "rule" ? " · 決まりは上の層ほど強く、あなたの記憶より優先されます" : ""}`}
          />
        ))}
      </div>
    </section>
  );
}

/** 記憶の画面の「確認待ち」（D-105.6・D-105.9）。OK までは送った人の記憶として効く */
export function MemoryReviews() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["memory-reviews"], queryFn: memoryReviews, refetchInterval: 30_000 });
  const reload = () => {
    void qc.invalidateQueries({ queryKey: ["memory-reviews"] });
    void qc.invalidateQueries({ queryKey: ["memory-digest"] });
  };
  const list = q.data ?? [];
  const single = list.filter((r) => !r.conflict_group_id);
  const groups = [...new Set(list.filter((r) => r.conflict_group_id).map((r) => r.conflict_group_id!))].map((g) => list.filter((r) => r.conflict_group_id === g));
  if (!list.length)
    return (
      <div className="kc" data-part="memory-reviews">
        <p className="muted">確認待ちはありません。</p>
      </div>
    );
  return (
    <div className="kc" data-part="memory-reviews">
      <section className="dg" aria-label="確認待ち">
        <div className="dgh">
          <h2>確認待ち</h2>
          <span className="muted">OK までは送った人の記憶として効いています</span>
        </div>
        {single.length ? (
          <div className="grp">
            <b>
              <RouteIcon />
              上がってきた記憶
              <span className="n">{single.length}</span>
            </b>
            {single.map((r) => (
              <ReviewRow key={r.proposal_id} r={r} reload={reload} />
            ))}
          </div>
        ) : null}
        {groups.map((g) => (
          <div className="grp cf" key={g[0]!.conflict_group_id!}>
            <b>
              <AlertTriangle />
              食い違い（同じことへの違う提案）
              <span className="n">{g.length}</span>
            </b>
            <div className="it">
              <div className="body">
                <b>{g[0]!.title}</b>
                <div className="two">
                  {g.map((r) => (
                    <div key={r.proposal_id}>
                      <b>{r.body}</b>
                      <span className="muted">
                        {r.proposer} から{r.evidence?.source ? ` · ${r.evidence.source}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
                <span className="muted">決まるまでは、それぞれの記憶として効きます。決めたら 2 人に知らせます</span>
              </div>
              <div className="acts" style={{ flexDirection: "column" }}>
                {g.map((r) => (
                  <Button
                    key={r.proposal_id}
                    size="sm"
                    variant="outline"
                    onClick={() => void act(() => proposalDecide(r.proposal_id, true), `「${r.body}」にしました`, "決められませんでした", reload)}
                  >
                    {r.body}にする
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function ReviewRow({ r, reload }: { r: Review; reload: () => void }) {
  return (
    <Item
      title={<b>{r.body}</b>}
      meta={`${r.proposer} から · 上げ先 ${r.target_scope}${r.evidence?.why ? ` · ${r.evidence.why}` : ""} · OK までは${r.proposer}の記憶として効いています`}
    >
      <Button size="sm" icon={<Check />} onClick={() => void act(() => proposalDecide(r.proposal_id, true), `${r.target_scope}に効くようにしました`, "OK にできませんでした", reload)} data-review-ok>
        OK（{r.target_scope}に効く）
      </Button>
      <Button size="sm" variant="ghost" icon={<Undo2 />} onClick={() => void act(() => proposalDecide(r.proposal_id, false), "差し戻しました", "差し戻せませんでした", reload)}>
        差し戻す
      </Button>
    </Item>
  );
}
