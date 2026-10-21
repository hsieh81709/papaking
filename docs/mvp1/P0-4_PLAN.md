# P0-4 安全與可靠性修復規劃

> 工作順序已由[P0-6精簡上線計畫](P0-6_LEAN_RELEASE_PLAN.md)更新：優先重用既有GAS模組、核准資料子集與最小安全修復，暫停大型DO／外部佇列原型。本文件保留為歷史風險與架構選項，不表示已核准實作。

日期：2026-10-21 UTC；分支 `feature/flex-message-v2`；分析基準 `fbd1abebcdf4c6a95516aab071c930cdd4acec21`，執行程式仍為855f5f2。本輪只有規劃及離線安全規格，沒有修復或部署執行程式。

**建議：保留三類搜尋與停車資料核心，在獨立入口驗證LINE簽章，以耐久協調器管理事件、分類及邏輯額度；GAS成為受驗證的查詢／訊息組裝服務。** 不沿用sponsor-worker處理LINE入站，不把Cache當去重資料庫。跨GAS與LINE的副作用不能保證exactly-once；不確定時保守停止自動重查／重送，接受可能需要使用者重新操作。

## 交付與閱讀順序

1. [根因與風險對照](P0-4_ROOT_CAUSES.md)：R1–R10及新增C1、每日額度缺口，逐項附失敗證據與限制。
2. [Webhook架構決策](P0-4_WEBHOOK_ADR.md)：現有路徑、原始body／headers限制、選項比較、建議入口與origin驗證。
3. [去重、狀態與額度設計](P0-4_RELIABILITY_DESIGN.md)：資料所有權、狀態機、並行與故障邊界。
4. [測試與驗收規格](P0-4_TEST_SPEC.md)：新增11個真正紅燈、實際回歸與下一階段安全測試矩陣。

## P0-3發布前核對與實際推送

- 開始工作區乾淨，HEAD=fbd1abe，分支正確。11個變更只有6個報告／收據、3個測試、2個離線驗證工具；因此「只有報告及測試文件」若按字面並不精確，但沒有GAS runtime、manifest、sponsor-worker、正式設定或憑證檔修改。
- 逐檔檢視及指定高可信樣式掃描：private key、GitHub token、Google API key、OAuth token、長literal Bearer皆無命中。這不是對所有未知格式秘密的絕對保證；測試身分、位置與核准都是明示合成資料。
- `git ls-remote --heads origin feature/flex-message-v2` 實際為855f5f2；fetch的FETCH_HEAD也是855f5f2，正好是fbd1abe的父Commit。`remote.origin.fetch`只追蹤main，所以既有origin/feature本地參照不是最新，沒有以該陳舊參照代替遠端證據。
- 已正常 `git push origin fbd1abe:refs/heads/feature/flex-message-v2`，輸出 `855f5f2..fbd1abe`；再次ls-remote確認fbd1abe。無force、rebase、衝突或遠端歷史覆寫。
- P0-3原始證據 `.local/mvp1-p03-20261021/` 保留；本輪另存發布核對與測試log於 `.local/mvp1-p04-20261021/`。本輪新規劃不隨上述推送自動發布。

## 分階段實作清單（尚未授權執行）

估算為熟悉專案的一位開發者人日，含離線測試，不含帳號／預算核准與等待；先順序完成，不能各自部署半套。

