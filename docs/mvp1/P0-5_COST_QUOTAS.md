# P0-5 成本與配額估算

2026-10-21 UTC。**官方價格／免費額度未驗證，兩方案月費均為「待核價」，不是0元報價。** 以下為可重算的工程用量模型，不是正式帳單或生產容量承諾。幣別、稅、區域、付款方案與既有帳號剩餘免費額度尚未取得。

## 官方來源存取結果

本輪06:48:41 UTC以curl GET、15秒timeout、最多3次redirect，每host一次測試；六項皆 `CONNECT=403 / curl exit=56 / origin HTTP=000`。是代理建立tunnel被拒，未取得來源HTTP回應；不是來源網站403／404、DNS失敗或Google OAuth拒絕。未重試同host其他價格頁、未改網路政策。

| 實際測試URL | 結果與用途 |
|---|---|
| https://developers.cloudflare.com/workers/platform/pricing/ | proxy CONNECT403；Workers價格未讀取 |
| https://cloud.google.com/run/pricing | 同上；Cloud Run價格未讀取 |
| https://developers.google.com/apps-script/guides/services/quotas | 同上；GAS最新配額未讀取 |
| https://developers.line.biz/en/docs/messaging-api/pricing/ | 同上；LINE API計費分類未核實 |
| https://tw.linebiz.com/service/account-solutions/line-official-account/ | 同上；臺灣OA方案入口未讀取，並非已取得價格表 |
| https://tdx.transportdata.tw/ | 同上；會員／金鑰方案及實際授權額度未讀取 |

UTC與狀態原始收據見 [OFFICIAL_SOURCE_ACCESS.json](P0-5_OFFICIAL_SOURCE_ACCESS.json)。待開通或由持有人提供官方文件日期／區域截圖後核價；不需要Token貼到聊天。

## 免費額度、付費條件與待核SKU

下列服務可能有免費方案或免費用量；**本輪無法確認當前數字、適用方案或帳號資格**。未使用記憶中的美元最低費、免費請求數或過期價格湊出精確合計。所有free grant必須按實際日／月窗口、region、帳號共用及剩餘額度計算。

| 方案／服務 | 免費額度狀態 | 付費／限制條件及待核項目 |
|---|---|---|
| A Workers | 當前Free／Paid包含量、CPU時限與超限行為待核 | 固定方案費、請求／CPU超額、invalid請求是否計費；付費方案是否有CPU cap；不能假設每月小量就免費 |
| A DO SQLite | 免費方案是否可用所需SQLite／alarm，以及呼叫／duration／rows／storage包含量皆待核 | 不混用舊KV-backed DO價格；等待GAS時的active duration、計費memory單位、SQL rows scanned/written、索引與備份費 |
| A logs／告警 | included events／retention與通知能力待核 | 自動invocation logs、trace、Logpush／外部儲存／通知可能另計；不假設單一Worker費含所有觀測 |
| B Cloud Run control＋dispatcher | 免費request／CPU／memory量與共用範圍待核 | request-based vs instance-based、region、billing啟用、min/max instances、concurrency、startup及rounding；min=0不代表所有費用為0 |
| B Firestore | reads／writes／deletes／storage的免費窗口與資格待核 | transaction retry／index amplification、TTL deletes、backup／PITR、跨區；不能直接用每月總量套每日免費量 |
| B Cloud Tasks／Scheduler | operations／job免費量待核 | create、delivery／重試、payload計費單位；scheduler job固定費及呼叫產生的Run／DB費另計 |
| B Secret Manager／Logging／Monitoring | version／access、log ingestion／retention／alert免費量待核 | secret讀取依cold start／rotation策略，不是每請求必讀；不把預算告警當硬停止；自訂metric／通知可能另計 |
| B image／build／network | Artifact Registry、Cloud Build及egress適用免費量待核 | 部署次數、image保存、跨區Firestore、對GAS／LINE出站、NAT／LB若新增會另有固定費；目前設計未要求NAT／LB |
| 共同 GAS／Workspace | 免費帳號及Workspace配額差異未核讀 | 需知道帳號方案；不是提高入口預算就可無限買GAS執行量；Workspace訂閱若需新增另列 |
| 共同 LINE／TDX／Maps | 本帳號方案、當期額度與官方條款皆未核實 | reply／push／OA訊息計數分開；TDX授權與key上限；Maps內建與付費Platform SKU分開，不能一律寫免費 |

