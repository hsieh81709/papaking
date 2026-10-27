# V9.1 最小測試與驗收計畫

2026-10-27。P0沒有新增測試程式／改正式資源。以下是P1驗收規格，不能當作已通過結果。既有證據：同候選fb069a7完整643／643、準備期349／349；本輪僅檢查程式／ODS表頭與執行兩個只讀mock探查（postback被過濾、data未納入hash），沒有重跑完整回歸。證據界線見[V9現況](V9_1_CURRENT_STATE.md)。

## 先失敗、再實作

P1先用固定合成fixtures證明：六格新文字目前會走unknown；本人postback目前無派送；同事件變更data未改hash；卡片沒有三類emoji／回報身分；九欄表沒有新增回報handler。不要為了造紅燈修改原有保護條件。保存before／after TAP與實際命令，新增測試用不同namespace且保留所有原斷言；政策無變，不可改公園／公廁發布fixtures來讓測試過。

建議新增 `test/v9_1/`：rich-menu、display、report-routing、report-store、report-failures，各檔有明確責任，不測純實作鏡像。合成fixtures固定來源ID、obs ID、來源指紋、時間與可控隨機token；禁止匯入真正owner ID、replyToken、token或使用者位置。

## 離線必要矩陣

| 區塊 | 案例及必需斷言 |
|---|---|
| 六格配置 | 6個area、唯一label、熱區不重疊／越界、完整覆蓋、文字與action合法；圖片尺寸／格式／檔案上限依正式核對的官方規格測試，未核對標draft不可publish |
| 現有三類搜尋 | Rich Menu message值等於現有文字指令；停車1km、park/toilet 3km／5筆；沒有第二Webhook、無額外查詢或靜默改分類 |
| 傳送位置／說明 | 無分類／過期先選類別；有效分類只回location Quick Reply，剩餘TTL不延長；使用說明保留intent；實際location仍由原座標驗證處理，不預填／記錄使用者座標 |
| postback本人限制 | owner DM准許受支援report namespace；其他人、owner群／room、偽裝group欄位、非message/postback、未知namespace皆零query／context寫入／append／reply |
| 事件契約 | 缺replyToken、型態錯、data過長／注入／不明action、過期timestamp拒絕；原message hash精確沿用fb069a7固定fixture；postback.data或params異動使hash改變，同event ID衝突；合法redelivery不再寫表 |
| emoji及payload | 三類Flex與文字各保留中文及emoji；原色、距離、altText、導航目的地／travelmode、品質提示不變；每bubble／carousel／整體reply依既有LINE格式驗證，錯誤回報button不擠掉導航 |
| 公廁樓層 | `樓層:2F`、`樓層：B1`、多樓層、混合入口限制、無樓層限制、UNKNOWN／空值；只顯示原值、不猜1F、不將未知顯示無；殘餘限制不遺失，原row及來源指紋完全不變 |
| 公園及公廁保護 | 缺新北公園人工核准仍不導航；公廁source-unverified保留原完整警語；200類待確認／待人工確認仍排除；撤銷／失效核准不可走source路徑；加回報不產生新的導航 |
| 三類設施ID | TP／NP公園、公廁原ID；停車路段source namespace＋segId；路外TDX／NTPC／基隆有ID者保留來源ID；無ID／Google／靜態道路用明確obs ID且名稱／來源快照可查；不同來源同ID不混淆，不以名稱確認同一設施，不增API呼叫或變排名 |
| 回報UI | 卡片→五類→確認→送出；只有最後明確確認才append；顯示目標類型／名稱／ID及問題。取消／返回主選單／改搜尋分類行為明確，回報不消耗原搜尋意圖或改成停車 |
| 無ID Rich Menu | 有最近有效結果則本人選目標，不自動選第一筆；無結果／舊context過期提示先搜尋；不得讓任意ID或另一人token作回報／導航 |
| context／開關 | flag缺值或false零context／回報寫入；40個／2KB／1800秒邊界；token綁scope、不可交換類別；過期拒絕；容量／Properties不可用僅讓回報降級，不讓既有搜尋失效；未知提交不自動GC後重做 |
| 九欄adapter | 重排表頭可讀、缺欄／重複表頭／缺表／讀取失敗時零寫入；不自動建表；穩定report ID、server時間、待處理、處理時間空白；只append九欄，不改任何來源／核准列 |
| 資料輸入安全 | enum以外拒絕；token／native ID／名稱等有長度限制；控制字元及公式字首字面寫入；備註JSON不含秘密、原始owner ID、replyToken或使用者分享位置。P1自由文字不支援，不把一般訊息自動寫表 |
| 重複／並行 | 同事件重送0次新append；不同event重複按同context，只有同report ID一列；雙執行交錯、鎖忙、schema檢查後變動、寫後讀回；原daily限制新報告最多20、每分鐘3，reservation不可競爭遺失；零巢狀ScriptLock |
| 失敗恢復 | append前失敗無成功回覆；append成功但Properties／讀回失敗不重寫；存在report ID則回已收到；讀回不確定則UNKNOWN且無自動新ID；同report ID多列則管理警告，不刪列或再append |
| LINE交付 | append成功後reply失敗不再寫；Flex400同快照一次文字備援，不重新搜尋／append；429／5xx／timeout不重送；原replyAttempts與UNKNOWN策略不放寬 |
| Rich Menu管理工具 | dry-run預設零網路寫入；讀取／匯出與發布子命令分離；缺Token／channel不符／規格未核驗／缺備份拒絕publish；僅本人綁定、原default不變；upload／link部分失敗可依記錄復原，不先刪舊menu |

