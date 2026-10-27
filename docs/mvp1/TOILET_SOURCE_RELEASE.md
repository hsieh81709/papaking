# 雙北公廁來源發布候選

2026-10-27（Asia/Taipei）。基準 `feature/flex-message-v2` / `ee61939e44ce10a5b586544d711c4ea6914b6e8a`，開始時工作樹乾淨。本輪僅離線開發及測試，不部署、不改正式 Sheets／核准紀錄／LINE Webhook／Script Properties。

## 版本與現行契約核對

正式版本8與候選ee61939的連結證據：先前使用者本機SHA核對Mismatch=0、clasp推送10檔、建立版本8、將原部署更新至@8，以及使用者本輪確認核心功能手機驗收通過。這些是人工操作紀錄；本輪無可用Google授權連線，沒有重新取得版本8不可變原始碼或最新Sheets，不能宣稱本輪已讀回正式程式、證明其現在仍完全相同。

公廁仍讀 `公廁資料` 原24欄；臺北 `TP_TOILET` 與臺／台正規化、新北原來源規則不變。原版公廁僅經 `facilityReleaseFor_` 取得人工核准才發布；缺少 `設施發布核准` 時索引為空，故之前零公廁。人工核准綁定全部24欄來源指紋、座標、驗收、核准決定、審核人、日期、HTTPS證據及代表類型；單純資料狀態可用不能代替核准。

## 本輪最小修改

執行程式只改 `gas/facility_search_gas.js`、`gas/facility_line_gas.js`。

- `getFacilityData_` 保留ID唯一、基本文字、來源／縣市、有限數字與雙北粗略座標範圍檢查，先保留合格人工核准；沒有任何該公廁審核紀錄才允許新的來源路徑。
- 來源路徑僅接受 `待驗收`、`保留獨立`／`自動整併`；拒絕待確認、待人工確認、停用、其他狀態、缺必要文字、異常座標、重複ID。仍沿用嚴格數字語法，拒絕boolean、空值、NaN／Infinity、hex、逗號或混雜字元，轉換為Number後才導航。
- 必要基本欄位為ID、縣市、名稱、地址、來源ID；行政區可為空字串，已有地址時不額外推定行政區。實際快照119筆臺北待驗收資料行政區空白，本次依使用者核准條件允許以地址顯示。原人工核准路徑仍保留原本行政區檢查；24個表頭仍全數必要。
- `facilityToiletReleaseIndex_` 僅供公廁；保留所有出現過的key，重複值設為null。撤銷、待審、不完整、來源指紋失效或重複人工紀錄都阻止來源備援，避免默默繞過已有的人工決定。這是保守的優先規則：已有紀錄就需先處理其問題，不自動降級為未驗證發布。
- 人工結果 `publicationSource=human-verified`，保留原 `publication`；來源結果 `publicationSource=source-unverified`、`publication=null`、`positionType=未知`，另有 `sourceRelease`，不冒充人工證明，也不寫回任何狀態。
- `facilityNavigationUrl_` 新增公廁專用來源分支，重新檢查來源快照條件、24欄指紋、投影名稱／ID／縣市／地址／行政區、來源狀態與座標一致；來源或投影變動就拒絕。這是可信伺服器內部一致性檢查，不是密碼學授權或對外可用的簽章憑證。唯一ID在讀表時驗證，外部不可直接傳入任意物件建立導航。
- Flex及同快照文字顯示「位置未經人工驗證，導航點可能不是入口」；人工核准顯示「位置已人工確認」，仍不推定入口或現場開放。UNKNOWN保持未確認。
- 公廁空結果文案改為「符合發布條件」，不再把所有可搜尋公廁稱為已核准。Flex footer仍為標準contents陣列，未來可加錯誤回報按鈕；本輪沒有建立回報端點、按鈕或寫入資料回報紀錄。
- 新北公園不使用來源分支。`facilityReleaseIndex_`、`facilityReleaseFor_`、`facilityParkPublication_`、共用指紋函式及原導航人工證明分支逐段與ee61939相同；`park_search_gas.js`、停車核心、User ID限制、事件去重、額度、manifest、sponsor-worker、park_geocoding與維護同步檔皆未修改。

## 真實匯出快照：前後差異

本輪實際可讀取的是先前使用者提供的 `PapaKing 生活設施資料庫 (1).ods`（SHA-256 `9c185f67d334fd26f427c5c3d221b6dd7f7779aaf1e56f82c27010e4d93ca81d`），不是本輪重新提供或認證的XLSX／最新正式Sheets。讀取先前保留的typed ODS `tables.json`，全24欄保留；來源雜湊及統計見[結果JSON](TOILET_SOURCE_RELEASE_RESULTS.json)。沒有重新地理編碼或修改原始檔。候選對全體資料離線投影，不代表每次查詢都回傳所有資料。

| 城市 | 總數 | 原規則可搜尋 | 新規則可搜尋 | 排除 |
|---|---:|---:|---:|---:|
| 臺北 | 1505 | 0 | 1451 | 54 |
| 新北 | 3976 | 0 | 3830 | 146 |
| 合計 | 5481 | 0 | 5281 | 200 |

200筆都是 `資料狀態=待確認` 且 `整併狀態=待人工確認`，同一批資料，不能重複計為400筆。沒有缺漏／重複公廁ID；所有座標符合目前粗略範圍，但不等於真實位置正確、行政區邊界或入口驗證。臺北1505筆緯／經度均為字串；新北2500筆數值、1476筆字串。可發布5281筆均投影為有限Number，導航目的地逐筆一致。

