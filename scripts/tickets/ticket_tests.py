#!/usr/bin/env python3
"""チケット 1 枚の試験だけを流す命令を出す・流す（D-128.140）。普段はこれ（数分）。全部（回帰）は取り込みの前だけ。

  python3 scripts/tickets/ticket_tests.py K-14            流す命令を説明つきで出す
  python3 scripts/tickets/ticket_tests.py K-14 --run      その命令を順に流す（前が赤なら止める）
  python3 scripts/tickets/ticket_tests.py K-14 --cmds     命令だけを 1 行ずつ出す（dagci run --ticket が ci.yaml の tickets.cmd から読む）
  python3 scripts/tickets/ticket_tests.py --selftest      命令の組み立てを、作った写しで確かめる

流すもの（持ち主の決め方は scripts/ci/test_owner_gate.py）:
  1) チケットの tests: の単体の試験（vitest。coverage は測らない：閾値は全部を流したときだけ）
  2) 口ごとの権限の試験（authz.test.ts）のうち、そのチケットの口（apis:）の行だけ（-t で口の「メソッド パス」に絞る）。
     authz.test.ts そのものを持つチケットは、口に結ばない行（契約の全体を見る行）も流す
  3) tests: の実ブラウザの試験（*.spec.ts）があれば、画面を本番の形で組み立てて立ち上げ、その試験だけ（G48 と同じ立ち上げ方）
まだ切っていないまとまり（split: これから）の試験は流さない（切ったチケットに移ってから流れる）。
"""
from __future__ import annotations
import json, os, re, shlex, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "scripts", "ci"))
import test_owner_gate as gate  # noqa: E402
from ci_stages import WEB_START  # noqa: E402

VITEST = "pnpm exec vitest run --coverage.enabled=false"
API_CASE = r"(?:" + "|".join(gate.METHODS) + r") /api/"   # 口に結ぶ権限の試験の行の名前の頭
WEB_ENV = "KANAME_DEV_PAGES=1 NEXT_PUBLIC_KANAME_DEV_PAGES=1"


def route_pattern(routes: list[tuple[str, str]]) -> str:
    """口の「メソッド パス」に続けて（ か ：が来る行だけ（/tickets と /tickets/:id を取り違えない）"""
    alts = "|".join(re.sub(r"([.^$*+?()\[\]{}|\\])", r"\\\1", f"{m} {p}") for m, p in sorted(routes))
    return f"(?:{alts})[（：]"


def plan(tid: str, tickets: list[dict], files: list[str], gen: dict[str, str | None], routes: dict[str, tuple[str, str]]) -> tuple[list[str], list[str]]:
    """（説明の行, 命令の行）"""
    by = {t["id"]: t for t in tickets}
    if tid not in by:
        raise SystemExit(f"チケット {tid} が無い（11_tickets/{tid}.md）")
    t = by[tid]
    own, _ = gate.owners(tickets, files)
    mine = sorted(f for f, k in own.items() if tid in k)
    notes = [f"# {tid} {t['title']}"]
    if t.get("split") == "これから":
        notes.append(f"# まだ切っていないまとまり：試験 {len(mine)} 本はチケットの実行に入れない（切ったチケットの tests: に移ってから流れる）")
        return notes, []
    unit = [f for f in mine if f.endswith(".test.ts") and f != gate.AUTHZ]
    specs = [f for f in mine if f.endswith(".spec.ts")]
    ops = sorted(op for f in mine if (op := gen.get(f)))
    cmds = []
    if unit:
        cmds.append(f"{VITEST} " + " ".join(shlex.quote(f) for f in unit))
    pats = []
    if gate.AUTHZ in mine:
        pats.append(f"^(?!.*{API_CASE})")   # 口に結ばない行
    if ops:
        pats.append(route_pattern([routes[o] for o in ops if o in routes]))
    if pats:
        cmds.append(f"{VITEST} {gate.AUTHZ} -t " + shlex.quote("|".join(pats)))
    if specs:
        rel = " ".join(shlex.quote(f[len(gate.WEB):]) for f in specs)
        cmds.append(f"export {WEB_ENV} && pnpm --filter @kaname/web build:test && {{ {WEB_START}; }} && "
                    f"BASE_URL=http://127.0.0.1:3124 PW_REPORT=pw-reports/ticket.json pnpm --filter @kaname/web exec playwright test {rel}")
    notes.append(f"# 単体の試験 {len(unit)} 本・口 {len(ops)} 本の権限の試験{'・契約の全体の権限の試験' if gate.AUTHZ in mine else ''}・実ブラウザの試験 {len(specs)} 本")
    if not cmds:
        notes.append("# このチケットの試験はまだ無い（作ったら tests: に書く・test_owner_gate.py が見る）")
    return notes, cmds


