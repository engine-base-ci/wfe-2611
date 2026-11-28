// 仕事の間だけ PC を寝かせない（D-124.1）。
//   Bridge が仕事を動かしている間（loop の working が入っている間）だけ OS に「寝ないで」を頼み、終わったら解く。
//   画面は消えてよい・ふたを閉じたら OS に従う（prevent-app-suspension）。本人の電源の設定は変えない。
//   待っているだけの間（working が空）は頼まない。同じ状態が続いても頼み直さない（開始・停止は切り替わりで 1 回ずつ）。
//   Electron の powerSaveBlocker をそのまま渡す（main.ts）。試験では偽物を渡す。
export interface PowerSaver {
  start: (type: "prevent-app-suspension") => number;
  stop: (id: number) => void;
}

/** working（いま動かしている仕事の id）を渡すたびに呼ぶ。入ったら 1 回だけ頼み、空になったら 1 回だけ解く */
export function createAwake(saver: PowerSaver): (working: string | null) => void {
  let id: number | null = null;
  return (working) => {
    if (working && id === null) {
      try {
        id = saver.start("prevent-app-suspension");
      } catch {
        id = null; // 頼めなくても仕事は動かす（寝たら 75 秒で「切れている」になるだけ）
      }
    } else if (!working && id !== null) {
      try {
        saver.stop(id);
      } catch {
        /* もう解けている */
      }
      id = null;
    }
  };
}
