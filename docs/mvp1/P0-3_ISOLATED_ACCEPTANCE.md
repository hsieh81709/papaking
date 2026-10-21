# P0-3 上線前隔離驗收

日期：2026-10-21 UTC。來源基準 `855f5f27ddb205ba828f12e3cec7cae1bea7b4d3`，分支 `feature/flex-message-v2`。

**結論：離線回歸及風險重現完成；不可據此核准正式上線。** 沒有可用的隔離 Google／LINE 授權，未建立或執行雲端測試專案。此處「隔離」指 Node VM、記憶體 Sheets／Cache、固定時間及合成事件，不是已驗收的 GAS staging。

本輪只新增驗證工具、測試及文件。七個 GAS 原始碼、manifest、park_geocoding、sponsor-worker 均未改動；沒有 Sheets 寫入、地理編碼、部署、Webhook 切換、正式同步或 main 合併。測試記憶體中的核准紀錄不是實際資料核准。

## 原始碼與預計部署內容

最小服務檔案如下。檔案 SHA-256、大小及原始 Commit 比對結果見 [來源收據](P0-3_SOURCE_MANIFEST.json)。五檔皆逐 byte 等於 `855f5f2`，不是以 README 宣稱代替比對。

| 檔案 | 實際相依與用途 |
|---|---|
| `gas/line_webhook_gas.js` | `doPost` → `handlePapaKingMessage_`；停車 `handleLocation` → 原 TDX／NTPC／Maps 流程；`replyLine`、選單、主題與傳送共用 |
| `gas/park_search_gas.js` | `parkSearch_`、`buildParkFlexReply_`，依賴 facility_search 的發布與距離核心，以及 webhook 的 Flex 主題 |
| `gas/facility_search_gas.js` | `getFacilityData_`、`toiletSearch_`、`facilityReleaseFor_`、`facilityNavigationUrl_`；Sheets 適配、指紋核准、3km／最多5筆 |
| `gas/facility_line_gas.js` | `handlePapaKingMessage_`、分類 Cache、公廁 Flex；依賴上述三檔 |
| `gas/appsscript.json` | V8、Asia/Taipei、STACKDRIVER、USER_DEPLOYING、ANYONE_ANONYMOUS；dependencies 空，未明訂 oauthScopes |

四個 JS 共24種載入排列均在無自動補模組的 VM 完成初始化；全域具名函式無重複。這證明離線初始化及函式存在，不保證 GAS 服務授權與執行配額。正常搜尋流程另外由381項既有 JS 回歸覆蓋。

預計服務包**排除** `park_geocoding_gas.js`、`park_b43_regeocode_gas.js`、`park_b45_sync_gas.js`。三者是維護用途，不應為服務三分類而引入批次寫入權限。既有停車檔仍含診斷函式及基隆地址定位邏輯，不得批次執行；本輪沒有重構或刪除。維護專案和 serving 專案的分離仍只是部署建議，未改正式專案。

設定規格（只列名稱，不讀取或公開值）：

- 必要：`LINE_CHANNEL_ACCESS_TOKEN`、`TDX_KEYS`、`PARK_SHEET_ID`（試算表 ID，不是 Script ID）。
- 選用：`MONTHLY_QUOTA`、`MONTHLY_BUDGET`、`QUOTA_WHITELIST`。`GOOGLE_PLACES_ENABLED` 為程式內預設關閉的開關，並非本輪新增屬性。
- 停車流程仍會寫入 Script Properties 額度／鹽值／基隆定位快取及 Cache；「未寫正式 Sheets」不代表 serving 完全無狀態。
- `設施發布核准` 表與來源欄位規格沿用 [P0-1](P0-1_SHARED_SEARCH.md)，公廁24欄、核准11欄；不可匯入測試核准清單。
- 安全入口新設定僅在 [安全方案](P0-3_SECURITY_AND_DELIVERY.md)提出設計，未寫入任何環境。

