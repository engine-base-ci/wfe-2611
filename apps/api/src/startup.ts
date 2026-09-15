// 起動時の存在確認の組み立て（G-11）。表（migration）・バケット・秘密の鍵・メールの送出先
import type { Config } from "@kaname/config";
import { assertStartup, type StartupCheck } from "@kaname/config";
import type { Repository } from "@kaname/db/repository";

export interface StartupDeps {
  config: Config;
  repo: Repository;
  bucketExists: () => Promise<boolean>;
}
export function startupChecks(d: StartupDeps): Record<string, StartupCheck> {
  return {
    "db:tables": async () => {
      await d.repo.init(); // 表が無ければ例外（migration 未適用）
      return true;
    },
    "storage:bucket": d.bucketExists,
    "secrets:master-key": async () => Buffer.from(d.config.secretsMasterKey, "base64").length >= 32,
    // メールは無くても起動する（inapp だけ）。ただし本番では必須
    "notify:resend": async () => d.config.env !== "production" || d.config.resendApiKey !== null,
  };
}
export const assertApiStartup = (d: StartupDeps) => assertStartup(startupChecks(d));
