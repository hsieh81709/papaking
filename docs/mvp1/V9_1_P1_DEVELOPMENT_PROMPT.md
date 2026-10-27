# V9.1 P1 開發指令（待使用者核准後交付執行）

你是PapaKing GAS／LINE開發工程師。請先讀：

- `docs/mvp1/V9_1_CURRENT_STATE.md`
- `docs/mvp1/V9_1_IMPLEMENTATION_PLAN.md`
- `docs/mvp1/V9_1_TEST_PLAN.md`
- `docs/mvp1/TOILET_SOURCE_RELEASE.md`

## 授權範圍

本指令僅在使用者明確核准P1後生效；P0產出文件不等於已取得開發或部署核准。只在 `feature/flex-message-v2` 或其衍生工作分支離線開發，先核對實際HEAD與工作樹。程式基準fb069a7（正式V9依使用者clasp證據），若HEAD只有P0文件則記錄差異，不把文件Commit誤當不同正式程式。不得假設可直接讀正式GAS／Sheets／Rich Menu。

## P1目標與順序

1. 先建立可重現失敗的合成fixtures與測試。核對schema九欄、三類身分（尤其停車來源ID／obs）、原message event hash固定值與本人postback三層缺口。
2. 建立六格Rich Menu離線JSON／圖片模板及驗證工具。三類搜尋用既有message；傳送位置回既有location Quick Reply，不重設TTL；問題回報／使用說明不落入unknown或默認停車。官方規格如仍CONNECT403，記錄未驗證、保持draft，勿以猜測規格發布。
3. 停車、公園、公廁Flex加🅿️／🌳／🚻，保留原色／導航／距離／品質提示。公廁從原進入限制抽取明確樓層為「所在樓層」，未知不猜、剩餘限制不遺失，不改來源row／指紋，不新增明細join。
4. 加回報卡片按鈕／最近結果選擇／五類問題／確認頁。P1不收自由文字或圖片，其他先記其他待人工查核。每筆帶原設施類型及ID；無官方ID停車用明確obs ID，不能把名稱或座標假裝官方ID，不為補ID額外呼叫API。回報不生成新導航或把未發布資料加入搜尋。
5. 只為本人DM與受支援namespace開放postback，完整驗證event、replyToken、data、timestamp；postback hash含data／params，**保持原message hash完全相同**，以現有event fence派送、原reply fence回覆。
6. 新增獨立有界context與九欄回報adapter，`PK_REPORT_ENABLED`缺值預設false。只用mock Sheets測append；不自動建表。穩定report ID、同context重按、不同event、並行鎖、每日20／每分鐘3限制、已寫未回覆、UNKNOWN處理全部按計畫測試。避免巢狀ScriptLock；不宣稱跨服務exactly-once。
7. 新附加功能失敗只能使回報降級，不能讓已可用搜尋失效。不得刪／弱化原643項斷言。開發期間只測受影響模組；程式固定後跑一次完整回歸與GAS語法／載入／全域名稱／diff／敏感值檢查，並將新增test/v9_1套件納入既有offline-tests CI，不移除原job。
8. 交付程式與檔案清單、before／after測試、完整回歸結果、合成Flex／六格JSON、context／九欄寫入契約、設定規格、Commit、正式前阻擋與原版本9回復方案。回報及Rich Menu發布工具必須dry-run預設，不能默默呼叫外部寫入API。工期以7–8工作天為基準，超出範圍先說明。

## 保護條件

- 停車1km／原TDX／NTPC／基隆／Google與行車排序保持；允許最小metadata投影，不改去重或排行鍵。NTPC_STATIC不補導航。
- 公園與公廁3km／最多5筆及導航不變。新北公園仍須人工核准；公廁source-unverified及撤銷／失效阻擋、UNKNOWN顯示不變。
- 個人LINE User ID、一對一限定、事件去重、月額度與Flex同快照備援不放寬。postback擴充不是擴大使用者權限，也不是LINE驗簽。
- 不修改sponsor-worker、park_geocoding、B4-3／B4-5、正式Sheets／Properties／LINE Rich Menu／Webhook；不部署、不建立GAS版本、不合併main、不新增Bot／GAS副本、不啟用付費資源。
- manifest如需不同授權，僅列必要理由與設定差異，不自行對正式環境授權。Token／User ID只用無法通過正式驗證的合成值，禁止將秘密寫Git、產物或log。

## 停止與下一階段

P1只到可審閱的離線候選。缺實際官方Rich Menu限制／正式表頭／LINE管理權時仍完成可安全離線部分，標待確認；不得為解除阻擋放寬安全或發布規則。完成後停止，等待使用者另行核准正式GAS部署、LINE選單建立／圖片／本人綁定與首次正式回報寫入；不可把本指令當這些操作的授權。
