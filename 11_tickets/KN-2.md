---
id: KN-2
title: DB：新しい表の migration と行の守り（RLS）
kind: タスク
stage: 未着手
parent: KN-1
milestone: 基盤
area: DB
assignee: 未定
due: 
decisions: [D-128.88, D-128.112]
split: 
depends_on: []
---

## 目的

ER 図 §16 の新しい表と、前からある表に足す列を migration にし、全部の表に行の守り（RLS）を付ける。契約の API が表の無さで止まらないようにする。

## 完了の条件

- [ ] 子のチケットが全部「完了」になっている
- [ ] `pnpm ci:migration-integration`・`pnpm ci:rls-enabled`・`pnpm ci:access-matrix` が緑
- [ ] `zt_gate.py` の rls_missing が 0

## 前提と制約

- RLS を飛ばす鍵（service_role）はサーバーで使わない（ZT3）
- 表を消す・名前を変える migration は作らない（足すだけ）

## 実施事項

子のチケット（このあと切る）

## テスト仕様と確認の結果



## 成果物



## 決定ログ



## リスクと懸念



## 申し送り
