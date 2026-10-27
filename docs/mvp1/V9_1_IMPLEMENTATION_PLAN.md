# V9.1 最小實作設計及工期

2026-10-27。依[現況](V9_1_CURRENT_STATE.md)，本文件是規劃，不是實作或正式操作授權。沿用現有GAS／LINE channel／Sheets／Webhook，不做Worker或大型架構重寫。

## 決策與操作流程

六格Rich Menu只送文字，搜尋仍是選分類→location Quick Reply→搜尋→Flex→原Maps導航。使用說明不清意圖；傳送位置只顯示當前分類與剩餘期限，不建立新分類或延長600秒。回報採獨立會話，`取消回報`回原搜尋狀態；在回報選單內意外傳位置不觸發停車。選擇新搜尋分類則取消尚未提交的回報，再走原搜尋流程。返回主選單明確取消回報及原搜尋分類，與既有主選單語意一致。

每張已展示設施卡片加「回報資料錯誤」postback按鈕；只使用已通過原搜尋規則的結果建立回報context，不從候選座標或任意ID組導航。無可查核身分或無資料卡不加假按鈕。NTPC_STATIC道路資訊卡可建立`parking-road`觀測回報，不能因增加回報而補座標／導航。文字fallback提供「問題回報」引導，不重查TDX／Maps或繞過一次回覆限制。

問題回報流程：設施卡／Rich Menu→（無ID則列最近仍有效的已展示結果供本人選取）→五類問題→確認頁（類別、名稱、ID或觀測ID、問題種類）→按「送出回報」才新增一筆。無最近結果則提示先選停車／公園／公廁搜尋，不把最後一筆或最近一筆自動當目標，不接受使用者任意文字ID。過期context請重新搜尋，不默默重放付費停車查詢。

P1問題種類：位置錯誤／設施不存在或已拆除／無法進入或暫停開放／名稱或設施資訊錯誤／其他。**P1不收自由文字**：「問題說明」存固定問題文字與「待人工查核」，其他亦先記其他；本人可於後續管理流程補查。這項精簡讓P1不保存對話內容／地址敘述等額外個資，亦避免文字被誤當搜尋指令。自由描述、圖片、附加位置與處理後通知列P2，不冒稱已完整支援。

## 共用路由與安全契約

1. `papaKingAuthorizedEvents_`僅增加本人DM、具replyToken且受支援namespace的postback；其他使用者／群組／room／follow仍在ledger、讀寫表與回覆之前拒絕。保留signed模式原契約及personal-direct風險說明，不能放寬成接受所有事件。
2. `papaKingAcceptEvents_`對postback驗證型態、來源、replyToken、event ID、timestamp及data長度。新postback hash含完整postback data／params、來源、時間；**原message hash序列化完全不變**，避免升版後現有message ledger衝突。合法重送不重做，改data同event ID必須衝突。
3. `doPost`在現有事件claim／STARTED／DONE／UNKNOWN範圍內派送postback，仍用原reply fence。不能直接在入口appendRow或額外無fence回覆。
4. postback建議 `pk:r1:<opaque-token>:<action>`，action採固定enum，問題類型用短code；不放本人ID、位置、名稱、自由文字或可任意改寫的設施ID。總長度保守控制200 UTF-8 bytes以下，正式上限待官方文件核對。
5. server context綁定本人scope hash、設施kind／ID、來源指紋、代表點類型、已展示版本、到期時間、固定問題選擇、穩定report ID。只供內部查核；不以token或User ID當可靠LINE驗簽。設施座標如留查核快照須明確標為「設施來源點」，不保存使用者分享的原始位置。
6. context用獨立`pk_report_ctx_v1_<opaque-token>` Properties，**不塞入現有7800-byte pk_state_v1**，不與600秒搜尋意圖混用。建議TTL30分鐘、最多40個context、每個2KB以下；先檢查總可用配額，容量不足不加回報按鈕但搜尋仍正常。過期只清理終止／未提交context；未知寫入不得直接丟棄而自動重做。
7. 新搜尋回覆若因回報context儲存失敗，降級為原Flex／文字與「暫無法回報」，不能讓既有搜尋因新附加功能整體失敗。送出階段則fail closed，不編造成功。

