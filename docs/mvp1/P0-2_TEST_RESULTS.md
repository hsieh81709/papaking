# P0-2 實際離線測試結果

日期：2026-10-21（Asia/Taipei）；基準`e825558`，先行測試Commit `e547f2f`。Node v24.19.0、Python 3.12.14；全部外部服務為合成mock，未使用正式Google、LINE或TDX憑證。

## 紅綠紀錄

| 階段 | 實際結果 | 說明 |
|---|---|---|
| 開發前基準 | JS319／319、來源33／33、審核22／22，共374全過 | 在改應用程式前實際重跑P0-1 |
| 新增第一批49項LINE測試，程式仍P0-1 | 9 pass／40 fail | 公廁未接入、切換與TTL、錯誤提示、選單及Flex等缺口；已提交e547f2f |
| 新router／renderer初版 | 新49／49 pass | 完成主要分類、發布後導航及錯誤提示 |
| 首次全部JS整合 | 356 pass／12 fail，共368項 | 12個舊UI案例仍期待五選項／無分類或逾時走停車／空母體說無結果 |
| 更新需求對應的12個舊UI斷言 | 368／368 pass | 明確驗選停車仍進原核心；不刪案例、不skip，不改弱搜尋及停車資料斷言 |
| 加入Cache全遺失、保留新選擇、傳送不確定等12項 | 新61／61 pass | 補齊狀態與傳送回歸 |
| 補十進位字串輸入案例 | 61 pass／1 fail後修正 | 路由驗證合法座標後轉數字再進原停車核心，不改來源事件 |
| 最終 | **436項全過** | 所有JS fail／skip／cancel皆0，Python無失敗或skip |

原始log見`.local/mvp1-p02-20261021/`：baseline-js.tap、baseline-sources.log、baseline-review.log、red.tap、green-first.tap、integration-first.tap、integration-second.tap及最終line.tap、parks.tap、core.tap、park-sources.log、park-review.log；正規化修正後另重跑原JS319項，見final-original-js.tap。

## 最終命令與結果

在repo根目錄執行：

| 命令 | 結果 |
|---|---:|
| `node --test --test-reporter=tap test/line/*.test.mjs` | 62／62 |
| `node --test --test-reporter=tap test/parks/*.test.mjs` | 170／170 |
| `node --test --test-reporter=tap test/facilities/*.test.mjs test/parking/*.test.mjs` | 149／149（設施77＋停車72） |
| `python -m unittest discover -s test/park_sources -v` | 33／33 |
| `python -m unittest discover -s test/park_review -v` | 22／22 |
| `for file in gas/*.js; do node --check "$file" || exit 1; done` | 全7檔語法通過 |
| `actionlint .github/workflows/offline-tests.yml` | 通過，使用既有本機binary |
| `git diff --check` | 通過 |

基準重跑JS命令為`node --test --test-reporter=tap test/parks/*.test.mjs test/facilities/*.test.mjs test/parking/*.test.mjs`。最終436＝62＋170＋149＋33＋22，無重複計數。

## 新62項涵蓋

- 三分類選單、分類後分享位置、每次需分類、原停車入口正確委派。
- 公園→停車、公廁→公園、停車→公廁及其他雙向切換、重複選擇、選單清除。
- 599秒有效、600秒逾時、重選刷新；主快取遺失、兩份皆遺失及6小時marker到期都不推停車。
- DM／group／room、不同群、同群不同人隔離；缺userId拒絕、id群組隱私、Cache不含原始ID與位置。
- 未知／混合分類、壞狀態、Cache讀寫失敗、合法十進位位置轉數字、無效位置保留分類、查詢失敗保留設施選擇、新選擇不被舊完成清除。
- 真實24欄合成公廁經P0-1 gate至Flex：名稱、區／地址、直線距離、walking目的地及UNKNOWN提示。
- 無發布資料、已有發布但3km外、粗框外未開放、缺表／欄位／讀取拒絕、未知程式錯誤各自提示。
- 非公廁原始列不建導航；來源座標改變、指紋失效不進LINE導航。
- 最多5卡、長名稱／欄位、bubble／carousel bytes、altText、Flex根欄位、無backend指紋外洩。
- 400同批文字一次備援、再次400停止、200／429／500不重送、網路狀態不確定不重送；停車回覆例外不再發動第二個錯誤回覆。

## 原核心保護與限制

完整函式區段比較顯示：Webhook原103個函式只有4個UI／傳送相關函式改動，其餘99個不變。P0-1的7個指紋／核准／範圍排序／導航保護函式與基準相同。證據見交付包CORE_PROTECTION.json。

`park_geocoding`、B4-3、B4-5、appsscript.json、sponsor-worker及停車測試相對基準無差異。未重跑Worker測試，不將舊25項列入本輪計數。

本輪沒有Google Sheets真實讀寫、正式GAS執行、地理編碼、LINE Messaging schema API或真實訊息投遞。合成訊息JSON不是官方schema驗收。沒有原始635筆或3976筆公廁的新增資料核准，也沒有匯入測試發布表。

CI已加入新LINE套件與log artifact，但本輪遠端Actions尚未讀回。正式上線阻擋、Cache並行限制與回復方式見[P0-2整合紀錄](P0-2_LINE_INTEGRATION.md)。
