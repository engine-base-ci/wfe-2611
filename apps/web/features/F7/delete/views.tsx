"use client";
// 消す・元に戻す（F7・段 8・A116）の部品の入口。持ち主は K-590。口（previewTicketDelete・deleteTicket・restoreTicket）にはまだつながず、
//   値と押した結果を props で受けて描くだけ。部品は区画の中で分けてある：
//   delete-menu.tsx（「…」の消す）・delete-body.tsx（一緒に起きること・理由）・delete-dialogs.tsx（確認と子孫の扱い）・undo-toast.tsx（元に戻す）
export { DeleteMenu, type DeleteMenuProps } from "./delete-menu";
export {
  DeleteBody,
  togetherLines,
  type ChildChoice,
  type DeleteBodyProps,
  type DeletePreviewData,
} from "./delete-body";
export { DeleteChildrenDialog, DeletePreview, type DeleteChildrenProps } from "./delete-dialogs";
export { UndoToast, useUndoNotify, type UndoToastProps } from "./undo-toast";
