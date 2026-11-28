#!/usr/bin/env python3
"""build_board.py — 11_tickets を高本さんが見るためのページを 1 枚の HTML にする（D-128.139）。
見せ方は 大分類（基盤と流れ F1〜F12・後のフェーズ）→ その中のチケット → チケットの詳細と進み。
流れごとに、まだチケットに切っていない操作（05_flow/flows.json の行為）も出す。
tickets.json を埋め込むだけなので、チケットを直したら build_index.py → このスクリプト → 公開し直す、で追いつく。
使い方: python3 scripts/tickets/build_board.py <出力の .html>
"""
import datetime, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
J = lambda p: json.load(open(os.path.join(ROOT, p), encoding="utf-8"))
T = J("11_tickets/tickets.json")["tickets"]
FLOWS = J("05_flow/flows.json")

# 行為の名前（flow.json のどこかに id と act を持つ形で入っている）
ACT = {}
def walk(o):
    if isinstance(o, dict):
        i = o.get("id")
        if isinstance(i, str) and re.fullmatch(r"A\d+", i):
            ACT.setdefault(i, o.get("act") or o.get("name") or "")
        for v in o.values():
            walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)
walk(J("05_flow/flow.json"))


def checks(text: str):
    done = len(re.findall(r"^\s*- \[x\]", text or "", flags=re.M))
    todo = len(re.findall(r"^\s*- \[ \]", text or "", flags=re.M))
    return done, done + todo


def cats(text: str):
    m = re.search(r"^分類:\s*(.+)$", text or "", flags=re.M)
    return [c.strip() for c in m.group(1).split(",")] if m else []


by = {t["id"]: t for t in T}
kids = {}
for t in T:
    if t.get("parent"):
        kids.setdefault(t["parent"], []).append(t["id"])
num = lambda i: int(i.split("-")[1])


def row(t):
    s = t.get("sections", {})
    d, n = checks(s.get("完了の条件", ""))
    return {"id": t["id"], "title": t["title"], "kind": t.get("kind", "タスク"), "stage": t.get("stage", ""),
            "parent": t.get("parent") or "", "split": t.get("split", ""), "depends": t.get("depends_on", []),
            "decisions": t.get("decisions", []), "apis": t.get("apis", []), "screens": t.get("screens", []),
            "acts": t.get("acts", []), "cats": cats(s.get("前提と制約", "")), "done": d, "total": n,
            "purpose": s.get("目的", ""), "conditions": s.get("完了の条件", ""), "handoff": s.get("申し送り", ""),
            "risks": s.get("リスクと懸念", ""), "file": t.get("file", "")}


def subtree(i):
    out = []
    for k in sorted(kids.get(i, []), key=num):
        out.append(row(by[k]))
        out += subtree(k)
    return out


groups = []
# 基盤：題名が「基盤」で始まり、親の無いチケット
base = next(t for t in T if not t.get("parent") and t["title"].startswith("基盤"))
groups.append({"key": "base", "label": "基盤", "name": "どの流れにも要る土台", "head": row(base), "tickets": subtree(base["id"]),
               "todo_acts": []})
flow_head = {}
for t in T:
    m = re.match(r"(F\d+) ", t["title"])
    if m and t.get("split") == "これから":
        flow_head[m.group(1)] = t
order = FLOWS.get("order", [])
for f in sorted(FLOWS["flows"], key=lambda f: int(f["id"][1:])):
    h = flow_head.get(f["id"])
    tk = subtree(h["id"]) if h else []
    covered = {a for r in tk for a in r["acts"]}
    groups.append({"key": f["id"], "label": f["id"], "name": f["name"], "head": row(h) if h else None, "tickets": tk,
                   "build_order": order.index(f["id"]) + 1 if f["id"] in order else None,
                   "todo_acts": [{"id": a, "name": ACT.get(a, "")} for a in f["acts"] if a not in covered],
                   "acts_total": len(f["acts"])})
