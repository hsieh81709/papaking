# 公園品質檢核與安全同步操作

本機不需要 Google、LINE 或綠界憑證。先閱讀 [驗收紀錄](acceptance.md) 的限制。

## 本機測試

在 repository 根目錄使用 Node.js 22 以上（本次驗證為 24.19.0）：

```bash
node --test test/parks/*.test.mjs
```

## 唯讀盤點與品質報告

在經授權、含四個公園模組的**測試 GAS 專案**執行：

```javascript
runPapaKingParkInventory() // 回傳欄名、列數、重複與缺漏ID；不假設候選欄名
runPapaKingParkQualityAudit() // 回傳完整品質報告；只在日誌列印概要
```

先比對真實候選欄名，再以明確 mapping 對照，沒有自動猜測或新增欄位：

```javascript
runPapaKingParkQualityAudit({
  '候選緯度': '實際緯度欄名',
  '候選經度': '實際經度欄名',
  'Google回傳地址': '實際回傳地址欄名',
  '定位類型': '實際定位類型欄名',
  '審核狀態': '實際審核狀態欄名'
})
```

範例中的「實際…欄名」是說明用，必須先依盤點結果更換。公園 ID 必須有明確 `公園ID`，可同樣 mapping。Google 地點類型是選填的 `Google地點類型` 欄，存在時可標示 route／intersection 等風險。

若使用離線匯出，JSON 格式為 `{ "parks": [...], "candidates": [...], "facilities": [...], "reviews": [...] }`。前三個陣列必要，reviews 可省略。每個元素是欄名→儲存格原始值的物件，沒有資料用空字串，保留字串／數字型態，不要把格式錯誤轉成零。CLI 必要欄位見 `tools/park-audit.mjs`；審核與正式同步的完整十五欄見 `PAPAKING_B45_*_HEADERS_`。

```bash
mkdir -p .local
# 將去識別化匯出保存為 .local/park-export.json
node tools/park-audit.mjs .local/park-export.json .local/park-report.json
```

輸出檔必須不存在，以免覆蓋原始證據；原始匯出與報告預設被 `.gitignore` 排除。CLI 零退出碼只代表成功產生報告，**不是核准同步**。輸出保留不符合條件資料的原因；不修改輸入檔、不呼叫網路、不自動批准任何公園。

## 重定位（只限原有四個 ID）

`runPapaKingParkB43Regeocode()` 現在預設只做 Maps 預覽，仍會消耗 Google Maps 配額，不寫入工作表。取得另行同意後，傳入字串 `確認寫入待審候選` 才會更新品質檢核表 L:O，且永遠保留「待人工確認」。已填修正資料或已確認的審核列不覆蓋。

## 正式同步：只有明確確認後才可執行

以下流程須先在隔離 Sheets 副本演練。主表和品質檢核表都須符合完整既有十五欄順序。保留來源地址與原始資料，不因 A 級自動設為可用。

1. 暫停其他程式及人工編輯，確認所有寫入者採用同一專案 ScriptLock；副本驗證後才能討論正式寫入。
2. 人工檢查公園入口，明確填寫品質檢核表 H=`需要修正` 或 `核准`、L/M 有效新北座標、N 來源、O=`已確認`。A/B/C 本身不會滿足核准條件。
3. 執行 `runPapaKingParkB45Preview(['NP-9', ...])`。回傳明確 `ids`、`fingerprint`、`changes`（before／after）與 `unchanged`；省略參數時仍只預覽原有四筆。
4. 將具體 ID、原值、新值、來源與待寫入可用狀態交給使用者，取得**本次明確確認**。不可把先前要求開發工具當作正式資料核准。
5. 確認後以新的預覽物件值呼叫 `runPapaKingParkB45Sync({ids: plan.ids, fingerprint: plan.fingerprint, confirmation: '確認寫入正式公園資料'})`。不要用過期預覽，也不要為跳過檢查更改狀態。

同步僅允許 `NP-數字` ID、正式縣市新北、來源 NTPC_PARK、公園名稱一致、正式狀態待定位且兩個座標都為空。任何非空座標（包括無效或部分座標）、其他狀態、重複／缺漏 ID 或公式都會阻擋。

寫入前會建立 `公園備份_<UUID>` 整表與 `公園座標同步紀錄`。日誌欄位為：批次ID、時間、備份分頁、公園ID、正式列、修改前JSON、修改後JSON、狀態。修改的欄位僅為緯度、經度、同步時間、資料狀態、備註；原始地址及來源欄不變。預覽 after 的同步時間為 null 佔位，執行時才寫入 UTC ISO 時間；其餘核准值必須與預覽一致。JSON 保留原日期型態。備份／日誌失敗時不啟動正式寫入。

成功後日誌為 COMMITTED；失敗可補償時為 ROLLED_BACK，原始備份與日誌不刪除。對已由本工具寫入、座標、來源註記及可用狀態皆一致的列，重新取得預覽後再次執行會 NOOP，不重複加備註或修改時間。舊 fingerprint 在同步後必須重新取得，不會自動重用。

## 中斷與人工回復

若拋錯，先檢查該批次日誌；不要直接重跑正式同步。逾時／硬中斷可能保留 PREPARED 及部分儲存格；這不是成功。日誌保留完整 before／after，備份也仍存在。

1. 在無其他編輯者時執行 `runPapaKingParkB45RecoveryPreview(runId)`，檢查日誌、原列位置與目前資料。
2. 取得使用者對回復具體差異的確認。
3. 呼叫 `runPapaKingParkB45Rollback({runId: preview.runId, ids: preview.ids, fingerprint: preview.fingerprint, confirmation: '確認回復正式公園資料'})`。

回復只接受目前值等於記錄的 before 或 after，且 ID 列位置未改動。第三方新值、公式、排序移列、缺少備份、損毀日誌或過期預覽都會阻擋，避免覆蓋別人的修正；需人工比對整表備份並另外核准修復。副本／正式表的存取失效或配額耗盡也可能使回復失敗，需保留所有證據。

本工具不建立觸發器、不排程自動同步，也不更新正式 LINE Webhook。
