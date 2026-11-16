#!/usr/bin/env python3
"""正本（DESIGN-*.md）から CSS のトークンを機械生成する。
画面側に生の色・生の寸法を書かせないための唯一の出どころ（規約 design-system.md）。

  python3 04_design/gen_tokens.py [正本] [出力]           … Bridge 用（apps/bridge/src/renderer/tokens.css）
  python3 04_design/gen_tokens.py --web [正本] [出力]     … 新しい画面用（apps/web/styles/k-tokens.css・K-24）
  python3 04_design/gen_tokens.py --web --check           … 生成物が正本どおりか（CI）

新しい画面用は、明るいテーマ（正本の colors 他）と暗いテーマ（正本の dark・D-128.55）の両方を出す。
  見た目は「システムに合わせる・明るい・暗い」の 3 つ。<html data-theme="light|dark"> で固定、無ければシステムに合わせる
どちらのテーマも、文字と地の組み合わせを WCAG で確かめ、4.5:1 に届かない組があれば赤（出力しない）。
"""
import re, sys, yaml
from pathlib import Path

args = [a for a in sys.argv[1:] if not a.startswith("--")]
WEB = "--web" in sys.argv
CHECK = "--check" in sys.argv
src = Path(args[0] if args else "04_design/DESIGN-kaname.md")
default_out = "apps/web/styles/k-tokens.css" if WEB else "apps/bridge/src/renderer/tokens.css"
out = Path(args[1] if len(args) > 1 else default_out)
d = yaml.safe_load(re.match(r"^---\n(.*?)\n---\n", src.read_text(encoding="utf-8"), re.S).group(1))


# ---- WCAG のコントラスト（相対輝度） ----
def lum(h: str) -> float:
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def ratio(a: str, b: str) -> float:
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def pairs(P: dict) -> list[tuple[str, str, str]]:
    """文字と地の組み合わせ（明るい・暗いで同じ組を見る）。コードの色分けはコードの箱の地（surface）の上"""
    c, s, dd, y = P["colors"], P["state"], P["data"], P["syntax"]
    out = [(f"{bg} / {fg}", c[bg], c[fg]) for bg, fg in [
        ("primary", "on-primary"), ("secondary", "on-secondary"), ("tertiary", "on-tertiary"),
        ("surface", "on-surface"), ("surface", "on-surface-variant"), ("surface-variant", "on-surface"),
        ("error", "on-error"), ("card", "on-surface"), ("card", "on-surface-variant"), ("page", "on-surface"),
        ("primary-container", "on-primary-container"), ("secondary-container", "on-secondary-container"),
        ("tertiary-container", "on-tertiary-container"), ("ai-container", "on-surface"), ("mark", "on-surface"),
        ("select", "on-surface"), ("side-bg", "on-surface-variant"), ("card", "primary"),
    ]]
    out.append(("neutral-strong / 白", c["neutral-strong"], "#FFFFFF"))
    for k in ("success", "warning", "danger", "progress"):
        out.append((f"{k}-container / on-{k}-container", s[f"{k}-container"], s[f"on-{k}-container"]))
        out.append((f"card / {k}（文字）", c["card"], s[k]))
    for k, v in dd.items():
        out.append((f"card / データ {k}（文字）", c["card"], v))
    for k, v in y.items():
        out.append((f"コードの地 surface / {k}", c["surface"], v))
    return out


def contrast_fails(P: dict, name: str) -> list[str]:
    return [f"{name}: {n} {a}/{b} = {ratio(a, b):.2f}:1（4.5 に届かない）" for n, a, b in pairs(P) if ratio(a, b) < 4.5]


def bridge() -> list[str]:
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
    # 書体は Bridge に同梱して配る（@fontsource-variable・名前は「<名前> Variable」・K-29）。PC に入っていれば先に使う
    L.append(f'  --font-sans: "{fam}", "{fam} Variable", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", system-ui, sans-serif;')
    L.append("}")
    return L


# ---- 新しい画面用（--k-*） ----
GROUP = {"colors": "", "syntax": "syn-", "state": "st-", "data": "d-"}
COMP_PROP = {"backgroundColor": "bg", "textColor": "fg", "border": "border", "rounded": "radius", "padding": "pad",
             # ページの型（K-217）：部品の高さ・外の余白・行の高さ。行の高さは書体の段より部品の値が勝つ
             "height": "height", "margin": "margin", "lineHeight": "lh"}


def ref(v: str) -> str:
    """{colors.primary} → var(--k-primary)。{rounded.md} → var(--k-r-md)。{spacing.lg} → var(--k-s-lg)"""
    def sub(m: re.Match) -> str:
        g, k = m.group(1), m.group(2)
        if g in GROUP:
            return f"var(--k-{GROUP[g]}{k})"
        if g == "rounded":
            return f"var(--k-r-{k})"
        if g == "spacing":
            return f"var(--k-s-{k})"
        sys.exit(f"部品の値の参照が読めない: {{{g}.{k}}}")
    return re.sub(r"\{(\w+)\.([\w-]+)\}", sub, str(v))


