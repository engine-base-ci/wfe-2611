#!/usr/bin/env python3
"""使っている部品が技術の選定の記録と合っているか（D-128.123・K-38）。

  python3 scripts/ci/stack_gate.py             記録（02_tech_stack/selected-stack.json の packages）と package.json を 1 対 1 で突き合わせる
  python3 scripts/ci/stack_gate.py --selftest  記録に無い部品を足すと赤になるか

赤になるもの:
  S1 package.json にあるのに記録に無い部品（足すなら、何に使うか・記録のどの選定かを書く）
  S2 記録にあるのにどこでも使っていない部品（外したら記録からも外す）
  S3 記録の「どの選定か」が記録の中に無い（register の道すじが違う・「(本文)」なのに本文に名前が無い）
  S5 部品は出てから 21 日を過ぎた版だけ（D-128.124）：pnpm-workspace.yaml に minimumReleaseAge（30240 分以上）がある。
     例外（minimumReleaseAgeExclude）の行は「名前@版」で、出た日（YYYY-MM-DD に出た）を書く。21 日を過ぎた例外は外すよう知らせる（害は無いので赤にしない）
  S6 lockfile の版が、どれも出てから 21 日を過ぎている（例外に書いた「名前@版」を除く）。出た日は npm の registry に聞く（K-44）。
     CI の pnpm install --frozen-lockfile は版を解き直さないので、pnpm の minimumReleaseAge だけでは lockfile に入った若い版を止められない
  S4 lockfile で上流が「非推奨」にした部品が、記録（scripts/ci/deprecated_baseline.json）に無い。記録の物が lockfile から消えたら記録から外す（K-41）
@types/* は、元の部品が記録にあれば要らない。workspace の部品（@kaname/*）は見ない。
"""
from __future__ import annotations
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG = os.path.join(ROOT, "02_tech_stack/selected-stack.json")
BUILTIN_TYPES = {"node"}


def deps(extra: dict[str, list[str]] | None = None) -> dict[str, list[str]]:
    out: dict[str, list[str]] = {}
    for f in ["package.json"] + sorted(glob.glob("apps/*/package.json", root_dir=ROOT)) + sorted(glob.glob("packages/*/package.json", root_dir=ROOT)):
        j = json.load(open(os.path.join(ROOT, f), encoding="utf-8"))
        for sec in ("dependencies", "devDependencies", "optionalDependencies", "peerDependencies"):
            for n, v in (j.get(sec) or {}).items():
                if str(v).startswith("workspace:"):
                    continue
                out.setdefault(n, []).append(os.path.dirname(f) or ".")
    for n, w in (extra or {}).items():
        out.setdefault(n, []).extend(w)
    return out


def resolve(reg: dict, path: str) -> bool:
    cur = reg
    for k in path.split("."):
        if not isinstance(cur, dict) or k not in cur:
            return False
        cur = cur[k]
    return True


def check(extra: dict[str, list[str]] | None = None) -> list[str]:
    reg = json.load(open(REG, encoding="utf-8"))
    pk = {k: v for k, v in (reg.get("packages") or {}).items() if not k.startswith("_") and k != "@types/*"}
    body = json.dumps({k: v for k, v in reg.items() if k != "packages"}, ensure_ascii=False).lower()
    used = deps(extra)
    fails = []
    for n, where in sorted(used.items()):
        if n.startswith("@types/"):
            base = n[len("@types/"):]
            base = "@" + base.replace("__", "/") if "__" in base else base
            if base in pk or base in BUILTIN_TYPES or base.split("-")[0] in pk:
                continue
            fails.append(f"S1 型の部品 {n} の元（{base}）が記録に無い（{', '.join(where)}）")
        elif n not in pk:
            fails.append(f"S1 記録に無い部品 {n}（{', '.join(where)}）。selected-stack.json の packages に、何に使うか・どの選定かを書く")
    for n in sorted(pk):
        if n not in used:
            fails.append(f"S2 記録にあるのに使っていない部品 {n}（外したなら packages からも外す）")
    for n, v in sorted(pk.items()):
        r = (v or {}).get("register", "")
        if r == "dev_tools":
            continue
        if r == "(本文)":
            if n.lower() not in body:
                fails.append(f"S3 {n}：「(本文)」なのに記録の本文に名前が無い")
        elif not resolve(reg, r):
            fails.append(f"S3 {n}：記録に {r} が無い")
    return fails


