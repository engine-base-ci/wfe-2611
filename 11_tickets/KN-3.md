---
id: KN-3
title: API の入口：権限の言葉の段と本人確認の取り直し
kind: タスク
stage: 未着手
parent: KN-1
milestone: 基盤
area: API
assignee: 未定
due: 
decisions: [D-128.88, D-128.113]
split: 
depends_on: [KN-2]
---

## 目的

API ごとの「誰が呼べるか」（read・write・self・assignee・approver・recipient・manager・admin・client・device・ops:<できること>）と本人確認の取り直しを、入口で確かめる。

## 完了の条件

- [ ] 子のチケットが全部「完了」になっている
- [ ] `apps/api/src/contract/authz.test.ts` の it.todo が 0（全部本物の試験）
- [ ] `zt_gate.py` の perm_words_missing と step_up_missing が 0

## 前提と制約

- 権限の判定は RLS と二重（API で 403・DB でも 0 行）
- `has_permission` は、会社全体の権限を確かめるとき（層＝なし）に、1 つのグループだけに付けた権限でも通してしまう（KN-38 で見つけた）。ここで直し、グループの edit だけの人が会社全体の決まりを直せないことを試験で確かめる

## 実施事項

- 子のチケット：KN-53（権限の確かめの穴・役割の束）→ KN-51（会社の段の言葉・本人確認）→ KN-52（行に結ぶ言葉）→ KN-54（権限の試験を本物に）

子のチケット（このあと切る）

## テスト仕様と確認の結果



## 成果物



## 決定ログ



## リスクと懸念



## 申し送り
