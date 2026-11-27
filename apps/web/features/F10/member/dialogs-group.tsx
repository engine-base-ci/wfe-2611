"use client";
// メンバーの 1 人の小窓（段 11・F10）：グループを移す・兼ねるグループを足す外す。
//   キャンバスに絵が無いので、画面に出る文は「仮」。足のボタンは「本人確認して〇〇」（本人確認の取り直しが先に入る）。
//   値は props で受け取って描くだけ。欄は値つき・押す関数は渡さない
import { Button, Dialog, Select } from "@/components/k";
import "./member.css";

const GROUP_OPTIONS = [
  { value: "営業", label: "営業" },
  { value: "受託開発", label: "受託開発" },
  { value: "経理", label: "経理" },
];

/** グループを移す（本人確認が要る） */
export function MoveDialog({ open, name, from, to }: { open: boolean; name: string; from: string; to: string }) {
  return (
    <Dialog
      title="グループを移す"
      subtitle={`${name} の、いまのグループ：${from}`}
      size="form"
      open={open}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>本人確認して移す</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <Select name="move-to" label="移す先のグループ" options={GROUP_OPTIONS} value={to} />
        <p className="k-f10d-sub">役割はそのままです。担当しているチケットも、そのまま持ちます</p>
      </div>
    </Dialog>
  );
}

/** 兼ねるグループを足す・外す（本人確認が要る） */
export function AlsoDialog({
  open,
  name,
  also,
  add,
}: {
  open: boolean;
  name: string;
  also: readonly string[];
  add: string;
}) {
  return (
    <Dialog
      title="兼ねるグループを足す・外す"
      subtitle={`${name} は、ほかのグループも兼ねられる`}
      size="form"
      open={open}
      actions={
        <>
          <Button variant="outlined">やめる</Button>
          <Button>本人確認して保存する</Button>
        </>
      }
    >
      <div className="k-dialog-stack">
        <h3 className="k-f10d-h">兼ねているグループ</h3>
        {also.length ? (
          also.map((g) => (
            <div key={g} className="k-f10d-added">
              <span>{g}</span>
              <Button variant="ghost" size="sm" aria-label={`${g}を外す`}>
                外す
              </Button>
            </div>
          ))
        ) : (
          <p className="k-f10d-sub">兼ねているグループはありません</p>
        )}
        <Select name="also-add" label="足すグループ" options={GROUP_OPTIONS} value={add} />
      </div>
    </Dialog>
  );
}
