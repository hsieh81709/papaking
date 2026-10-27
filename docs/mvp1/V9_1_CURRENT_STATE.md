# V9.1 P0 現況盤點

2026-10-27（Asia/Taipei）。僅分析及文件；程式基準為 `feature/flex-message-v2`／`fb069a71a2040131c042e812e64332370ccb1294`，起始工作樹乾淨。本輪不修改執行程式、正式GAS、Sheets、Rich Menu或Webhook，不建立版本或部署。

## 正式基準與證據界線

正式版本9的證據是本對話使用者本機clasp輸出：`create-version`回9、原部署更新@9，`list-deployments`再次列@9／`PapaKing toilet source release fb069a7`。原部署ID：`AKfycbynBSSZFDAnlofWK8neIDH28KMjYVSIn5wGO6v92YGW7bQ1kpMe0kU01mKyIVSsKE3W`；@HEAD那筆不作正式版本證據。

先前準備包六檔與候選逐位元組一致，版本8附件加兩個公廁替換檔已核對。**本輪未從Google重新讀回不可變版本9、目前部署或Properties；沒有V9新公廁手機驗收回報。** 不把使用者clasp紀錄、離線測試或V8手機驗收混成V9全功能線上驗收。

| 能力 | 實作／離線證據 | 正式部署／手機證據 |
|---|---|---|
| 停車／臺北公園與遊具／雙北公廁搜尋 | 六檔整合；既有完整643項離線測試，前次準備349項通過 | 使用者確認部署9；本輪無手機新證據 |
| 公廁未驗證發布 | `getFacilityData_`、`facilityToiletSource_`、`facilityNavigationUrl_`；獨立source-unverified標記 | 快照1451＋3830，排除200；非最新Sheets讀回 |
| Rich Menu | `gas/`、`tools/`無richmenu建立／圖片上傳／綁定工具 | LINE端是否已有手動選單未知，無API讀取 |
| Quick Reply／位置 | 已實作三分類與location action | 沿用V9；新六格尚未製作 |
| postback | 入口、安全過濾、事件hash皆未完整支援 | 不可直接加按鈕就認定可用 |
| 設施回報 | 快照有九欄空工作表；無回報writer／流程 | 未實作、未寫入／驗收 |

## Webhook及路由

| 路徑 | 實際檔案／函式 | 行為與V9.1影響 |
|---|---|---|
| GAS入口 | `gas/line_webhook_gas.js:doPost` | verify→授權過濾→接受／啟動事件→message分流→DONE／UNKNOWN |
| 本人限制 | `gas/webhook_security_gas.js:papaKingAuthorizedEvents_` | personal-direct只留本人一對一**message**；postback目前在此被丟掉 |
| 文字 | `gas/facility_line_gas.js:handlePapaKingMessage_`、`facilityCommand_` | 選單／分類／未知；`id`在doPost另處理。新使用說明／回報文字需在未知分類前攔截 |
| Quick Reply | `line_webhook_gas.js:buildPapaKingQuickMenu_` | 三個message action；主文仍稱公廁「已核准」，與V9來源發布政策不符，需最小文案修正 |
| 位置 | `buildPapaKingLocationPrompt_`、`handlePapaKingMessage_` | location Quick Reply；分享後驗座標、600秒意圖、原子消耗；未選類別不默認停車 |
| 事件去重 | `gas/webhook_state_gas.js:papaKingAcceptEvents_`、`papaKingEventHash_` | 事件ID＋來源／message等hash；hash**未納入postback.data**，接受驗證也只特別檢查message的replyToken |
| 意圖隔離 | `remember/peek/take/restoreFacilityIntent_` | 同scope、版本及選取時間；使用說明／回報／傳位置不能意外改成unknown或清除搜尋分類 |
| 回覆／備援 | `replyLine`、`papaKingBeginReply_` | 一次主回覆；已知400才一次同快照文字備援，未知交付不重送查詢 |

本輪只讀mock探查（無程式變更／正式呼叫）：本人postback通過授權數=0；只改postback.data時事件hash不變。證據 `.local/v9_1-p0-20261027/READONLY_FINDINGS.json`。因此P1須同時修正三層：本人事件類型白名單、postback輸入/hash契約、doPost實際派送，不能只加handler。

## 六格Rich Menu最小可重用路徑

| 格位 | 建議action | V9重用／新增 |
|---|---|---|
| 附近停車 | message `停車查詢` | 現有分類完全符合 |
| 附近公園 | message `附近公園` | 現有分類／臺北遊具Quick Reply |
| 附近公廁 | message `附近公廁` | 現有雙北公廁 |
| 傳送位置 | message `傳送位置` | 新小型處理器先peek意圖，再回location Quick Reply；無／過期分類請先選，不重設TTL |
| 問題回報 | message `問題回報` | 新引導，先選最近搜尋卡片的設施；不可猜ID或直接寫表 |
| 使用說明 | message `使用說明` | 新唯讀說明；保留當前分類，不走unknown |

