# MVP 1.0 精簡上線計畫（取代P0-4～P0-6原工作順序）

2026-10-21 UTC；工作分支 `feature/flex-message-v2`，本輪基準 `ed5259deff1a0a885258a147051d164f198cee76`。**本輪只調整計畫，不修改程式、資料、測試或部署。** P0-4／P0-5保留為風險與替代架構證據，不再以完成大型平台原型作MVP前置條件；repo原先沒有獨立P0-6實作計畫，本文件作為新的統一順序。

最短路徑：**核對實際正式版本 → 小改雙北公廁適配與提示 → 最小可信入口及GAS狀態修復 → 各類核准少量真實資料 → 一次完整回歸＋隔離LINE手機驗收 → 另案核准正式切換。** 功能與資料兩線並行，不等待635筆公園或全部公廁完成。

## 1. 實際盤點與不能推定的項目

本輪ls-remote並fetch確認：main=`734ace5702736dd069399b1188b4b122d4f5e2fe`、舊park-flex=`b3bb7c1cf7bc501a5d7c5b02073203c385fa52d8`、遠端v2=`e5bf54d`，本機v2=`ed5259d`。未推送、合併或變更任何遠端分支。

**main不是正式GAS的已證明副本。** 未取得正式GAS全檔／manifest、Script ID對應的deployment／version／trigger、實際LINE上游路由與設定；正式版本與本機的精確差異仍待唯讀匯出。不能用main標籤或使用者說「可用」取代部署證據。已可確認的Git差異：

| 比較 | 可核對結果 |
|---|---|
| main→本機v2 | `gas/` 8檔變更、1,283新增／310刪除；包括README與維護工具，不是應全包部署的清單 |
| main→v2 Webhook | 314新增／166刪除，含既有修正及UI／路由；**不是**只加三分類，也不能整檔盲覆蓋正式版 |
| main→v2 park_search | 86新增／41刪除，含雙北／發布gate等既有成果 |
| v2新增 serving模組 | facility_search 195行、facility_line 220行；main／舊park-flex皆沒有這兩檔 |
| manifest | main與本機無差異；不等於正式部署權限／設定一致 |
| runtime855f5f2→本機ed5259d | `gas/` 無差異，後續是報告與離線工具／測試；安全問題尚未修復 |

停車核心以**目前v2已修正版本**作保留基準；main到v2含歷史修正，不能聲稱它與正式版逐字不變。正式獨有的變更若發現，先做小範圍對照，不為縮短時程捨棄。

P0-2候選目前「先選分類再分享位置」，無分類／逾時位置不預設停車。正式舊版是否曾裸位置直接查停車需L0對照並告知操作差異；不為相容而偷偷恢復未知分類→停車的危險fallback。

## 2. 沿用範圍與真正缺口

| 功能 | 目前程式事實 | 精簡方案 |
|---|---|---|
| 停車 | 原handleLocation／buildReply、TDX／NTPC／基隆、1km、行車時間、導航與Static Fallback均在v2 | 不重寫解析、資料來源、排序／導航；只在入站、去重、額度與外呼保留attempt等安全邊界小改 |
| 臺北公園與遊具 | parkSearch_仍有全部／溜滑梯／鞦韆／共融篩選；只用可用設施證據，非臺北不套遊具條件 | 保留；使用「附近有溜滑梯的公園」「附近有鞦韆的公園」「附近共融公園」等現有parser可識別文字 |
| 公園操作入口 | P0-2主選單僅停車／公園／公廁；遊具文字可用但未直接列在三分類選單 | 僅在公園位置提示加次層quickReply，顯示臺北遊具篩選＋分享位置／返回，重用現有intent；不是開發新遊具種類 |
| 新北公園 | 已讀正式公園表、雙北同半徑排序，經來源指紋／人工發布核准；不讀候選導航 | 搜尋核心不需再接一套；優先核准既有可信正式座標子集，無核准則明確未開放。不能自動核准原9筆 |
| 新北公廁 | 24欄adapter、核准gate、3km／5筆、Flex／walking已完成 | 原流程沿用，資料核准獨立進行 |
| 臺北公廁 | getFacilityData_明確排除非新北，尚未接入 | 最小改為雙北白名單與明確城市適配，沿用同一24欄來源／核准／排序，不另建查詢引擎 |
| LINE圖卡 | buildParkFlexReply_與buildToiletFlexReply_已具名稱、區／地址、直線距離、導航與同快照文字備援 | 不重做Flex主題或整套card；只改涵蓋雙北的提示，保留UNKNOWN、代表位置與400一次備援 |

