# -*- coding: utf-8 -*-
"""左パネルの一覧（会話・スレッド）の共通の部品（2026-09-30）。見た目は THREADLIST_CSS、実装は apps/web/components/ai/list.tsx（.tlist）と同じ class"""
from _icons import ic

THREADLIST_CSS = """/* 左パネルの一覧（会話・スレッド）の共通の部品（2026-09-30 user「一つひとつ大きい」）。手本は assistant-ui の ThreadList・Vercel ai-chatbot・LibreChat：
   1 行 32px・14px・1 行で省略・行の間 2px・日付の見出し 11px・操作は「…」にまとめて、乗せた行・開いている行・タッチの端末だけに出す */
.tlist{display:flex;flex-direction:column;gap:2px;min-width:0}
.tlist ul{display:flex;flex-direction:column;gap:2px;list-style:none;margin:0;padding:0}
.tlist svg{width:16px;height:16px;flex:none}
.tl-top{display:flex;gap:4px;margin-bottom:4px}
/* 新しく話す：アイコンだけ（ChatGPT・Claude と同じペンと四角）。乗せると名前が出る */
.tl-new{flex:none;width:32px;height:32px;display:grid;place-items:center;border:1px solid var(--line);border-radius:var(--r-md);background:var(--card);color:var(--on-surface)}
.tl-new:hover{background:var(--sv)}
.tl-new:focus-visible,.tl-open:focus-visible,.tl-more:focus-visible,.tl-menu button:focus-visible{outline:2px solid var(--primary);outline-offset:1px}
.tl-search{flex:1;min-width:0;display:flex;align-items:center;gap:6px;height:32px;padding:0 10px;border-radius:var(--r-md);background:var(--sv);color:var(--on-sv)}
.tl-search input{flex:1;min-width:0;height:100%;border:0;background:none;font:inherit;font-size:14px;color:var(--on-surface);outline:none}
.tl-grp{font-size:11px;font-weight:600;color:var(--on-sv);padding:10px 10px 4px}
.tl-item{position:relative;display:flex;align-items:center;min-height:32px;border-radius:var(--r-md)}
.tl-item:hover,.tl-item.on{background:var(--sv)}
.tl-open{flex:1;min-width:0;align-self:stretch;display:flex;flex-direction:column;justify-content:center;padding:0 10px;text-align:left;border-radius:var(--r-md);font-size:14px;color:var(--on-sv)}
.tl-item:hover .tl-open,.tl-item.on .tl-open{color:var(--on-surface)}
.tl-item.on .tl-open{font-weight:600}
.tl-t{display:flex;align-items:center;gap:6px;min-width:0}
/* 記憶に使わない会話の札（目のマークは意味が分からない・2026-09-30 user） */
.tl-tag{flex:none;font-size:11px;font-weight:600;color:var(--on-sv);background:var(--line);padding:0 6px;border-radius:var(--r-full)}
.tl-name{min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tl-hit{display:block;font-size:12px;font-weight:400;color:var(--on-sv);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-bottom:4px}
.tl-unread{flex:none;margin-right:8px;min-width:18px;height:18px;padding:0 5px;border-radius:var(--r-full);background:var(--primary);color:var(--on-primary);font-size:11px;font-weight:600;display:grid;place-items:center}
.tl-more{flex:none;width:24px;height:24px;margin-right:4px;display:grid;place-items:center;border-radius:var(--r-sm);color:var(--on-sv);opacity:0}
.tl-more svg{width:16px;height:16px}
.tl-more:hover{background:var(--line)}
.tl-item:hover .tl-more,.tl-item.on .tl-more,.tl-more:focus-visible,.tl-more[aria-expanded="true"]{opacity:1}
@media(hover:none){.tl-more{opacity:1}}
.tl-menu{position:absolute;right:4px;top:calc(100% + 2px);z-index:30;min-width:160px;padding:4px;display:flex;flex-direction:column;background:var(--card);border:1px solid var(--line);border-radius:var(--r-md);box-shadow:0 8px 24px rgba(0,0,0,.12)}
/* 実装では「…」の箱をいちばん上の層（popover）に出し、一覧の枠に切られないようにする（2026-10-01 user「パネルの中に入っている」）。位置は押したボタンから決める */
.tl-menu[popover]{margin:0;color:var(--on-surface)}
/* メニューの中は一覧より一段小さく（2026-09-30 user「…の中のフォントも大きい」） */
.tl-menu button{display:flex;align-items:center;gap:8px;height:28px;padding:0 8px;border-radius:var(--r-sm);font-size:12px;color:var(--on-surface);text-align:left}
.tl-menu button svg{width:14px;height:14px}
.tl-menu button:hover{background:var(--sv)}
.tl-menu button.danger{color:var(--st-danger)}
.tl-rename{flex:1;display:flex;padding:0 4px}
.tl-rename input{flex:1;min-width:0;height:28px;padding:0 8px;border:1px solid var(--primary);border-radius:var(--r-sm);background:var(--card);font:inherit;font-size:14px}
.tl-empty{font-size:12px;color:var(--on-sv);padding:6px 10px}
/* この会話を記憶に使わない：何が起きるかを添える（2026-09-30 user「何のことかわからない」） */
.tl-foot{display:flex;align-items:flex-start;gap:8px;margin-top:8px;padding:10px;border-top:1px solid var(--line);font-size:12px;color:var(--on-surface);cursor:pointer}
.tl-foot input{margin-top:2px;accent-color:var(--primary)}
.tl-foot b{font-weight:600}
.tl-foot .muted{display:block;color:var(--on-sv);font-size:11px;line-height:1.6;margin-top:2px}
@media(max-width:767px){.tl-search input,.tl-rename input{font-size:16px}}
"""


