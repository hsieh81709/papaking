# P0-9 最小修復與發布阻擋

2026-10-22（Asia/Taipei）。分支 `feature/flex-message-v2`；起點 `51f5f524255ba958e48ac862a3c172b0dd47913f`。僅離線開發，不部署、不推送、不合併、不寫正式資料／Properties、不變更Webhook。公園／公廁資料不新增任何發布核准。

## 正式環境證據與manifest

使用者人工確認：Script ID、Web App version **7**、部署者執行、任何人可存取、LINE直接指向GAS。完整[人工紀錄](P0-9_DEPLOYMENT_RECORD.json)保留版本7為後續回復識別參考；未取得deployment ID／URL、版本7原始碼與hash，尚不能據此實際切換或宣稱回復安全。

使用者表示已取得appsscript.json並會在對話提供，但截至交付未收到JSON／附件；工作區只有repo的 `gas/appsscript.json`。**正式manifest逐欄差異待確認，沒有假定兩者相同。** repo manifest未修改，仍為Asia/Taipei、V8、STACKDRIVER、空dependencies、USER_DEPLOYING／ANYONE_ANONYMOUS。人工確認的執行／存取設定與repo欄位語義相符；時區、OAuth scopes（含未列scope的實際授權）、依賴與其他設定不能由此推定。獨立入口不需要給GAS新增LINE header權限；GAS沒有此能力。

[P0-8五份原始碼](P0-8_EXPORTED_GAS_REVIEW.md)仍只作相容性參考，未宣稱等同version7。本輪停止重試Google API，沒有真實LINE、TDX或Maps呼叫。

## 實作與沿用

| 檔案 | 內容 |
|---|---|
| gas/line_webhook_gas.js | doPost先驗origin envelope；有限batch全數持久接收、不截尾；事件claim後才處理；月額度及TDX分鐘預算鎖定／持久保留；回覆attempt記錄；去除LINE錯誤body log；公園次層既有遊具快捷鍵 |
| gas/facility_line_gas.js | 分類由Cache改為單值持久狀態；600秒、scope隔離、先原子消耗再query；失敗僅對同一版本恢復原期限；舊命令／位置不能覆蓋新分類；公廁Flex主體沿用 |
| gas/webhook_security_gas.js（新增） | audience／channel／原始payload／時效HMAC閘門；裸body、錯MAC、缺設定拒絕；signed acknowledgement |
| gas/webhook_state_gas.js（新增） | ScriptLock、單值快照、bounded event ledger、事件／回覆狀態；無位置、replyToken或原始使用者ID落盤 |
| line-ingress/handler.mjs（新增） | 獨立、未部署的Fetch API adapter：LINE原始bytes HMAC、body上限、channel、單次轉送、GAS signed ack；沒有DO／DB／queue／LINE sender／平台資源 |
| test/與CI | 新增P09安全與入口測試；舊fixture改經合成受信入口；原風險斷言改安全預期；blocking安全CI，不移除Worker或其他歷史測試 |

`park_search_gas.js`、`facility_search_gas.js`兩個搜尋引擎與manifest保持原樣。停車handleLocation／buildReply、1km、TDX解析／輪替、NTPC分頁／TWD97／Static Fallback、行車時間排序和導航不重寫。臺北遊具原intent重用，主選單三類不變。新北公園／雙北公廁仍通過來源指紋與人工核准gate，3km／5筆／跨市距離排序與導航沿用；UNKNOWN不改成無。

沒有修改sponsor-worker、park_geocoding、B4-3、B4-5、原始ODS／CSV或原9筆正式座標。原9筆並不因有效座標自動取得新核准。

## 最小入口與防繞過

路徑為 LINE → 獨立HTTPS驗簽入口 → GAS短效簽署envelope → 原搜尋／LINE回覆。GAS仍是唯一query及reply owner。獨立入口只持有LINE channel secret及獨立origin secret，不需要LINE access token；GAS只持有origin secret及既有出站憑證。

- LINE用原始UTF-8 bytes驗HMAC SHA-256／Base64；驗證後才JSON parse。重寫空白、emoji或內容會失敗。只接受POST／JSON、body 40,000 bytes及最多32事件；串流累加限制。超限不部分轉送。
- GAS設定規格：`PK_ORIGIN_SECRET`至少32字元、由安全隨機來源產生；`PK_ORIGIN_AUDIENCE`隔離／正式不同；`PK_LINE_CHANNEL`為LINE destination。只列規格，本輪沒有寫入設定。缺任一個就拒絕。
- envelope含 `v,aud,channel,issuedAt,nonce,payload,mac`；payload保留原字串。MAC固定序列為 `PK_REQUEST_V1\n`＋JSON.stringify([v,aud,channel,issuedAt,nonce,payload])。GAS要求issuedAt前後60秒內，且payload.destination與channel一致。nonce是請求／ACK綁定值，**不是獨立nonce耐久帳本**；業務重播由event ID帳本與事件時效阻擋。
- ACK的MAC使用不同domain：`PK_ACK_V1\n`＋JSON.stringify([v,nonce,status])。只有nonce／MAC正確且status=accepted才對LINE回200；GAS的HTML、普通HTTP200、拒絕或不可用均不是成功證據。accepted表示已接收／已有記錄，不代表使用者已收到結果。
- 轉送目標僅允許配置的script.google.com `/macros/s/.../exec`。只允許302／303轉到script.googleusercontent.com，再以GET讀結果、不重送envelope；結果仍驗ACK。8秒總轉送timeout，不自行重試；LINE平台重送由GAS帳本處理。
- 公開GAS裸body／偽造envelope離線驗證零query／零LINE傳送。**正式版本7仍是舊直連入口，本輪未修復正式資源。** 未來若同專案另有舊部署URL，它仍可能直打未驗簽handler，必須盤點並停用／限制舊入口才可宣稱整體防繞過成立；不可只保密新URL。
- 新版GAS拒絕業務繞過，但匿名請求仍會啟動GAS並消耗平台執行資源；薄入口不能提供GAS網路層隔離。剩餘DoS、secret失陷與舊部署可達風險沒有被宣稱消除。

