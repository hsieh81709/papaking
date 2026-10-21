# P0-4 根因、修復界線與失敗證據

基準fbd1abe／runtime855f5f2；2026-10-21 UTC。新測試 `test/security-spec/release-gates.test.mjs` 採安全預期，實跑**11項失敗、0通過、0skip，exit 1**。P0-3的10項風險刻畫仍保留，不將刻畫PASS當安全修復。

| 風險 | 根因／實際程式證據 | 影響 | 修復前安全斷言失敗 | 修復方案與驗收條件 | 無法保證的情境 |
|---|---|---|---|---|---|
| R1 P0 | webhook `doPost`不讀eventId；text每次重寫intent | 重查TDX／Maps、額度與reply再嘗試 | parking實際2次，預期1 | channel＋eventId耐久唯一鍵；分類與位置都去重；重送不可改intent或重新發工作 | ledger到期／遺失或operator強制新事件不能宣稱永久去重 |
| R2 P0 | 位置與intent只靠當下Cache，無已處理事件與分類版本綁定 | 舊位置轉查新類別、耗掉新選擇 | 實際parking,toilet；預期只有parking且新toilet待用 | 先查event ledger再讀intent；新工作綁intentVersion；舊位置不再消耗，fresh L2才可查toilet | 首次收到但延遲的舊事件需watermark策略，不能推定網路有序 |
| R3 P0 | 查詢例外保留分類，無durable failed記錄，doPost仍OK | 重送盲目重查／使用者以為處理完成 | 同event query實際2次，預期1 | 記failed-safe／unknown；重送同ID不重開query；新位置才是新嘗試；ACK只代表持久接收 | provider執行後斷線，不知道是否已耗額；不能安全自動重查 |
| R4 P0 | 公廁peek後先query、之後才clear，沒有原子claim | 同事件兩次搜尋／LINE回覆嘗試 | toilet2次，預期1 | transaction claim event＋分類快照；network在transaction外；重複claim只看狀態 | worker在外部呼叫時被中斷，租約不能自動證明它沒執行 |
| R5 P0 | 停車先clear但peek與clear仍分離 | 兩個執行都已讀到同intent | parking2次，預期1 | 事件、scope消耗與月額度reservation同交易；GAS job執行fence | 線上實際Lock／DB一致性仍需隔離併發驗收 |
| R6 P0 | `clearFacilityIntent_` get與remove非CAS | 舊完成刪掉新分類，提示誤成expired | 實際expired，預期park | 完成僅更新綁定版本；新分類版本不刪；DB conditional update | 不合作的舊部署仍寫Cache／同資料時無法保證 |
| R7 P1 | `rememberFacilityIntent_` marker與main各put一次 | 切換遺失、unknown；目前fail closed | 實際unknown，預期較新的park | 單筆完整intent紀錄＋scope序號交易，Cache只讀取快取 | Cache全逐出可能多一次讀取；storage故障需停查，不能假裝無結果 |
| R8 P0 | ANYONE_ANONYMOUS；doPost不驗證入站；GAS契約無signature header | 外部偽造、成本與狀態污染 | 未簽章body觸發parking1次，預期0query／0LINE | raw-body HMAC入口＋GAS envelope防繞過；錯簽章／origin直打均零副作用 | secret洩漏、平台帳號被入侵不由HMAC本身解決 |
| R9 P0 | `consumeQuota` Properties get/check/set無鎖 | 兩次放行只記一次，可能超過月上限 | 兩次准入但total1，預期2 | 邏輯額度與工作claim同耐久交易；啟動後不確定不退額；測邊界不超額 | 系統外其他專案消耗供應商帳號額度，不等於應用counter可見 |
| R10 P1 | `events.slice(0,MAX_EVENTS)`後整體OK | 第11事件永久遺失，無局部回執 | 處理10，預期11 | ingress有限body內全批入帳後ACK，依序分派單事件job；無法持久接收整批時不ACK成功 | 超過body／儲存限制仍會拒收；需上游重送與告警，不保證永遠可用 |
| C1 P0新增 | `pickTDXKey` Cache getAll/put無鎖，逐出後從0計 | 同key分鐘限制漏計，突發429 | 兩次key grant僅counter1，預期2 | GAS持久provider reservation＋ScriptLock；每次實際嘗試都扣，採保守rolling window；Cache僅鏡像 | 外部系統共用金鑰、供應商計數差異不能保證零429 |

測試中的重入hook是確定的交錯模型，不是真正Google並行。R1／R5／R8以停車delegate計數，不連接TDX；R9使用真實consumeQuota程式與mock Properties；C1使用真實pickTDXKey與mock Cache。失敗皆為 `ERR_ASSERTION`，不是缺函式、測試載入或網路錯誤。原始TAP保存在 `.local/mvp1-p04-20261021/security-red.tap`。

## 額度與副作用盤點

| 現有控制 | 真正範圍／限制 | 下一階段要求 |
|---|---|---|
| MONTHLY_QUOTA／MONTHLY_BUDGET | 每月個人／全域（Asia/Taipei）；一般人85%、白名單保留；0或未設不限；Properties非原子 | 保留既有政策語義，transaction reservation；切換時安全移轉計數與鹽，不重設額度 |
| 每日查詢限制 | **沒有應用層每日使用者／全域counter** | 先核定政策、時區、limits；新增規格不代表已啟用；不得以月額度或Google每日配額代替 |
| TDX_RATE_LIMIT=5 | 每key／本分鐘，Cache可逐出且並行漏計；401/403/429／token失敗會輪替 | 每次TDX endpoint嘗試、fetchAll每slot、fallback／輪替各算；token endpoint另記，不能都算一個query |
| DRIVE_TIME_BUDGET=5 | 每次GAS執行的候選directions預算；RPC失敗會改DirectionFinder，兩個外部attempt都可能耗費 | 額外做來源別API attempt reservation，RPC、fallback分別扣；保持直線距離備援，不以預算不足報附近無停車 |
| Cache／NTPC失敗旗標 | 節流與30分鐘／6小時查詢快取，不是耐久預算 | 維持原快取語義；single-flight可降低stampede，不能把節省量視為已保證 |
| Google／TDX／GAS配額 | 供應商帳號／方案限制，會變動；本輪未取得官方最新授權與限制 | 隔離環境讀取當前方案；應用設保守上限與告警，不宣稱可精準還原供應商帳單 |

停車一次使用者query可能呼叫：TDX token與兩個NearBy、輪替／重試、NTPC分頁與即時來源、基隆資料與地址定位、反查縣市、Google RPC、DirectionFinder、LINE reply及400 fallback。讀取型API也有費用／頻率副作用；同event重做並非免費。`GOOGLE_PLACES_ENABLED=false`不表示DRIVE_TIME_RPC_ENABLED也關閉（目前為true）。

現有sponsor-worker是ECPay callback→D1→LINE push，自己的CheckMac／push retry key不等於LINE Webhook HMAC／reply去重；沒有證據它是三分類上游。repo沒有可證實的LINE驗證proxy。實際正式Webhook URL、上游路由、GAS版本與登入權限仍待唯讀清冊，不能由repo推定全線上拓撲。
