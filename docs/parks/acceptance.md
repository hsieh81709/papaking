# 新北市公園資料庫：實作與驗收紀錄

驗證日期：2026-10-19（Asia/Taipei）。工作分支：`feature/flex-message-v2`。
開發基準：`417f4fa967909218c77237b008045e2905ef73ee`。

## 完成項目

- 新增可共用於 Node.js 與 GAS 的唯讀座標品質稽核、欄位盤點與 JSON 報告工具。
- 修正搜尋的 NaN／非數字座標、重複公園 ID、設施一對多合併、非共融名稱誤判、精確 3 公里浮點邊界與跨聊天室查詢條件污染。
- B4-3 改為預設唯讀預覽，在任何定位前檢查全部 ID，保護已確認、部分填寫及已有來源的審核內容。
- B4-5 加入明確 ID 清單、人工驗收、預覽雜湊、寫入前整表備份、持久變更紀錄、重複執行不修改、逐欄重讀驗證、自動補償與中斷後人工回復工具。
- 正式 Google Sheets、GAS 部署與 LINE Webhook 均未修改。

## 實際版本與資料流盤點

| 請求中的模組 | GitHub／工作區實際檔案 | 現況與風險 |
|---|---|---|
| park_search_gas.gs | `gas/park_search_gas.js` | 同一 GAS 專案共用全域函式；讀取公園資料／設施，僅可用有效座標參與搜尋。舊版設施同 ID 後列會覆蓋前列，NaN 可進入排序；已修正。 |
| park_geocoding_gas.gs | 原始版本未找到 | 本次新增 `gas/park_geocoding_gas.js` 為**唯讀品質工具**，不是原始建立 635 筆候選的程式，不可據此推論線上建立候選的行為。 |
| park_b43_regeocode.gs | `gas/park_b43_regeocode_gas.js` | 僅處理 NP-9、NP-12、NP-112、NP-333；Google Maps → 品質檢核表 L:O。原本 findIndex 搭配 found 無法發現來源重複 ID；已修正。 |
| park_b45_sync.gs | `gas/park_b45_sync_gas.js` | 品質檢核表已人工確認的修正座標 → 公園資料。原版無備份、紀錄與回復，重跑會報覆寫錯誤；已修正。 |

GAS 可把這些 `.js` 以 `.gs` 檔名放入同一測試專案；避免同時保留同名全域函式的舊版本。本次沒有把 GitHub 程式推送至 GAS。

現有已知路徑：

```text
原始公園來源 → [原始地理編碼模組缺漏，尚無法審查] → 公園座標候選
公園資料 + 候選 + 設施 → 唯讀品質檢核 → A/B/C 與原因、差異及人工清單
四筆重定位 → 公園座標品質檢核 L:O（仍為待人工確認）
品質檢核表的 H、L:O 明確驗收 → B4-5 預覽 → 使用者確認 → 備份/日誌 → 正式座標
公園資料（可用）+ 公園設施 → 搜尋 → LINE 回覆
```

不能確認原始候選建立器是否覆蓋已審核列、如何續跑、來源欄位型態或是否重複同步。必須取得線上原始模組後再完成這部分審查。

## 正式資料品質報告：尚未取得資料，未驗證

以下僅為任務提供的歷史 GAS 紀錄，**不是本次查詢結果**：

| 指標 | 歷史紀錄 | 本次正式資料驗證 |
|---|---:|---|
| 正式公園列 | 635 | 未執行 |
| 有效正式座標／缺失或無效 | 9／626 | 未執行 |
| 候選列／有效候選 | 635／634 | 未執行 |
| 不重複公園 ID | 635 | 未執行 |
| 候選狀態 | 全部待確認 | 未執行 |
| GEOMETRIC_CENTER | 348 | 未執行 |
| ROOFTOP | 242 | 未執行 |
| RANGE_INTERPOLATED | 28 | 未執行 |
| APPROXIMATE | 17 | 未執行 |

實際已核准、待人工審核、定位失敗的**逐筆名單目前無法產出**；不能由這些合計推算 A/B/C，也無法識別那一筆無效座標。程式預設的四個 ID 僅為既有工具範圍，不代表本次已核准。

可執行工具會輸出 `records`（A/B/C、原因、正式與候選座標、距離差）、`pendingReview`、`failedLocation`、`approved`、`approvalRejected`、欄位型態與完整性檢核。未取得品質檢核表時，`approvalEvaluation=not_evaluated`，此時 `approved=[]` 代表**未取得證據**。有審核資料時僅作匯出值預檢，不能取代正式同步預覽與本次使用者授權。

正式差異：本次寫入 **0 筆**，未對正式表發出寫入。尚無實際資料的同步預覽，不能提供逐筆正式前後值；測試差異皆為明確標示的合成 fixture，保存在測試與執行紀錄中。

## 品質分級規則

- **A：優先人工審核**。座標格式與新北粗略矩形範圍合理、ID 唯一可關聯，正式地址、行政區及 Google 回傳地址一致、定位類型已知，且沒有其他警示。即使 ROOFTOP 且地址完全相同，也可能是建物而不是公園入口。
- **B：需補證據**。包含幾何中心、門牌內插、概略或未知定位、缺漏地址、道路／門牌／巷弄差異、地號或路口、與既有正式座標距離大於 100 公尺等。
- **C：優先排除結構性問題**。無效座標、重複／缺漏 ID、找不到正式資料、相同座標對應不同 ID、縣市或行政區不符等。

