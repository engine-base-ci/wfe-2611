// API の起動口（T-F-18）。設定（packages/config）→ DB のプール・認証・関門 → 起動時の存在確認（G-11）→ HTTP。
// 画面は API を叩くだけ（D-043.3）。Railway の Dockerfile はこれを `pnpm api:start` で動かす。存在確認に落ちたら起動しない（黙って 502 を返さない）
import { serve, type ServerType } from "@hono/node-server";
import { loadConfig, type Config, type StartupReport } from "@kaname/config";
import { createPool } from "@kaname/db/pool";
import { createRepository } from "@kaname/db/repository";
import { createAuth } from "@kaname/auth";
import { createSessionResolver } from "@kaname/auth/resolver";
import { s3Client, s3Driver } from "@kaname/storage";
import { createApp } from "./app.js";
import { assertApiStartup } from "./startup.js";

export interface BootOptions {
  /** 起動時の存在確認の差し替え（テスト用。本番は S3 の HEAD） */
  bucketExists?: () => Promise<boolean>;
  version?: string;
}
export interface Booted {
  app: ReturnType<typeof createApp>;
  report: StartupReport;
  close: () => Promise<void>;
}

/** 設定から API を組み立て、存在確認を通す。落ちたら例外（起動しない） */
export async function bootApi(config: Config, o: BootOptions = {}): Promise<Booted> {
  const appPool = createPool({ databaseUrl: config.databaseUrl, max: 10 });
  const repo = await createRepository(appPool);
  const { auth, pool: authPool } = createAuth({
    authDatabaseUrl: config.authDatabaseUrl,
    appPool,
    secret: config.authSecret,
    baseURL: config.baseUrl,
  });
  const bucketExists = o.bucketExists ?? s3Driver(s3Client(config.storage), config.storage.bucket).exists;
  const close = async () => {
    await authPool.end();
    await appPool.end();
  };
  let report: StartupReport;
  try {
    report = await assertApiStartup({ config, repo, bucketExists });
  } catch (e) {
    await close();
    throw e;
  }
  const app = createApp({ version: o.version ?? "0.1.0", repo, auth, resolve: createSessionResolver(auth, appPool) });
  return { app, report, close };
}

export interface Started {
  server: ServerType;
  port: number;
  close: () => Promise<void>;
}
/** HTTP で待ち受ける。port 0 なら空いている口（テスト）。戻り値の close で止める */
export async function startServer(config: Config, o: BootOptions = {}): Promise<Started> {
  const booted = await bootApi(config, o);
  // listen が終わってから返す（port 0 なら実際に取れた口を返す。閉じるのも listen 後）
  const { server, port } = await new Promise<{ server: ServerType; port: number }>((resolve) => {
    const srv = serve({ fetch: booted.app.fetch, port: config.port, hostname: "0.0.0.0" }, (info) =>
      resolve({ server: srv, port: info.port }),
    );
  });
  return {
    server,
    port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else booted.close().then(resolve, reject);
        });
      }),
  };
}

const entry = process.argv[1] ?? "";
if (entry.endsWith("server.ts") || entry.endsWith("server.js")) {
  startServer(loadConfig()).then(
    (s) => console.log(`[api] 起動 port ${s.port}（存在確認 OK）`),
    (e: unknown) => {
      console.error("[api] 起動しない:", (e as Error).message);
      process.exit(1);
    },
  );
}
