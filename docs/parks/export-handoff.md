# 一次取得四表：唯讀資料交接與現況

日期：2026-10-19（Asia/Taipei）。分支 `feature/flex-message-v2`，基準 `dc768dd`。

## 使用者只需交付一個檔案

**請用已登入 Google 的瀏覽器，開啟公園試算表，選「檔案 → 下載 → Microsoft Excel（.xlsx）」，然後把下載的檔案附加到 Codex 對話。**

不需要在 GAS 執行任何函式，不需要提供 Token／密碼，也不需要讓試算表公開。下載不更改正式資料或部署。

亦可開啟本機 [唯讀下載工具](../../tools/park-export-readonly.html)，貼上 **Google Sheets 網址**後按一次下載按鈕。工具只產生 Google 官方原生整本 XLSX 匯出網址，不使用其他網站、不保存帳密。已知的 Apps Script 指令碼 ID 不能代替試算表網址。Google 仍會依你瀏覽器的帳號檢查分享權限；本機測試未驗證這本私有試算表的實際下載。

下載檔案需包含下列完整分頁，不要刪除公園列、修正座標或更改審核狀態：

- 公園資料
- 公園座標候選
- 公園設施
- 公園座標品質檢核

Google 原生匯出是整本活頁簿。如果還有不應分享的個資分頁，可在**本機副本**只保留上述四頁，再附加本機副本；不要為了交接刪改正式試算表。匯入工具只讀四個指定分頁，其他頁不納入資料或報告。

## 本次實際存取檢查

| 檢查 | 實際結果 | 意義 |
|---|---|---|
| 執行分支／基準 | feature/flex-message-v2／dc768dd | 基準符合 |
| Sheets API 網路 | CONNECT 成功，Google 回應 400（根路徑探測） | 先前的代理 403 已不再是這次的首要阻礙；不代表資料讀取成功 |
| Sheets API 實際工作簿 metadata 讀取 | HTTP 403 PERMISSION_DENIED，一次失敗後轉離線、未重試 | 尚未取得可用 API 存取，不等於代理網路封鎖或試算表擁有者拒絕分享 |
| 可用 Google Sheets／Drive connector | 沒有 callable connector | 不能假設聊天中已有 Google 授權 |
| GOOGLE_APPLICATION_CREDENTIALS | 變數存在，但所指 JSON 沒有任何欄位 | 不包含可用憑證；未列印值 |
| ADC 取得 Google client | 缺少 client_email，失敗 | 不能以 ADC 授權讀表或 Drive |
| clasp | Not logged in | 尚未取得帳號授權 |
| Git 歷史所記試算表的原生唯讀匯出 | HTTP 401 | 私有資料需要帳號／分享權限，未重試或索取 Token；歷史 ID 也尚未證實就是目前目標 |
| /workspace 與可讀取的 /tmp 使用者目錄 | 未找到四表完整 XLSX／CSV／JSON；僅程式及合成測試紀錄 | 尚無真實資料可稽核；受保護的 daemon 目錄不可讀，未將它當資料來源 |

本次未啟動 Google 登入、未要求 Token、未改變網路設定、未修改任何正式 Sheets、GAS 部署或 LINE Webhook。

## 收到檔案後由代理自主處理

下列是開發者操作，**不要求使用者逐項執行**：

```bash
# Python 3.12.14、openpyxl 3.1.5、Node.js 24.19.0 已在本次環境使用
# 如另一環境缺套件：python -m pip install -r tools/requirements-park-export.txt
mkdir -p .local
python tools/import-park-workbook.py .local/parks.xlsx .local/park-export.json
node tools/park-verify-export.mjs .local/park-export.json .local/park-verification
```