現有3km、最多5筆、距離升冪與ID同距離穩定排序、跨市邊界、walking URL、parkNavigationUrl_／facilityNavigationUrl_可重用。停車維持自己的driving，不強制共用設施搜尋。

臺北公廁的城市正規化只作白名單判斷／顯示，**不可先改來源row再算指紋**。保留原24欄v1指紋、全表ID唯一檢查、人工核准11欄。facilityNtpcPosition_目前矩形大致含雙北，但名稱／註解與gate用途需一起整理為支援城市的粗範圍，不能僅把城市字串放寬就宣稱行政區驗收完成。相同類別ID若跨市衝突先排除並審核，不擅自改ID或借另一市核准。

## 3. 最小必要安全修復：先不用DO／外部佇列

**優先驗證現有上游**是否能取得LINE原始bytes與signature header並正確驗簽；repo未有此證據，sponsor-worker是ECPay服務，不能當作LINE驗證入口。已有可信入口則直接補足origin保護；沒有才新增一個獨立、無狀態的驗簽轉送器。可用現有可讀headers的平台或單一Worker，**不含DO／SQLite／新queue／多服務dispatcher**，不修改sponsor-worker，平台與授權仍需批准。

GAS繼續作唯一query與LINE reply owner，沿用現有replyLine，不搬遷整套分類／Flex／回覆至入口。轉送器只驗LINE HMAC、限制body／時間，簽短效HMAC envelope至GAS；不自行query或寄LINE，也不在不確定timeout時自動重送。GAS doPost先驗audience／MAC／期限，拒絕原LINE裸body與未驗證呼叫，失敗不走舊router。

GAS新增**有上限的Properties事件帳本＋ScriptLock短臨界區**，Cache僅加速。最低設計要求：

- channel＋eventId耐久去重，語義hash排除replyToken／redelivery包裝；分類與位置皆去重。同事件重送不可刷新TTL、讀新分類或再扣額度；未知／缺ID不自動停車。
- claim事件、綁intentVersion、消耗／保留分類及quota在同一受控狀態轉移；舊完成不得刪新分類。TTL仍600秒、DM／群／room及成員隔離。
- **Properties不具多key transaction，僅加Lock不夠。** 實作小型write-ahead journal：外呼前先持久保存預定狀態與版本；在同ScriptLock下按序完成後值，所有writer進入前先恢復未決轉移。部分寫入失敗不准外呼；不能先clear pending再補quota或因失敗把已用額度退回。journal／單值／總容量皆需有明確上限與故障注入驗收。
- 外呼前標執行中；query／reply開始後未知，不因lease到期自動重做；replyLine的400同快照一次fallback仍保留，其他未知不再送。先記reply attempt再寄，接受極端crash可能沒有回覆而需新操作，不能承諾exactly-once。
- 每key TDX與每日provider attempt同樣持久保留及短鎖，不跨網路持鎖；月額度保留既有語義。每日應用上限與API上限由使用者核定，不能把月額度、Cache TTL或單次5候選當每日限制。
- 不再slice尾端後整體OK。有限合法batch全數有處理／持久結果；11事件基準不可丟尾項。超過已驗證的body／執行／容量限制時整批明確拒收，另測拒收契約，不以拒收取代正常11事件案例。

**這是低流量、有容量准入上限的方案，不是無限可用資料庫。** 在實作前先驗：所需去重保留期、最大未決／事件／scope數、journal尺寸與Properties讀寫配額、同步Webhook時限、鎖競爭、帳本滿時明確拒絕新query，以及跨部署所有writer遵守同一協定。不得刪未決記錄騰空、默認Cache miss放行或只記成功事件。

若小型狀態方案無法同時滿足保留期與核准流量、原11項安全行為或同步時限，則該方案**不通過、不能發布**；交付量測與失敗案例，再請使用者決定縮小流量或改採耐久平台。屆時才比較DO／其他儲存是否為最小補強，不自動恢復P0-5大型原型。要恢復其他平台需證明小型方案缺口與最少元件，而非因先前已寫過計畫。

