# P0-5 分階段實作、隔離環境與核准清單

2026-10-21 UTC，僅計畫。未建立雲端資源、啟用付費、寫入secret、部署、改Webhook／Sheets／GAS或執行B4-5。sponsor-worker及原11個安全測試未改。

## 分階段出口

| 階段 | 可交付且需驗收的結果 | 依賴／不得跳過的條件 |
|---|---|---|
| D0 架構／費用決策 | 選A或B、官方單價／免費量／帳號剩餘額度、region／幣別／稅、月預算B與daily／provider limits、公開GAS剩餘風險簽認 | 先取得官方價格文件或持有人帳務證據；未知價格不能作0元核准 |
| D1 離線契約與安全紅綠 | raw-body簽章固定向量、envelope／permit協定、durable狀態schema、quota政策、fault matrix與合法第一個query前提 | 可先做合成資料；開始修改執行程式需另獲本階段後續開發核准；11紅燈不可skip |
| D2 限額隔離資源與入口 | 獨立channel／project／DB、secret store、最小權限、max concurrency與預算告警；只連stub GAS，驗錯簽章／origin直打零query | 建資源／啟billing／寫測試secret需明確核准；A不借sponsor的設定，B先完成IAM及region設計 |
| D3 耐久與並行 | 事件去重、批次全接收、intentVersion、quota reservation、一次性permit、lease／UNKNOWN／GC；多程序與持久重啟測試 | 不持鎖查網路；不以Cache替代durable；儲存／API失敗一律fail closed |
| D4 GAS接縫與單一投遞 | GAS只query／組裝、入口唯一LINE reply、同快照400備援；抽離提示純規格、來源預算保護 | 原停車解析／1km／Maps與公園公廁3km／5筆／發布gate不變；禁止雙重扣額或GAS＋入口各送一次 |
| D5 離線總回歸與成本校準 | 436功能綠、11安全綠、S01–S22適用離線項及permit新項有證據；量測CPU／wall／DB rows／log bytes／HTTP fanout；重算CSV與日負載 | 本輪成本假設不能直接當billing SLA；新增blocking安全CI但不部署 |
| D6 隔離平台驗收 | 官方LINE schema、真簽章／redelivery／mobile、GAS真權限／Lock／版本、公開點停車／Maps、平台DB恢復、有限尖峰及kill-switch演練 | 測試頻道與合成資料、限額公開點；mock不得算線上E2E；不耗盡正式額度來測429 |
| D7 正式準備決策 | 經核准候選SHA、實際部署版本對照、唯讀正式清冊、備份／回復、監控閾值與操作人 | 所有阻擋解除後另取正式部署／Webhook切換核准；本輪止於規劃 |

A可沿P0-4的12–19人日估算再加permit往返／量測的不確定範圍；B需額外處理多服務IAM、outbox／Tasks／Scheduler，暫估再加3–6人日。這是規劃估算，不是已量測承諾或承包報價；D0／D1後重新估算，授權等待時間另計。

## 方案A隔離環境與權限

- 獨立Cloudflare測試Worker與DO namespace／SQLite binding、service／alarm能力、secret設定與讀取受控log權；先核實帳號方案及region／資料位置限制。
- 權限限制於新ingress資源及需用服務，不給sponsor-worker／其DB／secret管理權；目前不需要正式sponsor憑證。若付款設定為帳號級，由持有人自行核准，不能因有部署權即推定可開通付費。
- 測試LINE頻道：由持有人透過安全介面配置新的Channel Secret與Access Token，可改**測試**Webhook／redelivery。不同環境不同origin密鑰與audience，不在Git／聊天貼值。
- 新GAS測試專案與合成Sheets：可編輯／隔離部署、查看實際Script ID／版本與執行紀錄，workbook僅測試資料；不匯入合成核准到正式表。GAS need-to-read發布ledger，外呼只允許測試控制API及明確限額來源。

## 方案B額外隔離環境與權限