def deprecated(lock_text: str) -> dict[str, str]:
    """lockfile の packages の節で deprecated の印がある部品（名前@版 → 理由）"""
    import re
    i, j = lock_text.find("\npackages:\n"), lock_text.find("\nsnapshots:\n")
    sec = lock_text[i:j] if i >= 0 and j > i else ""
    out = {}
    for m in re.finditer(r"\n  '?([^\s']+)'?:\n((?:    .*\n)+)", sec):
        d = re.search(r"    deprecated: (.*)", m.group(2))
        if d:
            out[m.group(1)] = d.group(1)
    return out


def check_deprecated(lock_text: str | None = None) -> list[str]:
    lock_text = lock_text if lock_text is not None else open(os.path.join(ROOT, "pnpm-lock.yaml"), encoding="utf-8").read()
    base = json.load(open(os.path.join(ROOT, "scripts/ci/deprecated_baseline.json"), encoding="utf-8"))["entries"]
    now = deprecated(lock_text)
    fails = [f"S4 上流が非推奨にした部品 {k}（{v[:80]}）。直すか、deprecated_baseline.json にチケットつきで書く" for k, v in sorted(now.items()) if k not in base]
    fails += [f"S4 記録の {k} はもう lockfile に無い（deprecated_baseline.json から外す）" for k in sorted(base) if k not in now]
    return fails


NOTES: list[str] = []


def check_release_age(ws_text: str | None = None, today: str | None = None) -> list[str]:
    import datetime, re
    ws_text = ws_text if ws_text is not None else open(os.path.join(ROOT, "pnpm-workspace.yaml"), encoding="utf-8").read()
    today_d = datetime.date.fromisoformat(today) if today else datetime.date.today()
    fails = []
    m = re.search(r"^minimumReleaseAge:\s*(\d+)", ws_text, re.M)
    if not m or int(m.group(1)) < 30240:
        fails.append("S5 pnpm-workspace.yaml に minimumReleaseAge（30240 分＝21 日以上）が無い（D-128.124）")
    blk = re.search(r"^minimumReleaseAgeExclude:(.*?)(?=^\S|\Z)", ws_text, re.M | re.S)
    for ln in (blk.group(1).splitlines() if blk else []):
        mm = re.match(r'^\s*-\s*"?([^"\s#]+)"?\s*(#.*)?$', ln)
        if not mm:
            continue
        name, note = mm.group(1), mm.group(2) or ""
        if not re.search(r".+@\d", name):
            fails.append(f"S5 例外 {name} は「名前@版」で書く（名前だけだと、どの版でも通ってしまう）")
        d = re.search(r"(\d{4}-\d{2}-\d{2}) に出た", note)
        if not d:
            fails.append(f"S5 例外 {name} に出た日（YYYY-MM-DD に出た）が無い")
        elif datetime.date.fromisoformat(d.group(1)) + datetime.timedelta(days=21) < today_d:  # 出た日の時刻がわからないので、21 日目の翌日から知らせる
            # 過ぎた例外は、もう決まりの内側の版なので害は無い。日付だけで CI を赤にしない（知らせるだけ）
            NOTES.append(f"S5 例外 {name} は出て 21 日を過ぎた（{d.group(1)}）。minimumReleaseAgeExclude から外す")
    return fails


def lock_packages(lock: str) -> set[tuple[str, str]]:
    import re
    sec = lock[lock.index("\npackages:\n"):lock.index("\nsnapshots:\n")]
    return {(m.group(1), m.group(2)) for m in re.finditer(r"\n  '?(@?[^@\s']+)@([^\s'(:]+)", sec)}


def registry_times(names: list[str]) -> dict[str, dict]:
    import concurrent.futures, ssl, urllib.parse, urllib.request
    ca = os.environ.get("SSL_CERT_FILE") or ("/root/.ccr/ca-bundle.crt" if os.path.exists("/root/.ccr/ca-bundle.crt") else None)
    ctx = ssl.create_default_context(cafile=ca)

    def one(name: str) -> tuple[str, dict]:
        u = "https://registry.npmjs.org/" + urllib.parse.quote(name, safe="@")
        err = ""
        for _ in range(3):
            try:
                with urllib.request.urlopen(urllib.request.Request(u, headers={"accept": "application/json"}), context=ctx, timeout=60) as r:
                    return name, json.load(r).get("time", {})
            except Exception as e:  # 引けなければ赤にする（黙って通さない）
                err = str(e)
        return name, {"_err": err}

    with concurrent.futures.ThreadPoolExecutor(16) as ex:
        return dict(ex.map(one, names))