公開GAS即使拒絕裸body仍會消耗GAS執行quota；薄代理也不能提供網路層origin隔離。此剩餘DoS風險與可用性取捨須明確核准，不能以URL保密、Referer或IP替代簽章。若要求強網路隔離，就不能把此精簡方案宣稱合格；另案評估受管認證的執行邊界。

## 4. 資料驗收獨立進行，不等全量

僅引用既有ODS盤點快照（非本輪正式Sheets讀回）：新北公園635筆、9筆有效正式座標；公廁新北3,976、臺北1,505，合計5,481筆唯一ID。公廁5,281待驗收、200待確認；有效粗框座標不等導航核准。來源SHA-256 `16d204f96d56e0d916fd7c414675ca77f1394cfb1eb20324f068f83f96ec444c`，統計見 `.local/mvp1-inventory-20261021/`，無新正式發布核准證據。

| 資料批次 | 首發最小做法 | 明確不做 |
|---|---|---|
| 臺北公園／遊具 | 保留既有可用正式基準及可用設施證據，驗來源ID join與原有文字篩選 | 不重核全臺北、不推造新北遊具 |
| 新北公園 | 優先對既有正式座標、名稱／地址／區、代表點證據逐筆批准小子集；原9筆保持不變 | 不用候選表直接導航、不把A級當核准、不執行B4-5補626筆 |
| 臺北公廁 | 先選同schema、ID唯一、名稱／區／地址完整、無整併疑義的少量記錄，人工確認位置／公共可進入性及證據 | 不因座標完整或放寬city就全量發布 |
| 新北公廁 | 同上，與臺北分批核准、分開統計 | 待確認／待人工整併不轉可用；UNKNOWN不等於無或24小時 |

每批至少記ID、來源版本／指紋、正式座標、代表類型、證據、核准人／日期與發布決定；原始來源值若需修正則獨立提出差異等待授權。可先交付離線核准候選CSV，只有使用者明確批准才配置正式發布清單，不把測試fixture匯入。

每個新城市／類別獨立列「總數／通過adapter數／人工核准數／搜尋可見數／測試點覆蓋」。零核准可先保留未開放提示，但**不能宣稱該城市功能已可導航上線**。首發可逐類別／地區開放已驗收子集；沒有全量不是阻擋，有疑義的資料保留待審，不降低gate。

## 5. 必須修改與不動的檔案

| 檔案 | 後續最小修改 |
|---|---|
| gas/facility_search_gas.js | 公廁雙北白名單／城市粗框適配；gate與導航校驗相應整理，保留24欄指紋與發布條件 |
| gas/facility_line_gas.js | 雙北公廁錯誤／空結果提示；分類state委派可靠狀態helper；公廁Flex主體不重寫 |
| gas/line_webhook_gas.js | 菜單／公園次層quickReply、雙北公廁提示；doPost驗envelope／event去重／全批契約、月／日與TDX attempt安全接縫；不重寫停車核心 |
| 新gas/webhook_security_gas.js | 僅origin envelope／驗證契約，GAS沒有讀LINE header能力，不偽裝在此直接驗LINE |
| 新gas/webhook_state_gas.js | bounded ledger、intent版本、quota／provider reservation、journal與ScriptLock；禁止越界後退回舊Cache安全模式 |
| 若無可用上游：新line-ingress/ | 單一raw-body驗簽轉送器；無DO、DB、queue、LINE sender或付費API查詢 |
| test/facilities、test/line、test/security-spec | 只新增／調整必要fixtures及安全adapter，不刪或弱化既有安全斷言 |
| docs／gas/README、必要CI清單 | 更新runtime必需檔與安全gate；manifest只在實際scope需要且另核准時修改 |

`park_search_gas.js`搜尋／遊具／距離核心預期不用改。保留其必需「公園設施」schema，不為首發另拆引擎。`park_geocoding`、B4-3／B4-5、`sponsor-worker`、原始ODS／CSV、正式9筆座標均不動。服務包只含必要runtime與安全helper，不部署整個gas目錄的維護工具。

## 6. 最小測試清單與執行時機

**開發期間只跑受影響模組；不為文件或局部提示改動反覆跑全套。** 新缺口先紅燈再修，不改斷言讓錯誤變綠。

