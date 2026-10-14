# v3 Dependencies / Wave Plan — Kaname（2026-10-14）

| 指標 | 値 |
|---|---|
| 総 task 数 | 215 |
| Human 工数 | 6292.5 h |
| AI wall-clock | 336.0 h（並列 10） |

## Wave 構成

| Wave | Group | task 数 | 並列 | Human h | AI 計算 h | wall-clock h |
|---|---|---|---|---|---|---|
| 0 | F | 10 | 10 | 160 | 24.1 | 6.5 |
| 1 | F | 7 | 7 | 88 | 10.5 | 4.5 |
| 2 | F | 1 | 1 | 20 | 1.3 | 1.8 |
| 3 | D | 10 | 10 | 478 | 61.6 | 17.5 |
| 4 | D | 4 | 4 | 202 | 31.4 | 23.5 |
| 5 | V2 | 5 | 5 | 80 | 13.5 | 3.2 |
| 6 | A | 10 | 10 | 788 | 197.1 | 32.7 |
| 7 | A | 10 | 10 | 1070 | 228.9 | 44.7 |
| 8 | A | 5 | 5 | 637 | 130.8 | 43.3 |
| 9 | B | 6 | 6 | 54 | 13.5 | 4.5 |
| 10 | B | 2 | 2 | 22 | 5.5 | 5.0 |
| 11 | B | 4 | 4 | 63 | 15.8 | 7.5 |
| 12 | B | 4 | 4 | 58 | 10.5 | 5.5 |
| 13 | B | 3 | 3 | 34 | 8.5 | 4.5 |
| 14 | B | 10 | 10 | 79 | 19.8 | 5.0 |
| 15 | B | 7 | 7 | 31 | 5.8 | 3.5 |
| 16 | B | 4 | 4 | 38 | 9.2 | 5.0 |
| 17 | B | 1 | 1 | 8 | 0.7 | 1.2 |
| 18 | U-shared | 1 | 1 | 16 | 1.6 | 2.1 |
| 19 | U-shared | 6 | 6 | 112 | 11.2 | 3.7 |
| 20 | U-shared | 1 | 1 | 40 | 10.0 | 11.5 |
| 21 | U-screen | 10 | 10 | 183.5 | 18.2 | 4.0 |
| 22 | U-screen | 10 | 10 | 254.5 | 25.5 | 6.7 |
| 23 | U-screen | 10 | 10 | 188.0 | 18.7 | 2.7 |
| 24 | U-screen | 10 | 10 | 180.5 | 18.0 | 3.0 |
| 25 | U-screen | 10 | 10 | 153.5 | 15.4 | 2.8 |
| 26 | U-screen | 8 | 8 | 99.0 | 10.1 | 2.3 |
| 27 | I | 10 | 10 | 206 | 35.0 | 9.5 |
| 28 | I | 9 | 9 | 216 | 21.6 | 5.7 |
| 29 | I | 3 | 3 | 44 | 6.8 | 5.5 |
| 30 | S | 1 | 1 | 8 | 2.0 | 3.5 |
| 31 | S | 10 | 10 | 114 | 28.5 | 4.5 |
| 32 | S | 4 | 4 | 32 | 8.0 | 3.5 |
| 33 | A | 3 | 3 | 441 | 110.4 | 43.3 |
| 34 | U-screen | 6 | 6 | 94.5 | 9.5 | 2.3 |

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
- T-F-18 ← T-F-15 T-F-16
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
- T-D-14 ← T-F-01 T-F-02 T-F-03
- T-A-01 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-02 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-08 T-D-12
- T-A-03 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-06 T-D-08 …
- T-A-04 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 …
- T-A-05 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 …
- T-A-06 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-F-02 …
- T-A-07 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-08 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-05 …
- T-A-09 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 …
- T-A-10 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-03 T-D-04 …
- T-A-11 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-12 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-F-02 …
- T-A-13 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-05 …
- T-A-14 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-02 T-D-05 T-F-02 …
- T-A-15 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-16 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-17 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-06 …
- T-A-18 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-19 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-06 …
- T-A-20 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-06 T-D-10 T-D-11 …
- T-A-21 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-05 …
- T-A-22 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-02 T-D-03 …
- T-A-23 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-05 …
- T-A-24 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-04 T-D-06 T-D-10 …
- T-A-25 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-01 T-D-04 T-D-11
- T-A-26 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-06 T-D-10 T-D-14 …
- T-A-27 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-11 T-D-14 T-F-02 …
- T-A-28 ← T-F-01 T-F-02 T-F-03 T-F-04 T-F-05 T-D-05 T-D-09 T-D-11 …
- T-US-00 ← T-F-01 T-F-15
- T-US-01 ← T-US-00 T-F-01 T-F-05 T-A-01
- T-US-02 ← T-US-00 T-F-01 T-F-05 T-A-01
- T-US-03 ← T-US-00 T-F-01 T-F-05 T-A-01
- T-US-04 ← T-US-00 T-F-01 T-F-05 T-A-01
- T-US-05 ← T-US-00 T-F-01 T-F-05 T-A-01
- T-US-06 ← T-US-00 T-F-01 T-F-05 T-A-01
- T-U-01 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01
- T-U-02 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-03 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-02
- T-U-04 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-05 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-06 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-07 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-08 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-09 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-10 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07
- T-U-11 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08
- T-U-12 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-13 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-05 …
- T-U-14 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08
- T-U-15 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08 …
- T-U-16 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-05 …
- T-U-17 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 …
- T-U-18 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 …
- T-U-19 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10
- T-U-20 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10 …
- T-U-21 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10
- T-U-22 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-11 …
- T-U-23 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 …
- T-U-24 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-11 …
- T-U-25 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-04 …
- T-U-26 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-12
- T-U-27 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-12
- T-U-28 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-15
- T-U-29 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-17
- T-U-30 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-10 …
- T-U-31 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-32 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07
- T-U-33 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08 …
- T-U-34 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-09
- T-U-35 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-13 …
- T-U-36 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 …
- T-U-37 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 …
- T-U-38 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-16
- T-U-39 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-16
- T-U-40 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-13 …
- T-U-41 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-19 …
- T-U-42 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-19 …
- T-U-43 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-07 …
- T-U-44 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01 …
- T-U-45 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-22
- T-U-46 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-22
- T-U-47 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-22
- T-U-48 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-23
- T-U-49 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-23
- T-U-50 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-20
- T-U-51 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-20
- T-U-52 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-20
- T-U-53 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-21
- T-U-54 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-21
- T-U-55 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-19 …
- T-U-56 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-24
- T-U-57 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-08 …
- T-U-58 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-13 …
- T-U-59 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-01
- T-U-60 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-26
- T-U-61 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-28
- T-U-62 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-28
- T-U-63 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-27
- T-U-64 ← T-US-00 T-US-01 T-US-02 T-US-03 T-US-04 T-US-05 T-US-06 T-A-27
- T-I-01 ← T-A-04 T-A-05 T-A-06 T-A-08 T-A-09 T-A-10 T-A-11 T-A-13 …
- T-I-02 ← T-F-02 T-F-03 T-F-05 T-F-06 T-U-01 T-U-03 T-U-04 T-U-05 …
- T-I-03 ← T-F-15 T-U-01 T-U-02 T-U-03 T-U-04 T-U-05 T-U-06 T-U-07 …
- T-I-04 ← T-A-19 T-A-20 T-A-21 T-A-24 T-A-27 T-F-12 T-U-41 T-U-50 …
- T-I-05 ← T-A-13 T-A-14 T-A-16 T-A-20 T-A-26 T-F-04 T-F-05 T-F-06 …
- T-I-06 ← T-A-13 T-A-14 T-A-23 T-A-25 T-F-09 T-F-10 T-U-18 T-U-22 …
- T-I-07 ← T-A-08 T-A-09 T-A-20 T-A-21 T-A-27 T-F-12 T-U-13 T-U-51
- T-I-08 ← T-A-20 T-A-21 T-A-23 T-A-27 T-F-10 T-F-13 T-U-52 T-U-54 …
- T-I-09 ← T-A-01 T-A-02 T-A-16 T-A-26 T-U-01 T-U-02 T-U-03 T-U-04
- T-I-10 ← T-A-01 T-A-07 T-A-08 T-A-09 T-A-17 T-A-18 T-U-07 T-U-08 …
- T-I-11 ← T-A-04 T-A-05 T-A-06 T-A-08 T-A-09 T-A-10 T-A-11 T-A-13 …
- T-I-12 ← T-A-04 T-A-05 T-A-06 T-A-10 T-A-11 T-A-12 T-U-20 T-U-22 …
- T-I-13 ← T-A-10 T-A-11 T-A-12 T-A-15 T-A-17 T-A-18 T-U-24 T-U-26 …
- T-I-14 ← T-A-03 T-A-07 T-A-08 T-A-09 T-U-06 T-U-32 T-U-33 T-U-34
- T-I-15 ← T-A-04 T-A-05 T-A-06 T-A-07 T-A-08 T-A-09 T-A-13 T-A-14 …
- T-I-16 ← T-A-16 T-A-26 T-U-33 T-U-38 T-U-39 T-U-40
- T-I-17 ← T-A-13 T-A-14 T-A-19 T-A-21 T-A-23 T-A-24 T-A-25 T-A-27 …
- T-I-18 ← T-F-01 T-F-15 T-U-01 T-U-02 T-U-03 T-U-04 T-U-05 T-U-06 …
- T-I-19 ← T-I-01 T-I-02 T-I-03
- T-I-20 ← T-F-02 T-F-03 T-F-14 T-I-02 T-I-05
- T-I-21 ← T-F-01
- T-I-22 ← T-I-01 T-I-02 T-I-03 T-I-04 T-I-05 T-I-06 T-I-07 T-I-08 …
- T-S-01 ← T-U-49 T-A-23
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
- T-B-01 ← 
- T-B-02 ← T-B-01
- T-B-03 ← T-B-02
- T-B-04 ← T-B-03
- T-B-05 ← T-B-04
- T-B-08 ← 
- T-B-07 ← 
- T-B-06 ← T-B-02
- T-B-09 ← 
- T-B-10 ← T-B-11 T-B-03
- T-B-11 ← T-B-09
- T-B-13 ← T-B-03
- T-B-12 ← 
- T-B-14 ← 
- T-B-15 ← T-B-13
- T-B-16 ← T-B-13
- T-B-17 ← T-B-16
- T-B-18 ← T-B-15
- T-B-19 ← T-B-16
- T-B-20 ← T-B-16
- T-B-21 ← T-B-16 T-B-15
- T-B-22 ← T-B-21
- T-B-23 ← T-B-18
- T-B-24 ← T-B-19
- T-B-25 ← T-B-03
- T-B-26 ← T-B-16
- T-B-27 ← T-B-16
- T-B-29 ← T-B-16
- T-B-31 ← T-B-16
- T-B-30 ← T-B-16
- T-B-28 ← T-B-02
- T-B-32 ← T-B-16
- T-B-33 ← T-B-16
- T-B-34 ← T-B-16
- T-B-35 ← T-B-31
- T-B-36 ← T-B-16
- T-B-37 ← T-B-02
- T-B-38 ← T-B-37 T-B-05
- T-B-39 ← T-B-37 T-B-05
- T-B-40 ← T-B-16
- T-B-41 ← T-B-23
- T-US-08 ← T-US-02 T-B-16
- T-V2-01 ← T-F-18
- T-V2-02 ← T-F-18
- T-V2-03 ← T-F-18
- T-V2-04 ← T-F-18
- T-V2-05 ← T-F-18

## CI gate

lint / typecheck / coverage 80 / 契約テスト / endpoint 実在性 / 関門の迂回検出 / RLS を故意に壊す / mock-impl-diff / layer_audit / qa-ladder validate。全 PASS で auto-merge、1 つでも fail で retry、3 回で人へ。
