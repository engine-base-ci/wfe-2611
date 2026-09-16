// 開発用の起動口。本番と同じ bootApi を通す。違いは 1 つ：KANAME_DEV_FAKE_BUCKET=1 のときだけバケットの存在確認を差し替える
// （ローカルの MinIO が落ちているときに画面の実ブラウザ試験を回すため）。production では絶対に効かない（loadConfig の env で落とす）
import { loadConfig } from "@kaname/config";
import { startServer } from "./server.js";

const cfg = loadConfig();
const fake = process.env["KANAME_DEV_FAKE_BUCKET"] === "1" && cfg.env !== "production";
if (fake)
  console.warn(
    "[api:dev] バケットの存在確認を差し替えている（KANAME_DEV_FAKE_BUCKET=1）。添付・成果物の保存は失敗する。本番では無効",
  );
startServer(cfg, fake ? { bucketExists: async () => true } : {}).then(
  (s) => console.log(`[api:dev] 起動 port ${s.port}（存在確認 ${fake ? "バケットは差し替え" : "OK"}）`),
  (e: unknown) => {
    console.error("[api:dev] 起動しない:", (e as Error).message);
    process.exit(1);
  },
);
