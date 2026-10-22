# P0-9 發布及回復手冊（計畫，尚未執行）

2026-10-22（Asia/Taipei）。**目前不可直接部署。** 版本7由使用者人工確認，內容hash／deployment ID尚未對照；正式manifest尚未收到。詳見[修復與阻擋](P0-9_REPAIR.md)。本手冊不構成任何正式操作授權。

## 先備份與固定證據

1. 唯讀匯出version7對應全檔及manifest，而不只編輯器HEAD；記錄Script ID、deployment ID、URL、version、executeAs／access、trigger與其他Web App部署。每檔SHA-256，留受控加密備份，公開報告只放hash與設定名稱。
2. LINE現有Webhook設定與回復目標由管理者保存；秘密／token值不進Git或聊天。Script Properties的quota、QUOTA_SALT、來源設定與其他狀態另存受控備份；不清空或重生quota salt，不複製正式憑證到合成測試。
3. 固定候選Commit、六個serving檔hash、manifest／scope差異、獨立入口版本與secret key識別資訊。維護用B3、B4-3、B4-5不隨功能整包覆蓋，P0-8同名geocoding差異另案保存。
4. 保留資料發布核准／來源指紋版本；不改任何原9筆座標、不批次同步。本輪不取得資料寫入授權。

## 隔離驗收關卡

- 平台、流量／保留期、低容量方案、秘密管理、成本與DoS取捨須先核定；32事件只是本輪保守上限。不得在不合格容量下正式切換。
- 在獨立GAS／LINE測試頻道配置六個serving檔及隔離audience／origin secret／LINE channel／token，使用合成Sheet或另案明確核准的小批公開點；不匯入合成核准表到正式資料。
- 真實驗證LINE header/body、direct GAS裸body拒絕、signed ACK、Google redirect、8秒timeout、錯MAC／過期／錯頻道、重送／交錯與Properties寫入失敗。觀察每次外呼、月額度、TDX次數、LINE attempt及回覆未知狀態。
- 驗證已知停車／NTPC Static Fallback、臺北公園暨遊具、新北已核准公園及雙北各一個已核准公廁。UNKNOWN／入口標示／地圖目的地與資料錯誤提示需手機實測。
- 固定來源及資料後，發布前執行完整歷史自動化回歸一次，包含安全CI；不能用本輪受影響測試數取代。若新改動再產生風險，修復並補相關回歸。

## 正式切換（以下均待另案明確核准）

1. 批准精確候選SHA／manifest／scope、獨立入口平台／成本／限流與正式設定；指定操作窗口與可恢復目標。若缺version7映射或安全回復包，停止。
2. 盤點並控制**所有舊公開部署**，含其他deployment URL與trigger。舊handler可以繞過新入口時，無法宣稱已安全切換。所有quota／TDX writer需採同一鎖定與計數協定，不能新舊部署並行。
3. 在隔離驗收後，按照批准順序準備獨立入口與新GAS部署；配置不同的origin secret／audience。直接LINE→新GAS會被拒絕，不能單獨把新doPost覆蓋正式入口後繼續沿用直連。
4. 最終核准後才切換正式LINE Webhook至驗簽入口，確認實際簽章驗證與GAS signed ACK；逐類公開測試點做有限smoke，不執行批次地理編碼。表列資料核准配置／匯入仍需獨立核准，本輪禁止。
5. 舊Cache分類不移轉，使用者重新選類別。保留月額度、QUOTA_SALT與事件ledger；不要重置未決事件來讓測試通過。若測試失敗或需要回退，立即停止新增工作／切維護模式，走下節計畫。

## 監控與事故處理

只記去識別事件hash、狀態、版本、拒絕類型、計數與延遲；不記raw body／位置／LINE response body／token。監控：入口驗簽失敗、origin拒絕／不可用、GAS錯誤、lock逾時、狀態bytes／event／scope容量、RECEIVED／STARTED／UNKNOWN、query及LINE各狀態、400 fallback、月／TDX額度與provider成本。

容量將滿或UNKNOWN增加時停止新准入並告警；不能刪帳本／改event ID重跑未知query。`RECEIVED`亦可能因接收後崩潰而未執行，本方案不自動恢復；須人工判讀並請使用者發起新的操作。未建立監控平台或寫任何正式日誌設定，本節只列操作規格。

## 回復

- **版本7僅為人工識別參考，並非已驗證的安全回復目標。** 先比對完整source／hash、manifest、deployment ID；不要拿P0-8附件重建並稱為version7。
- 新入口維持驗簽與限流。回復應指向已驗證可接受相同origin envelope與資料核准gate的相容安全版本；原version7若沒有這個邊界，不能直接當成同等安全回復。
- 若只有舊直連版本可用，停止／維護模式優先。恢復舊公開URL、取消驗簽、LINE改回直連或重新開放其他舊部署都會恢復已知風險，必須先另行提出風險並獲明確核准；不可自動執行。
- 保留pk_state_v1及月額度／rate reservations。未知事件與LINE投遞不盲目重試、不改用push；secret輪替需先確認在途envelope的期限及部署版本，不能任意刪除狀態。
- 回復服務程式不回寫Sheet或重同步座標。若需任何資料恢復，另案提出逐筆差異、備份與確認。

## 本機開發回復方式

本輪程式只在開發分支提交，不推送。可用 `git show <P0-9 Commit>` 審閱、`git diff 51f5f52..<P0-9 Commit>` 比較；若使用者決定撤銷，於乾淨開發分支執行 `git revert <P0-9 Commit>` 產生反向Commit，不重寫歷史。這只回復Git，不操作正式GAS、LINE或資料；也不代表撤回後程式安全可部署。
