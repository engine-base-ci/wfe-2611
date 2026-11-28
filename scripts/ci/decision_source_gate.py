#!/usr/bin/env python3
"""decision_source_gate.py（Kaname の写し・K-103・G60。元は ~/.claude/skills/ai-team-delivery/scripts/gates/decision_source_gate.py。CI の容れ物にスキルの置き場が無いので写して持つ）— 決定ログの「決める人の決定」の行が、決める人への問い合わせの答えの記録と結びつくかを照らす
（2026-11-08・監査 H-2・H-3・L-014。プロジェクトの trace_gate に入れる検査の例）。

由来：PM が決めたことを、決める人の決定の行の本文に書き足していた（行の終わりは決める人の答えの時刻のまま）。
決める人が本当にそう答えたかを確かめる道が無かった。

  python3 decision_source_gate.py --log docs/decisions/decision-log.md --answers docs/decisions/decider-answers.jsonl \\
      [--label '決める人の決定'] [--pm-label 'PM の判断']
  python3 decision_source_gate.py --selftest

決める（行ごと）：
  - 「決める人の決定」（--label）と書いた行は answer=<番号> を持ち、その番号が答えの記録（decider_log.py が書く jsonl）にある
  - answer=<番号> の答えの日付と、行に書いた日付（YYYY-MM-DD があれば）が同じ
  - 1 つの行に PM の判断（--pm-label）と決める人の決定の両方を書かない（分けて書く。PM の判断は pm-decisions-<日付>.md へ）
「決める人の決定」の印の無い行は見ない（決める人の決定と書くものだけを照らす）。
--since D-130 を付けると、行の先頭の決定の番号がそれ以降の行だけを見る（入れる前の行を赤にしない。入れた日から始める）。
"""
import argparse, json, pathlib, re, sys, tempfile

ANS = re.compile(r'answer=([0-9a-f]{12})')
DID = re.compile(r'D-(\d+(?:\.\d+)*)')


def did_key(s):
    m = DID.search(s or '')
    return tuple(int(x) for x in m.group(1).split('.')) if m else None
DATE = re.compile(r'(20\d\d-\d\d-\d\d)')


def load_answers(p):
    out = {}
    p = pathlib.Path(p)
    if not p.exists():
        return out
    for line in p.read_text(encoding='utf-8').splitlines():
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if r.get('id'):
            out[r['id']] = r
    return out


def check(log_text, answers, label='決める人の決定', pm_label='PM の判断', since=None):
    bad = []
    lo = did_key(since) if since else None
    for i, line in enumerate(log_text.split('\n'), 1):
        if label not in line:
            continue
        if lo is not None:
            k = did_key(line)
            if k is None or k < lo:
                continue
        if pm_label and pm_label in line:
            bad.append(f'{i} 行：PM の判断と決める人の決定が 1 つの行にある（分けて書く。PM の判断は pm-decisions-<日付>.md）')
        ids = ANS.findall(line)
        if not ids:
            bad.append(f'{i} 行：「{label}」なのに answer=<番号> が無い（決める人への問い合わせの答えの記録と結ぶ）')
            continue
        for rid in ids:
            r = answers.get(rid)
            if not r:
                bad.append(f'{i} 行：answer={rid} が答えの記録に無い')
                continue
            d = DATE.findall(line)
            if d and str(r.get('at', ''))[:10] not in d:
                bad.append(f'{i} 行：行の日付 {d} と answer={rid} の答えの日付 {str(r.get("at", ""))[:10]} が違う')
    return bad


def selftest():
    ok = True
    ans = {'0123456789ab': {'id': '0123456789ab', 'at': '2026-11-07T10:03:00+09:00'}}
    cases = [
        ('答えと結ぶ行は通る', '- D-129.1 受け持ちはそのチケットで直す（2026-11-07 決める人の決定 answer=0123456789ab）', 0),
        ('印の無い決める人の決定は赤', '- D-129.2 帯を広げる（2026-11-07 決める人の決定）', 1),
        ('記録に無い番号は赤', '- D-129.3 x（決める人の決定 answer=ffffffffffff）', 1),
        ('日付が違えば赤', '- D-129.4 x（2026-11-06 決める人の決定 answer=0123456789ab）', 1),
        ('PM の判断と混ぜると赤', '- D-129.5 x（決める人の決定 answer=0123456789ab・PM の判断で実行の間も）', 1),
        ('決める人の決定と書かない行は見ない', '- 作り方のメモ', 0),
        ('--since より前の行は見ない', '- D-128.9 x（決める人の決定）', 0)]
    for name, text, want in cases:
        got = len(check(text, ans, since='D-129' if 'since' in name else None))
        print(f'  {"OK" if got == want else "NG"}  {name}')
        ok &= got == want
    print('selftest PASS' if ok else 'selftest FAIL')
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--log', action='append', default=[], help='決定ログ（Markdown・何度でも）')
    ap.add_argument('--answers', help='decider_log.py が書いた答えの記録（jsonl）')
    ap.add_argument('--label', default='決める人の決定')
    ap.add_argument('--pm-label', default='PM の判断')
    ap.add_argument('--since', help='この決定の番号より後の行だけを見る（例 D-130）')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if not a.log or not a.answers:
        ap.error('--log と --answers が要る')
    answers = load_answers(a.answers)
    bad = []
    for lp in a.log:
        bad += [f'{lp}:{x}' for x in check(pathlib.Path(lp).read_text(encoding='utf-8'), answers, a.label, a.pm_label, a.since)]
    for x in bad:
        print('  ★ ' + x)
    print('PASS —決める人の決定の行は、どれも答えの記録と結びつく' if not bad else f'FAIL — {len(bad)} 件')
    return 0 if not bad else 1


if __name__ == '__main__':
    sys.exit(main())
