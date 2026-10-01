// Vercel の関数の入口（D-097）。段階 1 は画面も API も Vercel（画面とは別のプロジェクト・API は独立のまま・D-043.3）。
// 起動時の存在確認（G-11）は関数の実体が立ったときに 1 回だけ流し、結果を覚えて使い回す。落ちたら覚えず、次の要求でやり直す
// （黙って 502 にしない：存在確認に落ちている間は 503 と理由を返す）。
// DB の本数は関数 1 つにつき 業務 3・認証 2（関数は同時にいくつも立つ・G-16）。
import { getRequestListener } from "@hono/node-server";
import { loadConfig } from "@kaname/config";
import { bootApi, type Booted } from "./server.js";

export const VERCEL_POOL = { app: 3, auth: 2 } as const;

/** 組み立てを 1 回だけ（同時に来た要求は同じ組み立てを待つ）。失敗は覚えない */
export function lazyBoot(boot: () => Promise<Booted>): () => Promise<Booted> {
  let booting: Promise<Booted> | null = null;
  return () => {
    booting ??= boot().catch((e: unknown) => {
      booting = null;
      throw e;
    });
    return booting;
  };
}

/** 要求を組み立て済みの API に渡す。組み立てに落ちたら 503（理由つき） */
export function vercelFetch(booted: () => Promise<Booted>): (req: Request) => Promise<Response> {
  return async (req) => {
    let b: Booted;
    try {
      b = await booted();
    } catch (e) {
      console.error("[api] 起動しない:", (e as Error).message);
      return Response.json(
        { code: "STARTUP_FAILED", message: "いまサービスを始められません。少し待ってからもう一度試してください" },
        { status: 503 },
      );
    }
    return b.app.fetch(req);
  };
}

export default getRequestListener(vercelFetch(lazyBoot(() => bootApi(loadConfig(), { poolMax: VERCEL_POOL }))));
