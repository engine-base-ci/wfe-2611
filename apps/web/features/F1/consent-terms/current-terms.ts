"use client";
// 今の版（K-53・契約の口 getCurrentTerms）。登録の画面と同意し直しの画面が、版の名前と文面の行き先（url）に使う。
//   口は誰でも呼べるが 1 分に 10 回（同じ IP）なので、同じ画面の中では 1 回だけ呼ぶ（答えを覚える。落ちたら次は呼び直す）
import { useEffect, useState } from "react";
import { call } from "@/lib/api/call";
import { DEFAULT_TERMS_LINKS, type TermsLinks } from "../sign-up/frame";

export interface TermsItem {
  id: string;
  kind: string;
  version: string;
  url: string;
  published_at: string;
}
export type CurrentTerms = { kind: "ok"; items: TermsItem[] } | { kind: "failed" };

let once: Promise<CurrentTerms> | null = null;

const isItem = (x: unknown): x is TermsItem => {
  const o = x as Record<string, unknown> | null;
  return !!o && typeof o["id"] === "string" && typeof o["kind"] === "string" && typeof o["url"] === "string";
};
/** 口を呼んで今の版を読む。fresh なら覚えた答えを使わない（版が古いと言われた後など） */
export function loadCurrentTerms(fresh = false): Promise<CurrentTerms> {
  if (!once || fresh)
    once = call("getCurrentTerms", { keepOn401: true })
      .then((r): CurrentTerms => {
        const items = r.ok && Array.isArray(r.data) ? (r.data as unknown[]).filter(isItem) : null;
        return items && items.some((x) => x.kind === "terms") && items.some((x) => x.kind === "privacy")
          ? { kind: "ok", items }
          : { kind: "failed" };
      })
      .catch((): CurrentTerms => ({ kind: "failed" }));
  const p = once;
  void p.then((v) => {
    if (v.kind === "failed" && once === p) once = null;
  });
  return p;
}
/** 規約の 2 つの行き先（今の版の url）。答えが来るまで・来なかったときは文面のページの一番新しい版 */
export function linksOf(t: CurrentTerms | null): TermsLinks {
  if (!t || t.kind !== "ok") return DEFAULT_TERMS_LINKS;
  return {
    terms: t.items.find((x) => x.kind === "terms")?.url ?? DEFAULT_TERMS_LINKS.terms,
    privacy: t.items.find((x) => x.kind === "privacy")?.url ?? DEFAULT_TERMS_LINKS.privacy,
  };
}
/** 今の版を 1 回読む（画面の部品用） */
export function useCurrentTerms(): CurrentTerms | null {
  const [t, setT] = useState<CurrentTerms | null>(null);
  useEffect(() => {
    let alive = true;
    void loadCurrentTerms().then((v) => alive && setT(v));
    return () => {
      alive = false;
    };
  }, []);
  return t;
}
/** 版の名前を画面の言葉にする（数だけなら「第 N 版」） */
export const versionLabel = (v: string): string => (/^[0-9]+$/.test(v) ? `第 ${v} 版` : v);
