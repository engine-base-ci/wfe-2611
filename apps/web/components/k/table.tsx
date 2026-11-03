// 表（KN-104）。1 行 36px（D-128.13）。見出しの行は th（scope 付き）、表の名前は caption（読み上げが表の中身を言える）
import type { ReactNode } from "react";

export interface Column<R> {
  key: string;
  header: ReactNode;
  cell: (row: R) => ReactNode;
  /** 数は右に寄せ、桁をそろえる */
  num?: boolean;
}
export interface TableProps<R> {
  caption: ReactNode;
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
}

export function Table<R>({ caption, columns, rows, rowKey }: TableProps<R>) {
  return (
    <div className="k-table-wrap">
      <table className="k-table">
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} scope="col" data-num={c.num || undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.key} data-num={c.num || undefined}>
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
