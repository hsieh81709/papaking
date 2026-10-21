# P0-8 最小整合與回復計畫

2026-10-21（Asia/Taipei），僅計畫，不執行正式操作。基於5份使用者匯出、GitHub329a798與本機P0-7 d4d6aff；差異與限制見[核對報告](P0-8_EXPORTED_GAS_REVIEW.md)。

## 先補齊部署對照，避免覆蓋線上獨有程式

只需由持有人提供以下唯讀匯出，不需密碼／Token，也不必逐函式執行：

1. 實際專案完整檔名清冊與appsscript.json，確認這5份是否為完整編輯器HEAD。
2. 目前LINE所指Web App的deployment ID／不可變version number／對應source；編輯器HEAD若不同則兩者都保存、逐檔hash比對。版本註解不能代替此證據。
3. LINE目前Webhook URL、Use webhook／redelivery及上游proxy驗簽／轉送規格的遮罩設定，GAS執行身分／存取權與trigger清冊。Script Properties只列名稱／是否配置，值由持有人保管。

不足時可以繼續離線準備patch，不能做正式部署、指定真正回復版本或宣稱正式版本已完全核對。本輪沒有重試Google API，也沒有假設匯出就是live deployment。

## 最小功能檔案與工作順序

不是重新設計搜尋引擎；沿用已測試的P0-1／P0-2與P0-7，**2個原serving檔更新＋2個共用模組加入**是功能接線的最小候選包。安全helper是另一個仍須完成的阻擋，不能省略。

| 順序／檔案 | 必要patch與可重用部分 |
|---|---|
| 1 gas/line_webhook_gas.js | 將舊「公園或預設停車」改委派三分類router；以現有候選TDX／NTPC／Maps／quota修正作受測基準，不重新寫解析與導航。70個共同函式區塊可重用，26個不同區塊逐項審查；將UI和資料修正分開review，不能只copy新菜單 |
| 2 gas/park_search_gas.js | 接發布核准／共享排序、conversation intent隔離、Taipei可用遊具證據／否定詞修正、同快照Flex fallback及walking目的地。保留3km／5筆與現有3類遊具文字；新北不推造遊具 |
| 3 gas/facility_search_gas.js | 加入已有24欄adapter、指紋與人工核准、雙北共同排序／導航。採本機P0-7 TP_TOILET契約；GitHub329a798本身尚不包含臺北適配 |
| 4 gas/facility_line_gas.js | 加入已有公廁Flex、三類state及錯誤提示，城市提示採P0-7雙北版本；未知設施仍未確認。不是重畫卡片 |
| 5 原WebApp UI相容 | 原主選單可直接選3類遊具，候選主選單僅三分類；需補公園次層quickReply沿用既有intent，避免遊具功能雖可輸入卻在UI消失。裸位置／逾時改要求分類需告知並驗收 |

維護模組**不在這次功能替換範圍**：附件B3不是Git同名readonly auditor；B4-3／B4-5亦有不同安全契約。保留原檔存證，不整包把gas目錄覆蓋，也不將兩套同名全域函式同時加入靠載入順序決定版本。

park_search另有3個匯出獨有輔助入口（testPapaKingParkFlex、auditPapaKingNewTaipeiParks、testPapaKingNTPCGeocoding），不能因整檔替換就無聲消失；先列維護清冊，若需另置維護檔須保留依賴並另案驗收，不能順便執行含Maps查詢的測試。

換park_search的parkRowsAsObjects_也可能影響B3共用讀表helper，不能因維護檔本身不改就推定完全無相依影響。先確認trigger與維護作業清冊，正式修改前由持有人核准窗口；服務與維護是否拆專案另行決定，**本輪不搬檔、不跑批次、不啟停trigger**。

appsscript.json尚未取得；不能拿Git的V8／匿名設定冒充正式設定。後續檢查必要服務與scope，不因功能讀取Sheets就自動要求更廣權限；混有維護寫入程式的專案也不能宣稱已是最小唯讀權限。

## 停車差異如何保留，避免把既有修正退回

保留原TDX路邊／路外、NTPC／TWD97／基隆、1km、driving導航及行車時間／直線備援。附件對現有72契約有20個失敗，不是整個停車要重寫：候選已具體處理實際origin快取、壞座標、小客車先篩、auth輪替／清token、完整分頁、空剩餘未知、基隆時間戳、負快取時間、群組quota／跨月及log隱私。

這些修正與三分類UI分開核對，保留原trace與固定fixture。若正式部署版本另有不同修正，先合成最小patch再重跑對應停車測試，不能盲用本機整檔蓋掉正式獨有程式。也不能為少改幾行而刪除失敗斷言，恢復已證實有問題的行為。