1. 保留原始檔與 SHA-256。四頁缺漏、欄名空白／重複、未命名資料欄、過大檔案、無效 mapping 均停止匯入，不輸出假完整資料。
2. 保留數字／文字、日期 ISO 值與原工作表列號；不把空值、錯誤座標或公式計算成零。公式只讀取 Excel 內既有快取結果，另外標示缺少快取的位置，絕不自行執行公式。日期未強加時區，匯出時間／Google revision 未知會明示為 null。
3. 初次若候選欄位名稱與程式不同，由代理檢視真實欄名，建立明確對照，再加 `--mapping .local/column-map.json` 重匯入。mapping 為 `{ "candidates": { "候選緯度": "實際欄名" } }`，保留原欄不覆蓋；不需要使用者改表或重跑 GAS。
4. 完整性檢查預設 635 筆新北正式資料及 635 筆候選、ID 唯一、兩邊 ID 集合一致、沒有缺漏 ID。若筆數與歷史不同，保留實際資料並調查，不湊數或刪掉多的列。
5. 產出逐筆 A/B/C、異常原因、官方地址／行政區、Google 地址、正式與候選座標及距離差。正式公園缺少候選時也會在逐筆報告出現。設施同 ID 多列保留且合併，不當作主表重複鍵。
6. 只有母體覆蓋檢查通過、且恰有一筆無效候選時，才指定完整母體中的「唯一無效候選 ID」。不能從兩筆樣本或歷史合計推算這個 ID。
7. 代理再按逐筆異常，以可信公開資料交叉查核，優先使用來源欄所指的官方公園資料、政府管理單位頁面與官方 GIS。每筆保存來源 URL、查閱時間、支持的是身分／園區邊界或入口。門牌或園區中心證據不能單獨證明入口；找不到證據就保留人工審核。
8. 產出副本同步差異與實際 API 驗證需求。保持正式資料無寫入。

輸出目錄必須是新的；輸出檔權限為 0600、目錄 0700，`.local/` 已被 Git 忽略。CSV 對公式起始字元加保護，JSON 保留原值。原始工作簿不會被工具儲存或覆蓋。

## 產出內容

- `quality-report.json`：原有完整品質檢核與來源檔雜湊。
- `parks-all.csv`：每個正式公園的座標分級與差異（缺少候選也列出）。
- `manual-review.csv`：尚未通過匯出值預檢的人工清單。
- `failed-location.csv`、`high-risk.csv`、`district-conflicts.csv`、`unmatched-candidates.csv`。
- `duplicate-coordinates.json`：候選／正式座標交叉的多 ID 共址群組。
- `public-crosscheck-pending.json`：待公開來源驗證的證據表，預設全部 PENDING、入口未確認；**工具不會冒充已查核**。
- `verification-receipt.json`：四表列數、覆蓋檢查、唯一失敗是否真正證實、來源 SHA-256 與公式證據。
- `copy-sync-plan.json`：僅供副本的同步計畫，正式寫入未授權、真實 Sheets 寫入未驗證。
- `README.md`：該次實際結果與限制。

CLI 成功退出只代表完成檔案分析；資料品質未通過、公開資料查核未完成，或副本 API 寫入未驗證，都不會被改成已驗收。

## 本次可驗收範圍與資料缺口

公園離線測試 **121／121 通過**（含本次新增 13 項匯出與整合測試），Worker **25／25 通過**，均無失敗或略過；GAS／Node／Python 語法檢查通過。實際輸出見 [export-test-results.txt](export-test-results.txt)。

一次下載、四表匯入、母體完整性檢查、報告與副本計畫產生器均有離線測試，含 **635 筆明確標示的合成資料**。該合成案例的 NP-635 只為故障測試，**不是已查出的真實失敗公園**。

真實 635 筆尚未取得；因此真實 A/B/C 數量、唯一無效 ID、實際重複座標與跨行政區名單、可信來源逐筆交叉驗證都尚未完成。不能拿歷史 348／242／28／17 定位類型或合成測試補齊。Google Sheets 的實際副本寫入也尚未驗證。

目前所需外部動作只有：**附加一次下載的四表 XLSX 檔**。取得後可繼續自主執行，不需要使用者逐一執行 GAS 函式。
