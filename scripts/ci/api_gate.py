#!/usr/bin/env python3
"""api_gate.py — api-design の検査（A1〜A8）。
 A1 全 endpoint に acts と screens（どこからも呼ばれない API は無い）／ A2 flow の全行為（v1）に endpoint が 1 本以上（口の無い行為は台帳 scripts/ci/api_no_endpoint_acts.json に理由と決めの番号つき・減らすだけ）／ A3 全画面の必要 API がカバー（API を呼ばない画面は台帳 STATIC_SCREENS に理由つき・static_screens.py の S1〜S4）
 A4 各 endpoint に EVENT-DRIVEN と UNWANTED が 1 件以上 ／ A5 書き込み系は choke_points が空でない ／ A6 認証ありは 401・403 を持つ
 A7 全 endpoint に source ／ A8 逆カバレッジ：内部専用でないフィールドは 1 画面以上で消費（理由なしの除外なし）
使い方: python3 api_gate.py --flow 05_flow/flow.json --dir 08_api [--ledger-base-ref <版>]"""
import argparse, json, sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent))
from static_screens import check as static_check  # noqa: E402
LEDGER = Path(__file__).resolve().parent / "api_no_endpoint_acts.json"
LEDGER_REL = "scripts/ci/api_no_endpoint_acts.json"


def no_endpoint_ledger(base_ref: str) -> dict:
    """口の無い行為の台帳を読む。行ごとに理由（15 字以上）と決めの番号（D-…）が要る。base_ref の版より行が増えたら赤（減らすだけ）"""
    import re, subprocess
    out = {"acts": {}, "fails": []}
    if not LEDGER.exists():
        return out
    acts = json.load(open(LEDGER, encoding="utf-8")).get("acts", {})
    for k, v in acts.items():
        if len(str(v.get("reason", ""))) < 15 or not any(re.match(r"^D-\d", str(x)) for x in v.get("source", [])):
            out["fails"].append(("A2", f"口の無い行為の台帳の {k} に理由（15 字以上）か決めの番号（D-…）が無い"))
    if base_ref:
        r = subprocess.run(["git", "show", f"{base_ref}:{LEDGER_REL}"], capture_output=True, text=True, cwd=LEDGER.parent.parent.parent)
        if r.returncode == 0:   # 比べる元に台帳が無い回は作る回なので増えたかを見ない
            before = set(json.loads(r.stdout).get("acts", {}))
            grown = sorted(set(acts) - before)
            if grown: out["fails"].append(("A2", f"口の無い行為の台帳が {base_ref} より増えた {grown}（減らすだけ）"))
    out["acts"] = acts
    return out


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--flow", required=True); ap.add_argument("--dir", default="08_api"); ap.add_argument("--ledger-base-ref", default=""); a = ap.parse_args()
    d = Path(a.dir); F = json.load(open(a.flow, encoding="utf-8")); EP = json.load(open(d / "endpoints.json", encoding="utf-8"))["endpoints"]
    COV = json.load(open(d / "screen-api-coverage.json", encoding="utf-8")); FC = json.load(open(d / "api-field-consumption.json", encoding="utf-8"))
    fails = []
    bad = [e["id"] for e in EP if not e.get("acts") or not e.get("screens")]
    if bad: fails.append(("A1", f"acts か screens が空の endpoint {bad}"))
    acts = [x["id"] for ph in F["backbone"] for x in ph["acts"] if x.get("release") == "v1"]
    have = {x for e in EP for x in e["acts"]}; miss = [x for x in acts if x not in have]
    led = no_endpoint_ledger(a.ledger_base_ref)
    for k, m in led["fails"]: fails.append((k, m))
    ok_acts = set(led["acts"])
    gone = sorted(x for x in ok_acts if x not in acts or x in have)   # 口ができた・v1 の外に出た行は台帳から消す
    if gone: fails.append(("A2", f"口の無い行為の台帳に、もう当たらない行（口ができた・v1 の外）が在る {gone}（台帳から消す）"))
    miss = [x for x in miss if x not in ok_acts]
    if miss: fails.append(("A2", f"endpoint の無い行為 {miss}（口の無い行為なら scripts/ci/api_no_endpoint_acts.json に理由と決めの番号つきで）"))
    # A3：API を呼ばない画面は台帳（05_flow/screen_api.py の STATIC_SCREENS）にあって S1〜S4 を満たすものだけ被覆済み（scripts/ci/static_screens.py）
    st_ok, st_fail = static_check(Path(a.flow).resolve().parent.parent, {s["id"] for s in F["screens"]})
    unc = [x for x in COV["summary"]["uncovered_screens"] if x not in st_ok]
    unc += [x for x in COV["summary"].get("static_screens", []) if x not in st_ok]   # 生成物が STATIC と言っても台帳の検査が赤なら未被覆
    if unc: fails.append(("A3", f"未カバーの画面 {sorted(set(unc))}"))
    for sid, why in st_fail: fails.append(("A3", f"API を呼ばない画面の台帳 {sid}: {why}"))
    bad = [e["id"] for e in EP if not any(x.startswith("EVENT-DRIVEN") for x in e["ears_ac_seed"]) or not any(x.startswith("UNWANTED") for x in e["ears_ac_seed"])]
    if bad: fails.append(("A4", f"EVENT-DRIVEN か UNWANTED が無い {bad}"))
    bad = [e["id"] for e in EP if e["method"] != "GET" and not e["choke_points"]]
    if bad: fails.append(("A5", f"書き込み系なのに関門が無い {bad}"))
    bad = [e["id"] for e in EP if e["auth"]["role"] != "public" and {401, 403} - {x["status"] for x in e["outputs_4xx"]}]
    if bad: fails.append(("A6", f"401/403 が無い {bad}"))
    bad = [e["id"] for e in EP if not e.get("source")]
    if bad: fails.append(("A7", f"source の無い endpoint {bad}"))
    if FC["unconsumed"]: fails.append(("A8", f"どの画面にも出ないフィールド {len(FC['unconsumed'])}: {FC['unconsumed'][:8]}"))
    print(f"endpoint {len(EP)} / 行為 {len(acts)} / 画面 {COV['summary']['total_screens']}（カバー率 {COV['summary']['coverage_rate']}）/ フィールド {len(FC['fields'])}")
    for k, m in fails: print(f"  ★ [{k}] {m}")
    print("PASS — A1〜A8 すべて緑（API 契約凍結）" if not fails else f"FAIL — {len(fails)} 件"); return 0 if not fails else 2
if __name__ == "__main__": sys.exit(main())
