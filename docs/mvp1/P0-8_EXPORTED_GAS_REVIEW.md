# P0-8 人工匯出GAS差異核對

核對日：2026-10-21（Asia/Taipei）。**五份附件的原始碼差異與受影響離線測試已完成；與實際正式部署的對應仍未完全驗證。** 本輪沒有Google API重試、正式函式執行、程式修改、Sheets寫入、Webhook變更或部署。

## 證據邊界與比較基準

收到5個程式檔，但沒有appsscript.json、部署ID／version清冊、目前LINE Webhook URL／上游設定、trigger或Script Properties配置。附件中的版本註解（如0.3.0／B3）不是Apps Script deployment version number。使用者指稱為正式匯出，仍無法區分目前編輯器HEAD與某個不可變部署版本，也不能證明這5檔就是完整專案。

本輪只對GitHub作唯讀ls-remote／fetch，固定兩個比較基準：

| 基準 | 實際SHA與範圍 |
|---|---|
| GitHub feature/flex-message-v2 | `329a79812b5d4e79d74084c2b2a15f2c4d955bac`，已從遠端取得；runtime為855f5f2，公廁只支援新北 |
| 本機同名分支 | `d4d6afffd719b01f1791cf2d60c06ccb43a80021`，另含P0-7臺北公廁適配；698a57c／d4d6aff尚未推送 |
| 使用者附件 | 各檔SHA-256及123個函式名稱／行號見[檔案清單](P0-8_EXPORTED_FILES.json)；與部署版本的關係待證 |

不是把本機P0-7當作GitHub既有成果，也不以GitHub main當成正式GAS。原檔保留於attachments與本地證據目錄，沒有將完整使用者source提交Git。

## 正式匯出檔案清單（僅限已提供檔案）

| 附件 → Git比對路徑 | bytes／行／函式 | SHA-256前12碼 | 實際用途 |
|---|---:|---|---|
| 程式碼.gs → gas/line_webhook_gas.js | 82,801／1,741／98 | 3df9f196861a | LINE路由、停車、來源／快取／配額、圖卡與傳送 |
| park_search_gas.txt → gas/park_search_gas.js | 14,786／351／17 | 53a4863db8ca | 公園／遊具、意圖Cache、文字與Flex；亦有Maps測試函式 |
| park_geocoding_gas.txt → gas/park_geocoding_gas.js | 6,784／239／2 | 6b2d59d8c5b6 | **B3候選座標批次寫入**及候選唯讀盤點；不是Git同名品質稽核模組 |
| park_b43_regeocode.txt → gas/park_b43_regeocode_gas.js | 3,584／64／1 | 74a162a3311f | 4個固定公園重新定位，寫品質檢核L:O |
| park_b45_sync.txt → gas/park_b45_sync_gas.js | 5,908／103／5 | 15c93e7f86cc | 4個固定ID的預覽／正式座標提升；含正式表寫入 |

完整hash保留原始bytes（含CRLF）；比較時只解UTF-8及統一換行，不忽略實質文字。指定秘密樣式／credential assignment檢視未發現金鑰或Token；不代表任意秘密格式皆能偵測。source含工作簿識別註記，未把它當成憑證、實際設定值或部署證據。

5檔皆通過Node語法檢查，不代表已核對GAS runtime或OAuth scope。沒有載入／執行任何地理編碼批次、B4-3或B4-5函式。

## 已確認的既有功能邏輯

| 功能 | 附件證據 | 與候選差異／限制 |
|---|---|---|
| 停車路徑 | 程式碼.gs doPost:178 → handleLocation:285 → consumeQuota／buildReply → replyLine | 未選公園的location直接走停車；Git候選改為先選類別，逾時／未知不默認停車，需告知操作差異 |
| 停車資料與排序 | 1km、TDX路邊／路外、NTPC分頁／TWD97、基隆資料、最多3路段＋2場站行車時間、Google driving導航 | 大部分資料核心可重用，但匯出與候選有可重現契約差異，不能聲稱停車整檔相同 |
| 臺北公園 | parkSearch_:52讀公園資料／公園設施，座標有效＋可用，Haversine、3km、距離排序、最多5 | 語意存在且合成資料可執行；未接實際正式Sheets、不能認定實際覆蓋或導航已驗收 |
| 遊具 | parkIntentFromText_:11辨識溜滑梯／鞦韆／共融；讀指定可查詢遊具欄位 | 附件不檢查設施狀態、同ID取最後列、共融只作substring；合成「非共融」也會中。候選已有排除／合併修正，不應退回 |
| 公園Flex | buildParkFlexReply_:165輸出carousel與Maps search URL | 不是walking dir URL，也不證明入口；有Flex而非需從零開發。純Flex被LINE400拒收時無文字備援 |
| 菜單 | 程式碼.gs:150為公園／3遊具＋停車分享位置共5項 | Git候選為停車／公園／公廁3類；原遊具文字保留，但次層遊具quickReply仍待補 |
| 新北公園 | parkSearch_沒有城市限制／人工發布清單，只看可用與座標 | 註解寫「未納入」不能作功能阻擋。合成新北可用列無核准表仍可被搜尋，需加候選發布gate |
| 公廁 | 這5份附件未見公廁adapter／router／結果Flex實作 | 不推測其他未提供檔案；Git有facility_search＋facility_line，本機P0-7才含臺北來源契約 |

