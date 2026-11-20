// 渡すの種類ごとのファイル（空の形・K-401）。K-402 が本物にする（このファイルだけを書き換える）
import { notReady, type CreateKind } from "../kinds.js";

export const createPass: CreateKind = async () => notReady();
