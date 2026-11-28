// ローカルのドライバ（開発・テスト）。本番は S3 互換（T-F-16 の外部リソースのコード化で差し替え。supabase-js の storage クライアントは使わない）
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import type { ObjectMeta, StorageDriver } from "./index.js";

export function localDriver(root: string): StorageDriver {
  const base = resolve(root);
  const pathOf = (key: string) => {
    const p = resolve(base, key);
    if (!p.startsWith(base + sep)) throw new Error("鍵が置き場の外を指している");
    return p;
  };
  return {
    async put(key, body, meta) {
      const p = pathOf(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, body);
      await writeFile(
        p + ".meta.json",
        JSON.stringify({ ...meta, expiresAt: meta.expiresAt ? meta.expiresAt.toISOString() : null }),
      );
    },
    async get(key) {
      const p = pathOf(key); // 置き場の外は例外（黙って null にしない）
      try {
        const body = new Uint8Array(await readFile(p));
        const raw = JSON.parse(await readFile(p + ".meta.json", "utf8")) as {
          size: number;
          contentType: string;
          expiresAt: string | null;
        };
        const meta: ObjectMeta = {
          size: raw.size,
          contentType: raw.contentType,
          expiresAt: raw.expiresAt ? new Date(raw.expiresAt) : null,
        };
        return { body, meta };
      } catch {
        return null;
      }
    },
    async delete(key) {
      const p = pathOf(key);
      try {
        await rm(p);
        await rm(p + ".meta.json", { force: true });
        return true;
      } catch {
        return false;
      }
    },
  };
}
