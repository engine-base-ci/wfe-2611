# -*- coding: utf-8 -*-
"""モックの会話の見た目を、そのまま実装（apps/web）に写す（D-104・design_gate：モックが正、実装が従）。
 _chat.CHAT_CSS・_composer.COMPOSER_CSS・_memdigest.DIGEST_CSS を 1 つにし、全部の規則を .kc の下に閉じる
 （会話の外の画面にある .msg・.work・mark などとぶつけない）。手で直さない。scripts/ci/chat_one.mjs C6 が差を赤にする。
 使い方: python3 06_mockup/export_web_css.py [--check]"""
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from _chat import CHAT_CSS, FRAME_CSS  # noqa: E402
from _composer import COMPOSER_CSS  # noqa: E402
from _memdigest import DIGEST_CSS  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "apps/web/components/ai/chat.css"
SCOPE = ".kc"


def scope_selectors(sel: str) -> str:
    out = []
    for s in sel.split(","):
        s = s.strip()
        if not s:
            continue
        # 会話の根そのものへの規則（.kc[data-art] 等）はそのまま。それ以外は .kc の下に閉じる
        out.append(SCOPE if s == ":root" else (s if s == SCOPE or s.startswith(SCOPE + "[") else f"{SCOPE} {s}"))
    return ",".join(out)


def scope(css: str) -> str:
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    res, i, n = [], 0, len(css)
    while i < n:
        j = css.find("{", i)
        if j < 0:
            break
        head = css[i:j].strip()
        if head.startswith("@keyframes"):
            depth, k = 0, j
            while k < n:
                depth += css[k] == "{"
                depth -= css[k] == "}"
                k += 1
                if depth == 0:
                    break
            res.append(css[i:k].strip())
            i = k
            continue
        if head.startswith("@media"):
            depth, k = 0, j
            while k < n:
                depth += css[k] == "{"
                depth -= css[k] == "}"
                k += 1
                if depth == 0:
                    break
            res.append(f"{head}{{{scope(css[j + 1:k - 1])}}}")
            i = k
            continue
        k = css.find("}", j)
        res.append(f"{scope_selectors(head)}{{{css[j + 1:k].strip()}}}")
        i = k + 1
    return "\n".join(res)


def build() -> str:
    head = ("/* 生成物。06_mockup/export_web_css.py が _chat.py・_composer.py・_memdigest.py から作る。手で直さない（chat_one.mjs C6）。\n"
            "   色・文字・角丸は DESIGN-kaname.md の段だけ（トークンは styles/tokens.css） */\n")
    # 絵柄（アイコン）の既定の大きさ。図（mermaid の SVG）には当てない（当てると図が 16px に潰れる）
    base = f"{SCOPE} .muted{{color:var(--on-sv)}}\n{SCOPE} svg.lucide{{width:16px;height:16px;flex:none}}\n"
    # components の層に置く：画面側で Tailwind の utilities を足したときはそちらが勝つ（層の外に置くと、何を足しても負ける）
    # 会話の固定枠（FRAME_CSS）は会話の外側の枠に掛かるので、.kc の下に閉じずにそのまま書く
    body = base + scope(CHAT_CSS) + "\n" + scope(COMPOSER_CSS) + "\n" + scope(DIGEST_CSS) + "\n" + FRAME_CSS.strip()
    return head + "@layer components {\n" + body + "\n}\n"


if __name__ == "__main__":
    css = build()
    if "--check" in sys.argv:
        ok = OUT.exists() and OUT.read_text(encoding="utf-8") == css
        print("chat.css はモックと同じ" if ok else "chat.css がモックとずれています（python3 06_mockup/export_web_css.py で作り直す）")
        sys.exit(0 if ok else 1)
    OUT.write_text(css, encoding="utf-8")
    print(f"書いた: {OUT}（{len(css.splitlines())} 行）")