沒有建立雲端資源或選定平台／預算。adapter可綁定已核准的可讀raw body／headers平台，不修改sponsor-worker，也沒有大型Worker＋DO原型。平台的限流、secret storage、redirect行為、CPU及日誌政策仍需確認。

## GAS內部可靠性邊界

事件、分類及版本保存在同一 `pk_state_v1` JSON值，短ScriptLock內讀、修改、寫及讀回確認，網路查詢／回覆不持鎖；每次狀態轉移是完整快照，沒有跨多key的偽交易。setter拋錯、讀回不一致、資料損壞或lock競爭時，禁止未記錄的新工作。真GAS單值／LockService持久性仍待隔離測試，VM不證明跨程序平台保證。

事件key為hash(channel,eventId)，語義hash含type、timestamp、source、message，物件鍵排序，排除replyToken和redelivery旗標。同ID重送不刷新分類、不再讀目前分類、不扣額度、不再query或reply；同ID內容衝突拒絕。缺ID／時間、超10分鐘舊事件、超60秒未來事件整批拒絕；首次redelivery不當成認證。原11事件正常fixture全數處理；超容量batch在副作用前拒絕。

事件狀態：RECEIVED → STARTED → DONE；未知為UNKNOWN。LINE每次primary／400 fallback前另存REPLY_STARTED，已知成功DELIVERED、已知拒絕REJECTED、5xx為UNKNOWN_REPLY；網路中斷保留UNKNOWN。400最多一次原快照文字備援，不重查、不改push；429／5xx／timeout不自動重送。DONE是handler終結，不是所有query或LINE投遞成功。

**崩潰／寫入不確定時選擇少做，不自動恢復工作。** RECEIVED／STARTED／UNKNOWN重送均不再執行；可能沒有查詢或使用者沒有回覆，需新操作／人工處理。沒有宣稱exactly-once、零遺失或自動重試。分類更新、quota與外部呼叫不是跨服務交易：event先fence，分類原子消耗，quota持久保留後才付費query。任何中途失敗不自動退款或重放舊event。

分類scope含DM／group／room＋conversation＋成員；消耗保留版本tombstone。舊完成不清新選擇，舊失敗不恢復已被新選擇消耗的分類；返回選單同樣留下版本界線。TTL從事件時間與接收時間較早者起600秒，延遲未見指令不能覆蓋較新選擇。

月額度保留原白名單、85%公共額度、群組userId與月界線政策；全域與個人計數同鎖下保留並讀回。多key若部分寫成功後失敗，拒絕query、保留已扣部分，可能多扣，不會冒稱交易rollback。TDX每把key固定分鐘計數持久化，Cache清空不重置；401／403／429輪替原邏輯保留。這不是rolling60秒限制，也沒有新增每日provider費用上限；跨Script ID／舊版writer共用key不受同一鎖保護。

## 容量與仍未解除的上線阻擋

硬上限：32事件、16個分類scope、7800 UTF-8 bytes，任一先到即拒絕。DONE保留24h後才GC；來源事件10分鐘之外永遠拒絕，因此不會在tombstone清除後當新工作。未決事件不自動刪除；scope在原期限後6h才GC。此方案刻意限制單值大小，**不是已滿足實際流量的正式儲存設計**。

合成單一scope連送menu：32個事件／回覆、6621 bytes；第33個拒絕。選分類＋位置至少兩事件，加選單／錯誤／多人會更早碰容量。這是可重現的安全准入上限，不是容量／性能驗收；使用者未核定流量，不可為上線直接加大、清空或刪UNKNOWN。

必須補齊：

1. 正式manifest JSON、實際deployment ID／URL、version7對應source/hash；完整舊部署與trigger清冊。版本7只作人工識別參考，不可當已驗證安全回復包。
2. 容量／保留期、同步8秒時限、實際Properties讀寫額度及並行的隔離量測；目前32事件方案很可能不適合公開正式流量。需先核定流量，若不合格另案提出最小擴充，不自行啟動DO。
3. 獨立入口平台、費用上限、限流／告警、origin secret儲存／輪替／撤銷與舊部署防繞過；公開GAS執行DoS殘餘風險需評估。
4. provider每日預算／共享key所有writer及舊月額度移轉協定；不能以月額度或固定分鐘限制替代每日成本控制。
5. 新北公園／雙北公廁小批人工核准資料及導航證據；未核准仍不提供導航。無任何本輪真實覆蓋率聲明。
6. 固定候選後完整歷史回歸、官方LINE格式驗證、隔離真GAS／LINE驗簽／重送／並行與手機導航；VM不能冒稱E2E。

[實際測試](P0-9_TEST_RESULTS.md)及[發布／回復手冊](P0-9_RELEASE_RUNBOOK.md)。完成後停止，正式操作另須明確核准。