官方待核參考（**以下URL本輪未另外請求**，同host已拒絕）：[DO價格](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[Firestore](https://cloud.google.com/firestore/pricing)、[Tasks](https://cloud.google.com/tasks/pricing)、[Scheduler](https://cloud.google.com/scheduler/pricing)、[Secret Manager](https://cloud.google.com/secret-manager/pricing)、[Observability](https://cloud.google.com/stackdriver/pricing)、[網路](https://cloud.google.com/vpc/network-pricing)、[Maps計費](https://developers.google.com/maps/billing-and-pricing/overview)。需由官方文件與帳務實際核對，不能僅憑URL存在視為價格證據。

## 統一模型與計價單位

**N為每月有效、唯一、單事件的Webhook HTTP POST，不是完整查詢數。** 基準每次查詢先選分類再分享位置，所以Q=N/2；無選單額外操作、無惡意流量／重送，30天均勻分布。若使用者指的是1,000次完整查詢，模型N須改2,000。批次每POST含多event時也需重算。

假設及公式如下，均為本輪規劃輸入，**非量測**：

- parking佔Q的50%，P=N/4，其餘為公園／公廁；每active scope平均5次query，U=Q/5。分類／主選單提示由入口重用抽離的純訊息規格，只有位置query呼叫GAS；仍需後續實作與相容驗收。
- 類別提示與query各一個reply attempt；1% query發生一次400文字fallback，故reply attempts=N+0.01Q。reply attempt不是OA付費訊息／push量。
- 用量預留：ledger讀4N、寫6N、GC刪N；SQL實際rows／Firestore document／index／transaction retries可能不同，須乘量測的amplification，不能直接當官方帳單單位。
- retained event邏輯資料2KiB／event、7天；結果10KiB／query、1天；scope＋quota4KiB／U、30天。穩態storage=`(N×7/30×2 + Q/30×10 + U×4) KiB`，未含引擎／索引／backup／未決事件延長保留。不是尖峰或磁碟hard cap。
- logs=4條×256 bytes／POST＝1KiB N，不含raw body；external egress預留6KiB N（LINE訊息、GAS job／permit小回應），不含headers／TLS／跨區DB／重試；GAS→gateway大結果為gateway ingress，不重複算gateway egress。實際供應商是否收egress另核。
- CPU／時間假設：Worker每entry10ms CPU；GAS等待4秒／query，control總處理0.05秒／POST，permit callback 0.02秒／query。等待時間不當作CPU實際工作量，但可能計入DO active duration及Cloud Run request duration。
- A Worker entry=N+Q（Webhook及GAS permit）；DO invocations以4N+30預留accept、permit、dispatch alarm、status／恢復及每日GC，非量測精確路徑；DO memory若以0.125GiB計費，duration模型=`0.125×(0.05N+0.02Q+4Q)` GiB-seconds。0.125是**模型條件**，不是本輪查證的DO記憶體或免費額度。
- B為control與dispatcher分離、min instances=0、1vCPU／0.5GiB、concurrency=1的保守對照。每分鐘recovery tick＝43,200／30天，每tick假設0.05秒＋1個邏輯DB讀；request=`N+2Q+43200`，vCPU-seconds=`0.05N+0.02Q+4Q+2160`，GiB-seconds為其一半。未計startup／rounding；正式併發、地區與計價模式需實測。Tasks預留create＋delivery＝2Q個邏輯操作，不當成官方計費單位。

## 三種月量情境

| 共同負載／估計單位 | N=1,000 | N=10,000 | N=100,000 |
|---|---:|---:|---:|
| 完整query Q／parking P | 500／250 | 5,000／2,500 | 50,000／25,000 |
| 平均有效POST／日 | 33.33 | 333.33 | 3,333.33 |
| LINE reply attempts含1% query fallback | 1,005 | 10,050 | 100,500 |
| GAS query executions／permit UrlFetch | 各500 | 各5,000 | 各50,000 |
| ledger邏輯讀／寫（不含GC）／GC刪 | 4,000／6,000／1,000 | 40,000／60,000／10,000 | 400,000／600,000／100,000 |
| 邏輯穩態storage GiB | 0.000985 | 0.009855 | 0.098546 |
| gateway external egress GiB | 0.005722 | 0.057220 | 0.572205 |
| structured logs GiB | 0.000954 | 0.009537 | 0.095367 |
| **共同服務月費** | **待核價** | **待核價** | **待核價** |

| A用量／費用 | N=1,000 | N=10,000 | N=100,000 |
|---|---:|---:|---:|
| Worker entry requests | 1,500 | 15,000 | 150,000 |
| Worker CPU milliseconds假設 | 15,000 | 150,000 | 1,500,000 |
| DO invocations預留 | 4,030 | 40,030 | 400,030 |
| DO GiB-seconds（僅當0.125GiB條件適用） | 257.50 | 2,575.00 | 25,750.00 |
| **運算＋耐久儲存＋網路＋日誌月費** | **M_CF＋各SKU超額費，未核價** | **同左，未核價** | **同左，未核價** |

| B用量／費用 | N=1,000 | N=10,000 | N=100,000 |
|---|---:|---:|---:|
| Run requests含每分鐘恢復檢查 | 45,200 | 63,200 | 243,200 |
| Run vCPU-seconds（1vCPU，單併發模型） | 4,220 | 22,760 | 208,160 |
| Run GiB-seconds（0.5GiB模型） | 2,110 | 11,380 | 104,080 |
| Firestore邏輯讀含恢復 | 47,200 | 83,200 | 443,200 |
| Tasks create＋delivery邏輯操作 | 1,000 | 10,000 | 100,000 |
| Scheduler tick | 43,200 | 43,200 | 43,200 |
| **運算＋耐久儲存＋網路＋日誌月費** | **各SKU＋固定／維運服務，未核價** | **同左，未核價** | **同左，未核價** |

這些數字不能直接比成「A快／便宜幾倍」：A的ms是真CPU模型、DO另收等待duration；B是配置資源的request-duration模型，不同SKU與免費量未核實。恢復tick的固定成本使小量B的內部請求數大於外部POST，調成每5分鐘可減掃描，但會延遲恢復，不能當作無代價省費。

## 填單價後的費用公式

設 `over(U,L)=max(U−L,0)`，L為**本帳號剩餘**免費／包含量，依官方日／月窗口逐窗算；`p`為每一對應單位單價：

```text
A = M_CF + worker_requests/CPU的超額費
    + DO_invocations/duration/SQL讀寫/storage的超額費
    + 適用的egress/log/alert/backup費
B = Run_requests/vCPU-seconds/GiB-seconds的超額費
    + Firestore_reads/writes/deletes/storage的超額費
    + Tasks/Scheduler/SecretManager/Logging/Monitoring的適用費
    + egress/Build/ArtifactRegistry/backup費
總成本 = A或B + LINE/TDX/Maps/Workspace的適用費 + 稅/匯率 + 維運成本
```

每項超額費=`p×over(U,L)`，注意單價可能以百萬／GiB-month等單位報價，需轉換。Firestore寫6N與刪N分開，不把TTL刪除當免費或與write同價；DO不能以4N邏輯讀直接當實際SQL scanned rows。M_CF是否包含Workers與DO的最低方案費須查核，不能重複加底費。B Secret Manager access取決cold start及cache策略，另按實際次數；建置／image／監控及正式＋隔離的固定費均不可漏列。

精確模型CSV見 [P0-5_COST_SCENARIOS.csv](P0-5_COST_SCENARIOS.csv)。標準庫離線重算腳本保存在 `.local/mvp1-p05-20261021/cost_model.py` 隨證據包交付；沒有新增或修改任何執行服務程式。

## 既有服務配額與容量阻擋

| 項目 | 來源與本輪可信程度 | 對三情境的影響 |
|---|---|---|
| TDX每key限速 | 程式常數TDX_RATE_LIMIT=5／分鐘可證實；不是已核實的會員權益 | cold無重試NearBy為2P＝500／5,000／50,000次／月；月平均低不代表尖峰可用；token、輪替、NTPC分頁另計 |
| Google行車候選 | 程式每query最多5候選可證實；DRIVE_TIME_RPC_ENABLED=true | cold候選5P＝1,250／12,500／125,000；若RPC全部失敗再Maps fallback，可有10P個外部attempt，不代表10P都同一官方SKU |
| GAS Maps每日配額 | repo歷史指引曾寫一般帳號約1,000 directions／日，**本輪未核實現行帳號** | 若5P全部落到內建Maps，平均約41.7／416.7／4,166.7次／日；最後情境在該歷史條件下超限；反查／基隆geocoding另計 |
| GAS UrlFetch／執行／並行／Properties | 當前官方上限與帳號方案未讀取 | 新permit額外Q次UrlFetch；RPC每目的地、TDX／token等另計；平均月量無法證明服務可用 |
| GAS逐operation Properties fence | 本輪模型每receipt256B、7日保留，不是官方quota | 需0.0285／0.2848／2.8483MiB。若運作只預留256KiB，最多1,024筆，10,000情境已不夠；採外部permit，不能刪未決receipt湊容量 |
| LINE | API計費與臺灣OA方案未核實 | N+0.01Q為reply嘗試，不能當付費push量；正式schema、rate及reply時效仍須驗；不自動用push補償未知reply |
| Maps非公開RPC | 程式實際使用，沒有「無key＝合法免費無限額」證據 | 條款、可用性與官方替代方案須核准；不能為省費繞過額度或將未公開介面視為SLA來源 |

台北／新北公園與公廁仍受人工核准發布gate。付平台費不會增加已核准導航資料，也不會批准原9筆覆寫。

## 尖峰、異常與費用控制

基準不含攻擊A_bad、redelivery、retry與backup；實際entry至少N+A_bad＋重送量。即使invalid請求驗簽即拒，仍可能產生入口運算／請求／log費。不能以「只記有效query額度」宣稱硬封整體帳單。

必須有：平台可用的edge限流／body與CPU上限、invalid request聚合採樣而非逐body log、每日有效event／provider attempt原子上限、pending及儲存上限、max instances／有界並行與Tasks dispatch、fallback／輪替／status poll重試上限、GC與log retention、費用告警及人工／受控kill switch。WAF、通知與監控能力及費用也待核價，未在本輪啟用。

預算alert通常不是硬停止；max instances限制同時用量但不限制整月呼叫；GAS HMAC不阻止惡意流量先消耗GAS執行quota。真正停用入口／切換維護模式仍需預先授權，且可能丟棄或延遲新事件，不能同時承諾零費用、零遺失、無限可用。外部供應商預算不足時應有明確降級，不誤報附近沒設施。

敏感性例：等待GAS從4秒升到20秒，N=100,000時A的假設duration由25,750升到125,750 GiB-seconds，B由208,160升到1,008,160 vCPU-seconds。這是公式敏感性，不是價格；先量測尾延遲及設定deadline，再談預算上限。