rest = [t for t in T if not t.get("parent") and t["id"] != base["id"] and t not in flow_head.values()]
for t in sorted(rest, key=lambda t: num(t["id"])):
    groups.append({"key": t["id"], "label": "後", "name": t["title"], "head": row(t), "tickets": subtree(t["id"]), "todo_acts": []})

skeleton = [o["op"] for o in FLOWS.get("walking_skeleton", {}).get("ops", [])]
data = json.dumps({"groups": groups, "built": datetime.date.today().isoformat(), "skeleton": skeleton,
                   "order": order}, ensure_ascii=False)

HTML = r"""<title>Kaname を作るチケット</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* Kaname の画面と同じ骨組み（D-071）：灰の地に白い面。大分類 → チケット → 詳細と進み の 3 段を、帯・行・開いた中身で見分ける */
:root{
  --page:#F2F4F7; --card:#FFFFFF; --ink:#131B27; --sub:#4A5563; --mute:#6B7585;
  --line:#DDE2E9; --line-soft:#EDF0F4; --select:#F1F3F6;
  --navy:#22345C; --navy-soft:#EEF3FD; --navy-line:#C7D7F5;
  --teal:#186F69; --teal-soft:#CFEAE7; --amber:#B45309; --amber-soft:#FDF0DC;
  --ok:#166534; --ok-soft:#DCFCE7;
  --f-body:"Noto Sans JP",system-ui,-apple-system,"Hiragino Sans",sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --page:#0F141C; --card:#171E29; --ink:#E6EAF0; --sub:#B3BCC9; --mute:#8D97A6;
  --line:#2A3443; --line-soft:#212A37; --select:#1E2734;
  --navy:#9DB5E8; --navy-soft:#1B2638; --navy-line:#34476B;
  --teal:#6CC4BC; --teal-soft:#14302D; --amber:#E9A35A; --amber-soft:#33240F;
  --ok:#6FD49A; --ok-soft:#12301F; color-scheme:dark}}
:root[data-theme="dark"]{
  --page:#0F141C; --card:#171E29; --ink:#E6EAF0; --sub:#B3BCC9; --mute:#8D97A6;
  --line:#2A3443; --line-soft:#212A37; --select:#1E2734;
  --navy:#9DB5E8; --navy-soft:#1B2638; --navy-line:#34476B;
  --teal:#6CC4BC; --teal-soft:#14302D; --amber:#E9A35A; --amber-soft:#33240F;
  --ok:#6FD49A; --ok-soft:#12301F; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--page);color:var(--ink);font-family:var(--f-body);font-size:14px;line-height:1.7;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:20px 48px}
.wrap{max-width:1080px;margin:0 auto;display:flex;flex-direction:column;gap:16px}
h1{font-size:22px;margin:0;text-wrap:balance}
.muted{color:var(--mute)} .sub{color:var(--sub)} .num{font-variant-numeric:tabular-nums}
.mono{font-family:var(--f-mono);font-size:12px;letter-spacing:.02em}
:focus-visible{outline:2px solid var(--navy);outline-offset:2px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:12px}
.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr))}
.stat{padding:14px 18px;border-right:1px solid var(--line-soft)} .stat:last-child{border-right:0}
.stat b{display:block;font-size:24px;line-height:1.2;font-variant-numeric:tabular-nums}
.stat span{color:var(--sub);font-size:12px}
.skel{padding:12px 18px;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:13px}
.skel .lbl{font-size:12px;color:var(--mute);letter-spacing:.06em;margin-right:4px}
.skel .arrow{color:var(--mute)}
.pill{display:inline-flex;align-items:center;white-space:nowrap;border-radius:9999px;padding:0 9px;font-size:12px;line-height:22px;font-weight:500}
.st-未着手{background:var(--select);color:var(--sub)} .st-作業中{background:var(--navy-soft);color:var(--navy)}
.st-確認中,.st-承認待ち{background:var(--amber-soft);color:var(--amber)} .st-保留{background:var(--select);color:var(--mute)}
.st-完了{background:var(--ok-soft);color:var(--ok)}
.kind{color:var(--teal);background:var(--teal-soft)}
.cat{font-family:var(--f-mono);font-size:11px;color:var(--sub);border:1px solid var(--line);border-radius:5px;padding:0 5px;line-height:18px}
/* 1 段目：大分類 */
.grp{overflow:hidden}
.grp>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:56px minmax(0,1fr) auto;gap:12px;align-items:center;padding:14px 18px}
.grp>summary::-webkit-details-marker{display:none}
.grp>summary:hover{background:var(--select)}
.badge{font-family:var(--f-mono);font-weight:500;font-size:13px;color:var(--navy);background:var(--navy-soft);border:1px solid var(--navy-line);border-radius:8px;text-align:center;line-height:30px}
.g-name{font-weight:700;font-size:15px;min-width:0;overflow-wrap:anywhere}
.g-sub{font-size:12px;color:var(--sub);display:flex;flex-wrap:wrap;gap:4px 12px}
.g-prog{display:flex;flex-direction:column;align-items:flex-end;gap:4px;min-width:140px}
.bar{width:140px;height:6px;border-radius:3px;background:var(--line-soft);overflow:hidden;display:flex}
.bar i{display:block;height:100%}
.bar .b-done{background:var(--ok)} .bar .b-rev{background:var(--amber)} .bar .b-wip{background:var(--navy)}
.g-body{border-top:1px solid var(--line-soft)}
/* 2 段目：チケット */
.tk{border-bottom:1px solid var(--line-soft)} .tk:last-child{border-bottom:0}
.tk>summary{list-style:none;cursor:pointer;display:grid;grid-template-columns:64px minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 18px 9px 30px}
.tk>summary::-webkit-details-marker{display:none}
.tk>summary:hover{background:var(--select)}
.tk.lv2>summary{padding-left:52px}
.tk .id{font-family:var(--f-mono);font-size:12.5px;color:var(--navy);font-weight:500}
.tk .t{min-width:0;overflow-wrap:anywhere}
.tk .meta{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end;align-items:center}
.mini{width:48px;height:5px;border-radius:3px;background:var(--line-soft);overflow:hidden}
.mini i{display:block;height:100%;background:var(--teal)}
/* 3 段目：詳細と進み */
.detail{padding:6px 18px 16px 104px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px 28px;background:var(--page)}
.detail h3{font-size:12px;color:var(--mute);margin:8px 0 2px;letter-spacing:.06em;font-weight:500}
.detail .txt{white-space:pre-wrap;overflow-wrap:anywhere}
.detail .full{grid-column:1/-1}
.ck{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.ck li{display:grid;grid-template-columns:18px 1fr;gap:6px}
.ck .on{color:var(--ok)} .ck .off{color:var(--mute)}
.chips{display:flex;flex-wrap:wrap;gap:4px}
.chips code{font-family:var(--f-mono);font-size:11.5px;background:var(--card);border:1px solid var(--line-soft);border-radius:5px;padding:1px 6px}
.todo-acts{padding:12px 18px 14px 30px;border-top:1px dashed var(--line);display:flex;flex-direction:column;gap:6px}
.todo-acts h3{font-size:12px;color:var(--mute);margin:0;letter-spacing:.06em;font-weight:500}
.todo-acts ul{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:3px}
.todo-acts li{display:grid;grid-template-columns:52px minmax(0,1fr);gap:8px;color:var(--sub)}
.empty{padding:14px 30px;color:var(--mute)}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.filters input{flex:1 1 240px;min-width:0;border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:7px 10px;font:inherit}
.chipbtn{border:1px solid var(--line);background:var(--card);color:var(--sub);border-radius:9999px;padding:4px 12px;font:inherit;font-size:12px;cursor:pointer}
.chipbtn[aria-pressed="true"]{background:var(--navy);border-color:var(--navy);color:var(--card)}
@media (max-width:640px){
  .stats{grid-template-columns:repeat(2,minmax(0,1fr))}.stat:nth-child(2n){border-right:0}.stat:nth-child(-n+2){border-bottom:1px solid var(--line-soft)}
  .grp>summary{grid-template-columns:48px minmax(0,1fr)}.g-prog{grid-column:1/-1;align-items:flex-start}.bar{width:100%}
  .tk>summary,.tk.lv2>summary{grid-template-columns:52px minmax(0,1fr);padding-left:18px}.tk .meta{grid-column:1/-1;justify-content:flex-start}
  .detail{padding-left:18px}.todo-acts{padding-left:18px}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<div class="wrap">
  <header>
    <h1>Kaname を作るチケット</h1>
    <div class="muted">11_tickets から作った一覧（<span id="built" class="num"></span> 時点）。大分類 → チケット → 詳細と進み。番号は K-1 から（古い KN- との対応は 11_tickets/renumber-map.json）</div>
  </header>
  <section class="panel stats" id="stats" aria-label="数"></section>
  <section class="panel skel" id="skel" aria-label="歩く骨格"></section>
  <div class="filters">
    <input id="q" type="search" placeholder="番号・題名・中身で探す" aria-label="探す">
    <span id="stage-chips"></span>
  </div>
  <div id="groups" style="display:flex;flex-direction:column;gap:10px"></div>
</div>
<script>
const D = __DATA__;
const STAGES = ['未着手','作業中','保留','確認中','承認待ち','実行中','完了'];
const esc = s => String(s ?? '').replace(/\*\*/g, '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
document.getElementById('built').textContent = D.built;
const all = D.groups.flatMap(g => g.tickets);
const work = all.filter(t => !t.split);
const cnt = st => work.filter(t => t.stage === st).length;
document.getElementById('stats').innerHTML = [
  ['チケット', all.length], ['完了', cnt('完了')], ['確認中', cnt('確認中') + cnt('承認待ち')],
  ['未着手・作業中', cnt('未着手') + cnt('作業中')]].map(([k, v]) => `<div class="stat"><b>${v}</b><span>${k}</span></div>`).join('');
document.getElementById('skel').innerHTML = '<span class="lbl">いま作る道すじ（歩く骨格）</span>' +
  D.skeleton.map(s => `<span>${esc(s)}</span>`).join('<span class="arrow" aria-hidden="true">→</span>');
let stageSel = null;
document.getElementById('stage-chips').innerHTML = STAGES.filter(s => work.some(t => t.stage === s))
  .map(s => `<button type="button" class="chipbtn" aria-pressed="false" data-st="${s}">${s} ${cnt(s)}</button>`).join(' ');
const checklist = txt => {
  const ls = (txt || '').split('\n').filter(l => /^\s*- \[[ x]\]/.test(l));
  return ls.length ? '<ul class="ck">' + ls.map(l => { const on = /\[x\]/.test(l);
    return `<li><span class="${on ? 'on' : 'off'}">${on ? '✓' : '○'}</span><span>${esc(l.replace(/^\s*- \[[ x]\]\s*/, ''))}</span></li>`; }).join('') + '</ul>' : '';
};
const chips = (arr, pre) => arr && arr.length ? `<div class="chips">${arr.map(x => `<code>${esc((pre||'') + x)}</code>`).join('')}</div>` : '<span class="muted">なし</span>';
function ticket(t, lv) {
  const prog = t.total ? `<span class="mini" title="完了の条件 ${t.done}/${t.total}"><i style="width:${Math.round(100*t.done/t.total)}%"></i></span><span class="mono muted">${t.done}/${t.total}</span>` : '';
  const kind = t.kind !== 'タスク' ? `<span class="pill kind">${esc(t.kind)}</span>` : '';
  return `<details class="tk lv${lv}" data-id="${t.id}" data-st="${t.stage}" data-text="${esc((t.id + ' ' + t.title + ' ' + t.purpose).toLowerCase())}">
  <summary><span class="id">${t.id}</span><span class="t">${esc(t.title)}</span>
    <span class="meta">${t.cats.map(c => `<span class="cat">${esc(c)}</span>`).join('')}${kind}${prog}<span class="pill st-${t.stage}">${esc(t.stage)}</span></span></summary>
  <div class="detail">
    <div class="full"><h3>目的</h3><div class="txt">${esc(t.purpose.trim())}</div></div>
    <div><h3>進み（完了の条件 ${t.done}/${t.total}）</h3>${checklist(t.conditions) || (t.conditions.trim() ? `<div class="txt">${esc(t.conditions.trim())}</div>` : '<span class="muted">なし</span>')}</div>
    <div><h3>先に要るチケット</h3>${chips(t.depends)}<h3>API</h3>${chips(t.apis)}<h3>画面</h3>${chips(t.screens)}</div>
    <div><h3>決定</h3>${chips(t.decisions)}<h3>ファイル</h3><code class="mono">${esc(t.file)}</code></div>
    ${t.handoff.trim() ? `<div class="full"><h3>申し送り</h3><div class="txt">${esc(t.handoff.trim())}</div></div>` : ''}
  </div></details>`;
}
function group(g) {
  const tk = g.tickets.filter(t => !t.split);
  const n = tk.length || 1, w = st => Math.round(100 * tk.filter(t => st.includes(t.stage)).length / n);
  const doneN = tk.filter(t => t.stage === '完了').length;
  const sub = [];
  if (g.build_order) sub.push(`作る順 ${g.build_order} 番目`);
  if (g.acts_total) sub.push(`操作 ${g.acts_total - g.todo_acts.length}/${g.acts_total} をチケットに切った`);
  sub.push(`チケット ${tk.length}`);
  const lv = t => (t.parent && g.head && t.parent !== g.head.id) ? 2 : 1;
  const body = (g.tickets.length ? g.tickets.map(t => ticket(t, lv(t))).join('') : '<div class="empty">まだチケットを切っていない</div>') +
    (g.todo_acts.length ? `<div class="todo-acts"><h3>まだチケットに切っていない操作</h3><ul>${g.todo_acts.map(a => `<li><span class="mono muted">${a.id}</span><span>${esc(a.name)}</span></li>`).join('')}</ul></div>` : '');
  return `<details class="panel grp" data-key="${g.key}">
  <summary><span class="badge">${esc(g.label)}</span>
    <span><div class="g-name">${esc(g.name)}${g.head ? ` <span class="mono muted">${g.head.id}</span>` : ''}</div><div class="g-sub">${sub.map(esc).map(s => `<span>${s}</span>`).join('')}</div></span>
    <span class="g-prog"><span class="mono muted">完了 ${doneN}/${tk.length}</span><span class="bar" aria-hidden="true"><i class="b-done" style="width:${w(['完了'])}%"></i><i class="b-rev" style="width:${w(['確認中','承認待ち'])}%"></i><i class="b-wip" style="width:${w(['作業中','実行中'])}%"></i></span></span>
  </summary><div class="g-body">${body}</div></details>`;
}
const root = document.getElementById('groups');
root.innerHTML = D.groups.map(group).join('');
const skelKeys = ['F1','F3','F4','F5'];
root.querySelectorAll('.grp').forEach(el => { if (skelKeys.includes(el.dataset.key)) el.open = true; });
function apply() {
  const q = document.getElementById('q').value.trim().toLowerCase();
  root.querySelectorAll('.grp').forEach(g => {
    let any = false;
    g.querySelectorAll('.tk').forEach(t => {
      const ok = (!q || t.dataset.text.includes(q)) && (!stageSel || t.dataset.st === stageSel);
      t.hidden = !ok; any = any || ok;
    });
    g.querySelectorAll('.todo-acts,.empty').forEach(x => x.hidden = !!(q || stageSel));
    g.hidden = !!(q || stageSel) && !any;
    if ((q || stageSel) && any) g.open = true;
  });
}
document.getElementById('q').addEventListener('input', apply);
document.getElementById('stage-chips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  stageSel = stageSel === b.dataset.st ? null : b.dataset.st;
  document.querySelectorAll('#stage-chips button').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.st === stageSel)));
  apply();
});
</script>
"""

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit("使い方: python3 scripts/tickets/build_board.py <出力の .html>")
    open(sys.argv[1], "w", encoding="utf-8").write(HTML.replace("__DATA__", data.replace("</", "<\\/")))
    print(f"{sys.argv[1]}: チケット {len(T)} 枚")
