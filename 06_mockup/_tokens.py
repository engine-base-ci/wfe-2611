# -*- coding: utf-8 -*-
"""DESIGN-kaname.md のトークンをそのまま CSS 変数にしたもの。ここ以外に色を書かない。"""

TOKENS = """
:root{
  --primary:#22345C; --on-primary:#FFFFFF; --primary-c:#DCE4F2; --on-primary-c:#101C33;
  --secondary:#186F69; --on-secondary:#FFFFFF; --secondary-c:#CFEAE7; --on-secondary-c:#0A3330;
  --tertiary:#6D4AA6; --on-tertiary:#FFFFFF; --tertiary-c:#E9E0F5; --on-tertiary-c:#33235C;
  --surface:#F7F8FA; --on-surface:#131B27; --sv:#E9ECF1; --on-sv:#4A5563;
  --error:#B91C1C; --on-error:#FFFFFF; --neutral:#8A94A3;
  --card:#FFFFFF; --line:#DDE2E9; --line-soft:#EDF0F4;
  --st-success-c:#DCFCE7; --on-st-success-c:#2E5B26; --st-warning-c:#FCEBD5; --on-st-warning-c:#7A4A05;
  --st-danger-c:#FDECEC; --on-st-danger-c:#991B1B; --st-progress-c:#DBEAFE; --on-st-progress-c:#1E40AF;
  --mark:#FFF1B8; --ai-c:#EDEAF6; --on-code:#D8DEE9;
  --syn-keyword:#22345C; --syn-string:#186F69; --syn-number:#7E570D; --syn-comment:#4A5563; --syn-function:#6B3F5E; --syn-type:#2F4B7C;

  --st-success:#166534; --st-warning:#B45309; --st-danger:#B91C1C; --st-progress:#1D4ED8;
  --d-indigo:#2F4B7C; --d-teal:#186F69; --d-amber:#7E570D; --d-coral:#A34A3E; --d-sage:#516F46; --d-plum:#6B3F5E;

  --s-xs:4px; --s-sm:8px; --s-md:16px; --s-lg:24px; --s-xl:48px; --s-2xl:96px;
  --r-sm:4px; --r-md:6px; --r-lg:12px; --r-xl:20px; --r-full:9999px;

  --font:'M PLUS 2','Hiragino Sans',sans-serif;
  --font-code:ui-monospace,SFMono-Regular,Menlo,monospace;
  --side-bg:#EEF0F4; --side-hover:rgba(19,27,39,.06); --side-on:#FFFFFF;
  --sidebar-w:216px; --subnav-w:230px; --queue-w:380px; --queue-min:380px;
}
"""

