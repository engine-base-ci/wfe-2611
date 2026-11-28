// お知らせの札（種類ごとに 1 つ・キャンバス StOverlay／MbNotify の右端の札）。札は components/k の Badge（状態の淡い面と濃い文字の対）。
//   色だけで伝えない：札には必ず字を持つ。
import { Badge, type BadgeTone } from "@/components/k";
import type { NoticeKind } from "./notice-types";

/** 種類 → 札の字と色。字はキャンバスのとおり（期限を変えたお知らせは「書き込み」の札・設定は案） */
export const NOTICE_TAG: Record<NoticeKind, { label: string; tone: BadgeTone }> = {
  handover: { label: "受ける？", tone: "warning" },
  approval: { label: "承認待ち", tone: "warning" },
  mention: { label: "@", tone: "progress" },
  due: { label: "書き込み", tone: "neutral" },
  stopped: { label: "止まった", tone: "danger" },
  operator: { label: "運営", tone: "neutral" },
  setting: { label: "設定", tone: "neutral" },
};

export function NoticeTag({ kind }: { kind: NoticeKind }) {
  const t = NOTICE_TAG[kind];
  return <Badge tone={t.tone}>{t.label}</Badge>;
}