## 回報append與一致性

使用現有九欄，不自動新建／改名／增欄。每次送出先核對全部表頭，不符合就錯誤提示且零寫入。資料只新增、不改正式公園／公廁／停車資料，不改發布或核准紀錄。`回報時間`用server Date，`處理狀態=待處理`，`處理時間`留空；`備註`為有版本的受控JSON（例如source namespace、原ID／obs ID、來源指紋、設施名稱／來源點快照、submission key），不存token、replyToken、API key或原始user ID。自由文字尚未開放；來源名稱等仍須長度限制／控制字元過濾及試算表公式注入防護，以字面值寫入。

穩定report ID在進入確認頁之前產生，重複按確認、相同或不同event ID都使用同一report ID。提交時獨立短ScriptLock，讀context／查回報ID欄→若已存在則回覆已收到、不append→否則標記SUBMITTING→寫一列→依相同ID讀回→標記COMMITTED。鎖內不做LINE或其他網路呼叫，也**不可巢狀呼叫會再次取同一ScriptLock的papaKingState_**。規劃每個scope每分鐘最多3次提交、每日最多20筆新報告，檢查／reservation在同鎖下原子化；另有既有event總量限制仍有效。

Properties與Sheets沒有跨服務transaction，**不宣稱exactly-once**。append可能成功但狀態寫回／讀回失敗時保留UNKNOWN／SUBMITTING，先依report ID核對；無法證實時提示「送出結果尚未確認，請勿重複送出」，不改report ID或重新append。明確寫前失敗提示未送出、可稍後重試同一context。append成功但LINE回覆失敗不重寫；新事件回同一context可讀回已收到。若發現同report ID已有多列，停止新增並列管理查核，不刪列「修正」。

回報開關關閉時，不建立context／按鈕／寫表。已有按鈕點擊須提示暫停，不執行append。這是快速回復新功能的方法，不清空原意圖、ledger或搜尋服務。

## 檔案與函式範圍（P1才可實作）

| 檔案 | 修改／新增建議 | 保護範圍 |
|---|---|---|
| `gas/line_webhook_gas.js` | doPost postback派送；Quick Menu公廁文案、傳位置／說明入口；flexBubble emoji；renderer傳顯示結果身分 | 不改停車距離／行車排序、TDX金鑰、額度／導航核心 |
| `gas/webhook_security_gas.js` | 本人DM postback明確白名單 | owner／group／room限制不放寬，不冒稱驗簽 |
| `gas/webhook_state_gas.js` | 僅新增postback驗證/hash分支 | 原message hash／schema／容量／保留期／reply fence不變 |
| `gas/facility_line_gas.js` | 新文字入口派送；公廁emoji、所在樓層／剩餘限制；回報按鈕／fallback引導 | source-unverified原警語與導航驗證不變 |
| `gas/park_search_gas.js` | 公園Flex emoji／回報按鈕 | 搜尋、遊具、3km／5筆及人工核准不改 |
| 新 `gas/facility_report_gas.js` | `handleFacilityReportPostback_`、context建立／查核／限流、九欄adapter、`submitFacilityReport_`、確認UI | 默認關閉；只mock寫入，正式啟用另案 |
| 新 `tools/line-rich-menu.mjs` | 離線配置／熱區／圖片規格驗證；之後另案read-only inventory／受控publish／rollback子命令 | 預設只輸出JSON，不能默默呼叫LINE寫入API |
| 新 `assets/line-rich-menu/`、`config/line-rich-menu.example.json` | 六格JSON、圖片設計／可重跑模板 | 圖片不含本人ID或token；官方規格核對後才定稿 |
| `.github/workflows/offline-tests.yml` | 納入新增test/v9_1套件及產物，保留原測試job | 不刪減既有643項回歸 |
| 新 `test/v9_1/` | 合成Rich Menu、postback、回報writer、樓層與emoji fixtures | 不弱化V9核准／個人／回覆斷言 |

