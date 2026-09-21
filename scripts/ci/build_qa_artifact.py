#!/usr/bin/env python3
"""触って確かめる確認表を 1 枚の HTML にする（Artifact で公開する用）。

  python3 scripts/ci/build_qa_artifact.py --out .artifact/確認.html
  → 出した HTML を Artifact で同じ URL に出し直す（https://claude.ai/artifact/CKtmY8sDc61YtxX6vMu6AM）

手順は 07_tasks/handoff/*.md から。答え（OK／NG／気づいたこと）はページには埋めない。
公開したページの db に入るので、こちらが作り直して出し直しても消えない。
プロジェクト名は持たない。
"""
from __future__ import annotations
import argparse, datetime as dt, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_qa_xlsx import parse, tab_name  # 手順の読み方は 1 か所


def collect(a) -> list[dict]:
    S = {s["id"]: s for s in json.load(open(a.screens, encoding="utf-8"))["items"]}
    pos = {sid: i for i, sid in enumerate(S)}
    T = json.load(open(a.tickets, encoding="utf-8"))["tasks"]
    done = [t for t in T if t.get("status") == "done" and t.get("deliverable_layer") in ("ui", "integration")]
    out = []
    for t in sorted(done, key=lambda t: (t["deliverable_layer"] != "ui", bool(not t.get("screen_ids")), pos.get((t.get("screen_ids") or [""])[0], 999))):
        fp = os.path.join(a.handoff, f"{t['id']}.md")
        if not os.path.exists(fp):
            continue
        p = parse(open(fp, encoding="utf-8").read())
        if not p["steps"]:
            continue
        sid = (t.get("screen_ids") or [None])[0]
        out.append({
            "id": t["id"],
            "name": S.get(sid, {}).get("name") or t["title"],
            "url": a.base + (S.get(sid, {}).get("route") or ""),
            "before": p["before"],
            "steps": [{"act": x, "expect": y} for x, y in p["steps"]],
            "later": p["later"],
        })
    return out


