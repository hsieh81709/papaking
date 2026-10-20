# PapaKing 專案現況

盤點日期：2026-10-20（Asia/Taipei）。儲存庫：`hsieh81709/papaking`。
本文件以唯讀 Git 分支、原始碼、設定、既有紀錄及本次測試為依據；正式 GAS、Google Sheets、LINE Webhook 與 `main` 均未變更。建議 Issues 與整合關卡見 [ROADMAP.md](ROADMAP.md)。

## 1. 結論與狀態定義

停車主流程、公園搜尋／Flex 與贊助 Worker 已有程式；公園品質及安全同步工具集中在 V2 分支。**公廁只有通用卡片配色與合成示例，沒有完整服務。**

本次可確認離線測試通過，無法確認目前哪一個 Git commit 對應正式 GAS／Worker 部署。`main`、Git tag、含 production／validated 的 commit 訊息、測試函式存在或 README 示範圖片，都不能單獨證明該版本已上線。

| 狀態 | 本文件的判定標準 |
|---|---|
| 已實作 | 選定 commit 有可辨識的程式路徑；區分正式流程與 mock／模板 |
| 已離線測試 | 已執行的測試有結果；明確註明 mocks、分支、日期及範圍 |
| 已線上驗證 | 有真實外部服務、資料、時間、目標環境及版本的成功回執；本次未取得產品功能成功回執 |
| 已正式部署 | 有正式 deployment／version、來源對照及實際驗收證據；目前版本均未獨立證實 |
| 歷史紀錄 | Git 訊息、tag 或使用者提供的既有結果；保留但不提升為當前驗收 |

「未證實」不是斷言從未部署；「未實作」則表示本次檢查的三條分支未找到該功能程式。

## 2. 三分支與版本關係

以下是新增本次盤點文件之前的遠端快照；`feature/flex-message-v2` 後續的文件提交不改變此功能基準。

| 分支 | 快照 SHA | 追蹤檔／GAS JS 檔數 | 相對 main | 實際內容 |
|---|---|---:|---|---|
| `main` | `734ace5702736dd069399b1188b4b122d4f5e2fe` | 31／4 | 基準 | 停車、公園 MVP／V0.3.1 Flex／Quick Reply、舊 B4-3／B4-5、Worker |
| `feature/v0.3.1-park-flex` | `b3bb7c1cf7bc501a5d7c5b02073203c385fa52d8` | 29／2 | ahead 0、behind 3 | 公園 carousel、Webhook Flex 分流、Quick Reply；已被 main 包含 |
| `feature/flex-message-v2` | `0b4a3f07c5d5d19a976bbc22e6507d545d11ca07` | 49／5 | ahead 7、behind 0 | V2 卡片、Static Fallback 卡片、診斷、座標品質／安全同步／離線匯出及 Node 測試 |

```text
v0.3.0 / dce71bd
 ├─ 6844384 → 8f2749e → b3bb7c1  feature/v0.3.1-park-flex
 └──────────────┬────────────────
              39640de  merge PR #1 / tag v0.3.1
                 → 20417ca B4-3 → 734ace5 B4-5  main
                 → a316eb1 → c088151 → a11409c → d0bd81e → 417f4fa
                 → dc768dd → 0b4a3f0  feature/flex-message-v2
```

- `git rev-list --left-right --count main...V2` 為 `0 7`；`main...park-flex` 為 `3 0`。
- `39640de` 是合併 `feature/v0.3.1-park-flex` 的雙親 merge commit，訊息指向 PR #1；不是僅由分支名稱推斷已整合。
- 舊 park-flex 與 main 的檔案差異只有 main 新增的 B4-3、B4-5；不應重複合併／cherry-pick 公園 Flex。
- 遠端 tag：`v0.3.0` → `dce71bd`，`v0.3.1` → `39640de`。tag 存在不等於目前正式部署版本。
- V2 與 main 有 24 個差異檔案（追蹤檔淨增18個）、7 個提交；README、`docs/setup.md`、GAS manifest 及整個 Worker 目錄內容相同。
- 本次 GitHub REST API（`gh api .../pulls/1`）回覆 Forbidden；未取得即時 Issues／PR／Actions／Releases 清單。上述關係以實際 Git 物件為證，Issue 清單尚未在 GitHub 建立。

