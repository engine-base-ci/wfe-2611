#!/usr/bin/env python3
"""ticket_rows_gate.py（Kaname の写し・K-146。元はスキル ticket-planning の scripts/ticket_rows_gate.py。CI の容れ物にスキルの置き場が無いので写して持つ・直すときはスキルと両方）— チケットの分岐と状態の表を、切る時点で「決まっているか」で照らす（2026-11-08・決める人の決定）。

由来：K-62・K-144 の実装の途中で、決める人に聞くことが 4 つ出た。どれもチケットを切る時点で出るべきだった
（決める人：「チケットの時点で実装の設計とかはちゃんと組むはず、その時に気づくはず」）。そのうち 2 つは表の形で拾えた：
  ・状態「消した」のマスの期待結果が「読む口を開いたら片付ける」だけで、読めるか読めないかが書かれていなかった
  ・「AI が許可を求めた」の行の期待結果が「本人が答える」なのに、答える口は「K-61 から切る」と別のチケットに回していた。
    このチケットの動作の中で起きるのに、答える口ができるまでの間に何が起きるかが、どこにも無かった
欄が埋まっているかだけを見る検査は、どちらも通していた。

  K13 曖昧な期待結果：結果の欄が「扱う・処理する・片付ける・対応する・適切に・考慮する・検討」などの、
      起きることを言わない言葉だけで、観察できる結果（状態コード・画面に出る文「…」・行・件・段・表示・出る・返す・
      残る・消える・増えない・変わらない・入る・戻る・止まる・断る・赤・緑 など）が 1 つも無い行は赤
  K14 別のチケットに回した機能の「間」：同じ行の受け持ち・テストの欄が別のチケットに回していて
      （「K-… から切る」「後のチケット」「別のチケット」「… で作る予定」「まだ無い」）、このチケットのテストの行 ID も
      「このチケットでは」「… までは」「間は」の書き方も無い行は赤。別のチケットの受け持ちのマスは「K-63」のように
      チケットの番号だけを書けば通る（回したのではなく、その状態をそのチケットが持つ）

  python3 ticket_rows_gate.py <チケットの md>... [--prefix K62]   # --prefix はこのチケットの試験の行 ID の頭（無ければ番号から作る）
  python3 ticket_rows_gate.py --selftest
見る表：見出しに「結果」（または「期待結果」）の列がある表。行の欄は Markdown の表（| で区切る・\\| はそのまま）。
"""
import argparse, pathlib, re, sys

VAGUE = re.compile(r'扱う|扱い|処理する|処理|片付け|片づけ|対応する|対応|適切|よしなに|うまく|考慮|検討|確認する|見る|ハンドリング|handle', re.I)
OBSERVABLE = re.compile(
    r'\b[1-5]\d\d\b|「[^」]+」|"[^"]+"|`[^`]+`|E-[A-Z]+-\d+|'
    r'行|件|列|段|版|表示|出る|出す|出ない|出さない|返す|返る|返らない|残る|残す|消える|消す|増え|減る|変わら|変わる|入る|入れ|戻る|戻す|'
    r'止まる|止める|断る|断り|拒否|赤|緑|成功|失敗|通る|通らない|届く|届かない|開く|閉じる|移る|遷移|押せ|書く|書かない|読め|読めない|'
    r'見えない|見える|呼ばない|呼ぶ|作る|作らない|待つ|続ける|終わる|done|null|true|false', re.I)
DEFER = re.compile(r'から切る|後のチケット|あとのチケット|別のチケット|で作る予定|まだ無い|まだない|後で作る|あとで作る|将来')
INTERIM = re.compile(r'このチケットでは|までは|までの間|間は|それまで')


def split_row(line):
    body = line.strip()
    body = body[1:] if body.startswith('|') else body
    body = body[:-1] if body.endswith('|') and not body.endswith('\\|') else body
    return [c.strip() for c in re.split(r'(?<!\\)\|', body)]