## 不可跳過的安全小改

沿用[P0-6精簡計畫](P0-6_LEAN_RELEASE_PLAN.md)，不開DO／外部queue大型原型：

- 若已有可信入口，證明它以原始bytes和LINE signature驗簽且GAS不能繞過；目前未取得此證據。若無，另核准單一薄驗簽轉送器，GAS拒絕非受信envelope。只檢URL／IP／Referer不足。
- GAS為唯一query／reply owner；補有容量上限的耐久event ledger、原子claim／intentVersion、write-ahead恢復與短ScriptLock、每日／每key attempt控制。Cache miss不作核准、不默認停車。
- 同event重送不重查停車、舊位置不轉新分類、未知query／reply不盲目重試；全批不截尾後OK；保留400同快照一次文字fallback。
- 原11項安全紅燈要按真安全行為修復，不因功能135綠而解除。受限GAS方案若無法通過容量／保留期／並行驗收，再交證據決定升級，不能降低保證或默默啟動大型平台。

缺manifest／上游設定下不能證明網路層保護。即使加入HMAC，直打公開GAS仍可能耗執行quota；剩餘風險、流量上限與維護降級需使用者明確接受，不能宣稱完全隔離或exactly-once。

## 資料與功能分開驗收

新北公園只使用已核准的正式座標；優先先前ODS記錄的9筆正式座標中可人工批准的子集，**不覆寫9筆、不用候選表、不跑B4-5**。這不是確認目前正式Sheet仍剛好9筆；上線前需唯讀清冊。

雙北公廁先小批驗收來源、ID／行政區／地址、座標代表點、公共可進入性與證據。TP_TOILET／MOENV來源標記或座標完整不等核准。原24欄指紋與11欄核准表保持；沒有核准清單則0結果，UNKNOWN不代表無或24h。發布清單配置／寫入需另批，合成fixture不匯入正式。

每個城市／類別分別揭露核准數、可見數及測試點覆蓋，資料不足可以回未開放，不能宣稱雙北已全量可導航。一般附近公園不按使用者所在城市硬切；遊具依臺北可靠資料，不套到新北。

## 精簡測試與放行順序

1. 開發只測改動的park／toilet／LINE／quota接縫，保留本輪20個停車差異的契約；新缺口先紅燈再修。
2. 用合成Sheets與發布清單跑兩市／邊界／排序／UNKNOWN／錯誤／Flex400；不使用真實個人位置，不做geocoding或正式API批次。
3. 補真實隔離環境的raw signature、origin拒絕、重送／並行／quota及GAS容量驗收，取得官方LINE格式與手機圖卡／Maps證據；Node語法或18項刻畫不代替它。
4. 候選SHA、manifest及首發資料清冊固定後，發布前完整回歸一次，原436、preflight與安全規格不刪弱；有新變更或失敗再按必要範圍重驗。只發布已核准資料子集。
5. 交付精確來源／部署版本對照、備份、回復與監控後，另取正式切換／Webhook／設定與資料授權；目前不能發布。

## 備份與回復（只計畫）

正式操作前由持有人唯讀備份完整**實際使用版本**source／manifest、deployment pointer、Webhook與proxy設定、trigger清冊；屬性值僅加密保管，Git只記名稱／是否配置。先驗備份可讀且版本明確；單憑這5份編輯器匯出不能作完整live rollback包。

回復必須成套處理serving檔、required modules、入口envelope協定及state schema；保留quota／salt與未決event記錄，不清帳本使舊請求重做。分類採版本namespace或明確失效，告知重選，不清TDX快取或重設月額度。維護模組及正式座標不在回復寫入範圍，不呼叫B4-5。

**回到附件舊程式會恢復無gate的新北搜尋、預設停車／重送及純Flex無fallback風險**；不能將它自動視為安全回復目標。應預先指定保有安全gate的已驗版本，或由核准的維護入口停止新查詢；不能為回復而改正式座標／狀態來掩蓋問題。未有可證明的舊deployment時不填猜測版本、不執行切換。

監控最少涵蓋signature／origin拒絕、duplicate／unknown／pending、分類錯置／重複停車、LINE400／429／5xx、TDXauth／輪替、Maps備援／quota、Sheets格式與發布拒絕、latency／容量。正式異常時按預先批准門檻停止新query／切回已驗版本，保留稽核；不自動追加push、重試未知reply或回寫資料。

本輪只產出可審查差異與計畫。下一階段需要核准的是：補唯讀部署證據、限定範圍離線patch／安全修復、隔離LINE／GAS驗收；正式部署／Webhook切換／屬性或Sheets寫入都仍須各自明確授權。