## 3. 完整程式結構與責任

```text
papaking/
├── README.md / LICENSE / .gitignore
├── .github/FUNDING.yml                 # 贊助連結；三分支均無 workflows/
├── gas/
│   ├── appsscript.json                 # V8、Asia/Taipei、匿名 Web App
│   ├── line_webhook_gas.js             # LINE、停車來源、快取、額度、Flex、內嵌診斷
│   ├── park_search_gas.js              # Sheets 公園／設施、條件、距離搜尋、專用 Flex
│   ├── park_b43_regeocode_gas.js        # main/V2：四筆修正座標，寫品質檢核表 L:O
│   ├── park_b45_sync_gas.js             # main/V2：人工驗收修正座標 → 正式公園表
│   ├── park_geocoding_gas.js            # 僅 V2：唯讀品質稽核，不是原始候選建立器
│   └── README.md
├── sponsor-worker/
│   ├── src/index.js / src/ecpay.js      # 綠界 MAC/AES、D1 去重、LINE 重試
│   ├── schema.sql / wrangler.jsonc
│   ├── package.json / package-lock.json / .dev.vars.example / .gitignore
│   ├── test/ecpay.test.js / test/index.test.js
│   └── README.md
├── test/parks/                          # 僅 V2：helpers + 五個 *.test.mjs
│   ├── audit.test.mjs / search.test.mjs / sync.test.mjs
│   └── regeocode.test.mjs / export.test.mjs / helpers.mjs
├── tools/                              # 僅 V2：HTML 唯讀匯出、Python XLSX 匯入
│   ├── park-export-readonly.html / import-park-workbook.py
│   ├── park-audit.mjs / park-verify-export.mjs
│   └── requirements-park-export.txt
├── docs/
│   ├── setup.md                        # GAS、TDX、LINE 部署與金鑰管理
│   ├── openapi.json / api_oas.json      # NTPC API 規格／TDX 停車 API 規格
│   ├── ntp.json                        # 30 筆停車樣本，不是 635 筆公園資料
│   ├── parks/                          # 僅 V2：操作／驗收／離線測試／副本計畫
│   └── PROJECT_STATUS.md / ROADMAP.md   # 本次文件
└── image/                              # 圖片、GIF、影片；不作版本化部署回執
```

根目錄沒有 package.json 或共用 build；Node 測試與 Worker npm 指令的工作目錄不同。沒有查到完整公園 XLSX／四表 JSON、原始 635 筆候選建立器、GAS `.clasp.json` 專案綁定或可核對的正式部署清冊。

README 對「台灣停車 LINE Bot」與單檔停車快速開始仍有參考價值，但「line_webhook 是全部程式」已不涵蓋公園；完整部署必須包含相依公園模組。README／setup 仍有上游 `coseto6125/papaking` 連結，應說明 fork 與版本來源，保留作者及授權歸屬，不應盲目改寫作者資料。

## 4. 功能狀態矩陣

「離線通過」以下均指本次 V2 快照的測試；不能直接套用到缺少測試的 main／舊分支。

