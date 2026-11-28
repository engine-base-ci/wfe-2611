// 資格情報の置き場（Infisical）の秘密の操作が上限の 8 割に来たことを運営に知らせる（D-102.5・T-B-14）。
// 関門 C8（InfisicalVault）の onNearLimit から呼ばれる。ログは毎回、メールは 1 つの実体につき 1 時間に 1 回まで（同じ知らせで受信箱を埋めない）。
// 本文に秘密の値や会社の名前は入れない（運営が決めるのは Pro にするか自分で動かすか・D-102.6）
export interface NearLimit {
  perMinute: number;
  limit: number;
}
export interface OpsAlertDeps {
  /** 送出（関門 C6）。無ければログだけ（開発） */
  mailer?: (m: { to: string; subject: string; text: string }) => Promise<void>;
  /** 運営の宛先（info@） */
  opsEmail: string;
  now?: () => number;
  log?: (line: string) => void;
}
/** 同じ知らせを繰り返さない間隔（1 時間） */
export const NEAR_LIMIT_MAIL_INTERVAL_MS = 3_600_000;

export function nearLimitNotifier(d: OpsAlertDeps): (u: NearLimit) => void {
  const now = d.now ?? Date.now;
  const log = d.log ?? ((line: string) => console.warn(line));
  let mailedAt: number | null = null; // 0 にすると、時計の値が小さい（試験の偽の時計）とき 1 通目が「1 時間以内」に見える
  return (u) => {
    log(`[ops] Infisical の秘密の操作が上限の 8 割（${u.perMinute}／毎分 ${u.limit}）`);
    if (!d.mailer || (mailedAt !== null && now() - mailedAt < NEAR_LIMIT_MAIL_INTERVAL_MS)) return;
    mailedAt = now();
    void d
      .mailer({
        to: d.opsEmail,
        subject: "Kaname｜資格情報の置き場（Infisical）の上限に近づいています",
        text: `直近 1 分の秘密の操作が ${u.perMinute} 回で、上限（毎分 ${u.limit} 回）の 8 割に来ました。\n当たると利用者の保存・実行が「混み合っています」で止まります。\n続くようなら Pro（毎分 300 回）にするか、自分で動かすかを決めてください（決定ログ §102）。`,
      })
      .catch((e: unknown) => log(`[ops] 上限の知らせを送れなかった: ${(e as Error).message}`)); // 送れなくても API は止めない。ログには残す（G-15）
  };
}
