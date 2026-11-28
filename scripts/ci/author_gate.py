#!/usr/bin/env python3
"""コミットの名義（author のメール）が、配る側のチームの物でなければ赤（K-206）。

  python3 scripts/ci/author_gate.py --base-ref <比べる元> [--config <設定>]

見るのは `git log <比べる元>..HEAD` の全部（取り込みのコミットも、取り込みで入ってきた側も）の author のメールだけ。
committer・名義の名前は見ない。`.mailmap` は効かせない（コミットに書いてある名義そのもの）。
最後の「@」の後ろ全部が、設定（既定は台本の隣の author_gate.json）の allowed_domains のどれかと同じなら合う
（大文字小文字は同じと見る。似せたドメイン・下の階のドメイン・「@」の無い名義は合わない）。

出力には、メールの「@」の前と名義の名前を出さない（CI の記録に残る）。
どの赤も、訳を出して終わりの値 1 で返す（Traceback で落とさない）。git は今いるフォルダで読む。
"""
from __future__ import annotations

import argparse
import json
import pathlib
import re
import subprocess
import sys

HERE = pathlib.Path(__file__).resolve().parent
CONFIG_NAME = "author_gate.json"
DOMAIN_SHOWN_MAX = 80                       # 出すドメインはここで切る
UNSAFE_IN_DOMAIN = re.compile(r"[^A-Za-z0-9.-]")   # 出すときに「?」に替える文字（制御の文字・GitHub Actions の命令の形を出さない）
SHORT_SHA = 7


class GateError(Exception):
    """赤にする訳（1 行）"""


def load_domains(path: pathlib.Path) -> frozenset[str]:
    """設定のドメインの並びを小文字の集まりで返す。無い・壊れている・住所そのものが書いてあるなら GateError"""
    problem = f"設定 {CONFIG_NAME} が無い・読めない・形が違う（allowed_domains はドメインの並び。住所そのものは書かない）"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError) as e:
        raise GateError(problem) from e
    domains = data.get("allowed_domains") if isinstance(data, dict) else None
    if not isinstance(domains, list) or not domains:
        raise GateError(problem)
    if not all(isinstance(d, str) and d.strip() and "@" not in d for d in domains):
        raise GateError(problem)
    return frozenset(d.strip().lower() for d in domains)


def run_git(*args: str) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(["git", *args], capture_output=True, text=True, errors="replace")
    except OSError as e:
        raise GateError(f"git が流せない（{type(e).__name__}）") from e


def authors_since(base_ref: str) -> list[tuple[str, str]]:
    """比べる元より後ろのコミットの（短い番号, author のメール）。比べる元が読めなければ GateError"""
    if not base_ref or base_ref.startswith("-"):
        raise GateError("比べる元が空か、参照の形でない（--base-ref に本線との分かれ目を渡す）")
    if run_git("rev-parse", "--verify", "-q", f"{base_ref}^{{commit}}").returncode != 0:
        raise GateError("比べる元が読めない（無い参照・無いコミット）")
    r = run_git("log", "--no-mailmap", "-z", f"--abbrev={SHORT_SHA}", "--format=%h%x09%ae", f"{base_ref}..HEAD")
    if r.returncode != 0:
        raise GateError("比べる元から HEAD までの履歴が読めない")
    rows = []
    for rec in r.stdout.split("\0"):
        rec = rec.strip("\n")
        if not rec:
            continue
        sha, _, mail = rec.partition("\t")
        rows.append((sha, mail))
    return rows


def domain_of(mail: str) -> str | None:
    """最後の「@」の後ろ全部。「@」が無ければ None"""
    return mail.rsplit("@", 1)[1] if "@" in mail else None


def shown(domain: str | None) -> str:
    """赤の文に出す形（「@」の前は出さない・ドメインは安全な文字だけ）"""
    if domain is None:
        return "「@」の無い名義"
    return "***@" + UNSAFE_IN_DOMAIN.sub("?", domain)[:DOMAIN_SHOWN_MAX]


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description="コミットの名義がチームの物でなければ赤（K-206）")
    ap.add_argument("--base-ref", required=True, help="比べる元（ここより後ろのコミットだけを見る）")
    ap.add_argument("--config", default=str(HERE / CONFIG_NAME), help="設定（既定は台本の隣）")
    a = ap.parse_args(argv)
    try:
        allowed = load_domains(pathlib.Path(a.config))
        rows = authors_since(a.base_ref)
    except GateError as e:
        print(f"★ {e}")
        print("FAIL")
        return 1
    bad = [(sha, dom) for sha, dom in ((s, domain_of(m)) for s, m in rows)
           if dom is None or dom.lower() not in allowed]
    print(f"コミット {len(rows)} 本を見た（author のメールのドメインだけ）")
    for sha, dom in bad:
        print(f"★ {sha} 名義がチームの物でない（{shown(dom)}）。`git config user.email` を確かめ、"
              "積んだコミットは名義を付け直す（git commit --amend --reset-author --no-edit）")
    print("FAIL" if bad else "OK")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
