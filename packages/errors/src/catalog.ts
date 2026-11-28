// 生成物（scripts/ci/errors_used.mjs gen ← 07_qa/test-specs/errors.json）。手で直さない。511 件
export interface CatalogEntry {
  id: string;
  cls: string;
  message: string;
  action: string;
  undo: boolean;
  severity: string;
  support_code: string;
  must_not: boolean;
  layers: string[];
  where: Record<string, unknown>;
}
export const CATALOG: Record<string, CatalogEntry> = {
  "E-AUTH-001": {
    "id": "E-AUTH-001",
    "cls": "auth",
    "message": "メールアドレスかパスワードが違います。あと 4 回で 15 分ロックします",
    "action": "入力し直す／パスワードを忘れた",
    "undo": false,
    "severity": "high",
    "support_code": "AUTH-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "e"
    }
  },
  "E-AUTH-002": {
    "id": "E-AUTH-002",
    "cls": "auth",
    "message": "15 分間ロックしました。15 分たってから、もう一度入ってください",
    "action": "15 分待ってから入り直す。急ぐときはパスキーかパスワードの再設定で入る",
    "undo": false,
    "severity": "critical",
    "support_code": "AUTH-002",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "e"
    }
  },
  "E-AUTH-003": {
    "id": "E-AUTH-003",
    "cls": "auth",
    "message": "リンクの期限が切れました。もう一度登録してください",
    "action": "もう一度登録する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-003",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "verify-email",
      "state": "x"
    }
  },
  "E-AUTH-004": {
    "id": "E-AUTH-004",
    "cls": "auth",
    "message": "コードが違います。認証アプリの時刻が合っているか確かめてください",
    "action": "もう一度入力する／時刻を合わせる",
    "undo": false,
    "severity": "high",
    "support_code": "AUTH-004",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "mfa-setup"
    }
  },
  "E-AUTH-005": {
    "id": "E-AUTH-005",
    "cls": "auth",
    "message": "アカウントの状態が変わったので、ログインし直してください",
    "action": "ログインへ",
    "undo": false,
    "severity": "critical",
    "support_code": "E-AUTH-005",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "account-close",
      "choke_point": "C8"
    }
  },
  "E-AUTH-006": {
    "id": "E-AUTH-006",
    "cls": "auth",
    "message": "このリンクはもう使えません。もう一度、再設定メールを送ってください",
    "action": "再設定メールを送る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-006",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "password-reset"
    }
  },
  "E-PERM-001": {
    "id": "E-PERM-001",
    "cls": "permission",
    "message": "この権限では見えません。見える範囲は代表が決めています",
    "action": "今日へ戻る／代表に頼む",
    "undo": false,
    "severity": "high",
    "support_code": "E-PERM-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goals"
    }
  },
  "E-PERM-002": {
    "id": "E-PERM-002",
    "cls": "permission",
    "message": "配分を変えられるのは部門長と代表です。提案として送れます",
    "action": "提案として送る／やめる",
    "undo": false,
    "severity": "high",
    "support_code": "E-PERM-002",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goal-allocation"
    }
  },
  "E-VAL-001": {
    "id": "E-VAL-001",
    "cls": "validation",
    "message": "やることを 1 行で書いてください（100 文字まで）",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tasks",
      "state": "a"
    }
  },
  "E-VAL-002": {
    "id": "E-VAL-002",
    "cls": "validation",
    "message": "親の目標は「円」、この目標は「件」です。変換のしかた（1 件＝いくら）を決めてください",
    "action": "変換を決める／単位を合わせる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-VAL-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goal-edit"
    }
  },
  "E-VAL-003": {
    "id": "E-VAL-003",
    "cls": "validation",
    "message": "秘密鍵の形式が違います。認証アプリの設定画面に出る 32 文字を貼ってください",
    "action": "貼り直す／秘密鍵の場所を見る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-VAL-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-VAL-004": {
    "id": "E-VAL-004",
    "cls": "validation",
    "message": "メールアドレスの形式が違います",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup"
    }
  },
  "E-NF-001": {
    "id": "E-NF-001",
    "cls": "not_found",
    "message": "この招待は取り消されています。招いた人にもう一度送ってもらってください",
    "action": "招いた人に連絡する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-NF-001",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "x"
    }
  },
  "E-NF-002": {
    "id": "E-NF-002",
    "cls": "not_found",
    "message": "この案件はもうありません（削除されたか、見える範囲が変わりました）",
    "action": "台帳へ戻る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-NF-002",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "record-detail"
    }
  },
  "E-CONF-001": {
    "id": "E-CONF-001",
    "cls": "conflict",
    "message": "このメールアドレスは既に登録されています。ログインするか、パスワードを再設定してください",
    "action": "ログイン／パスワードを再設定",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONF-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "signup",
      "state": "e"
    }
  },
  "E-CONF-002": {
    "id": "E-CONF-002",
    "cls": "conflict",
    "message": "田中さんが先にこの案件を変えました。最新を読み込んでから直してください",
    "action": "最新を読み込む／自分の変更を見る",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONF-002",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "record-detail",
      "choke_point": "C2"
    }
  },
  "E-CONF-003": {
    "id": "E-CONF-003",
    "cls": "conflict",
    "message": "この承認はもう処理されています",
    "action": "動きを見る",
    "undo": false,
    "severity": "critical",
    "support_code": "E-CONF-003",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "approvals",
      "choke_point": "C1"
    }
  },
  "E-DEP-001": {
    "id": "E-DEP-001",
    "cls": "dependency",
    "message": "行き先のないタスクが 3 件あります。目標を選ぶまで赤で残ります",
    "action": "目標を選ぶ／自主目標にする／やめる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-DEP-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tasks",
      "state": "o"
    }
  },
  "E-DEP-002": {
    "id": "E-DEP-002",
    "cls": "dependency",
    "message": "未配分が 3 件あります。配り切るまで赤で残ります",
    "action": "配分を見直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-DEP-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goals",
      "state": "u"
    }
  },
  "E-DEP-003": {
    "id": "E-DEP-003",
    "cls": "dependency",
    "message": "この目標には 4 件のタスクと 2 件の仮説が紐づいています。行き先を決めてから終えられます",
    "action": "行き先を決める／まとめて自主目標に",
    "undo": false,
    "severity": "high",
    "support_code": "E-DEP-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "goal-edit"
    }
  },
  "E-EXT-001": {
    "id": "E-EXT-001",
    "cls": "external",
    "message": "発注ナビの画面が変わり、営業社員の覚えた操作が手順 3 で止まりました。覚え直させると再開できます",
    "action": "覚え直させる／このまま止めておく",
    "undo": false,
    "severity": "high",
    "support_code": "E-EXT-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "onboard-testrun",
      "state": "x"
    }
  },
  "E-EXT-002": {
    "id": "E-EXT-002",
    "cls": "external",
    "message": "止まっている操作が 1 件あります。画面を見ながら手順を作り直します",
    "action": "覚え直しを始める",
    "undo": false,
    "severity": "medium",
    "support_code": "E-EXT-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "automation-repair",
      "state": "n"
    }
  },
  "E-EXT-003": {
    "id": "E-EXT-003",
    "cls": "external",
    "message": "セイコー様への追いメールの送信が、先方のメールサーバーの都合で失敗しました。書いたものは残っています",
    "action": "もう一度送る／別の宛先で送る／やめる",
    "undo": false,
    "severity": "high",
    "support_code": "E-EXT-003",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x",
      "choke_point": "C6"
    }
  },
  "E-EXT-004": {
    "id": "E-EXT-004",
    "cls": "external",
    "message": "発注ナビで本人確認（CAPTCHA）が出たので止めました。あなたが一度通すと、続きから動きます",
    "action": "自分で通しに行く／あとで",
    "undo": false,
    "severity": "critical",
    "support_code": "E-EXT-004",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "onboard-testrun"
    }
  },
  "E-CONN-001": {
    "id": "E-CONN-001",
    "cls": "connectivity",
    "message": "まだつながっていません。Bridge を開いたら、この画面が自分で気づきます",
    "action": "Bridge を開く／入れる（接続を確かめる を押してもよい）",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-001",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "ng"
    }
  },
  "E-CONN-002": {
    "id": "E-CONN-002",
    "cls": "connectivity",
    "message": "あなたのPCが閉じているので、いまは動けません。ここで言ったことは溜めておいて、PC が起きたときに順に片づけます",
    "action": "PC を起こす／PC の状態を見る（書いたことは起きたら順に送る）",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x"
    }
  },
  "E-CONN-003": {
    "id": "E-CONN-003",
    "cls": "connectivity",
    "message": "インターネットにつながっていません。つながると自動で続きます",
    "action": "もう一度",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CONN-003",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "today"
    }
  },
  "E-CONN-004": {
    "id": "E-CONN-004",
    "cls": "connectivity",
    "message": "自動実行を止めています。理由：発注ナビの画面が変わり、営業社員の覚えた操作が途中で止まりました",
    "action": "覚え直させる／このまま止めておく",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "today",
      "state": "s"
    }
  },
  "E-GATE-001": {
    "id": "E-GATE-001",
    "cls": "gate",
    "message": "外に出るので承認待ちに入れました。中身を見てから押してください",
    "action": "承認カードを開く",
    "undo": false,
    "severity": "critical",
    "support_code": "E-GATE-001",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "approvals",
      "choke_point": "C1"
    }
  },
  "E-GATE-002": {
    "id": "E-GATE-002",
    "cls": "gate",
    "message": "この操作は「しない」に設定されています。設定を変えるとできます",
    "action": "設定を見る",
    "undo": false,
    "severity": "high",
    "support_code": "E-GATE-002",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "policies",
      "choke_point": "C1"
    }
  },
  "E-GATE-003": {
    "id": "E-GATE-003",
    "cls": "gate",
    "message": "LINE は自動操作が禁じられているので、AI社員は送れません。下書きまで作るので、あなたが送ってください",
    "action": "下書きを作らせる／やめる",
    "undo": false,
    "severity": "critical",
    "support_code": "E-GATE-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials",
      "choke_point": "C1"
    }
  },
  "E-GATE-004": {
    "id": "E-GATE-004",
    "cls": "gate",
    "message": "値引きに応じるかは私では決められません。判断の材料と選択肢を出すので選んでください",
    "action": "値引きしない／1 割まで／私が直接返す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GATE-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-thread",
      "state": "a"
    }
  },
  "E-GATE-005": {
    "id": "E-GATE-005",
    "cls": "gate",
    "message": "この宛先は会社の外です。外に送るには代表の承認が要ります",
    "action": "承認を頼む／やめる",
    "undo": false,
    "severity": "critical",
    "support_code": "E-GATE-005",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members",
      "choke_point": "C1"
    }
  },
  "E-SIG-001": {
    "id": "E-SIG-001",
    "cls": "no_signal",
    "message": "営業社員の実行が結果を返さずに終わりました。完了とは見なしていません",
    "action": "もう一度やらせる／動きを見る",
    "undo": false,
    "severity": "high",
    "support_code": "E-SIG-001",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ai-activity",
      "choke_point": "C5"
    }
  },
  "E-SIG-002": {
    "id": "E-SIG-002",
    "cls": "no_signal",
    "message": "ここで止まりました。Claude Code が何も返さずに終わりました",
    "action": "続けるなら「続けて」と書いて送る／ほかのことならそのまま書く（ボタンは置かない）",
    "undo": false,
    "severity": "medium",
    "support_code": "E-SIG-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "stp"
    }
  },
  "E-LIM-001": {
    "id": "E-LIM-001",
    "cls": "limit",
    "message": "エントリーで作れる AI社員は 3 体までです。プランを変えると増やせます",
    "action": "プランを見る／既存を整理する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-LIM-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "ai-staff"
    }
  },
  "E-LIM-002": {
    "id": "E-LIM-002",
    "cls": "limit",
    "message": "このファイルは大きすぎます（50MB まで）。分けるか、圧縮してください",
    "action": "別のファイルを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-LIM-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "f",
      "choke_point": "C4"
    }
  },
  "E-LIM-003": {
    "id": "E-LIM-003",
    "cls": "limit",
    "message": "混み合っています。順番にご案内します（およそ 30 秒）",
    "action": "そのまま待つ",
    "undo": false,
    "severity": "critical",
    "support_code": "E-LIM-003",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "choke_point": "C2"
    }
  },
  "E-DATA-001": {
    "id": "E-DATA-001",
    "cls": "data",
    "message": "預かった情報が読めません。安全のため、もう一度預け直してください",
    "action": "預け直す",
    "undo": false,
    "severity": "critical",
    "support_code": "E-DATA-001",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials",
      "choke_point": "C8"
    }
  },
  "E-DATA-002": {
    "id": "E-DATA-002",
    "cls": "data",
    "message": "作っている間に会社モデルが変わったので、作り直します",
    "action": "作り直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-DATA-002",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "export"
    }
  },
  "E-TO-001": {
    "id": "E-TO-001",
    "cls": "timeout",
    "message": "◯◯商事の返事待ちで 12 日止まっています。催促の下書きを作れます",
    "action": "催促のメールを下書かせる／来期に回す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-TO-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tasks",
      "state": "b"
    }
  },
  "E-TO-002": {
    "id": "E-TO-002",
    "cls": "timeout",
    "message": "止まっている案件が 2 件あります",
    "action": "1 件をひらく／高本AIに配らせる",
    "undo": false,
    "severity": "low",
    "support_code": "E-TO-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "records",
      "state": "s"
    }
  },
  "E-TO-003": {
    "id": "E-TO-003",
    "cls": "timeout",
    "message": "切れています。いまは仕事を渡せません。言ったことは溜めておき、Bridge を開いたら続けます",
    "action": "Bridge を開く（接続を確かめる を押してもよい）",
    "undo": false,
    "severity": "high",
    "support_code": "E-TO-003",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "bridge-setup"
    }
  },
  "E-TO-004": {
    "id": "E-TO-004",
    "cls": "timeout",
    "message": "営業社員の実行が 10 分を超えたので止めました。途中までの結果は残っています",
    "action": "続きをやらせる／動きを見る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-TO-004",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ai-activity",
      "choke_point": "C5"
    }
  },
  "E-LIM-004": {
    "id": "E-LIM-004",
    "cls": "limit",
    "message": "今月の AI の実行量が上限に達しました。来月まで待つか、プランを変えると続けられます",
    "action": "プランを見る／来月まで待つ",
    "undo": false,
    "severity": "high",
    "support_code": "E-LIM-004",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "clone-chat",
      "choke_point": "C3"
    }
  },
  "E-DEP-004": {
    "id": "E-DEP-004",
    "cls": "dependency",
    "message": "本番に切り替える前に 2 つ足りません：経理社員の freee のログイン情報／営業社員の目標。埋めると切り替えられます",
    "action": "足りないものを埋める／その AI社員は止めたまま本番へ",
    "undo": false,
    "severity": "high",
    "support_code": "E-DEP-004",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "onboard-golive",
      "act": "A12"
    }
  },
  "E-EXT-005": {
    "id": "E-EXT-005",
    "cls": "external",
    "message": "送ったメールは取り消せません。代わりに訂正メールの下書きを作れます",
    "action": "訂正の下書きを作る／やめる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-EXT-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "audit",
      "act": "A34"
    }
  },
  "E-A39-NA": {
    "id": "E-A39-NA",
    "cls": "n/a",
    "message": "",
    "action": "",
    "undo": false,
    "severity": "medium",
    "support_code": "E-A39-NA",
    "must_not": false,
    "layers": [],
    "where": {}
  },
  "E-MOCK-001": {
    "id": "E-MOCK-001",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "account-close",
      "state": "gs"
    }
  },
  "E-MOCK-002": {
    "id": "E-MOCK-002",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "account",
      "state": "gs"
    }
  },
  "E-MOCK-003": {
    "id": "E-MOCK-003",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ai-activity",
      "state": "gs"
    }
  },
  "E-MOCK-004": {
    "id": "E-MOCK-004",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ai-staff-detail",
      "state": "gs"
    }
  },
  "E-MOCK-005": {
    "id": "E-MOCK-005",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ai-staff",
      "state": "gs"
    }
  },
  "E-MOCK-006": {
    "id": "E-MOCK-006",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "approvals",
      "state": "gs"
    }
  },
  "E-MOCK-007": {
    "id": "E-MOCK-007",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "audit",
      "state": "gs"
    }
  },
  "E-MOCK-008": {
    "id": "E-MOCK-008",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing",
      "state": "gs"
    }
  },
  "E-MOCK-009": {
    "id": "E-MOCK-009",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-memory",
      "state": "gs"
    }
  },
  "E-MOCK-010": {
    "id": "E-MOCK-010",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-thread",
      "state": "gs"
    }
  },
  "E-MOCK-011": {
    "id": "E-MOCK-011",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "company-model",
      "state": "gs"
    }
  },
  "E-MOCK-012": {
    "id": "E-MOCK-012",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "company-settings",
      "state": "gs"
    }
  },
  "E-MOCK-013": {
    "id": "E-MOCK-013",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-013",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "duties",
      "state": "gs"
    }
  },
  "E-MOCK-014": {
    "id": "E-MOCK-014",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "export",
      "state": "gs"
    }
  },
  "E-MOCK-015": {
    "id": "E-MOCK-015",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-015",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "goal-allocation",
      "state": "gs"
    }
  },
  "E-MOCK-016": {
    "id": "E-MOCK-016",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-016",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "goal-edit",
      "state": "gs"
    }
  },
  "E-MOCK-017": {
    "id": "E-MOCK-017",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-017",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "goals",
      "state": "gs"
    }
  },
  "E-MOCK-018": {
    "id": "E-MOCK-018",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-018",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "hypotheses",
      "state": "gs"
    }
  },
  "E-MOCK-019": {
    "id": "E-MOCK-019",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-019",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "import",
      "state": "gs"
    }
  },
  "E-MOCK-020": {
    "id": "E-MOCK-020",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "inquiry",
      "state": "gs"
    }
  },
  "E-MOCK-021": {
    "id": "E-MOCK-021",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-021",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ledger-def",
      "state": "gs"
    }
  },
  "E-MOCK-022": {
    "id": "E-MOCK-022",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-022",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "member-detail",
      "state": "gs"
    }
  },
  "E-MOCK-023": {
    "id": "E-MOCK-023",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-023",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "gs"
    }
  },
  "E-MOCK-024": {
    "id": "E-MOCK-024",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-024",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "my-progress",
      "state": "gs"
    }
  },
  "E-MOCK-025": {
    "id": "E-MOCK-025",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-025",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "notices",
      "state": "gs"
    }
  },
  "E-MOCK-026": {
    "id": "E-MOCK-026",
    "cls": "external",
    "message": "詰まっている会社。失敗の型で並べる。型ごとに対処がある",
    "action": "会社の詳細で対処を送る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-026",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ops-home",
      "state": "s"
    }
  },
  "E-MOCK-027": {
    "id": "E-MOCK-027",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-027",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "policies",
      "state": "gs"
    }
  },
  "E-MOCK-028": {
    "id": "E-MOCK-028",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-028",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "record-detail",
      "state": "gs"
    }
  },
  "E-MOCK-029": {
    "id": "E-MOCK-029",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-029",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "records",
      "state": "gs"
    }
  },
  "E-MOCK-030": {
    "id": "E-MOCK-030",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-030",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "review",
      "state": "gs"
    }
  },
  "E-MOCK-031": {
    "id": "E-MOCK-031",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-031",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "search",
      "state": "gs"
    }
  },
  "E-MOCK-032": {
    "id": "E-MOCK-032",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-032",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "security-brief",
      "state": "gs"
    }
  },
  "E-MOCK-033": {
    "id": "E-MOCK-033",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-033",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "services",
      "state": "gs"
    }
  },
  "E-MOCK-034": {
    "id": "E-MOCK-034",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-034",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tasks",
      "state": "gs"
    }
  },
  "E-ACT-035": {
    "id": "E-ACT-035",
    "cls": "dependency",
    "message": "引き継ぎ先が決まっていないものがあります。決めるまで無効にできません",
    "action": "自分のAIの案を全部採る／1 件ずつ決める",
    "undo": false,
    "severity": "high",
    "support_code": "E-ACT-035",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "act": "A62",
      "screen": "member-detail"
    }
  },
  "E-ACT-036": {
    "id": "E-ACT-036",
    "cls": "connectivity",
    "message": "運営に送れませんでした。内容は下書きに残っています。もう一度送るか、しばらくしてからお試しください",
    "action": "もう一度送る／下書きを確認する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ACT-036",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A67",
      "screen": "inquiry"
    }
  },
  "E-ACT-037": {
    "id": "E-ACT-037",
    "cls": "connectivity",
    "message": "お知らせを読み込めませんでした。前回の内容を表示しています",
    "action": "再読み込みする",
    "undo": false,
    "severity": "low",
    "support_code": "E-ACT-037",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A68",
      "screen": "notices"
    }
  },
  "E-ACT-038": {
    "id": "E-ACT-038",
    "cls": "validation",
    "message": "対象の会社がありません。プランか会社を選んでください",
    "action": "対象を選び直す／失敗した分を再送する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ACT-038",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A71",
      "screen": "ops-notices"
    }
  },
  "E-ACT-039": {
    "id": "E-ACT-039",
    "cls": "data",
    "message": "セキュリティの記録を読み込めませんでした。運営に連絡してください",
    "action": "再読み込み／運営に連絡する",
    "undo": false,
    "severity": "high",
    "support_code": "E-ACT-039",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "act": "A73",
      "screen": "ops-audit"
    }
  },
  "E-ACT-040": {
    "id": "E-ACT-040",
    "cls": "auth",
    "message": "保存できませんでした。もう一度お試しください。パスワードを変えた場合は他の端末で入り直しが必要です",
    "action": "もう一度保存する／端末の一覧で失効を確認する",
    "undo": false,
    "severity": "high",
    "support_code": "E-ACT-040",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "act": "A74",
      "screen": "account"
    }
  },
  "E-ACT-041": {
    "id": "E-ACT-041",
    "cls": "validation",
    "message": "この版は出せません。テストで失敗した場面があります（外部サービスの規約変更）。直して再テストしてください",
    "action": "失敗した場面を見る／直して「上げてテストで動かす」",
    "undo": false,
    "severity": "high",
    "support_code": "E-ACT-041",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A80",
      "screen": "ops-skills"
    }
  },
  "E-PAY-001": {
    "id": "E-PAY-001",
    "cls": "payment",
    "message": "カードが拒否されました。別のカードを使うか、カード会社に確認してください。請求書払いに切り替えることもできます",
    "action": "別のカードで登録する／請求書払いにする",
    "undo": false,
    "severity": "medium",
    "support_code": "PAY-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing-setup",
      "state": "x",
      "choke_point": "C7"
    }
  },
  "E-PAY-002": {
    "id": "E-PAY-002",
    "cls": "payment",
    "message": "カードの本人確認が終わっていません。Stripe の画面でもう一度、カード会社の確認を済ませてください",
    "action": "Stripe の画面に戻る",
    "undo": false,
    "severity": "medium",
    "support_code": "PAY-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing-setup",
      "state": "x",
      "choke_point": "C7"
    }
  },
  "E-PAY-003": {
    "id": "E-PAY-003",
    "cls": "payment",
    "message": "今月の引き落としができませんでした。9/23 までに支払い方法を直してください。過ぎると休止になり、AI社員が止まります",
    "action": "支払い方法を直す（Stripe の画面）",
    "undo": false,
    "severity": "high",
    "support_code": "PAY-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "billing",
      "state": "n",
      "choke_point": "C7"
    }
  },
  "E-PAY-004": {
    "id": "E-PAY-004",
    "cls": "payment",
    "message": "カードが登録されていません。先に支払い方法を登録するか、請求書払いのままにしてください",
    "action": "支払い方法を登録する",
    "undo": false,
    "severity": "medium",
    "support_code": "PAY-004",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing",
      "state": "c",
      "choke_point": "C7"
    }
  },
  "E-PAY-005": {
    "id": "E-PAY-005",
    "cls": "payment",
    "message": "決済事業者からの通知の署名が合いませんでした。通知は処理していません。運営が鍵を確かめます",
    "action": "運営に連絡（自動で記録済み）",
    "undo": false,
    "severity": "high",
    "support_code": "PAY-005",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-billing",
      "state": "n",
      "choke_point": "C7"
    }
  },
  "E-PAY-006": {
    "id": "E-PAY-006",
    "cls": "payment",
    "message": "カードの変更画面（Stripe）が今開けません。しばらくしてからもう一度お試しください。請求は止まりません",
    "action": "もう一度開く",
    "undo": false,
    "severity": "low",
    "support_code": "PAY-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "billing",
      "state": "n",
      "choke_point": "C7"
    }
  },
  "E-LLM-001": {
    "id": "E-LLM-001",
    "cls": "external",
    "message": "Anthropic のキーが無効です（提供者が拒否）。新しいキーを預けるか、経路を Bridge か運営マネージドに戻してください。動いていた仕事は止めてあります",
    "action": "新しいキーを預ける／Bridge に戻す",
    "undo": false,
    "severity": "high",
    "support_code": "LLM-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "x",
      "choke_point": "C8"
    }
  },
  "E-LLM-002": {
    "id": "E-LLM-002",
    "cls": "external",
    "message": "OpenAI が応答しません。この経路の仕事は止めてあります。Bridge に戻すか、しばらくしてから再開してください",
    "action": "Bridge に戻す／あとで再開",
    "undo": false,
    "severity": "medium",
    "support_code": "LLM-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "x",
      "choke_point": "C3"
    }
  },
  "E-LLM-003": {
    "id": "E-LLM-003",
    "cls": "limit",
    "message": "運営マネージドが今月の上限（100 万）に届きました。超えた分は従量で同じ請求書に乗ります。止めるなら経路を Bridge に戻してください",
    "action": "従量で続ける／Bridge に戻す",
    "undo": false,
    "severity": "medium",
    "support_code": "LLM-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "x",
      "choke_point": "C3"
    }
  },
  "E-LLM-004": {
    "id": "E-LLM-004",
    "cls": "gate",
    "message": "この機能はまだ使えません（提供者の間で揃っていないため、どの経路でも出していません）",
    "action": "別のやり方（文字で伝える）",
    "undo": false,
    "severity": "low",
    "support_code": "LLM-004",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "n",
      "choke_point": "C3"
    }
  },
  "E-APP-001": {
    "id": "E-APP-001",
    "cls": "gate",
    "message": "iPhone の通知が許可されていません。承認待ちはメールと PC にだけ届きます。iPhone の設定 › 通知 › Kaname で許可すると、ここに戻ります",
    "action": "設定の開き方を見る",
    "undo": false,
    "severity": "medium",
    "support_code": "APP-001",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "app-setup",
      "state": "x",
      "choke_point": "C6"
    }
  },
  "E-APP-002": {
    "id": "E-APP-002",
    "cls": "connectivity",
    "message": "インターネットにつながっていません。最後に見た「今日」「タスク」「承認待ち」は読めます。書くのはつながってから",
    "action": "つながったら自動で続く",
    "undo": false,
    "severity": "low",
    "support_code": "APP-002",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "app-setup",
      "state": "x",
      "choke_point": null
    }
  },
  "E-DISC-001": {
    "id": "E-DISC-001",
    "cls": "external",
    "message": "PDF を作れませんでした（保存先が応答しません）。もう一度押すか、しばらくしてから試してください。画面の内容は最新の版です",
    "action": "もう一度 PDF を出す",
    "undo": false,
    "severity": "low",
    "support_code": "DISC-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "disclosure",
      "state": "x",
      "choke_point": "C4"
    }
  },
  "E-DISC-002": {
    "id": "E-DISC-002",
    "cls": "data",
    "message": "公開中の開示資料（第 7 版）は設計より古くなっています。新しい版を出して全社にお知らせしてください",
    "action": "新しい版を出す",
    "undo": false,
    "severity": "medium",
    "support_code": "DISC-002",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "ops-disclosure",
      "state": "n",
      "choke_point": "C2"
    }
  },
  "E-MOCK-035": {
    "id": "E-MOCK-035",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-035",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "llm-routes",
      "state": "gs"
    }
  },
  "E-MOCK-036": {
    "id": "E-MOCK-036",
    "cls": "connectivity",
    "message": "AI は止まっています。人が見る・押すものはそのまま。AI が拾う・配る・一次確認する部分だけ止まっています。止まった理由と直し方は「止まっているものを直す」にあります",
    "action": "止まっているものを直す（覚え直させる・PC をつなぐ）を開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MOCK-036",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "disclosure",
      "state": "gs"
    }
  },
  "E-MAIL-001": {
    "id": "E-MAIL-001",
    "cls": "external",
    "message": "確認のメールを出せませんでした。こちら側の都合です。あなたのメールアドレスに問題はありません",
    "action": "少し時間をおいて送り直す／別のメールアドレスで登録し直す／運営に連絡する",
    "undo": false,
    "severity": "high",
    "support_code": "E-MAIL-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "f"
    }
  },
  "E-MAIL-002": {
    "id": "E-MAIL-002",
    "cls": "external",
    "message": "このメールアドレスは受け取れませんでした。受信箱がいっぱいか、アドレスが違うかもしれません",
    "action": "受信箱を空ける／入力し直して別のアドレスで登録する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MAIL-002",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "f"
    }
  },
  "E-MAIL-003": {
    "id": "E-MAIL-003",
    "cls": "not_found",
    "message": "この申し込みは残っていません。もう一度はじめからやり直してください",
    "action": "はじめから登録し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-MAIL-003",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "n"
    }
  },
  "E-CONN-010": {
    "id": "E-CONN-010",
    "cls": "auth",
    "message": "Claude Code にログインできていません。Bridge の「ログインする」を押して、ブラウザで 1 回許可してください",
    "action": "Bridge で「ログインする」を押す",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-010",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "stp"
    }
  },
  "E-LIM-010": {
    "id": "E-LIM-010",
    "cls": "limit",
    "message": "サブスクの 5 時間の枠に達しました。18:40 に戻ります。それまで自分のAI は動けません。ここで書いたことは送れます（戻ったら順に）",
    "action": "使用量を見る／戻ってからそのまま書く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-LIM-010",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x"
    }
  },
  "E-LIM-005": {
    "id": "E-LIM-005",
    "cls": "limit",
    "message": "送りすぎです。{秒}秒たってから、もう一度お試しください",
    "action": "待ってから、もう一度押す",
    "undo": false,
    "severity": "low",
    "support_code": "E-LIM-005",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-CONN-011": {
    "id": "E-CONN-011",
    "cls": "dependency",
    "message": "Claude Code は入っていますが、本体が落ちてきていないので動きません。下のボタンで取り直せば直ります",
    "action": "Bridge で「Claude Code を取り直す」を押す",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-011",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "e"
    }
  },
  "E-GATE-010": {
    "id": "E-GATE-010",
    "cls": "gate",
    "message": "本人が許可しませんでした（確認に答えが無いまま時間がたったので、実行していません）",
    "action": "会話で「続けて」と書いて送り、次の問いで答える",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GATE-010",
    "must_not": true,
    "layers": [
      "Bridge",
      "UI"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "a"
    }
  },
  "E-GATE-011": {
    "id": "E-GATE-011",
    "cls": "gate",
    "message": "{サービス}（{ドメイン}）は規約で自動操作が禁止のため止めました。正規の連携か、手で操作してください",
    "action": "返事にある正規の連携の案内か、手作業の手順に沿って進める",
    "undo": false,
    "severity": "high",
    "support_code": "E-GATE-011",
    "must_not": true,
    "layers": [
      "Bridge",
      "UI"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "a"
    }
  },
  "E-CONF-011": {
    "id": "E-CONF-011",
    "cls": "conflict",
    "message": "このメールアドレスの登録は確認まで終わっています。ログインしてください",
    "action": "ログインへ",
    "undo": false,
    "severity": "low",
    "support_code": "E-CONF-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "done"
    }
  },
  "E-CONF-012": {
    "id": "E-CONF-012",
    "cls": "conflict",
    "message": "規約の版が新しくなりました。新しい版を読んで同意してください",
    "action": "新しい版を読んで、もう一度同意する",
    "undo": false,
    "severity": "low",
    "support_code": "E-CONF-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "terms"
    }
  },
  "E-SEC-001": {
    "id": "E-SEC-001",
    "cls": "dependency",
    "message": "預かり先に保管できませんでした。もう一度試してください",
    "action": "もう一度「保存」を押す。続くときは運営に連絡する",
    "undo": false,
    "severity": "high",
    "support_code": "E-SEC-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials",
      "state": "e"
    }
  },
  "E-SEC-002": {
    "id": "E-SEC-002",
    "cls": "dependency",
    "message": "いまはログイン情報を預かれません。預かり先の用意ができたら使えるようになります",
    "action": "預かり先が決まるまで、そのサービスは本人がログインして使う",
    "undo": false,
    "severity": "medium",
    "support_code": "E-SEC-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials",
      "state": "e"
    }
  },
  "E-SEC-003": {
    "id": "E-SEC-003",
    "cls": "dependency",
    "message": "いま混み合っています。◯ 秒ほど待ってからもう一度保存してください",
    "action": "待ってからもう一度保存する（上限の 8 割で運営に知らせが届いている）",
    "undo": false,
    "severity": "medium",
    "support_code": "E-SEC-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials",
      "state": "e"
    }
  },
  "E-AUTH-007": {
    "id": "E-AUTH-007",
    "cls": "auth",
    "message": "このアカウントは、会社の登録が見つからないため使えません。もう一度アカウントを作るか、運営に連絡してください",
    "action": "アカウントを作る／運営に連絡する",
    "undo": false,
    "severity": "high",
    "support_code": "E-AUTH-007",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "e"
    }
  },
  "E-AUTH-008": {
    "id": "E-AUTH-008",
    "cls": "auth",
    "message": "このリンクは使えません。新しく届いたメールのリンクを開いてください",
    "action": "新しく届いたメールのリンクを開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-008",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "verify-email",
      "state": "old_link"
    }
  },
  "E-AUTH-009": {
    "id": "E-AUTH-009",
    "cls": "auth",
    "message": "別のアカウントの登録のリンクです",
    "action": "今のアカウントのまま使う／ログアウトしてから、そのアカウントでログインする",
    "undo": false,
    "severity": "low",
    "support_code": "E-AUTH-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "verify-email",
      "state": "other_account"
    }
  },
  "E-AUTH-010": {
    "id": "E-AUTH-010",
    "cls": "gate",
    "message": "利用規約とプライバシーポリシーが新しくなりました。同意してから続けてください",
    "action": "新しい版を読んで同意する／ログアウトする",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-010",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "terms"
    }
  },
  "E-AUTH-011": {
    "id": "E-AUTH-011",
    "cls": "auth",
    "message": "このアカウントは、いま止められています。ワークスペースの管理者に聞いてください",
    "action": "ワークスペースの管理者に聞く",
    "undo": false,
    "severity": "medium",
    "support_code": "AUTH-011",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "suspended-member"
    }
  },
  "E-AUTH-012": {
    "id": "E-AUTH-012",
    "cls": "auth",
    "message": "このワークスペースは、いま止められています。データは残っています。管理者か運営に連絡してください",
    "action": "管理者か運営に連絡する",
    "undo": false,
    "severity": "medium",
    "support_code": "AUTH-012",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "suspended-ws"
    }
  },
  "E-AUTH-013": {
    "id": "E-AUTH-013",
    "cls": "auth",
    "message": "時間が過ぎました。最初からログインし直してください",
    "action": "メールとパスワードから入り直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-AUTH-013",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "code"
    }
  },
  "E-AUTH-014": {
    "id": "E-AUTH-014",
    "cls": "auth",
    "message": "コードを 5 回違えたので 15 分止めました。15 分たってから、もう一度入ってください",
    "action": "15 分待つ。端末をなくしたなら『端末をなくした』から管理者に頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-AUTH-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "code"
    }
  },
  "E-AUTH-015": {
    "id": "E-AUTH-015",
    "cls": "conflict",
    "message": "入り方が 1 つだけなので外せません。先にほかの入り方を付けてください",
    "action": "パスキーかパスワードと 2 段階認証を付けてから外す",
    "undo": false,
    "severity": "high",
    "support_code": "AUTH-015",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "sec-remove-last"
    }
  },
  "E-AUTH-016": {
    "id": "E-AUTH-016",
    "cls": "conflict",
    "message": "パスワードで入るには 2 段階認証が要ります。先に 2 段階認証を付けてください",
    "action": "2 段階認証を付けてから外す",
    "undo": false,
    "severity": "high",
    "support_code": "AUTH-016",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "sec-remove-last"
    }
  },
  "E-AUTH-017": {
    "id": "E-AUTH-017",
    "cls": "auth",
    "message": "2 段階認証はもう付いています",
    "action": "安全の設定の画面に戻る",
    "undo": false,
    "severity": "low",
    "support_code": "AUTH-017",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "already"
    }
  },
  "E-AUTH-018": {
    "id": "E-AUTH-018",
    "cls": "conflict",
    "message": "このパスキーは、もうこの端末に付いています",
    "action": "そのまま使う／別の端末で足す",
    "undo": false,
    "severity": "low",
    "support_code": "AUTH-018",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "sec-add-dup"
    }
  },
  "E-AUTH-019": {
    "id": "E-AUTH-019",
    "cls": "gate",
    "message": "入り方を 1 つ足してから使い始めます",
    "action": "パスキーか 2 段階認証を付ける",
    "undo": false,
    "severity": "medium",
    "support_code": "AUTH-019",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "mfa-required"
    }
  },
  "E-AUTH-020": {
    "id": "E-AUTH-020",
    "cls": "auth",
    "message": "2 段階認証を付けるには、先にパスワードを決めてください",
    "action": "パスワードを決める",
    "undo": false,
    "severity": "low",
    "support_code": "AUTH-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "no-password"
    }
  },
  "E-AUTH-021": {
    "id": "E-AUTH-021",
    "cls": "auth",
    "message": "本人か確かめられませんでした。もう一度確かめてください",
    "action": "もう一度確かめる",
    "undo": false,
    "severity": "medium",
    "support_code": "AUTH-021",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "mfa-setup",
      "state": "step-up"
    }
  },
  "E-CHAT-001": {
    "id": "E-CHAT-001",
    "cls": "connectivity",
    "message": "送れませんでした（回線が切れていました）。書いた文は残っています",
    "action": "もう一度送る",
    "undo": false,
    "severity": "high",
    "support_code": "E-CHAT-001",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x"
    }
  },
  "E-CHAT-002": {
    "id": "E-CHAT-002",
    "cls": "external",
    "message": "資料を置けませんでした（保存先が応答しません）。付けた一覧に残っているので、もう一度送ってください",
    "action": "もう一度送る／外す",
    "undo": false,
    "severity": "high",
    "support_code": "E-CHAT-002",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "C4"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "f",
      "choke_point": "C4"
    }
  },
  "E-CHAT-003": {
    "id": "E-CHAT-003",
    "cls": "no_signal",
    "message": "止める合図を PC に届けられませんでした（PC が応答しません）。PC が起きたらすぐ止めます",
    "action": "PC の状態を見る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CHAT-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "s"
    }
  },
  "E-MEM-001": {
    "id": "E-MEM-001",
    "cls": "connectivity",
    "message": "あなたの PC が閉じているので、まとめを始められません。PC を起こしてから、もう一度押してください。溜まっている分は消えません",
    "action": "PC の状態を見る／あとで押す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MEM-001",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "today",
      "state": "dg"
    }
  },
  "E-ART-001": {
    "id": "E-ART-001",
    "cls": "validation",
    "message": "大きすぎて成果物にできません（1 MB まで）。分けて書き出してください",
    "action": "本文を分けて、別々に書き出す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ART-001",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "art",
      "choke_point": "C4"
    }
  },
  "E-ART-002": {
    "id": "E-ART-002",
    "cls": "dependency",
    "message": "成果物を保存できませんでした（保存先が応答しません）。直した中身は残っているので、もう一度保存してください",
    "action": "もう一度保存する",
    "undo": false,
    "severity": "high",
    "support_code": "E-ART-002",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "art",
      "choke_point": "C4"
    }
  },
  "E-CONN-012": {
    "id": "E-CONN-012",
    "cls": "dependency",
    "message": "この PC の Bridge が古いので、自分のAI に仕事を渡せません。Bridge を入れ直してください",
    "action": "Bridge を入れ直す（書いたことは溜めておき、入れ直した後に順に片づける）",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-012",
    "must_not": true,
    "layers": [
      "Bridge",
      "API",
      "UI"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "x"
    }
  },
  "E-SIG-003": {
    "id": "E-SIG-003",
    "cls": "no_signal",
    "message": "ここで止まりました。あなたが止めました。「{対象}」は途中だったので、その結末は分かりません。先方の画面で確かめてください",
    "action": "先方の画面（送った先・書いた先）で結末を確かめる／続けるなら「続けて」と書いて送る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-SIG-003",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "stp"
    }
  },
  "E-NF-003": {
    "id": "E-NF-003",
    "cls": "not_found",
    "message": "前の会話の記録がこの PC に無かったので、新しい会話として続けます。これまでの内容は Kaname の写しに残っています",
    "action": "そのまま続ける（何もしなくてよい）",
    "undo": false,
    "severity": "low",
    "support_code": "E-NF-003",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "clone-chat",
      "state": "n"
    }
  },
  "E-VAL-005": {
    "id": "E-VAL-005",
    "cls": "validation",
    "message": "パスワードは 12 文字以上にしてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-006": {
    "id": "E-VAL-006",
    "cls": "validation",
    "message": "会社名（または屋号）を入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-007": {
    "id": "E-VAL-007",
    "cls": "validation",
    "message": "お名前を入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-VAL-008": {
    "id": "E-VAL-008",
    "cls": "validation",
    "message": "ログイン名とパスワードを入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "a"
    }
  },
  "E-VAL-009": {
    "id": "E-VAL-009",
    "cls": "validation",
    "message": "コードを入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "a"
    }
  },
  "E-VAL-010": {
    "id": "E-VAL-010",
    "cls": "validation",
    "message": "名前を入れてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-011": {
    "id": "E-VAL-011",
    "cls": "validation",
    "message": "漏れたことのあるパスワードです。別のパスワードにしてください",
    "action": "別のパスワードを入れ直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-VAL-011",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-016": {
    "id": "E-VAL-016",
    "cls": "validation",
    "message": "会社名は 100 文字までにしてください",
    "action": "入力し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-016",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "signup",
      "state": "a"
    }
  },
  "E-VAL-019": {
    "id": "E-VAL-019",
    "cls": "validation",
    "message": "同意する場合は、チェックを入れてください",
    "action": "チェックを入れて押し直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VAL-019",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "login",
      "state": "terms"
    }
  },
  "E-VAL-020": {
    "id": "E-VAL-020",
    "cls": "validation",
    "message": "差し戻す理由を書いてください",
    "action": "理由を書いてから差し戻す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-020",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "approvals",
      "state": "return"
    }
  },
  "E-VAL-023": {
    "id": "E-VAL-023",
    "cls": "validation",
    "message": "完了の条件を満たしたか確かめて、チェックを入れてください",
    "action": "完了の条件を確かめてチェックを入れる",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-023",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-VAL-024": {
    "id": "E-VAL-024",
    "cls": "validation",
    "message": "終わっていない子のチケットがあります。先に子を完了にしてください",
    "action": "子のチケットを先に完了にする",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-024",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-VAL-025": {
    "id": "E-VAL-025",
    "cls": "validation",
    "message": "ほかに、あなたに見えない子のチケットがあります",
    "action": "その子の担当者か、子が見える人に、子を完了にしてもらう",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-025",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-VAL-026": {
    "id": "E-VAL-026",
    "cls": "validation",
    "message": "パスワードは 128 文字以内にしてください",
    "action": "短くする",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-026",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "password-reset",
      "state": "p"
    }
  },
  "E-CONF-016": {
    "id": "E-CONF-016",
    "cls": "conflict",
    "message": "承認待ち・実行中・確認中のチケットは完了にできません",
    "action": "今の実行・承認が終わるのを待つ",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-016",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-CONF-018": {
    "id": "E-CONF-018",
    "cls": "conflict",
    "message": "このチケットはもう完了しています",
    "action": "チケットを読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-018",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-CONF-019": {
    "id": "E-CONF-019",
    "cls": "conflict",
    "message": "完了にできるのは作業中のチケットだけです",
    "action": "AI に任せて、終わってから完了にする",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-019",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "complete"
    }
  },
  "E-INV-001": {
    "id": "E-INV-001",
    "cls": "not_found",
    "message": "この招待は見つかりません。もう一度招待してもらってください",
    "action": "招待した人にもう一度招待してもらう",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-002": {
    "id": "E-INV-002",
    "cls": "not_found",
    "message": "この招待は取り消されています。招待した人に、もう一度招待してもらってください",
    "action": "招待した人にもう一度招待してもらう",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-PAGE-001": {
    "id": "E-PAGE-001",
    "cls": "not_found",
    "message": "見つかりませんでした。消されたか、見る権限が無いかもしれません",
    "action": "自分に関わるものへ戻る／探す",
    "undo": false,
    "severity": "medium",
    "support_code": "PAGE-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "*",
      "state": "not_found"
    }
  },
  "E-PAGE-002": {
    "id": "E-PAGE-002",
    "cls": "permission",
    "message": "この画面を見る権限がありません。見る必要があれば、マネージャーに頼めます。頼んだことは相手に知らせ、記録に残ります",
    "action": "マネージャーに頼む／戻る",
    "undo": false,
    "severity": "high",
    "support_code": "PAGE-002",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "*",
      "state": "forbidden"
    }
  },
  "E-PAGE-003": {
    "id": "E-PAGE-003",
    "cls": "dependency",
    "message": "Kaname の調子が悪くなっています。運営が直しています。あなたの操作や PC の問題ではありません",
    "action": "もう一度／いまの様子を見る",
    "undo": false,
    "severity": "critical",
    "support_code": "PAGE-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "*",
      "state": "down"
    }
  },
  "E-PAGE-004": {
    "id": "E-PAGE-004",
    "cls": "dependency",
    "message": "いまメンテナンス中です。終わると自動でこの画面が切り替わります。書きかけはこの PC に残っています",
    "action": "いまの様子を見る",
    "undo": false,
    "severity": "high",
    "support_code": "PAGE-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "*",
      "state": "maintenance"
    }
  },
  "E-PAGE-005": {
    "id": "E-PAGE-005",
    "cls": "auth",
    "message": "ログインが切れました。書きかけのものはこの PC に残っています。入り直すと続きから書けます",
    "action": "入り直す",
    "undo": false,
    "severity": "high",
    "support_code": "PAGE-005",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "*",
      "state": "session_expired"
    }
  },
  "E-PAGE-006": {
    "id": "E-PAGE-006",
    "cls": "not_found",
    "message": "このリンクは使えなくなりました。期限が切れたか、もう使われています",
    "action": "送り直してもらう／もう一度はじめから",
    "undo": false,
    "severity": "medium",
    "support_code": "PAGE-006",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "*",
      "state": "link_expired"
    }
  },
  "E-PAGE-007": {
    "id": "E-PAGE-007",
    "cls": "connectivity",
    "message": "読み込めませんでした。ネットにつながっていないか、Kaname が混み合っています。書きかけのものはこの PC に残っています",
    "action": "もう一度／いまの様子を見る",
    "undo": false,
    "severity": "medium",
    "support_code": "PAGE-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "*",
      "state": "load_failed"
    }
  },
  "E-PAGE-008": {
    "id": "E-PAGE-008",
    "cls": "connectivity",
    "message": "オフラインです。読むことはできます。書いたものはつながったら送ります",
    "action": "そのまま続ける（つながったら自動で送る）",
    "undo": false,
    "severity": "medium",
    "support_code": "PAGE-008",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "*",
      "state": "offline"
    }
  },
  "E-CONN-013": {
    "id": "E-CONN-013",
    "cls": "not_found",
    "message": "その接続コードは使えません。Kaname の「PC をつなぐ」の画面に出ている、新しいコードを入れてください",
    "action": "画面の新しいコードを入れ直す",
    "undo": false,
    "severity": "medium",
    "support_code": "CONN-013",
    "must_not": false,
    "layers": [
      "Bridge",
      "API"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "code_invalid"
    }
  },
  "E-CONN-014": {
    "id": "E-CONN-014",
    "cls": "not_found",
    "message": "まだ配布していません。署名と置き場の用意ができたら、ここから入れられるようになります",
    "action": "待つ（用意ができたら知らせる）",
    "undo": false,
    "severity": "low",
    "support_code": "CONN-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "not_released"
    }
  },
  "E-VAL-012": {
    "id": "E-VAL-012",
    "cls": "conflict",
    "message": "期限は今日か、それより後の日にしてください",
    "action": "期限を入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "create"
    }
  },
  "E-VAL-015": {
    "id": "E-VAL-015",
    "cls": "conflict",
    "message": "チケットの親子は 3 段までです。ほかの親を選んでください",
    "action": "親を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-015",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "create"
    }
  },
  "E-VAL-017": {
    "id": "E-VAL-017",
    "cls": "validation",
    "message": "探す言葉は 100 文字までにしてください",
    "action": "探す言葉を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-017",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "list"
    }
  },
  "E-VAL-018": {
    "id": "E-VAL-018",
    "cls": "validation",
    "message": "この絞り込みはまだ使えません",
    "action": "絞り込みを外して開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-018",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "list"
    }
  },
  "E-CONF-013": {
    "id": "E-CONF-013",
    "cls": "conflict",
    "message": "このチケットはいま自分のAI が作っています。今の実行の様子を見てください",
    "action": "今の実行の様子を見る",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-013",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "running"
    }
  },
  "E-CONF-014": {
    "id": "E-CONF-014",
    "cls": "conflict",
    "message": "いまの段のチケットは AI に任せられません（承認待ち・確認中・実行中・完了）。チケットの帯で次の一手を選んでください",
    "action": "承認の帯で決める",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-014",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "awaiting_approval"
    }
  },
  "E-SIG-004": {
    "id": "E-SIG-004",
    "cls": "no_signal",
    "message": "自分のAI が結果を返さずに終わりました。完了とは見なしていません",
    "action": "もう一度 AI に任せる／自分でやる",
    "undo": false,
    "severity": "medium",
    "support_code": "SIG-004",
    "must_not": true,
    "layers": [
      "API",
      "DB",
      "UI"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-TO-005": {
    "id": "E-TO-005",
    "cls": "timeout",
    "message": "PC から 10 分知らせがありません。止まったとみなしています。PC の Bridge が動いているか確かめてください",
    "action": "PC の Bridge が動いているか確かめる",
    "undo": false,
    "severity": "medium",
    "support_code": "TO-005",
    "must_not": false,
    "layers": [
      "API",
      "UI"
    ],
    "where": {
      "screen": "tickets",
      "state": "running"
    }
  },
  "E-INV-004": {
    "id": "E-INV-004",
    "cls": "not_found",
    "message": "この招待はもう使われています。参加した人は、ログインして入ってください",
    "action": "参加した人はログインして入る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-003": {
    "id": "E-INV-003",
    "cls": "not_found",
    "message": "この招待は期限（7 日）が過ぎました。送り直しを頼めます",
    "action": "送り直しを頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-006": {
    "id": "E-INV-006",
    "cls": "conflict",
    "message": "このメールアドレスにはもうアカウントがあります。ログインしてから参加してください",
    "action": "ログインしてから参加する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-005": {
    "id": "E-INV-005",
    "cls": "permission",
    "message": "この招待は別のメールアドレス宛てです。そのアドレスのアカウントで入ってください",
    "action": "宛てのアカウントで入り直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-007": {
    "id": "E-INV-007",
    "cls": "conflict",
    "message": "このワークスペースにはもう入っています",
    "action": "そのワークスペースを開く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-008": {
    "id": "E-INV-008",
    "cls": "conflict",
    "message": "この招待はまだ使えます。届いたリンクから参加してください",
    "action": "届いたリンクから参加する",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-008",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-CRED-001": {
    "id": "E-CRED-001",
    "cls": "validation",
    "message": "名前は英大文字・数字・_ で、英字から始めてください（64 文字まで）",
    "action": "名前を直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-002": {
    "id": "E-CRED-002",
    "cls": "validation",
    "message": "使える場所はドメイン（例：example.com）で、20 個までにしてください",
    "action": "使える場所を直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-003": {
    "id": "E-CRED-003",
    "cls": "validation",
    "message": "使える場所を 1 つ以上入れてください。この宛先にだけ使います",
    "action": "使う宛先のドメインを入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-004": {
    "id": "E-CRED-004",
    "cls": "conflict",
    "message": "期限は今日以降の日付にしてください",
    "action": "期限を直すか空にする",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-005": {
    "id": "E-CRED-005",
    "cls": "validation",
    "message": "ログイン情報は ID とパスワード、API キー・値は値だけを入れてください",
    "action": "中身を入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-006": {
    "id": "E-CRED-006",
    "cls": "conflict",
    "message": "同じ名前のものがもう預けてあります。別の名前にするか、前のものを上書きしてください",
    "action": "名前を変えるか上書きする",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-007": {
    "id": "E-CRED-007",
    "cls": "permission",
    "message": "ワークスペースに預けたものを変えられるのは管理者だけです。自分だけのものとして預けてください",
    "action": "自分だけに預ける／管理者に頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CRED-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-008": {
    "id": "E-CRED-008",
    "cls": "validation",
    "message": "変える物がありません。新しい値か、使える場所・期限・説明を入れてください",
    "action": "変える物を入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-009": {
    "id": "E-CRED-009",
    "cls": "conflict",
    "message": "ほかの画面で同時に上書きされました。開き直してから、もう一度上書きしてください",
    "action": "開き直してもう一度",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-015": {
    "id": "E-CRED-015",
    "cls": "conflict",
    "message": "この預けた物の種類や 2 段階の設定に合わない中身です。開き直して、合う欄だけを入れてください",
    "action": "開き直して合う欄だけを入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-015",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-016": {
    "id": "E-CRED-016",
    "cls": "gate",
    "message": "使える場所の外には入れません。必要なら、預けたログイン情報の使える場所に足してください",
    "action": "預けたログイン情報の使える場所に足す（持ち主に知らせる）",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CRED-016",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-010": {
    "id": "E-CRED-010",
    "cls": "gate",
    "message": "動いている仕事のためにだけ使えます",
    "action": "PC の Bridge を新しい版にする（次の仕事を待つ）",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-010",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-011": {
    "id": "E-CRED-011",
    "cls": "dependency",
    "message": "このログイン情報は失効しているか、期限が過ぎています。預け直してください",
    "action": "預け直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CRED-011",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-012": {
    "id": "E-CRED-012",
    "cls": "conflict",
    "message": "いま確かめています。終わるまで待ってください",
    "action": "終わるまで待つ",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-012",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-013": {
    "id": "E-CRED-013",
    "cls": "conflict",
    "message": "API キー・値はログインして確かめません",
    "action": "なし（確かめは要らない）",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-013",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CRED-014": {
    "id": "E-CRED-014",
    "cls": "not_found",
    "message": "いまはコードを頼まれていません（もう答えたか、確かめが止まりました）",
    "action": "一覧を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-CRED-014",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "credentials"
    }
  },
  "E-CONN-018": {
    "id": "E-CONN-018",
    "cls": "conflict",
    "message": "PC の Bridge が動いていないので確かめられません。Bridge を起こしてから押してください",
    "action": "Bridge を起こす",
    "undo": false,
    "severity": "medium",
    "support_code": "E-CONN-018",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "browser_check_asleep"
    }
  },
  "E-CONN-016": {
    "id": "E-CONN-016",
    "cls": "auth",
    "message": "Claude Code にログインできていません。下の「ログインする」を押して、ブラウザで 1 回許可してください",
    "action": "この画面の「ログインする」を押す",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-016",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "e"
    }
  },
  "E-CONN-017": {
    "id": "E-CONN-017",
    "cls": "auth",
    "message": "この PC の Claude Code にログインできていません",
    "action": "その PC でこの画面を開いて、ログインする",
    "undo": false,
    "severity": "high",
    "support_code": "E-CONN-017",
    "must_not": false,
    "layers": [
      "UI",
      "Bridge"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "e"
    }
  },
  "E-VAL-027": {
    "id": "E-VAL-027",
    "cls": "validation",
    "message": "書き込む文を書いてください",
    "action": "文を書いてから送る",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-027",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "talk"
    }
  },
  "E-CONF-030": {
    "id": "E-CONF-030",
    "cls": "conflict",
    "message": "AI が動いている間と承認待ちの間は、状態を変えられません",
    "action": "今の実行・承認が終わるのを待つ",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-030",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-CONF-032": {
    "id": "E-CONF-032",
    "cls": "conflict",
    "message": "完了したチケットは、開き直してから状態を変えてください",
    "action": "「作業中（開き直す）」で開き直してから状態を変える",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-032",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-CONF-034": {
    "id": "E-CONF-034",
    "cls": "conflict",
    "message": "この状態には、ここから変えられません",
    "action": "ほかの状態を選ぶ（完了は「完了にする」から）",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-034",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-CONF-035": {
    "id": "E-CONF-035",
    "cls": "conflict",
    "message": "保留にするときは、保留の理由と再開の条件を書いてください",
    "action": "保留の理由と再開の条件を書いてから、もう一度保留にする",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-035",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-CONF-036": {
    "id": "E-CONF-036",
    "cls": "conflict",
    "message": "保留にしていないチケットには、保留の理由と再開の条件を書けません",
    "action": "保留にしてから理由と条件を書く",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-036",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-VAL-041": {
    "id": "E-VAL-041",
    "cls": "validation",
    "message": "保留の理由を書いてください",
    "action": "保留の理由を書く",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-041",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-VAL-047": {
    "id": "E-VAL-047",
    "cls": "validation",
    "message": "再開の条件を書いてください",
    "action": "再開の条件を書く",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-047",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-VAL-042": {
    "id": "E-VAL-042",
    "cls": "validation",
    "message": "決めたことを書いてください",
    "action": "決めたことを書く",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-042",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "decisions"
    }
  },
  "E-CONF-031": {
    "id": "E-CONF-031",
    "cls": "conflict",
    "message": "この決定は、いま別の人が改めました。読み直してから、もう一度お試しください",
    "action": "読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-031",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "decisions"
    }
  },
  "E-CONF-033": {
    "id": "E-CONF-033",
    "cls": "conflict",
    "message": "この決定は、いま別の人が取り消しました。読み直してから、もう一度お試しください",
    "action": "読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-033",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "decisions"
    }
  },
  "E-VAL-045": {
    "id": "E-VAL-045",
    "cls": "validation",
    "message": "取り消す理由を書いてください",
    "action": "取り消す理由を書く",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-045",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "decisions"
    }
  },
  "E-VAL-046": {
    "id": "E-VAL-046",
    "cls": "validation",
    "message": "時間と分は 0 以上の整数で入れてください（分は 0〜59）",
    "action": "時間と分を直す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-046",
    "must_not": false,
    "layers": [
      "UI"
    ],
    "where": {
      "screen": "tickets",
      "state": "progress"
    }
  },
  "E-HND-001": {
    "id": "E-HND-001",
    "cls": "validation",
    "message": "この渡し方は、まだ使えません",
    "action": "別の渡し方を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-002": {
    "id": "E-HND-002",
    "cls": "permission",
    "message": "このチケットでは、この操作はできません",
    "action": "担当者かグループを管理する人に頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-HND-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-003": {
    "id": "E-HND-003",
    "cls": "conflict",
    "message": "AI の実行（承認）が終わってから渡してください",
    "action": "AI の実行か承認が終わるのを待つ",
    "undo": false,
    "severity": "medium",
    "support_code": "E-HND-003",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-004": {
    "id": "E-HND-004",
    "cls": "conflict",
    "message": "いま{名前}さんの返事を待っています。先にその渡しを取り消してください",
    "action": "前の渡しを取り消してから渡し直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-HND-004",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-005": {
    "id": "E-HND-005",
    "cls": "conflict",
    "message": "この渡しはもう決まっています（受けた・断った・取り消された）",
    "action": "画面を開き直して今の状態を見る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-HND-005",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-006": {
    "id": "E-HND-006",
    "cls": "validation",
    "message": "{名前}さんは今は選べません（{訳}）。別の人を選んでください",
    "action": "別の人を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-007": {
    "id": "E-HND-007",
    "cls": "validation",
    "message": "理由を書いてください",
    "action": "理由を書く",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-007",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-008": {
    "id": "E-HND-008",
    "cls": "validation",
    "message": "返事の期限は今より後にしてください",
    "action": "返事の期限を今より後にする",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-009": {
    "id": "E-HND-009",
    "cls": "conflict",
    "message": "完了した・消したチケットは渡せません",
    "action": "開き直してから、別のチケットで渡す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-HND-009",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-010": {
    "id": "E-HND-010",
    "cls": "validation",
    "message": "自分には渡せません。別の人を選んでください",
    "action": "別の人を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-011": {
    "id": "E-HND-011",
    "cls": "validation",
    "message": "一緒に切り替えるものの選び方が、ワークスペースの決まりと合いません",
    "action": "切り替えるものを選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-012": {
    "id": "E-HND-012",
    "cls": "validation",
    "message": "渡す先のグループが見つかりません。選び直してください",
    "action": "グループを選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-013": {
    "id": "E-HND-013",
    "cls": "validation",
    "message": "渡す相手を選んでください",
    "action": "相手を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-013",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-014": {
    "id": "E-HND-014",
    "cls": "validation",
    "message": "選んだ人が見つかりません。選び直してください",
    "action": "相手を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-080": {
    "id": "E-HND-080",
    "cls": "conflict",
    "message": "今日はもう催促しました",
    "action": "明日もう一度押す",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-080",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-081": {
    "id": "E-HND-081",
    "cls": "conflict",
    "message": "この渡しは催促できません",
    "action": "取り消すか、返事を待つ",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-081",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-130": {
    "id": "E-HND-130",
    "cls": "conflict",
    "message": "閲覧のみの人・ゲストには配れません",
    "action": "別の人を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-130",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-131": {
    "id": "E-HND-131",
    "cls": "conflict",
    "message": "この人はもう担当者です",
    "action": "別の人を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-HND-131",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-150": {
    "id": "E-HND-150",
    "cls": "conflict",
    "message": "このグループの人を選んでください",
    "action": "グループの人を選び直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-HND-150",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-151": {
    "id": "E-HND-151",
    "cls": "conflict",
    "message": "この人は担当者にできません。止まっている人・閲覧のみの人は選べません",
    "action": "別の人を選ぶ",
    "undo": false,
    "severity": "medium",
    "support_code": "E-HND-151",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-HND-152": {
    "id": "E-HND-152",
    "cls": "conflict",
    "message": "グループに配られたものは断れません。自分が持つか、人を決めてください",
    "action": "自分が持つか、人を決める",
    "undo": false,
    "severity": "medium",
    "support_code": "E-HND-152",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-INV-009": {
    "id": "E-INV-009",
    "cls": "validation",
    "message": "メールの形ではありません",
    "action": "宛てを直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "invite"
    }
  },
  "E-INV-010": {
    "id": "E-INV-010",
    "cls": "conflict",
    "message": "もうこのワークスペースに入っています",
    "action": "その宛てを外す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "invite"
    }
  },
  "E-INV-011": {
    "id": "E-INV-011",
    "cls": "not_found",
    "message": "このグループには招けません",
    "action": "グループを選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "invite"
    }
  },
  "E-INV-012": {
    "id": "E-INV-012",
    "cls": "validation",
    "message": "一度に招けるのは 50 人までです",
    "action": "宛てを分けて招く",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members",
      "state": "invite"
    }
  },
  "E-INV-013": {
    "id": "E-INV-013",
    "cls": "validation",
    "message": "メールアドレスを入れてください",
    "action": "メールアドレスを入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-013",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-020": {
    "id": "E-INV-020",
    "cls": "conflict",
    "message": "メールアドレスを入れてください",
    "action": "メールアドレスを入れて、もう一度参加する",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-014": {
    "id": "E-INV-014",
    "cls": "not_found",
    "message": "確認のリンクの期限（24 時間）が過ぎました。招待のリンクから、もう一度参加してください",
    "action": "招待のリンクから、もう一度参加する",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-INV-015": {
    "id": "E-INV-015",
    "cls": "not_found",
    "message": "この確認のリンクはもう使われています。ログインして入ってください",
    "action": "ログインして入る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-015",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "invite-accept",
      "state": "a"
    }
  },
  "E-SEC-004": {
    "id": "E-SEC-004",
    "cls": "conflict",
    "message": "先に直されました。読み直してから、もう一度直してください",
    "action": "読み直してもう一度",
    "undo": false,
    "severity": "low",
    "support_code": "E-SEC-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SEC-005": {
    "id": "E-SEC-005",
    "cls": "conflict",
    "message": "このチケットは完了しています。完了したチケットの本文は変えられません",
    "action": "新しいチケットで書く",
    "undo": false,
    "severity": "low",
    "support_code": "E-SEC-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SEC-020": {
    "id": "E-SEC-020",
    "cls": "conflict",
    "message": "もう同じ中身です",
    "action": "別の版を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-SEC-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SPEC-001": {
    "id": "E-SPEC-001",
    "cls": "conflict",
    "message": "このチケットは完了しています。完了したチケットの確認項目は変えられません",
    "action": "新しいチケットで確かめる",
    "undo": false,
    "severity": "low",
    "support_code": "E-SPEC-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SPEC-020": {
    "id": "E-SPEC-020",
    "cls": "conflict",
    "message": "別の人が先にこの確認項目を変えました。読み直してから、もう一度お試しください",
    "action": "読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-SPEC-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SPEC-021": {
    "id": "E-SPEC-021",
    "cls": "conflict",
    "message": "チェックが付いている確認項目の文は直せません。チェックを外してから直してください",
    "action": "チェックを外す",
    "undo": false,
    "severity": "low",
    "support_code": "E-SPEC-021",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-SPEC-022": {
    "id": "E-SPEC-022",
    "cls": "conflict",
    "message": "ナレッジの「必ず守る」から入った確認項目は、文を直したり外したりできません。チェックの付け外しだけできます",
    "action": "チェックを付け外しする",
    "undo": false,
    "severity": "low",
    "support_code": "E-SPEC-022",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-VAL-028": {
    "id": "E-VAL-028",
    "cls": "conflict",
    "message": "開始日は期限より前の日にしてください",
    "action": "開始日か期限を入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "VAL-028",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "create"
    }
  },
  "E-DUP-001": {
    "id": "E-DUP-001",
    "cls": "not_found",
    "message": "複製の元のチケットが見つかりませんでした。消されたか、見る権限が無いかもしれません",
    "action": "元を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "DUP-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "duplicate"
    }
  },
  "E-DUP-002": {
    "id": "E-DUP-002",
    "cls": "conflict",
    "message": "子チケットを写すと、親子が 3 段を超えます。子を写さないか、別の親を選んでください",
    "action": "子を写さずに作る",
    "undo": false,
    "severity": "low",
    "support_code": "DUP-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "duplicate"
    }
  },
  "E-TKT-001": {
    "id": "E-TKT-001",
    "cls": "conflict",
    "message": "自分自身は親にできません",
    "action": "別のチケットを親に選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "TKT-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "detail"
    }
  },
  "E-TKT-002": {
    "id": "E-TKT-002",
    "cls": "conflict",
    "message": "自分の下にあるチケットは親にできません（親子が輪になります）",
    "action": "自分の下にないチケットを親に選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "TKT-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "detail"
    }
  },
  "E-TKT-003": {
    "id": "E-TKT-003",
    "cls": "conflict",
    "message": "親子は 3 段までです。もっと上の段のチケットを親にしてください",
    "action": "3 段に収まる親を選ぶ（または先に子の段を減らす）",
    "undo": false,
    "severity": "low",
    "support_code": "TKT-003",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "detail"
    }
  },
  "E-TKT-004": {
    "id": "E-TKT-004",
    "cls": "conflict",
    "message": "このチケットの期限が親の期限より後です。期限を親に合わせてから、親を決めてください",
    "action": "期限を親の期限以前に直してから親を決める",
    "undo": false,
    "severity": "low",
    "support_code": "TKT-004",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "detail"
    }
  },
  "E-LNK-001": {
    "id": "E-LNK-001",
    "cls": "conflict",
    "message": "同じチケットとはつなげられません",
    "action": "ほかのチケットを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-LNK-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "links"
    }
  },
  "E-LNK-002": {
    "id": "E-LNK-002",
    "cls": "conflict",
    "message": "このチケットとは、もうつながっています",
    "action": "つながりの一覧を見る",
    "undo": false,
    "severity": "low",
    "support_code": "E-LNK-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "links"
    }
  },
  "E-LNK-003": {
    "id": "E-LNK-003",
    "cls": "conflict",
    "message": "派生元が輪になるので、つなげられません",
    "action": "ほかのチケットを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-LNK-003",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "links"
    }
  },
  "E-SEC-006": {
    "id": "E-SEC-006",
    "cls": "permission",
    "message": "この操作をする権限がありません。権限が変わったかもしれません。画面を読み直してください",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-SEC-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-NTF-001": {
    "id": "E-NTF-001",
    "cls": "conflict",
    "message": "お知らせの続きを読めませんでした。最初から読み直してください",
    "action": "最初から読み直す（続きの鍵を付けずに開き直す）",
    "undo": false,
    "severity": "low",
    "support_code": "E-NTF-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "notifications"
    }
  },
  "E-NTF-010": {
    "id": "E-NTF-010",
    "cls": "not_found",
    "message": "このお知らせは見つかりませんでした",
    "action": "一覧を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-NTF-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "notifications"
    }
  },
  "E-SRC-001": {
    "id": "E-SRC-001",
    "cls": "validation",
    "message": "探す言葉は 100 文字までにしてください",
    "action": "探す言葉を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "E-SRC-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "search"
    }
  },
  "E-SRC-002": {
    "id": "E-SRC-002",
    "cls": "validation",
    "message": "探す種類は チケット・決定・会話・ナレッジ から選んでください",
    "action": "種類を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-SRC-002",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "search"
    }
  },
  "E-LST-001": {
    "id": "E-LST-001",
    "cls": "conflict",
    "message": "一覧の続きを読めませんでした。最初から読み直してください",
    "action": "最初から読み直す（続きの鍵を付けずに開き直す）",
    "undo": false,
    "severity": "low",
    "support_code": "E-LST-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "list"
    }
  },
  "E-VWS-001": {
    "id": "E-VWS-001",
    "cls": "validation",
    "message": "名前を入れてください",
    "action": "名前を入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-002": {
    "id": "E-VWS-002",
    "cls": "validation",
    "message": "名前は 60 文字までにしてください",
    "action": "名前を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-003": {
    "id": "E-VWS-003",
    "cls": "validation",
    "message": "グループの全員に見せるときは、見せるグループを選んでください",
    "action": "見せるグループを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-004": {
    "id": "E-VWS-004",
    "cls": "not_found",
    "message": "見せるグループが見つかりませんでした。消されたか、見る権限が無いかもしれません",
    "action": "見せるグループを選び直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-VWS-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-005": {
    "id": "E-VWS-005",
    "cls": "conflict",
    "message": "同じ名前の保存した条件が、もうあります。別の名前にしてください",
    "action": "別の名前にする",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-006": {
    "id": "E-VWS-006",
    "cls": "conflict",
    "message": "保存できる条件は 50 件までです。いらないものを消してから保存してください",
    "action": "いらない条件を消す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-007": {
    "id": "E-VWS-007",
    "cls": "validation",
    "message": "条件の形が正しくありません。条件・列の並び・大きさを確かめてください",
    "action": "条件を作り直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-007",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-008": {
    "id": "E-VWS-008",
    "cls": "validation",
    "message": "名前に改行などの制御文字は使えません",
    "action": "名前を打ち直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-020": {
    "id": "E-VWS-020",
    "cls": "permission",
    "message": "見せる相手を変えられるのは、作った人だけです",
    "action": "名前や条件だけを直す（見せる相手は作った人に頼む）",
    "undo": false,
    "severity": "medium",
    "support_code": "E-VWS-020",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-VWS-021": {
    "id": "E-VWS-021",
    "cls": "conflict",
    "message": "グループの全員に見せている条件から、見せるグループは外せません。先に「自分だけ」に変えてください",
    "action": "先に「自分だけ」に変える",
    "undo": false,
    "severity": "low",
    "support_code": "E-VWS-021",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "save"
    }
  },
  "E-DUE-001": {
    "id": "E-DUE-001",
    "cls": "validation",
    "message": "期限を変える理由を書いてください",
    "action": "理由を書いてから変える",
    "undo": false,
    "severity": "low",
    "support_code": "DUE-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "due"
    }
  },
  "E-DUE-002": {
    "id": "E-DUE-002",
    "cls": "validation",
    "message": "理由は 200 文字までにしてください",
    "action": "理由を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "DUE-002",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "due"
    }
  },
  "E-DUE-005": {
    "id": "E-DUE-005",
    "cls": "conflict",
    "message": "子のチケットの期限は、親のチケットの期限より後にできません",
    "action": "親の期限を先に延ばすか、親の期限までの日にする",
    "undo": false,
    "severity": "low",
    "support_code": "DUE-005",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "due"
    }
  },
  "E-DUE-006": {
    "id": "E-DUE-006",
    "cls": "conflict",
    "message": "この期限より後の期限を持つ子のチケットがあります。先に子の期限を変えてください",
    "action": "子の期限を先に変える",
    "undo": false,
    "severity": "low",
    "support_code": "DUE-006",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "due"
    }
  },
  "E-DUE-007": {
    "id": "E-DUE-007",
    "cls": "conflict",
    "message": "完了したチケットの期限は変えられません",
    "action": "開き直してから変える",
    "undo": false,
    "severity": "low",
    "support_code": "DUE-007",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "due"
    }
  },
  "E-DUE-008": {
    "id": "E-DUE-008",
    "cls": "conflict",
    "message": "ほかの人が先に期限を変えました。開き直してから、もう一度変えてください",
    "action": "開き直してから変える",
    "undo": false,
    "severity": "low",
    "support_code": "DUE-008",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "due"
    }
  },
  "E-STP-001": {
    "id": "E-STP-001",
    "cls": "permission",
    "message": "自分で直すにできるのは、このチケットの担当者だけです",
    "action": "担当者に頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-STP-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-002": {
    "id": "E-STP-002",
    "cls": "conflict",
    "message": "いまは自分で直すに切り替えられません（承認待ち・完了のとき、または承認の後の実行です）",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STP-002",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "awaiting_approval"
    }
  },
  "E-STP-003": {
    "id": "E-STP-003",
    "cls": "conflict",
    "message": "もう自分で進めることにしています",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STP-003",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-004": {
    "id": "E-STP-004",
    "cls": "conflict",
    "message": "この実行はもう新しい実行に替わっています",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STP-004",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-010": {
    "id": "E-STP-010",
    "cls": "timeout",
    "message": "承認から 24 時間を過ぎたので、実行の前にもう一度確かめます",
    "action": "承認をもう一度確かめる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-STP-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-011": {
    "id": "E-STP-011",
    "cls": "connectivity",
    "message": "AI がブラウザを使えませんでした。Chrome を開き、拡張機能「Claude in Chrome」が入っていて、この Claude と同じアカウントでログインしているか確かめてください",
    "action": "Chrome と拡張機能を確かめる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-STP-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-STP-012": {
    "id": "E-STP-012",
    "cls": "dependency",
    "message": "AI が途中で止まりました（理由の種類は分かりません）。もう一度「AI に任せる」か、自分で直すを選べます",
    "action": "AI に任せ直す／自分で直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STP-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets",
      "state": "stopped"
    }
  },
  "E-DEL-001": {
    "id": "E-DEL-001",
    "cls": "permission",
    "message": "このチケットを消せるのは、作った人と、このグループで編集の権限を持つ人です",
    "action": "作った人か権限のある人に頼む",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-010": {
    "id": "E-DEL-010",
    "cls": "conflict",
    "message": "このチケットには子・孫がいます。別の親へ移す・一緒に消す・親を外して残す、のどれかを選んでください",
    "action": "扱いを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-011": {
    "id": "E-DEL-011",
    "cls": "conflict",
    "message": "子の移し先に、消すチケット自身やその子・孫は選べません",
    "action": "別の親を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-012": {
    "id": "E-DEL-012",
    "cls": "conflict",
    "message": "その親に移すと、親子が 3 段を超えます",
    "action": "浅い親を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-013": {
    "id": "E-DEL-013",
    "cls": "permission",
    "message": "一緒に消す子・孫に、あなたが消せないチケットがあります",
    "action": "別の扱いを選ぶか、そのグループの人に頼む",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-013",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-014": {
    "id": "E-DEL-014",
    "cls": "not_found",
    "message": "子の移し先のチケットが見つかりませんでした",
    "action": "親を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-014",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-040": {
    "id": "E-DEL-040",
    "cls": "permission",
    "message": "消したチケットを戻せるのは、消した本人と、このグループのマネージャー・管理者です",
    "action": "消した人かマネージャーに頼む",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-040",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-041": {
    "id": "E-DEL-041",
    "cls": "conflict",
    "message": "このチケットはもう戻っています",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-041",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-042": {
    "id": "E-DEL-042",
    "cls": "conflict",
    "message": "消してから 30 日を過ぎているので、もう戻せません",
    "action": "戻せないので、必要なら新しく作る",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-042",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-DEL-043": {
    "id": "E-DEL-043",
    "cls": "conflict",
    "message": "このチケットの親が消えています。先に親を戻してください",
    "action": "親を先に戻す",
    "undo": false,
    "severity": "low",
    "support_code": "E-DEL-043",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-FLD-001": {
    "id": "E-FLD-001",
    "cls": "conflict",
    "message": "この項目は、このチケットの種別では使えません",
    "action": "項目の一覧を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "FLD-001",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "detail"
    }
  },
  "E-FLD-002": {
    "id": "E-FLD-002",
    "cls": "conflict",
    "message": "選べない値が含まれています。選択肢から選び直してください",
    "action": "選択肢から選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "FLD-002",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "detail"
    }
  },
  "E-FLD-003": {
    "id": "E-FLD-003",
    "cls": "conflict",
    "message": "この項目に入れられない形の値です",
    "action": "値を入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "FLD-003",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "detail"
    }
  },
  "E-FLD-004": {
    "id": "E-FLD-004",
    "cls": "conflict",
    "message": "必須の項目は空にできません。値を入れてください",
    "action": "値を入れる",
    "undo": false,
    "severity": "low",
    "support_code": "FLD-004",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "detail"
    }
  },
  "E-CONF-020": {
    "id": "E-CONF-020",
    "cls": "conflict",
    "message": "確認項目が 1 つもありません。確認項目を足すか、使わない理由を書いてから任せてください",
    "action": "確認項目を足す／理由を書く",
    "undo": false,
    "severity": "medium",
    "support_code": "CONF-020",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "delegate"
    }
  },
  "E-ITM-001": {
    "id": "E-ITM-001",
    "cls": "conflict",
    "message": "完了したチケットの項目は、戻せません",
    "action": "戻さずに閉じる",
    "undo": false,
    "severity": "low",
    "support_code": "E-ITM-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-ITM-002": {
    "id": "E-ITM-002",
    "cls": "conflict",
    "message": "先に項目が変えられました。読み直してから、もう一度戻してください",
    "action": "読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-ITM-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-ITM-003": {
    "id": "E-ITM-003",
    "cls": "conflict",
    "message": "戻す項目がありません",
    "action": "比べる点を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-ITM-003",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-KNW-010": {
    "id": "E-KNW-010",
    "cls": "conflict",
    "message": "このページはまだ書き終えていません。書き終えてから使ってください",
    "action": "書き終える",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-011": {
    "id": "E-KNW-011",
    "cls": "conflict",
    "message": "このページを上の棚へ上げる（共有する）頼みが承認待ちです。決まるまでは変えられません",
    "action": "頼みを取り下げる／決まるのを待つ",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-012": {
    "id": "E-KNW-012",
    "cls": "conflict",
    "message": "ほかの人がこのページを書いています。書き終えるまで待ってください",
    "action": "少し待つ",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-020": {
    "id": "E-KNW-020",
    "cls": "conflict",
    "message": "同じ場所に同じ名前のフォルダがあります",
    "action": "名前を変える",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-021": {
    "id": "E-KNW-021",
    "cls": "conflict",
    "message": "フォルダは 6 つ入れ子までです",
    "action": "浅い所に置く",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-021",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-022": {
    "id": "E-KNW-022",
    "cls": "conflict",
    "message": "フォルダを自分の中には動かせません",
    "action": "別の場所を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-022",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-023": {
    "id": "E-KNW-023",
    "cls": "conflict",
    "message": "フォルダは別の棚には動かせません",
    "action": "同じ棚の中で動かす",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-023",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-024": {
    "id": "E-KNW-024",
    "cls": "conflict",
    "message": "中にページかフォルダがあるので消せません",
    "action": "先に動かすか消す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-024",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-030": {
    "id": "E-KNW-030",
    "cls": "conflict",
    "message": "捨てる下書きがありません",
    "action": "画面を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-030",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-040": {
    "id": "E-KNW-040",
    "cls": "conflict",
    "message": "書き終える下書きがありません",
    "action": "画面を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-040",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-041": {
    "id": "E-KNW-041",
    "cls": "conflict",
    "message": "「必ず守る」のページは本文を 2,000 字までにしてください",
    "action": "本文を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-041",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-050": {
    "id": "E-KNW-050",
    "cls": "conflict",
    "message": "「必ず守る」が付いているので消せません",
    "action": "先に外す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-050",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-051": {
    "id": "E-KNW-051",
    "cls": "conflict",
    "message": "ほかのグループに共有しているので消せません",
    "action": "先に共有をやめる",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-051",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-052": {
    "id": "E-KNW-052",
    "cls": "conflict",
    "message": "ページは別の棚には動かせません。上の棚へは「上げる」を使ってください",
    "action": "「上げる」を使う",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-052",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-060": {
    "id": "E-KNW-060",
    "cls": "conflict",
    "message": "「必ず守る」の上限に届きました",
    "action": "今付いているページから外す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-060",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-061": {
    "id": "E-KNW-061",
    "cls": "conflict",
    "message": "本文が 2,000 字を超えているので、「必ず守る」は付けられません",
    "action": "本文を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-061",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-080": {
    "id": "E-KNW-080",
    "cls": "conflict",
    "message": "自分の棚のページは写せません",
    "action": "上の棚のページを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-080",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-100": {
    "id": "E-KNW-100",
    "cls": "conflict",
    "message": "このページは会社の棚にあるので、これより上へは上げられません",
    "action": "画面を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-100",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-101": {
    "id": "E-KNW-101",
    "cls": "conflict",
    "message": "上げる先のグループを選んでください",
    "action": "グループを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-101",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-102": {
    "id": "E-KNW-102",
    "cls": "conflict",
    "message": "上げる先に承認できる人がいません。管理者に知らせてください",
    "action": "管理者に知らせる",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-102",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-103": {
    "id": "E-KNW-103",
    "cls": "conflict",
    "message": "入れるフォルダは、上げる先の棚から選んでください",
    "action": "フォルダを選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-103",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-104": {
    "id": "E-KNW-104",
    "cls": "conflict",
    "message": "この頼みはもう決まっているので、取り下げられません",
    "action": "画面を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-104",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-105": {
    "id": "E-KNW-105",
    "cls": "conflict",
    "message": "消せるのは、断られた頼みの帯だけです",
    "action": "画面を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-105",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-106": {
    "id": "E-KNW-106",
    "cls": "conflict",
    "message": "共有しているページは上げられません。先に共有をやめてください",
    "action": "共有をやめる",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-106",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-110": {
    "id": "E-KNW-110",
    "cls": "conflict",
    "message": "この頼みはもう決まっています",
    "action": "画面を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-110",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-111": {
    "id": "E-KNW-111",
    "cls": "conflict",
    "message": "頼んだ人がもうそのグループにいないので、承認できません",
    "action": "断る",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-111",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-120": {
    "id": "E-KNW-120",
    "cls": "conflict",
    "message": "元のグループには共有できません",
    "action": "別のグループを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-120",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-121": {
    "id": "E-KNW-121",
    "cls": "conflict",
    "message": "共有できるのは、グループの棚のページとフォルダだけです",
    "action": "上げるなど別の道を使う",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-121",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-122": {
    "id": "E-KNW-122",
    "cls": "conflict",
    "message": "共有先に承認できる人がいません。そのグループのマネージャーに知らせてください",
    "action": "マネージャーを決めてもらう",
    "undo": false,
    "severity": "low",
    "support_code": "E-KNW-122",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "knowledge"
    }
  },
  "E-KNW-240": {
    "id": "E-KNW-240",
    "cls": "conflict",
    "message": "必ず守る決まりから入った確認項目に、チェックの付いていない物があるので、まだ完了にできません",
    "action": "確認項目に戻る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-KNW-240",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-KND-001": {
    "id": "E-KND-001",
    "cls": "conflict",
    "message": "同じ名前の種別がすでにあります",
    "action": "名前を変える",
    "undo": false,
    "severity": "medium",
    "support_code": "KND-001",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters",
      "state": "set-kinds"
    }
  },
  "E-KND-002": {
    "id": "E-KND-002",
    "cls": "conflict",
    "message": "種別は 10 までです",
    "action": "使っていない種別を消してから足す",
    "undo": false,
    "severity": "medium",
    "support_code": "KND-002",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters",
      "state": "set-kinds"
    }
  },
  "E-KND-003": {
    "id": "E-KND-003",
    "cls": "conflict",
    "message": "この種別を使っているチケットがあるので、消せません",
    "action": "使っているチケットを別の種別に移してから消す",
    "undo": false,
    "severity": "medium",
    "support_code": "KND-003",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters",
      "state": "set-kinds"
    }
  },
  "E-KND-004": {
    "id": "E-KND-004",
    "cls": "conflict",
    "message": "並びが古くなっています。開き直してください",
    "action": "画面を開き直してから並べる",
    "undo": false,
    "severity": "medium",
    "support_code": "KND-004",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters",
      "state": "set-kinds"
    }
  },
  "E-KND-005": {
    "id": "E-KND-005",
    "cls": "conflict",
    "message": "最後の 1 つの種別は消せません",
    "action": "先に別の種別を足してから消す",
    "undo": false,
    "severity": "medium",
    "support_code": "KND-005",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters",
      "state": "set-kinds"
    }
  },
  "E-STG-001": {
    "id": "E-STG-001",
    "cls": "conflict",
    "message": "同じ名前の状態がすでにあります",
    "action": "別の名前にする",
    "undo": false,
    "severity": "low",
    "support_code": "E-STG-001",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-STG-002": {
    "id": "E-STG-002",
    "cls": "conflict",
    "message": "状態は 8 つまで足せます",
    "action": "使っていない状態を消してから足す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STG-002",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-STG-003": {
    "id": "E-STG-003",
    "cls": "conflict",
    "message": "この状態は仕組みが使うので、消せません",
    "action": "消さずに名前や色を直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STG-003",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-STG-004": {
    "id": "E-STG-004",
    "cls": "conflict",
    "message": "この状態の名前は変えられません",
    "action": "色だけを直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STG-004",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-STG-005": {
    "id": "E-STG-005",
    "cls": "conflict",
    "message": "この状態のチケットがあるので、消せません",
    "action": "チケットを別の状態に移してから消す",
    "undo": false,
    "severity": "low",
    "support_code": "E-STG-005",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-STG-006": {
    "id": "E-STG-006",
    "cls": "conflict",
    "message": "並びが古くなっています。開き直してください",
    "action": "開き直してから並べる",
    "undo": false,
    "severity": "low",
    "support_code": "E-STG-006",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-STG-007": {
    "id": "E-STG-007",
    "cls": "conflict",
    "message": "始めの状態は先頭に、終わりの状態は最後に置きます",
    "action": "始めを先頭・終わりを最後にして並べる",
    "undo": false,
    "severity": "low",
    "support_code": "E-STG-007",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-FMS-001": {
    "id": "E-FMS-001",
    "cls": "conflict",
    "message": "同じ名前の項目がすでにあります",
    "action": "別の名前にする",
    "undo": false,
    "severity": "low",
    "support_code": "E-FMS-001",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-FMS-004": {
    "id": "E-FMS-004",
    "cls": "conflict",
    "message": "同じ名前の選ぶ物があります",
    "action": "選ぶ物の名前を変える",
    "undo": false,
    "severity": "low",
    "support_code": "E-FMS-004",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-FMS-002": {
    "id": "E-FMS-002",
    "cls": "conflict",
    "message": "値が入っている項目は、型を変えられません",
    "action": "型はそのままにするか、新しい項目を足す",
    "undo": false,
    "severity": "low",
    "support_code": "E-FMS-002",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-FMS-003": {
    "id": "E-FMS-003",
    "cls": "conflict",
    "message": "並びが今の項目と合いません",
    "action": "画面を開き直してから並べる",
    "undo": false,
    "severity": "low",
    "support_code": "E-FMS-003",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-FMS-005": {
    "id": "E-FMS-005",
    "cls": "conflict",
    "message": "選ぶ型でない項目には、選ぶ物を付けられません",
    "action": "型を選ぶ型に変えてから選ぶ物を足す",
    "undo": false,
    "severity": "low",
    "support_code": "E-FMS-005",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters"
    }
  },
  "E-RUN-001": {
    "id": "E-RUN-001",
    "cls": "permission",
    "message": "この AI を止められるのは担当者です",
    "action": "担当者に頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-RUN-001",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "running"
    }
  },
  "E-RUN-002": {
    "id": "E-RUN-002",
    "cls": "conflict",
    "message": "この実行はもう止まっています（または作り終えています）",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-RUN-002",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "running"
    }
  },
  "E-APR-010": {
    "id": "E-APR-010",
    "cls": "conflict",
    "message": "もう実行が始まっています。止めるには［止める］を押してください",
    "action": "［止める］を押す",
    "undo": false,
    "severity": "low",
    "support_code": "E-APR-010",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "running"
    }
  },
  "E-APR-011": {
    "id": "E-APR-011",
    "cls": "conflict",
    "message": "この承認は取り下げられません（まだ承認していない・もう取り下げた・片付けられたのどれかです）",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-APR-011",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "running"
    }
  },
  "E-APR-012": {
    "id": "E-APR-012",
    "cls": "conflict",
    "message": "もう実行が終わっています。画面を読み直してください",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-APR-012",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "running"
    }
  },
  "E-APR-020": {
    "id": "E-APR-020",
    "cls": "conflict",
    "message": "先にほかの人が成果物を直していました。開き直して、続きから直してください",
    "action": "開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-APR-020",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "awaiting_approval"
    }
  },
  "E-APR-021": {
    "id": "E-APR-021",
    "cls": "conflict",
    "message": "成果物は変わっていません。直してから保存してください",
    "action": "字を直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-APR-021",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "awaiting_approval"
    }
  },
  "E-RUN-003": {
    "id": "E-RUN-003",
    "cls": "conflict",
    "message": "承認待ちの成果物が無いので、試し打ちできません",
    "action": "画面を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-RUN-003",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "awaiting_approval"
    }
  },
  "E-RUN-004": {
    "id": "E-RUN-004",
    "cls": "conflict",
    "message": "試し打ちを動かす AI が使えません",
    "action": "理由（detail.reason）を読んで、担当者・PC を直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-RUN-004",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "awaiting_approval"
    }
  },
  "E-RUN-005": {
    "id": "E-RUN-005",
    "cls": "conflict",
    "message": "あなたのメールアドレスが分からないので、試し打ちできません",
    "action": "運営に連絡する",
    "undo": false,
    "severity": "low",
    "support_code": "E-RUN-005",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "awaiting_approval"
    }
  },
  "E-TALK-010": {
    "id": "E-TALK-010",
    "cls": "conflict",
    "message": "PC がつながっていません。自分の PC をつなぐと話せます",
    "action": "PC をつなぐ",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-010",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "clone-chat"
    }
  },
  "E-TALK-011": {
    "id": "E-TALK-011",
    "cls": "conflict",
    "message": "この会話には、ここからは話せません。チケットの右のパネル、または作る画面から話してください",
    "action": "会話を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-011",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "clone-chat"
    }
  },
  "E-TALK-012": {
    "id": "E-TALK-012",
    "cls": "conflict",
    "message": "返事を待っている言葉が多すぎます。いくつか返事が来てから、もう一度送ってください",
    "action": "少し待つ",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-012",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "clone-chat"
    }
  },
  "E-TALK-020": {
    "id": "E-TALK-020",
    "cls": "connectivity",
    "message": "いまは書きながらの返事を送れません。画面が少しずつ読み直します",
    "action": "待つ（画面が自分で読み直す）",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-020",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "clone-chat"
    }
  },
  "E-TALK-030": {
    "id": "E-TALK-030",
    "cls": "conflict",
    "message": "この仕事は会話の仕事ではないので、文を写せません",
    "action": "写さない（PC は送り直さない）",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-030",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "bridge-setup"
    }
  },
  "E-TALK-040": {
    "id": "E-TALK-040",
    "cls": "external",
    "message": "資料の場所を出せませんでした。少し待ってから、もう一度お試しください",
    "action": "待ってやり直す（PC は取れなかった資料を名前と理由で文に添えて続ける）",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-040",
    "must_not": false,
    "layers": [
      "API",
      "C4"
    ],
    "where": {
      "screen": "clone-chat",
      "choke_point": "C4"
    }
  },
  "E-TALK-050": {
    "id": "E-TALK-050",
    "cls": "conflict",
    "message": "PC がまだつながっていません。PC をつなぐと、このチケットのことを話せます",
    "action": "PC をつなぐ",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-050",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-APR-030": {
    "id": "E-APR-030",
    "cls": "conflict",
    "message": "承認待ちが 50 件を超えているので、まとめて承認できません。選んで承認してください",
    "action": "50 件以内を選んで承認する",
    "undo": false,
    "severity": "low",
    "support_code": "E-APR-030",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "approvals",
      "state": "queue"
    }
  },
  "E-TALK-060": {
    "id": "E-TALK-060",
    "cls": "conflict",
    "message": "PC がまだつながっていません。PC をつなぐと、AI と話しながらチケットを作れます",
    "action": "PC をつなぐ",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-060",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-TALK-061": {
    "id": "E-TALK-061",
    "cls": "conflict",
    "message": "この会話は、チケットを作る画面の会話ではありません。新しく話し始めてください",
    "action": "新しく話す",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-061",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-TALK-070": {
    "id": "E-TALK-070",
    "cls": "conflict",
    "message": "この仕事で出せる案は 3 回までです。続きは、人の返事を待ってください",
    "action": "人の返事を待つ",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-070",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-TALK-080": {
    "id": "E-TALK-080",
    "cls": "permission",
    "message": "作る時の会話を移せるのは、そのチケットを作った人だけです",
    "action": "作った人に頼む",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-080",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-TALK-081": {
    "id": "E-TALK-081",
    "cls": "conflict",
    "message": "この会話は、チケットに移せません",
    "action": "—",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-081",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-TALK-082": {
    "id": "E-TALK-082",
    "cls": "conflict",
    "message": "この会話は、もうチケットに移しています",
    "action": "チケットの右のパネルで続ける",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-082",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-TALK-062": {
    "id": "E-TALK-062",
    "cls": "permission",
    "message": "チケットを作る権限が無いので、作る画面の AI と話せません",
    "action": "チケットを作る権限を持つ人に頼む",
    "undo": false,
    "severity": "low",
    "support_code": "E-TALK-062",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets"
    }
  },
  "E-GRP-001": {
    "id": "E-GRP-001",
    "cls": "validation",
    "message": "名前は 1〜100 文字で入れてください",
    "action": "名前を入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-001",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-002": {
    "id": "E-GRP-002",
    "cls": "not_found",
    "message": "直すグループが見つかりません。開き直してください",
    "action": "メンバーの画面を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-002",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-003": {
    "id": "E-GRP-003",
    "cls": "validation",
    "message": "短い名前は、英大文字で始まる英大文字と数字の 1〜8 文字で入れてください（T だけは使えません）",
    "action": "短い名前を入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-003",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-004": {
    "id": "E-GRP-004",
    "cls": "validation",
    "message": "変える項目がありません",
    "action": "変える項目を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-005": {
    "id": "E-GRP-005",
    "cls": "validation",
    "message": "色は、決まった 6 つから選んでください",
    "action": "色を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-005",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-006": {
    "id": "E-GRP-006",
    "cls": "validation",
    "message": "層の名前は 1〜40 文字で入れてください",
    "action": "層の名前を入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-006",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-007": {
    "id": "E-GRP-007",
    "cls": "not_found",
    "message": "直す層が見つかりません。開き直してください",
    "action": "メンバーの画面を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-007",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-008": {
    "id": "E-GRP-008",
    "cls": "validation",
    "message": "並びの番号は 1 以上の整数にしてください",
    "action": "並びを直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-008",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-009": {
    "id": "E-GRP-009",
    "cls": "validation",
    "message": "マネージャーは 10 人まで、メンバーは 50 人までです",
    "action": "選ぶ人を減らす",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-009",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-010": {
    "id": "E-GRP-010",
    "cls": "conflict",
    "message": "その短い名前は、ほかのグループが使っています",
    "action": "別の短い名前にする",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GRP-010",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-011": {
    "id": "E-GRP-011",
    "cls": "conflict",
    "message": "同じ上のグループに、同じ名前のグループがあります",
    "action": "別の名前にする",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GRP-011",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-012": {
    "id": "E-GRP-012",
    "cls": "conflict",
    "message": "グループは 1 つのワークスペースで 200 までです",
    "action": "使っていないグループを消す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GRP-012",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-013": {
    "id": "E-GRP-013",
    "cls": "conflict",
    "message": "層は 8 段までです",
    "action": "層を増やさずに作る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GRP-013",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-014": {
    "id": "E-GRP-014",
    "cls": "not_found",
    "message": "上のグループが見つかりません。選び直してください",
    "action": "上のグループを選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-014",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-015": {
    "id": "E-GRP-015",
    "cls": "not_found",
    "message": "選んだ人が見つかりません。選び直してください",
    "action": "人を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-015",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-016": {
    "id": "E-GRP-016",
    "cls": "conflict",
    "message": "{名前}さんは今は選べません（{訳}）。別の人を選んでください",
    "action": "別の人を選ぶ",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GRP-016",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-017": {
    "id": "E-GRP-017",
    "cls": "conflict",
    "message": "{名前}さんは閲覧のみなので、マネージャーにはできません",
    "action": "別の人を選ぶ",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GRP-017",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-019": {
    "id": "E-GRP-019",
    "cls": "conflict",
    "message": "同じ名前の層があります",
    "action": "別の名前にする",
    "undo": false,
    "severity": "medium",
    "support_code": "E-GRP-019",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-GRP-020": {
    "id": "E-GRP-020",
    "cls": "not_found",
    "message": "選んだ層が見つかりません。選び直してください",
    "action": "層を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GRP-020",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-MEM-002": {
    "id": "E-MEM-002",
    "cls": "not_found",
    "message": "この人は見つかりません。メンバーの一覧を開き直してください",
    "action": "メンバーの一覧を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-MEM-002",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-MEM-003": {
    "id": "E-MEM-003",
    "cls": "conflict",
    "message": "自分の役割やグループは、自分では変えられません",
    "action": "ほかの管理者に頼む",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MEM-003",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-MEM-004": {
    "id": "E-MEM-004",
    "cls": "conflict",
    "message": "最後の管理者は、役割を下げることも、止めることも、外すこともできません",
    "action": "先にほかの人を管理者にする",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MEM-004",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-MEM-005": {
    "id": "E-MEM-005",
    "cls": "conflict",
    "message": "自分は止めることも外すこともできません。抜けるのは自分の設定からです",
    "action": "自分の設定から抜ける",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MEM-005",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-MEM-006": {
    "id": "E-MEM-006",
    "cls": "not_found",
    "message": "グループが見つかりません。選び直してください",
    "action": "グループを選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-MEM-006",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-MEM-007": {
    "id": "E-MEM-007",
    "cls": "conflict",
    "message": "この人は、そのグループに入っていません",
    "action": "先にグループに入れる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MEM-007",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-MEM-008": {
    "id": "E-MEM-008",
    "cls": "conflict",
    "message": "主のグループは、別のグループに移してから外してください",
    "action": "先に主のグループを移す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MEM-008",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-MEM-009": {
    "id": "E-MEM-009",
    "cls": "conflict",
    "message": "この人はもう止まっています",
    "action": "メンバーの一覧を開き直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MEM-009",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-MEM-010": {
    "id": "E-MEM-010",
    "cls": "conflict",
    "message": "この人は止まっていません",
    "action": "メンバーの一覧を開き直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-MEM-010",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-INV-016": {
    "id": "E-INV-016",
    "cls": "not_found",
    "message": "この招待は見つかりません。メンバーの一覧を開き直してください",
    "action": "メンバーの一覧を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INV-016",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-INV-017": {
    "id": "E-INV-017",
    "cls": "conflict",
    "message": "この招待はもう使われています",
    "action": "メンバーの一覧を開き直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-017",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-INV-018": {
    "id": "E-INV-018",
    "cls": "conflict",
    "message": "この招待はもう取り消されています",
    "action": "新しく招く",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-018",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-INV-019": {
    "id": "E-INV-019",
    "cls": "conflict",
    "message": "この招待は、今日もう送り直しました。明日また送れます",
    "action": "明日また送る",
    "undo": false,
    "severity": "medium",
    "support_code": "E-INV-019",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members"
    }
  },
  "E-AUD-001": {
    "id": "E-AUD-001",
    "cls": "validation",
    "message": "条件が正しくありません。選び直してください",
    "action": "条件を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-AUD-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "audit",
      "state": "a"
    }
  },
  "E-AUD-002": {
    "id": "E-AUD-002",
    "cls": "validation",
    "message": "続きの印が正しくありません。はじめから読み直してください",
    "action": "はじめから読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-AUD-002",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "audit",
      "state": "a"
    }
  },
  "E-WS-001": {
    "id": "E-WS-001",
    "cls": "validation",
    "message": "名前を入れてください",
    "action": "名前を入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-WS-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "company-settings",
      "state": "st-name-error"
    }
  },
  "E-WS-002": {
    "id": "E-WS-002",
    "cls": "validation",
    "message": "名前は 100 文字までです。短くしてください",
    "action": "名前を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "E-WS-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "company-settings",
      "state": "st-name-error"
    }
  },
  "E-WS-010": {
    "id": "E-WS-010",
    "cls": "limit",
    "message": "ロゴは 2 MB までです。小さい画像を選んでください",
    "action": "小さい画像を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "WS-010",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "company-settings",
      "state": "st-logo"
    }
  },
  "E-WS-011": {
    "id": "E-WS-011",
    "cls": "validation",
    "message": "ロゴは PNG・JPEG・WebP の画像にしてください",
    "action": "別の画像を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "WS-011",
    "must_not": true,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "company-settings",
      "state": "st-logo"
    }
  },
  "E-WS-012": {
    "id": "E-WS-012",
    "cls": "external",
    "message": "ロゴを置けませんでした。少し待ってやり直してください",
    "action": "少し待ってやり直す",
    "undo": false,
    "severity": "medium",
    "support_code": "WS-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "company-settings",
      "state": "st-logo"
    }
  },
  "E-WS-030": {
    "id": "E-WS-030",
    "cls": "conflict",
    "message": "名前が合っていません。ワークスペースの名前をそのまま打ってください",
    "action": "名前を打ち直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-WS-030",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "company-settings",
      "state": "st-delete"
    }
  },
  "E-WS-031": {
    "id": "E-WS-031",
    "cls": "conflict",
    "message": "すでに消す手続き中です",
    "action": "画面を開き直して、手続きの帯を見る",
    "undo": false,
    "severity": "low",
    "support_code": "E-WS-031",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "company-settings",
      "state": "st-deleting"
    }
  },
  "E-WS-032": {
    "id": "E-WS-032",
    "cls": "conflict",
    "message": "取り消せる 14 日を過ぎました",
    "action": "運営に問い合わせる",
    "undo": false,
    "severity": "medium",
    "support_code": "E-WS-032",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "company-settings",
      "state": "st-deleting"
    }
  },
  "E-WS-033": {
    "id": "E-WS-033",
    "cls": "conflict",
    "message": "消す手続き中ではありません",
    "action": "画面を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-WS-033",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "company-settings",
      "state": "st-deleting"
    }
  },
  "E-ME-001": {
    "id": "E-ME-001",
    "cls": "validation",
    "message": "名前を入れてください",
    "action": "名前を入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "profile"
    }
  },
  "E-ME-002": {
    "id": "E-ME-002",
    "cls": "validation",
    "message": "名前は 100 文字までです。短くしてください",
    "action": "名前を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "profile"
    }
  },
  "E-ME-003": {
    "id": "E-ME-003",
    "cls": "validation",
    "message": "呼ばれ方は 20 文字までです。短くしてください",
    "action": "呼ばれ方を短くする",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-003",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "profile"
    }
  },
  "E-ME-010": {
    "id": "E-ME-010",
    "cls": "limit",
    "message": "写真は 5 MB までです。小さい写真を選んでください",
    "action": "小さい写真を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-010",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A74",
      "screen": "account",
      "choke_point": "C4"
    }
  },
  "E-ME-011": {
    "id": "E-ME-011",
    "cls": "validation",
    "message": "写真は PNG・JPEG・WebP の画像にしてください",
    "action": "PNG・JPEG・WebP の写真を選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-011",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A74",
      "screen": "account"
    }
  },
  "E-ME-012": {
    "id": "E-ME-012",
    "cls": "external",
    "message": "写真を置けませんでした。少し待ってやり直してください",
    "action": "少し待ってやり直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ME-012",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "act": "A74",
      "screen": "account",
      "choke_point": "C4"
    }
  },
  "E-ME-020": {
    "id": "E-ME-020",
    "cls": "validation",
    "message": "メールの形が違います。「名前@会社.example」のように入れてください",
    "action": "メールを直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-020",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "email"
    }
  },
  "E-ME-021": {
    "id": "E-ME-021",
    "cls": "conflict",
    "message": "このメールは、もう別のアカウントで使われています。別のメールを入れてください",
    "action": "別のメールを入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-021",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "email"
    }
  },
  "E-ME-022": {
    "id": "E-ME-022",
    "cls": "conflict",
    "message": "リンクの期限が切れました。もう一度、確かめのメールを送ってください",
    "action": "確かめのメールを送り直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-022",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "email-confirm"
    }
  },
  "E-ME-023": {
    "id": "E-ME-023",
    "cls": "conflict",
    "message": "このリンクはもう使いました。メールはもう変わっています",
    "action": "ログインする",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-023",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "email-confirm"
    }
  },
  "E-ME-024": {
    "id": "E-ME-024",
    "cls": "limit",
    "message": "メールを送りすぎです。しばらくしてからやり直してください",
    "action": "しばらく待つ",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-024",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "email"
    }
  },
  "E-ME-025": {
    "id": "E-ME-025",
    "cls": "external",
    "message": "確かめのメールを送れませんでした。少し待ってやり直してください",
    "action": "少し待ってやり直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ME-025",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "account",
      "state": "email"
    }
  },
  "E-ME-026": {
    "id": "E-ME-026",
    "cls": "conflict",
    "message": "今のメールと同じです",
    "action": "別のメールを入れる",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-026",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "email"
    }
  },
  "E-ME-030": {
    "id": "E-ME-030",
    "cls": "conflict",
    "message": "この端末は切れません。ログアウトを使ってください",
    "action": "ログアウトする",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-030",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "me-sessions"
    }
  },
  "E-ME-040": {
    "id": "E-ME-040",
    "cls": "conflict",
    "message": "この知らせは安全のため止められません",
    "action": "そのままにする",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-040",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "account",
      "state": "notify"
    }
  },
  "E-ME-041": {
    "id": "E-ME-041",
    "cls": "conflict",
    "message": "写し先に、写し元は選べません",
    "action": "写し先を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-ME-041",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "account",
      "state": "notify-copy"
    }
  },
  "E-ME-050": {
    "id": "E-ME-050",
    "cls": "conflict",
    "message": "担当しているチケットがあります。ほかの人に渡してから、抜けてください",
    "action": "担当しているチケットをほかの人に渡す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ME-050",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "profile"
    }
  },
  "E-ME-051": {
    "id": "E-ME-051",
    "cls": "conflict",
    "message": "あなたはこのワークスペースの最後の管理者です。ほかの人を管理者にしてから、抜けてください",
    "action": "ほかの人を管理者にする",
    "undo": false,
    "severity": "medium",
    "support_code": "E-ME-051",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "account",
      "state": "profile"
    }
  },
  "E-MEM-020": {
    "id": "E-MEM-020",
    "cls": "conflict",
    "message": "引き継ぎ先が決まっていない担当があります。もう一度確かめてください",
    "action": "下見を読み直して引き継ぎ先を選び直す",
    "undo": false,
    "severity": "medium",
    "support_code": "MEM-020",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "member-detail",
      "state": "remove"
    }
  },
  "E-MEM-021": {
    "id": "E-MEM-021",
    "cls": "not_found",
    "message": "引き継ぎ先の人が見つかりません",
    "action": "メンバーの並びを読み直して引き継ぎ先を選び直す",
    "undo": false,
    "severity": "medium",
    "support_code": "MEM-021",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "member-detail",
      "state": "remove"
    }
  },
  "E-MEM-022": {
    "id": "E-MEM-022",
    "cls": "conflict",
    "message": "この人は引き継ぎ先にできません",
    "action": "ほかの人を引き継ぎ先に選ぶ",
    "undo": false,
    "severity": "medium",
    "support_code": "MEM-022",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "member-detail",
      "state": "remove"
    }
  },
  "E-MEM-023": {
    "id": "E-MEM-023",
    "cls": "conflict",
    "message": "閲覧のみの人は担当にできません",
    "action": "ほかの人を引き継ぎ先に選ぶ",
    "undo": false,
    "severity": "medium",
    "support_code": "MEM-023",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "member-detail",
      "state": "remove"
    }
  },
  "E-AUD-010": {
    "id": "E-AUD-010",
    "cls": "validation",
    "message": "探すことばは 1〜100 字で入れてください",
    "action": "ことばを入れ直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-AUD-010",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "audit",
      "state": "a"
    }
  },
  "E-GST-001": {
    "id": "E-GST-001",
    "cls": "not_found",
    "message": "このゲストのグループは見つかりません",
    "action": "グループを選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "members",
      "state": "guests"
    }
  },
  "E-GST-002": {
    "id": "E-GST-002",
    "cls": "conflict",
    "message": "同じ名前のゲストのグループがあります。別の名前にしてください",
    "action": "一覧から選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "members",
      "state": "guests"
    }
  },
  "E-GST-003": {
    "id": "E-GST-003",
    "cls": "not_found",
    "message": "このグループは見つかりません",
    "action": "届け先を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-003",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "members",
      "state": "guests"
    }
  },
  "E-GST-040": {
    "id": "E-GST-040",
    "cls": "not_found",
    "message": "このゲストのグループは見つかりません",
    "action": "選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-040",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "guest_share"
    }
  },
  "E-GST-041": {
    "id": "E-GST-041",
    "cls": "limit",
    "message": "見せる相手は 20 までです",
    "action": "外してから足す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-041",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "tickets",
      "state": "guest_share"
    }
  },
  "E-GST-060": {
    "id": "E-GST-060",
    "cls": "not_found",
    "message": "この仕事は見られません",
    "action": "一覧に戻る",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-060",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "portal",
      "state": "work"
    }
  },
  "E-GST-100": {
    "id": "E-GST-100",
    "cls": "not_found",
    "message": "この依頼は見つかりません",
    "action": "届いた依頼の一覧に戻る",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-100",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "requests",
      "state": "detail"
    }
  },
  "E-GST-110": {
    "id": "E-GST-110",
    "cls": "conflict",
    "message": "この依頼はもう決まっています",
    "action": "一覧を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-110",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "requests"
    }
  },
  "E-GST-111": {
    "id": "E-GST-111",
    "cls": "not_found",
    "message": "この届け先のグループは選べません",
    "action": "選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-111",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "requests"
    }
  },
  "E-GST-120": {
    "id": "E-GST-120",
    "cls": "conflict",
    "message": "この依頼はもう決まっています",
    "action": "一覧を読み直す",
    "undo": false,
    "severity": "medium",
    "support_code": "GST-120",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "requests",
      "state": "accept"
    }
  },
  "E-GST-130": {
    "id": "E-GST-130",
    "cls": "conflict",
    "message": "この依頼はもう決まっています",
    "action": "一覧を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-130",
    "must_not": true,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "requests"
    }
  },
  "E-GST-140": {
    "id": "E-GST-140",
    "cls": "conflict",
    "message": "この依頼はもう決まっています",
    "action": "一覧を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-140",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "requests",
      "state": "work"
    }
  },
  "E-GST-141": {
    "id": "E-GST-141",
    "cls": "connectivity",
    "message": "PC がつながると分身が案を出します",
    "action": "PC をつなぐ",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-141",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "requests",
      "state": "work"
    }
  },
  "E-GST-142": {
    "id": "E-GST-142",
    "cls": "conflict",
    "message": "案をもう作っています",
    "action": "少し待って読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-142",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "requests",
      "state": "work"
    }
  },
  "E-GST-150": {
    "id": "E-GST-150",
    "cls": "not_found",
    "message": "この仕事はもう終わっているか、見つかりません",
    "action": "何もしない（PC は次の仕事を取る）",
    "undo": false,
    "severity": "low",
    "support_code": "E-GST-150",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "bridge-setup",
      "state": "work"
    }
  },
  "E-GST-160": {
    "id": "E-GST-160",
    "cls": "not_found",
    "message": "この添付は付けられませんでした",
    "action": "添付を足し直す",
    "undo": false,
    "severity": "medium",
    "support_code": "GST-160",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "portal",
      "state": "request_new"
    }
  },
  "E-GST-170": {
    "id": "E-GST-170",
    "cls": "conflict",
    "message": "この依頼にはもう書けません",
    "action": "依頼のやり取りを読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "GST-170",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "portal",
      "state": "request_detail"
    }
  },
  "E-GST-181": {
    "id": "E-GST-181",
    "cls": "validation",
    "message": "このファイルは大きすぎます（700KB まで）",
    "action": "小さくするか、分けて足す",
    "undo": false,
    "severity": "low",
    "support_code": "GST-181",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "portal",
      "state": "request_new"
    }
  },
  "E-GST-182": {
    "id": "E-GST-182",
    "cls": "validation",
    "message": "足せない種類のファイルです",
    "action": "別の形式にして足す",
    "undo": false,
    "severity": "medium",
    "support_code": "GST-182",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "portal",
      "state": "request_new"
    }
  },
  "E-GST-183": {
    "id": "E-GST-183",
    "cls": "validation",
    "message": "添付は 5 つまでです",
    "action": "1 つ外してから足す",
    "undo": false,
    "severity": "low",
    "support_code": "GST-183",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "portal",
      "state": "request_new"
    }
  },
  "E-GST-184": {
    "id": "E-GST-184",
    "cls": "validation",
    "message": "空のファイルは足せません",
    "action": "中身のあるファイルを足す",
    "undo": false,
    "severity": "low",
    "support_code": "GST-184",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "portal",
      "state": "request_new"
    }
  },
  "E-AUTH-022": {
    "id": "E-AUTH-022",
    "cls": "auth",
    "message": "運営の場所は、パスキーしか使えません（メールとパスワードでは入れません）",
    "action": "パスキーで入る",
    "undo": false,
    "severity": "medium",
    "support_code": "AUTH-022",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "login",
      "state": "ops-passkey-only"
    }
  },
  "E-INQ-001": {
    "id": "E-INQ-001",
    "cls": "conflict",
    "message": "このファイルはまだ付けられません",
    "action": "付け直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INQ-001",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "inquiry"
    }
  },
  "E-INQ-003": {
    "id": "E-INQ-003",
    "cls": "validation",
    "message": "このファイルは付けられません（画像・PDF・zip だけ）",
    "action": "付け直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INQ-003",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "inquiry"
    }
  },
  "E-INQ-004": {
    "id": "E-INQ-004",
    "cls": "validation",
    "message": "大きすぎて付けられません（1 つ 10MB まで・5 つまで）",
    "action": "小さくして付け直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-INQ-004",
    "must_not": false,
    "layers": [
      "UI",
      "API"
    ],
    "where": {
      "screen": "inquiry"
    }
  },
  "E-BILL-001": {
    "id": "E-BILL-001",
    "cls": "conflict",
    "message": "この請求書の PDF はまだできていません",
    "action": "しばらくしてから開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-BILL-001",
    "must_not": false,
    "layers": [
      "API"
    ],
    "where": {
      "screen": "billing"
    }
  },
  "E-PLAN-001": {
    "id": "E-PLAN-001",
    "cls": "conflict",
    "message": "いまのプランです",
    "action": "ほかのプランを選ぶ",
    "undo": false,
    "severity": "low",
    "support_code": "E-PLAN-001",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "company-settings"
    }
  },
  "E-PLAN-002": {
    "id": "E-PLAN-002",
    "cls": "conflict",
    "message": "いまのメンバーは {members} 人で、上限（{member_limit} 人）を超えています",
    "action": "人を減らしてから選び直す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-PLAN-002",
    "must_not": false,
    "layers": [
      "UI",
      "API",
      "DB"
    ],
    "where": {
      "screen": "company-settings"
    }
  },
  "E-CONF-039": {
    "id": "E-CONF-039",
    "cls": "conflict",
    "message": "この人はもう本人確認が済んでいます",
    "action": "なし",
    "undo": false,
    "severity": "low",
    "support_code": "CONF-039",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-tenant",
      "state": "op-ws-members"
    }
  },
  "E-OPS-001": {
    "id": "E-OPS-001",
    "cls": "conflict",
    "message": "このワークスペースはもう開いています",
    "action": "開いている帯から閉じる",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-001",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-tenant",
      "state": "op-peek"
    }
  },
  "E-OPS-002": {
    "id": "E-OPS-002",
    "cls": "conflict",
    "message": "もう閉じています",
    "action": "なし",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-002",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-tenant",
      "state": "op-peek-open"
    }
  },
  "E-OPS-003": {
    "id": "E-OPS-003",
    "cls": "conflict",
    "message": "このワークスペースはもう止める日が決まっているか、止めています",
    "action": "日を変えるときは再開で取り消してから",
    "undo": false,
    "severity": "medium",
    "support_code": "OPS-003",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-tenant",
      "state": "op-stop"
    }
  },
  "E-OPS-004": {
    "id": "E-OPS-004",
    "cls": "conflict",
    "message": "このワークスペースは止めていません",
    "action": "画面を読み直して今の状態を確かめる",
    "undo": false,
    "severity": "low",
    "support_code": "OPS-004",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-tenant",
      "state": "op-stop"
    }
  },
  "E-OPS-006": {
    "id": "E-OPS-006",
    "cls": "conflict",
    "message": "止める日は明日以降にしてください",
    "action": "止める日を明日以降に選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "OPS-006",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-tenant",
      "state": "op-stop"
    }
  },
  "E-OPS-005": {
    "id": "E-OPS-005",
    "cls": "conflict",
    "message": "ほかの人が担当しています",
    "action": "担当の人に聞く",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-005",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-support"
    }
  },
  "E-OPS-008": {
    "id": "E-OPS-008",
    "cls": "conflict",
    "message": "後での日時は今より後にしてください",
    "action": "日時を選び直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-008",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-support"
    }
  },
  "E-OPS-010": {
    "id": "E-OPS-010",
    "cls": "conflict",
    "message": "メンテの時間を書いてから出してください",
    "action": "書き直して時間を入れる",
    "undo": false,
    "severity": "medium",
    "support_code": "OPS-010",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-notices",
      "state": "oq-notice-publish"
    }
  },
  "E-OPS-011": {
    "id": "E-OPS-011",
    "cls": "conflict",
    "message": "このお知らせはもう出しています",
    "action": "一覧を開き直す",
    "undo": false,
    "severity": "medium",
    "support_code": "OPS-011",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-notices",
      "state": "oq-notice-publish"
    }
  },
  "E-OPS-012": {
    "id": "E-OPS-012",
    "cls": "conflict",
    "message": "続報は、出した障害のお知らせにだけ足せます",
    "action": "一覧を開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-012",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-notices",
      "state": "oq-notice"
    }
  },
  "E-OPS-013": {
    "id": "E-OPS-013",
    "cls": "conflict",
    "message": "この障害はもう直ったにしています",
    "action": "新しい障害のお知らせを書く",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-013",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-notices",
      "state": "oq-notice"
    }
  },
  "E-BILL-002": {
    "id": "E-BILL-002",
    "cls": "conflict",
    "message": "この月はまだ締めていません",
    "action": "月が終わってから出す",
    "undo": false,
    "severity": "low",
    "support_code": "E-BILL-002",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-billing"
    }
  },
  "E-BILL-003": {
    "id": "E-BILL-003",
    "cls": "conflict",
    "message": "この月の請求書はもう全部出しています",
    "action": "一覧で確かめる",
    "undo": false,
    "severity": "low",
    "support_code": "E-BILL-003",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-billing"
    }
  },
  "E-BILL-004": {
    "id": "E-BILL-004",
    "cls": "conflict",
    "message": "この入金はもう取り消しています",
    "action": "入金の一覧で確かめる",
    "undo": false,
    "severity": "low",
    "support_code": "E-BILL-004",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-billing"
    }
  },
  "E-BILL-005": {
    "id": "E-BILL-005",
    "cls": "conflict",
    "message": "取り消す額が入金の額と違います",
    "action": "入金の額を確かめる",
    "undo": false,
    "severity": "low",
    "support_code": "E-BILL-005",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-billing"
    }
  },
  "E-OPS-015": {
    "id": "E-OPS-015",
    "cls": "conflict",
    "message": "この人はもう運営の人です",
    "action": "できることを変えるときは、一覧の［変える］から",
    "undo": false,
    "severity": "medium",
    "support_code": "E-OPS-015",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-team",
      "state": "op-team-add"
    }
  },
  "E-OPS-016": {
    "id": "E-OPS-016",
    "cls": "conflict",
    "message": "このメールは顧客のアカウントで使われています。運営の人には別のメールを使ってください",
    "action": "別のメールで足す",
    "undo": false,
    "severity": "medium",
    "support_code": "E-OPS-016",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-team",
      "state": "op-team-add"
    }
  },
  "E-OPS-019": {
    "id": "E-OPS-019",
    "cls": "conflict",
    "message": "このプランにはもう変える案があります",
    "action": "今の案を直すか、決めてもらってから作ってください",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-019",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-skills"
    }
  },
  "E-OPS-020": {
    "id": "E-OPS-020",
    "cls": "conflict",
    "message": "変えるところがありません",
    "action": "値段か人数を変えてから保存してください",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-020",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-skills"
    }
  },
  "E-OPS-021": {
    "id": "E-OPS-021",
    "cls": "conflict",
    "message": "この案はいま直せません",
    "action": "案の状態を確かめてください",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-021",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-skills"
    }
  },
  "E-OPS-022": {
    "id": "E-OPS-022",
    "cls": "conflict",
    "message": "自分の案は自分で決められません",
    "action": "「値段を決める」ができる別の運営の人に決めてもらってください",
    "undo": false,
    "severity": "medium",
    "support_code": "OPS-022",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-skills",
      "state": "oq-plan-self"
    }
  },
  "E-OPS-025": {
    "id": "E-OPS-025",
    "cls": "conflict",
    "message": "この版はもう選んであります。別の版を選んでください",
    "action": "新しい版が届いたら、またここに出ます",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-025",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "masters",
      "state": "oq-template-update"
    }
  },
  "E-OPS-026": {
    "id": "E-OPS-026",
    "cls": "conflict",
    "message": "この登録はもう確かめてあります",
    "action": "一覧を読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "OPS-026",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-home",
      "state": "op-pwned"
    }
  },
  "E-OPS-017": {
    "id": "E-OPS-017",
    "cls": "conflict",
    "message": "自分のできることは変えられません",
    "action": "別の運営の人に変えてもらってください",
    "undo": false,
    "severity": "medium",
    "support_code": "E-OPS-017",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-team",
      "state": "op-team-edit"
    }
  },
  "E-OPS-018": {
    "id": "E-OPS-018",
    "cls": "conflict",
    "message": "最後の 1 人なので外せません",
    "action": "別の運営の人に渡してから",
    "undo": false,
    "severity": "medium",
    "support_code": "E-OPS-018",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-team",
      "state": "op-team-edit"
    }
  },
  "E-OPS-023": {
    "id": "E-OPS-023",
    "cls": "conflict",
    "message": "今の版と同じです",
    "action": "中身を変えてから出す",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-023",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-skills"
    }
  },
  "E-OPS-024": {
    "id": "E-OPS-024",
    "cls": "conflict",
    "message": "ひな形の中身が合いません",
    "action": "赤字の 1 つを直してから出す",
    "undo": false,
    "severity": "low",
    "support_code": "E-OPS-024",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-skills"
    }
  },
  "E-OPS-007": {
    "id": "E-OPS-007",
    "cls": "permission",
    "message": "このワークスペースは止められています",
    "action": "問い合わせる",
    "undo": false,
    "severity": "high",
    "support_code": "OPS-007",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "*",
      "state": "workspace_stopped"
    }
  },
  "E-BILL-006": {
    "id": "E-BILL-006",
    "cls": "conflict",
    "message": "下書きの後に中身が変わりました。もう一度確かめて出してください",
    "action": "下書きを開き直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-BILL-006",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-billing"
    }
  },
  "E-OPS-009": {
    "id": "E-OPS-009",
    "cls": "conflict",
    "message": "出したお知らせの 種類・誰に・出す場所・出す日時 は変えられません",
    "action": "新しいお知らせとして書き直す",
    "undo": false,
    "severity": "medium",
    "support_code": "OPS-009",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-notices",
      "state": "oq-notice-new"
    }
  },
  "E-OPS-014": {
    "id": "E-OPS-014",
    "cls": "conflict",
    "message": "メンテの終わりは始まりより後にしてください",
    "action": "時間を直す",
    "undo": false,
    "severity": "medium",
    "support_code": "OPS-014",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-notices",
      "state": "oq-notice-new"
    }
  },
  "E-PLAN-003": {
    "id": "E-PLAN-003",
    "cls": "conflict",
    "message": "いまのプランの人数の上限に達しています。プランを上げると招けます",
    "action": "プランと支払いを見る",
    "undo": false,
    "severity": "medium",
    "support_code": "PLAN-003",
    "must_not": true,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "members",
      "state": "invite"
    }
  },
  "E-BILL-007": {
    "id": "E-BILL-007",
    "cls": "conflict",
    "message": "ほかの人が先に直しました。読み直してから、もう一度保存してください",
    "action": "読み直す",
    "undo": false,
    "severity": "low",
    "support_code": "E-BILL-007",
    "must_not": false,
    "layers": [
      "API",
      "DB"
    ],
    "where": {
      "screen": "ops-billing"
    }
  }
};
