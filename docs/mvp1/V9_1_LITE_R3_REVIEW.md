# PapaKing V9.1 Lite R3 離線整合驗收

2026-10-28（Asia/Taipei）。**F1、F2、F3已於隔離候選關閉；原回歸643／643、Lite測試29／29，合計672通過，0 fail／skip。可提交審閱並整合開發分支，不代表正式發布或手機驗收完成。**

## 基準與工作範圍

原專案 `feature/flex-message-v2`／4880cbe，正式V9程式基準fb069a7。原專案工作樹保持乾淨且HEAD不變。改動全部位於獨立本機clone `/tmp/papaking-v9_1-lite-r3-20261028`、分支 `review/v9_1-lite-r3`；這不是另一個GAS／LINE專案。

正式版本9的依據仍為使用者先前clasp輸出，本輪未讀回Google服務、未修改原V9工作樹、正式Sheets／Properties／Webhook／Rich Menu，未執行clasp push、建立版本或部署。GAS候選只有三個執行檔變更：line_webhook、park_search、facility_line。沒有自由文字回報、postback或Sheets writer。

最新R2審查 `.local/v9_1-lite-r2-review-20261028/REVIEW.md`、R2原ZIP及原測試均先讀取；未修改原附件。保留R2唯讀產物規劃、非空輸出拒絕、全部預檢後才輸出、before/after SHA與二次transform驗證。產物目錄僅含三份候選JS、diff、receipt，**不是完整GAS部署目錄，禁止直接以它作clasp push根目錄**。

## 修正說明

### F1-1：可靠定位公園卡片

`test/parks/mvp.test.mjs`不再以無emoji標題尋找卡片，而以原合成設施導航目的地 `25.041,121.5`定位，先assert卡片存在，再驗證標題**精確**為「🌳 新北合成園」。原未知設施、不顯示溜滑梯或無設施斷言保留；同套件原導航代表點、核准、遊具、範圍與邊界案例也保留。沒有刪掉／skip原測試。

### F1-2：明確允許唯一呈現差異

`test/preflight/bundle.test.mjs`以fb069a7的完整park_search為基準，只允許唯一已知標題錨點增加🌳，然後**比較整份檔案其餘所有位元組完全相同**。不是寬鬆regex忽略所有renderer，更不是刪除不可變保護；搜尋、座標、距離、排序、遊具、導航與核准仍一併受保護。manifest仍與歷史基準全檔一致，並新增facility_search／webhook_security／webhook_state與fb069a7全檔一致的斷言。原720種六檔載入、全域重名與公園人工核准分支保護繼續執行。

### F2：四象限與action精確成對驗證

`test/verify_lite.py`新增固定矩形陣列：

| 順序／位置 | bounds x,y,width,height | message |
|---|---|---|
| 左上 | 0,0,1250,843 | 停車查詢 |
| 右上 | 1250,0,1250,843 | 附近公園 |
| 左下 | 0,843,1250,843 | 附近公廁 |
| 右下 | 1250,843,1250,843 | 使用說明 |

每個area先驗整數非bool，再以固定象限與已知action精確比較。保留正尺寸、邊界、重疊、完整覆蓋、PNG存在／解碼／尺寸／暫定檔案上限；不使用可被python -O移除的assert作發布閘門。

新增負向案例涵蓋兩組熱區交換、錯象限、重疊、超界、負／零尺寸、boolean、缺格、錯指令、缺圖、損壞、尺寸不符、超檔案限制。保留R2四項工具案例與字型備援探查；CLI在python -O下亦通過有效圖檢查。

### F3：實際主選單與help政策同步

原實際V9主選單的「公廁提供雙北（臺北／新北）已核准資料。」已明確改為：

> 公廁提供雙北符合發布條件的資料，部分位置尚未完成逐筆人工驗證；實際入口及開放狀況請依現場資訊確認。

主選單與help使用完全相同的核准文案；R3規劃器對已知V9文案作唯一匹配、對完整R3狀態no-op、未知或重複文案拒絕，不盲目覆寫。另支援已知R2 help升級為R3；實際fb069a7產物須與候選檔案完全相同，R3二次產物須byte-identical。

公廁Flex原「位置未經人工驗證，導航點可能不是入口」與開放／入口提示保留，沒有改facility_search或任何發布、座標、導航檢查。相關空結果本來已稱符合發布條件，因此不用改。主選單三分類Quick Reply保留，四格Rich Menu只是額外文字入口。

首次完整回歸另發現既有「三分類選單」測試要求字面含「新北」，而使用者新文案為「雙北」。已保存初次562 pass／1 fail輸出，將該測試改為驗證公園雙北描述及**完整指定公廁文案**，三分類／無新增遊具選項斷言不變，原測試數不變。這是文案契約對齊，不放寬資料發布。

## 實際測試結果及失敗證據