停車來源ID若已在原始payload存在，只增加metadata傳遞，不改去重／排名鍵；各來源沒有可靠ID則使用obs ID，不為補ID再叫API。可在renderer/context薄層處理的就不碰parser；必要parser投影改動須列出來源及回歸證據，不宣稱只有兩檔會變。

不修改 `gas/facility_search_gas.js` 的座標／發布／來源指紋規則，不修改sponsor-worker、park_geocoding、B4-3／B4-5。manifest先保持原樣，隱含OAuth權限及新增寫表是否要求重新同意須實際核對，不先宣稱不會有授權變更。

## 設定與外部權限

- 新增設定規格：`PK_REPORT_ENABLED=false`（缺值亦false），未來核准測試／啟用才設true。不在P0或P1寫正式Properties。
- `PK_REPORT_CONTEXT_TTL=1800`、cap40、每日20／每分鐘3先用程式內有界常數，避免增加大量屬性；需變更另走設定設計。不用新的Sheet ID，沿用PARK_SHEET_ID／既有九欄表。
- Rich Menu工具用本機環境變數讀取同channel token及owner ID，不寫檔／Git或log；不新增GAS token副本。綁本人需要相同channel管理權及有效channel token，不能用登入clasp代替LINE權限。正式啟用前讀回／備份既有本人與預設綁定。
- 寫表使用部署者既有檔案權限；因新增回報writer，正式寫入／啟用與可能OAuth同意須另經使用者批准。本人allowlist不保證防偽造，預設關閉與每日20僅為程式限制，不是平台費用硬上限。

## 7個工作天基準＋最多1天緩衝

| 階段 | 工期 | 驗收／相依 |
|---|---:|---|
| D1 身分／schema／事件契約與失敗fixtures | 1日 | 三類ID與obs契約、postback hash舊message相容、九欄adapter；無正式權限亦可合成驗證 |
| D2 六格離線資產與文字路由 | 1日 | 三類重用、傳位置／說明不破壞意圖；官方規格無法核驗時只標draft |
| D3 emoji／樓層／context按鈕 | 1日 | 原色／導航／品質標籤不變、text fallback；有界context隔離 |
| D4–D5 回報狀態／append／競爭與失敗注入 | 2日 | 五類→確認→mock新增，雙事件去重、unknown不自動重寫、速率與容量 |
| D6 受影響整合、一次完整回歸與發布說明 | 1日 | 舊643及新增全部通過、檔案／manifest／Git檢查 |
| D7 核准後本人手機與Rich Menu綁定驗收窗口 | 1日 | 必須先另行核准正式程式、Sheet append、Rich Menu建立／本人綁定，未核准則交離線候選並停止 |
| 緩衝 | 0–1日 | LINE規格／權限、停車ID來源差異；超過則另估，不承諾硬壓工期 |

預估7–8個工作天，非自動排定日曆或現在起算。離線候選約6日，正式核准／權限等待不算工程工時。5日只有在既有Rich Menu／權限／來源ID與schema全確認，且延後實際發布時才可能；本次發現postback三層缺口及停車ID遺失，不以5日當承諾。若要求P1自由文字／圖片或整合明細樓層join，另估，不在7–8日內默默擴充。

## 核准分界

P0只文件。P1須使用者核准後才離線修改程式、測試、素材及工具；仍不部署、不呼叫Rich Menu寫入、不寫正式Sheets。P1交付後再次核准正式版本備份與部署、LINE新選單／圖片及本人綁定、回報開關與首次正式append／手機測試。三者可分批核准；回復先停新回報／還原本人選單綁定，必要時將原GAS部署指回版本9，不能刪既有回報列或清原ledger。