def tables(text):
    """(見出しの列, [(行番号, 欄)]) を返す"""
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        if lines[i].lstrip().startswith('|') and i + 1 < len(lines) and re.match(r'^\s*\|?\s*:?-{2,}', lines[i + 1]):
            head = split_row(lines[i])
            rows = []
            j = i + 2
            while j < len(lines) and lines[j].lstrip().startswith('|'):
                rows.append((j + 1, split_row(lines[j])))
                j += 1
            yield head, rows
            i = j
        else:
            i += 1


def check_text(text, prefix, name='(text)'):
    fails = []
    for head, rows in tables(text):
        rcol = next((k for k, h in enumerate(head) if h in ('結果', '期待結果', '期待する結果')), None)
        if rcol is None:
            continue
        for ln, cells in rows:
            if len(cells) <= rcol:
                continue
            res = cells[rcol]
            other = ' '.join(c for k, c in enumerate(cells) if k != rcol)
            whole = ' '.join(cells)
            if res and res not in ('—', '-', 'ー') and VAGUE.search(res) and not OBSERVABLE.search(res):
                fails.append(('K13', f'{name}:{ln} 結果「{res[:60]}」が起きることを言っていない（状態コード・画面の文・行や段の変化を書く）'))
            if DEFER.search(other) and not re.search(rf'\b{re.escape(prefix)}-[A-Z]+-\d+', whole) and not INTERIM.search(whole):
                fails.append(('K14', f'{name}:{ln} 別のチケットに回した機能の行に、このチケットの間の振る舞い（行 ID か「…までは」）が無い：「{whole[:80]}」'))
    return fails


def prefix_of(path, text):
    m = re.search(r'^id:\s*K-(\d+)', text, re.M) or re.search(r'K-(\d+)', pathlib.Path(path).stem)
    return f'K{m.group(1)}' if m else 'K'


def selftest():
    bad = """id: K-62
| 対象の状態 | 入口 | 利用者の状態 | 結果 | 受け持ち | テスト |
|---|---|---|---|---|---|
| 消した | 読む口 | 直せる人 | 読む口を開いたときに片付ける | このチケット | — |
| 確認待ち | AI が聞いた | 押した人 | 本人が答える | 許可に答える（askFromBridge・K-61 から切る） | — |
| 承認待ち | 画面 | 担当者 | — | K-63 | — |
"""
    good = """id: K-62
| 対象の状態 | 入口 | 利用者の状態 | 結果 | 受け持ち | テスト |
|---|---|---|---|---|---|
| 消した | 読む口 | 直せる人 | 404。中身も実行の id も出さない | このチケット | K62-API-068 |
| 確認待ち | AI が聞いた | 押した人 | 答える口ができるまでは断る（実行しない） | このチケット。本人が答える形は K-61 から切る | K62-BRG-017 |
| 承認待ち | 画面 | 担当者 | 承認の帯を出す | K-63 | — |
"""
    fb = check_text(bad, 'K62')
    assert [g for g, _ in fb] == ['K13', 'K14'], fb
    fg = check_text(good, 'K62')
    assert fg == [], fg
    print('ticket_rows_gate selftest OK')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('files', nargs='*')
    ap.add_argument('--prefix')
    ap.add_argument('--selftest', action='store_true')
    a = ap.parse_args()
    if a.selftest:
        selftest()
        return 0
    fails = []
    for f in a.files:
        t = pathlib.Path(f).read_text(encoding='utf-8')
        fails += check_text(t, a.prefix or prefix_of(f, t), f)
    if fails:
        print(f'FAIL — {len(fails)} 件（切る時点で決める・決める人に聞くことは聞く）')
        for g, m in fails:
            print(f'  [{g}] {m}')
        return 2
    print(f'PASS — K13・K14（{len(a.files)} 枚）')
    return 0


if __name__ == '__main__':
    sys.exit(main())
