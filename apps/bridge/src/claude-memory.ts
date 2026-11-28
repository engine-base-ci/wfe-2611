// Claude の側にナレッジ・チケットを残させない（K-737・代表の言葉 2026-11-22）。記憶は Kaname の側だけが持ち、仕事ごとに渡す。
//   AI に読ませるのは制限しない（Read・Glob・Grep・Bash は止めない）。止めるのは、Claude Code の自動の記憶と、
//   Write と Edit の道具で記憶の置き場（CLAUDE.md・CLAUDE.local.md・~/.claude）へ書き写す形だけ（Bash で書く形は見抜けない＝D-107.6 と同じ限り）。
//   本人が自分で置いた記憶・CLAUDE.md は読まない・消さない（書かせないだけ）

/** 使わない道具の宛先（--disallowedTools・禁止の宛先と同じ仕組み・D-107.2）。この順で渡す */
export const MEMORY_DENY: readonly string[] = [
  "Write(**/CLAUDE.md)",
  "Edit(**/CLAUDE.md)",
  "Write(**/CLAUDE.local.md)",
  "Edit(**/CLAUDE.local.md)",
  "Write(~/.claude/**)",
  "Edit(~/.claude/**)",
];

/** Claude を起こす環境に足す物。自動の記憶を作らず・読まない（本人の環境が別の値でも 1 にする） */
export function memoryOffEnv(): Record<string, string> {
  return { CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1" };
}
