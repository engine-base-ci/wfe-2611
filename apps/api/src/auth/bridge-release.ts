// Bridge の配布物の目録（D-109）。置き場（Kaname のサーバー）に「いまの版・ファイル・指紋（sha256）・大きさ」を 1 つ書く。
//   配るのは目録に載ったファイルだけ（名前で置き場の外を指させない）。Bridge は指紋が合うときだけ入れ替える
import { createReadStream, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export const MANIFEST = "kaname-bridge.json";

export type BridgeOs = "mac" | "win";
export type BridgeArch = "arm64" | "x64";
export interface ReleaseFile {
  platform: BridgeOs;
  arch: BridgeArch;
  /** app＝自分で入れ替える中身（mac は .app の zip・win はインストーラ）／installer＝人が受け取るもの（.dmg / .exe） */
  kind: "app" | "installer";
  name: string;
  sha256: string;
  size: number;
}
export interface ReleaseManifest {
  version: string;
  released_at: string;
  files: ReleaseFile[];
}

const NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;
const VERSION = /^\d{1,9}\.\d{1,9}\.\d{1,9}$/;

/** 目録として読めるものだけ通す（壊れた目録・置き場の外を指す名前は無いものとして扱う） */
export function parseManifest(raw: unknown): ReleaseManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["version"] !== "string" || !VERSION.test(r["version"]) || !Array.isArray(r["files"])) return null;
  const files: ReleaseFile[] = [];
  for (const f of r["files"] as unknown[]) {
    const x = (f ?? {}) as Record<string, unknown>;
    const ok =
      (x["platform"] === "mac" || x["platform"] === "win") &&
      (x["arch"] === "arm64" || x["arch"] === "x64") &&
      (x["kind"] === "app" || x["kind"] === "installer") &&
      typeof x["name"] === "string" && NAME.test(x["name"]) && !x["name"].includes("..") &&
      typeof x["sha256"] === "string" && /^[0-9a-f]{64}$/.test(x["sha256"]) &&
      Number.isInteger(x["size"]) && (x["size"] as number) > 0;
    if (!ok) return null;
    files.push({ platform: x["platform"], arch: x["arch"], kind: x["kind"], name: x["name"], sha256: x["sha256"], size: x["size"] } as ReleaseFile);
  }
  return { version: r["version"], released_at: typeof r["released_at"] === "string" ? r["released_at"] : "", files };
}

let cached: { base: string; at: number; m: ReleaseManifest | null } | null = null;
const CACHE_MS = 60_000;

/** 目録を読む。手元のフォルダ（開発）が先、無ければ置き場の URL（staging／本番・1 分だけ覚える） */
export async function readManifest(cfg: { dir?: string; base?: string }): Promise<{ m: ReleaseManifest; from: "dir" | "base" } | null> {
  if (cfg.dir) {
    try {
      const m = parseManifest(JSON.parse(readFileSync(join(cfg.dir, MANIFEST), "utf8")));
      if (m) return { m, from: "dir" };
    } catch {
      /* 目録がまだ無い＝配布していない */
    }
  }
  const base = (cfg.base ?? "").replace(/\/$/, "");
  if (!base) return null;
  if (!cached || cached.base !== base || Date.now() - cached.at > CACHE_MS) {
    let m: ReleaseManifest | null = null;
    try {
      const r = await fetch(`${base}/${MANIFEST}`, { signal: AbortSignal.timeout(5_000) });
      if (r.ok) m = parseManifest(await r.json());
    } catch {
      m = null;
    }
    cached = { base, at: Date.now(), m };
  }
  return cached.m ? { m: cached.m, from: "base" } : null;
}

/** 自分で入れ替える中身（その OS と CPU のもの。無ければ同じ OS の別の CPU は渡さない） */
export function pickUpdate(m: ReleaseManifest, os: BridgeOs, arch: BridgeArch): ReleaseFile | null {
  return m.files.find((f) => f.platform === os && f.arch === arch && f.kind === "app") ?? null;
}

/** 人が受け取るインストーラ（mac は Apple のチップを先に） */
export function pickInstaller(m: ReleaseManifest, os: BridgeOs): ReleaseFile | null {
  const xs = m.files.filter((f) => f.platform === os && f.kind === "installer");
  return xs.find((f) => f.arch === "arm64") ?? xs[0] ?? null;
}

export function isListed(m: ReleaseManifest, name: string): ReleaseFile | null {
  return m.files.find((f) => f.name === name) ?? null;
}

/** 手元のフォルダのファイルを大きさ付きで流す。無ければ null */
export function releaseFileResponse(dir: string, name: string): Response | null {
  if (!dir || !NAME.test(name) || name.includes("..")) return null;
  try {
    const fp = join(dir, name);
    const size = statSync(fp).size;
    return new Response(createReadStream(fp) as unknown as ReadableStream, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": String(size),
        "content-disposition": `attachment; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch {
    return null;
  }
}

/** 目録が無い頃の置き方（フォルダに .dmg / .exe を置いただけ）から、配るインストーラを選ぶ */
export function legacyInstaller(dir: string, os: BridgeOs): string | null {
  if (!dir) return null;
  const want = os === "mac" ? /(arm64)?\.dmg$/ : /\.exe$/;
  let files: string[] = [];
  try {
    files = readdirSync(dir).filter((f) => want.test(f));
  } catch {
    return null;
  }
  return files.find((f) => /arm64\.dmg$/.test(f)) ?? files[0] ?? null;
}
