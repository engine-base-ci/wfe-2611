# v3 Dependencies / Wave Plan — Kaname（2026-09-16）

| 指標 | 値 |
|---|---|
| 総 task 数 | 159 |
| Human 工数 | 4848.0 h |
| AI wall-clock | 219.6 h（並列 10） |

## Wave 構成

| Wave | Group | task 数 | 並列 | Human h | AI 計算 h | wall-clock h |
|---|---|---|---|---|---|---|
| 0 | F | 10 | 10 | 160 | 24.1 | 6.5 |
| 1 | F | 7 | 7 | 88 | 10.5 | 4.5 |
| 2 | D | 10 | 10 | 412 | 56.1 | 17.5 |
| 3 | D | 3 | 3 | 150 | 27.1 | 23.5 |
| 4 | V2 | 5 | 5 | 80 | 13.5 | 3.2 |
| 5 | A | 10 | 10 | 846 | 211.4 | 39.5 |
| 6 | A | 10 | 10 | 1069 | 239.7 | 38.0 |
| 7 | A | 3 | 3 | 327 | 53.2 | 40.3 |
| 8 | U-shared | 6 | 6 | 112 | 11.2 | 3.7 |
| 9 | U-screen | 10 | 10 | 156.0 | 15.5 | 2.4 |
| 10 | U-screen | 10 | 10 | 225.5 | 22.7 | 4.5 |
| 11 | U-screen | 10 | 10 | 185.5 | 18.5 | 2.7 |
| 12 | U-screen | 10 | 10 | 180.5 | 18.0 | 3.0 |
| 13 | U-screen | 10 | 10 | 153.5 | 15.4 | 2.8 |
| 14 | U-screen | 8 | 8 | 99.0 | 10.1 | 2.3 |
| 15 | I | 10 | 10 | 206 | 35.0 | 9.5 |
| 16 | I | 10 | 10 | 224 | 24.8 | 5.5 |
| 17 | I | 2 | 2 | 20 | 2.0 | 1.7 |
| 18 | S | 10 | 10 | 112 | 28.0 | 4.5 |
| 19 | S | 5 | 5 | 42 | 10.5 | 4.0 |

## 依存 DAG

