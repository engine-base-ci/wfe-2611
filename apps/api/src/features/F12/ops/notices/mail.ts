// 使えなくなるメンテのお知らせを、届く会社の管理者にメールで知らせる（K-978・関門 C6・D-156.11・D-128.109）。
//   送るのは関門 C6 の NotifyGateway だけ（transport は材料の mailer・経路は email だけ・1 人 1 通）。
//   宛先は DB の関数 app.ops_notice_publish が集めた並び（届く会社の管理者・止めている会社は入らない）。口は取引の後に呼ぶ。
//   送れなくてもお知らせは出したまま。ログは送れなかった件数だけ（宛先・題を出さない）。送り直しの口は無い（リスク）
import type { TenantContext } from "@kaname/db/context";
import type { Repository } from "@kaname/db/repository";
import { NotifyGateway, type NotifyEvent, type Transport } from "@kaname/notify";
import type { HookMailer } from "../../../../hooks/registry.js";

export const MAINTENANCE_MAIL_KIND = "notice.maintenance_mail";
/** 1 人に送る回数（最初の 1 回＋送り直し 1 回） */
const MAIL_ATTEMPTS = 2;

/** 関数が返すメールの材料（題・本文・メンテの時間） */
export interface MaintenanceMail {
  noticeId: string;
  title: string;
  body: string;
  from: string | null;
  to: string | null;
}

const JST = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const jst = (iso: string | null): string => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : JST.format(d);
};

/** 件名と本文（お知らせの字とメンテの時間だけ。リンクも秘密も入れない） */
export function maintenanceMailOf(n: MaintenanceMail): { subject: string; text: string } {
  return {
    subject: `【Kaname】メンテナンスのお知らせ：${n.title}`,
    text: [
      `メンテナンスの時間：${jst(n.from)} 〜 ${jst(n.to)}（日本時間）`,
      "この時間は Kaname を使えなくなります。",
      "",
      n.body,
    ].join("\n"),
  };
}

const failLog = (n: number) => console.error(`[notices] メンテのメールを送れなかった（${n} 件）`);

/** 宛先に 1 通ずつ送る。答えは送れなかった件数（ログはここで 1 行） */
export async function sendMaintenanceMail(
  d: { repo: Repository; mailer?: HookMailer },
  ctx: TenantContext,
  to: readonly string[],
  n: MaintenanceMail,
): Promise<number> {
  if (to.length === 0) return 0;
  const mailer = d.mailer;
  if (!mailer) {
    failLog(to.length); // 送出先が無い（fuzz の的）：送らずにログだけ
    return to.length;
  }
  const mail = maintenanceMailOf(n);
  const transport: Transport = {
    send: async (_ch, address) => {
      if (!address) throw new Error("宛先が無い");
      await mailer({ to: address, ...mail });
    },
  };
  const event: NotifyEvent = {
    kind: MAINTENANCE_MAIL_KIND,
    payload: { notice_id: n.noticeId },
    dedupeKey: `${MAINTENANCE_MAIL_KIND}:${n.noticeId}`,
  };
  const gw = new NotifyGateway(
    d.repo,
    transport,
    { resolve: async () => to.map((address) => ({ memberId: address, kind: "human" as const, address })) },
    { channelsOf: () => ["email"], maxAttempts: MAIL_ATTEMPTS },
  );
  let failed: number;
  try {
    const { deliveries } = await gw.notify(event, { memberIds: [...to] }, ctx);
    failed = deliveries.filter((x) => x.status !== "sent").length;
  } catch {
    failed = to.length; // 関門の中の記録が書けないなど：送れたとは言わない
  }
  if (failed > 0) failLog(failed);
  return failed;
}
