// S3 互換のドライバ（関門 C4 の中だけ）。Supabase Storage の S3 互換 API・MinIO・AWS S3 に同じコードで当たる（D-049：supabase-js の storage クライアントは使わない）
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { ExternalSigner, ObjectMeta, StorageDriver } from "./index.js";

export interface S3Settings {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  forcePathStyle?: boolean;
}
/** テストで差し替えられる最小の口（send だけ） */
export interface S3Like {
  send(cmd: unknown): Promise<unknown>;
}
export function s3Client(s: S3Settings): S3Client {
  const cfg: S3ClientConfig = {
    endpoint: s.endpoint,
    region: s.region,
    forcePathStyle: s.forcePathStyle ?? true,
    credentials: { accessKeyId: s.accessKeyId, secretAccessKey: s.secretAccessKey },
  };
  return new S3Client(cfg);
}
const META_EXPIRES = "x-kaname-expires-at";

export function s3Driver(client: S3Like, bucket: string): StorageDriver & { exists(): Promise<boolean> } {
  return {
    async put(key, body, meta) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: meta.contentType,
          ContentLength: meta.size,
          Metadata: meta.expiresAt ? { [META_EXPIRES]: meta.expiresAt.toISOString() } : {},
        }),
      );
    },
    async get(key) {
      let out: {
        Body?: { transformToByteArray(): Promise<Uint8Array> };
        ContentType?: string;
        ContentLength?: number;
        Metadata?: Record<string, string>;
      };
      try {
        out = (await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }))) as typeof out;
      } catch (e) {
        if ((e as { name?: string }).name === "NoSuchKey") return null;
        throw e;
      }
      if (!out.Body) return null;
      const bytes = await out.Body.transformToByteArray();
      const exp = out.Metadata?.[META_EXPIRES];
      const meta: ObjectMeta = {
        size: out.ContentLength ?? bytes.byteLength,
        contentType: out.ContentType ?? "application/octet-stream",
        expiresAt: exp ? new Date(exp) : null,
      };
      return { body: bytes, meta };
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      return true; // S3 の DeleteObject は無くても 204（存在の判定は get で）
    },
    /** 起動時の存在確認（G-11）：バケットが無ければ false。黙って 502 にしない */
    async exists() {
      try {
        await client.send(new HeadBucketCommand({ Bucket: bucket }));
        return true;
      } catch {
        return false;
      }
    },
  };
}
/** プロビジョニング（冪等）：無ければ作る。infra/provision/bucket.ts から呼ぶ */
export async function ensureBucket(client: S3Like, bucket: string): Promise<"exists" | "created"> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return "exists";
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
    return "created";
  }
}

/** 外の置き場の期限つき URL（D-128.160）：置き場の仕組み（S3 の署名つき URL・SigV4）で作る。Kaname の鍵では署名しない。
 *  URL は置き場の出どころ（endpoint・道の頭まで）の下で、道が「/<バケット>/<鍵>」（path-style）のものだけ。ほかは作らない（null） */
export function s3Presigner(client: S3Client, endpoint: string): ExternalSigner {
  const ep = new URL(endpoint);
  const head = ep.pathname.replace(/\/$/, "");
  return {
    async presignGet(url, ttlSeconds) {
      if (url.origin !== ep.origin || !url.pathname.startsWith(`${head}/`)) return null;
      const rest = url.pathname
        .slice(head.length + 1)
        .split("/")
        .map(decodeURIComponent);
      const [bucket, ...key] = rest;
      if (!bucket || key.length === 0 || key.some((k) => !k || k === "." || k === "..")) return null;
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key.join("/") }), {
        expiresIn: ttlSeconds,
      });
    },
  };
}
