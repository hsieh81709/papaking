# 個人發布候選：實際離線驗證

2026-10-22（Asia/Taipei）；基準747622c。只本地合成資料、mock HTTP／Maps／Sheets／LINE，無正式API呼叫或部署。原始ODS／CSV／正式資料未修改。發布／回復操作見[手冊](PERSONAL_RELEASE.md)。

| 執行 | 結果 |
|---|---:|
| 新個人模式初稿，修改前 | 20項：5 pass、15 fail（未實作直連，拒絕路徑已有部分通過） |
| 個人模式完成與補充quota／privacy／signed-owner案例 | 23／23；其中1項是已知偽造ID風險刻畫 |
| 開發期間受影響套件 | **413／413，0 fail／skip** |
| 固定執行程式後一次完整Node回歸 | **533／533**：LINE、公園、共用設施、停車、preflight、安全、P09、personal |
| 官方來源工具Python | **33／33** |
| 人工審核工具Python | **22／22** |
| 既有Worker離線測試 | **25／25**；未修改sponsor-worker、不安裝／更新依賴 |
| 完整回歸合計 | **613／613，0 fail／skip**；包含已知風險刻畫1項，非613項安全驗簽通過 |
| 語法／Git | 14個JS／MJS node --check、git diff --check通過；six-file preflight 720種載入順序通過 |

413為完整613的子集，不重複加總。個人23也包含於Node533。正式GAS、LINE官方格式驗證、手機、真實並行／重送、發布核准資料與導航均**未實測**；完整離線回歸不等於正式端對端驗收。CI已納入personal套件但未推送／遠端執行。

## 新增斷言（沒有刪除或放寬既有測試）

- 本人DM三分類可查，不需origin secret、第二GAS／Bot／Sheets；其他使用者、本人group／room、偽裝group欄位、缺身分、他人id命令零query／reply／ledger寫入。混合batch不讓他人事件影響本人分類。
- 缺／錯／多值owner、錯mode、無secret自動降級、非正整數budget均拒絕；kill switch停止；選填destination pin、signed模式owner filter亦驗證。
- 相同event redelivery／新replyToken不重查、不消耗新分類、不延長TTL；改body.destination不能繞過事件namespace；月quota真實reservation函式在owner fixture內不因重送重扣。
- Flex400原快照一次fallback、不重新搜尋；缺發布清單的NTPC park與雙北toilet沒有Maps導航；原search／施設gate與臺北遊具測試原樣保留。
- DONE容量在660秒邊界後才釋放，60秒future事件在最後仍有效時依然去重，過期後永遠不當新事件；UNKNOWN不因短保留期刪除。原signed24h及原11安全規格仍通過。
- ledger不含原始owner ID／座標／replyToken；真實owner ID不在repo，範例只有無法通過驗證的佔位符。
- **已知風險刻畫：** 直接偽造允許ID、無LINE簽章仍可query，測試pass代表風險被重現。這是個人直連模式的限制，不把User ID當驗簽、不宣稱入口安全已完成。

## 命令與證據

完整回歸（四組各執行一次，程式碼之後未再更動）：

```sh
node --test --test-reporter=tap test/line/*.test.mjs test/parks/*.test.mjs test/facilities/*.test.mjs test/parking/*.test.mjs test/preflight/*.test.mjs test/security-spec/*.test.mjs test/p09/*.test.mjs test/personal/*.test.mjs
python -m unittest discover -s test/park_sources -v
python -m unittest discover -s test/park_review -v
(cd sponsor-worker && npm test)
```

本地 `.local/personal-release-20261022/` 保留personal-before.tap、affected.tap、full-node.tap、full-park-sources.log、full-park-review.log、full-worker.tap、syntax.json及VALIDATION.json；完整diff與Commit收據隨最後保存。測試前15紅燈與測試後23通過可分辨，不把修改前5個拒絕測試通過誤稱功能已完成。

[結構化測試回執](PERSONAL_RELEASE_TEST_RECEIPT.json)、[六檔來源hash](PERSONAL_RELEASE_FILES.json)。發布包只含六個serving `.gs`、範例設定、hash及使用說明；沒有自動部署或修改設定的程式。手動手機回執模板見[PERSONAL_MOBILE_SMOKE.csv](examples/PERSONAL_MOBILE_SMOKE.csv)，全部預設NOT_EXERCISED，沒有冒填真實結果。

本次修改：gas/line_webhook_gas.js、gas/webhook_security_gas.js、gas/webhook_state_gas.js；新增test/personal/direct.test.mjs與範例設定；更新CI個人測試清單及README／狀態／發布文件。停車核心、兩個搜尋引擎、facility_line、park_geocoding、B4-3／B4-5、manifest、line-ingress及sponsor-worker不變。未修改原9筆座標或任何正式核准狀態。

要回復本機開發變更，可於乾淨分支 `git revert <本輪Commit>`，不重寫歷史；不會操作正式版本7或資料。正式切換與回復需依手冊另案核准。
