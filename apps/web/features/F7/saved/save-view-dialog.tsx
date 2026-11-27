"use client";
// 検索条件を保存する小窓（キャンバス LsSave・D-151.9）。値を受け取って描くだけ（口は呼ばない）。
//   見える人は 自分だけ／グループの全員。「左のメニューに出す」「増えたら知らせる」は機能がまだなので押せない形（D-151.9・D-145.9）。
//   失敗（名前が空・同じ名前・上限・口が断った）は、欄の下の赤い字と小窓の上の赤い箱（段 9 の渡す小窓と同じ形）。書いた中身は消さない。
//   エラーの文は（案）：名前が空「名前を書いてください」／同じ名前「同じ名前の検索条件があります。別の名前にしてください」／上限「保存できる数に達しました。いらないものを消してから保存してください」
import { Button, Dialog, NoticeBox, TextField } from "@/components/k";
import { Seg, SwitchRow } from "./parts";

export interface SaveViewDialogProps {
  open: boolean;
  name: string;
  /** 名前の欄の下の赤い字（名前が空・同じ名前） */
  nameError?: string | undefined;
  /** 条件の要約（1 行ずつ。「担当者：鈴木」など） */
  conditions: readonly string[];
  share: "self" | "group";
  /** 「営業グループの全員」の「営業」 */
  groupName: string;
  /** 口が断ったとき（上限・調子が悪い）の赤い箱 */
  notice?: string | undefined;
  /** 保存している間（押し直せない） */
  busy?: boolean;
}

export function SaveViewDialog({
  open,
  name,
  nameError,
  conditions,
  share,
  groupName,
  notice,
  busy = false,
}: SaveViewDialogProps) {
  return (
    <Dialog
      title="検索条件を保存"
      subtitle="いまの条件と見え方に名前をつけて、あとから 1 回で開く"
      open={open}
      actions={
        <>
          <Button variant="outlined" disabled={busy}>
            やめる
          </Button>
          <Button loading={busy}>保存する</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        {notice ? <NoticeBox>{notice}</NoticeBox> : null}
        <TextField label="名前" name="view-name" value={name} readOnly required maxLength={60} error={nameError} />
        <div className="k-field">
          <span className="k-label">条件</span>
          <ul className="k-f7-saved-chips" aria-label="条件">
            {conditions.map((c) => (
              <li key={c} className="k-f7-saved-chip">
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div className="k-field">
          <span className="k-label">見える人</span>
          <Seg
            label="見える人"
            value={share}
            items={[
              { value: "self", label: "自分だけ" },
              { value: "group", label: `${groupName}グループの全員` },
            ]}
          />
        </div>
        <div className="k-f7-saved-switches">
          <SwitchRow label="左のメニューに出す" sub="グループの下に並ぶ" pending />
          <SwitchRow label="当てはまるチケットが増えたら知らせる" sub="1 日 1 回まとめて" pending />
        </div>
      </div>
    </Dialog>
  );
}