**尚無 live GAS 專案原始碼、版本號、部署 ID、觸發器、執行身分及屬性對照證據。** 未找到本機 `.clasp.json` 或 clasp／gcloud 標準認證檔；已檢查指定 Google／LINE／隔離測試環境變數的存在性，皆無值，未輸出任何憑證內容，也無相關 Google／LINE connector。不能據此宣稱整個帳號沒有其他憑證。

## 實際驗收矩陣

| 項目 | 本輪結果 | 正式或隔離雲端證據 |
|---|---|---|
| 三分類、切換、主選單、不同人／群／room隔離 | 既有62項 LINE 回歸通過 | 待授權測試頻道 |
| 10分鐘逾時 | 599秒有效、600秒拒絕；Cache遺失不默認停車 | 真實 Cache 提前逐出／並行待驗 |
| 公園與公廁發布限制 | 缺核准表時合成新北公園及公廁皆0，無導航 | 正式表內容與9筆保護仍待唯讀核對；沒有新增核准 |
| 公廁UNKNOWN | 未確認，不推定無設施、24h或入口 | 真實資料人工驗收另行進行 |
| 三分類 LINE 訊息結構 | 9批合成訊息通過本地限定檢查 | 官方 validate API／手機顯示待驗 |
| Flex失敗 | HTTP400同批文字備援一次，不重新搜尋；429／500／不確定傳送不自行重送 | LINE真實拒收與投遞待驗 |
| 資料錯誤與無結果 | 讀取／格式失敗、無核准、半徑無結果、無效位置、暫時錯誤各自提示 | 地區未開放使用粗框，非行政GIS判定 |
| 重送與並行 | **10項風險成功重現，並未修復** | 不能列為安全通過，詳見安全報告 |
| 停車核心 | 原72項fixtures回歸通過，原核心未修改 | TDX／NTPC／Maps及實際行車導航待隔離E2E |
| 原始碼到部署版本對照 | 本地候選包固定為855f5f2 | live對照未執行 |

本輪不把「順序重送位置沒有第二次停車」誤作事件去重：同一分類事件也重送，或讀／清狀態重疊時，會再次委派停車查詢。

## 重跑與證據

在 repository 根目錄：

```sh
node tools/mvp1-preflight.mjs .local/mvp1-p03-20261021
node --test --test-reporter=tap test/preflight/*.test.mjs
node --test --test-reporter=tap test/line/*.test.mjs test/parks/*.test.mjs test/facilities/*.test.mjs test/parking/*.test.mjs
python -m unittest discover -s test/park_sources -v
python -m unittest discover -s test/park_review -v
```

產生 `SOURCE_MANIFEST.json`、`LINE_MESSAGES.json`；不連外、不讀憑證、不建表。工具刻意固定檢查855f5f2，後續候選版本變動時會拒絕 matchesCandidate，應另行建立新版本收據。

逐筆結果與命令見 [測試紀錄](P0-3_TEST_RESULTS.md)；原始本輪 log 與合成訊息在 `.local/mvp1-p03-20261021/`。本地檢查器不是官方完整 schema，不能驗證未知欄位、所有樣式組合、客戶端差異或真實權限。

## 正式上線阻擋

1. P0：未驗證簽章且 public GAS origin 可直接觸發查詢；須實作並驗收獨立安全入口與 origin 保護，不修改 sponsor-worker。
2. P0：事件去重、原子狀態與額度保護未完成；R1–R10須依安全報告處理，補紅綠修復證據，不能只接受風險重現測試為通過。
3. P0：需提供隔離 GAS 專案／版本與合成工作簿的權限、獨立 LINE 測試頻道授權，經官方 validate API、實際訊息與公開測試點導航驗收。不要在聊天提供 Token。
4. P0：需唯讀匯出正式 GAS 全檔、manifest、部署／版本／觸發器及設定名稱的對照；目前無法證實正式專案等於候選包。
5. P0：核准人必須決定公廁無已核准資料時是否保留「尚無已核准發布」入口，並提供真實核准證據才能開放導航；A級、座標完整、官方名稱匹配皆不是核准。
6. P1：正式流量、TDX／Maps配額、故障與回復演練及操作人確認尚未完成。依 [部署手冊](P0-3_DEPLOYMENT_RUNBOOK.md)另行審批，不在本輪執行。