| 階段 | 內容與驗收出口 | 檔案影響（規劃路徑） | 估算／相依 |
|---|---|---|---|
| I0 契約與資源 | 核准平台、帳號／頻道／Script ID、資料保留及配額政策；以固定fixture定義簽章、envelope與事件結果契約 | 新 `docs/mvp1/contracts/`、`test/security-spec/fixtures/` | 1–2日；先決條件 |
| I1 可信入口與origin | 原始bytes簽章、大小上限、secret輪替、受保護envelope、零副作用拒絕；只接stub GAS | 新 `line-ingress/`、`gas/webhook_security_gas.js`；改 `gas/line_webhook_gas.js` 的doPost；manifest／設定僅提案後驗隔離 | 2–3日；依I0，必須入口與origin成對完成 |
| I2 耐久接收與去重 | 原子事件insert、同批去重與全批入帳、scope序號、工作claim、過期／失敗／UNKNOWN處理 | 新 `line-ingress/` ledger／schema／dispatcher；新 `gas/facility_job_gas.js` operation fence | 3–4日；依I1，R1–R5、R10 |
| I3 分類與額度 | 協調器原子分類版本／600秒／月額度；GAS API預算與key限制、儲存滿時fail closed | 改 `gas/facility_line_gas.js` 分離純提示／renderer與state adapter；改 webhook 的consumeQuota／pickTDXKey等安全邊界；新 `gas/api_budget_gas.js` | 2–3日；依I2，R6、R7、R9、C1；不改TDX解析排序 |
| I4 結果與單一投遞 | GAS返回typed結果、fallback同快照、LINE送出前耐久記錄、未知不重送；保留三類文字與導航 | 新 ingress reply adapter；改 webhook 的query/reply邊界、facility_line的查詢／UI接縫；共享schema fixture | 2–3日；依I2／I3，不雙重扣額或雙重送LINE |
| I5 完整離線驗收 | 436功能回歸、R1–R10安全斷言轉綠、C1、故障注入與真正多程序持久層測試、CI安全gate | `test/line/`、`test/security-spec/`、新 ingress tests；`.github/workflows/offline-tests.yml` 加獨立安全job | 1–2日；依I1–I4 |
| I6 隔離雲端驗收 | 官方schema、LINE真簽章／redelivery、GAS真Lock／權限、公開點TDX／Maps回歸、容量與回復演練 | 更新P0-3 runbook、版本hash與逐項回執 | 1–2日；需另外授權／資源，仍不正式切換 |

總計約12–19人日。未知的GAS跨平台延遲、平台額度與耐久儲存限制可能改變估算；I0後需再估。若選純GAS權宜方案，不能以較短工期宣稱等同推薦方案的可靠性。

## 檔案保護與預估影響

- **必須改接縫**：`line_webhook_gas.js` 入站認證、事件批次、query／reply拆分、額度與API預算；`facility_line_gas.js` 的Cache權威狀態改為協調器adapter，提示／公廁卡片盡量重用。這些改動影響入口與副作用，需額外安全測試，不能只驗render。
- **保持核心**：停車TDX／NTPC／基隆解析、1km、TWD97、行車時間及Static Fallback；公園／公廁3km／5筆／排序／來源指紋發布gate、UNKNOWN及代表位置用語。`park_search_gas.js`、`facility_search_gas.js`預期不需改核心，若需typed adapter只在邊界新增並驗指紋一致。
- **不得修改**：`sponsor-worker/`、park_geocoding、B4-3／B4-5、原始匯出資料、9筆正式座標及正式核准表。開發不包含任何同步、部署或main合併。
- `appsscript.json`、GAS required files清單與設定規格將在後續候選版另做hash／scope驗收；本輪未改。舊「直接貼Webhook單檔」README部署步驟須在安全候選完成後同步修訂，不能讓使用者按舊指引上線。

## 下一階段所需條件

本輪無需提供Token。後續需要：

1. 核准獨立LINE ingress平台與可用預算（建議獨立Cloudflare Worker＋SQLite-backed Durable Object，詳見ADR；不用sponsor的部署或DB）。確認平台方案支持所需持久交易、alarm及觀測能力。
2. 獨立LINE測試頻道、由持有人在secret管理介面配置Channel Secret／Access Token，允許測試Webhook及redelivery；正式頻道設定仍不動。
3. 隔離GAS專案、合成Sheets與可核對的Script ID／版本、讀取與隔離部署權；正式GAS全檔／版本／trigger僅唯讀匯出。缺資料時不宣稱已驗正式一致性。
4. 核定每日應用／API上限、配額時區與重置方式、dedup保留期間、短期加密事件資料保留及刪除方式、故障時可用性取捨。程式現在沒有每日user quota，不能用月額度冒充。
5. 在安全環境可讀LINE／Google官方文件及API的網路條件。P0-3的CONNECT403只代表當時代理拒絕；本輪未重試或變更政策，不將它當作今天所有API的實測狀態。

正式部署、正式LINE切換、權限／secret或Sheets改動均需另外列出具體版本、備份、回復與風險後取得明確核准。本輪在規劃交付後停止。
