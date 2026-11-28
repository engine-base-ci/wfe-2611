// 止まった（作る段）の帯の下の確認の結果の表（K-228・キャンバス StFailed の table[aria-label="確認の結果"]）。
//   今の口は確認の結果を返さない（実行の checks は state だけ）ので、行は 0 で、表の下に「検査なし（まだ流していません）」（D-128.138）。
//   行を出すのは結果を返す口のチケット
const COLUMNS = ["確認項目", "種類", "1 回目", "2 回目", "根拠"] as const;
export const CHECK_NONE = "検査なし（まだ流していません）";

export function CheckTable() {
  return (
    <div className="k-check-table">
      <table aria-label="確認の結果">
        <thead>
          <tr>
            {COLUMNS.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody />
      </table>
      <div className="k-check-empty">{CHECK_NONE}</div>
    </div>
  );
}
