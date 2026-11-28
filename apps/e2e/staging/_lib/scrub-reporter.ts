// 統合テスト（staging）の記録の出し方（K-65）：標準出力には試験の名前と結果だけを出し、JUnit の記録は書き終わった後に伏せ直す。
//   Playwright の list・line・dot の報告は使わない：落ちた試験の文（URL つき）をそのまま CI の記録に出す。
//   JUnit の報告（Playwright の junit）は onEnd で書く。onExit はどの報告の onEnd も終わった後に呼ばれるので、そこで読んで伏せて書き戻す
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import type { FullResult, Reporter, TestCase, TestError, TestResult } from "@playwright/test/reporter";
import { scrub } from "./scrub.mjs";

const FIRST_LINES = 6;
const short = (e: TestError | undefined): string =>
  scrub((e?.message ?? "").split("\n").slice(0, FIRST_LINES).join("\n"));

export default class ScrubReporter implements Reporter {
  private readonly junit: string;
  constructor(options: { junit?: string } = {}) {
    if (!options.junit) throw new Error("JUnit の記録の道（junit）が渡っていない");
    this.junit = options.junit;
  }
  printsToStdio(): boolean {
    return true;
  }
  onTestEnd(test: TestCase, result: TestResult): void {
    const sec = Math.round(result.duration / 1000);
    process.stdout.write(`[${result.status}] ${test.title}（${sec} 秒）\n`);
    if (result.status !== "passed" && result.status !== "skipped") process.stdout.write(`${short(result.errors[0])}\n`);
  }
  onError(error: TestError): void {
    process.stdout.write(`[error] ${short(error)}\n`);
  }
  onEnd(result: FullResult): void {
    process.stdout.write(`統合テスト（staging）：${result.status}\n`);
  }
  async onExit(): Promise<void> {
    // 記録が無い回（1 本も集められなかった）は、無いまま残す（空の記録を作って「流れた」ことにしない）
    if (!existsSync(this.junit)) return;
    writeFileSync(this.junit, scrub(readFileSync(this.junit, "utf8")), "utf8");
  }
}
