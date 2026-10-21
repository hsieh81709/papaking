# P0-7 精簡測試紀錄

日期：2026-10-21 UTC；Node v24.19.0。基準329a798；測試先行698a57c。僅跑受影響公廁、LINE及必要公園相容性，不重跑全部歷史套件。

| 階段 | 實際結果 | 說明 |
|---|---:|---|
| 初始32個新增測試，程式仍329a798 | 22 pass／10 fail | 含一個新測試錯把toilet函式呼叫紀錄期待為空；未提交錯誤觀察方式 |
| 校正該新測試後，以未變動329a798 source副本重播 | **23 pass／9 fail，exit1** | 修復前可信紅燈：臺北資料被排除、跨市結果、Flex與範圍／提示等；副本在本地baseline-repo，未改工作source或既有測試 |
| 首次公廁＋LINE整合 | 170 pass／1 fail | 同一個新測試的路由紀錄觀察問題；校正為toilet呼叫且無parking／導航 |
| 校正後公廁＋LINE | 171／171 | 原公廁77＋新增26；原LINE62＋新增6 |
| 首次必要公園相容性 | 49 pass／1 fail | 舊選單斷言需要明示「新北」，不修改斷言，提示補「雙北（臺北／新北）」 |
| 最終受影響合併執行 | **221／221** | 公廁103＋LINE68＋公園相容50；fail／skip／cancel皆0 |

最終命令（repo根目錄）：

```sh
node --test --test-reporter=tap test/facilities/*.test.mjs test/line/*.test.mjs test/parks/search.test.mjs test/parks/mvp.test.mjs test/parks/webhook-routing.test.mjs test/parks/line-fallback.test.mjs
```

新增測試：

- 臺北verified 24欄合成fixture，TP_TOILET、字串座標及來源值不改寫；臺／台別名不借核准指紋。
- 兩市核准才發布、跨市同距離ID排序／最多5筆、3km含邊界、來源與核准變更／撤銷／缺表拒絕、跨市重複ID排除。
- 未知來源／其他城市、缺行政區、待確認、待人工整併、異常座標及非文字ID拒絕。
- 共享公廁Flex、城市與地區提示、UNKNOWN、代表位置walking URL、無核准／半徑無結果／缺表失敗、400同快照文字一次fallback且不進停車。

其他實際檢查：三個修改GAS檔與新測試Node語法通過；git diff --check通過。7個發布保護函式逐函式相同；parking查詢核心／原LINE狀態、park_search、park_geocoding、B4-3／B4-5、manifest、sponsor-worker與所有既有測試不變。原ODS SHA讀前讀後相同。

以本輪唯讀ODS真實5,481列／24欄載入記憶體VM，無發布清單時投影0、搜尋0、寫入0；這是**匯出快照＋離線程式**驗證，不是Google API讀回、正式Sheets寫入或人工發布核准。

證據路徑 `.local/mvp1-p07-20261021/`：red-initial.tap、red.tap、affected.tap、park-compatibility-first.tap、final-affected.tap、CORE_PROTECTION.json、TOILET_SOURCE_RECEIPT.json、REAL_ODS_NO_APPROVAL.json及AUTH_INVENTORY.json。

未執行：完整436回歸、完整170公園、72停車、Python資料工具、Worker、11項安全紅燈、P0-3 preflight、遠端Actions、官方LINE驗證與實際GAS／LINE／TDX／Maps。P0-3的855f5f2 source hash收據是歷史基準，不能拿來代表本輪新候選；正式發布前需重建新候選manifest並完成全套回歸／安全驗收，不能沿用舊hash通過宣告。

既有11項安全規格檔與斷言完全不變，未修復；本輪不把它們算作通過。授權阻擋、實作範圍與下一階段見[P0-7報告](P0-7_TAIPEI_TOILETS.md)。
