#!/usr/bin/env python3
"""build_board.py — 11_tickets を高本さんが見るためのページ（一覧・スケジュール）を 1 枚の HTML にする。
tickets.json を埋め込むだけなので、チケットを直したら build_index.py → このスクリプト → 公開し直す、で追いつく。
使い方: python3 scripts/tickets/build_board.py <出力の .html>
"""
import datetime, json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
T = json.load(open(os.path.join(ROOT, "11_tickets/tickets.json"), encoding="utf-8"))["tickets"]

def checks(text: str):
    done = len(re.findall(r"^- \[x\]", text or "", flags=re.M))
    todo = len(re.findall(r"^- \[ \]", text or "", flags=re.M))
    return done, done + todo

rows = []
for t in T:
    s = t.get("sections", {})
    d, n = checks(s.get("完了の条件", ""))
    rows.append({
        "id": t["id"], "title": t["title"], "kind": t.get("kind", "タスク"), "stage": t.get("stage", ""),
        "parent": t.get("parent") or "", "milestone": t.get("milestone", ""), "area": t.get("area", ""),
        "assignee": t.get("assignee", ""), "due": t.get("due", ""), "split": t.get("split", ""),
        "decisions": t.get("decisions", []), "depends": t.get("depends_on", []),
        "screens": t.get("screens", []), "choke": t.get("choke_points", []),
        "done": d, "total": n,
        "purpose": s.get("目的", ""), "conditions": s.get("完了の条件", ""), "todo": s.get("実施事項", ""),
        "handoff": s.get("申し送り", ""), "risks": s.get("リスクと懸念", ""), "file": t.get("file", ""),
    })
data = json.dumps({"tickets": rows, "built": datetime.date.today().isoformat()}, ensure_ascii=False)