HTML = """<title>Kaname 確認表</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap">
<style>
:root{
  --paper:#FBFAF8; --card:#FFFFFF; --ink:#191C22; --sub:#606A7B; --line:#E4E2DC;
  --accent:#2F5FA8; --accent-soft:#EAF0FA; --ok:#2C6E52; --ok-soft:#E4F1EA;
  --ng:#A94438; --ng-soft:#F8E9E6; --idle:#8A8F99;
  --sans:"Zen Kaku Gothic New",system-ui,-apple-system,"Hiragino Kaku Gothic ProN",sans-serif;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --paper:#15171C; --card:#1C1F26; --ink:#E9EAEE; --sub:#9AA3B2; --line:#2B2F38;
  --accent:#7BA6E8; --accent-soft:#1E2733; --ok:#6FC79B; --ok-soft:#18271F;
  --ng:#E08A7E; --ng-soft:#2A1C1A; --idle:#727988;
}}
:root[data-theme="dark"]{
  --paper:#15171C; --card:#1C1F26; --ink:#E9EAEE; --sub:#9AA3B2; --line:#2B2F38;
  --accent:#7BA6E8; --accent-soft:#1E2733; --ok:#6FC79B; --ok-soft:#18271F;
  --ng:#E08A7E; --ng-soft:#2A1C1A; --idle:#727988;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.75;
  font-feature-settings:"palt";-webkit-font-smoothing:antialiased}
.wrap{max-width:1000px;margin:0 auto;padding-block:26px;padding-left:18px;padding-right:18px}
h1{font-size:21px;font-weight:700;letter-spacing:-.01em;margin:0 0 4px}
.lead{color:var(--sub);font-size:13px;margin:0 0 20px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 18px;margin-bottom:20px}
.panel h2{font-size:13px;font-weight:700;margin:0 0 10px;letter-spacing:.04em}
.kv{display:grid;grid-template-columns:auto 1fr;gap:6px 14px;font-size:13px}
.kv dt{color:var(--sub);white-space:nowrap}
.kv dd{margin:0;overflow-wrap:anywhere}
code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12.5px;
  background:var(--accent-soft);color:var(--accent);padding:1px 6px;border-radius:5px}
.tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:10px;margin-bottom:4px;scrollbar-width:thin}
.tab{flex:0 0 auto;border:1px solid var(--line);background:var(--card);color:var(--sub);
  border-radius:999px;padding:7px 14px;font:inherit;font-size:12.5px;cursor:pointer;white-space:nowrap}
.tab[aria-selected="true"]{background:var(--accent);border-color:var(--accent);color:#fff;font-weight:500}
.tab .n{font-variant-numeric:tabular-nums;opacity:.7;margin-left:7px}
.meter{height:4px;background:var(--line);border-radius:999px;overflow:hidden;margin:14px 0 20px}
.meter i{display:block;height:100%;background:var(--ok);width:0;transition:width .3s}
.head{display:flex;flex-wrap:wrap;align-items:baseline;gap:10px;margin-bottom:6px}
.head h2{font-size:17px;font-weight:700;margin:0}
.head a{color:var(--accent);font-size:12.5px;overflow-wrap:anywhere}
.note-before{background:var(--accent-soft);border-radius:10px;padding:12px 14px;margin:12px 0 18px;font-size:13px}
.note-before ol{margin:0;padding-left:20px}
.step{border-top:1px solid var(--line);padding:16px 0;display:grid;grid-template-columns:28px 1fr;gap:0 12px}
.step:last-of-type{border-bottom:1px solid var(--line)}
.num{font-variant-numeric:tabular-nums;color:var(--idle);font-size:12.5px;padding-top:2px}
.act{font-weight:500}
.exp{color:var(--sub);font-size:13px;margin-top:3px}
.row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:10px}
.seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden}
.seg button{border:0;background:transparent;color:var(--sub);font:inherit;font-size:12.5px;
  padding:5px 13px;cursor:pointer;min-height:32px}
.seg button+button{border-left:1px solid var(--line)}
.seg button[aria-pressed="true"]{font-weight:700}
.seg button[data-v="OK"][aria-pressed="true"]{background:var(--ok-soft);color:var(--ok)}
.seg button[data-v="NG"][aria-pressed="true"]{background:var(--ng-soft);color:var(--ng)}
.seg button[data-v="-"][aria-pressed="true"]{background:var(--line);color:var(--ink)}
.memo{flex:1 1 240px;min-width:0;border:1px solid var(--line);background:var(--paper);color:var(--ink);
  border-radius:8px;padding:6px 10px;font:inherit;font-size:13px;min-height:32px}
.memo:focus-visible,.seg button:focus-visible,.tab:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.later{margin-top:22px;border-left:3px solid var(--line);padding:2px 0 2px 14px;color:var(--sub);font-size:12.5px}
.later h3{font-size:12.5px;margin:0 0 6px;color:var(--ink)}
.later ul{margin:0;padding-left:18px}
.save{position:fixed;left:50%;transform:translateX(-50%);bottom:calc(16px + env(safe-area-inset-bottom,0px));
  background:var(--ink);color:var(--paper);border-radius:999px;padding:7px 16px;font-size:12.5px;opacity:0;
  transition:opacity .25s;pointer-events:none}
.save.on{opacity:.92}
.foot{color:var(--sub);font-size:12px;margin-top:26px}
@media (max-width:520px){.step{grid-template-columns:1fr}.num{padding-top:0}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>

<div class="wrap">
  <h1>Kaname 確認表</h1>
  <p class="lead">__DATE__ 時点。1 タブ＝1 チケット。上から触って結果を選んでください。入力はこのページに保存され、作り直しても消えません。</p>

  <section class="panel">
    <h2>はじめに</h2>
    <dl class="kv">
      <dt>立ち上げ</dt><dd><code>bash scripts/dev/up.sh</code>（DB → API → 画面。初回は 2 分ほど）</dd>
      <dt>入口</dt><dd><code>__BASE__/signup</code></dd>
      <dt>メールが届かないとき</dt><dd><code>__BASE__/dev/mail</code> に送ったリンクが並びます。そこから押せば先へ進めます</dd>
      <dt>後片付け</dt><dd><code>bash scripts/dev/clean-qa.sh</code>（自動テストが作った口座だけ消す）</dd>
      <dt>止める</dt><dd><code>bash scripts/dev/up.sh --stop</code>／状態は <code>--status</code></dd>
      <dt>まだ無いもの</dt><dd>自分のPC（Bridge）と自分のAIの返答は未実装です。各タブの下に理由つきで出します</dd>
    </dl>
  </section>

  <div class="tabs" id="tabs" role="tablist"></div>
  <div class="meter"><i id="meter"></i></div>
  <div id="panel"></div>
  <p class="foot" id="foot"></p>
</div>
<div class="save" id="save">保存しました</div>

<script id="spec" type="application/json">__SPEC__</script>
<script>
(() => {
  const SPEC = JSON.parse(document.getElementById("spec").textContent);
  const tabs = document.getElementById("tabs"), panel = document.getElementById("panel");
  const meter = document.getElementById("meter"), foot = document.getElementById("foot"), save = document.getElementById("save");
  let db = null, answers = {}, cur = 0, saveTimer = null;
  const key = (t, i) => t + "__" + String(i).padStart(3, "0");
  const toast = () => { save.classList.add("on"); clearTimeout(saveTimer); saveTimer = setTimeout(() => save.classList.remove("on"), 1400); };

  function counts(t) {
    let done = 0;
    t.steps.forEach((_, i) => { const a = answers[key(t.id, i)]; if (a && a.result && a.result !== "-") done++; });
    return done;
  }
  function renderTabs() {
    tabs.innerHTML = "";
    SPEC.forEach((t, idx) => {
      const b = document.createElement("button");
      b.className = "tab"; b.type = "button"; b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(idx === cur));
      b.innerHTML = "";
      b.append(t.id + " " + t.name);
      const n = document.createElement("span");
      n.className = "n"; n.textContent = counts(t) + "/" + t.steps.length;
      b.append(n);
      b.addEventListener("click", () => { cur = idx; render(); });
      tabs.append(b);
    });
    const all = SPEC.reduce((s, t) => s + t.steps.length, 0);
    const got = SPEC.reduce((s, t) => s + counts(t), 0);
    meter.style.width = all ? Math.round((got / all) * 100) + "%" : "0";
    foot.textContent = "全体 " + got + " / " + all + " 手順" + (db ? "" : "（このページを開いた人としての保存はまだ使えません）");
  }
  function render() {
    const t = SPEC[cur];
    renderTabs();
    panel.innerHTML = "";
    const head = document.createElement("div");
    head.className = "head";
    const h = document.createElement("h2"); h.textContent = t.name;
    const a = document.createElement("a"); a.href = t.url; a.textContent = t.url;
    head.append(h, a); panel.append(head);
    if (t.before.length) {
      const d = document.createElement("div"); d.className = "note-before";
      const ol = document.createElement("ol");
      t.before.forEach(x => { const li = document.createElement("li"); li.textContent = x; ol.append(li); });
      d.append(ol); panel.append(d);
    }
    t.steps.forEach((s, i) => {
      const k = key(t.id, i), cur_ = answers[k] || { result: "-", note: "" };
      const row = document.createElement("div"); row.className = "step";
      const n = document.createElement("div"); n.className = "num"; n.textContent = i + 1;
      const body = document.createElement("div");
      const act = document.createElement("div"); act.className = "act"; act.textContent = s.act;
      const exp = document.createElement("div"); exp.className = "exp"; exp.textContent = "こうなれば OK: " + s.expect;
      const ctl = document.createElement("div"); ctl.className = "row";
      const seg = document.createElement("div"); seg.className = "seg";
      [["-", "未確認"], ["OK", "OK"], ["NG", "NG"]].forEach(([v, label]) => {
        const b = document.createElement("button");
        b.type = "button"; b.dataset.v = v; b.textContent = label;
        b.setAttribute("aria-pressed", String(cur_.result === v));
        b.addEventListener("click", () => { write(k, { result: v }); });
        seg.append(b);
      });
      const memo = document.createElement("input");
      memo.className = "memo"; memo.id = "memo-" + k; memo.placeholder = "気づいたこと";
      memo.value = cur_.note || "";
      let tm = null;
      memo.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => write(k, { note: memo.value }), 600); });
      ctl.append(seg, memo);
      body.append(act, exp, ctl);
      row.append(n, body); panel.append(row);
    });
    if (t.later.length) {
      const d = document.createElement("div"); d.className = "later";
      const h3 = document.createElement("h3"); h3.textContent = "今はまだ押せないもの（触らなくてよい）";
      const ul = document.createElement("ul");
      t.later.forEach(x => { const li = document.createElement("li"); li.textContent = x; ul.append(li); });
      d.append(h3, ul); panel.append(d);
    }
  }
  async function write(k, patch) {
    answers[k] = Object.assign({ result: "-", note: "" }, answers[k], patch, { at: new Date().toISOString() });
    render();
    if (!db) return;
    try { await db.doc("answers/" + k).set(answers[k]); toast(); } catch (e) { /* 読み取りだけの人 */ }
  }
  render();
  (async () => {
    db = await (window.claude?.use?.("db") ?? Promise.resolve(null));
    if (!db) { render(); return; }
    try {
      const rows = await db.collection("answers").get();
      (rows.docs || rows || []).forEach(d => { answers[d.id] = d.data ? d.data() : d; });
    } catch (e) { /* まだ 1 件も無い */ }
    render();
  })();
})();
</script>
"""


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--handoff", default="07_tasks/handoff")
    ap.add_argument("--tickets", default="07_tasks/tickets.json")
    ap.add_argument("--screens", default="07_functional/screens.json")
    ap.add_argument("--base", default="http://127.0.0.1:3124")
    ap.add_argument("--out", default=".artifact/確認.html")
    a = ap.parse_args()
    spec = collect(a)
    html = (HTML.replace("__SPEC__", json.dumps(spec, ensure_ascii=False))
                .replace("__DATE__", dt.date.today().isoformat())
                .replace("__BASE__", a.base))
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    open(a.out, "w", encoding="utf-8").write(html)
    print(f"確認表 → {a.out}（チケット {len(spec)}・手順 {sum(len(t['steps']) for t in spec)}）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
