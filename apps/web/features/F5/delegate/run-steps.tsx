// 作っている間の進みの 5 段（K-228・キャンバス StRunning の ol[aria-label="進み"]・決める人の答え answer=5cf21973b39f）。
//   今の口は仕事ごとの段を返さないので、作る段の実行（running・asking）の間は「作る」がいつも今（受け取るは済み・ほかは先）。
//   段を返す口ができたら、今の段をその答えから引く（F9 のこれから）
const STEPS = ["受け取る", "作る", "確かめる", "あなたの承認", "実行"] as const;
const NOW = 1;

export function RunSteps() {
  return (
    <ol className="k-run-steps" aria-label="進み">
      {STEPS.map((name, i) => (
        <li key={name} data-state={i < NOW ? "done" : i === NOW ? "now" : "next"}>
          {name}
        </li>
      ))}
    </ol>
  );
}
