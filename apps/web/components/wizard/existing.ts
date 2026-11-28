// はじめの設定の手順のうち、いま page.tsx がある段（無い段はリンクしない・G-04）。
// 段の正本は lib/onboarding.ts の SETUP_STEPS。ここは既存の呼び出し口を保つためだけの導出（reachability.spec が照合）
import { SETUP_STEPS } from "@/lib/onboarding";
export const WIZARD_EXISTING: string[] = SETUP_STEPS.filter((s) => s.built).map((s) => s.href);