矩形初篩為緯度 24.7–25.4、經度 121.2–122.1；不能代替新北市多邊形邊界或現場入口驗證。同座標檢核涵蓋候選與正式座標，以六位小數分組；共址公園可能合理，仍保留原始資料供人工判斷。不同但很接近的座標、英文地址對照、入口可達性及現場設施仍需後續人工／地理資訊查核。

雙北共用表會先明確篩選新北來源；已知非新北 ID 排除清單保留於 `scopeSelection`。縣市缺漏、孤兒候選或與新北目標共用 ID 的其他縣市列仍保留，避免把資料異常靜默濾掉。設施表允許同公園多列，合併官方遊具類別；不能把合法的一對多視為重複主鍵。

## 實際測試結果

環境為 Node.js 24.19.0，無新增套件依賴。

```bash
node --test test/parks/*.test.mjs
cd sponsor-worker && npm test
```

本次公園測試 **108／108 通過**，Worker 測試 **25／25 通過**，均無失敗、略過或取消。全部 GAS JavaScript 語法檢查通過。

公園測試涵蓋：

- 座標型態、空白／NaN、範圍、重複 ID、缺漏關聯、同座標衝突、地址／行政區／門牌／道路及 Google 定位類型。
- 欄位漂移、明確欄位對照、唯讀盤點、CLI 實際執行及拒絕覆蓋已有報告。
- 預檢、人工確認、過期雜湊、未核准／既有座標／公式保護、備份與日誌先於寫入、非目標欄位保持原值。
- 兩筆資料共十個正式儲存格的每一寫入點故障注入；均驗證整批回復。
- 備份損毀、日誌失敗、資料同時修改、回復衝突、Date 型態保留，以及模擬中斷後 PREPARED 日誌回復。
- 3 公里內含精確邊界、最多 5 筆、直線距離排序、溜滑梯／鞦韆、共融及非共融、無結果文字備援。
- 實際 `doPost` 程式的公園→位置→恢復停車分流（LINE 回覆與停車外部服務使用 stub）。
- 原有停車 Flex 測試、NTPC Static Fallback 藍卡／無導航，以及路段與行政區精確匹配、排除機車與父路段誤匹配。

實際執行輸出及計數見 [test-results.txt](test-results.txt)。測試使用合成公園與模擬 Sheets／Maps，**不代表 Google Sheets API、Apps Script 配額、真實停車查詢或 LINE Messaging API 已通過端到端測試**。

## 修改檔案清單

- GAS：`gas/park_geocoding_gas.js`（新增唯讀稽核）、`gas/park_b43_regeocode_gas.js`、`gas/park_b45_sync_gas.js`、`gas/park_search_gas.js`、`gas/README.md`。
- 工具：`tools/park-audit.mjs`、`.gitignore`（排除本機匯出與報告）。
- 測試：`test/parks/helpers.mjs`、`audit.test.mjs`、`regeocode.test.mjs`、`search.test.mjs`、`sync.test.mjs`（後四者位於同一目錄）。
- 驗收文件：`docs/parks/acceptance.md`、`docs/parks/runbook.md`、`docs/parks/test-results.txt`。

GitHub Commit 在本次任務最終回覆提供；此文件記錄上方列出的開發基準，避免以文件自身 commit hash 產生循環修改。

## 尚待處理與所需存取

1. 使用者已確認提供的是 Apps Script 指令碼 ID。ID 不等於 OAuth 授權；環境 `clasp show-authorized-user` 回報 Not logged in，也沒有 `.clasp.json` 專案綁定。
2. 目前代理對 `script.googleapis.com`、`docs.google.com` 的 HTTPS CONNECT 回報 403，因此尚未到達 Google 進行帳號／專案權限驗證；不可把這個 403 解讀為使用者拒絕分享。
3. 若要從本環境唯讀擷取，需在環境網路設定允許 `script.googleapis.com`、`sheets.googleapis.com`；使用 Sheets 匯出亦需 `docs.google.com`，Google OAuth 流程可能需 `accounts.google.com`、`oauth2.googleapis.com`。目前未擴大網路權限、未要求或保存 Token。
4. 需要已授權 Google 帳號、Apps Script API 啟用與目標專案可讀權限。讀取專案內容使用 `https://www.googleapis.com/auth/script.projects.readonly`，讀取試算表使用 `https://www.googleapis.com/auth/spreadsheets.readonly`。一般 clasp 部署流程可能要求更廣權限，本任務目前不需要部署。
5. 仍需 `PARK_SHEET_ID` 或試算表實際 ID／唯讀資料匯出，以及線上原始 `park_geocoding_gas` 程式。不要把 OAuth 憑證、LINE Token、TDX 金鑰或使用者識別資料加入 Git。
6. 無法開放網路時，可先提供去識別化三表 JSON 與品質檢核表匯出，在本機產生逐筆報告；這仍是匯出驗證，不代表線上即時驗證。

## 是否可以安全同步正式資料

**目前不可以。** 尚未讀取真實資料、確認欄位與全部 ID、檢查已確認的九筆座標、完成逐筆人工核准，也尚未在隔離的 Sheets 副本演練 Google API 寫入／回復。本次沒有取得正式寫入授權。

工具可供審查與副本演練。Google Sheets 沒有跨多次 Range 寫入的交易；ScriptLock 只能約束同專案採用相同鎖的程式。即使逐次重驗仍有人工編輯競爭窗口；正式操作時須暫停其他寫入與人工編輯，預覽後取得使用者對具體 ID／差異的確認，再執行。中斷或配額耗盡可能需要人工依備份與日誌回復，不能宣稱具資料庫式原子性。
