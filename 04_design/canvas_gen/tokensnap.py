"""画面の色・角丸・文字の大きさを、デザインの正本（DESIGN-kaname.md）の段に寄せる（D-128.75）。
ほとんど同じ値が何種類もあるものを 1 つにまとめる。shellfix → edwire → linkfix のあとに走る。"""
import re, glob, os
P = os.environ.get("KANAME_CANVAS") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "canvas") + "/"
COLOR = {  # 寄せる前 → 正本の値
 "#3a4453": "#4a5563", "#374151": "#4a5563", "#4a5c80": "#6b7585", "#5e6f93": "#6b7585", "#3a4e78": "#2f4b7c", "#cbd2dc": "#b8c0cc",
 "#f3f6fc": "#eef3fd", "#e6eaf2": "#eef3fd", "#c9d6ee": "#c7d7f5", "#bfd3f7": "#c7d7f5", "#93b4ee": "#c7d7f5", "#1e3a8a": "#1e40af",
 "#e6f6ea": "#e8f5ec", "#eefbf2": "#e8f5ec", "#f1faf4": "#e8f5ec", "#e3f1e7": "#e8f5ec", "#1e5a33": "#2e5b26", "#bbe5c8": "#cde8d5", "#22c55e": "#166534",
 "#fdf6ec": "#fff8ee", "#fffbf3": "#fff8ee", "#fff4e0": "#fcebd5", "#f1d9a8": "#f3d3a7", "#c9a779": "#f3d3a7",
 "#fbe4e4": "#fdecec", "#fdf3f3": "#fdecec", "#fdf5f5": "#fdecec", "#f1c4c4": "#f3c7c7", "#f0c2c2": "#f3c7c7", "#e8a5a5": "#f3c7c7", "#e3a9a9": "#f3c7c7", "#8f1d1d": "#991b1b",
 "#e2d6f3": "#e9e0f5", "#f1ecf9": "#edeaf6", "#f5f1fb": "#edeaf6", "#f7f3fc": "#edeaf6", "#e3f1ef": "#cfeae7",
}
RADIUS = {"2": "4", "3": "4", "7": "6", "9": "8", "14": "12", "99": "9999"}
# 22px・26px（題）は正本の h1 の 20px に寄せる（正本に 24px の段は無い。文字の大きさだけを寄せ、行の高さは替えない・K-254）
SIZE = {"8": "10", "9": "10", "17": "18", "19": "18", "21": "20", "22": "20", "26": "20"}
def run():
    n = 0
    for path in sorted(glob.glob(P + "*.dc.html")):
        s = open(path, encoding="utf-8").read(); o = s
        s = re.sub(r"#[0-9a-fA-F]{6}\b", lambda m: COLOR.get(m.group(0).lower(), m.group(0)), s)
        s = re.sub(r"(border-radius:\s*)([\d px]+?px)(?=[;\"])", lambda m: m.group(1) + re.sub(r"(\d+)px", lambda k: RADIUS.get(k.group(1), k.group(1)) + "px", m.group(2)), s)
        s = re.sub(r"(font-size:\s*)(\d+)px", lambda m: m.group(1) + SIZE.get(m.group(2), m.group(2)) + "px", s)
        if s != o: open(path, "w", encoding="utf-8").write(s); n += 1
    return n
if __name__ == "__main__": print("寄せた画面:", run())
