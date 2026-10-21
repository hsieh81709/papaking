# P0-7 精簡實作第一階段

2026-10-21 UTC，分支 `feature/flex-message-v2`；基準329a798。**臺北公廁適配與雙北提示完成離線驗收；正式GAS核對缺授權，沒有新增資料發布核准，仍不可正式上線。**

## 前置推送

329a798只有6個預期規劃文件，開始工作區乾淨。遠端為e5bf54d，是329a798的祖先；本次快轉包含中間的P0-5文件Commit ed5259d，整個出去的範圍均為文件。核對private key／GitHub token／Google API key／OAuth token／literal Bearer指定樣式零命中，並檢查變更範圍。掃描不保證偵測所有未知秘密格式。

已正常推送 `329a798:refs/heads/feature/flex-message-v2`，輸出 `e5bf54d..329a798`，再次ls-remote確認完整SHA `329a79812b5d4e79d74084c2b2a15f2c4d955bac`；沒有force或歷史覆寫。本輪新測試／實作Commit沒有包含在該推送中。

## 任務A：正式GAS唯讀核對受阻

本輪檢查可用工具及憑證**存在性**：無Google／LINE connector，指定Google／LINE憑證環境變數皆無值，沒有本機clasp綁定、標準clasp／gcloud認證檔。未讀取或輸出憑證內容。這只描述目前執行環境，不宣稱整個使用者帳號沒有其他授權。

因此未呼叫正式API，未匯出正式source／manifest／deployments，未讀LINE現行Webhook設定，也未核對正式上游代理。**不是本輪測出Google HTTP403或證明正式版沒有驗簽。** main、附件park_geocoding或已知Script ID都不能代替實際部署來源。

| 要確認的事 | Git候選可證實 | 正式環境狀態 |
|---|---|---|
| 停車執行路徑 | doPost→handlePapaKingMessage_→handleLocation→consumeQuota／buildReply→replyLine | 待正式source與版本對照 |
| 臺北公園／遊具 | 同router→buildParkFlexReply_→parkSearch_；保留可用正式基準與既有設施文字篩選 | 待正式表／路由／版本對照 |
| 公廁 | router→buildToiletFlexReply_→toiletSearch_→adapter／核准→3km排序→導航 | 尚無部署／手機證據 |
| Webhook安全 | 候選doPost無LINE簽章與耐久event去重，manifest匿名公開 | 正式是否另有可信上游未知，不能猜測 |

所需**最小唯讀條件**，可擇一提供，不必逐一執行GAS函式：

1. 由持有人提供完整GAS source＋appsscript manifest、目前deployment／version對照與實際入口清冊的唯讀匯出；或在安全授權介面給指定專案查看權，依API需求使用 `https://www.googleapis.com/auth/script.projects.readonly` 與 `https://www.googleapis.com/auth/script.deployments.readonly`，讀取project content／指定version與部署資料。此階段不需要部署或Sheets寫入權。
2. 維護者從LINE Console提供現行Webhook URL、啟用／redelivery設定與任何上游驗簽／轉送設定的遮罩匯出即可；不必把Access Token或Channel Secret交到聊天。若需檢查trigger，由持有人提供唯讀清冊，不安裝診斷trigger。
3. 原始碼若含敏感設定留在受控位置，報告遮罩，不提交Git。匯出只讀不執行source，不部署，不覆寫專案。正式可導航資料核對若另需要，再給工作簿唯讀或穩定匯出；不是本次adapter完成的前提。

## 任務B：實際格式與來源

本輪直接唯讀重讀《PapaKing 生活設施資料庫.ods》，不是僅相信舊README或假設官方CSV欄位。SHA-256：`16d204f96d56e0d916fd7c414675ca77f1394cfb1eb20324f068f83f96ec444c`，讀前／後相同，未執行公式或巨集。

[欄位與來源收據](P0-7_SOURCE_SCHEMA.json)記錄完整24欄、5,481筆唯一ID、零重複ID、公廁表零公式，與既有canonical schema一致。

| ODS實際資料 | 臺北 | 新北 |
|---|---:|---:|
| 筆數 | 1,505 | 3,976 |
| 資料來源ID | TP_TOILET | MOENV_NTPC_TOILET |
| 待驗收／待確認 | 1,451／54 | 3,830／146 |
| 待人工整併 | 54 | 146 |
| 缺行政區 | 148 | 0 |
| 經緯度儲存 | 全部字串 | 字串／數值混合 |
| 每筆來源網址空白 | 1,505 | 3,976 |

