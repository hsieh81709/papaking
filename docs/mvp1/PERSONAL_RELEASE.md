# 個人自用快速發布準備

2026-10-22（Asia/Taipei）。開發分支 `feature/flex-message-v2`，本輪基準 `747622c`。**本輪只離線修改、測試及打包；沒有部署、正式設定／資料寫入或Webhook變更。** 沿用現有GAS、LINE Bot及Google Sheets，不建立第二套環境，不需要Worker、DO、queue或獨立驗簽入口。

## 交付功能與資料邊界

停車1km、原TDX／NTPC／基隆、行車時間及導航維持原核心。臺北公園／既有遊具、三分類選單、Flex與同快照文字備援沿用。公園與雙北公廁3km／最多5筆／直線排序／跨市邊界及Maps代表位置導航保留。

**新北公園與雙北公廁未核准時仍不導航。** 搜尋程式接入完成不表示正式資料已核准；零核准顯示「尚無已核准發布資料」，不能宣稱城市導航已開放。原9筆正式座標不改、不因有效或A級自動核准；不執行B4-5。UNKNOWN不等於無設施或24小時。沒有本輪正式資料覆蓋率驗證。

## 個人模式最小實作

- `PK_WEBHOOK_MODE=personal-direct` 才接受LINE原始JSON；缺mode仍為原signed模式，origin secret缺漏不會自動降級。signed模式及原安全斷言保留。
- `PK_ALLOWED_LINE_USER_ID` 只接受單一 `U`＋32位hex字串。只處理 `source.type=user`、完全相同userId且無groupId／roomId的message。其他使用者、群組／room（即使本人在群內）、follow／其他類型在ledger、額度、Sheet查詢及回覆之前被忽略，不回覆「id」或錯誤訊息給他人。
- 啟用個人模式前，既有 `MONTHLY_BUDGET` 必須為正整數。原個人月quota、全域85%公共份額、白名單及salt不變。範例30代表未在白名單時全域最多25次、若另有更低個人quota仍適用；這是停車嘗試數上限，不是每日Maps／LINE／GAS費用保證。
- `PK_WEBHOOK_ENABLED=false` 可停止新版入口；缺值預設啟用，除字串true以外的已設值均拒絕。選填 `PK_LINE_CHANNEL` 可比對payload.destination（Bot userId），不是驗簽，也不是LINE numeric channel ID。
- 原事件去重、分類版本／10分鐘期限、ScriptLock、月額度／TDX持久保留、單事件一次主回覆及最多一次已知400同快照文字備援保留；未知交付不自動重做或push。
- 個人ledger使用固定namespace，不以未驗證的body.destination變動去重鍵。DONE事件在接收超過**660秒**後才GC；事件只允許過去600秒至未來60秒，因此被GC的原事件必然已過有效期。`>`邊界與未來60秒案例有測試。signed模式維持24h；RECEIVED／STARTED／UNKNOWN兩模式均不自動GC。
- 單值仍限32事件／16 scopes／7800 UTF-8 bytes，任一先到即拒絕，不清空帳本繞過限制。選單／分類／位置均算事件；正常完成者約11分鐘後逐步釋放，Rich fallback紀錄／未決事件可能更早塞滿。這是低頻自用候選，不是公開服務容量保證。

## 最小防護與不能消除的風險

**User ID allowlist不是LINE驗簽，也不能證明發訊者真的是本人。** GAS取不到LINE簽章標頭；個人直連模式沒有可信代理，知道允許ID的人可偽造source、eventId／timestamp／replyToken、消耗預算、干擾分類、污染帳本或觸發停車外呼。測試刻意重現「無簽章、偽造允許ID仍可查詢」，列為已知風險而非安全綠燈。destination／時間欄位也是未驗證輸入。660秒保留期的過期推論只針對原始timestamp不變的重送；偽造者可改時間或eventId再造事件，不能宣稱此模式具防惡意重播的驗證保證。

最小防護為：明確啟用模式、單一DM來源過濾、正月預算、body／batch／ledger容量限制、事件fence、短鎖、單次directions預算及緊急停用；不記raw位置／token。它們降低誤用與部分副作用，無法消除造假、匿名GAS執行資源DoS、帳本耗盡或LINE配額風險。Webhook URL與User ID不要公開，但保密不構成驗簽。

ContentService沒有可靠的自訂HTTP狀態介面；容量／配置／狀態失敗可能以HTTP200帶錯誤文字返回，LINE未必重送。空事件驗證回OK僅證明連通，不證明手機流程、權限或資料品質。極端崩潰／未知交付採少做不重做，可能沒有回覆；沒有exactly-once或零遺失保證。

若另有舊公開部署URL，它們不受新owner filter保護。所有writer需遵守相同quota協定，跨Script或其他服務共用key不在同ScriptLock範圍。個人直連是此輪明確產品選擇，不能對外宣稱「正式Webhook已可靠驗簽」。不再以建立第二環境作本次發布前提；改在另行核准的正式切換後由本人做有限手機smoke，風險須一併接受。

## 正式部署最少操作（本輪未執行）

