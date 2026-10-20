# Google Apps Script 版本

無伺服器實作的 LINE Bot，完全免費託管。

## 🚀 部署步驟

1. 前往 [Google Apps Script](https://script.google.com)
2. 建立新專案
3. 將 `line_webhook_gas.js` 的內容貼上
4. 在「專案設定 > 指令碼屬性」新增以下屬性（**不要寫進程式碼**，會隨原始碼外流）：

   | 屬性名稱 | 值 |
   |---|---|
   | `LINE_CHANNEL_ACCESS_TOKEN` | LINE Developers Console 的 Channel access token |
   | `TDX_KEYS` | TDX 金鑰陣列，JSON 格式：`[{"id":"...","secret":"..."}]` |

   選填：`MONTHLY_QUOTA`（每人每月次數）、`MONTHLY_BUDGET`（所有人每月合計，一般使用者只用到 85%，15% 留給白名單）、`QUOTA_WHITELIST`（逗號分隔 LINE userId，對 Bot 傳「id」可查）。沒設就不限。

   `TDX_KEYS` 可放多把。基礎會員每把 5 次/分，程式依本分鐘用量挑用得最少的一把；撞到 429（頻率上限）或 401/403（金鑰失效）會自動換下一把，全部用滿時回覆使用者稍後再試。
5. 部署為 Web App（執行身分：我，存取權：任何人）

   > ⚠️ 這個端點不做請求驗證。Apps Script 的 `doPost(e)` 讀不到 HTTP 標頭，
   > 拿不到 `X-Line-Signature`，所以 LINE 官方的簽章驗證在 GAS 上做不到。
   > 任何知道 Web App URL 的人都能觸發查詢並消耗你的 TDX 與 Maps 配額。
6. 複製 Web App URL
7. 在 LINE Developers Console 設定 Webhook URL

## 📝 主要功能

- `doPost()` - 接收 LINE Webhook 事件
- `handleLocation()` - 處理位置訊息
- `parseOnStreet()` / `renderOnStreet()` - 路邊停車格：解析 TDX 回應、排版文字與 Flex 卡片
- `parseParking()` / `renderParking()` - 停車場：合併 TDX、市府、Google 三個來源後去重、排版
- `calculateDistance()` - 計算距離
- `rankSections()` / `driveTimesBatch()` - 兩段各自依直線排序，最近的 3 個路段加 2 個停車場的開車時間一批併發問 Google 地圖 RPC 後重排（同起點格到同終點快取 30 分鐘；RPC 失敗退回內建 DirectionFinder）
- `navLink()` - 產生 Google Maps 開車導航連結（不吃配額）
- `buildReply()` - 兩個 TDX NearBy 用 `UrlFetchApp.fetchAll` 併發，再組回覆
- `ntpcCarparksNear()` - 新北市路外停車場改走新北開放資料（剩餘車位每次查詢重抓，不快取），座標由 TWD97 換算
- `nearbyCached()` / `nearbyStore()` - TDX 兩個 NearBy 的靜態結果按 110m 格子快取 6 小時，命中時省下那兩次進階 API 呼叫（CacheService 可能提前逐出，命中不是保證）；靜態資料最多延遲 6 小時才看到 TDX 的增刪；剩餘位不在這份資料裡，不受影響

## 🗂️ 資料來源

| 資料              | 來源                                                     | 備註                                     |
|-------------------|----------------------------------------------------------|------------------------------------------|
| 路邊停車格、路段  | TDX `Parking/OnStreet`                                   | 全國                                     |
| 路外停車場        | TDX `Parking/OffStreet/CarPark/NearBy`                   | 新北市、基隆市只有台鐵等業者自行上傳的場站 |
| 新北路外停車場    | 新北開放資料 `b1464ef0-…`（靜態）、`e09b35a5-…`（剩餘）  | 只含領有登記證的場站，私營臨停場不在內   |
| 基隆路外停車場    | 基隆市政府 CSV（22 座公有，Big5）、交通局即時頁（HTML）  | CSV 無座標，地址 geocode 後存屬性 30 天（條款上限）再重查；即時頁靠名稱比對 |
| 開車時間、縣市    | Apps Script 內建 `Maps` 服務                             | 見下方配額                               |
| 私營路外停車場    | Google 地圖搜尋 RPC（無金鑰、非公開介面，**預設關閉**）  | 只有名稱、地址、座標、營業時間；欄位位置可能無預警改變，失效時靜默退回不顯示 |

## ⚠️ Google Maps 配額

`Maps` 服務不用 API key，但一般 Gmail 帳號每日上限約 1,000 次 directions、1,000 次 geocoding。一次位置查詢最多 5 次 directions（3 路段 + 2 停車場）加最多 1 次 geocoding，約 200 次查詢會用完當日 directions 配額；用完後開車時間靜默退回直線距離，只有執行記錄會有「開車時間查詢失敗」。

## 🔎 Google 地圖搜尋（第三來源）

TDX 與市府資料都沒有私營場站（歐特儀、Times、嘟嘟房）。`GOOGLE_PLACES_ENABLED` 開啟後會用 Google 地圖網頁版的搜尋 RPC 補進來，
每筆末尾標「ℹ️ 來源 Google」，與官方資料以「50m 內，或 300m 內且名稱互含」去重，官方那筆優先。
這不是官方 API：沒有配額保證，回應格式一改就靜默失效（執行記錄會有「回空清單」）。
啟用前先在編輯器執行 `testGooglePlaces()`，確認 Apps Script 的出口打得到並印出場站名單。

## 🔧 測試

在 Apps Script 編輯器執行：
```javascript
testFull()  // 完整測試
testConfig()  // 驗證設定
testNearbyCache()  // 同一座標查兩次，第二次 TDX 應命中格子快取
```

## 📚 詳細文件

完整部署指南與技術說明：
https://www.notion.so/2a37a24cf64081dcbc11c8948ad10337

## 公園座標品質與同步驗證

離線測試：在專案根目錄執行 `node --test test/parks/*.test.mjs`。
品質分級與唯讀工具、安全同步／備份／回復步驟見 [操作指引](../docs/parks/runbook.md)；
正式資料存取限制、版本盤點與實際驗收結果見 [驗收紀錄](../docs/parks/acceptance.md)。
B4-3 現在預設為唯讀預覽；B4-5 正式同步必須傳入本次使用者明確確認的 ID 與預覽 fingerprint。


## PK-04～PK-07 回歸與隔離診斷

回選單會取消當前使用者／對話的公園條件；重新選擇公園仍能保存新條件。公園Flex被LINE 400拒收時，最多嘗試一次同批結果的文字備援；200、429、500與不確定的網路失敗不自動重送。

`testPapaKingLiveParkingV2()` 的設定契約已加嚴。它只應在**另一個隔離GAS測試專案**執行；目前沒有對正式GAS執行。需要 Script Properties：

| 屬性 | 值與意義 |
|---|---|
| `PAPAKING_TEST_ENVIRONMENT` | `isolated`；只是呼叫者聲明，不能代替核對真正script ID |
| `PAPAKING_TEST_COMMIT` | 40位來源commit SHA；需另外比對來源，函式不會自動核實Git |
| `PAPAKING_TEST_GAS_VERSION` | 隔離專案的正整數版本號；需另外核對版本對照 |
| `PAPAKING_TEST_POINT_ID` | 英文字母起始的公開fixture標籤（英數／底線／連字號，最多80字元），不要放個人位置或座標 |
| `PAPAKING_TEST_LAT`／`PAPAKING_TEST_LON` | 公開測試點的十進位台灣座標；診斷回執不寫原始座標 |
| `PAPAKING_TEST_EXPECTATION` | `cards`（預設，至少一張有效卡）；`static-fallback`（必須命中無導航Static卡）；`empty`（必須同時有明確路邊／停車場無結果文字，不能是錯誤或任意空內容） |

回執會記錄時間、實際script ID、填入的來源／版本、fixture標籤、觀察數量及各斷言 `passed`／`not_exercised`。明確空結果回 `PASS_EMPTY_RESULT`，不會把卡片／配色標為已驗證。來源／版本仍為外部填入，LINE schema、訊息投遞及Sheets寫入一律不會因此被標記完成。設定 `isolated` 並不是技術沙盒，執行者仍須核對測試專案、帳號與測試資源。

CI與完整測試紀錄見 [PK04-07驗證紀錄](../docs/verification/PK04-07.md)。執行根目錄 `node --test test/parks/*.test.mjs`；Worker在其目錄執行 `npm ci`、`npm test`。GitHub Actions只用合成資料，不部署、不執行remote schema、不需要正式Google／LINE／綠界憑證。