- 獨立GCP project／Billing歸屬、指定region，Cloud Run public control與IAM-private dispatcher各有service account；min=0及max／concurrency經核准。control處理LINE／GAS驗證，dispatcher獨立避免callback死鎖。
- Firestore資料庫與交易／索引設定；應用service account僅具所需資料操作權，不持有廣泛project owner。Schema／quota全域document交易競爭需要量測；不能任意shard後宣稱仍是硬上限。
- Cloud Tasks enqueue／dispatch專用身分，僅授予對private dispatcher的invoker及必要queue能力；Scheduler只呼叫有IAM驗證的recovery route。Task重送視為至少一次，照ledger去重。
- Secret Manager指定secret版本讀取、Cloud Logging／Monitoring及必要告警設定；建置／image保存與registry權另核。若需新增第三個permit control服務隔離攻擊流量，重新計固定費、requests與IAM，不默默擴大本輪兩服務模型。
- Firestore outbox先同交易落地，再排Task；排程失敗保留pending供Scheduler恢復，不能在DB transaction內呼叫Cloud Tasks API。回復掃描若超過reply期限只標expired／告警，不任意重查或改push。

## 共同唯讀盤點與授權界線

正式資源只需另提供**唯讀**GAS全檔／manifest、Script ID／deployment／version／trigger清冊、已存在上游路由驗證方式及非敏感設定名稱；正式Sheets／發布清單如需核對，僅授予唯讀或去識別匯出。不得從Script ID推定有帳號權限，也不要求使用者貼API Token。

LINE／TDX／Google／Cloudflare帳號方案與當期餘額由持有人安全查看或提供移除識別資訊的官方證據。網路需要讀取官方價格／配額／schema文件與隔離API；此次CONNECT403不以提供Token解決，不自行改網路政策。

資料權限包括：短期加密raw event、replyToken與使用者位置的保存期、誰可解密、未決資料上限、tombstone／scope保留、備份與刪除。7天／1天／30天是成本模型與先前提案，不是已批准個資保存規範；核准前不能實際收正式事件。

## 成本與異常流量操作規格

核准書必須填入：billing account／方案、幣別、每月預算B、告警接收人、每日有效event／來源attempt上限、最大pending／storage、查詢deadline、原子quota窗口及可接受的服務降級。

建議預算告警先以B的50%／80%／100%作**待核准政策**，不是供應商hard cap；加edge可用的body／CPU／rate限制、Cloud Run max instances與Task dispatch上限、每key TDX原子attempt限制、log採樣／保留及storage GC。告警平台能力與通知費用亦須核實，沒有實際啟用。

kill switch需區分：停止新query／外部API、停止queue取件、入口改維護回應、必要時停用公開route／測試Webhook。維護回應如果無耐久接收仍ACK，可能丟事件；回503可能觸發redelivery增加請求量。先定政策與事件帳本，不能為壓費而靜默丟資料還宣稱可靠。

## 部署、監控及回復計畫

沿用[P0-3操作手冊](P0-3_DEPLOYMENT_RUNBOOK.md)，補以下成套版本：ingress／control／dispatcher版本、DO／Firestore schema及遷移、Tasks target／Scheduler、secret keyId、GAS實際version與候選SHA。DB變更採expand-contract，回復程式不刪ledger／permit／quota或撤銷已送出的LINE訊息。

監控：signature／origin／permit拒絕、duplicate／conflict、pending最老年齡、UNKNOWN_QUERY／UNKNOWN_REPLY、GAS quota／並行、TDX輪替／429／401、Maps fallback／daily、LINE400／429／5xx、DB交易retry、使用量／成本／logs／storage。日誌只留受控hash、kind、版本、狀態及耗時，不記原始body／userId／位置／secret。未經指示不建立外部告警或發訊息。

回復先停dispatcher、保留未決帳本與單一reply owner，恢復前一套相容的ingress＋GAS＋schema契約；新／舊sender不得同時工作。月quota／salt保留，要求重新選分類可以，但不能清帳本讓舊事件重做。舊無驗證GAS不是可接受的安全回復目標；應預先核准維護入口。成本rollback也需關掉未再需要的Tasks／Scheduler／log export等資源，不能只還原程式而持續計費。

## 必須先取得明確核准

1. 選A或B與剩餘公開GAS DoS風險；或要求另案強隔離平台，不擅自擴大架構。
2. 付費／免費方案資格、官方核價、region／幣別、每月預算與超額／停止服務策略。
3. 下一階段修改執行程式的開發範圍、permit替代Properties fence、query／reply拆分與quota政策。
4. 建立隔離雲端資源、啟用Billing、設定secret／service account、修改測試Webhook、真實隔離訊息／限額TDX與Maps測試。
5. 正式資料保存／備份／權限、GAS／LINE切換、正式部署／secret輪替或回復操作，全部另案以精確資源與版本核准。

本輪不要求即刻提供憑證或授權，不以可讀repo推定有雲端管理權。完成規劃後停止，等待架構及預算核准。
