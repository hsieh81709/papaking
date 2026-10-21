# P0-8 受影響離線測試

2026-10-21（Asia/Taipei），Node v24.19.0。資料均合成、外部HTTP／Maps／Properties／Sheets由VM mock代替；無正式憑證、無Google API重試、無LINE實際投遞。使用者原始碼不經覆寫或修復。

| 測試對象 | 實際結果 | 可以證明／不能證明 |
|---|---:|---|
| 5份匯出檔node --check | 5／5語法成功 | Node可解析，不是GAS manifest／權限或deployment驗收 |
| 匯出程式的路由／公園／Flex現況刻畫 | 18／18（5既有、13風險） | 成功重現已列行為與風險，不是安全通過 |
| 匯出停車程式跑現有72項固定契約 | **52 pass／20 fail**，exit1 | 匯出與候選回歸要求有差異，不等於正式服務發生20個故障 |
| 本機d4d6aff受影響套件 | **135／135**，fail／skip／cancel0 | 停車72＋P0-7公廁26／LINE6＋公園search／mvp31；不含正式API與完整安全驗收 |

### 匯出停車20個失敗契約

1. 先篩小客車再取最近10筆。
2. 未知／非有限座標不得冒充1km內。
3. TDX查詢應用實際origin，格心偏移不可漏邊界候選。
4. 同一舊grid的不同origin快取不能誤共用。
5. 401必須清除失效auth token以便重取。
6. auth transport失敗應輪替而非中斷（此例為未處理例外；其餘19為安全／功能斷言差異）。
7. NTPC分頁滿到安全上限不能當完整清單。
8. NTPC非array頁不可併入。
9. 空剩餘位為未知，真0才為0。
10. 基隆future時間戳不可當新資料。
11. 基隆含秒時間戳不能重複補秒。
12. 負行車秒數快取不可顯示負時間。
13. NaN座標須在行車排序前排除。
14–15. 無userId的group／room不得誤套一個群組ID的個人額度。
16. 停車log不得含原始位置／echo身分。
17. buildReply整合的origin log保護（這不是額外證明來源API真的故障）。
18. 六小時旗標跨月仍需清過期quota鍵。
19. 既有使用者counter寫入失敗不得放行未計數query。
20. Google／directions錯誤log不可回顯origin。

完整TAP與每個測試名稱／failure code在本地 `export-parking.tap`／`PARKING_FAILURES.json`，沒有為讓附件通過而改舊測試。副本的72測試、helper及fixture與repo版本一致，只有其gas/line_webhook_gas.js指向附件原始內容；不把「缺適配的測試驅動」當修復，在此20例均能對應實際既有函式差異。

### 執行命令

在repo根目錄（需本輪證據包／原始附件）：

```sh
node --test --test-reporter=tap .local/mvp1-p08-export-20261021/export-characterization.test.mjs
node --test --test-reporter=tap .local/mvp1-p08-export-20261021/export-regression/test/parking/core.test.mjs
node --test --test-reporter=tap test/parking/core.test.mjs test/facilities/taipei.test.mjs test/line/taipei-toilet.test.mjs test/parks/search.test.mjs test/parks/mvp.test.mjs
```

第二個命令目前故意保留實際失敗、exit1，不包expected-failure當成功。現況刻畫測試亦不放入永久release gate要求危險行為出現。

原始log：`.local/mvp1-p08-export-20261021/export-characterization.tap`、`export-parking.tap`、`candidate-affected.tap`。只有兩個serving匯出檔載入受控VM，沒有執行B3、B4-3、B4-5或來源中的testPapaKingNTPCGeocoding／testFlexValidate等live函式。

未重跑完整436、Worker、11項安全紅燈、來源／人工審核Python工具或所有歷史套件。也未執行官方LINE schema、真實GAS／Sheets／TDX／Maps或手機。正式版本仍缺對照證據，本輪不宣告可上線。
