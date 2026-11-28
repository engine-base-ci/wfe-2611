#!/usr/bin/env python3
"""answers_merge.py（Kaname の写し・K-146。元はスキル ai-team-delivery の scripts/gates/answers_merge.py。CI の容れ物にスキルの置き場が無いので写して持つ・直すときはスキルと両方）— 決める人の答えの記録（decider_log.py が書く jsonl）を、写しで上書きせず「和」で移す・落としていないかを照らす。

由来（2026-11-08）：フックは本線の作業場所の記録に追記する。PM がそれを作業の枝へ移すとき、写し（cp）で上書きし、
枝にだけあった答え 2 件（やる順の列の承認・割り込みの答え）を落とした。決定ログの行は残ったまま、結びつく答えが消えていた。
記録は追記だけのもの（decider_log.py）。移すときも和だけにし、過去の版にあった答えが消えていたら赤にする。

  python3 answers_merge.py merge <書く先の jsonl> <読む元の jsonl>...        # id で和を取り、時刻の順に並べて書く
  python3 answers_merge.py check <jsonl> --base <git の版>[,<版>...] [--target <取り込む先の枝>] [--repo <根>]
        # その版たちのこのファイルにあった id が、今の jsonl に全部あるか（無ければ赤・どの id か出す）
        # --base が空（全部を流す回）なら --target と比べる。両方空なら赤（比べる版が無いのに緑にしない・K-146）
        # 枝の名前は手元の枝 → origin の枝（CI のまっさらな写しは clone で、取り込む先は refs/remotes/origin/<名前> にだけある）の順に引く
  python3 answers_merge.py --selftest
"""
import argparse, json, pathlib, subprocess, sys, tempfile


def read(path_or_text, is_text=False):
    text = path_or_text if is_text else (pathlib.Path(path_or_text).read_text(encoding='utf-8')
                                         if pathlib.Path(path_or_text).exists() else '')
    out = {}
    for n, line in enumerate(text.splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        try:
            d = json.loads(line)
        except json.JSONDecodeError as e:
            raise SystemExit(f'answers_merge: {path_or_text if not is_text else "(版)"}:{n} が JSON でない（{e}）')
        if 'id' not in d:
            raise SystemExit(f'answers_merge: {n} 行目に id が無い')
        out.setdefault(d['id'], (d.get('at') or '', line))
    return out


def merge(dst, srcs):
    allrec = read(dst)
    for s in srcs:
        for k, v in read(s).items():
            allrec.setdefault(k, v)
    lines = [v[1] for v in sorted(allrec.values())]
    pathlib.Path(dst).write_text(''.join(l + '\n' for l in lines), encoding='utf-8')
    return len(lines)


def resolve(ref, repo='.'):
    """ref をコミットの sha に。手元の枝 → origin の枝の順に引く。どちらにも無ければ None"""
    for cand in (ref, f'refs/remotes/origin/{ref}'):
        v = subprocess.run(['git', '-C', repo, 'rev-parse', '--verify', '--quiet', f'{cand}^{{commit}}'], capture_output=True, text=True)
        if v.returncode == 0 and v.stdout.strip():
            return v.stdout.strip()
    return None


def refs_of(base, target):
    """比べる版の並び。base が空なら target。両方空なら ValueError（比べる版が無いのに緑にしない）"""
    refs = [r for r in (base or '').split(',') if r.strip()] or [r for r in (target or '').split(',') if r.strip()]
    if not refs:
        raise ValueError('比べる版が無い（--base も --target も空）。本線と比べられないので止める')
    return [r.strip() for r in refs]


def missing(path, refs, repo='.'):
    now = set(read(path))
    rel = str(pathlib.Path(path).resolve().relative_to(pathlib.Path(repo).resolve()))
    lost = {}
    for ref in refs:
        sha = resolve(ref, repo)
        if sha is None:
            raise ValueError(f'比べる版 {ref!r} が読めない（無い ref は黙って飛ばさず赤にする）')
        p = subprocess.run(['git', '-C', repo, 'show', f'{sha}:{rel}'], capture_output=True, text=True)
        if p.returncode != 0:
            continue                       # その版にファイルが無い（まだ記録が無かった）
        for k in read(p.stdout, is_text=True):
            if k not in now:
                lost.setdefault(k, ref)
    return lost


def selftest():
    with tempfile.TemporaryDirectory() as d:
        d = pathlib.Path(d)
        a, b = d / 'a.jsonl', d / 'b.jsonl'
        a.write_text('{"id":"x1","at":"2026-11-08T08:00"}\n{"id":"x2","at":"2026-11-08T09:00"}\n', encoding='utf-8')
        b.write_text('{"id":"x3","at":"2026-11-08T08:30"}\n{"id":"x1","at":"2026-11-08T08:00"}\n', encoding='utf-8')
        assert merge(a, [b]) == 3, '和は 3 件'
        ids = [json.loads(l)['id'] for l in a.read_text().splitlines()]
        assert ids == ['x1', 'x3', 'x2'], f'時刻の順に並ぶ {ids}'
        subprocess.run(['git', 'init', '-q', str(d)], check=True)
        subprocess.run(['git', '-C', str(d), 'add', 'a.jsonl'], check=True)
        subprocess.run(['git', '-C', str(d), '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'v1'], check=True)
        a.write_text('{"id":"x1","at":"2026-11-08T08:00"}\n', encoding='utf-8')     # 写しで上書きして 2 件を落とした
        lost = missing(a, ['HEAD'], str(d))
        assert set(lost) == {'x2', 'x3'}, f'落とした 2 件を出す {lost}'
        merge(a, [b])
        assert set(missing(a, ['HEAD'], str(d))) == {'x2'}, '和で戻せるのは元にあった分だけ'
        try:
            missing(a, ['no-such-ref'], str(d))
            raise AssertionError('読めない版は赤')
        except ValueError:
            pass
        assert refs_of('', 'HEAD') == ['HEAD'], 'base が空なら target と比べる'
        assert refs_of('a,b', 'HEAD') == ['a', 'b'], 'base があれば base'
        try:
            refs_of('', '')
            raise AssertionError('両方空は赤')
        except ValueError:
            pass
    print('answers_merge selftest OK')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('cmd', nargs='?')
    ap.add_argument('paths', nargs='*')
    ap.add_argument('--base', default='')
    ap.add_argument('--target', default='')
    ap.add_argument('--repo', default='.')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        return selftest()
    if a.cmd == 'merge' and len(a.paths) >= 2:
        n = merge(a.paths[0], a.paths[1:])
        print(f'{a.paths[0]} に和を書いた（{n} 件）')
        return 0
    if a.cmd == 'check' and len(a.paths) == 1:
        try:
            lost = missing(a.paths[0], refs_of(a.base, a.target), a.repo)
        except (ValueError, json.JSONDecodeError) as e:
            print(f'FAIL — {e}')
            return 1
        if lost:
            print(f'FAIL — 前の版にあった決める人の答え {len(lost)} 件が消えている（写しで上書きした？ merge で和を取り直す）')
            for k, ref in sorted(lost.items()):
                print(f'  {k}（{ref} にあった）')
            return 1
        print('PASS — 前の版の決める人の答えは全部残っている')
        return 0
    ap.print_help()
    return 2


if __name__ == '__main__':
    sys.exit(main())
