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
  S6 の出た日は記録（scripts/ci/lock_dates.json：lockfile の sha256・聞いた日・名前@版 → 出た日）から答え、lockfile の sha が違うときだけ
     記録に無い名前@版の名前を registry に聞く（K-156）。21 日の判定はいつも今日の日付で（記録を書いた日では判定しない・D-128.124）
  S7 CI の中（環境 CI）で記録が lockfile と合わない（部品を上げた・消した枝で記録を直していない）。registry に聞いて判定したうえで赤にする。
     手元では赤にせず記録を書き直す（聞く名前が無くても・部品を消しただけでも sha と行を直す・D-133.1）
  S8 CI の中で、比べる元（--base-ref・取り込む先との分かれ目）の記録から足した・変えた行の出た日が registry と違う（記録を手で書き換えた）。
     足した・変えた行の名前だけを registry に聞き直す（比べる元に記録が無ければ全部の行・K-156 のテスター Q の指摘）
@types/* は、元の部品が記録にあれば要らない。workspace の部品（@kaname/*）は見ない。
"""
from __future__ import annotations
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG = os.path.join(ROOT, "02_tech_stack/selected-stack.json")
LOCK_DATES = os.path.join(ROOT, "scripts/ci/lock_dates.json")
LOCK_DOC = ("部品の出た日の記録（K-156・D-133.1）。stack_gate.py の S6 が読む。lockfile の sha256 が変わったときだけ、無い名前@版を "
            "registry に聞いて書き直す（手元で python3 scripts/ci/stack_gate.py を流してコミットする）。CI は記録が lockfile と合わなければ赤（S7）")
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


def lock_sha(lock_text: str) -> str:
    import hashlib
    return hashlib.sha256(lock_text.encode("utf-8")).hexdigest()


def _valid_record(record) -> bool:
    return (isinstance(record, dict) and isinstance(record.get("lockfile_sha256"), str)
            and isinstance(record.get("dates"), dict) and all(isinstance(v, str) for v in record["dates"].values()))


def lock_age(lock: str, ws_text: str, record, fetch, now: str | None = None, in_ci: bool = False) -> tuple[list[str], dict, list[str]]:
    """(赤の文, 書く記録, registry に聞いた名前)。記録の sha が lockfile と同じなら聞かない（K-156）。判定は now で"""
    import datetime
    pk = lock_packages(lock)
    keys = {f"{n}@{v}" for n, v in pk}
    sha = lock_sha(lock)
    t_now = datetime.datetime.fromisoformat(now) if now else datetime.datetime.now(datetime.timezone.utc)
    errs: dict[str, str] = {}
    if _valid_record(record) and record["lockfile_sha256"] == sha:
        dates, out, asked = dict(record["dates"]), record, []
    else:
        kept = {k: v for k, v in (record["dates"].items() if _valid_record(record) else []) if k in keys}
        asked = sorted({n for n, v in pk if f"{n}@{v}" not in kept})
        got = fetch(asked) if asked else {}
        dates = dict(kept)
        for n in asked:
            tm = got.get(n) or {}
            if "_err" in tm:
                errs[n] = str(tm["_err"])
                continue
            for name, v in pk:
                if name == n and v in tm:
                    dates[f"{n}@{v}"] = tm[v]
        out = {"_doc": LOCK_DOC, "lockfile_sha256": sha, "asked_on": t_now.date().isoformat(), "dates": dict(sorted(dates.items()))}
    cut = t_now - datetime.timedelta(days=21)
    ex = excluded(ws_text)
    fails = []
    for n, v in sorted(pk):
        key = f"{n}@{v}"
        if key not in dates:
            fails.append(f"S6 {n} の出た日を registry に聞けない（{errs[n][:80]}）" if n in errs else f"S6 {key} の出た日が registry に無い")
            continue
        d = datetime.datetime.fromisoformat(dates[key].replace("Z", "+00:00"))
        if d > cut and key not in ex:
            fails.append(f"S6 {key} は {dates[key][:10]} に出て 21 日を過ぎていない（21 日を過ぎた版に解き直すか、例外に「名前@版」と出た日を書く）")
    if in_ci and record is not out:
        fails.append("S7 記録 scripts/ci/lock_dates.json が lockfile と合わない（部品を変えた枝で記録を直していない）。"
                     "手元で python3 scripts/ci/stack_gate.py を流して記録をコミットする（D-133.1）")
    return fails, out, asked


def verify_changed(record: dict, base_record, fetch) -> tuple[list[str], list[str]]:
    """(赤の文, 聞いた名前)。比べる元の記録から足した・変えた行だけ、出た日を registry に聞き直す（記録の手での書き換えを止める・S8）"""
    base_dates = base_record["dates"] if _valid_record(base_record) else {}
    changed = sorted(k for k, v in record["dates"].items() if base_dates.get(k) != v)
    names = sorted({k.rpartition("@")[0] for k in changed})
    got = fetch(names) if names else {}
    fails = []
    for k in changed:
        n, _, v = k.rpartition("@")
        tm = got.get(n) or {}
        if "_err" in tm:
            fails.append(f"S8 {k} の出た日を registry に聞き直せない（{str(tm['_err'])[:80]}）")
        elif tm.get(v) != record["dates"][k]:
            fails.append(f"S8 {k} の記録の出た日 {record['dates'][k][:10]} が registry の {str(tm.get(v))[:10]} と違う"
                         "（記録を手で書き換えない。python3 scripts/ci/stack_gate.py を流して書き直す）")
    return fails, names


def base_record(base: str):
    """比べる元の版の記録（無い・読めないなら None）"""
    import re, subprocess
    if not re.fullmatch(r"[0-9a-f]{40}", base or ""):
        return None
    r = subprocess.run(["git", "-C", ROOT, "show", f"{base}:scripts/ci/lock_dates.json"], capture_output=True, text=True)
    try:
        return json.loads(r.stdout) if r.returncode == 0 else None
    except ValueError:
        return None


def _load_record():
    try:
        return json.load(open(LOCK_DATES, encoding="utf-8"))
    except (OSError, ValueError):
        return None


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
    lock = open(os.path.join(ROOT, "pnpm-lock.yaml"), encoding="utf-8").read()
    ws_text = open(os.path.join(ROOT, "pnpm-workspace.yaml"), encoding="utf-8").read()
    in_ci = bool(os.environ.get("CI"))
    base = sys.argv[sys.argv.index("--base-ref") + 1] if "--base-ref" in sys.argv[:-1] else ""
    rec = _load_record()
    fails6, record, asked = lock_age(lock, ws_text, rec, registry_times, in_ci=in_ci)
    stale = record is not rec
    if stale and not in_ci:
        with open(LOCK_DATES, "w", encoding="utf-8") as fh:
            json.dump(record, fh, ensure_ascii=False, indent=1)
            fh.write("\n")
        print(f"  note S6 記録 scripts/ci/lock_dates.json を直した（{len(asked)} 件を registry に聞いた）。コミットする")
    elif not stale:
        print("  note S6 記録 scripts/ci/lock_dates.json から答えた（registry に聞いていない）")
    if in_ci and _valid_record(rec):
        fails8, names8 = verify_changed(rec, base_record(base), registry_times)
        fails6 += fails8
        print(f"  note S8 比べる元（{base[:10] or 'なし'}）の記録から足した・変えた行の名前 {len(names8)} 件を registry に聞き直した")
    fails = check() + check_deprecated() + check_release_age() + fails6
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
