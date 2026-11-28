"use client";
// ひな形の新しい版を直す頁の口（K-1111）。読む口 getOpsTemplate（K-992）を 1 つの鍵で 1 回（StrictMode でも 1 回・retry しない）、
//   書く口 releaseOpsTemplate（K-1010・下書き dry_run も出すも 201）。印は顧客の画面と同じ Bearer（call・K-946 と同じ取り方）。
//   401 は顧客のログインへ送らない（keepOn401・運営のログインへ移すのは画面）。下書きはこの PC の localStorage にだけ置く（DB に置かない・D-156.80）
import { useQuery } from "@tanstack/react-query";
import { call, type CallErr } from "@/lib/api/call";
import { draftKey, type Draft, type TemplateItem } from "./template-edit-shape";

const SCREEN = "ops-skills";
const opts = { screenId: SCREEN, keepOn401: true } as const;
export const templateKey = (id: string) => ["k1111", "template", id] as const;
export const TEMPLATES_PATH = "/ops/skills/templates";
/** 直す頁の道（配るもの › ひな形の［新しい版］が渡す行き先） */
export const templateNewPath = (id: string): string => `${TEMPLATES_PATH}/${encodeURIComponent(id)}/new`;

/** 読んだ 1 つ（K-992 の 10 欄のうち使う欄） */
export interface TemplateOne {
  id: string;
  key: string;
  name: string;
  version: number;
  items: TemplateItem[];
}
export type TemplateRead =
  | { kind: "ok"; data: TemplateOne }
  | { kind: "login" }
  | { kind: "forbidden" }
  | { kind: "missing" }
  | { kind: "failed" };

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === "object" && !Array.isArray(v);
function isOne(d: unknown): d is TemplateOne {
  return (
    isObj(d) &&
    typeof d["id"] === "string" &&
    typeof d["key"] === "string" &&
    typeof d["name"] === "string" &&
    typeof d["version"] === "number" &&
    Array.isArray(d["items"]) &&
    d["items"].every((i) => isObj(i) && typeof i["key"] === "string" && typeof i["name"] === "string")
  );
}

export async function fetchTemplate(id: string): Promise<TemplateRead> {
  let r: Awaited<ReturnType<typeof call<"getOpsTemplate">>>;
  try {
    r = await call("getOpsTemplate", { ...opts, params: { id } });
  } catch {
    return { kind: "failed" }; // 網が切れた
  }
  if (r.ok) return isOne(r.data) ? { kind: "ok", data: r.data } : { kind: "failed" };
  if (r.status === 401) return { kind: "login" };
  if (r.status === 403) return { kind: "forbidden" };
  if (r.status === 404) return { kind: "missing" };
  return { kind: "failed" };
}

/** 1 つ（enabled は caps に distribute があるときだけ）。窓に戻っても読み直さない */
export const useTemplateOne = (id: string, enabled: boolean) =>
  useQuery({
    queryKey: templateKey(id),
    queryFn: () => fetchTemplate(id),
    enabled,
    retry: false,
    refetchOnWindowFocus: false,
  });

/** 出す体（dry_run は下書きのときだけ付ける） */
export interface ReleaseBody {
  items: TemplateItem[];
  change_reason: string;
  dry_run?: true;
}
/** 書く口の結果：できた（meta の届く数）／断られた */
export type ReleaseWrite =
  { ok: true; version: number | null; using: number; offered: number } | { ok: false; err: CallErr };

const num = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
/** 出す・下書き（網が切れたら投げる＝画面が赤い箱を出す） */
export async function releaseTemplate(id: string, body: ReleaseBody): Promise<ReleaseWrite> {
  const r = await call("releaseOpsTemplate", { ...opts, params: { id }, body: body as never });
  if (!r.ok) return { ok: false, err: r };
  const data = r.data as unknown;
  const version = isObj(data) && typeof data["version"] === "number" ? data["version"] : null;
  return { ok: true, version, using: num(r.meta["using"]), offered: num(r.meta["offered"]) };
}

/** 取り直しの小窓の形（パスワードの有る無し・2 段階）・K-984 と同じ */
export async function stepUpShape(): Promise<{ withCode: boolean; withPasskey: boolean }> {
  const s = await call("getMySecurity", opts).catch(() => null);
  const sec = s?.ok ? s.data : {};
  return { withCode: sec.two_factor === true, withPasskey: sec.has_password === false };
}

/** この PC の下書き（読めない・置けない環境では何もしない） */
export const draftStore = {
  read(id: string): string | null {
    try {
      return window.localStorage.getItem(draftKey(id));
    } catch {
      return null;
    }
  },
  write(id: string, draft: Draft): boolean {
    try {
      window.localStorage.setItem(draftKey(id), JSON.stringify(draft));
      return true;
    } catch {
      return false;
    }
  },
  remove(id: string): void {
    try {
      window.localStorage.removeItem(draftKey(id));
    } catch {
      // 置けない環境：消す物も無い
    }
  },
};

/** 出した後にひな形の一覧で出す知らせ（頁を移っても 1 回だけ読む・道に字を載せない。一覧の入れ物 templates-screen が読む） */
let flash: string | null = null;
export const setTemplateFlash = (text: string): void => {
  flash = text;
};
export const peekTemplateFlash = (): string | null => flash;
export const clearTemplateFlash = (): void => {
  flash = null;
};
