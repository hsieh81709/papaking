# PK-PARK-MVP／MVP-02：雙北搜尋與官方來源驗收

日期：2026-10-20。分支：`feature/flex-message-v2`；程式基準：`f948a32`。

## 驗收狀態

| 層級 | 本輪結果 |
|---|---|
| 程式離線驗收 | 170項公園（原157＋新13）、72項停車、33項來源測試，共275項通過；零失敗／skip／cancel |
| CSV身分比對 | 附件635筆與新北635筆全部以名稱＋行政區＋地址匹配，並核對管理單位；不是僅依名稱或seqno |
| 官方座標比對 | **0筆。附件沒有座標欄或CRS，不能推定為WGS84或TWD97** |
| 網站列表／個頁及條款 | **未取得**；`https://www.ntparks.tw/views.html`代理CONNECT403，來源HTTP未取得 |
| 新增設施官方證據 | 0筆；635園×6類＝3810格保持UNKNOWN，不能解讀為沒有設施 |
| 資料人工核准 | 未新增；保護既有9筆新北正式座標，C級62筆不因CSV匹配而升級 |
| 正式GAS／LINE端對端 | 未執行；未部署、未修改Sheets／Webhook／sponsor-worker或合併main |

MVP程式可供審查；MVP-02網站資料取得、網站身分／條款確認及逐園設施證據尚未完成，不能以離線fixtures冒充已擷取。

## 附件與真實快照

檔名`新北市公園.csv`、65050 bytes、UTF-8 BOM；SHA-256：`a98624f43241a5c5c634226e1730bd1c2e8fd23eea3b57c030568f9b1dc8a71f`。
欄位為`seqno,name,area,address,management,localcallservice,areacode`，635資料列。原檔前後雜湊相同，副本與報告寫在新的被Git忽略目錄。

使用者宣告此檔為官方來源；檔內沒有來源出版日期、座標或授權metadata，本輪未以網路獨立驗證其下載來源或當期最新性。報告保留來源聲明與缺口，未把擷取時間填成出版日期。

既有ODS與PK-02B成果皆實際存在且已讀取，輸入雜湊留在summary。CSV身分／地址「已確認635、待人工審核0、無法匹配0」，未匹配來源列0。三組同區同名共6筆（NP-48／82、NP-601／614、NP-604／615）是靠地址區別，不按名稱直接連接。8筆優先、23組54ID與62筆C級均有對應來源列，但沒有新增位置證據。原正式座標與候選差異仍見前次稽核；本輪CSV不能提供額外座標差。

工具`park-official-audit.py`接受明確CRS宣告後才比較座標：經緯度欄但無datum只標未證實；TWD97 XY需明確指定EPSG:3826（121帶），不以數值範圍自行猜CRS。其他帶號不默認轉換。投影以獨立PROJ參考點固定測試。

## 雙北MVP行為

- LINE保留「附近公園→分享位置」與一次性意圖、回選單清除、400 Flex同批文字備援；未帶公園意圖的直接位置分享仍查停車。
- 3km、最多5筆、實際直線距離排序，不按使用者所在城市排除另一市；只納入雙北、正式狀態可用且有效座標、唯一ID。未接入CSV或候選表作搜尋來源。
- 遊具篩選限台北。設施列若提供資料狀態，只有「可用」作正證據；「待查核」、空值等不算有。仍只讀既有「可查詢遊具類別（依休憩設施）」及正向共融名稱，忽略疑似串接的其他設施，不推估數量。舊schema無狀態欄時維持既有canonical欄位契約；這不等於對缺欄來源做新的人工核准。
- 新北附近搜尋不顯示遊具選項或未驗證tags；選單明示台北遊具範圍。UNKNOWN不等於無設施，無結果文字提示資料覆蓋不足。
- 保留既有Google Maps查圖連結，增加步行導航至公園代表位置；未宣稱為已確認入口。文字與Flex一致，400備援不重查資料。

真實ODS快照載入離線GAS mocks後，可搜尋台北812／813、新北9／635（1.42%）；共821個正式可用點。9筆為NP-9、12、112、333、480、495、541、551、595。這是快照內狀態，不是本輪重新核准或線上讀回。