1. **先備份、取本人ID。** 在目前Bot的一對一聊天室發 `id`，本人將回覆ID私下填入Script Properties，不貼Git／聊天。保存現有GAS全檔、manifest、部署對應及只涉及本次變更的Properties舊值，秘密存受控位置。保留目前版本7，不把P0-8附件假稱為version7 source。
2. **同一GAS一次更新六個serving檔。** 使用本輪發布包／來源hash：`程式碼.gs`←line_webhook、park_search_gas、facility_search_gas、facility_line_gas、webhook_security_gas、webhook_state_gas。原有名稱不同但內容對應時取代原檔，不同時留下第二個doPost或重複函式。維護用park_geocoding、B4-3、B4-5不覆蓋、不執行；manifest已相同，無須修改。
3. **同一次Properties儲存設定。** `PK_WEBHOOK_MODE=personal-direct`、`PK_ALLOWED_LINE_USER_ID=<本人ID>`；若既有MONTHLY_BUDGET已為合適正整數，保留原值，否則填本人核准的正上限。[範例](../../config/personal-script-properties.example.json)的30僅示例，不是提高既有預算的授權。保留LINE token、TDX_KEYS、PARK_SHEET_ID、QUOTA_SALT／quota及發布資料。若曾設PK_WEBHOOK_ENABLED=false，批准啟用時才改true；不需要origin secret或新增PK_LINE_CHANNEL。
4. **更新現有Web App部署。** 在「管理部署」編輯目前使用的deployment，選新建立版本，保留部署者／任何人與原部署URL；實際新版本號由GAS顯示，不假設一定8。LINE仍直連原URL，不新建Bot／Sheets、不改Webhook URL。記下候選Commit、hash、實際新version與切換時間。上述更新需使用者另行明確核准，不能由本輪自動執行。
5. **本人手機smoke一次。** 按下節執行，失敗停止新查詢、核對執行記錄，不反覆重送大量位置／消耗API。正式部署後才可能取得真實證據；本輪未執行。

如仍需把正式資料發布核准表加入少量公園／公廁，另列ID／指紋／座標／證據與人工決定，另案批准寫入；不在這五步順手核准或同步任何資料。可先發布停車、臺北公園與「新區域待核准」提示，不等待635筆全部完成。

## 本人手機冒煙測試（待核准部署後實測）

| 操作 | 預期及要保存的證據 |
|---|---|
| DM傳選單 | 三分類正常，記時間與實際GAS version；不保存token／個人原始位置到報告 |
| 停車→分享一次位置 | 1km結果／正確無結果或錯誤提示，Google Maps driving目的地；停車最多一次查詢，不連續重刷 |
| 公園→臺北現有遊具快捷鍵→分享位置 | 顯示已可用且符合條件的臺北公園或正確空結果；Flex可滑動、距離及代表位置導航正確 |
| 公園→雙北交界公開點 | 已核准的兩市點依3km距離排序；未核准新北點不得混入。若無新北核准，記「未開放」，不作新北成功導航驗收 |
| 公廁→分享公開點 | 僅已核准雙北資料；零核准應明確提示，不當作附近無廁所。UNKNOWN不得變成無／24h，入口未確認不得標入口 |
| 公園→停車／公廁→公園，返回選單 | 新分類優先、舊完成不清新選擇；未分類不默認停車。分類600秒後需重選，可於正常使用時確認一次 |
| 本人所在既有群組傳選單／位置 | 完全不回覆、不查詢、不扣額度；不需要新增帳號或Bot。不要把Webhook／ID分享給他人做破壞性測試 |
| Flex／備援 | 手機確認正常Flex與導航；400、timeout、重送／並行以離線故障注入為證，本輪不提供正式破壞性注入工具、不重播真replyToken |

本人帳號無法單獨在手機證實「不同使用者」拒絕，該項本輪為固定fixture離線證據；不因此建立第二帳號或新環境。手機回執各項填passed／failed／not_exercised，不能用一張選單畫面代替所有驗收。

## 版本7回復（計畫，未執行）

發生錯誤時，本人先停止新操作；新版仍運作時可在另行核准範圍設 `PK_WEBHOOK_ENABLED=false` 暫停。管理部署選回**原版本7**，維持同deployment URL及LINE URL；按備份只還原本輪改動的Properties，不清quota／salt／ledger、不回寫Sheets、不執行B4-5。記錄實際回復時間與一次原功能smoke。不要用P0-8附件重建一個「假版本7」。

**回復7會恢復7原本行為；舊程式不一定識別allowlist／停用旗標，也可能沒有新版去重、核准gate或備援。** 因此它不是安全等價回復。若使用者不接受恢復舊風險，應停用查詢並另行修正，不自動回復。恢復舊版與更改任何正式Properties亦須明確核准。

## 需要使用者明確核准的事項

- 接受個人直連無可靠LINE驗簽、可偽造允許ID、匿名資源／額度風險及容量／未知交付取捨。
- 批准精確候選Commit／六檔hash、在同一現有GAS更新程式／Properties／Web App版本；指定本人ID及正的月預算，不要求提供Token或密碼。
- 批准部署後本人有限手機smoke及外部停車／Maps呼叫；是否允許失敗時依上述風險回復7。
- 任何新增正式資料核准／Sheets寫入分開批准，不能用部署核准替代。

本輪沒有取得或行使上述正式操作權限。完整離線結果與修改清單見[測試回執](PERSONAL_RELEASE_TEST_RESULTS.md)；完成後停止等待核准。