| 功能 | 已實作與分支差異 | 已離線測試 | 已線上驗證 | 已正式部署 |
|---|---|---|---|---|
| 停車主流程 | 三分支：TDX 路邊／路外、新北／基隆補源、去重、導航、快取、月額度 | V2 部分涵蓋分流、卡片及 Static 規則；未覆蓋全部 TDX／Maps／配額流程 | 有歷史 production／示範紀錄；本次未驗真實查詢 | 歷史 `dce71bd` 聲稱同步 production；當前部署版本未證實 |
| NTPC Static Fallback | 三分支有精確路段、行政區、小客車篩選及文字；V2 新增無座標資訊卡、無導航 | V2 既有 regression 與路段／機車／巷弄測試通過 | 診斷函式存在，未取得真實命中回執 | V2 變更未證實部署 |
| 公園搜尋 | 三分支有 3km／最多5筆／直線排序、滑梯／鞦韆／共融、文字備援；V2 加嚴座標、ID、設施合併及對話範圍 | V2 搜尋／分流 tests 通過，資料為合成 | 使用者曾提供 635 筆歷史結果；當前四表未讀取 | 有 v0.3.0 歷史訊息；當前來源／版本未證實 |
| 公園 Flex／Quick Reply | 三分支包含 V0.3.1 公園卡與五項選單；實際公園路徑仍用自己的 `buildParkFlexReply_` | V2 有結果／無結果與一般分流通過；本次另發現兩項未覆蓋缺口 | 無版本化 LINE 驗證成功回執 | 已 merge 不代表已部署 |
| 635 筆品質稽核／匯出 | 僅 V2 有 A/B/C、原因、同座標、行政區／地址、差異與一次四表 XLSX 流程 | V2 通過，含 635 筆合成資料 | 真實資料、唯一失敗 ID、公開來源逐筆查核未完成 | 離線工具無需正式部署；未安裝至正式 GAS 的證據 |
| B4-3／B4-5 同步 | main 有舊版；V2 預設唯讀、人工核准、指紋、備份、journal、NOOP、回復 | V2 故障注入／Date／衝突／中斷回復通過 | 實際 Sheets 副本寫入／回復未驗證 | 正式同步不得僅憑離線通過啟用 |
| 公廁服務 | 三分支無資料匯入／搜尋／意圖／Webhook 路由；僅 V2 有 teal theme 與 mock 卡片 | V2 模板顏色、按鈕／無座標示例通過 | 未實作產品流程，無線上證據 | 無可確認的公廁服務部署 |
| V2 通用 Flex | V2 有藍停車／綠公園／青綠公廁、地圖／導航、無座標隱藏 footer；停車已接入，公園專用 builder 尚未統一 | 通用 mock／Static 卡通過；非 LINE API schema 驗證 | `testFlexValidate` 存在但本次未執行 | 未證實 |
| 贊助 Worker | 三分支相同：ECPay MAC/AES、D1 唯一鍵、通知狀態及 LINE retry key | 25 tests 通過；D1／LINE 使用 mock，含官方公開測試向量 | 未取得真實 ECPay→D1→LINE 成功回執 | 有部署設定及資料庫 ID，但帳號／實際 deployment 未證實 |

main／舊park-flex的停車卡仍分路邊藍 `#1E88E5` 與停車場綠 `#43A047`；V2將兩者統一為 `#1976D2`。實際公園專用builder仍使用 `#227A4C` 文字／按鈕，未改用通用V2模板；公廁 `#00838F` 目前僅模板／mock。

停車預設半徑是 **1km**，先挑最近候選，再最多對 3 路段＋2 停車場查開車時間；公園是 **3km**、直線距離排序，兩者不可混稱。`GOOGLE_PLACES_ENABLED=false`，非公開 Google 搜尋補源預設關閉；`DRIVE_TIME_RPC_ENABLED=true`，開車時間先用 Google 網頁 RPC，再以內建 Maps 備援。程式具快取／失敗處理不代表第三方介面永遠可用。

## 5. 公園資料與同步風險

任務中曾提供以下歷史 GAS 統計，尚未由本環境重新讀取：正式 635、有效正式座標 9、缺少／無效 626；候選 635、有效 634；定位類型 348 GEOMETRIC_CENTER、242 ROOFTOP、28 RANGE_INTERPOLATED、17 APPROXIMATE；候選狀態全部待確認。

這些合計不能識別唯一失敗 ID、推算每筆 A/B/C、證明公園入口、或推論目前已有核准。合成測試中的 NP-635 不是已找出的真實問題公園。