| 修改範圍 | 開發當次測試 |
|---|---|
| 雙北公廁adapter | test/facilities：臺／台名稱判斷但來源指紋不改、兩市核准子集、第三市拒絕、跨市距離排序、缺核准／撤銷／重複ID／座標／UNKNOWN |
| 菜單／圖卡／提示 | test/line：三類與臺北遊具文字／quickReply、切換、TTL／scope隔離、雙北toilet Flex、Google Maps、無核准／無結果／資料錯誤、400一次fallback |
| 安全入口／state | test/security-spec與新增helper測試：R1–R10及C1、raw-byte HMAC／origin繞過、journal部分寫入／重啟／容量滿、reply未知不重送；不能只驗mock happy path |
| quota／TDX reservation接縫 | 只跑test/parking中相關quota／rate／401／429／budget案例；解析排序不動時不用每輪重跑全來源 |
| 公園原函式若確實修改 | 僅對應test/parks搜尋／遊具／發布gate；未改則留到發布前完整回歸 |

候選來源與首發資料manifest固定後，**正式發布前跑一次完整自動化回歸**：原436項（LINE62、公園170、設施77、停車72、Python來源33／審核22）全部保留，另含P0-3 preflight所有案例及11項安全規格、新功能測試，GAS語法、載入相依、diff／既有CI檢查一併完成；既有CI中的Worker測試照跑，不改其程式。P0-3舊風險刻畫需轉為安全斷言／adapter，保存舊TAP映射，不再要求危險行為出現才算通過。若完整回歸失敗、候選版再改或有新風險，修復後重跑受影響項與必要整合；「一次」不是忽略新變更或放行失敗的理由。

必要隔離／手機實測僅針對首發流程：

1. 真LINE簽章入口、GAS裸body拒絕；實際源碼hash／版本與設定一致；失敗不消耗provider。
2. 停車一次正常搜尋＋導航及可控備援；臺北一般公園與現有遊具入口；新北已核准公園；兩市各一個以上已核准公廁公開測試點。
3. 三分類切換／返回、過期重選、群／DM隔離；平台實際重送／有限並行不重查停車、不重送reply、不遺失新分類。
4. Flex官方格式驗證與手機顯示／Maps目的地；UNKNOWN不說無／24h、未知入口不標入口；零核准及格式錯誤提示不混淆。

需Cloud／LINE授權才能完成的項目保留「待驗」，不拿Node VM、官方schema200或可以開Maps連結冒稱正式端到端／資料核准。本輪只文檔核對，不重跑原436或11項紅燈，也未執行手機／API驗收。

## 7. 工作順序與每階段核准

| 階段 | 最短交付／順序 | 使用者需核准的事項 |
|---|---|---|
| L0 版本與入口 | 唯讀正式source／version／設定／上游路由對照；定首發流量、保留期與小型狀態容量出口 | 提供唯讀匯出／帳號授權；確認可接受的GAS剩餘DoS、未知不自動重做與流量上限，不要求Token貼聊天 |
| L1 功能小改 | 公廁雙北adapter、提示、公園次層遊具入口；受影響模組紅綠 | 下一階段離線程式修改範圍；不因此取得部署／資料寫入授權 |
| L2 安全小改 | 優先沿用驗證過的現有入口；否則薄轉送器＋bounded GAS狀態；11安全項與容量通過 | 若需新入口，核准平台／限額成本／secret規格；批准安全helper開發。未證實需要，不建DO或外部queue |
| D並行 資料子集 | L1／L2期間完成三個新增子集的唯讀審核／ID與指紋清冊；可分批 | 逐批明確人工發布決定；正式核准表配置／匯入另批准，不覆寫9筆或批次同步 |
| L3 發布前驗收 | 固定候選與資料清冊，完整自動化一次＋必要隔離LINE手機驗收；失敗就停止 | 隔離GAS／LINE測試頻道、測試Webhook／secret、限額外部API及公開點測試；不改正式Webhook |
| L4 正式切換 | 備份原source／版本／設定、列精確diff及回復目標、監控／kill switch；先發布已核准地區 | **另外明確批准**候選SHA、實際GAS版本、正式入口／Webhook切換、核准表寫入範圍及回復窗口；禁止順便合併main／部署維護模組 |

大型DO／Firestore／Tasks原型、把LINE投遞搬到新平台、全量635筆／5,481筆核准、遊具新種類、停車大重構均移出首發。本文件不批准任何下一階段實作或正式操作；完成後停止等待核准。