def excluded(ws_text: str) -> set[str]:
    import re
    blk = re.search(r"^minimumReleaseAgeExclude:(.*?)(?=^\S|\Z)", ws_text, re.M | re.S)
    return {m.group(1) for ln in (blk.group(1).splitlines() if blk else []) if (m := re.match(r'^\s*-\s*"?([^"\s#]+)"?', ln))}


def check_lock_age(lock: str | None = None, ws_text: str | None = None, times: dict | None = None, now: str | None = None) -> list[str]:
    import datetime
    lock = lock if lock is not None else open(os.path.join(ROOT, "pnpm-lock.yaml"), encoding="utf-8").read()
    ws_text = ws_text if ws_text is not None else open(os.path.join(ROOT, "pnpm-workspace.yaml"), encoding="utf-8").read()
    pk = lock_packages(lock)
    times = times if times is not None else registry_times(sorted({n for n, _ in pk}))
    t_now = datetime.datetime.fromisoformat(now) if now else datetime.datetime.now(datetime.timezone.utc)
    cut = t_now - datetime.timedelta(days=21)
    ex = excluded(ws_text)
    fails = []
    for n, v in sorted(pk):
        tm = times.get(n, {})
        if "_err" in tm:
            fails.append(f"S6 {n} の出た日を registry に聞けない（{tm['_err'][:80]}）")
            continue
        ts = tm.get(v)
        if not ts:
            fails.append(f"S6 {n}@{v} の出た日が registry に無い")
            continue
        d = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
        if d > cut and f"{n}@{v}" not in ex:
            fails.append(f"S6 {n}@{v} は {ts[:10]} に出て 21 日を過ぎていない（21 日を過ぎた版に解き直すか、例外に「名前@版」と出た日を書く）")
    return fails


def main() -> int:
    if "--selftest" in sys.argv:
        hit = any("kaname-selftest-pkg" in f for f in check({"kaname-selftest-pkg": ["(試験)"]}))
        fake = "\npackages:\n\n  kaname-old@1.0.0:\n    resolution: {integrity: x}\n    deprecated: 試験\n\nsnapshots:\n"
        hit4 = any("kaname-old@1.0.0" in f for f in check_deprecated(fake))
        ws = 'minimumReleaseAge: 30240\nminimumReleaseAgeExclude:\n  - "a@1.0.0"  # 2026-01-01 に出た\n  - "b"\n'
        r5 = check_release_age(ws, "2026-02-01")
        hit5 = any("a@1.0.0" in n and "過ぎた" in n for n in NOTES) and any("「名前@版」" in f for f in r5) and bool(check_release_age("x: 1\n"))
        lk = "\npackages:\n\n  young@1.0.0:\n    resolution: {integrity: x}\n\n  '@s/old@2.0.0':\n    resolution: {integrity: x}\n\nsnapshots:\n"
        tm = {"young": {"1.0.0": "2026-01-25T00:00:00Z"}, "@s/old": {"2.0.0": "2025-12-01T00:00:00Z"}}
        r6 = check_lock_age(lk, "x: 1\n", tm, "2026-02-01T00:00:00+00:00")
        r6x = check_lock_age(lk, 'minimumReleaseAgeExclude:\n  - "young@1.0.0" # 2026-01-25 に出た\n', tm, "2026-02-01T00:00:00+00:00")
        hit6 = len(r6) == 1 and "young@1.0.0" in r6[0] and r6x == []
        ok = hit and hit4 and hit5 and hit6
        print("PASS — 記録に無い部品・記録に無い非推奨・21 日の決まりの外れ・lockfile の若い版を見つけた" if ok else "FAIL — 見つけられない")
        return 0 if ok else 1
    fails = check() + check_deprecated() + check_release_age() + check_lock_age()
    for n in NOTES:
        print("  note", n)
    for f in fails:
        print("  ★", f)
    n = len(deps())
    print(f"部品 {n} 個（型の部品を含む）")
    print("FAIL — 部品と技術の選定の記録が合わない" if fails else "PASS — 使っている部品は全部、技術の選定の記録にある（非推奨は記録どおり）")
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