def thread_list(groups, current=None, incognito_foot=False):
    """groups = [(見出し, [(名前, 印)])]。印：'on'（開いている）／'unread:N'／'incog'。記憶に使わないの切り替えは入力欄の側（_composer.py）"""
    out = ['<nav class="tlist" aria-label="会話の一覧" data-part="conversation-list">',
           f'<div class="tl-top"><label class="tl-search">{ic("search")}<input placeholder="会話を探す（中身も）" aria-label="会話を探す"></label>'
           f'<button class="tl-new" title="新しく話す" aria-label="新しく話す">{ic("squarepen")}</button></div>']
    for label, rows in groups:
        out.append(f'<div class="tl-sec"><div class="tl-grp">{label}</div><ul>')
        for name, mark in rows:
            on = mark == "on"
            unread = mark.split(":")[1] if mark.startswith("unread:") else ""
            incog = '<span class="tl-tag" title="記憶に使わない会話">記憶なし</span>' if mark == "incog" else ""
            out.append(f'<li class="tl-item{" on" if on else ""}"><button class="tl-open"{" aria-current=\"page\"" if on else ""} title="{name}">'
                       f'<span class="tl-t"><span class="tl-name">{name}</span>{incog}</span></button>'
                       + (f'<span class="tl-unread" aria-label="新しい返事 {unread}">{unread}</span>' if unread else "")
                       + f'<button class="tl-more" aria-label="この会話の操作" aria-haspopup="menu">{ic("more")}</button></li>')
        out.append('</ul></div>')
    if incognito_foot:
        out.append('<label class="tl-foot"><input type="checkbox" role="switch" aria-label="この会話を記憶に使わない">'
                   '<span><b>この会話を記憶に使わない</b><span class="muted">オンにすると、自分のAIが毎朝まとめる記憶にこの会話を入れません</span></span></label>')
    out.append('</nav>')
    return "".join(out)


CONFIRM_CSS = """/* 確かめの画面（2026-09-30）。ブラウザの確認の箱は使わない。部品は apps/web/components/ui/confirm.tsx */
/* 画面のまん中に出す。土台の CSS（Tailwind の preflight）が全要素の margin を 0 にするので、<dialog> の既定の中央寄せ（margin:auto）を書き戻す（2026-10-01 user「左上に出る」） */
.cdlg{margin:auto;inset:0;max-height:calc(100dvh - 32px);padding:0;border:1px solid var(--line);border-radius:var(--r-lg);background:var(--card);color:var(--on-surface);width:min(400px,calc(100vw - 32px));box-shadow:0 16px 48px rgba(0,0,0,.18)}
.cdlg::backdrop{background:rgba(15,20,30,.35)}
.cdlg-in{padding:18px 20px 16px}
.cdlg-h{display:flex;gap:8px;align-items:center;font-size:16px}
.cdlg-h b{font-weight:700}
.cdlg-h svg{width:18px;height:18px;color:var(--st-danger);flex:none}
.cdlg-b{margin:8px 0 0;font-size:13px;line-height:1.7;color:var(--on-sv)}
.cdlg-f{display:flex;justify-content:flex-end;gap:8px;margin-top:18px}
.cdlg-f button{height:32px;padding:0 14px;border-radius:var(--r-md);font-size:13px;font-weight:600}
.cdlg-no{color:var(--on-sv)}
.cdlg-no:hover{background:var(--sv);color:var(--on-surface)}
.cdlg-ok{background:var(--primary);color:var(--on-primary)}
.cdlg-ok.danger{background:var(--st-danger);color:#fff}
.cdlg-f button:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
"""
