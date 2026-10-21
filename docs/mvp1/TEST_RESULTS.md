# MVP 1.0 盤點：本輪離線驗證紀錄

日期：2026-10-21（Asia/Taipei）；程式Commit `26b7842ca43946c63bbaa658e5a2a9cbf2cfae62`。Node v24.19.0、Python 3.12.14。命令在repository根目錄執行；沒有安裝或修改套件、程式、測試或CI。

| 實際命令 | 結果 | 範圍與限制 |
|---|---:|---|
| `node --test --test-reporter=tap test/parks/*.test.mjs` | 170／170 pass，fail／skip／cancel均0 | 含搜尋／候選audit／B4同步回復／Webhook／Flex fallback／雙北MVP；Sheets、Maps與LINE皆mock |
| `node --test --test-reporter=tap test/parking/*.test.mjs` | 72／72 pass，fail／skip／cancel均0 | 固定TDX／NTPC／基隆與行車／快取／額度fixtures，無正式API |
| `python -m unittest discover -s test/park_sources -v` | 33／33 pass | CSV與已審閱頁面合成fixtures，不是官方網站即時讀取 |
| `python -m unittest discover -s test/park_review -v` | 22／22 pass | 635筆合成審核來源、Excel結構／保護及ODS主來源接受工具；不是人工核准或GUI操作 |
| `for file in gas/*.js; do node --check "$file" || exit; done` | 全5檔pass | JavaScript語法，不是GAS runtime／scope驗證 |
| `git diff --check` | pass | 變更空白檢查，不是應用程式測試 |
| `git ls-remote origin refs/heads/main refs/heads/feature/flex-message-v2 refs/heads/feature/v0.3.1-park-flex` | exit 0，3個SHA讀回 | 只證明Git分支參照，不代表GAS部署 |
| `node .local/mvp1-inventory-20261021/observations.mjs` | 6個分析觀察均重現 | 本輪分析腳本，無修改產品程式；只使用既有VM harness及合成資料 |

**本輪套件合計297項全過。** 六個觀察是對現有缺口的重現，獨立列示，不包裝成已修正或新增回歸測試。

## 真實匯出快照的唯讀檢查

以Python標準`zipfile`及`xml.etree.ElementTree`解析原ODS的`content.xml`、按ODF重複列／格與數值型別讀取，統計各分頁欄位、列數、主鍵／外鍵、狀態及座標粗矩形有效性；沒有透過LibreOffice重新儲存來源。公園發布狀態／歷史摘要另以既有`park_review_workbook.load_source(...,allow_ods=True)`唯讀重讀。

結果：公園1448列（臺北813／新北635），正式可用且有效座標812／9。公廁5481列（新北3976／臺北1505），ID唯一且座標粗矩形初篩5481筆；沒有可用狀態，5281待驗收、200待確認。其他欄位／整併與共點統計見[SYSTEM_REVIEW.md](SYSTEM_REVIEW.md)。座標沒有作入口、導航可達性、行政區多邊形或官方來源最新性驗收。

原ODS與附件SHA已記錄；最終驗證前後來源與所有追蹤檔案指紋不變，僅新增報告文件。完整JSON、測試stdout與分析腳本位於`.local/mvp1-inventory-20261021/`。資料來源驗收已在PK-02E接受ODS為主輸入，本輪不再要求XLSX。

## 六個重現觀察

1. 附近公廁文字未分流，位置仍預設停車。
2. 附近公園後輸入停車查詢，下一位置仍公園。
3. 僅正式可用＋有效座標即可導航，不驗發布證據。
4. 附近公園全部模式仍依賴設施表存在。
5. 公園Sheets例外只log、無使用者錯誤回覆。
6. 共用Flex對有限但越界座標仍建立導航，不能直接當資料有效性檢查。

## 未執行與待驗

- 沒有執行附件任何函式、真實批次地理編碼、B4-3或B4-5；mock測試內會在記憶體模擬寫入／備份，沒有操作正式Sheets。
- 沒有Google／LINE帳號授權、正式API存取、LINE官方schema驗證或真實訊息投遞。
- 沒有公廁搜尋產品函式，因此公廁附近搜尋／路由端到端尚無測試可通過；後續可重用公園距離／排序案例，但不能稱目前已通過。
- 沒有Excel／手機GUI或導航現場驗收，沒有正式GAS全檔／版本與Git比對。
- 沒有重跑Worker測試，不聲稱本輪25項Worker通過；`sponsor-worker`完全未改動。
- 遠端GitHub Actions run本輪未讀回；本機結果不代替遠端CI。
- 停車並行額度／真實快取逐出、LINE重送、上游資料變版及配額不因固定fixtures通過而視為完成。

**程式離線驗收、匯出資料核對、人工發布核准、正式GAS／LINE端對端，是四個不同層級。本輪完成前兩者的指定分析範圍，未完成後兩者。**