快照沒有設施發布核准表，故沒有可確認的真實人工核准公廁；已核准保留／撤銷／失效優先規則以固定合成fixtures驗證。實際正式表是否在匯出後新增人工核准，本輪無法確認，不宣稱不存在。

重跑（以既有ODS唯讀匯入的typed tables JSON作輸入）：

```sh
node tools/audit-toilet-source-release.mjs .local/production-release-attempt-20261022/current-ods/tables.json > .local/toilet-source-release-20261027/snapshot-report.json
```

工具對ee61939及本次程式各執行一次真實來源投影，並對每筆可搜尋資料驗證導航；來源資料只在本機模擬Sheets讀取。逐筆差異及200筆排除CSV留在 `.local/toilet-source-release-20261027/toilet-publication-diff.csv`、`toilet-excluded.csv`，不將正式資料匯出加入Git。

## 測試證據及政策斷言更新

開發前新增28項固定案例，先得到22 pass／6 fail（`before.tap`）。修正測試載入完整Flex theme、增加行政區空白案例後，對舊ee61939重放29項，22 pass／7 fail，見[舊版失敗證據](../verification/toilet-source-release-before.tap)。提交的TAP僅移除行尾空白，原始輸出留在本機.local。新規則完成後29項全過，沒有以mock搜尋替代資料適配。

既有零公廁政策測試依本輪明確授權更新：正向案例改驗未驗證標籤、獨立來源metadata與導航；禁止案例改用待確認資料，保留零導航、錯誤與回覆次數斷言。原整個facility_search檔案不可變測試不再適用，改為公園檔／manifest不變加上公園核准、原導航分支等逐段不變。沒有刪除安全規格或停車／公園案例。

| 執行 | 結果 |
|---|---:|
| 受影響公廁／LINE／personal／preflight | 259／259 |
| 完成程式後完整Node回歸一次 | 563／563 |
| 公園來源工具Python | 33／33 |
| 人工審核工具Python | 22／22 |
| 原Worker離線測試 | 25／25（未修改Worker） |
| 完整合計 | 643／643，零失敗／跳過 |

643是原613加29個來源發布案例、1個公園逐段不變案例；259是子集，不重複加總。包含原已知偽造owner ID風險刻畫，不代表已可靠驗簽。完整命令與本次收據見[測試紀錄](TOILET_SOURCE_RELEASE_TESTS.json)。原始logs在 `.local/toilet-source-release-20261027/`。

[Flex合成範例](examples/TOILET_SOURCE_UNVERIFIED_FLEX.json)使用固定合成臺北公廁，不是真實公廁或正式API回應。導航範例：`https://www.google.com/maps/dir/?api=1&destination=25.0001%2C121.46&travelmode=walking`。來源／人工混合資料各自標籤、3km含邊界／超界、最多5筆／跨市排序、指紋與目的地異動、raw row不可導航、未知設施、Flex fallback、個人限制、新北公園核准皆有斷言。正式GAS／LINE格式官方驗證／手機導航本輪未實測。

## 下一版發布與回復（未執行，等使用者核准）

要讓正式Bot使用新政策，需要更新版本8；本輪**沒有更新**。無新增Script Properties、工作表、核准清單或付費服務。

1. 核准本輪Commit後，先用本機clasp在空資料夾 `clone-script <原Script ID> 8` 備份不可變版本8，保存原部署ID／URL／部署者／任何人設定及Properties私有備份。先核對最新HEAD沒有其他未備份變更，不以舊ee61939檔案假稱最新正式讀回。
2. 只把 `facility_search_gas.js`、`facility_line_gas.js` 複製到原完整clasp工作資料夾，覆蓋同名檔。保留其餘7個JS、manifest及.clasp.json；**不可只用兩檔建一個push根目錄**，clasp push會替換專案檔案集合。
3. SHA核對、`clasp.cmd show-file-status` 應仍為9JS＋manifest、`clasp.cmd list-deployments` 應仍是原正式ID@8。確認後 `clasp.cmd push`，`clasp.cmd create-version "PapaKing toilet source release <本輪Commit>"`。
4. 用實際新版本號 `clasp.cmd update-deployment "AKfycbynBSSZFDAnlofWK8neIDH28KMjYVSIn5wGO6v92YGW7bQ1kpMe0kU01mKyIVSsKE3W" --versionNumber <實際版本號>`；不假定一定9。確認同ID／URL／執行身分／存取權限，不變更LINE Webhook。
5. 本人手機各測一次臺北／新北公廁Flex、未驗證標籤、導航、分類切換、停車與臺北公園；新北公園仍不得自動發布。200筆不應因新路徑進入結果。快照筆數不直接當最新正式發布筆數。
6. 失敗時將**原部署**切回8：`clasp.cmd update-deployment "AKfycbynBSSZFDAnlofWK8neIDH28KMjYVSIn5wGO6v92YGW7bQ1kpMe0kU01mKyIVSsKE3W" --versionNumber 8`。本輪不改Properties／Sheets；版本回復不會自動恢復它們或編輯器HEAD，勿覆蓋其他資料。本輪本機可用git revert本輪Commit回復，不重寫歷史。

仍有個人直連無可靠簽章驗證、偽造owner及匿名資源耗用風險，沿用先前已接受範圍；本次寬鬆座標可能落在代表點而非入口、營業／樓層／設施可能未知，故不隱藏標籤、不宣稱人工核准。完成本輪後停止，等待下一版部署核准。
