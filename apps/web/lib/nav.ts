// 生成物（scripts/ci/gen_routes.mjs ← 05_flow/flow.json navigation／screens／product_states）。手で直さない。flow:c14bd5611b029ef7
export interface NavSection { key: string; label: string; icon: string; screens: string[] }
export interface SubItem { label: string; desc: string; group?: string; state?: string }
export interface ScreenMeta { id: string; name: string; route: string; needsLogin: boolean; hasShell: boolean; roles: string[]; purpose: string; primaryAction: string; release: string }
export interface ProductState { id: string; name: string; caps: string[] }
export interface NavData {
  sections: readonly NavSection[]; sectionsByRole: Record<string, readonly string[]>; byRole: Record<string, readonly string[]>;
  subByScreen: Record<string, readonly SubItem[]>; layoutByScreen: Record<string, string>; subModeByScreen: Record<string, string>; mainMinPx: number;
  productStates: readonly ProductState[]; screens: Record<ScreenId, ScreenMeta>; roles: readonly { id: RoleId; name: string }[];
}
export type RoleId = "R1" | "R2" | "R3" | "R4" | "R6";
export type ScreenId = "signup" | "verify-email" | "invite-accept" | "mfa-setup" | "billing-setup" | "login" | "password-reset" | "onboard-interview" | "onboard-draft" | "bridge-setup" | "credentials" | "onboard-testrun" | "onboard-golive" | "today" | "approvals" | "clone-thread" | "tasks" | "clone-chat" | "ai-activity" | "search" | "records" | "record-detail" | "goals" | "goal-allocation" | "goal-edit" | "my-progress" | "review" | "hypotheses" | "duties" | "clone-memory" | "ledger-def" | "company-model" | "automation-repair" | "audit" | "policies" | "members" | "ai-staff" | "ai-staff-detail" | "security-brief" | "disclosure" | "export" | "account-close" | "ops-support" | "ops-home" | "ops-catalog" | "account" | "company-settings" | "llm-routes" | "app-setup" | "import" | "services" | "ops-services" | "ops-skills" | "inquiry" | "notices" | "billing" | "ops-notices" | "ops-billing" | "ops-llm" | "ops-disclosure" | "ops-tenant" | "ops-review" | "ops-audit" | "member-detail";
export const NAV: NavData = {
  "sections": [
    {
      "key": "today",
      "label": "今日",
      "icon": "calendar-check",
      "screens": [
        "today"
      ]
    },
    {
      "key": "clone",
      "label": "自分のAI",
      "icon": "user-round-cog",
      "screens": [
        "clone-chat",
        "ai-activity",
        "clone-thread",
        "clone-memory"
      ]
    },
    {
      "key": "work",
      "label": "仕事",
      "icon": "list-checks",
      "screens": [
        "approvals",
        "tasks",
        "records",
        "my-progress"
      ]
    },
    {
      "key": "goal",
      "label": "目標",
      "icon": "target",
      "screens": [
        "goals",
        "goal-allocation",
        "goal-edit",
        "review",
        "hypotheses"
      ]
    },
    {
      "key": "model",
      "label": "会社モデル",
      "icon": "building-2",
      "screens": [
        "company-model",
        "duties",
        "ai-staff",
        "ledger-def",
        "members",
        "member-detail",
        "policies"
      ]
    },
    {
      "key": "ops",
      "label": "設定と記録",
      "icon": "settings",
      "screens": [
        "account",
        "company-settings",
        "notices",
        "inquiry",
        "billing",
        "import",
        "services",
        "bridge-setup",
        "credentials",
        "automation-repair",
        "audit",
        "security-brief",
        "disclosure",
        "llm-routes",
        "app-setup",
        "export",
        "account-close"
      ]
    },
    {
      "key": "admin",
      "label": "運営",
      "icon": "life-buoy",
      "screens": [
        "ops-home",
        "ops-tenant",
        "ops-support",
        "ops-notices",
        "ops-billing",
        "ops-catalog",
        "ops-skills",
        "ops-services",
        "ops-review",
        "ops-audit",
        "ops-llm",
        "ops-disclosure"
      ]
    }
  ],
  "sectionsByRole": {
    "R1": [
      "today",
      "clone",
      "work",
      "goal",
      "model",
      "ops"
    ],
    "R2": [
      "today",
      "clone",
      "work",
      "goal",
      "model",
      "ops"
    ],
    "R3": [
      "today",
      "clone",
      "work",
      "goal",
      "model",
      "ops"
    ],
    "R4": [
      "clone",
      "work",
      "model",
      "ops"
    ],
    "R6": [
      "admin"
    ]
  },
  "byRole": {
    "R1": [
      "today",
      "clone-chat",
      "ai-activity",
      "clone-thread",
      "clone-memory",
      "approvals",
      "tasks",
      "records",
      "my-progress",
      "goals",
      "goal-allocation",
      "goal-edit",
      "review",
      "hypotheses",
      "company-model",
      "duties",
      "ai-staff",
      "ledger-def",
      "members",
      "member-detail",
      "policies",
      "account",
      "company-settings",
      "notices",
      "inquiry",
      "billing",
      "import",
      "services",
      "bridge-setup",
      "credentials",
      "automation-repair",
      "audit",
      "security-brief",
      "disclosure",
      "llm-routes",
      "app-setup",
      "export",
      "account-close"
    ],
    "R2": [
      "today",
      "clone-chat",
      "ai-activity",
      "clone-thread",
      "clone-memory",
      "approvals",
      "tasks",
      "records",
      "my-progress",
      "goals",
      "goal-allocation",
      "goal-edit",
      "review",
      "hypotheses",
      "company-model",
      "duties",
      "ai-staff",
      "ledger-def",
      "members",
      "member-detail",
      "policies",
      "account",
      "company-settings",
      "notices",
      "inquiry",
      "billing",
      "import",
      "services",
      "bridge-setup",
      "credentials",
      "automation-repair",
      "audit",
      "security-brief",
      "disclosure",
      "llm-routes",
      "app-setup",
      "export",
      "account-close"
    ],
    "R3": [
      "today",
      "clone-chat",
      "ai-activity",
      "clone-thread",
      "clone-memory",
      "approvals",
      "tasks",
      "records",
      "my-progress",
      "goals",
      "policies",
      "account",
      "notices",
      "inquiry",
      "app-setup"
    ],
    "R4": [
      "clone-chat",
      "clone-memory",
      "tasks",
      "records",
      "my-progress",
      "policies",
      "account",
      "notices",
      "inquiry",
      "app-setup"
    ],
    "R6": [
      "ops-home",
      "ops-tenant",
      "ops-support",
      "ops-notices",
      "ops-billing",
      "ops-catalog",
      "ops-skills",
      "ops-services",
      "ops-review",
      "ops-audit",
      "ops-llm",
      "ops-disclosure"
    ]
  },
  "subByScreen": {
    "today": [
      {
        "label": "昨日の会話をまとめる",
        "desc": "毎朝押す。自分のAIが会話と承認・差し戻しから記憶を整える。上の層で変わったこともここ"
      },
      {
        "label": "申し送り",
        "desc": "自分のAIが夜のうちに何をしたか・今日どこを見るべきか"
      },
      {
        "label": "朝の計画",
        "desc": "自分のAIの候補から今日やる分を選ぶ。見込み時間の合計と使える時間"
      },
      {
        "label": "承認待ち",
        "desc": "自分のAIが一次確認して上げたもの。押す前に中身が見える"
      },
      {
        "label": "今日のタスク",
        "desc": "自分がやる分。終えるとここから消える"
      },
      {
        "label": "持ち越し",
        "desc": "夕方。残りを 消す／明日へ／引き継いでもらう"
      }
    ],
    "clone-chat": [
      {
        "label": "新しく話す",
        "desc": "新しい会話を始める。自分のPCの Claude の新しいセッション"
      },
      {
        "label": "会話",
        "desc": "一覧。名前は自動で付き、直せる。探す（中身も）・消す"
      },
      {
        "label": "星",
        "desc": "星を付けた会話を上に"
      },
      {
        "label": "記憶に使わない",
        "desc": "この会話は覚えない（毎朝のまとめから外す）"
      }
    ],
    "ai-activity": [
      {
        "label": "今日の動き",
        "desc": "自分のAIが配った順に"
      },
      {
        "label": "止まっている",
        "desc": "差し戻し中・待ち・失敗"
      },
      {
        "label": "AI社員ごと",
        "desc": "1体ずつのセッション"
      },
      {
        "label": "対象ごと",
        "desc": "案件・請求・目標ごと"
      }
    ],
    "clone-thread": [
      {
        "label": "差し戻し中",
        "desc": "自分のAIがAI社員に返して、まだ戻ってきていないもの"
      },
      {
        "label": "やりとりの履歴",
        "desc": "終わったものも含めて全部"
      }
    ],
    "clone-memory": [
      {
        "label": "運営",
        "desc": "運営が配った安全ルール。変えられない"
      },
      {
        "label": "会社",
        "desc": "会社の全員に効く。編集は権限のある人。AIの提案は承認してから"
      },
      {
        "label": "層ごと",
        "desc": "事業・部署など、この会社が決めた層。編集はその層の長"
      },
      {
        "label": "個人",
        "desc": "自分だけに効く。本人が自由に直せる"
      },
      {
        "label": "AI社員",
        "desc": "AI社員が覚えた操作。編集は担当業務の管理者"
      },
      {
        "label": "確認待ち",
        "desc": "上の層へ上がってきた記憶と、メンバー同士の食い違い。OK までは送った人の記憶として効く"
      }
    ],
    "approvals": [
      {
        "label": "未処理",
        "desc": "今すぐ見るもの"
      },
      {
        "label": "止めたもの",
        "desc": "あなたが止めてAI社員に戻したもの"
      },
      {
        "label": "履歴",
        "desc": "押した記録"
      }
    ],
    "tasks": [
      {
        "label": "今日",
        "desc": "今日やる分。人もAI社員も同じ一覧"
      },
      {
        "label": "今週",
        "desc": "期限が今週"
      },
      {
        "label": "詰まっている",
        "desc": "理由と、理由ごとの一手"
      },
      {
        "label": "期限切れ",
        "desc": "過ぎたもの。自分のAIが理由を聞きに来る"
      },
      {
        "label": "引き継げる仕事",
        "desc": "自分の分が終わったら。同じ部署の残り"
      },
      {
        "label": "行き先のないタスク",
        "desc": "どの目標にも紐づいていないもの。赤で残る"
      }
    ],
    "records": [
      {
        "label": "すべて",
        "desc": "この台帳の全件"
      },
      {
        "label": "止まっている",
        "desc": "段階が動いていないもの"
      },
      {
        "label": "自分の担当",
        "desc": "自分が担当の分"
      }
    ],
    "record-detail": [
      {
        "label": "中身",
        "desc": "項目と段階"
      },
      {
        "label": "タスク",
        "desc": "この1件に紐づくやること"
      },
      {
        "label": "添付",
        "desc": "読み込んだファイル"
      },
      {
        "label": "証跡",
        "desc": "誰がいつ何をしたか"
      }
    ],
    "my-progress": [
      {
        "label": "配られた分",
        "desc": "上から降りてきた目標の進み"
      },
      {
        "label": "自主目標",
        "desc": "自分で決めた目標"
      },
      {
        "label": "自分のAI社員",
        "desc": "自分のAI社員に配った分"
      },
      {
        "label": "自分のタスク",
        "desc": "今日・今週"
      }
    ],
    "goals": [
      {
        "label": "階層で見る",
        "desc": "会社から自分まで、層ごとに"
      },
      {
        "label": "降ろした数",
        "desc": "上から配った目標"
      },
      {
        "label": "積み上がった数",
        "desc": "下から上がってきた実績"
      },
      {
        "label": "未配分",
        "desc": "配り切れていないところと、行き先のないタスク"
      },
      {
        "label": "かけたもの",
        "desc": "予算・コスト・時間・活動と、出たもの"
      }
    ],
    "goal-allocation": [
      {
        "label": "階層",
        "desc": "どの層に、誰に、どれだけ"
      },
      {
        "label": "未配分",
        "desc": "赤のところ"
      },
      {
        "label": "見せる範囲",
        "desc": "この層の目標をどこまで見せるか"
      },
      {
        "label": "単位の変換",
        "desc": "親と子で単位が違うところ"
      }
    ],
    "goal-edit": [
      {
        "label": "改訂",
        "desc": "目標そのものを直す"
      },
      {
        "label": "無くす",
        "desc": "終える。紐づくものの行き先を決める"
      },
      {
        "label": "下への影響",
        "desc": "直すと誰の配分とどのタスクが変わるか"
      },
      {
        "label": "版の履歴",
        "desc": "いつ何を変えたか"
      }
    ],
    "review": [
      {
        "label": "差分",
        "desc": "目標と実績の差"
      },
      {
        "label": "要因の候補",
        "desc": "自分のAIが挙げた理由"
      },
      {
        "label": "前期との比較",
        "desc": "同じ期間で"
      }
    ],
    "hypotheses": [
      {
        "label": "採る候補",
        "desc": "自分のAIが出した仮説"
      },
      {
        "label": "動いている施策",
        "desc": "採ってタスクまで落ちたもの"
      },
      {
        "label": "タイムライン",
        "desc": "施策の期間・予算・検証の時期"
      },
      {
        "label": "効かなかったもの",
        "desc": "検証して効かなかった仮説。残す"
      }
    ],
    "company-model": [
      {
        "label": "全体",
        "desc": "目標・台帳・担当業務・組織・ルール・記憶"
      },
      {
        "label": "版の履歴",
        "desc": "いつ何が変わったか"
      },
      {
        "label": "テンプレ",
        "desc": "運営配布・会社で作ったもの"
      }
    ],
    "duties": [
      {
        "label": "担当業務",
        "desc": "AI社員がやる仕事の定義"
      },
      {
        "label": "覚えた操作",
        "desc": "外部サービスでの手順。担当業務の下に畳んである"
      },
      {
        "label": "効く範囲",
        "desc": "会社／部署／個人のどれか"
      },
      {
        "label": "テストで動かす",
        "desc": "定義を変えたあと、外に出さずに 1 回動かす"
      }
    ],
    "ai-staff": [
      {
        "label": "会社のAI社員",
        "desc": "会社で作ったもの"
      },
      {
        "label": "託されたAI社員",
        "desc": "運営や他の人から渡されたもの。定義は編集できない"
      },
      {
        "label": "作る",
        "desc": "新しく作る"
      }
    ],
    "ai-staff-detail": [
      {
        "label": "やること",
        "desc": "担当業務"
      },
      {
        "label": "託し先",
        "desc": "誰が使えるか"
      },
      {
        "label": "守るルール",
        "desc": "この社員に効くルール"
      },
      {
        "label": "使えるスキル",
        "desc": "装着されたスキルと版"
      },
      {
        "label": "証跡",
        "desc": "この社員がやったこと"
      }
    ],
    "ledger-def": [
      {
        "label": "項目",
        "desc": "台帳の列"
      },
      {
        "label": "段階",
        "desc": "進む状態"
      },
      {
        "label": "既存への影響",
        "desc": "変えると既存の何件に影響するか"
      }
    ],
    "members": [
      {
        "label": "組織図",
        "desc": "層ごとに人とAI社員"
      },
      {
        "label": "一覧と招待",
        "desc": "いる人・招待中"
      },
      {
        "label": "層と権限",
        "desc": "この会社の層の呼び方と、層ごとの既定の権限"
      }
    ],
    "member-detail": [
      {
        "label": "基本",
        "desc": "所属する層・役割・状態"
      },
      {
        "label": "権限",
        "desc": "何を・どの層で・見る／直す／配る／承認する"
      },
      {
        "label": "託されたAI社員",
        "desc": "この人が使えるAI社員"
      },
      {
        "label": "セッション",
        "desc": "ログイン中の端末と Bridge"
      },
      {
        "label": "抜ける",
        "desc": "依存を片づけてから無効にする"
      }
    ],
    "ops-tenant": [
      {
        "label": "構成と状態",
        "desc": "プラン・人・AI社員・版・稼働"
      },
      {
        "label": "請求と入金",
        "desc": "この会社の請求書・入金の記録・未収"
      },
      {
        "label": "問い合わせ",
        "desc": "この会社とのやりとり"
      },
      {
        "label": "配布したもの",
        "desc": "使っている運営配布物と版・上書き"
      },
      {
        "label": "審査",
        "desc": "この会社の公開申請"
      },
      {
        "label": "証跡とサポートアクセス",
        "desc": "運営がこの会社にしたこと・許可の状況"
      },
      {
        "label": "お知らせ",
        "desc": "この会社向けに出したもの"
      },
      {
        "label": "退会と猶予",
        "desc": "退会予定・猶予・消去の証明"
      }
    ],
    "ops-review": [
      {
        "label": "審査待ち",
        "desc": "会社が公開したもの"
      },
      {
        "label": "匿名化の確認",
        "desc": "名前・金額・固有名が残っていないか"
      },
      {
        "label": "承認した",
        "desc": "公開済み"
      },
      {
        "label": "却下した",
        "desc": "理由つき"
      }
    ],
    "ops-audit": [
      {
        "label": "運営の証跡",
        "desc": "誰が・どの会社に・何を"
      },
      {
        "label": "セキュリティの出来事",
        "desc": "失敗したログイン・鍵の失効・不審な接続"
      },
      {
        "label": "運営メンバー",
        "desc": "権限"
      }
    ],
    "account": [
      {
        "label": "基本",
        "desc": "名前・メール"
      },
      {
        "label": "パスワードと 2 段階認証",
        "desc": "変えると他の端末は入り直し"
      },
      {
        "label": "端末",
        "desc": "ログイン中の端末と Bridge"
      },
      {
        "label": "自分のAIの使用量",
        "desc": "サブスクの 5 時間の枠・週の枠と、いつ戻るか"
      }
    ],
    "company-settings": [
      {
        "label": "会社",
        "desc": "会社名・請求先・タイムゾーン"
      },
      {
        "label": "データの所在",
        "desc": "どこに置くか・学習に使わない"
      },
      {
        "label": "AI の経路",
        "desc": "Bridge が既定。自分の API キー・運営マネージドは「AI の経路」の画面で"
      }
    ],
    "import": [
      {
        "label": "入れる",
        "desc": "ファイル・スクショ・メールを落とす"
      },
      {
        "label": "読んだ結果",
        "desc": "自分のAIが出した候補"
      },
      {
        "label": "取り込み済み",
        "desc": "台帳に入ったもの"
      }
    ],
    "services": [
      {
        "label": "使っているサービス",
        "desc": "可否と理由"
      },
      {
        "label": "正規連携",
        "desc": "API でつなぐもの"
      },
      {
        "label": "今の接続",
        "desc": "Bridge とサーバー経路"
      }
    ],
    "ops-skills": [
      {
        "label": "スキル",
        "desc": "運営のスキル一覧。種類・版・配布先・装着数"
      },
      {
        "label": "1 つの中身",
        "desc": "版の履歴・テストの結果・配布先・装着の状況"
      },
      {
        "label": "アップロード",
        "desc": "新しい版を上げてテストで動かす"
      }
    ],
    "ops-services": [
      {
        "label": "サービス台帳",
        "desc": "可否と理由"
      },
      {
        "label": "版の履歴",
        "desc": "変えた記録"
      },
      {
        "label": "会社からの申請",
        "desc": "可否を問われたもの"
      }
    ],
    "inquiry": [
      {
        "label": "問い合わせる",
        "desc": "自分のAIがまず答える。解けなければ運営へ"
      },
      {
        "label": "返答待ち",
        "desc": "運営に届いているもの"
      },
      {
        "label": "返答あり",
        "desc": "運営から返ってきたもの"
      },
      {
        "label": "解決した",
        "desc": "終わったもの"
      }
    ],
    "notices": [
      {
        "label": "お知らせ",
        "desc": "リリース・障害・メンテ・ルールの版"
      },
      {
        "label": "稼働状況",
        "desc": "Kaname・Bridge・AI の経路・外部サービス"
      },
      {
        "label": "通知の届け先",
        "desc": "承認待ち・止まった・終わった・許可が要る・お知らせをどこに届けるか"
      }
    ],
    "billing": [
      {
        "label": "プラン",
        "desc": "今のプランと上限"
      },
      {
        "label": "使った量",
        "desc": "AI社員・担当業務・自律実行・人"
      },
      {
        "label": "請求書",
        "desc": "月ごと"
      },
      {
        "label": "支払い方法",
        "desc": "請求書払い／カード（Stripe のホスト画面で登録）"
      }
    ],
    "ops-notices": [
      {
        "label": "出す",
        "desc": "お知らせを書く"
      },
      {
        "label": "出したもの",
        "desc": "公開済み・予約"
      },
      {
        "label": "稼働状況",
        "desc": "障害・メンテを登録"
      }
    ],
    "ops-billing": [
      {
        "label": "請求と入金",
        "desc": "当月"
      },
      {
        "label": "未収",
        "desc": "対処"
      },
      {
        "label": "利用量と上限",
        "desc": "プランの上限に近い会社"
      },
      {
        "label": "プラン変更",
        "desc": "申請と履歴"
      }
    ],
    "ops-home": [
      {
        "label": "会社の一覧",
        "desc": "プラン・体数・稼働"
      },
      {
        "label": "詰まっている",
        "desc": "失敗の型で並べる"
      },
      {
        "label": "プラン",
        "desc": "上限と配布内容"
      }
    ],
    "ops-catalog": [
      {
        "label": "AI社員",
        "desc": "運営配布のAI社員"
      },
      {
        "label": "担当業務",
        "desc": "運営配布の担当業務"
      },
      {
        "label": "ルール",
        "desc": "上書きできない安全ルール"
      },
      {
        "label": "テンプレ",
        "desc": "出力の書式"
      },
      {
        "label": "プランの定義",
        "desc": "価格と上限の版"
      }
    ],
    "policies": [
      {
        "label": "運営",
        "desc": "上書きできない安全ルール"
      },
      {
        "label": "会社",
        "desc": "会社全員に効く"
      },
      {
        "label": "部署",
        "desc": "部署だけ"
      },
      {
        "label": "個人",
        "desc": "自分だけ。「いつも許可」にしたものと許可のモード"
      }
    ],
    "bridge-setup": [
      {
        "label": "接続",
        "desc": "今つながっているか"
      },
      {
        "label": "この端末",
        "desc": "登録した PC"
      },
      {
        "label": "動く条件",
        "desc": "PC が閉じているとどうなるか"
      }
    ],
    "credentials": [
      {
        "label": "預けたもの",
        "desc": "保管してあるログイン情報"
      },
      {
        "label": "自動操作の可否",
        "desc": "サービスごとにやってよいか"
      },
      {
        "label": "追加する",
        "desc": "新しく預ける"
      }
    ],
    "automation-repair": [
      {
        "label": "止まっているもの",
        "desc": "画面が変わって動かないもの"
      },
      {
        "label": "覚え直す",
        "desc": "AIに手順を作り直させる"
      },
      {
        "label": "版の履歴",
        "desc": "前の手順"
      }
    ],
    "audit": [
      {
        "label": "すべて",
        "desc": "全部の記録"
      },
      {
        "label": "承認",
        "desc": "あなたが押したもの"
      },
      {
        "label": "AIの実行",
        "desc": "AI社員がやったこと"
      },
      {
        "label": "取り消し",
        "desc": "取り消した記録"
      },
      {
        "label": "運営のアクセス",
        "desc": "運営に許可した範囲と、運営が見た記録"
      }
    ],
    "security-brief": [
      {
        "label": "できること",
        "desc": "Bridge がやること"
      },
      {
        "label": "できないこと",
        "desc": "やらないと決めていること"
      },
      {
        "label": "送るもの／送らないもの",
        "desc": "外に出るデータ"
      },
      {
        "label": "証跡",
        "desc": "全操作の記録の出し方"
      }
    ],
    "llm-routes": [
      {
        "label": "既定の経路",
        "desc": "Bridge／自分の API キー／運営マネージド"
      },
      {
        "label": "PC が閉じているとき",
        "desc": "サーバー経路をどれで動かすか"
      },
      {
        "label": "API キー",
        "desc": "預ける・失効。中身は見えない"
      },
      {
        "label": "使用量",
        "desc": "提供者ごと。上限と超過"
      }
    ],
    "app-setup": [
      {
        "label": "PC",
        "desc": "Bridge の窓で開く"
      },
      {
        "label": "スマホ",
        "desc": "App Store／Google Play"
      },
      {
        "label": "通知",
        "desc": "どの端末に何を届けるか"
      }
    ],
    "disclosure": [
      {
        "label": "できる操作",
        "desc": "操作の完全な列挙。出口ごと"
      },
      {
        "label": "送るもの／送らないもの",
        "desc": "何が外に出るかの決まりから"
      },
      {
        "label": "サブプロセッサ",
        "desc": "一覧と変更の通知"
      },
      {
        "label": "DPA",
        "desc": "雛形と締結"
      },
      {
        "label": "アンインストール",
        "desc": "残留物ゼロの検証結果"
      },
      {
        "label": "版",
        "desc": "いつ何が変わったか"
      }
    ],
    "ops-llm": [
      {
        "label": "許可",
        "desc": "会社ごとの運営マネージド"
      },
      {
        "label": "使用量",
        "desc": "3 社・会社別"
      },
      {
        "label": "費用",
        "desc": "上限と超過の請求"
      }
    ],
    "ops-disclosure": [
      {
        "label": "版",
        "desc": "出す・戻す"
      },
      {
        "label": "DPA の雛形",
        "desc": "法務確認"
      },
      {
        "label": "サブプロセッサ",
        "desc": "一覧と事前通知"
      }
    ],
    "export": [
      {
        "label": "会社モデル",
        "desc": "定義だけ"
      },
      {
        "label": "台帳",
        "desc": "データだけ"
      },
      {
        "label": "まとめて",
        "desc": "全部"
      }
    ],
    "account-close": [
      {
        "label": "依存の確認",
        "desc": "全オブジェクトで何が起きるか"
      },
      {
        "label": "持ち出す",
        "desc": "退会の前に"
      },
      {
        "label": "退会",
        "desc": "会社名を入れて手続き"
      }
    ],
    "search": [
      {
        "label": "台帳",
        "desc": "案件・請求・問い合わせ"
      },
      {
        "label": "記憶",
        "desc": "自分のAIが覚えていること"
      },
      {
        "label": "証跡",
        "desc": "誰がいつ何をしたか"
      }
    ],
    "ops-support": [
      {
        "label": "受信箱",
        "desc": "問い合わせと詰まり。未返答から"
      },
      {
        "label": "失敗の型",
        "desc": "よくある詰まり"
      },
      {
        "label": "返答と対処",
        "desc": "送るもの"
      }
    ]
  },
  "layoutByScreen": {
    "today": "threepane",
    "approvals": "threepane",
    "tasks": "threepane",
    "clone-memory": "threepane"
  },
  "subModeByScreen": {
    "today": "anchors",
    "clone-memory": "anchors"
  },
  "mainMinPx": 720,
  "productStates": [
    {
      "id": "PS0",
      "name": "登録直後 ── PC はまだつないでいない。AI は話せない。会社モデルもデータも無い",
      "caps": [
        "nobridge"
      ]
    },
    {
      "id": "PS1",
      "name": "PC がつながった ── 自分のAIが話せる。会社モデルはまだ無い",
      "caps": [
        "bridge",
        "ai"
      ]
    },
    {
      "id": "PS2",
      "name": "たたき台あり・テスト中 ── AI社員はテストモードだけ。外に出ない。本番のデータは無い",
      "caps": [
        "bridge",
        "ai",
        "model",
        "test"
      ]
    },
    {
      "id": "PS3",
      "name": "本番稼働 ── AI社員が動き、承認待ち・タスク・台帳のデータが積まれる",
      "caps": [
        "bridge",
        "ai",
        "model",
        "data",
        "staff",
        "app"
      ]
    },
    {
      "id": "PS4",
      "name": "AI が止まっている ── PC が閉じている／覚え直し待ち。データはある。AI は話せない",
      "caps": [
        "model",
        "data",
        "staff",
        "stopped",
        "app"
      ]
    }
  ],
  "screens": {
    "signup": {
      "id": "signup",
      "name": "アカウントを作る",
      "route": "/signup",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "会社名とメールだけでKanameを使い始める。ここではまだ何も設定しない",
      "primaryAction": "はじめる",
      "release": "v1"
    },
    "verify-email": {
      "id": "verify-email",
      "name": "メールを確認する",
      "route": "/verify-email",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "届いたリンクで本人であることを示し、はじめの設定に進む",
      "primaryAction": "はじめの設定をはじめる",
      "release": "v1"
    },
    "invite-accept": {
      "id": "invite-accept",
      "name": "招待を受けて参加する",
      "route": "/invite/:token",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R3",
        "R4"
      ],
      "purpose": "招かれた人が、自分に見える範囲と自分がやることだけを受け取って入る",
      "primaryAction": "参加する",
      "release": "v1"
    },
    "mfa-setup": {
      "id": "mfa-setup",
      "name": "2段階認証を設定する",
      "route": "/mfa-setup",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "認証アプリを登録し、回復コードを保管する",
      "primaryAction": "登録する",
      "release": "v1"
    },
    "billing-setup": {
      "id": "billing-setup",
      "name": "支払い方法を登録する",
      "route": "/billing-setup",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "プランを選び、Stripe の登録画面でカードを登録する。カード番号はここを通らない。請求書払いなら何もしなくてよい",
      "primaryAction": "登録する",
      "release": "v2"
    },
    "login": {
      "id": "login",
      "name": "ログインする",
      "route": "/login",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "毎日ここから入る。2段階認証まで通してから今日の画面に着く",
      "primaryAction": "ログイン",
      "release": "v1"
    },
    "password-reset": {
      "id": "password-reset",
      "name": "パスワードの再設定",
      "route": "/password-reset",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "パスワードを忘れたときに、自分でパスワードを再設定して入り直す（端末を失くしたときの出口はログインの 6 桁の画面が持つ）",
      "primaryAction": "再設定メールを送る",
      "release": "v1"
    },
    "onboard-interview": {
      "id": "onboard-interview",
      "name": "自分のAIと話す",
      "route": "/onboard/interview",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "自分のAIの質問に答えるだけで、会社のことが伝わる。自分で欄を埋めない",
      "primaryAction": "次の質問へ",
      "release": "v1"
    },
    "onboard-draft": {
      "id": "onboard-draft",
      "name": "たたき台を確かめる",
      "route": "/onboard/draft",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "自分のAIが作った目標・台帳・担当業務・AI社員を見て、違うところを言って直させる",
      "primaryAction": "これでいく",
      "release": "v1"
    },
    "bridge-setup": {
      "id": "bridge-setup",
      "name": "自分のPCをつなぐ",
      "route": "/setup/bridge",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "Bridgeを入れて、自分の環境でAI社員が動けるようにする",
      "primaryAction": "接続を確かめる",
      "release": "v1"
    },
    "credentials": {
      "id": "credentials",
      "name": "ログイン情報を預ける",
      "route": "/settings/credentials",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "使う外部サービスの資格情報を暗号化して預ける。AIには一切見せない",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "onboard-testrun": {
      "id": "onboard-testrun",
      "name": "テストで動かす",
      "route": "/onboard/testrun",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "外に一切出さない状態でAI社員を動かし、出てきたものを見て納得する",
      "primaryAction": "本番に切り替える",
      "release": "v1"
    },
    "onboard-golive": {
      "id": "onboard-golive",
      "name": "本番に切り替える",
      "route": "/onboard/golive",
      "needsLogin": false,
      "hasShell": false,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "足りていない設定を潰して、明日から自動で動く状態にする",
      "primaryAction": "切り替える",
      "release": "v1"
    },
    "today": {
      "id": "today",
      "name": "今日",
      "route": "/today",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "朝に自分のAIの候補から今日やる分を確定し、申し送りと承認待ちを把握し、夕方に持ち越しを整理する",
      "primaryAction": "今日を確定する",
      "release": "v1"
    },
    "approvals": {
      "id": "approvals",
      "name": "承認待ち",
      "route": "/approvals",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "自分のAIが一次確認して上げてきたものを、中身を見てから押す／止める",
      "primaryAction": "承認する",
      "release": "v1"
    },
    "clone-thread": {
      "id": "clone-thread",
      "name": "自分のAIとAI社員のやりとり",
      "route": "/ai/thread",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "差し戻したものが今どうなっているか、何を直させたかを追う",
      "primaryAction": "AI社員に伝える",
      "release": "v1"
    },
    "tasks": {
      "id": "tasks",
      "name": "タスク",
      "route": "/tasks",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "人とAI社員の分を同じ一覧で片づける。足す・引き継いでもらう・引き継ぐ・詰まりを解くがここででき、必ず目標に紐づく。リスト／カンバン／カレンダー／ガントに切り替えられる。親タスクは子に分けて開ける",
      "primaryAction": "終わりにする",
      "release": "v1"
    },
    "clone-chat": {
      "id": "clone-chat",
      "name": "自分のAIと話す",
      "route": "/ai/chat",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "会話モード。指示・相談・数値の質問をここでする。左は会話の一覧（新しく話す・探す・星・記憶に使わない会話）、中央は会話。作業中の様子は会話の流れに出る",
      "primaryAction": "送る",
      "release": "v1"
    },
    "ai-activity": {
      "id": "ai-activity",
      "name": "AI社員の動き",
      "route": "/ai-staff/activity",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "自分のAIが配ったものが、どのAI社員の手でどう進んだかを1本の流れで追う。止まっているところが分かる",
      "primaryAction": "止まっているところへ",
      "release": "v1"
    },
    "search": {
      "id": "search",
      "name": "探す",
      "route": "/search",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "台帳・記憶・証跡を言葉で横断して探す",
      "primaryAction": "探す",
      "release": "v1"
    },
    "records": {
      "id": "records",
      "name": "台帳",
      "route": "/records",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "案件・請求・問い合わせを工程のカンバンか一覧で見て、止まっているものを見つける",
      "primaryAction": "1件をひらく",
      "release": "v1"
    },
    "record-detail": {
      "id": "record-detail",
      "name": "台帳の1件",
      "route": "/records/:id",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "1件の中身・段階・関連するタスクと証跡を見て、次の段階へ動かす",
      "primaryAction": "次の段階へ",
      "release": "v1"
    },
    "goals": {
      "id": "goals",
      "name": "目標",
      "route": "/goals",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3"
      ],
      "purpose": "会社から自分まで何層でも、降ろした数と積み上がった数を同じ画面で見て、届くかを判断する",
      "primaryAction": "配分を見直す",
      "release": "v1"
    },
    "goal-allocation": {
      "id": "goal-allocation",
      "name": "目標の配分",
      "route": "/goals/:id/allocation",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "層ごとに誰に・どれだけ降ろすかと、その層にどこまで見せるかを決める。未配分は赤で残る",
      "primaryAction": "配る",
      "release": "v1"
    },
    "goal-edit": {
      "id": "goal-edit",
      "name": "目標を改訂する",
      "route": "/goals/:id/edit",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "期の途中で目標を直す・無くす。紐づく配分とタスクへの影響を先に見て、行き先のないものを残さない",
      "primaryAction": "改訂する",
      "release": "v1"
    },
    "my-progress": {
      "id": "my-progress",
      "name": "自分の目標",
      "route": "/my-progress",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "配られた分の進み・自主目標・自分のAI社員への配分を、本人がここで管理する",
      "primaryAction": "自主目標を足す",
      "release": "v1"
    },
    "review": {
      "id": "review",
      "name": "ふりかえり",
      "route": "/review",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "なぜ届いた／届かなかったかを、自分のAIが書いた差分と要因で読む",
      "primaryAction": "仮説を見る",
      "release": "v1"
    },
    "hypotheses": {
      "id": "hypotheses",
      "name": "仮説と施策",
      "route": "/hypotheses",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "出た仮説から採るものを決め、施策に予算を置いてタスクまで落とす。効いたかと、いくらで効いたかを見る。施策の期間はタイムラインで見る",
      "primaryAction": "採る",
      "release": "v1"
    },
    "duties": {
      "id": "duties",
      "name": "担当業務",
      "route": "/duties",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "AI社員がやる仕事の定義を書き換える。覚えた操作はこの下に畳まれている",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "clone-memory": {
      "id": "clone-memory",
      "name": "自分のAIの記憶",
      "route": "/ai/memory",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "運営／会社／この会社の層／個人／AI社員の範囲ごとに、覚えていることを見て教える。自分の範囲は自由、それ以外は権限のある人だけが直せる",
      "primaryAction": "教える",
      "release": "v1"
    },
    "ledger-def": {
      "id": "ledger-def",
      "name": "台帳の形",
      "route": "/settings/ledgers",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "この会社の台帳の項目と段階を決める。台帳ごとに画面は作らない",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "company-model": {
      "id": "company-model",
      "name": "会社モデル",
      "route": "/company-model",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "目標・台帳・担当業務・組織・ルール・記憶が1つの定義として今どうなっているかを見る",
      "primaryAction": "中身を見る",
      "release": "v1"
    },
    "automation-repair": {
      "id": "automation-repair",
      "name": "覚え直させる",
      "route": "/automations/:id/repair",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "外部サービスの画面が変わって止まったとき、AIに手順を覚え直させる",
      "primaryAction": "覚え直させる",
      "release": "v1"
    },
    "audit": {
      "id": "audit",
      "name": "証跡",
      "route": "/audit",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "誰が・いつ・何をしたかを追い、必要なら取り消す／書き出す。運営にサポートアクセスを許可する・取り消すもここ",
      "primaryAction": "書き出す",
      "release": "v1"
    },
    "policies": {
      "id": "policies",
      "name": "ルール",
      "route": "/policies",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "AIにやらせる範囲を決める。運営／会社／部署／個人の4層で持つ",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "members": {
      "id": "members",
      "name": "メンバー",
      "route": "/members",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "人を招き、層（この会社の呼び方）に置き、役割と権限を決める。1人を押すと権限の表",
      "primaryAction": "招待する",
      "release": "v1"
    },
    "ai-staff": {
      "id": "ai-staff",
      "name": "AI社員",
      "route": "/ai-staff",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "いるAI社員を見て、増やす・人に託す",
      "primaryAction": "AI社員を作る",
      "release": "v1"
    },
    "ai-staff-detail": {
      "id": "ai-staff-detail",
      "name": "AI社員の1体",
      "route": "/ai-staff/:id",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "このAI社員が何をやるか・誰に託されているか・何を守るか・どのスキルを使えるかを見る。会社の権限者はスキルを外せる",
      "primaryAction": "担当業務を編集",
      "release": "v1"
    },
    "security-brief": {
      "id": "security-brief",
      "name": "この製品でできること・できないこと",
      "route": "/security",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "情シスやコンプラに、Bridgeが何をして何をしないかをそのまま見せる",
      "primaryAction": "PDFで出す",
      "release": "v1"
    },
    "disclosure": {
      "id": "disclosure",
      "name": "開示資料",
      "route": "/security/disclosure",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "情シス・コンプラに渡す資料（できる操作の列挙・送るもの／送らないもの・サブプロセッサ・DPA・アンインストールの検証結果）を版つきで見て PDF で出す",
      "primaryAction": "PDF で出す",
      "release": "v2"
    },
    "export": {
      "id": "export",
      "name": "持ち出す",
      "route": "/export",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "会社モデルもデータも全部書き出す。囲い込まない",
      "primaryAction": "書き出す",
      "release": "v1"
    },
    "account-close": {
      "id": "account-close",
      "name": "退会する",
      "route": "/settings/close",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "全オブジェクトで何が消えて何が残るかを見て、持ち出してから退会する。全端末・接続・資格情報は即失効、データは 30 日猶予",
      "primaryAction": "退会する",
      "release": "v1"
    },
    "ops-support": {
      "id": "ops-support",
      "name": "運営の支援",
      "route": "/ops/support",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "受信箱。全社の問い合わせと、データを見ずに分かる詰まりを横断で並べる入口。返答と対処は会社の詳細で行う",
      "primaryAction": "返答する",
      "release": "v1"
    },
    "ops-home": {
      "id": "ops-home",
      "name": "運営：会社の一覧",
      "route": "/ops",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "各社のプラン・AI社員の体数・稼働・詰まりを、中身を見ずに一覧する",
      "primaryAction": "詰まりを開く",
      "release": "v1"
    },
    "ops-catalog": {
      "id": "ops-catalog",
      "name": "運営：配るもの",
      "route": "/ops/catalog",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "運営配布のAI社員・担当業務・ルール・テンプレ・目標スキルをマスタとして版で管理し、プラン別に出し分ける。プランの定義（価格・上限）もここ",
      "primaryAction": "版を出す",
      "release": "v1"
    },
    "account": {
      "id": "account",
      "name": "自分のアカウント",
      "route": "/account",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "名前・メール・パスワード・2 段階認証・ログイン中の端末を自分で整える。変えると他の端末は入り直し",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "company-settings": {
      "id": "company-settings",
      "name": "会社の設定",
      "route": "/settings/company",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "会社名・請求先・データの所在・タイムゾーン。運営マネージドの切替は段階2",
      "primaryAction": "保存する",
      "release": "v1"
    },
    "llm-routes": {
      "id": "llm-routes",
      "name": "AI の経路",
      "route": "/settings/llm",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "Bridge／自分の API キー／運営マネージド を、会社の既定と PC が閉じているときの経路として選ぶ。キーは預けるだけで見えない。使用量と上限もここ",
      "primaryAction": "保存する",
      "release": "v2"
    },
    "app-setup": {
      "id": "app-setup",
      "name": "アプリと通知",
      "route": "/settings/app",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "PC の Bridge の窓とスマホのアプリを入れ、承認待ち・AI 停止・お知らせの通知を受け取る端末を整える",
      "primaryAction": "通知を許可する",
      "release": "v2"
    },
    "import": {
      "id": "import",
      "name": "取り込み",
      "route": "/import",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "既存の顧客リスト・過去の請求書・メール・画像を形式を問わず入れる。自分のAIが読んで台帳の下書きと書式の候補を出す",
      "primaryAction": "取り込む",
      "release": "v1"
    },
    "services": {
      "id": "services",
      "name": "外部サービスの連携",
      "route": "/services",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "使っている外部サービスごとに 自動操作の可否と理由・正規連携（API）のつなぎ方・今の接続を見る",
      "primaryAction": "つなぐ",
      "release": "v1"
    },
    "ops-services": {
      "id": "ops-services",
      "name": "運営：サービス台帳",
      "route": "/ops/services",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "外部サービスごとの自動操作の可否（api／allowed／unspecified／forbidden／bank）と理由を版で管理する。全社に効く",
      "primaryAction": "版を出す",
      "release": "v1"
    },
    "ops-skills": {
      "id": "ops-skills",
      "name": "運営：スキル",
      "route": "/ops/skills",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "運営がスキル（構築メタスキル・目標スキル・業務スキル）を構築・アップロード・テストして版を出し、プランと会社に配る。装着の状況（会社 × AI社員）を見る",
      "primaryAction": "版を出す",
      "release": "v1"
    },
    "inquiry": {
      "id": "inquiry",
      "name": "問い合わせ",
      "route": "/inquiry",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "運営に聞く。自分のAIがまず答え、解けなければ運営へ。返答と状態はここで見える",
      "primaryAction": "問い合わせる",
      "release": "v1"
    },
    "notices": {
      "id": "notices",
      "name": "お知らせと通知",
      "route": "/notices",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2",
        "R3",
        "R4"
      ],
      "purpose": "運営からのお知らせ・稼働状況を見て、承認待ちや止まったときの通知をどこに届けるか決める",
      "primaryAction": "通知の届け先を保存する",
      "release": "v1"
    },
    "billing": {
      "id": "billing",
      "name": "プランと請求",
      "route": "/billing",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "今のプラン・使える量と使った量・請求書。プランを変える。支払い方法の登録は段階2",
      "primaryAction": "プランを変える",
      "release": "v1"
    },
    "ops-notices": {
      "id": "ops-notices",
      "name": "運営：お知らせ",
      "route": "/ops/notices",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "お知らせ（リリース・障害・メンテ・ルールの版）と稼働状況を出す。対象プランと公開日時を決める",
      "primaryAction": "出す",
      "release": "v1"
    },
    "ops-billing": {
      "id": "ops-billing",
      "name": "運営：請求と入金",
      "route": "/ops/billing",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "各社の請求・入金・未収・利用量と上限を横断で見る入口。入金の記録・未収の連絡・プラン変更の承認は会社の詳細で行う",
      "primaryAction": "未収に連絡する",
      "release": "v1"
    },
    "ops-llm": {
      "id": "ops-llm",
      "name": "運営：AI の経路と使用量",
      "route": "/ops/llm",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "会社ごとに運営マネージドの経路を許可し、3 社の使用量と費用を横断で見る。キーの中身は見ない",
      "primaryAction": "許可する",
      "release": "v2"
    },
    "ops-disclosure": {
      "id": "ops-disclosure",
      "name": "運営：開示資料",
      "route": "/ops/disclosure",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "成果物から生成した開示資料の版を出し、DPA の雛形とサブプロセッサ一覧を整える。変えたら全社にお知らせ",
      "primaryAction": "版を出す",
      "release": "v2"
    },
    "ops-tenant": {
      "id": "ops-tenant",
      "name": "運営：会社の 1 社",
      "route": "/ops/tenants/:id",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "1 社の詳細。構成と状態・請求と入金・問い合わせ・配布したもの・審査・証跡とサポートアクセス・お知らせ・退会と猶予の 8 面で、この会社への対応を行う。中身は見ない",
      "primaryAction": "対処を送る",
      "release": "v1"
    },
    "ops-review": {
      "id": "ops-review",
      "name": "運営：公開の審査",
      "route": "/ops/review",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "会社が明示的に公開したテンプレ・担当業務を横断で並べる入口。匿名化の確認と承認・却下は会社の詳細の審査で行う",
      "primaryAction": "承認する",
      "release": "v1"
    },
    "ops-audit": {
      "id": "ops-audit",
      "name": "運営：運営の証跡",
      "route": "/ops/audit",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R6"
      ],
      "purpose": "運営全体の証跡（誰が・どの会社に・何をしたか）とセキュリティの出来事を横断で見て、運営メンバーの権限を決める。会社ごとの証跡は会社の詳細にもある",
      "primaryAction": "書き出す",
      "release": "v1"
    },
    "member-detail": {
      "id": "member-detail",
      "name": "メンバーの1人",
      "route": "/members/:id",
      "needsLogin": true,
      "hasShell": true,
      "roles": [
        "R1",
        "R2"
      ],
      "purpose": "1人の所属する層・役割・権限（何を・どの層で・見る／直す／配る／承認する）を決める。本人のものは権限なしで自由。抜けるときは依存を片づけてから無効にする",
      "primaryAction": "保存する",
      "release": "v1"
    }
  },
  "roles": [
    {
      "id": "R1",
      "name": "自分で全部回している人"
    },
    {
      "id": "R2",
      "name": "代表と、その下に数人がいる会社の代表"
    },
    {
      "id": "R3",
      "name": "配られた仕事だけをする人"
    },
    {
      "id": "R4",
      "name": "進捗だけ見る外部の人"
    },
    {
      "id": "R6",
      "name": "Kaname 運営（ENGINE BASE 側）"
    }
  ]
};

/** 指定が無い・無い・見えない のときの行き先（D-086・flow.json navigation.fallbacks） */
export const FALLBACKS = {
  "entry": {
    "anonymous": "/login",
    "noBridge": "/setup/bridge",
    "signedIn": "/today"
  },
  "notFound": {
    "title": "この画面はありません"
  },
  "forbidden": {
    "title": "この権限では見えない",
    "back": "/today"
  }
} as const;
