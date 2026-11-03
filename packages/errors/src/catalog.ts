// 生成物（scripts/ci/errors_used.mjs gen ← 07_qa/test-specs/errors.json）。手で直さない。134 件
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
    "message": "15 分間ロックしました。急ぐときはメールでロックを解除できます",
    "action": "解除メールを送る／15 分待つ",
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
    "message": "このリンクは期限が切れています。新しい確認メールを送ります",
    "action": "確認メールを送り直す",
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
    "message": "この承認はもう処理されています（山田さんが 1 分前に承認）",
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
    "message": "この招待は取り消されています。招待した人が取り消したか、7 日の期限を過ぎました。もう一度招待してもらってください",
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
  }
};
