# PapaKing 專案現況

> 個人自用發布候選（2026-10-22）：新增明確啟用的personal-direct模式，僅指定User ID一對一；其他人／群組在query與回覆前忽略，保留資料核准、去重／額度／Flex備援。沿用同一GAS／LINE／Sheets，不要求第二環境。allowlist不等於驗簽，偽造本人ID仍有風險；未部署。見[個人發布手冊](mvp1/PERSONAL_RELEASE.md)。

> P0-9實作補強：既有eec65cc程式之上新增回覆attempt限制、同快照400備援指紋與損壞狀態拒絕。新增8項先紅後綠；受影響390項通過，搜尋／停車核心不變。容量及正式安全／E2E仍未驗收；見[本輪實作驗收](mvp1/P0-9_IMPLEMENTATION_ACCEPTANCE.md)。以下382項等為前輪快照。

> P0-9：版本7／部署者／任何人／LINE直連由使用者人工確認；正式manifest人工匯出與repo語義相同；version7 source／manifest版本綁定仍缺。離線加入origin閘門、持久去重／分類、額度鎖定與reply attempt；382項受影響測試通過，原11項安全規格已綠。但低容量、公開GAS DoS／舊部署、隔離E2E與人工發布核准仍阻擋上線。見[修復報告](mvp1/P0-9_REPAIR.md)與[測試](mvp1/P0-9_TEST_RESULTS.md)。以下為歷史快照。

> P0-8已收到5份GAS人工匯出並完成離線差異核對；缺manifest及deployment對照，尚未證明等於live版本。附件停車對候選契約52／72、本機受影響135／135，詳見[匯出核對報告](mvp1/P0-8_EXPORTED_GAS_REVIEW.md)；不是正式環境驗收或部署核准。

> P0-7：雙北公廁adapter與提示完成離線適配，221項受影響測試通過；沒有新增資料核准或正式部署，原11安全阻擋未解。實際來源及授權限制見[P0-7報告](mvp1/P0-7_TAIPEI_TOILETS.md)。

> 最新MVP範圍與已核對Git差異見[P0-6精簡上線計畫](mvp1/P0-6_LEAN_RELEASE_PLAN.md)。正式GAS版本仍待唯讀對照；本輪只調整計畫，未新增部署或資料核准，原安全阻擋未解除。下文為各階段歷史證據，不能把舊快照筆數當正式即時可發布數。

盤點日期：2026-10-20（Asia/Taipei）。儲存庫：`hsieh81709/papaking`。
本文件以唯讀 Git 分支、原始碼、設定、既有紀錄及本次測試為依據；正式 GAS、Google Sheets、LINE Webhook 與 `main` 均未變更。建議 Issues 與整合關卡見 [ROADMAP.md](ROADMAP.md)。

## PK-PARK-MVP／MVP-02 本輪更新

雙北MVP離線程式驗收通過：原157項公園＋新13項、停車72項、來源33項，共275項通過。交界同時搜尋兩市；遊具篩選限台北可用設施資料，新北UNKNOWN不當作無；保留選單意圖與Flex文字備援，新增公園代表位置導航。

附件`新北市公園.csv`為UTF-8 BOM、635筆、無座標或CRS。635筆複合身分／地址均匹配，但官方座標比對0筆、沒有新增發布核准。真實快照可用點為台北812、新北9（1.42%）；台北保守設施門檻目前滑梯3園、鞦韆4園、共融0園，不代表其他園沒有設施。

`https://www.ntparks.tw/views.html`為代理CONNECT403；網站官方身分、條款、列表與個頁未取得。MVP-02官方證據尚未完成，3810格設施保持UNKNOWN，沒有實際網站爬取成功或端對端驗收。Commit、檔案、固定fixtures與資料覆蓋見 [MVP驗收紀錄](verification/PK-PARK-MVP.md)。不部署、不同步、不改9筆正式座標、main或sponsor-worker。

## PK-13 本輪離線驗收

依 PK-13 新增固定合成 fixtures 與 72 個停車核心測試：TDX 雙路／輪替、1km 格心偏移、NTPC 分頁與即時資料隔離、TWD97、快取 TTL、基隆過期、開車備援、月額度及群組限制。先執行紅燈（58 項中 17 fail；補充輪 72 項中 3 fail），再修正重現缺口，最後 **停車72、公園157、Worker25，共254項全數通過**。既有公園與Worker檔案未修改。

CI已加入停車 suite；主要行為變更是使用實際起點的1km查詢與快取（鄰近點命中率會下降）、失效token清除、來源有效性及群組個人額度修正。完整覆蓋、Commit、重跑方式與尚未驗證的線上／併行邊界見 [PK13驗收紀錄](verification/PK13.md)。沒有部署、正式資料寫入或main合併，也未將本機通過視為遠端Actions成功。

## PK-04～PK-07 本輪更新

本輪自 `edab060` 延續：PK-04 選單清除、PK-05 同批結果的 Flex 400 文字備援、PK-06 非空／Static／明確空結果診斷契約已完成程式與離線回歸；PK-07 已新增 [offline-tests.yml](../.github/workflows/offline-tests.yml)。原有121個公園案例未改寫，新增36個，現為 **157／157通過**；Worker **25／25通過**。