P1回報是合成Sheet append測試，不代表正式寫入驗證。不能用mock證明真正跨服務transaction／exactly-once；GAS中止、Sheet延遲、未知交付等界線必須寫進報告。

## 執行策略及發布門檻

開發中只執行新增V9.1與受影響LINE／personal／preflight／來源ID相關parking測試；公園renderer改動則補park Flex／fallback。修完程式後執行一次完整回歸：

```sh
node --test --test-reporter=tap test/v9_1/*.test.mjs test/line/*.test.mjs test/parks/*.test.mjs test/facilities/*.test.mjs test/parking/*.test.mjs test/preflight/*.test.mjs test/security-spec/*.test.mjs test/p09/*.test.mjs test/personal/*.test.mjs
python -m unittest discover -s test/park_sources -v
python -m unittest discover -s test/park_review -v
(cd sponsor-worker && npm test)
```

對全部GAS及工具檔做語法、全域函式重名、載入順序、完整發布檔案清單與Git diff檢查。新module會改發布集合，不能沿用「只有六檔」舊封包假設；必須保留正式其他維護檔。若舊preflight固定六檔測試需擴為新最小模組集合，須保留原六檔載入測試並另加報告模組載入／不存在時flag關閉仍能搜尋的測試。

現有 `.github/workflows/offline-tests.yml` 使用明列套件目錄，P1須將新test/v9_1套件加入CI，不能只在本機通過。原643項功能不刪除／不弱化；新增項數依實際案例回報，不事先虛報。本人allowlist、無可靠驗簽的已知風險刻畫、source-unverified與公園核准等原斷言均保留。未驗證官方規格、正式九欄schema／寫入權、本人Rich Menu綁定與現有版本備份未確認時，只交離線候選，停止正式發布。

## 本人手機驗收（另行核准後）

| 步驟 | 預期及證據 |
|---|---|
| 管理者備份 | 讀回實際GAS版本／部署ID／URL／權限、Properties私有備份、回報表表頭與行數、本人／default Rich Menu及圖片；敏感值不貼報告 |
| 六格選單 | 同一Bot上六格觸控、收合、不同手機尺寸與字體；三類選擇→分享位置正常；傳送位置格不是直接假座標；使用說明不遺失分類 |
| 三類卡片 | 🅿️／🌳／🚻與原色、直線／行車距離、導航正確；公廁樓層B1／2F及UNKNOWN、未驗證警語完整；NTPC_STATIC不出現導航 |
| 回報三類 | 每類用本人明確同意的少量真實目標，選一項→確認→新增一列；核對type／ID或obs、問題、時間、待處理、備註。這是正式append，沒有核准不得測；不拿合成設施冒真實公園／公廁 |
| 無ID回報 | Rich Menu問題回報→選最近結果；無結果時引導先搜尋；老卡過期提示，不自動查停車 |
| 重複／失敗 | 正常重複按確認同report ID不重複列。未知交付、惡意postback、鎖／Sheets故障在離線注入，不在正式做破壞性重播；若遇自然錯誤保留已收／未確認訊息及report ID查核 |
| 搜尋隔離 | 回報中切換公園→停車、取消、使用說明、10分鐘到期、回主選單，不錯查或重扣停車額度；本人群組仍不處理。其他人拒絕以離線證據，不建第二Bot或帳號 |
| 回復 | 停用新回報、還原原本人Rich Menu綁定，必要時原deployment指回備份版本9；不改Webhook、不刪回報、不清ledger；確認三類原功能可用 |

每項填PASS／FAIL／NOT_EXERCISED、時間及實際版本。首次少量正式append需另行核准；Rich Menu出現或空events驗證OK不代表全部手機測試通過。尚無正式手機結果，本表不可預填PASS。
