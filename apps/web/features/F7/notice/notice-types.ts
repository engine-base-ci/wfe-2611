// お知らせ（F7・段 8）の表示部品が受け取る値の形。口とはつながず、値を受け取って描くだけ。
//   種類 → 札と行き先の表（P4）の本物は口の側（K-461）に 1 か所。ここは、その表から出てきた「見える形」だけを受ける。
//   知らない種類は口の側で読み飛ばす（ここまで届かない）。

/** お知らせの種類（札の言葉が決まる）。設定＝ security.*・bridge.connected（行き先は自分の設定） */
export type NoticeKind = "handover" | "approval" | "mention" | "due" | "stopped" | "operator" | "setting";

/** 丸い印の色：人は正本のデータの色（--k-d-*）、AI と運営は決まった色 */
export type NoticeAvatarTone = "ai" | "operator" | "indigo" | "teal" | "amber" | "coral" | "sage" | "plum" | "lavender";

export interface NoticeItem {
  id: string;
  kind: NoticeKind;
  /** 丸い印（人の頭文字・AI・運） */
  avatar: { initial: string; tone: NoticeAvatarTone };
  /** 1 行目の文（口の側が種類ごとに作る。本文は番号と題名だけ・P13） */
  text: string;
  /** 2 行目の頭（チケット番号など）。無ければ時刻だけ */
  label?: string;
  /** 「1 時間前」「昨日」など。見える形にして渡す */
  when: string;
  unread: boolean;
  /** 押したときの行き先。無ければ「読むだけ」（押すと既読になるだけ・運営のお知らせ） */
  href?: string;
}

/** 「人で絞る」の候補（自分に知らせた人） */
export interface NoticePerson {
  id: string;
  name: string;
}

/** 一覧の読み込みの様子 */
export type NoticeStatus = "ready" | "loading" | "failed";
