#!/usr/bin/env python3
"""pipeline-next.py — スキルの連動を機械で判定する（正本: skill-pipeline.yaml）。

  python3 scripts/ci/pipeline-next.py                 # 成果物の有無で「次に起動するスキル」を出す（done_when は --run で実行）
  python3 scripts/ci/pipeline-next.py --run           # done_when も実際に回して判定する（時間がかかる）
  python3 scripts/ci/pipeline-next.py mark S05 skip --reason "…"   # 明示の done / skip（理由必須）
  python3 scripts/ci/pipeline-next.py check-spec-sync # 直近の spec-sync（.qa/spec-sync/<日付>/result.json）が PASS で、正本（決定ログ）より新しい
  python3 scripts/ci/pipeline-next.py check-staging   # selected-stack.json の environments.staging が確定している

由来：12 のスキルが「完了時に pipeline-next.py を走らせる」と書いていたのに、スクリプトはどこにも無かった（2026-10-20・Kaname）。
散文の指示は飛ばせる（L-004）。ここに実物を置く。
"""
from __future__ import annotations
import argparse, glob, json, os, subprocess, sys, datetime
try:
    import yaml
except ImportError:  # pragma: no cover
    print("pyyaml が要る: pip install pyyaml"); sys.exit(2)

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(ROOT)

def load_pipeline(path: str | None):
    for cand in [path, "skill-pipeline.yaml", os.path.expanduser("~/.claude/rules/common/skill-pipeline.yaml")]:
        if cand and os.path.exists(cand):
            return yaml.safe_load(open(cand, encoding="utf-8")), cand
    print("skill-pipeline.yaml が無い"); sys.exit(2)

def exists_any(p: str) -> bool:
    return bool(glob.glob(p)) or os.path.exists(p)

def load_state(sf: str) -> dict:
    return json.load(open(sf, encoding="utf-8")) if os.path.exists(sf) else {}

def run(cmd: str) -> bool:
    env = dict(os.environ); env.setdefault("TASK", "")
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, env=env)
    return r.returncode == 0

def stage_status(st: dict, state: dict, do_run: bool) -> tuple[str, str]:
    sid = st["id"]
    if sid in state:
        return state[sid]["status"], f"明示（{state[sid].get('reason','')}）"
    prods = st.get("produces") or []
    missing = [p for p in prods if not exists_any(p)]
    if missing:
        return "todo", f"成果物が無い: {', '.join(missing)}"
    if st.get("repeat"):
        return "loop", f"繰り返しの段（{st['repeat']}）"
    if do_run and st.get("done_when"):
        ok = run(st["done_when"])
        return ("done" if ok else "red"), ("done_when 緑" if ok else f"done_when 赤: {st['done_when'][:80]}")
    return "done", ("成果物あり" + ("（done_when は --run で回す）" if st.get("done_when") else ""))

def cmd_next(a) -> int:
    P, src = load_pipeline(a.pipeline)
    state = load_state(P.get("state_file") or ".claude/state/pipeline.json")
    nxt = None
    print(f"pipeline: {src}（{len(P['stages'])} 段）")
    for st in P["stages"]:
        s, why = stage_status(st, state, a.run)
        mark = {"done": "OK", "skip": "--", "todo": "★", "red": "★", "loop": "↻"}[s]
        print(f"  {mark} {st['id']:<5} {st['skill']:<26} {s:<5} {why[:90]}")
        if nxt is None and s in ("todo", "red"):
            nxt = st
    if nxt:
        print(f"\n→ 次: {nxt['skill']}（{nxt['id']} {nxt.get('title','')}）"
              + ("（skip 可）" if nxt.get("optional") else ""))
        return 1
    print("\n→ 次: 繰り返しの段（S14 jit-task-execution ／ S15 e2e ／ S16 human-grade-qa）を波の順に")
    return 0

def cmd_mark(a) -> int:
    if a.status not in ("done", "skip"):
        print("status は done か skip"); return 2
    if not a.reason:
        print("理由（--reason）が要る。理由なしの done / skip は書けない"); return 2
    P, _ = load_pipeline(a.pipeline)
    sf = P.get("state_file") or ".claude/state/pipeline.json"
    os.makedirs(os.path.dirname(sf), exist_ok=True)
    state = load_state(sf)
    state[a.stage] = {"status": a.status, "reason": a.reason, "at": datetime.date.today().isoformat()}
    json.dump(state, open(sf, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"{a.stage} を {a.status} にした（{a.reason}）→ {sf}"); return 0

def cmd_check_spec_sync(a) -> int:
    runs = sorted(glob.glob(".qa/spec-sync/*/result.json"))
    if not runs:
        print("FAIL — spec-sync の結果（.qa/spec-sync/<日付>/result.json）が 1 つも無い"); return 1
    latest = runs[-1]
    r = json.load(open(latest, encoding="utf-8"))
    status = str(r.get("status", ""))
    log = "01_hearing/決定ログ_進行中.md"
    stale = os.path.exists(log) and os.path.getmtime(log) > os.path.getmtime(latest) + 1
    if not status.startswith("PASS"):
        print(f"FAIL — 直近の spec-sync が PASS でない: {latest} status={status[:60]}"); return 1
    if stale:
        print(f"FAIL — 決定ログが直近の spec-sync（{latest}）より新しい。決定を足したら spec-sync を回す"); return 1
    print(f"OK — {latest}（{status[:60]}）"); return 0

def cmd_check_staging(a) -> int:
    for cand in ("02_tech_stack/selected-stack.json", "03_architecture/selected-stack.json"):
        if os.path.exists(cand):
            S = json.load(open(cand, encoding="utf-8"))
            def find_env(o):  # environments.staging はどの深さにあってもよい（Kaname は stack.environments）
                if isinstance(o, dict):
                    if isinstance(o.get("environments"), dict) and "staging" in o["environments"]:
                        return o["environments"]["staging"]
                    for v in o.values():
                        r = find_env(v)
                        if r: return r
                return None
            stg = find_env(S) or {}
            need = [k for k in ("shape", "database", "rule", "owner_task") if not stg.get(k)] if "shape" in stg else \
                   [k for k in ("provisioned_by", "data_policy", "owner") if not stg.get(k)]
            if not stg:
                print(f"FAIL — {cand} に environments.staging が無い（L1〜L3 の実走環境が決まっていない・GAP-246）"); return 1
            if need:
                print(f"FAIL — environments.staging に {need} が無い"); return 1
            print(f"OK — staging 確定（{cand}・{stg.get('decided') or stg.get('owner') or ''}）"); return 0
    print("FAIL — selected-stack.json が無い"); return 1

def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pipeline"); ap.add_argument("--run", action="store_true")
    sub = ap.add_subparsers(dest="cmd")
    m = sub.add_parser("mark"); m.add_argument("stage"); m.add_argument("status"); m.add_argument("--reason", default="")
    sub.add_parser("check-spec-sync"); sub.add_parser("check-staging")
    a = ap.parse_args()
    if a.cmd == "mark": return cmd_mark(a)
    if a.cmd == "check-spec-sync": return cmd_check_spec_sync(a)
    if a.cmd == "check-staging": return cmd_check_staging(a)
    return cmd_next(a)

if __name__ == "__main__":
    sys.exit(main())