- T-F-01 ← 
- T-F-02 ← 
- T-F-03 ← 
- T-F-04 ← 
- T-F-05 ← 
- T-F-06 ← 
- T-F-07 ← 
- T-F-08 ← 
- T-F-09 ← 
- T-F-10 ← 
- T-F-11 ← 
- T-F-12 ← 
- T-F-13 ← 
- T-F-14 ← 
- T-F-15 ← 
- T-F-16 ← 
- T-F-17 ← 
- T-D-01 ← T-F-01 T-F-02 T-F-03
- T-D-02 ← T-F-01 T-F-02 T-F-03
- T-D-03 ← T-F-01 T-F-02 T-F-03
- T-D-04 ← T-F-01 T-F-02 T-F-03
- T-D-05 ← T-F-01 T-F-02 T-F-03
- T-D-06 ← T-F-01 T-F-02 T-F-03
- T-D-07 ← T-F-01 T-F-02 T-F-03
- T-D-08 ← T-F-01 T-F-02 T-F-03
- T-D-09 ← T-F-01 T-F-02 T-F-03
- T-D-10 ← T-F-01 T-F-02 T-F-03
- T-D-11 ← T-F-01 T-F-02 T-F-03
- T-D-12 ← T-F-01 T-F-02 T-F-03
- T-D-13 ← T-F-01 T-F-02 T-F-03
- T-A-01 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-02 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-08 T-D-12
- T-A-03 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-06 T-D-08 …
- T-A-04 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 …
- T-A-05 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-D-06 …
- T-A-06 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-07 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-05 …
- T-A-08 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-D-10 …
- T-A-09 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-03 T-D-04 …
- T-A-10 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-11 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-F-02 …
- T-A-12 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-05 …
- T-A-13 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-F-02 …
- T-A-14 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-15 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-16 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-17 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-06 …
- T-A-18 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-06 T-D-10 T-D-11 …
- T-A-19 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 …
- T-A-20 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-21 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-05 …
- T-A-22 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-04 T-D-06 T-D-10 …
- T-A-23 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-11
- T-US-01 ← T-F-01 T-F-05 T-A-01
- T-US-02 ← T-F-01 T-F-05 T-A-01
- T-US-03 ← T-F-01 T-F-05 T-A-01
- T-US-04 ← T-F-01 T-F-05 T-A-01
- T-US-05 ← T-F-01 T-F-05 T-A-01
- T-US-06 ← T-F-01 T-F-05 T-A-01
- T-U-01 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01
- T-U-02 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-04 …
- T-U-03 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-02
- T-U-04 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-04 …
- T-U-05 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-04 …
- T-U-06 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-03 T-A-12 …
- T-U-07 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-16
- T-U-08 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-06 …
- T-U-09 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-06
- T-U-10 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-06
- T-U-11 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07
- T-U-12 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-06 …
- T-U-13 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 T-A-05
- T-U-14 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07
- T-U-15 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 T-A-12
- T-U-16 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-05 T-A-08 …
- T-U-17 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 T-A-10 …
- T-U-18 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-06 T-A-07 …
- T-U-19 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-09
- T-U-20 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-09 T-A-14
- T-U-21 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-09
- T-U-22 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10 T-A-11
- T-U-23 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 T-A-10
- T-U-24 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10 T-A-11
- T-U-25 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 T-A-10
- T-U-26 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-11
- T-U-27 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-11
- T-U-28 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-14
- T-U-29 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-16
- T-U-30 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-09 T-A-14
- T-U-31 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 T-A-06 …
- T-U-32 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-06
- T-U-33 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 T-A-12 …
- T-U-34 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08
- T-U-35 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-03 T-A-12 …
- T-U-36 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-06 T-A-07 …
- T-U-37 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-06 T-A-07 …
- T-U-38 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-15
- T-U-39 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-15
- T-U-40 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-12 T-A-15
- T-U-41 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-17 T-A-19
- T-U-42 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-17 T-A-23
- T-U-43 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-06 T-A-07 …
- T-U-44 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-03 T-A-12 …
- T-U-45 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-20
- T-U-46 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-20
- T-U-47 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-20
- T-U-48 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-21
- T-U-49 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-21
- T-U-50 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-18
- T-U-51 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-18
- T-U-52 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-18
- T-U-53 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-19
- T-U-54 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-19
- T-U-55 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-17 T-A-22
- T-U-56 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-22
- T-U-57 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 T-A-12 …
- T-U-58 ← T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-03 T-A-12 …
- T-I-01 ← T-A-04 T-A-05 T-A-07 T-A-08 T-A-09 T-A-10 T-A-12 T-A-13 …
- T-I-02 ← T-F-02 T-F-03 T-F-05 T-F-06 T-U-01 T-U-03 T-U-04 T-U-05 …
- T-I-03 ← T-F-15 T-U-01 T-U-02 T-U-03 T-U-04 T-U-05 T-U-06 T-U-07 …
- T-I-04 ← T-A-17 T-A-18 T-A-19 T-A-22 T-F-12 T-U-41 T-U-50 T-U-51 …
- T-I-05 ← T-A-12 T-A-13 T-A-15 T-A-18 T-F-04 T-F-05 T-F-06 T-U-35 …
- T-I-06 ← T-A-12 T-A-13 T-A-21 T-A-23 T-F-09 T-F-10 T-U-18 T-U-22 …
- T-I-07 ← T-A-07 T-A-08 T-A-18 T-A-19 T-F-12 T-U-13 T-U-51
- T-I-08 ← T-A-18 T-A-19 T-A-21 T-F-10 T-F-13 T-U-52 T-U-54 T-U-55
- T-I-09 ← T-A-01 T-A-02 T-A-15 T-U-01 T-U-02 T-U-03 T-U-04
- T-I-10 ← T-A-01 T-A-06 T-A-07 T-A-08 T-A-16 T-U-07 T-U-08 T-U-09 …
- T-I-11 ← T-A-04 T-A-05 T-A-07 T-A-08 T-A-09 T-A-10 T-A-12 T-A-13 …
- T-I-12 ← T-A-04 T-A-05 T-A-09 T-A-10 T-A-11 T-U-20 T-U-22 T-U-23 …
- T-I-13 ← T-A-09 T-A-10 T-A-11 T-A-14 T-A-16 T-U-24 T-U-26 T-U-27 …
- T-I-14 ← T-A-03 T-A-06 T-A-07 T-A-08 T-U-06 T-U-32 T-U-33 T-U-34
- T-I-15 ← T-A-06 T-A-07 T-A-08 T-A-12 T-A-13 T-A-15 T-A-18 T-A-20 …
- T-I-16 ← T-A-15 T-U-33 T-U-38 T-U-39 T-U-40
- T-I-17 ← T-A-12 T-A-13 T-A-17 T-A-19 T-A-21 T-A-22 T-A-23 T-U-37 …
- T-I-18 ← T-F-01 T-F-15 T-U-01 T-U-02 T-U-03 T-U-04 T-U-05 T-U-06 …
- T-I-19 ← T-I-01 T-I-02 T-I-03
- T-I-20 ← T-F-02 T-F-03 T-F-14 T-I-02 T-I-05
- T-I-21 ← T-F-01
- T-I-22 ← T-I-01 T-I-02 T-I-03 T-I-04 T-I-05 T-I-06 T-I-07 T-I-08 …
- T-S-01 ← T-U-49 T-A-21
- T-S-02 ← T-S-01
- T-S-03 ← T-S-01
- T-S-04 ← T-S-01
- T-S-05 ← T-S-01
- T-S-06 ← T-S-01
- T-S-07 ← T-S-01
- T-S-08 ← T-S-01
- T-S-09 ← T-S-01
- T-S-10 ← T-S-01
- T-S-11 ← T-S-01
- T-S-12 ← T-S-01
- T-S-13 ← T-S-01
- T-S-14 ← T-S-01
- T-S-15 ← T-S-01
- T-V2-01 ← T-F-17
- T-V2-02 ← T-F-17
- T-V2-03 ← T-F-17
- T-V2-04 ← T-F-17
- T-V2-05 ← T-F-17

## CI gate

lint / typecheck / coverage 80 / 契約テスト / endpoint 実在性 / 関門の迂回検出 / RLS を故意に壊す / mock-impl-diff / layer_audit / qa-ladder validate。全 PASS で auto-merge、1 つでも fail で retry、3 回で人へ。
