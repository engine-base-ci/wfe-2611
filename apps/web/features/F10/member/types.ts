// メンバーの 1 人の画面（段 11・F10）の見本の値の形。部品は値を受け取って描くだけ（口は呼ばない）
export interface MemberDetailData {
  name: string;
  email: string;
  /** 入った日（2026-04-10 から） */
  since: string;
  group: string;
  role: string;
  /** 役割を変えた人と日（11/02 にマネージャーから（高本）） */
  roleNote?: string;
  /** 兼ねているグループ */
  also: readonly string[];
  ticketLine: string;
  /** 分身の状態 */
  pcLine: string;
  pcTone: "ok" | "warn" | "none";
  runsLine: string;
  stuckLine: string;
  loginHow: string;
  /** 2 段階認証の言い方。app が true なら認証アプリを付けている（「戻す」が出る） */
  twofa: string;
  twofaApp: boolean;
  lastLogin: string;
  records: readonly { when: string; text: string }[];
  /** 自分を開いた（止める・外すは押せない） */
  self?: boolean;
  /** 止まっている（帯と「戻す」） */
  suspended?: boolean;
}

export interface TicketHand {
  code: string;
  title: string;
  status: string;
  /** 渡し中のチケットは、外す前に取り消される */
  handing?: boolean;
}