ODS「資料來源」列將TP_TOILET標為「臺北市公廁點位資訊」、臺北市政府、CSV，資料集頁為 `https://data.taipei/dataset/detail?id=ca205b54-a06f-4d84-894c-d6ab5079ce79`；新北標為環境部「建檔公廁明細－新北市」，頁面 `https://data.moenv.gov.tw/dataset/detail/FAC_P_21`。這些是**ODS內的來源註記**，本輪未下載官方CSV／獨立認證其時效。下載／API及授權條款欄空白，也不能用資料集頁取代逐點定位證據。

適配的是已取得的工作簿24欄格式，不宣稱原始官方CSV也有同樣24欄。ODS沒有「設施發布核准」分頁；座標格式或資料來源ID都不是發布核准。

## 最小實作

- `facilityToiletCity_`：新增臺北TP_TOILET契約，接受「臺北市／台北市」，僅將輸出的city正規化；不改來源row、ID或v1指紋。未知臺北來源／其他城市拒絕，既有新北來源契約保持相容。
- `facilityTwinCityPosition_`：把原有相同矩形粗框命名為雙北；保留facilityNtpcPosition_相容wrapper，邊界數值沒有放寬。粗框不等行政區或入口驗收。
- getFacilityData_沿用原24欄、全表ID唯一、狀態、整併與人工核准gate，兩市一起進原3km／5筆／穩定距離排序。臺北缺區、待確認、待人工整併及壞座標仍排除；不自動補欄或轉可用。
- 原toiletSearch_、buildToiletFlexReply_、walking導航與同結果文字fallback重用；只將選單與地區未開放提示改為「雙北（臺北／新北）」已核准資料。

原7個指紋／發布／排序／導航保護函式逐函式內容不變；Webhook只有buildPapaKingQuickMenu_文字變動，其餘103個既有函式不變；facility_line只有facilityEmptyMessage_提示變動，其餘14個函式不變，含分類狀態、renderer與reply流程。

**沒有新增Script Properties、發布表、核准／同步程式或正式資料。** 以真實ODS全部5,481列在記憶體VM讀取，缺核准表時adapter及搜尋皆0，寫入0；沒有為真實ID生成測試核准。正向fixture全為SYNTHETIC名稱／ID與合成核准，沒有提交真實公廁資料列。

## 測試、檔案與回復

測試先行Commit：`698a57c`。新增26個公廁及6個LINE案例，既有測試檔／斷言完全未改。結果與命令見[P0-7測試紀錄](P0-7_TEST_RESULTS.md)：最終受影響221項全過，不代表全套回歸或線上驗收。

執行程式僅改 `gas/facility_search_gas.js`、`gas/facility_line_gas.js`、`gas/line_webhook_gas.js`；新增 `test/facilities/taipei.test.mjs`、合成fixture及 `test/line/taipei-toilet.test.mjs`。另更新gas/README與現況導引、兩份報告及schema收據。實作Commit與完整diff見本輪 `.local/mvp1-p07-20261021/FINAL_RECEIPT.json`／`P0-7.diff`。

未改park_search、park_geocoding、B4-3／B4-5、appsscript manifest、sponsor-worker與正式來源。若撤回本輪，另建revert同時撤回P0-7實作與698a57c測試，不用reset／force；只在開發分支操作。Git revert不等於正式GAS回復，本輪並未部署。

## 上線阻擋與下一階段

1. 原11項安全紅燈檔案與斷言未改，**未修復／本輪未重跑**。正式簽章入口、origin防繞過、去重／並行／quota與batch截斷仍需按精簡計畫修復；不因本輪221綠而放行。不啟動Worker＋DO原型。
2. 正式GAS／LINE來源與設定對照缺唯讀權限；正式表新核准數與實際覆蓋未知。本輪ODS缺核准清單，不能宣稱兩市公廁已開放導航。
3. 下一步最小工作：取得唯讀來源／入口清冊；並行人工驗收少量臺北／新北公廁與新北公園，補位置／開放限制證據及明確發布決定。未知開放時間不顯示24小時，樓層／入口未核不得推定可達。
4. 後續另核准薄驗簽入口與bounded GAS狀態修復；公園次層遊具quickReply本輪未新增，原文字查詢保留。最後固定候選／資料清冊，執行一次完整回歸、官方LINE格式及必要手機／隔離端對端，再提正式部署／切換計畫。

本輪沒有Google Sheets真實寫入驗證、正式GAS執行、LINE官方schema API、真實投遞或手機驗收。完成後停止，等待下一階段核准。
