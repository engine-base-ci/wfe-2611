#!/usr/bin/env python3
"""正本（DESIGN-*.md）から CSS のトークンを機械生成する。
画面側に生の色・生の寸法を書かせないための唯一の出どころ（規約 design-system.md）。"""
import re, sys, yaml
from pathlib import Path

src = Path(sys.argv[1] if len(sys.argv) > 1 else "04_design/DESIGN-kaname.md")
out = Path(sys.argv[2] if len(sys.argv) > 2 else "apps/bridge/src/renderer/tokens.css")
d = yaml.safe_load(re.match(r"^---\n(.*?)\n---\n", src.read_text(encoding="utf-8"), re.S).group(1))

L = [f"/* {src.name} から機械生成。手で書かない（04_design/gen_tokens.py）*/", ":root {"]
for k, v in (d.get("colors") or {}).items():
    L.append(f"  --{k}: {v};")
for k, v in (d.get("state") or {}).items():
    L.append(f"  --st-{k}: {v};")
for k, v in (d.get("data") or {}).items():
    L.append(f"  --d-{k}: {v};")
for k, v in (d.get("typography") or {}).items():
    if "fontSize" in v:
        L.append(f"  --text-{k}: {v['fontSize']};")
    if "lineHeight" in v:
        L.append(f"  --lh-{k}: {v['lineHeight']};")
for k, v in (d.get("rounded") or {}).items():
    L.append(f"  --r-{k}: {v};")
for k, v in (d.get("spacing") or {}).items():
    L.append(f"  --s-{k}: {v};")
fam = (d.get("typography") or {}).get("body", {}).get("fontFamily", "system-ui")
L.append(f'  --font-sans: "{fam}", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;')
L.append("}")
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text("\n".join(L) + "\n", encoding="utf-8")
print(f"{out} に {len(L)-3} 個のトークンを書いた")