- **main 舊 B4-3**：直接寫 L:O；以 findIndex／found 檢查來源重複 ID 的方式不能真正抓出重複列。
- **main 舊 B4-5**：四個預設 ID，具批次預檢與讀回，但沒有寫入前備份、持久日誌及失敗補償；逐列更新可部分成功，重跑會被既有座標條件阻擋。
- **V2**：B4-3 預設唯讀；B4-5 僅人工核准 ID，以預覽指紋防過期，保護既有非空正式座標，寫前整表備份與 journal，失敗補償及中斷後回復。ScriptLock 只能約束同專案合作寫入者，不是 Sheets 跨請求交易。
- `park_geocoding_gas.js` 是本次開發的稽核器，**不是原始產生候選的地理編碼程式**；原始建立器的覆寫／續跑行為仍缺審查證據。
- A 級只是優先人工審核；不得自動將「待確認」改為「可用」。副本驗證與正式同步授權必須分開。

## 6. 本次測試與補充診斷

執行環境：Node.js 24.19.0、Python 3.12.14、openpyxl 3.1.5。Worker lockfile 為 Wrangler 4.129.1，要求 Node ≥22。

| 本次檢查 | 結果 | 可證明的範圍 |
|---|---|---|
| `node --test test/parks/*.test.mjs`（V2） | 121 passed、0 failed／skipped／cancelled | 公園／匯出／同步 mocks 及部分 Flex／分流；不是實際 Google API 寫入 |
| `(cd sponsor-worker && npm test)` | 25 passed、0 failed／skipped／cancelled | 密碼學公開向量與 mock D1／LINE 行為 |
| 三分支 GAS JS 語法 | main 4、park-flex 2、V2 5 檔均通過 VM syntax parse | 僅語法；不代表舊版通過 V2 的新安全測試 |
| Worker 三分支內容比對 | 完整 tree 雜湊相同 | 同一次 25 tests 對應三分支相同內容，非重跑三次 |
| Python／部署 JSON 靜態解析 | 通過 | 不代表 Apps Script／Cloudflare 執行時相容或已部署 |
| 實際 GAS／LINE／Sheets 副本整合 | 未執行 | 缺授權／真實資料與受控測試環境 |

可重跑的既有測試指令：

```bash
# repository 根目錄；新環境先安裝 requirements-park-export.txt 所列套件
node --test test/parks/*.test.mjs
# 另在 sponsor-worker/，依 lockfile npm ci 後
npm test
```

三項**額外合成診斷**已重現，未計入 121 個通過案例，也未在本次修改程式：

1. **選單殘留條件**：依序傳「附近公園」→「選單」→選單的「停車／分享位置」所產生的位置事件，實際路由仍為 park。`isMenuCommand` 分支沒有清除既有 intent，位置事件只看快取；因此不能假設使用者回選單就已恢復停車。見 `doPost`、`buildPapaKingQuickMenu_`（PK-04）。
2. **公園 Flex 400 無文字備援**：把 `postLineReply` stub 為回覆 400，對 `replyLine` 傳單一 Flex，僅出現一次 `[flex]` 呼叫，沒有 text。停車的「文字＋Flex」具有備援，公園單獨 Flex 沒有；不能把「無結果時的文字」當作「API 拒收 Flex 的文字備援」。見 `replyLine`（PK-05）。
3. **零卡片仍 PASS**：將 `buildReply` stub 為純文字，`testPapaKingLiveParkingV2()` 回傳 `cardCount:0`，仍記錄 `[PASS] Live parking reply structure and card colors`。測試迴圈沒有元素時不會失敗；應增加明確預期或標為未驗到卡片。這次是 stub 診斷，**不是線上測試**（PK-06）。

既有 121 tests 通過與上述缺口同時成立；目前不能把「測試全綠」當作功能全面驗收。

## 7. 部署設定與證據缺口

### Google Apps Script／LINE

- 三分支 `gas/appsscript.json` 相同：V8、Asia/Taipei、`executeAs=USER_DEPLOYING`、`access=ANYONE_ANONYMOUS`、STACKDRIVER。未明列 oauthScopes，會依專案程式推斷；完整專案含 Sheets 寫入函式，不宜拿來做最小唯讀授權範本。
- `LINE_CHANNEL_ACCESS_TOKEN`、`TDX_KEYS` 為停車必要 Script Properties；公園需 `PARK_SHEET_ID`。雲端程序環境變數不會自動注入 Script Properties。
- README／setup 有 clasp create／push／deployment 操作，不是既有 deployment 清冊。缺 `.clasp.json`、可對照的部署 ID／GAS 版本／來源雜湊及新測試回執。
- GAS `doPost` 無法取得 LINE 簽章標頭，程式沒有簽章驗證；這是已知架構邊界，不應在盤點時偷偷改 Webhook 或加新正式代理。
- `@version 0.3.0` 尚留在含 V2 變更的程式頂端；版本標籤需與來源及部署清冊共同整理。