新增 workflow 經 actionlint 1.7.7 及本機等效命令驗證，不需要正式 secrets、沒有部署或遠端schema步驟。遠端 Actions 結果與隔離 GAS／LINE 真實驗證不因本機通過而視為完成。逐項 red→green、Commit／檔案清單與診斷設定見 [本輪驗證紀錄](verification/PK04-07.md)。

以下三分支 SHA／tag／檔數仍為原盤點快照（V2 `0b4a3f0`）；不是本輪更新後的遠端HEAD。原缺口描述保留作為修正前證據，最新進度以上述更新及驗證紀錄為準。

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
├── .github/FUNDING.yml                 # 贊助連結
├── .github/workflows/offline-tests.yml # 本輪V2新增；原三分支快照均無CI
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
├── test/parks/                          # 僅 V2：helpers + 八個 *.test.mjs（本輪新增三個）
│   ├── audit.test.mjs / search.test.mjs / sync.test.mjs
│   ├── regeocode.test.mjs / export.test.mjs / helpers.mjs
│   └── webhook-routing.test.mjs / line-fallback.test.mjs / parking-diagnostic.test.mjs
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
| 公園 Flex／Quick Reply | 三分支包含 V0.3.1 公園卡與五項選單；實際公園路徑仍用自己的 `buildParkFlexReply_` | V2 有結果／無結果與分流通過；PK-04／05已補測並修正原缺口 | 無版本化 LINE 驗證成功回執 | 已 merge 不代表已部署 |
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
| `node --test test/parks/*.test.mjs`（V2） | 157 passed（原有121＋新增36）、0 failed／skipped／cancelled | 公園／匯出／同步 mocks 及部分 Flex／分流；不是實際 Google API 寫入 |
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

以下三項是修正前的**額外合成診斷**；原盤點未計入121個案例。本輪已先新增失敗測試，再完成PK-04／05／06修正（新增36項），保留當時重現方式供追溯：

1. **選單殘留條件**：依序傳「附近公園」→「選單」→選單的「停車／分享位置」所產生的位置事件，實際路由仍為 park。`isMenuCommand` 分支沒有清除既有 intent，位置事件只看快取；因此不能假設使用者回選單就已恢復停車。見 `doPost`、`buildPapaKingQuickMenu_`（PK-04）。
2. **公園 Flex 400 無文字備援**：把 `postLineReply` stub 為回覆 400，對 `replyLine` 傳單一 Flex，僅出現一次 `[flex]` 呼叫，沒有 text。停車的「文字＋Flex」具有備援，公園單獨 Flex 沒有；不能把「無結果時的文字」當作「API 拒收 Flex 的文字備援」。見 `replyLine`（PK-05）。
3. **零卡片仍 PASS**：將 `buildReply` stub 為純文字，`testPapaKingLiveParkingV2()` 回傳 `cardCount:0`，仍記錄 `[PASS] Live parking reply structure and card colors`。測試迴圈沒有元素時不會失敗；應增加明確預期或標為未驗到卡片。這次是 stub 診斷，**不是線上測試**（PK-06）。

原盤點的121 tests全綠並未涵蓋這些缺口；本輪已補足對應回歸，但157 tests仍是離線結果，不代表功能已完成線上驗收。

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
- 原三分支快照均無 `.github/workflows/`；本輪V2新增僅離線測試的GitHub Actions，不含部署。遠端run、分支保護與Cloudflare dashboard狀態仍需實際回執，不由本機測試推斷。

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

本次盤點已完成：三分支樹／祖先／tag／差異、README 與部署契約、原有121＋25測試與本輪新增36項回歸、3項已修正的合成缺口、Google 403 分層與可行授權方案。沒有對正式部署或真實635筆宣稱驗收成功。

後續先完成核心缺口／CI／唯讀資料取得，再討論整合與隔離環境驗證；最後才以獨立授權處理正式部署或 Sheets 寫入。各步的依賴、Issue 草案與分支順序見 [ROADMAP.md](ROADMAP.md)。

## 10. 固定版本來源入口

- [main webhook](https://github.com/hsieh81709/papaking/blob/734ace5702736dd069399b1188b4b122d4f5e2fe/gas/line_webhook_gas.js)、[main B4-5](https://github.com/hsieh81709/papaking/blob/734ace5702736dd069399b1188b4b122d4f5e2fe/gas/park_b45_sync_gas.js)。
- [舊公園 Flex 分支](https://github.com/hsieh81709/papaking/tree/b3bb7c1cf7bc501a5d7c5b02073203c385fa52d8/gas)、[V0.3.1 merge](https://github.com/hsieh81709/papaking/commit/39640de6fb3ae29f699ac0e03edd0d1423e3c3de)。
- [V2 webhook](https://github.com/hsieh81709/papaking/blob/0b4a3f07c5d5d19a976bbc22e6507d545d11ca07/gas/line_webhook_gas.js)、[V2 公園測試](https://github.com/hsieh81709/papaking/tree/0b4a3f07c5d5d19a976bbc22e6507d545d11ca07/test/parks)、[四表匯出說明](parks/export-handoff.md)。
- [GAS manifest](../gas/appsscript.json)、[Worker manifest](../sponsor-worker/wrangler.jsonc)、[部署教學](setup.md)、[副本計畫](parks/copy-sync-plan.md)。後四項相對連結會隨讀取分支變動，功能比較仍以前述固定 SHA 為準。
