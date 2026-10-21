# P0-5 GAS防繞過與安全邊界

2026-10-21 UTC；設計文件，未實作。方案A／B都保留GAS搜尋核心；只有前端雲端平台不同，因此必須共同解決以下邊界。

## 目前不能保證的事

目前855f5f2仍接受LINE裸body，未驗簽、無耐久event ledger；11個P0-4安全規格仍為紅燈。GAS僅有 `e.postData.contents`，沒有官方公開的任意header介面可讀 `X-Line-Signature`；不將parse/stringify後JSON當作原始簽章bytes。

manifest為ANYONE_ANONYMOUS。獨立proxy只保護進proxy的流量；對方知道GAS URL仍可直接POST。Origin URL保密、Referer／IP／userId檢查、Cloud Run Invoker設定或Worker service binding都不能直接讓現有GAS Web App變成私有受管服務。

## 兩方案共同的必要措施

1. **入口驗LINE**：在JSON middleware前取得raw bytes，以頻道Channel Secret驗HMAC-SHA256與strict Base64／固定長度比較；schema、body大小及destination核對在適當階段。缺配置／錯簽章零query及零LINE投遞。
2. **GAS驗入口**：`doPost`只接受P0-4規格的短效HMAC envelope，綁env、實際Script ID audience、kid、issue／expire時間、nonce、operationId及完整payload hash。原LINE裸body或任何認證失敗不得fallback到舊router，也不能用query-string secret替代。GAS／LINE secrets分離，輪替有雙key有限過渡。
3. **權威事件狀態**：外部耐久DB將event去重、intentVersion、月／每日應用quota與job claim原子化。驗簽過的event仍不能由使用者欄位決定kind／發布核准／額度豁免；分類由權威state決定，新北發布gate保持不變。
4. **GAS執行許可**：通過envelope驗證後，GAS在任何TDX／Maps／Sheets query之前，向外部控制API領取該operation的一次性execution permit。允許一個operation首次執行，所有重複／不明狀態只返回status或拒絕，不再次給permit。
5. **單一回覆owner**：GAS只組裝typed結果與同快照文字fallback；入口保存結果並唯一執行LINE reply，先保存attempt再送；GAS不另送LINE。GAS回應綁operation／requestHash／候選版及domain-separated MAC，不信任HTTP200／HTML／redirect即成功。

## 對P0-4每operation Properties fence的調整

P0-4已列GAS Properties容量風險。本輪模型在100,000 POST／月、Q=50,000、每op256B、7天保留，僅receipt即約2.8483MiB，還沒含API counter及其他屬性；沒有足夠依據批准以Properties永久保存整個ledger。

**推薦將一次性執行permit本身放在同一外部耐久協調器**，取代每operation Properties receipt作為最終防重權威，避免把容量問題藏在GAS。本輪只改規劃，不覆寫P0-4原始文件／證據。GAS仍保存少量secret及有界provider counters，ScriptLock保護所有合作writer；Cache只加速。

permit契約需補入下一階段：

- 控制API為新服務的專用route；GAS request採獨立purpose MAC，綁opId、requestHash、env、Script ID、短效時間與新產生的attempt nonce。不能只驗「有某個字串header」。DB不接受GAS任意創建job；op必須已由驗證入口原子claim且quota已保留。
- DB交易將 `permit=UNISSUED` 改為 `ISSUED(attemptNonce)`，只有一次返回GRANTED；不同hash衝突。重試相同或新attempt都不再次回GRANTED。回應MAC綁該attempt、op及期限，禁止把舊permission回應套到新執行。
- 若DB已發permit但GAS收不到，**可能零query而仍耗一次嘗試額度**；不可重發permit來猜測是否執行。若query開始但結果遺失，轉UNKNOWN_QUERY，不重查。這是避免重複付費的可用性取捨，沒有exactly-once承諾。
- 新permit多Q次GAS UrlFetch及控制API／DB操作，已納入成本模型；延遲與失敗會直接影響query可用性。控制API故障時零provider query，不降級回本機無fence執行。
- DO transaction／`blockConcurrencyWhile`不能跨等待GAS的網路期間，否則GAS回呼permit可能被自己阻塞。B將dispatcher與control分服務，避免concurrency=1的dispatcher佔滿同一服務、GAS callback無法進入的死鎖；需真實隔離測試。
- 7天tombstone／stale watermark政策仍是擬定值，不是官方最長redelivery保證。GC不得刪除未決permit後把舊op當新工作；保留期／超期拒絕政策須核准。

外部permit降低本地儲存風險，未取消每日／每key來源預算。TDX選key、fetchAll每slot、輪替、RPC／Maps fallback仍須在每次外呼前保留attempt；多key部分寫入失敗寧可多扣並停止，不偷偷補回可能已耗用額度。共享key被其他Script使用時，同Script的LockService無法提供帳號全域硬限制。

## 認證與防DoS不是同一保證

| 能提供的邊界（修復後仍需測試） | 無法提供的邊界 |
|---|---|
| 未簽LINE流量不能進權威query流程 | 惡意流量仍可產生入口請求／CPU／log費 |
| 直打GAS裸body不能呼叫provider／LINE | 直打仍會啟動GAS並消耗執行／並行quota；HMAC驗失敗不是網路層隔離 |
| 同op在保留期內只有一次permit | Secret或DB管理者被入侵、帳本永久遺失、人工強制重做無法由正常去重機制保護 |
| 月／每日應用quota與來源attempt有界 | 供應商帳號其他專案的消耗、供應商窗口差異及未知計價不受本專案完全控制 |
| UNKNOWN不自動query／reply | 可能使用者沒有收到結果；不能保證零遺失與exactly-once |

因此推薦方案的上線條件包含使用者接受「公開GAS剩餘DoS風險」。如要求網路層只有可信服務能喚起執行，應另案評估把provider邏輯搬到可用IAM／private ingress的服務，或確認Apps Script API-executable／OAuth身分模式是否適用；本輪未驗證該模式可行，不把它算已完成替代方案，也不假設Cloud Run service account可直接呼叫現有GAS Web App。

## 必須通過的邊界驗收

保留P0-4 S01–S22，另加：permit雙程序競爭僅一個GRANTED、ISSUED後response丟失不補發、origin／permit request／response MAC不能互相反射、跨env／Script／op／attempt replay拒絕、DB／控制API掛掉零query、DO重入與B控制callback不死鎖、GC後stale op不復活、公開GAS大量拒絕的quota與告警演練（只在限額隔離環境）。

GAS MAC比較、ContentService redirect／HTTP狀態、公式所需服務限制及真實線上拓撲仍待驗，不以本文件宣告安全完成。保護9筆座標、拒絕無發布清單的新北導航、UNKNOWN語義及原436回歸皆不能退讓。
