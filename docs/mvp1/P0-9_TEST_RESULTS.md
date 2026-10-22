# P0-9 實際離線測試

2026-10-22（Asia/Taipei），Node v24.19.0。全部合成資料、VM及攔截的fetch，沒有Google／LINE／TDX／Maps真實請求、正式設定或資料寫入。

| 項目 | 實際結果 |
|---|---:|
| 修改前既有安全規格 | **0／11，11 fail**；原版缺口重現，原始TAP保留 |
| 修復後原11安全規格 | **11／11**；無skip／xfail，不以拒絕所有合法事件假通過 |
| 新增P09安全／入口案例 | **43／43**；含GAS origin、容量、交錯、持久性與獨立LINE驗簽入口 |
| 同次受影響離線測試合計 | **382／382，fail／skip／cancelled皆0**；含以上54項 |
| 停車固定回歸（包含於382） | **72／72**；TDX、1km、NTPC、TWD97、基隆、快取、quota、行車時間沿用 |
| 語法 | 六個serving JS＋入口adapter共7檔Node解析成功 |
| 載入／重複宣告 | preflight檢查六檔全部720種載入順序、無重複named global函式 |
| Git diff與保護檔 | diff檢查成功；park_geocoding、B4-3／B4-5、sponsor-worker、兩個搜尋引擎與manifest均未修改 |

## 可重跑命令

在repo根目錄：

```sh
node --test --test-reporter=tap test/p09/*.test.mjs test/security-spec/*.test.mjs test/line/*.test.mjs test/parking/core.test.mjs test/parks/webhook-routing.test.mjs test/parks/line-fallback.test.mjs test/preflight/*.test.mjs test/facilities/taipei.test.mjs test/facilities/search.test.mjs test/parks/search.test.mjs test/parks/mvp.test.mjs
```

本輪只執行這些受影響套件，未執行全部公園維護工具／Python／Worker或完整歷史回歸。沒有刪除任何既有測試或改Worker。CI保留原所有job，新增blocking P09／security／preflight檢查；checkout完整歷史供bundle固定基準比較，無部署／正式憑證步驟。CI尚未遠端執行。

## 測試變更與紅綠證據

修改前 `node --test --test-reporter=tap test/security-spec/release-gates.test.mjs` 真正重現11個斷言失敗。`security-before.tap`保存原結果。新測試初稿15項在fixture尚未接上origin driver時也失敗，保存`new-before.tap`，但**不把fixture未接線當成15個產品根因**；紅燈證據以原11個安全斷言為準。

受影響測試逐步結果為151／166、183／185、258／258、268／268、379／380，接著380／380；新增最後2項UI／日誌案例後最終382／382。中間失敗逐項對應fixture改接持久儲存、舊Cache觀察點／時鐘、unsigned負例與不再回顯原始exception log；不是刪除或skip失敗案例。

R1–R4保留合法首query、重送／失敗／同時事件的安全斷言；R5重入點由clear改為原子take，仍確認交錯實際發生且只一筆query。R6驗證較舊snapshot不能清除已接受的新選擇；R7在持久setProperty內注入競爭，assert內層鎖被拒，外層選擇完整，後續新event可接受新分類。R8明確繞過合成簽署driver、直打真origin handler，assert零query／零LINE；正向案例則經獨立Node crypto簽署。R9／C1在持久計數read處注入重入，准入數等於reservation數，允許鎖競爭拒絕。R10仍真正接受並處理正常11筆，不以超限拒絕代替。

舊preflight風險刻畫改成同風險的安全預期；P0-3／P0-4歷史文件與原始TAP沒有覆寫。P0-2的Cache故障／逐出案例改驗durable state失敗／損壞／逐出不影響分類；安全目標仍是沒有未記錄查詢或默認停車。TDX測試只把計數觀察點由Cache改到Properties，輪替、耗盡與回傳斷言保留。原park bare-invalid輸入改驗新版明確rejected；原log回顯exception斷言改成去識別uncertain訊號。

## 新增案例涵蓋

- origin缺secret、裸body、錯audience／channel／destination／MAC／payload、過期envelope；event缺ID／timestamp、過舊／未來、同ID不同語義、JSON鍵順序、換replyToken／redelivery，跨VM快照保存後仍去重。
- 正常11筆、33筆整批拒絕；32事件／16 scopes／7800 bytes邊界；壞狀態不重設；setter失敗禁止query或reply；Cache清空不重置分類或TDX計數。
- 兩個不同位置同時讀同分類，只一個查詢；較舊query失敗／完成、較新分類已被消耗、menu取消、較舊未見指令／位置；事件時間起算600秒，不因延遲延長。
- LINE每次attempt前寫入、400原快照一次fallback、500保留UNKNOWN、未知重送不query／reply、不自動GC；月quota部分寫入失敗拒絕query、保守保留已扣部分。
- 獨立入口精確raw bytes HMAC（中文／emoji／空白）、RFC4231固定向量、錯／缺／重複signature、body／batch上限、錯destination、timeout／HTML／unsigned ACK、Google redirect目標與GET不攜secret、入口到GAS雙向MAC合成契約。
- 臺北既有遊具次層快捷鍵、位置／返回及三分類保留；LINE錯誤body與replyToken不回顯log。既有跨市／發布gate／UNKNOWN／排序／導航案例回歸。

## 容量、原始碼與證據

`.local/mvp1-p09-20261022/CAPACITY_MEASUREMENT.json`：單一scope連送32個menu事件全完成，狀態6621 bytes；第33個回unavailable、沒有第33次LINE回覆。實際多人及位置工作可能更早碰byte／scope上限，不代表可承受正式流量。

[來源回執](P0-9_SOURCE_RECEIPT.json)列候選hash與未修改路徑。Webhook原104個函式區塊中95個保持逐字一致；比較區塊含相鄰註解，不是AST語意判斷。原handleLocation／buildReply／主要資料解析與導航沿用，不從P0-8舊版回退已修過的20項停車契約差異。

本地證據目錄 `.local/mvp1-p09-20261022/` 保存before／after TAP、容量與原始碼回執、完整Git diff。未提交使用者原始GAS全文、憑證或資料。正式manifest內容尚未提供，差異仍待驗。

**限制：** VM鎖競爭是可控重入模型，跨VM測試是共享持久快照重啟，不是Google平台跨程序壓力測試；單值寫入／readback、執行時限、redirect、官方LINE schema／手機及發布資料都未取得真實端到端證據。公開GAS資源DoS與其他舊部署未解。382項通過不等於安全修復已正式完成或批准上線。
