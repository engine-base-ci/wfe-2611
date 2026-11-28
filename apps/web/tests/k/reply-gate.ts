// 試験の差し替えが口の答えを止めておく門（K-339・K-319 と K-339 の試験が使う）。
//   「答えを待つ間に 2 回目を押す（Enter・2 回押し）」を確かめる試験は、差し替えの答えが速いと、2 回目が答えの後の画面
//   （開いたバックアップコードの小窓の「保存したので閉じる」・閉じた小窓の下の行）に当たって揺れる。
//   門を閉じたまま 2 回目を押し、押し終わってから開けると、いつも「答えを待つ間」を確かめられる。
//   テストはチケットを作る人が書き、実装する人は変えない（D-128.125）

export interface ReplyGate {
  /** 差し替えが答えの前に待つ（開けるまで返らない） */
  wait: Promise<void>;
  /** 門を開ける（止めていた答えを返す） */
  open: () => void;
}

export function replyGate(): ReplyGate {
  let open = (): void => undefined;
  const wait = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { wait, open: () => open() };
}
