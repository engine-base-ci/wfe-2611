# ears-elsewhere.d（K-325）
表に足す分はチケットごとに K-<番号>.json（ops の鍵）に書く。前からの中身は _base.json。
足し合わせは python3 scripts/ci/build_registries.py。同じ ops の鍵を _base.json と断片が両方持てば止まる。断片どうしは同じ口を持てる：covers は足し合わせ（同じ名前を 2 つが結べば止まる）、file などの covers 以外の鍵は書かないか同じ値だけ（K-440）。