| 套件 | 通過 | fail | skip |
|---|---:|---:|---:|
| 原Node回歸 | 563 | 0 | 0 |
| 原公園來源Python | 33 | 0 | 0 |
| 原人工審核Python | 22 | 0 | 0 |
| 原Worker | 25 | 0 | 0 |
| **原643合計** | **643** | **0** | **0** |
| Lite工具Python（R2原4＋R3新增18） | 22 | 0 | 0 |
| 新R3 UX／Flex／help Node | 7 | 0 | 0 |
| **全部合計** | **672** | **0** | **0** |

沒有移除原案例或將失敗改成skip。原643仍包含既有允許ID偽造風險刻畫，不把此pass稱為可靠LINE驗簽。Lite29是原643之外的套件，不混入643的分母。

測試先失敗再修正：保留R2原643回歸641 pass／2 fail；新工具修正前20項中2 fail、UX7項中2 fail；R3首次原Node562 pass／1 fail亦保留。修正後全部通過。所有原始log與receipt留在原專案Git忽略的 `.local/v9_1-lite-r3-20261028/`，完整結果見 `V9_1_LITE_R3_TEST_RESULTS.json`。中途有失敗時均未開始任何發布；只修正離線候選並重跑相應套件。

實際命令：

```sh
python -m unittest discover -s test -p 'test_lite*.py' -v
python -O test/verify_lite.py
node --test --test-reporter=tap test/v9_1_lite/*.test.mjs
node --test --test-reporter=tap test/line/*.test.mjs test/parks/*.test.mjs test/facilities/*.test.mjs test/parking/*.test.mjs test/preflight/*.test.mjs test/security-spec/*.test.mjs test/p09/*.test.mjs test/personal/*.test.mjs
python -m unittest discover -s test/park_sources -v
python -m unittest discover -s test/park_review -v
(cd sponsor-worker && npm test)
```

GAS語法、Python AST、workflow YAML解析及git diff檢查通過。CI已加入Lite套件、Pillow固定依賴及CJK字型準備，原job不刪減；**未推送／未執行遠端CI**。字型依賴以合法已安裝CJK字型為準，renderer支援--font／PAPAKING_CJK_FONT，不自行下載字型。

## 圖片與JSON

`assets/line-rich-menu/menu.png`及menu.json保留R2正確圖文：2500×1686、RGB PNG、89,743 bytes；本輪沒有更換設計或發布到LINE。尺寸、檔案、解碼、四格完整覆蓋及精確action對應均通過。圖可由 `python tools/render_menu.py --output /tmp/r3-menu.png` 重建；正式檔案SHA在SHA256SUMS.json。

1,000,000-byte門檻仍是暫定保守值；最新LINE官方規格前次遭CONNECT403，本輪未冒稱已核驗或呼叫API。沒有Rich Menu建立／圖片上傳／本人綁定／預設選單切換工具被執行。

## 修改檔案與整合方式

- runtime：`gas/line_webhook_gas.js`、`gas/park_search_gas.js`、`gas/facility_line_gas.js`（只有文案、emoji、help入口／函式）。
- 原回歸對齊：`test/parks/mvp.test.mjs`、`test/preflight/bundle.test.mjs`。
- Lite工具：`tools/apply_v9_1_lite.py`、`tools/render_menu.py`、`tools/requirements-v9_1-lite.txt`。
- 素材與說明：`assets/line-rich-menu/menu.json`、menu.png、README.md。
- Lite驗證：`test/verify_lite.py`、`test/test_lite.py`、`test/test_lite_r3.py`、`test/v9_1_lite/display.test.mjs`。
- CI：`.github/workflows/offline-tests.yml`。
- 本報告及JSON測試收據。

`facility_search`、webhook安全／狀態、manifest、park_geocoding／B4-3／B4-5、sponsor-worker與fb069a7位元組一致。本人限制、事件去重、quota及reply fence未修改；停車1km、行車排序、park/toilet 3km／5筆、來源未驗證與新北公園人工核准均仍由原程式與原回歸驗證。

隔離分支Commit、完整binary diff、Git bundle與SHA清單於交付目錄提供。**本輪未自動整合回feature分支**；可在後續核准下以bundle／Commit或完整patch審閱整合，不應只套三份runtime而漏掉測試／工具。原GAS正式部署不受本機整合影響。

## 驗收與尚待事項

F1、F2、F3：離線關閉；已達可整合開發分支條件。沒有新功能會寫Sheets或操作postback。後續仍需：使用者批准整合、正式版本9最新備份／對照、LINE官方尺寸／帳號管理權與本人綁定核對、另行正式部署批准，以及本人手機三類搜尋、help保持分類／TTL、圖示／導航／品質提示與四格點擊驗收。沒有這些正式證據，不稱「已上線」或「手機已驗收」。

回復正式版本／Rich Menu的操作不在本輪；不提供自動執行部署的包。原始V9、原附件、正式資料及部署皆未修改。完成後停止，等待下一步核准。