台北設施457筆中433筆待查核、24筆可用。採本輪保守狀態門檻後，滑梯正結果3園（TP-449／907／992）、鞦韆4園（TP-904／906／907／992）、共融0園；不得宣稱台北沒有其他遊具或共融遊戲場。空間搜尋與條件程式可用，不代表設施母體完整或已現場查核。

## MVP-02網站與證據流程

本輪唯一網站請求於2026-10-20T03:49:27 UTC觀察：CONNECT403、curl56、來源HTTP無。沒有繼續批次打列表／個頁，也沒有變更網路政策、換代理或繞過TLS。網站是否由官方管理、使用條款、robots與內容授權均待取得，不因使用者稱官方就把營運者驗證旗標設true。

來源工具處理**經審閱的頁面JSON快照**，不是已完成的ntparks實際DOM爬蟲；在未見真實頁面前不猜URL、DOM或列表總數。未來取得頁面須保存名稱、行政區、地址／位置、原始設施描述、URL、擷取日、來源出版日（缺則null）、網站官方身分與條款證據。

匹配分類為「確定匹配／疑似匹配／無法匹配」。只有複合名稱＋行政區＋地址、CSV身分一致、HTTPS正確host、HTTP200、已驗證官方營運者與條款的頁面，才讓明確滑梯、鞦韆、沙坑、攀爬、戲水、共融原句產生「已確認」設施證據；仍不授予座標或發布核准。旗標是外部審閱契約，工具本身不能證明呼叫者填入的營運者／條款聲明真實。

沒有提及、否定、非共融、已移除、施工／規劃／維修、近旁／對面設施一律UNKNOWN，不填無設施或推造數量。固定synthetic頁面JSON只驗證資料契約，不代表網站真實內容。

## 測試與Commit

| Commit | 差異 |
|---|---|
| `fdd7f90` | 新13項MVP測試，基準先重現11 fail／2 pass；原遊具fixture改臺北市／萬華區以對應產品範圍，保留原157項的案例與全部斷言 |
| `e23ac3f` | GAS雙北範圍、正式資料／設施狀態門檻、導航與選單；新增唯讀CSV／證據工具、來源測試、CI及Python cache ignore |
| `06759bf` | 三種網站匹配分類、固定頁面JSON與CLI端對端測試，來源測試共33項 |

來源否定句測試另曾重現1 fail，再修正非共融／已移除的誤判。最終170＋72＋33＝275全過。JS與Python語法、actionlint、git diff/check通過。整個sponsor-worker相對基準無差異，本輪未執行Worker測試。遠端Actions結果與LINE schema／投遞不因本機通過而視為驗收。

公開測試名稱與runner摘要見`PK-PARK-MVP-test-results.txt`；完整實檔匹配、證據CSV與原始測試logs位於`.local/parks-mvp-20261020/`。未提交原始CSV、ODS、真實資料列或其他使用者資料至Git。

## 重跑與交付

```bash
# repo根目錄；新輸出目錄不得已存在
python tools/park-official-audit.py '/path/新北市公園.csv' \
  .local/parks-ods-20261020/import.json NEW_OUTPUT \
  --quality .local/parks-ods-20261020/final/parks-quality.json \
  --risk .local/parks-pk02b-20261020/results/high-risk-review.json
node --test --test-reporter=tap test/parks/*.test.mjs
node --test --test-reporter=tap test/parking/*.test.mjs
python -m unittest discover -s test/park_sources -v
node .local/parks-mvp-20261020/verify-real-snapshot.mjs
```

CSV命令需要真實快照；檔案缺漏會失敗，不以空陣列冒充已驗證。工具也可用`--website-pages reviewed-pages.json`處理已審閱頁面，輸出website-pages.csv與feature-evidence.csv；本輪未提供任何真實網頁，全部設施UNKNOWN。

實際交付包含identity-matches.csv（635）、high-risk-matches.csv（62）、priority-matches.csv（8）、unmatched-parks.csv（0、保留header）、feature-evidence.csv（3810 UNKNOWN）、網站存取回執與可重跑成果包。

下一步：取得真正含座標與CRS的官方來源；取得ntparks列表、個頁、官方身分與條款後再建立實際擷取器與逐園證據。需套用適當網路存取或提供一次離線頁面／條款匯出；本輪不自行更改權限。資料補齊後仍須人工核准與另行授權的隔離GAS／LINE端對端驗收，不自動同步或部署。