HTML = r"""<title>Kaname を作るチケット</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=IBM+Plex+Mono:wght@500&display=swap">
<style>
/* 紙の台帳ではなく、Kaname の画面と同じ骨組み：灰の地に白い面、罫線 1 本で段を区切る（D-071）。節目の順に左から右へ */
:root{
  --page:#F2F4F7; --card:#FFFFFF; --ink:#131B27; --sub:#4A5563; --mute:#6B7585;
  --line:#DDE2E9; --line-soft:#EDF0F4; --select:#F1F3F6;
  --navy:#22345C; --navy-soft:#EEF3FD; --navy-line:#C7D7F5;
  --teal:#186F69; --teal-soft:#CFEAE7; --amber:#B45309; --amber-soft:#FDF0DC;
  --ok:#166534; --ok-soft:#DCFCE7; --ai:#6D4AA6; --ai-soft:#EDEAF6;
  --f-body:"Noto Sans JP",system-ui,-apple-system,"Hiragino Sans",sans-serif;
  --f-mono:"IBM Plex Mono",ui-monospace,Menlo,monospace;
}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){
  --page:#0F141C; --card:#171E29; --ink:#E6EAF0; --sub:#B3BCC9; --mute:#8D97A6;
  --line:#2A3443; --line-soft:#212A37; --select:#1E2734;
  --navy:#9DB5E8; --navy-soft:#1B2638; --navy-line:#34476B;
  --teal:#6CC4BC; --teal-soft:#14302D; --amber:#E9A35A; --amber-soft:#33240F;
  --ok:#6FD49A; --ok-soft:#12301F; --ai:#B9A2E6; --ai-soft:#251E36; color-scheme:dark}}
:root[data-theme="dark"]{
  --page:#0F141C; --card:#171E29; --ink:#E6EAF0; --sub:#B3BCC9; --mute:#8D97A6;
  --line:#2A3443; --line-soft:#212A37; --select:#1E2734;
  --navy:#9DB5E8; --navy-soft:#1B2638; --navy-line:#34476B;
  --teal:#6CC4BC; --teal-soft:#14302D; --amber:#E9A35A; --amber-soft:#33240F;
  --ok:#6FD49A; --ok-soft:#12301F; --ai:#B9A2E6; --ai-soft:#251E36; color-scheme:dark}
*{box-sizing:border-box}
body{background:var(--page);color:var(--ink);font-family:var(--f-body);font-size:14px;line-height:1.7;
  padding-left:max(16px,env(safe-area-inset-left,0px));padding-right:max(16px,env(safe-area-inset-right,0px));padding-block:20px 48px}
.wrap{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:18px}
h1{font-size:22px;margin:0;text-wrap:balance;letter-spacing:.01em}
h2{font-size:16px;margin:0}
.muted{color:var(--mute)} .sub{color:var(--sub)}
.num{font-variant-numeric:tabular-nums}
.mono{font-family:var(--f-mono);font-size:12px;letter-spacing:.02em}
header.top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:12px}
.tabs{display:flex;gap:4px;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:4px}
.tabs a{padding:6px 14px;border-radius:7px;color:var(--sub);text-decoration:none;font-weight:500}
.tabs a[aria-current="page"]{background:var(--navy);color:var(--card)}
.tabs a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible{outline:2px solid var(--navy);outline-offset:2px}
.panel{background:var(--card);border:1px solid var(--line);border-radius:12px}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}
.stat{padding:14px 18px;border-right:1px solid var(--line-soft)}
.stat:last-child{border-right:0}
.stat b{display:block;font-size:24px;font-variant-numeric:tabular-nums;line-height:1.2}
.stat span{color:var(--sub);font-size:12px}
.now{padding:14px 18px;display:flex;flex-wrap:wrap;gap:10px 22px;align-items:baseline}
.now .lbl{font-size:12px;color:var(--mute);letter-spacing:.06em}
.now .items{display:flex;flex-wrap:wrap;gap:6px 14px}
.jump{color:var(--navy);text-decoration:none;border-bottom:1px solid var(--navy-line)}
.jump:hover{border-bottom-color:var(--navy)}
.jump .mono{color:var(--mute);margin-right:4px}
.pill{display:inline-flex;align-items:center;gap:4px;white-space:nowrap;border-radius:9999px;padding:0 9px;font-size:12px;line-height:22px;font-weight:500}
.st-未着手{background:var(--select);color:var(--sub)}
.st-作業中{background:var(--navy-soft);color:var(--navy)}
.st-確認中{background:var(--amber-soft);color:var(--amber)}
.st-承認待ち{background:var(--amber-soft);color:var(--amber)}
.st-保留{background:var(--select);color:var(--mute)}
.st-完了{background:var(--ok-soft);color:var(--ok)}
.uncut{background:transparent;color:var(--mute);border:1px dashed var(--line);line-height:20px}
.area{color:var(--teal);background:var(--teal-soft)}
.filters{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--line-soft)}
.filters input{flex:1 1 220px;min-width:0;border:1px solid var(--line);background:var(--page);color:var(--ink);border-radius:8px;padding:7px 10px;font:inherit}
.chip{border:1px solid var(--line);background:var(--card);color:var(--sub);border-radius:9999px;padding:3px 11px;font:inherit;font-size:12px;cursor:pointer}
.chip[aria-pressed="true"]{background:var(--navy);border-color:var(--navy);color:var(--card)}
.tree{list-style:none;margin:0;padding:0}
.ms{border-bottom:1px solid var(--line-soft)}
.ms:last-child{border-bottom:0}
.row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:10px;align-items:center;padding:9px 14px;cursor:pointer}
.row:hover{background:var(--select)}
.row .id{font-family:var(--f-mono);font-size:12px;color:var(--mute);width:48px}
.row .t{min-width:0;overflow-wrap:anywhere}
.row .meta{display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end}
.lv0>.row{background:var(--navy-soft)}
.lv0>.row .t{font-weight:700;color:var(--navy)}
.lv1>.row{padding-left:34px}
.lv2>.row{padding-left:60px}
.bar{width:64px;height:6px;border-radius:3px;background:var(--line-soft);overflow:hidden;align-self:center}
.bar i{display:block;height:100%;background:var(--teal)}
.detail{padding:4px 18px 16px 74px;display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px 28px;border-top:1px dashed var(--line-soft)}
.lv1 .detail{padding-left:74px}
.detail h3{font-size:12px;color:var(--mute);margin:8px 0 2px;letter-spacing:.06em;font-weight:500}
.detail .txt{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--ink)}
.detail .full{grid-column:1/-1}
.ck{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.ck li{display:grid;grid-template-columns:18px 1fr;gap:6px}
.ck .on{color:var(--ok)} .ck .off{color:var(--line)}
.empty{padding:24px;color:var(--mute);text-align:center}
/* スケジュール：節目の順に左から右。期限は決めていないので、順番と進み具合だけを持つ */
.lanes{overflow-x:auto}
.lanes-in{display:grid;grid-template-columns:repeat(6,minmax(250px,1fr));gap:0;min-width:1500px}
.lane{border-right:1px solid var(--line-soft);padding:14px;display:flex;flex-direction:column;gap:10px}
.lane:last-child{border-right:0}
.lane-h{display:flex;flex-direction:column;gap:4px;padding-bottom:8px;border-bottom:2px solid var(--line)}
.lane-h .step{font-family:var(--f-mono);font-size:11px;color:var(--mute);letter-spacing:.08em}
.lane-h .due{font-size:12px;color:var(--amber)}
.lane.cur .lane-h{border-bottom-color:var(--navy)}
.grp{border:1px solid var(--line);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px;background:var(--card)}
.grp.uncut-g{border-style:dashed}
.grp .gt{font-weight:500;line-height:1.5}
.grp .gm{display:flex;flex-wrap:wrap;gap:6px;align-items:center;font-size:12px;color:var(--sub)}
.kids{list-style:none;margin:2px 0 0;padding:0;display:flex;flex-direction:column;gap:3px;font-size:12.5px}
.kids li{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:6px;align-items:start;padding-top:3px;border-top:1px solid var(--line-soft)}
.flow{padding:14px 18px;display:flex;flex-direction:column;gap:6px}
.flow ol{margin:0;padding-left:1.4em;display:flex;flex-direction:column;gap:4px}
.note{padding:12px 18px;border-top:1px solid var(--line-soft);font-size:13px;color:var(--sub)}
@media (max-width:640px){.detail,.lv1 .detail{padding-left:18px}.lv1>.row{padding-left:22px}.lv2>.row{padding-left:30px}.row{grid-template-columns:auto minmax(0,1fr)}.row .meta{grid-column:1/-1;justify-content:flex-start}}
@media (prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
<div class="wrap">
  <header class="top">
    <div>
      <h1>Kaname を作るチケット</h1>
      <div class="muted">11_tickets から作った一覧（<span id="built" class="num"></span> 時点）。親子は 3 段：節目 → まとまり → 1 作業</div>
    </div>
    <nav class="tabs" aria-label="見え方">
      <a href="#list" id="tab-list">一覧</a>
      <a href="#schedule" id="tab-schedule">スケジュール</a>
    </nav>
  </header>
  <section class="panel stats" id="stats" aria-label="数"></section>
  <section class="panel now" id="now" aria-label="いま"></section>
  <section class="panel" id="view-list">
    <div class="filters">
      <input id="q" type="search" placeholder="番号・題名・中身で探す" aria-label="探す">
      <span id="stage-chips"></span>
    </div>
    <ul class="tree" id="tree"></ul>
  </section>
  <section id="view-schedule" hidden>
    <div class="panel lanes"><div class="lanes-in" id="lanes"></div></div>
    <div class="panel flow" style="margin-top:18px">
      <h2>進め方</h2>
      <ol>
        <li>まとまり（点線の枠）を、1 作業のチケットに切る。切る前に中身を高本さんと 1 枚ずつ決める</li>
        <li>決めた 1 作業を作り、確認中にする。CI が緑で、高本さんが見て完了</li>
        <li>節目の子が全部完了したら、その節目が終わる</li>
      </ol>
    </div>
    <div class="panel note" style="margin-top:18px">目標の日：基盤 11/13・節目① 11/20。節目②・③・本番の 11/30 は仮で、節目①のあとに速さを見て確かめます（D-128.118）。</div>
  </section>
</div>
<script id="data" type="application/json">__DATA__</script>
<script>
const D = JSON.parse(document.getElementById('data').textContent);
const T = D.tickets, by = Object.fromEntries(T.map(t => [t.id, t]));
const kids = {}; T.forEach(t => { (kids[t.parent || ''] ||= []).push(t.id); });
const isLeaf = t => t.split !== 'これから' && !(kids[t.id] || []).length;
const roots = kids[''] || [];
const STAGES = ['未着手','作業中','保留','確認中','承認待ち','実行中','完了'];
document.getElementById('built').textContent = D.built;
const left = d => { if (!d) return '未定'; const n = Math.round((new Date(d) - new Date(D.built)) / 864e5); const md = d.slice(5).replace('-', '/'); return n >= 0 ? `${md}（あと ${n} 日）` : `${md}（${-n} 日過ぎ）`; };
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const leaves = T.filter(isLeaf), uncut = T.filter(t => t.split === 'これから');
const desc = id => (kids[id] || []).flatMap(k => [by[k], ...desc(k)]);
const roll = id => { const ls = desc(id).filter(isLeaf); return { done: ls.filter(t => t.stage === '完了').length, n: ls.length, uncut: desc(id).filter(t => t.split === 'これから').length }; };

// 数
const stat = (v, l) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`;
document.getElementById('stats').innerHTML = [
  stat(T.length, 'チケット 全部'),
  stat(leaves.length, '1 作業に切ったもの'),
  stat(uncut.length, 'まだ切っていないまとまり'),
  stat(T.filter(t => t.stage === '確認中').length, '確認中（高本さんが見る）'),
  stat(T.filter(t => t.stage === '完了').length, '完了'),
].join('');
const checking = T.filter(t => t.stage === '確認中' || t.stage === '作業中');
const next = leaves.filter(t => t.stage === '未着手' && t.depends.every(d => by[d] && (by[d].stage === '完了' || by[d].stage === '確認中')));
document.getElementById('now').innerHTML =
  `<span class="lbl">いま見てほしい</span><span class="items">` + (checking.map(t => `<a href="#list" data-open="${t.id}" class="jump"><span class="mono">${t.id}</span>${esc(t.title)}</a>`).join('') || '<span class="muted">無し</span>') + `</span>` +
  `<span class="lbl">次に決める</span><span class="items">` + (next.slice(0, 3).map(t => `<a href="#list" data-open="${t.id}" class="jump"><span class="mono">${t.id}</span>${esc(t.title)}</a>`).join('') || '<span class="muted">無し</span>') + `</span>`;

// 一覧
let q = '', stageOn = new Set();
const chips = document.getElementById('stage-chips');
chips.innerHTML = STAGES.filter(s => T.some(t => t.stage === s)).map(s => `<button class="chip" type="button" aria-pressed="false" data-st="${s}">${s} ${T.filter(t => t.stage === s).length}</button>`).join(' ') +
  ` <button class="chip" type="button" aria-pressed="false" data-st="__uncut">まだ切っていない ${uncut.length}</button>`;
chips.addEventListener('click', e => { const b = e.target.closest('[data-st]'); if (!b) return; const s = b.dataset.st; stageOn.has(s) ? stageOn.delete(s) : stageOn.add(s); b.setAttribute('aria-pressed', stageOn.has(s)); draw(); });
document.getElementById('q').addEventListener('input', e => { q = e.target.value.trim(); draw(); });
const hit = t => {
  const okS = !stageOn.size || stageOn.has(t.stage) || (stageOn.has('__uncut') && t.split === 'これから');
  const hay = [t.id, t.title, t.purpose, t.conditions, t.todo, t.area, t.screens.join(' ')].join(' ');
  return okS && (!q || hay.includes(q));
};
const visible = id => hit(by[id]) || desc(id).some(hit);
const ckList = txt => { const ls = (txt || '').split('\n').filter(l => /^- \[[ x]\]/.test(l)); return ls.length ? `<ul class="ck">${ls.map(l => { const on = l.startsWith('- [x]'); return `<li><span class="${on ? 'on' : 'off'}">${on ? '✓' : '○'}</span><span>${esc(l.replace(/^- \[[ x]\] /, ''))}</span></li>`; }).join('')}</ul>` : `<div class="txt muted">（書いていない）</div>`; };
const open = new Set();
function rowHTML(id, lv) {
  const t = by[id]; if (!visible(id)) return '';
  const k = kids[id] || [];
  const r = k.length ? roll(id) : null;
  const prog = t.total ? Math.round(100 * t.done / t.total) : 0;
  const meta = [
    t.split === 'これから' ? `<span class="pill uncut">まだ切っていない</span>` : '',
    t.area ? `<span class="pill area">${esc(t.area)}</span>` : '',
    r ? `<span class="muted num" title="下の 1 作業の完了／全部">${r.n ? `${r.done}/${r.n} 完了` : '1 作業はまだ無い'}${r.uncut ? `・まだ切っていない ${r.uncut}` : ''}</span>` : '',
    !k.length && t.total ? `<span class="bar" title="完了の条件 ${t.done}/${t.total}"><i style="width:${prog}%"></i></span>` : '',
    lv === 0 && t.due ? `<span class="muted num">目標 ${left(t.due)}</span>` : '',
    `<span class="pill st-${esc(t.stage)}">${esc(t.stage)}</span>`,
  ].join('');
  const det = open.has(id) ? `<div class="detail">
      <div class="full"><h3>目的</h3><div class="txt">${esc(t.purpose) || '<span class="muted">（書いていない）</span>'}</div></div>
      <div><h3>完了の条件（${t.done}/${t.total}）</h3>${ckList(t.conditions)}</div>
      <div><h3>実施事項</h3>${/^- \[/m.test(t.todo) ? ckList(t.todo) : `<div class="txt">${esc(t.todo) || '<span class="muted">（書いていない）</span>'}</div>`}</div>
      <div><h3>属性</h3><div class="txt">節目：${esc(t.milestone)}\n担当：${esc(t.assignee) || '未定'}\n目標の日：${left(t.due)}\n先に要るもの：${t.depends.length ? esc(t.depends.join('、')) : 'なし'}\n画面：${t.screens.length ? esc(t.screens.join('、')) : '—'}\n決定：${esc(t.decisions.join('、'))}</div></div>
      ${t.handoff ? `<div><h3>申し送り</h3><div class="txt">${esc(t.handoff)}</div></div>` : ''}
      ${t.risks ? `<div><h3>リスクと懸念</h3><div class="txt">${esc(t.risks)}</div></div>` : ''}
      <div class="full muted mono">${esc(t.file)}</div>
    </div>` : '';
  return `<li class="lv${lv} ${lv === 0 ? 'ms' : ''}" id="t-${id}"><div class="row" role="button" tabindex="0" aria-expanded="${open.has(id)}" data-id="${id}">
      <span class="id">${id}</span><span class="t">${esc(t.title)}</span><span class="meta">${meta}</span></div>${det}
      ${k.length ? `<ul class="tree">${k.map(c => rowHTML(c, lv + 1)).join('')}</ul>` : ''}</li>`;
}
function draw() {
  const h = roots.map(r => rowHTML(r, 0)).join('');
  document.getElementById('tree').innerHTML = h || `<li class="empty">当てはまるチケットはありません。条件を外してください</li>`;
}
const toggle = id => { open.has(id) ? open.delete(id) : open.add(id); draw(); };
document.getElementById('tree').addEventListener('click', e => { const r = e.target.closest('.row'); if (r) toggle(r.dataset.id); });
document.getElementById('tree').addEventListener('keydown', e => { const r = e.target.closest('.row'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); toggle(r.dataset.id); } });
document.addEventListener('click', e => { const j = e.target.closest('.jump'); if (!j) return; open.add(j.dataset.open); show('list'); draw(); setTimeout(() => document.getElementById('t-' + j.dataset.open)?.scrollIntoView({ block: 'center' }), 0); });
draw();

// スケジュール
const ORDER = ['基盤', '節目①', '節目②', '節目③', '本番', '後のフェーズ'];
const rootOf = ms => roots.map(r => by[r]).find(t => t.milestone === ms);
const curMs = (checking[0] || next[0] || {}).milestone;
document.getElementById('lanes').innerHTML = ORDER.map((ms, i) => {
  const r = rootOf(ms); if (!r) return '';
  const rr = roll(r.id);
  const groups = (kids[r.id] || []).map(g => by[g]);
  return `<div class="lane ${ms === curMs ? 'cur' : ''}">
    <div class="lane-h"><span class="step">${i + 1} / ${ORDER.length}</span><h2>${esc(r.title)}</h2>
      <span class="muted num">${rr.n ? `1 作業 ${rr.done}/${rr.n} 完了` : 'まだ 1 作業に切っていない'}${rr.uncut ? `・まだ切っていないまとまり ${rr.uncut}` : ''}</span>
      <span class="due">目標の日：${left(r.due)}</span></div>
    ${groups.map(g => { const gk = (kids[g.id] || []).map(x => by[x]); const gr = roll(g.id);
      return `<div class="grp ${g.split === 'これから' ? 'uncut-g' : ''}">
        <div class="gt"><span class="mono muted">${g.id}</span> ${esc(g.title)}</div>
        <div class="gm">${g.split === 'これから' ? '<span class="pill uncut">まだ切っていない</span>' : `<span class="num">${gr.done}/${gr.n} 完了</span>`}${g.screens.length ? `<span>画面 ${g.screens.length}</span>` : ''}<span class="pill st-${esc(g.stage)}">${esc(g.stage)}</span></div>
        ${gk.length ? `<ul class="kids">${gk.map(c => `<li><span class="mono muted">${c.id}</span><span>${esc(c.title)}</span><span class="pill st-${esc(c.stage)}">${esc(c.stage)}</span></li>`).join('')}</ul>` : ''}
      </div>`; }).join('') || (r.split === 'これから' ? '<div class="grp uncut-g"><div class="gm"><span class="pill uncut">まだ切っていない</span></div></div>' : '')}
  </div>`;
}).join('');

// 見え方の切り替え（#list・#schedule）
function show(v) {
  v = v === 'schedule' ? 'schedule' : 'list';
  document.getElementById('view-list').hidden = v !== 'list';
  document.getElementById('view-schedule').hidden = v !== 'schedule';
  document.getElementById('tab-list').toggleAttribute('aria-current', v === 'list'); if (v === 'list') document.getElementById('tab-list').setAttribute('aria-current', 'page');
  document.getElementById('tab-schedule').toggleAttribute('aria-current', v === 'schedule'); if (v === 'schedule') document.getElementById('tab-schedule').setAttribute('aria-current', 'page');
}
addEventListener('hashchange', () => show(location.hash.slice(1)));
show(location.hash.slice(1));
</script>
"""

def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__); return 2
    out = sys.argv[1]
    open(out, "w", encoding="utf-8").write(HTML.replace("__DATA__", data.replace("</", "<\\/")))
    print(f"{out}: チケット {len(rows)} 枚")
    return 0

if __name__ == "__main__":
    sys.exit(main())
