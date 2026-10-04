"use client";
// はじめの設定（1 PCをつなぐ → 6 本番へ）の段と進み具合。D-089。
// 由来：どこまで通したかを記録していなかったので「毎度、進んだところまで戻す」ができず、
// ログインするとまだ無い画面（今日）へ飛んで 404 になっていた。判定はここ 1 か所に置く（L-008）。
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Route } from "next";
import { setupState, setupStepDone } from "@/lib/auth/ext";

export interface SetupStep {
  n: number;
  label: string;
  href: Route;
  /** その段の画面が実装済みか。まだの段はリンクしない（G-04） */
  built: boolean;
  /** 何をしたらこの段を通したことになるか（D-089.2・D-116）。下の帯と、押せない段の案内が読む */
  doneWhen: string;
}
export const SETUP_STEPS: readonly SetupStep[] = [
  { n: 1, label: "PCをつなぐ", href: "/setup/bridge" as Route, built: true, doneWhen: "PC の Bridge がつながる" },
  { n: 2, label: "話す", href: "/onboard/interview" as Route, built: true, doneWhen: "自分のAI に 1 つ答える" },
  {
    n: 3,
    label: "たたき台",
    href: "/onboard/draft" as Route,
    built: true,
    doneWhen: "たたき台を見て「これでいく」を押す",
  },
  {
    n: 4,
    label: "ログイン情報",
    href: "/settings/credentials" as Route,
    built: true,
    doneWhen: "ログイン情報を 1 件預ける",
  },
  {
    n: 5,
    label: "テスト",
    href: "/onboard/testrun" as Route,
    built: true,
    doneWhen: "AI社員を全員 1 回ずつテストで動かし、出てきたものを見て「本番に切り替える」を押す",
  },
  {
    n: 6,
    label: "本番へ",
    href: "/onboard/golive" as Route,
    built: true,
    doneWhen: "切り替える前の確認に赤が無い状態で「切り替える」を押す",
  },
] as const;

export const SETUP_TOTAL = SETUP_STEPS.length;
/** 通し終わりと見なす段。まだ画面が無い段（5・6）は数えない。画面ができたら built を true にするだけで伸びる */
export const SETUP_LAST_BUILT = SETUP_STEPS.filter((s) => s.built).at(-1)!.n;

/** いま戻す先。0（まだ何もしていない）なら 1 段目、途中なら次の段、通し終わりなら null */
export function resumeHref(step: number): Route | null {
  if (step >= SETUP_LAST_BUILT) return null;
  return (SETUP_STEPS.find((s) => s.n === step + 1 && s.built) ?? SETUP_STEPS[0]!).href;
}

/** 進み具合。enabled が false（入っていない）の間は引かない */
export function useSetupStep(enabled = true) {
  const q = useQuery({
    queryKey: ["setup-state"],
    queryFn: () => setupState(),
    enabled,
    staleTime: 10_000,
  });
  return {
    step: q.data?.step ?? null,
    loading: enabled && q.isPending,
    done: q.data ? q.data.step >= SETUP_LAST_BUILT : null,
    refetch: q.refetch,
  };
}

/** その段を通した、と記録する。押した段より小さい値では戻らない */
export function useMarkStep() {
  const qc = useQueryClient();
  return async (n: number) => {
    try {
      await setupStepDone(n);
    } finally {
      await qc.invalidateQueries({ queryKey: ["setup-state"] });
    }
  };
}