### Cloudflare 贊助服務

- `wrangler.jsonc` 設定 Worker 名稱 `papaking-sponsor`、入口 `src/index.js`、compatibility date `2026-09-01`、D1 `DB` binding 與既有 database_id、observability。
- `npm run deploy` 是正式部署；**`npm run schema` 明確使用 `--remote`，是遠端 D1 寫入**，不是唯讀 readiness check，本次未執行。
- `.dev.vars.example` 只有空白需求名稱：ECPAY_MERCHANT_ID／HASH_KEY／HASH_IV、LINE_CHANNEL_ACCESS_TOKEN、LINE_TO。設定檔與範例不能證明雲端 secrets、D1 table、通知對象或付款回呼已正確。
- 三分支無 `.github/workflows/`，未設定可見的 GitHub Actions 測試／部署流程；外部 CI、分支保護與 Cloudflare dashboard 狀態未經 API 核實。

## 8. Google HTTP 403：原因與可行驗證路徑

### 2026-10-20 的實際觀測

對 Git 歷史公園模組曾記載的試算表進行一次**未帶可用授權**的唯讀 Sheets metadata GET，收到 Google JSON：

```text
HTTP 403
status: PERMISSION_DENIED
message: Method doesn't allow unregistered callers (callers without established identity).
         Please use API Key or other form of API consumer identity to call this API.
```

這次已到達 Google API，屬「呼叫者沒有建立身分」；不是先前代理 CONNECT 階段的 403。該歷史 Spreadsheet ID 是否仍為現在目標也尚未證實。`clasp show-authorized-user` 回覆 Not logged in；ADC 變數指向可讀但空的 `{}`，沒有可用身分。只記錄欄位數，不輸出任何憑證值。本次沒有重試同一失敗請求或要求 Token。

| 訊號 | 可下的結論 | 不能下的結論 |
|---|---|---|
| 代理 CONNECT 403（較早歷史紀錄） | 尚未到 Google，先檢查出口設定 | 不能說 Sheet 擁有者拒絕分享 |
| Google JSON 403／unregistered callers（本次） | 沒有可用 API 呼叫者身分 | 不能證明目標不存在、ACL 拒絕或資料內容有問題 |
| 有效 OAuth 後 403 | 再看不足 scope、API 未啟用、組織政策或檔案 ACL | 不能一律認定網路問題或重複索取 Token |
| 401／登入頁 | 檢查登入、token 有效性及所用端點 | 不能當作已讀表成功 |

API Key 不能取代私有試算表的使用者／服務帳號授權；錯誤訊息提到 Key 不代表應要求使用者貼 Key。可讀 GitHub Git 也不代表 Google 或 GitHub REST API 已獲授權。

### 授權驗證方案

| 路徑 | 最小條件與步驟 | 可驗收證據／限制 |
|---|---|---|
| **A. 一次 XLSX 匯出，優先解除資料阻礙** | 使用者用自己的 Google 瀏覽器帳號及下載權限，下載含四頁的整本 XLSX，附加一次；可用現有 [唯讀助手](../tools/park-export-readonly.html) | agent 自行跑匯入／635 母體／品質／逐筆清單；保留 SHA-256、日期／公式限制。這是匯出檔驗證，不是 Sheets API 成功或寫入驗證 |
| **B. 使用者 OAuth，直接唯讀讀表** | 先確認真正 Spreadsheet ID 與帳號 Viewer 權限，啟用對應 API，以平台安全連線或正式 OAuth 流程取得 `spreadsheets.readonly`。已知 ID 時不需 Drive 全域讀權 | `spreadsheets.get` 只讀四頁結構，再一次 `values.batchGet` 讀四頁；保留時間／sheet titles／欄名／列數／內容雜湊，並驗證635母體。token 不貼聊天／Git，不要求寫入 scope |
| **C. 受控服務帳號** | 可安全供應的服務身分，將該特定 Sheet 分享為 Viewer；以受控憑證或 workload identity 取得唯讀 Sheets scope | 同 B；只證明共享 Sheet 可讀，不保證原有 Apps Script 專案也可存取。勿憑空建立帳號、私鑰或網域代理權限 |
| **D. 補原始 GAS 模組盤點** | 已授權使用者能檢視 GAS，啟用 Apps Script API，以 `script.projects.readonly` 讀內容，或提供去除 secrets 的原始模組 | 比對原始候選建立器與 repo，仍不寫入／部署。Script ID 不是 Spreadsheet ID，也無公開 API 可直接讀 Script Properties 的值 |