BASE = """
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%}
body{background:var(--surface);color:var(--on-surface);font-family:var(--font);font-size:15px;line-height:1.7;-webkit-font-smoothing:antialiased}
a{color:inherit;text-decoration:none}
button{font-family:inherit;cursor:pointer;border:0;background:none;color:inherit}
svg{width:16px;height:16px;flex:none}
/* ★hidden 属性は必ず効かせる。作者スタイルの display 指定に負けないように。
   （.norole{display:grid} が hidden を上書きして、隠れるはずの要素が幅を奪う事故があった） */
[hidden]{display:none!important}  /* 既定サイズ。個別指定が無くても巨大化しない */
.num{font-variant-numeric:tabular-nums}

/* ============ 操作の状態（hover / focus / active / disabled / 読み込み中）── 全部品共通。個別に書かない ============ */
:root{--dur:.15s;--ring:var(--primary)}
a[href],button,[role=tab],[role=button],.inp,input,textarea,select{transition:background-color var(--dur),color var(--dur),border-color var(--dur),box-shadow var(--dur),opacity var(--dur),transform .08s}
a:focus-visible,button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,[tabindex]:focus-visible,[role=tab]:focus-visible,[role=button]:focus-visible{outline:2px solid var(--ring);outline-offset:2px;border-radius:var(--r-sm)}
.inp:focus-visible{outline-offset:1px}
/* 文中のリンクは下線で「押せる」を示す。ナビ・ボタン・チップは背景で示すので下線は付けない */
a[href]:hover{text-decoration:underline;text-underline-offset:3px;text-decoration-thickness:1px}
.side a:hover,.subnav a:hover,.tabbar a:hover,a.btn:hover,a.pill:hover,a.chip:hover,.mact a:hover,.opts a:hover,.mockbar a:hover,a.card:hover{text-decoration:none}
button:not([class]):hover{background:var(--sv);color:var(--on-surface)}
button,[role=button]{min-height:24px;min-width:24px}   /* WCAG 2.2 2.5.8 */
.btn:active{transform:translateY(1px)}
.side-item:active,.sn:active,.tabbar a:active{transform:scale(.985)}
[disabled],[aria-disabled="true"]{opacity:.55;cursor:not-allowed}
tbody tr:hover>td{background:var(--surface)}
.skel{position:relative;overflow:hidden;background:var(--sv);border-radius:var(--r-sm);color:transparent!important;user-select:none}
.skel::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,rgba(255,255,255,.65),transparent);animation:sk 1.3s infinite}
@keyframes sk{from{transform:translateX(-100%)}to{transform:translateX(100%)}}
@media(prefers-reduced-motion:reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}}

/* ============ モック帯（実装には含めない印） ============ */
.mockbar{position:sticky;top:0;z-index:60;background:var(--on-surface);color:#fff;font-size:11.5px;letter-spacing:.02em;padding:7px 16px;display:flex;gap:14px;align-items:center;flex-wrap:wrap}
.mockbar b{font-weight:600}
.mockbar .tagv{background:var(--tertiary);padding:2px 8px;border-radius:var(--r-full);font-weight:600;font-size:10.5px}
.mockbar a{opacity:.72;border-bottom:1px solid rgba(255,255,255,.32)}
.mockbar a:hover{opacity:1}
.mockbar .sp{flex:1}
.mockbar .wsw{display:inline-flex;gap:3px;align-items:center}
.mockbar .wsw b{font-size:10.5px;opacity:.6;font-weight:600;margin-right:3px}
.mockbar .wsw button{font-size:11px;font-weight:600;padding:3px 9px;border-radius:var(--r-full);background:rgba(255,255,255,.14);color:rgba(255,255,255,.78);min-height:22px}
.mockbar .wsw button:hover{background:rgba(255,255,255,.26);color:#fff}
@media(max-width:767px){.mockbar .wsw{display:none}}

/* ============ シェル ============ */
.shell{display:flex;min-height:calc(100vh - 34px)}

/* サイドバー（D-072：中間色。紺の面はやめる。Linear / Notion と同じく本文より半段暗い灰色＋罫線 1 本） */
.side{width:var(--sidebar-w);flex:none;background:var(--side-bg);color:var(--on-surface);border-right:1px solid var(--line);display:flex;flex-direction:column;position:sticky;top:34px;height:calc(100vh - 34px);overflow-y:auto}
.side-brand{padding:18px 18px 14px;display:flex;align-items:center;gap:9px;font-size:16px;font-weight:700;letter-spacing:.01em;color:var(--on-surface)}
.side-brand svg{width:20px;height:20px;color:var(--primary)}
.side-nav{padding:4px 10px 10px;display:flex;flex-direction:column;gap:3px}
.side-sec{font-size:11px;font-weight:600;letter-spacing:.12em;color:var(--neutral);padding:14px 10px 5px}
.side-item{display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:var(--r-md);font-size:13.5px;font-weight:500;color:var(--on-sv);position:relative}
.side-item svg{width:16px;height:16px;opacity:.85}
.side-item:hover{background:var(--side-hover);color:var(--on-surface)}
.side-item.on{background:var(--side-on);color:var(--on-surface);font-weight:600;box-shadow:0 0 0 1px var(--line)}
.side-item.on svg{opacity:1;color:var(--primary)}
.side-item .badge{margin-left:auto;background:var(--st-warning);color:#fff;font-size:11px;font-weight:600;padding:1px 7px;border-radius:var(--r-full)}
.side-item .badge.badge-ai{background:var(--tertiary)}
.side-sub{display:flex;flex-direction:column;gap:3px;padding-left:26px;margin-top:3px}
.side-sub a{display:flex;align-items:center;gap:8px;padding:5px 10px;border-radius:var(--r-md);font-size:12.5px;color:var(--on-sv)}
.side-sub a:hover{background:var(--side-hover);color:var(--on-surface)}
.side-sub .dot{width:4px;height:4px;border-radius:50%}
.side-foot{margin-top:auto;border-top:1px solid var(--line);padding:12px 14px;display:flex;align-items:center;gap:10px}
.side-foot .av{width:30px;height:30px;border-radius:var(--r-full);background:var(--primary-c);color:var(--on-primary-c);display:grid;place-items:center;font-size:12px;font-weight:600;flex:none}
.side-foot .who{min-width:0}
.side-foot .nm{font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.side-foot .co{font-size:11px;color:var(--on-sv);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* 本体 */
.main{flex:1;min-width:0;display:flex;flex-direction:column}
.topbar{background:var(--card);padding:10px 28px 2px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
/* 見出しの帯は低く（2026-09-30 user「ヘッドの幅が広すぎる」）：くくりと画面名を横 1 行、説明は 1 行（全文は乗せると出る） */
.topbar .tt{display:flex;align-items:baseline;gap:10px;min-width:0}
.topbar h1{font-size:18px;font-weight:700;letter-spacing:-.015em}
.topbar .crumb{font-size:12px;color:var(--on-sv)}
.topbar .sp{flex:1}
.content{padding:24px 32px 64px;width:100%}

/* 状態タブ */
/* 状態タブはモック専用の帯（実装には無い）。本文の帯と見分けがつくよう暗い帯にする */
.states{background:#2A3444;padding:0 20px;display:flex;gap:2px;overflow-x:auto}
.states button{padding:8px 12px;font-size:12px;font-weight:600;color:rgba(255,255,255,.7);border-bottom:2px solid transparent;white-space:nowrap;display:flex;align-items:center;gap:7px;flex:none}   /* flex:none が無いとタブが増えたとき縮んで文字が隣と重なる（375 幅・9 タブで発生） */
.states button:hover{color:#fff}
.states button[aria-selected="true"]{color:#fff;border-bottom-color:#fff}
.states button .mk{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.35)}
.states button[aria-selected="true"] .mk{background:#fff}
.statepane[hidden]{display:none!important}
.state-note{background:var(--sv);border-left:3px solid var(--neutral);border-radius:0 var(--r-md) var(--r-md) 0;padding:9px 14px;font-size:12.5px;color:var(--on-sv);margin-bottom:20px}

/* ============ 部品 ============ */
/* 箱ではなく段：罫線 1 本と余白で区切る（影より罫線・D-052。1px の箱を並べない・D-071） */
.card{background:transparent;border:0;border-top:1px solid var(--line);border-radius:0;padding:22px 0 10px}
.card+.card{margin-top:6px}
.card:first-child{border-top:0;padding-top:4px}
.grid>.card{border-top:1px solid var(--line);padding-top:18px}
.card-h{display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap}
.card-h h2{font-size:18px;font-weight:700;letter-spacing:-.01em}
.card-h .sp{flex:1}
.muted{color:var(--on-sv)}
.grid{display:grid;gap:16px}
.grid>*{min-width:0}   /* 既定の min-width:auto だと、中の表の min-width が列幅を押し広げる */
.card{min-width:0}
@media(min-width:768px){.g2{grid-template-columns:1fr 1fr}.g3{grid-template-columns:repeat(3,1fr)}.g21{grid-template-columns:2fr 1fr}}
@media(min-width:1560px){.g21{grid-template-columns:2.4fr 1fr}.g3{grid-template-columns:repeat(4,1fr)}.g3.g3-keep{grid-template-columns:repeat(3,1fr)}}
@media(max-width:1023px){.g21{grid-template-columns:1fr}.g3{grid-template-columns:1fr 1fr}}

.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 17px;border-radius:var(--r-md);font-size:13.5px;font-weight:600;transition:.13s}
.btn svg{width:15px;height:15px}
.btn-p{background:var(--primary);color:#fff}.btn-p:hover{background:#1a2848}
.btn-s{background:var(--secondary-c);color:var(--on-secondary-c)}.btn-s:hover{background:#bfe2de}
.btn-o{border:1.5px solid var(--primary);color:var(--primary)}.btn-o:hover{background:var(--primary-c)}
.btn-g{color:var(--on-sv)}.btn-g:hover{background:var(--sv);color:var(--on-surface)}
.btn-d{border:1.5px solid var(--error);color:var(--error)}.btn-d:hover{background:#FBE9E9}
.btn-sm{padding:6px 12px;font-size:12.5px}

.pill{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:var(--r-full);font-size:11.5px;font-weight:600;color:#fff;white-space:nowrap}
.pill svg{width:12px;height:12px}
.p-su{background:var(--st-success)}.p-wa{background:var(--st-warning)}.p-da{background:var(--st-danger)}.p-pr{background:var(--st-progress)}.p-ne{background:#6B7585}  /* 白文字で 4.6:1 */
.pill-ai{background:var(--tertiary-c);color:var(--on-tertiary-c)}

.tag{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--on-sv)}
.tag .dot{width:4px;height:4px;border-radius:50%;flex:none}
td>svg,th>svg,p>svg,span>svg,b>svg,a>svg{vertical-align:middle;position:relative;top:-1px}
td:has(>svg:only-child){text-align:center}
.card-h>svg{align-self:center}
.dl{display:flex;flex-direction:column;gap:8px;font-size:13.5px}
.dl>div{display:flex;gap:10px;align-items:center;padding:10px 12px;background:var(--surface);border-radius:var(--r-md)}
.dl>div>svg{flex:none}
.rail{border-left:2px solid var(--neutral);padding-left:11px}

.metric{font-size:34px;font-weight:600;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums}
.metric-sm{font-size:22px;font-weight:600;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.metric-lbl{font-size:11.5px;font-weight:600;letter-spacing:.04em;color:var(--on-sv);margin-bottom:7px}
.metric-sub{font-size:12.5px;color:var(--on-sv);font-variant-numeric:tabular-nums;margin-top:7px}
.bar{height:6px;background:var(--sv);border-radius:var(--r-full);overflow:hidden;margin-top:11px}
.bar>i{display:block;height:100%;background:var(--primary);border-radius:var(--r-full)}
.bar>i.warn{background:var(--st-warning)}.bar>i.ok{background:var(--st-success)}.bar>i.bad{background:var(--st-danger)}

table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font-size:11px;font-weight:600;letter-spacing:.06em;color:var(--on-sv);padding:0 10px 8px 0;border-bottom:1px solid var(--line)}
th.r,td.r{text-align:right}
td{padding:11px 10px 11px 0;border-bottom:1px solid var(--line-soft);vertical-align:middle}
td.n{font-variant-numeric:tabular-nums;text-align:right;font-weight:500}
tr:last-child td{border-bottom:0}
.t-wrap{overflow-x:auto}

.ai{background:var(--tertiary-c);color:var(--on-tertiary-c);border-left:3px solid var(--tertiary);border-radius:0 var(--r-md) var(--r-md) 0;padding:14px 16px}
.ai-h{display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;letter-spacing:.06em;margin-bottom:7px}
.ai-h svg{width:13px;height:13px}

.field{margin-bottom:15px}
.field label{display:block;font-size:12px;font-weight:600;color:var(--on-sv);margin-bottom:6px}
.inp{width:100%;background:var(--sv);border:1px solid transparent;border-radius:var(--r-md);padding:10px 13px;font-family:inherit;font-size:14px;color:var(--on-surface)}
.inp:focus{outline:2px solid var(--primary);outline-offset:1px;background:var(--card)}
.inp.err{outline:2px solid var(--error);background:#FDF2F2}
.pw{position:relative}
.pw .pw-inp{padding-right:44px}
.pw-btn{position:absolute;top:50%;right:4px;transform:translateY(-50%);width:32px;height:32px;display:grid;place-items:center;background:none;border:0;border-radius:var(--r-sm);color:var(--on-sv);cursor:pointer}
.pw-btn svg{width:17px;height:17px;display:block}
.pw-btn .pw-on,.pw-btn .pw-off{display:grid;place-items:center}
.pw-btn .pw-off{display:none}
.pw-btn[aria-pressed="true"] .pw-on{display:none}
.pw-btn[aria-pressed="true"] .pw-off{display:grid}
.pw-btn:hover{background:var(--surface);color:var(--on-surface)}
.pw-btn:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.help{font-size:12px;color:var(--on-sv);margin-top:5px}
.help.err{color:var(--error);font-weight:500;display:flex;gap:6px;align-items:flex-start}
.help.err svg{width:14px;height:14px;margin-top:3px;flex:none}

.empty{text-align:center;padding:56px 20px;color:var(--on-sv)}
.empty svg{width:38px;height:38px;opacity:.34;margin-bottom:14px}
.empty h3{font-size:15px;font-weight:700;color:var(--on-surface);margin-bottom:6px}
.empty p{font-size:13px;max-width:420px;margin:0 auto 18px}

.kv{display:grid;grid-template-columns:auto 1fr;gap:8px 18px;font-size:13px}
.kv dt{color:var(--on-sv);white-space:nowrap}
.kv dd{font-weight:500}
.code{background:var(--on-surface);color:#D8DEE9;border-radius:var(--r-md);padding:13px 15px;font-family:var(--font-code);font-size:12px;line-height:1.75;white-space:pre;overflow-x:auto}

.spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite;display:inline-block}
.spin.dark{border-color:rgba(19,27,39,.2);border-top-color:var(--primary)}
@keyframes sp{to{transform:rotate(360deg)}}


/* ============ 画面ごとの第2サイドバー（画面によって中身が変わる） ============ */
.subnav{width:var(--subnav-w);flex:none;background:var(--card);border-right:1px solid var(--line);
        position:sticky;top:34px;height:calc(100vh - 34px);overflow-y:auto;display:flex;flex-direction:column}
.subnav-b{padding:10px;display:flex;flex-direction:column;gap:1px}
.subnav-sec{font-size:11px;font-weight:700;letter-spacing:.1em;color:var(--on-sv);padding:13px 8px 5px}
.sn{display:flex;align-items:center;gap:9px;padding:7px 9px;border-radius:var(--r-md);font-size:13px;color:var(--on-sv)}
.sn:hover{background:var(--sv);color:var(--on-surface)}
.sn.on{background:var(--primary-c);color:var(--on-primary-c);font-weight:600}
.sn .dot{width:4px;height:4px;border-radius:50%;flex:none}
.sn .n{margin-left:auto;font-size:11.5px;font-variant-numeric:tabular-nums;color:var(--on-sv)}
.sn .n.warn{color:#92400E;font-weight:700}  /* 薄い面の上でも 4.5:1 */
.subnav-f{margin-top:auto;padding:12px 14px;border-top:1px solid var(--line-soft)}

/* 権限バー（アカウントタイプの切替＝モック用） */
.rolebar{display:flex;gap:5px;align-items:center}
.rolebar b{font-size:10.5px;opacity:.6;font-weight:600;letter-spacing:.06em}
.rolebar button{font-size:11px;font-weight:600;padding:3px 10px;border-radius:var(--r-full);
  background:rgba(255,255,255,.14);color:rgba(255,255,255,.72)}
.rolebar button[aria-pressed="true"]{background:#fff;color:var(--on-surface)}
.side[data-role]{display:none}
.side[data-role].on{display:flex}
.norole{flex:1;min-width:0;display:grid;place-content:center;text-align:center;padding:40px 28px}
.norole>*{max-width:560px}
.norole svg{width:34px;height:34px;color:var(--on-sv);margin:0 auto 4px}
.norole h3{font-size:16px;font-weight:700;margin:12px 0 8px}
.norole p{font-size:13px;color:var(--on-sv);line-height:1.8}

/* 画面の目的（topbar 下） */
/* 見出しの帯（.shead）：第2ナビと本文の上にまたがって 1 つだけ。画面名 18px・説明はその下に 1 回だけ（2026-09-30） */
.shead{background:var(--card);border-bottom:1px solid var(--line);min-width:0}
.purpose{background:var(--card);padding:0 28px 8px;
  display:flex;gap:8px;align-items:center;font-size:12px;color:var(--on-sv);line-height:1.6}
.purpose>div{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
@media(max-width:767px){.purpose>div{white-space:normal}}
.purpose svg{color:var(--primary)}
.purpose b{color:var(--on-surface)}

/* モバイル下部タブ */
.tabbar{display:none}
@media(max-width:767px){
  .side,.side[data-role].on{display:none}   /* ★役割切替の .on（詳細度が高い）に負けないよう両方書く */
  .content{padding:18px 16px 92px}
  .topbar{padding:12px 16px}
  .topbar h1{font-size:18px}
  .inp,input:not([type=checkbox]):not([type=radio]),textarea,select{font-size:16px!important}   /* iOS Safari はフォーカス時に 16px 未満の入力欄へ自動ズームする。部品側の指定より必ず勝つ */
  .states{padding:0 16px}
  .tabbar{display:flex;position:fixed;left:0;right:0;bottom:0;z-index:50;background:var(--card);border-top:1px solid var(--line);padding:6px 4px calc(6px + env(safe-area-inset-bottom))}
  .tabbar a{flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;padding:6px 2px;font-size:11px;font-weight:600;color:var(--on-sv);position:relative}
  .tabbar a svg{width:19px;height:19px}
  .tabbar a.on{color:var(--primary)}
  .tabbar a .bdg{position:absolute;top:2px;right:calc(50% - 17px);background:var(--st-warning);color:#fff;font-size:11px;font-weight:700;min-width:17px;height:17px;border-radius:var(--r-full);display:grid;place-items:center;padding:0 4px}
  .grid.g2,.grid.g3,.grid.g21{grid-template-columns:1fr}
  .purpose{padding:10px 16px}
  .subnav{width:100%;height:auto;position:static;border-right:0;border-bottom:1px solid var(--line);flex-direction:column}
  .subnav-h{display:none}   /* スマホでは見出し・目的は本文の見出しと重複するので出さない。第2ナビは帯（チップ）だけ */
  .subnav-h .acts{display:none}   /* 行為ID・役割・根拠のチップは開発者向け。スマホでは出さない（本文が下に押し出される） */
  .subnav-h .why{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .subnav-b{flex-direction:row;overflow-x:auto;gap:6px;padding:10px 16px}
  .subnav-b .sn{white-space:nowrap;background:var(--sv);flex:none}
  .subnav-sec{display:none}
  .subnav-f{display:none}
  .shell{flex-direction:column}
  /* 表は縮めずに、表の中だけ横スクロールさせる（本文は絶対に横スクロールさせない） */
  .t-wrap{margin:0 -16px;padding:0 16px}
  .t-wrap table{min-width:560px}
  .card{padding:16px}
  .metric{font-size:30px}
}

/* ============ v2 シェル（flow.json 駆動）で足したもの ============ */
.mockbar .ph{opacity:.55;font-size:11px}
.mockbar .mut{opacity:.5}
.topbar .tt{min-width:0}
.subnav-h .acts{margin-top:9px;display:flex;gap:4px;flex-wrap:wrap}
.acts{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:14px}   /* ボタンの並び。くっつけない（全画面共通） */
.subnav-h .ck.rl{background:var(--sv);color:var(--on-sv)}
.subnav-h .ck{font-size:10px;font-weight:600;font-family:var(--font-code);background:var(--primary-c);
  color:var(--on-primary-c);padding:1px 6px;border-radius:var(--r-full)}
.norole .go{margin-top:14px;font-size:12px;color:var(--on-sv);background:var(--sv);
  border-radius:var(--r-md);padding:9px 13px;display:inline-block}
.purpose b{color:var(--on-surface)}
/* 主アクションは1つだけ。副は枠線・文字だけに落とす */
.topbar .btn-p{box-shadow:0 1px 0 rgba(0,0,0,.06)}

"""