位置action原本用於Quick Reply，**本設計不把location action直接放Rich Menu**；格位只送文字，再讓本人按分享位置。Rich Menu不攜帶座標、不建第二Webhook或GAS。六格可全用message action；真正postback需求來自回報按鈕。

圖片建議採2500×1686、3欄×2列，JPEG／PNG、保守控制1MB以下，避免文字貼邊；各熱區整數座標完整覆蓋且不重疊。這些是既有常用規格／設計建議，**最新可接受尺寸、檔案上限、action與API限制尚未重新驗證**。先製作離線JSON與圖片模板，不操作LINE。

2026-10-27嘗試以下官方文件均遇代理 `Tunnel connection failed: 403 Forbidden`（CONNECT層，沒有來源HTTP回應，非LINE拒絕Token或來源404），已停止，不反覆查詢：

- https://developers.line.biz/en/docs/messaging-api/using-rich-menus/
- https://developers.line.biz/en/reference/messaging-api/#create-rich-menu
- https://developers.line.biz/en/docs/messaging-api/actions/#location-action

未來啟用順序：先讀取／保存既有選單及本人綁定→建立新選單→上傳圖片→取得JSON／圖片確認→只綁本人→手機驗收；回復則重新綁原本人選單或解除本人綁定讓既有預設生效。預設選單與OA Manager選單優先關係須在實際帳號核對；不先刪舊圖、不設全域預設。Channel access token須屬同一Messaging API channel，且操作者有管理權；現有Token是否可管理Rich Menu未實測。本人綁定不等於驗簽，也不放寬Webhook本人限制。

## Flex、圖示與樓層

| 類別 | 產生函式 | 現況與最小設計 |
|---|---|---|
| 停車／路邊 | `flexBubble`、`buildFlexCarousel`、`renderParking`、`renderOnStreet` | 主色#1976D2；header加🅿️，不改1km／行車排序或導航。NTPC_STATIC仍是無座標資訊卡 |
| 公園 | `park_search_gas.js:buildParkFlexReply_`、`formatParkReply_` | 自訂bubble，不經flexBubble；標題前🌳，保留距離／代表位置及遊具提示，不重寫成共用renderer |
| 公廁 | `facility_line_gas.js:buildToiletFlexReply_`、`toiletResultLines_`、`formatToiletReply_` | 主色#00838F；標題前🚻，完整保留人工／未驗證標籤與導航檢查 |

`PAPAKING_FLEX_THEMES`公園綠#43A047，但實際公園renderer仍硬編碼#227A4C；P1保留各自現色，不順手統一。emoji只作文字前綴，保留中文名稱與altText，不能靠顏色或emoji作唯一辨識。

公廁主表沒有「樓層」欄；`進入限制`混合樓層／入口描述，目前整串顯示。明細表有樓層及入口，但P1不新增join。只從明確`樓層:`／`樓層：`片段抽取「所在樓層：2F／B1」；其餘保留「進入限制」。空值／UNKNOWN顯示「所在樓層：未確認」，不可推成1F／可搭電梯；多樓層原樣列出、不猜唯一入口。只改投影顯示，來源／指紋不正規化或寫回。

## 回報資料與ID缺口

已提供ODS的 `資料回報紀錄`：`回報ID、回報時間、設施類型、設施ID、問題類型、問題說明、處理狀態、處理時間、備註`，0筆。此為快照，不是本輪最新正式欄位驗證。`park_b45_sync_gas.js`有鎖／setValues／journal，但它是正式公園同步，不可呼叫或挪用它的業務流程；只借鑑短鎖與寫後確認模式。現有`replyLine`可重用，沒有專用postback／回報工具。

公園／公廁搜尋結果有ID與來源指紋；停車資料不同：TDX路邊有segId但renderer未傳進card；TDX路外parseParking未保留原UID，NTPC／基隆／Google等混合來源亦未形成統一ID。不能只把card.title當ID，或宣稱已有三類穩定官方ID。P1先加薄的**顯示結果身分metadata**：有原來源ID時保留source namespace＋native ID；缺來源ID則建立明確標記`obs:<opaque-id>`的當次顯示觀測ID，帶名稱／來源／設施座標快照供人工查核，不能當官方ID或用於修改設施。去重勝出來源不變、不以新增ID改搜尋或排序。

## 正式前仍待確認

最新Rich Menu／本人綁定、目前Token與管理權限、官方圖片/API規格、正式回報表九欄及寫入授權、版本9實際檔案／設定、V9公廁手機成果。現有直連GAS無可靠驗簽、允許ID可偽造的剩餘風險仍在；新增寫表使影響從查詢擴及垃圾回報，必須本人限制＋限流＋配額＋輸入驗證且不得對外稱已認證。