唯讀 scope 完整名稱為 `https://www.googleapis.com/auth/spreadsheets.readonly`；僅需盤點 GAS 原始碼時再使用 `https://www.googleapis.com/auth/script.projects.readonly`。

若需要 Drive 以名稱找檔案，另外取得適當 metadata scope 與明確查詢範圍；不要為已知 ID 的讀表預設要求整個 Drive。預設 clasp login scope 包含較廣的管理能力，不是本次最小唯讀路徑；若採 project scopes，須在獨立本機設定明列所需 scope，不沿用含寫入能力的正式專案。

網路前置依序為 accounts.google.com／oauth2.googleapis.com（OAuth）、sheets.googleapis.com（讀表）、script.googleapis.com（僅需 GAS 原始碼時）；原生 XLSX 使用 docs.google.com。只有觀測到出口被拒時才調整設定。身分或權限變更後重跑**有目的的一次驗證**，不輪詢相同 403。

可參照官方 [Sheets scopes](https://developers.google.com/workspace/sheets/api/scopes)、[spreadsheets.get](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/get)、[values.batchGet](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/batchGet)、[Apps Script API 啟用](https://developers.google.com/apps-script/api/how-tos/enable)；本次未執行 OAuth／帳號授權。

## 9. 驗收與尚待決定

本次盤點已完成：三分支樹／祖先／tag／差異、README 與部署契約、121＋25 既有測試、3項額外合成缺口、Google 403 分層與可行授權方案。沒有對正式部署或真實635筆宣稱驗收成功。

後續先完成核心缺口／CI／唯讀資料取得，再討論整合與隔離環境驗證；最後才以獨立授權處理正式部署或 Sheets 寫入。各步的依賴、Issue 草案與分支順序見 [ROADMAP.md](ROADMAP.md)。

## 10. 固定版本來源入口

- [main webhook](https://github.com/hsieh81709/papaking/blob/734ace5702736dd069399b1188b4b122d4f5e2fe/gas/line_webhook_gas.js)、[main B4-5](https://github.com/hsieh81709/papaking/blob/734ace5702736dd069399b1188b4b122d4f5e2fe/gas/park_b45_sync_gas.js)。
- [舊公園 Flex 分支](https://github.com/hsieh81709/papaking/tree/b3bb7c1cf7bc501a5d7c5b02073203c385fa52d8/gas)、[V0.3.1 merge](https://github.com/hsieh81709/papaking/commit/39640de6fb3ae29f699ac0e03edd0d1423e3c3de)。
- [V2 webhook](https://github.com/hsieh81709/papaking/blob/0b4a3f07c5d5d19a976bbc22e6507d545d11ca07/gas/line_webhook_gas.js)、[V2 公園測試](https://github.com/hsieh81709/papaking/tree/0b4a3f07c5d5d19a976bbc22e6507d545d11ca07/test/parks)、[四表匯出說明](parks/export-handoff.md)。
- [GAS manifest](../gas/appsscript.json)、[Worker manifest](../sponsor-worker/wrangler.jsonc)、[部署教學](setup.md)、[副本計畫](parks/copy-sync-plan.md)。後四項相對連結會隨讀取分支變動，功能比較仍以前述固定 SHA 為準。
