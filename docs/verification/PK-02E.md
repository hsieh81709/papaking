# PK-02E：新北635公園座標人工審核表

日期：2026-10-20。只建立人工審核工具；不執行網路查詢、B4-5、GAS部署或任何正式寫入。

## ODS 主來源驗收完成

使用者已明確指定《PapaKing 生活設施資料庫.ods》為PK-02E主要輸入，**不再要求XLSX**。來源SHA-256為 `16d204f96d56e0d916fd7c414675ca77f1394cfb1eb20324f068f83f96ec444c`。

重新唯讀解析ODS，逐ID核對既有635筆審核表的名稱、行政區、地址、正式與候選座標、原品質分級、補充分級及原因、共點組與來源列號；並完整重建核對664筆品質檢核／人工修正歷史（含原始JSON）。結果 **0筆差異、635個唯一ID**。`ODS_PRIMARY_INPUT_ACCEPTED`代表來源一致性驗收完成，不代表座標正確、人工核准或正式發布。

為保留人工內容，不覆寫上一版審核表：另存`.local/parks-pk02e-20261020/ods-primary-accepted/`。新舊XLSX只變更使用說明、統計頁的來源註記及文件subject；其餘ZIP項目逐位元一致，包含全部人工輸入、來源欄、歷史、公式、超連結、資料驗證與保護。原ODS及既有XLSX前後雜湊不變。若未來核對發現差異，工具僅輸出逐筆差異CSV與回執，不產生取代工作簿。

原ODS三個必要分頁及既有B4修正記錄實際唯讀解析；舊ODS補充分級報告也實際讀取。使用補充分級前逐ID比對名稱、行政區、地址、正式／候選座標、Google回傳地址及定位類型；不一致即拒絕使用舊分級。若沒有補充分級，可不帶該參數直接從原始檔重建格式、共點、地址／行政區及定位風險；本次已實測不使用舊報告也可重建635筆、23組及62筆C級，並非假裝成果已存在。

## 交付結構

- `PapaKing_NTPC_635_Park_Coordinate_Review.xlsx`：使用說明、審核表、審核統計、高風險優先審核、既有人工修正紀錄、隱藏下拉選單。
- 635筆基礎CSV、62筆高風險CSV、README、來源雜湊與完整驗證JSON。
- 使用者資料與最新驗收產物保留在`.local/parks-pk02e-20261020/ods-primary-accepted/`，不提交Git；`final/`為保留的舊版。

主表包含要求的23欄，另加正式座標保護、共點群組及三個來源列號，讓ID／資料對應可查核。原品質分級保留來源品質表原文；補充分級為A40/B533/C62。這不是審核核准。

前8筆依序為NP-12、NP-112、NP-333、NP-480、NP-495、NP-541、NP-551、NP-595；其他C級接續，合計62個唯一ID。共點23組／54個ID按集合計數，支援同ID多組標記，不以群組數相加當公園數。

9筆正式保護ID是NP-9、12、112、333、480、495、541、551、595。正式值原樣保留且鎖定，這些列的修正緯經度也鎖定，決定下拉不含採用候選或人工修正。其他人工輸入欄為綠色，來源欄鎖定；全部新一輪狀態都是待審、決定及修正座標空白，位置類型為未知。歷史已確認只在唯讀歷史頁保留，不帶入本輪決定。

有效候選634筆有真正Hyperlink，使用https Google Maps search及URL編碼；NP-480缺值不產生座標連結。所有635筆另有名稱＋新北市＋行政區搜尋連結。連結只供人工比對，不代表入口或核准。高風險頁的ID以內部連結跳回主表，不建立第二份可編輯輸入。

主表凍結標題列及前兩欄、篩選、4類條件格式、8個資料驗證規則（4組下拉來源、經緯度、日期及證據URL）。工作表保護防誤改，不是加密或防惡意修改機制。統計及高風險頁有562個內部公式，無HYPERLINK公式、巨集、外部活頁簿連結或資料連線。

## 驗證結果與邊界

22項工具測試通過（含新增5項：保留人工內容與設定、座標差異、品質歷史差異、人工欄不誤判為來源差異、差異時不產生取代工作簿），包括635／重複與缺漏ID、三表名稱不符、舊分級證據變更、優先排序、連結編碼、無效候選、保護欄、來源文字不作公式，以及合成XLSX讀回且來源不變。

實際ODS主來源驗收版重新開啟後17,778個檢查點全部通過：635唯一ID、每個來源欄依ID對齊、634有效座標連結、635名稱連結、9個保護ID、62高風險、23組54ID、優先八筆、人工欄初始空白、下拉對應與562個公式結構。原始ODS與輸出檔經驗證前後SHA-256不變。

**沒有以Excel或LibreOffice計算公式、沒有GUI操作驗收。** openpyxl未計算公式快取，檔案設定Excel開啟時重算；公式結構與Python預期統計已核對。超連結實際開啟、下拉操作、凍結捲動、篩選與鎖定的介面效果均標示待驗；上述設定與對應範圍已通過檔案結構檢查。ODS是指定主來源，無需另提供XLSX。

本輪沒有改動`gas/`或`sponsor-worker/`，也未重跑既有公園／停車／Worker測試；它們的舊通過紀錄不冒稱本輪執行。新增review測試已加入既有CI，actionlint及Python語法檢查通過；遠端Actions未讀回。

## 重跑

```bash
# 驗收既有審核表；NEW_ACCEPTED 不得已存在，絕不覆寫人工內容
python tools/accept_park_review_ods.py '/path/PapaKing 生活設施資料庫.ods' \
  '/path/PapaKing_NTPC_635_Park_Coordinate_Review.xlsx' NEW_ACCEPTED \
  --supplement .local/parks-ods-20261020/final/parks-quality.json
python -m unittest discover -s test/park_review -v
# 下列只適用尚未人工填寫的空白範本
python tools/validate_park_review.py \
  NEW_ACCEPTED/PapaKing_NTPC_635_Park_Coordinate_Review.xlsx \
  NEW_ACCEPTED/source-and-build-receipt.json --source '/path/database.ods' \
  --supplement .local/parks-ods-20261020/final/parks-quality.json --output NEW_VALIDATION.json
```

驗收工具本身不需要build回執；`source-and-build-receipt.json`與其他成果檔由本次交付流程另行附上。舊生成器的`--allow-ods-draft`保留歷史相容性，其舊草案標籤不能當成最新驗收狀態；最新狀態以ODS驗收工具的`ods-primary-acceptance.json`及新工作簿為準。

來源讀取只需要公園資料、候選、品質檢核三表；人工修正分頁依有公園ID的B4／人工／修正表保留。來源缺漏、ID不恰為NP-1～635、跨表名稱不符或已知正式保護集合異常會停止，不丟列或補造ID。

`validate_park_review.py`只驗證新產生的空白審核表，不是已填回結果的正式匯入器。人工填寫後須另核對ID、來源指紋、證據與複核決定；本輪沒有任何同步或自動核准路徑。
