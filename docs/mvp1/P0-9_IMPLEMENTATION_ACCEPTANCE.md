# P0-9 最小修復實作驗收（2026-10-22）

分支 `feature/flex-message-v2`；本輪基準 `d87b47f`。既有最小修復程式在 `eec65cc`，並非只有規劃文件；本輪直接補程式缺口，沒有重做manifest／正式版本盤點。未推送、部署、合併或存取正式服務。

## 已修復與沿用

- 保留停車1km、TDX／NTPC／基隆、行車時間、導航及Static Fallback；臺北公園與既有遊具、公園／公廁3km／5筆／跨市排序及Flex沿用。P0-8附件的20項停車契約差異，在目前開發程式的72項停車回歸已通過，沒有以附件舊版覆蓋新程式。
- 新北公園及雙北公廁繼續使用來源指紋＋人工核准gate；候選或未核准資料不會因這次修復發布。兩個搜尋引擎、原9筆正式座標及核准條件未修改。
- 沿用事件ID／channel持久去重、事件語義衝突檢查、ScriptLock、月額度／TDX計數保留、分類版本／逾時／較舊事件阻擋。原11項安全規格離線通過，但不宣稱正式安全驗收完成。
- **本輪新增回覆發送限制**：在LINE HTTP前持久保存replyAttempts；主回覆只能一次。只有已知400拒收且與主回覆前保存的文字指紋一致，才准一次text fallback。200、429、5xx、未開始主回覆及第三次嘗試均拒絕。備援不重新查資料／TDX／Maps，也不改push。
- **本輪新增損壞狀態驗證**：events／intents必須是物件；事件必須有合法hash、時間及狀態。先驗證再GC，不能把壞紀錄刪掉後假裝沒有處理過事件。損壞時保留原始Properties內容、回unavailable、零查詢／零LINE。

回覆限制是在既有handler意外重複呼叫或錯誤備援路徑下的額外保護，不把故障注入的8個測試誤稱已發生的8次正式事故。手動／離線直接呼叫回覆formatter不具Webhook owner；正常doPost事件必須先claim才有發送權。

## 實際紅綠測試

| 階段 | 結果 |
|---|---:|
| 本輪修改前受影響基準 | 382／382通過 |
| 新增缺口測試，修改前 | **0／8，8 fail**；全部為安全斷言失敗 |
| 修復後受影響合併批次 | **390／390，fail／skip／cancelled 0** |
| 補強「400備援內容遭更改」斷言後局部再驗 | 8／8通過，包含於上述390，不能重複加總 |
| 停車固定回歸 | 72／72，包含於390 |
| 原P0-4安全規格 | 11／11，包含於390；修復前11紅燈仍保存於前輪證據 |
| GAS語法／diff | 兩個修改JS檔node --check、git diff --check通過；六檔720種載入順序在受影響preflight通過 |

命令：

```sh
node --test --test-reporter=tap test/p09/*.test.mjs test/security-spec/*.test.mjs test/line/*.test.mjs test/parking/core.test.mjs test/parks/webhook-routing.test.mjs test/parks/line-fallback.test.mjs test/preflight/*.test.mjs test/facilities/taipei.test.mjs test/facilities/search.test.mjs test/parks/search.test.mjs test/parks/mvp.test.mjs
```

只執行受影響模組與安全測試，沒有刪除／放寬既有斷言。本輪未跑所有歷史維護／Python／Worker測試，也沒有手機、LINE官方schema、真GAS鎖定或端對端；發布前仍需固定候選後完整回歸及必要手機驗收。現有CI自動納入新增test/p09檔案，未變更CI或Worker。

證據在 `.local/mvp1-p09-followup-20261022/`：baseline.tap、new-red.tap、after.tap、fence-final.tap、capacity.json及完整patch／Commit收據。所有來源與服務均mock，沒有正式網路呼叫。

## 修改檔案

- `gas/line_webhook_gas.js`：先建立同快照備援；主回覆與fallback分別申請durable發送權，記錄HTTP結果。
- `gas/webhook_state_gas.js`：狀態驗證、replyAttempts／replyCode／fallbackHash准入檢查。
- `test/p09/reply-fence.test.mjs`：8個新案例，包含原快照內容更改、異常狀態保留與零副作用。
- 本驗收報告及 `docs/PROJECT_STATUS.md`：更新實際開發狀態。manifest、搜尋／設施adapter、park_geocoding、B4-3／B4-5、sponsor-worker保持不變。

Git回復使用本輪Commit的 `git revert <SHA>`，僅在開發分支產生反向Commit，不回寫正式服務或資料。既有eec65cc基礎修復仍保留。

## 最小驗簽入口與尚未解除的阻擋

已有未部署的 `line-ingress/handler.mjs`：驗LINE原始bytes簽章後，只轉送一次含audience、channel、時效及HMAC的envelope；GAS只接受正確envelope，沒有裸body後門，回傳signed ACK。公開GAS的新handler可拒絕未授權業務呼叫，但不能阻止匿名請求消耗GAS執行資源；任何仍可達的舊部署也可能繞過新handler。正式version7完全未改，**不能宣稱正式環境安全修復完成**。不建立DO、DB或queue，不修改sponsor-worker。

仍需解除：

1. 帳本容量／成本與平台驗收：單一scope的32個menu完成後為**7709 bytes**，第33個拒絕；上限7800 bytes／32 events／16 scopes任一先到拒絕。新增備援指紋、多人與位置事件可能更早滿，未決事件不能自動刪除；不是已可公開營運的容量設計。
2. 獨立入口平台、限流、秘密管理、舊部署防繞過及公開GAS資源DoS；跨Script／舊writer的API計數及每日provider費用上限仍待核定。
3. 隔離真LINE驗簽／GAS重送、並行、redirect與timeout／回覆未知／手機導航，加上發布前完整回歸。
4. 新北公園／雙北公廁仍需逐批人工核准資料；本輪沒有核准或更新正式座標。已知正式source版本對應尚未證實的限制不因本輪離線修復消失。

## 下一步最少使用者操作

目前不需要逐一執行GAS函式。下一階段只需先批准使用**隔離GAS專案＋LINE測試頻道＋獨立驗簽入口**進行實測，並核定首發流量／容量與費用限制；秘密由管理者配置於隔離環境，不貼聊天。容量不合格時先提出最小擴充差異，不直接加大、刪帳本或啟動大型原型。正式Webhook切換、正式部署及資料核准表寫入仍須分別另案明確核准。

本輪完成後停止等待核准。
