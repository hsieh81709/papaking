# P0-3 Webhook、Cache與投遞安全評估

來源855f5f2；2026-10-21 UTC。**以下風險仍存在；本輪沒有修改執行程式。**

## 現有入口

`gas/line_webhook_gas.js:162` 的 `doPost(e)` 直接解析body，最多10事件，沒有驗證LINE簽章、事件ID、重送旗標、事件處理帳本或可信來源。`gas/appsscript.json` 設定ANYONE_ANONYMOUS／USER_DEPLOYING。GAS Web App的公開事件契約不提供任意HTTP headers，既有程式也沒有讀取 `X-Line-Signature` 的管道。

知道URL的外部請求可偽造分類與位置，消耗TDX／Maps及回覆配額、污染分類狀態。限制10事件、directions budget、座標檢查與月額度只能限制部分成本，不能證明請求來自LINE；LINE Access Token用於出站API，不是入站身分驗證。來源驗證不能信任body裡自稱的userId或eventId。

## 已重現風險

測試 `test/preflight/delivery-risks.test.mjs` 為現況刻畫；測試PASS代表**觀察到問題**，不是release gate通過。重入hook只代表指定交錯順序，不是GAS實際並行負載測試。停車重送案例使用停車delegate計數，不重複呼叫真實TDX；原72項停車fixtures另行回歸。

| ID／優先 | 證據與影響 | 後續修復驗收條件 |
|---|---|---|
| R1 P0 | 相同webhookEventId的分類與位置各重送，parking delegate共2次 | 已完成事件重送不得重查、重扣或再回覆 |
| R2 P0 | 舊位置重送消耗新公廁選擇，結果parking→toilet | 已處理位置不得套用新的分類；分類事件本身也去重 |
| R3 P0 | 公廁查詢失敗保留狀態，相同位置重送重查2次，兩次都ACK OK | 明確失敗／可重試狀態，沒有盲目重查或默認停車 |
| R4 P0 | 公廁query前重入，同快取分類被查2次 | 原子claim事件與分類；網路查詢不要持全域鎖 |
| R5 P0 | 停車peek／clear前重入，兩次停車委派 | 原子取用分類和事件claim，第二個請求不得進核心 |
| R6 P0 | compare與remove間插入新分類，新main被刪除留下marker | 原子compare-and-delete；舊完成不損失新意圖 |
| R7 P1 | marker／main兩次put交錯，值不一致變unknown | 單筆原子狀態或序號／鎖；仍需fail closed |
| R8 P0 | 無header簽章的合成body可到停車委派 | 安全入口與origin兩層拒絕未驗證請求，零外部查詢 |
| R9 P0 | consumeQuota交錯read／write，兩次放行僅計1次 | 額度原子reservation；並行耗盡不超額、不漏記 |
| R10 P1 | 11事件只處理10，整體仍回OK | 全批可靠接收／分拆／明確拒絕，不默默ACK遺失 |

此外Cache可提早逐出，不能當持久去重帳本；現有六小時marker只用於提示逾時。`requestId`是分類版本標記，不是LINE eventId。來源指紋保護資料一致性，不能代替Webhook驗證。不同使用者／群組／room的key隔離已離線通過，但並不解決同key競爭。

doPost捕捉單事件錯誤後仍回OK；傳送不確定時目前不自行重送，避免在同一handler重複reply，但也沒有可恢復投遞帳本。HTTP400文字備援只是一個有界替代，不是泛用重試；即便啟用LINE redelivery，也不能保證上述被吞錯事件會再送。

## 不修改 sponsor-worker 的建議安全方案（僅設計）

新建**獨立的LINE ingress服務**，獨立專案／部署／secret管理，與贊助服務完全分開：

1. 在任何解析或重寫JSON之前，以測試／正式頻道各自Channel Secret對**原始body bytes**做HMAC-SHA256，Base64後constant-time比對 `X-Line-Signature`。缺失、格式錯誤、錯頻道、body改動皆拒絕，不進GAS。LINE event timestamp不能簡單當成重送拒絕條件。
2. 驗證成功後，按channel＋`webhookEventId`建立耐久、原子去重記錄與受控佇列，選擇具有transaction／unique key的儲存。Cache僅作加速。區分received／claimed／query-completed／reply-attempted／completed／failed-uncertain，定義保留期間與租約恢復，測試跨實例重送；實際投遞不宣稱exactly-once。
3. **必須保護GAS origin**。只加proxy而仍允許公網body直打GAS並不安全。建議forwarding envelope包含版本、keyId、proxy當前時間、nonce、原始body的Base64、HMAC；GAS以獨立origin secret驗證MAC、短時效及nonce，未通過前不得解析事件或查詢。不可僅以URL參數固定secret／query string保護，也不可將Channel Secret外洩給LINE使用者。
4. GAS介面需在後續獲准任務修改 `doPost` 實作envelope驗證；目前855f5f2**尚不支援**。密鑰由secret manager／Script Properties提供，分離正式與測試，定義輪替與雙key過渡，不入Git、log、聊天。header式origin驗證在目前GAS介面不可直接使用。
5. 事件claim、分類切換／取用與月額度reservation應原子化，避免check-then-remove。若採GAS LockService，僅包短狀態轉移，不長鎖住TDX／Maps網路查詢；跨平台帳本／GAS兩階段失敗必須有補償與版本檢查。先畫出失敗邊界再實作。
6. ingress僅在事件可靠保存後ACK；受控短延遲處理並遵守實際replyToken時效及LINE限制。GAS的文字OK不能當成全部成功，需回傳可驗證的逐事件狀態，未知／部分失敗不得偽裝完成。reply是否送達不確定時不盲目補發；由人工／受控重試流程處理。

替代方案是在獨立的可讀headers平台處理整條LINE流程，GAS僅作受驗證內部查詢服務；改動更大，非最小方案。兩方案都需另外核准開發及部署，不可直接把LINE指向現有無驗證GAS作為安全解法。

## 下階段最小測試清單

先建立安全預期的失敗測試，與本輪刻畫測試分開：簽章缺失／錯誤／body改動／Unicode原始bytes／錯頻道；GAS直打拒絕；envelope過期、nonce重放及key輪替；同eventId並行只claim一次；新分類不被舊完成刪除；query成功reply未知時恢復策略；11事件批次可靠處理；額度reservation原子性；兩城市及無發布核准持續fail closed。

當修復後，R1–R10刻畫應改成對應安全斷言，不能保留「危險行為必須出現」作為永久release條件。本輪35項preflight不納入現有遠端CI，避免把風險重現綠燈誤當發布批准；可手動重跑，後續另建安全release gate。