def load_all():
    tickets, files, gen, _ = gate.load()
    ep = json.load(open(os.path.join(ROOT, "08_api/endpoints.json"), encoding="utf-8"))["endpoints"]
    return tickets, files, gen, {e["operation_id"]: (e["method"], e["path"]) for e in ep}


def selftest() -> int:
    G = gate.GEN
    tickets = [{"id": "K-1", "title": "a", "tests": ["x/a.test.ts", gate.AUTHZ, G + "p.test.ts"], "apis": ["opP"]},
               {"id": "K-2", "title": "b", "tests": ["apps/web/tests/k/s.spec.ts"]},
               {"id": "K-3", "title": "c", "split": "これから", "tests": [G + "q.test.ts"]},
               {"id": "K-4", "title": "d"}]
    files = ["x/a.test.ts", gate.AUTHZ, G + "p.test.ts", G + "q.test.ts", "apps/web/tests/k/s.spec.ts"]
    gen = {G + "p.test.ts": "opP", G + "q.test.ts": "opQ"}
    routes = {"opP": ("GET", "/api/v1/tickets"), "opQ": ("POST", "/api/v1/tickets/:id")}
    _, c1 = plan("K-1", tickets, files, gen, routes)
    _, c2 = plan("K-2", tickets, files, gen, routes)
    _, c3 = plan("K-3", tickets, files, gen, routes)
    _, c4 = plan("K-4", tickets, files, gen, routes)
    rx = re.compile(re.search(r"-t '(.*)'$", c1[1]).group(1)) if len(c1) == 2 and "-t '" in c1[1] else None
    names = {"権限の試験：役の段 > 契約の API は全部「誰が呼べるか」を持つ": True,
             "権限の試験 > GET /api/v1/tickets（member）は anonymous を止め": True,
             "権限の試験 > GET /api/v1/tickets/:id（member）は anonymous を止め": False,
             "権限の試験 > POST /api/v1/tickets/:id：振る舞い": False}
    checks = [("K-1 は単体と口に絞った権限の試験の 2 本", len(c1) == 2 and "x/a.test.ts" in c1[0] and G + "p.test.ts" in c1[0] and gate.AUTHZ not in c1[0]),
              ("-t は自分の口と契約の全体の行だけに当たる", rx is not None and all(bool(rx.search(n)) == want for n, want in names.items())),
              ("K-2 は実ブラウザの試験を本番の形で立ち上げて流す", len(c2) == 1 and "playwright test tests/k/s.spec.ts" in c2[0] and "build:test" in c2[0]),
              ("K-3（まだ切っていない）は流さない", c3 == []),
              ("K-4（試験なし）は何も流さない", c4 == [])]
    for name, ok in checks:
        print(f"  {'緑' if ok else '★ 赤'} {name}")
    ok = all(ok for _, ok in checks)
    print("PASS — チケットの命令の組み立てが正しい" if ok else "FAIL — チケットの命令の組み立てが違う")
    return 0 if ok else 1


def main() -> int:
    if "--selftest" in sys.argv:
        return selftest()
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print(__doc__)
        return 2
    notes, cmds = plan(args[0], *load_all())
    if "--cmds" in sys.argv:
        print("\n".join(cmds))
        return 0
    print("\n".join(notes + cmds))
    if "--run" not in sys.argv:
        return 0
    for c in cmds:
        print(f"\n$ {c}", flush=True)
        r = subprocess.run(c, shell=True, cwd=ROOT, executable="/bin/bash")
        if r.returncode != 0:
            print(f"★ FAIL {args[0]} の試験が赤（終わり方 {r.returncode}）")
            return r.returncode
    print(f"PASS — {args[0]} の試験は全部緑（{len(cmds)} 本の命令）")
    return 0


if __name__ == "__main__":
    sys.exit(main())