def palette(P: dict, ind: str) -> list[str]:
    return [f"{ind}--k-{GROUP[g]}{k}: {v};" for g in GROUP for k, v in (P.get(g) or {}).items()]


def web() -> list[str]:
    dark = d.get("dark")
    if not dark:
        sys.exit("正本に暗いテーマ（dark:）が無い（D-128.55）")
    missing = [f"{g}.{k}" for g in GROUP for k in (d.get(g) or {}) if k not in (dark.get(g) or {})]
    extra = [f"{g}.{k}" for g in GROUP for k in (dark.get(g) or {}) if k not in (d.get(g) or {})]
    if missing or extra:
        sys.exit(f"暗いテーマの色の名前が明るいテーマと合わない（無い {missing}・余り {extra}）")
    fails = contrast_fails(d, "明るい") + contrast_fails(dark, "暗い")
    if fails:
        sys.exit("コントラストが足りない（WCAG AA）:\n  " + "\n  ".join(fails))

    T = d.get("typography") or {}
    fam = T.get("body", {}).get("fontFamily", "system-ui")
    L = [f"/* {src.name} から機械生成。手で書かない（04_design/gen_tokens.py --web・K-24）。",
         "   新しい画面の部品は --k-* だけを読む。見た目は <html data-theme> で固定、無ければシステムに合わせる（D-128.55）*/",
         ":root {", "  --k-scheme: light;"]
    L += palette(d, "  ")
    for k, v in T.items():
        if "fontSize" in v:
            L.append(f"  --k-text-{k}: {v['fontSize']};")
        if "lineHeight" in v:
            L.append(f"  --k-lh-{k}: {v['lineHeight']};")
        if "fontWeight" in v:
            L.append(f"  --k-fw-{k}: {v['fontWeight']};")
    for k, v in (d.get("rounded") or {}).items():
        L.append(f"  --k-r-{k}: {v};")
    for k, v in (d.get("spacing") or {}).items():
        L.append(f"  --k-s-{k}: {v};")
    # 書体は画面と同じ所から配る（@fontsource-variable・OFL。外の宛先を CSP に足さない）。その書体の名前は「<名前> Variable」
    L.append(f'  --k-font: "{fam}", "{fam} Variable", "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", system-ui, sans-serif;')
    L.append("  --k-font-code: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;")
    # 部品の値（正本の components）。色は --k-* を参照するので、テーマを替えると部品も替わる
    for name, spec in (d.get("components") or {}).items():
        for p, v in spec.items():
            if p == "typography":
                t = re.fullmatch(r"\{typography\.([\w-]+)\}", str(v))
                if not t or t.group(1) not in T:
                    sys.exit(f"部品 {name} の書体の参照が読めない: {v}")
                tk = t.group(1)
                L.append(f"  --k-c-{name}-text: var(--k-text-{tk});")
                if "lineHeight" in T[tk] and "lineHeight" not in spec:
                    L.append(f"  --k-c-{name}-lh: var(--k-lh-{tk});")
                if "fontWeight" in T[tk]:
                    L.append(f"  --k-c-{name}-fw: var(--k-fw-{tk});")
            elif p in COMP_PROP:
                L.append(f"  --k-c-{name}-{COMP_PROP[p]}: {ref(v)};")
            else:
                sys.exit(f"部品 {name} の {p} を CSS にする決まりが無い（gen_tokens.py の COMP_PROP に足す）")
    L.append("}")
    L.append("@media (prefers-color-scheme: dark) {")
    L.append('  :root:not([data-theme="light"]) {')
    L.append("    --k-scheme: dark;")
    L += palette(dark, "    ")
    L.append("  }")
    L.append("}")
    L.append(':root[data-theme="dark"] {')
    L.append("  --k-scheme: dark;")
    L += palette(dark, "  ")
    L.append("}")
    # Tailwind の道具（bg-k-card など）も同じ変数を読む
    L.append("@theme inline {")
    for g in GROUP:
        for k in d.get(g) or {}:
            L.append(f"  --color-k-{GROUP[g]}{k}: var(--k-{GROUP[g]}{k});")
    L.append("}")
    return L


L = web() if WEB else bridge()
text = "\n".join(L) + "\n"
if CHECK:
    if not out.exists() or out.read_text(encoding="utf-8") != text:
        sys.exit(f"{out} が正本と違う。python3 04_design/gen_tokens.py{' --web' if WEB else ''} で作り直す")
    print(f"{out} は正本どおり（明るい・暗いともコントラスト AA 以上）" if WEB else f"{out} は正本どおり")
    sys.exit(0)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(text, encoding="utf-8")
print(f"{out} に {sum(1 for x in L if x.strip().startswith('--'))} 個のトークンを書いた")