## 檔案與函式差異

完整函式對照CSV見[P0-8_FUNCTION_DIFF.csv](P0-8_FUNCTION_DIFF.csv)。函式區塊是統一換行後逐字比較，**不是AST語意等價判斷**；全檔常數／全域配置另經diff與測試檢查。

| 匯出 vs 本機d4d6aff | 結果 |
|---|---|
| Webhook | 70個函式區塊相同、26個不同、2個僅附件、8個僅本機。handleLocation包裝及多數TDX／Maps／導航函式可重用；buildReply主要為log詞彙差異，但快取／解析／quota等相依有實質修正 |
| park_search | 5個區塊相同、9個不同、3個僅附件、3個僅本機；資料核准、意圖隔離、品質與導航不是只換UI |
| geocoding | 附件2函式與Git同名檔11個品質稽核helper／入口不重合；**不能整檔互相覆蓋** |
| B4-3 | 附件預設即Maps查詢並寫L:O；Git為預設預覽／另有確認契約。附件found字典不能真正檢出來源表同ID重複的後列 |
| B4-5 | 僅表頭檢查函式區塊相同；附件沒有Git的確認fingerprint、寫前備份／journal與rollback；部分寫入失敗只能拋錯，並非交易回復 |

GitHub329a798與本機的5個對應檔，除Webhook菜單公廁文字外內容一致；主要新增P0-7差異在facility_search的臺北來源適配與facility_line提示，兩檔附件未提供。CSV分github／local記錄，避免混淆。

B3只新增候選（待確認），不直接寫公園正式坐標；B4-3寫修正候選，仍待人工；B4-5則可寫正式緯經度／可用／備註。這些維護程式的存在不能證明已執行，也不代表任何座標已取得新發布核准。本輪全數未執行。

## Webhook及資料安全

附件doPost未讀webhookEventId／isRedelivery、無LINE簽章或origin驗證。SHA-256 intent key不是HMAC簽章。**因manifest及上游路由缺失，不能確定端點公開權限或外部是否已有驗簽**；可證實的是這個handler本身會接受未帶簽章的合成payload。

18項離線現況刻畫包含5項既有行為、13項風險重現，詳見[測試報告](P0-8_EXPORTED_TEST_RESULTS.md)：

- 同人DM與group共用intent key；回選單未清意圖；Cache過期／遺失與已消耗公園位置的重送可能轉查停車。
- 重複location會再次停車，無耐久event claim；query／reply／月額度及key限速仍有並行風險。
- 超過10事件截尾仍OK；公園讀表失敗只log／ACK、無正確使用者錯誤提示。
- 公園無發布gate／唯一ID排除；設施品質與共融文字有誤判風險；純Flex400無fallback、空結果重讀兩次。
- 停車合成契約測試另發現位置與外部錯誤log可洩漏origin、配額寫失敗／群組及跨月邊界等差異。這些不是上線後監控可取代的測試。

本機P0-7已修正部分UI／資料gate，但原11項安全紅燈仍未修復；不是直接部署開發分支就解決所有入口／重送／並行問題。最小安全方案按P0-6先查可信上游，必要時薄驗簽轉送器＋origin保護＋有界GAS耐久狀態，不啟動DO大型原型。

## 結論與下一步

附件足以釐清核心流程與最小整合接縫，但**不構成已部署版本／資料／手機端驗收**。受影響測試為候選135全過；附件對現有停車契約52 pass／20 fail；風險刻畫18 pass不能當安全綠燈。沒有執行完整歷史回歸或正式API。

下一步先補manifest、目前Web App部署ID→version、對應version source／hash與LINE上游設定的唯讀匯出，不需密碼或Token。之後按[最小整合與回復計畫](P0-8_MINIMAL_INTEGRATION.md)，只對必要serving檔與安全接縫提patch，維護模組另案保存、資料分批核准，完成隔離驗收後再請求正式切換核准。本輪停止於報告，未推送或修改執行程式。
