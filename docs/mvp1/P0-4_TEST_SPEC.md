# P0-4 安全測試與驗收規格

2026-10-21 UTC；來源fbd1abe/runtime855f5f2。**本輪只建立安全測試與規劃，11個安全缺口仍未修復。**

## 已持續可執行的紅燈

```sh
node --test --test-reporter=tap test/security-spec/*.test.mjs
```

實際結果：11 tests／0 pass／11 fail／0 skip／0 cancelled，退出碼1。失敗為安全 `ERR_ASSERTION`，不是工具或網路問題；R1–R10與C1各一項。不能用 `|| true`、skip、todo或expected-failure包裝將此命令當release gate成功。檔案放在獨立security-spec套件，不更動目前既有功能CI；下一階段修復時加獨立blocking安全job，不部署。

| 案例 | 已實跑的安全預期 | 修復前觀察 |
|---|---|---|
| R1 | 第一次停車確實委派1次，重送同分類／位置仍僅1次 | 2次 |
| R2 | 舊位置不查新類別，保留toilet選擇；fresh L2才能查 | 已提前委派toilet |
| R3 | 相同failed event不可盲目再查 | 2次 |
| R4／R5 | 模型重疊時，同事件公廁／停車各僅1次query | 各2次 |
| R6 | 舊完成與新選擇交錯仍保留park | expired |
| R7 | 分類交錯必須保留較新完整park | unknown |
| R8 | unsigned直打GAS零query、零LINE送出 | parking1次且有LINE mock送出 |
| R9 | 所有准入各有reservation；允許鎖超時拒絕，不能准入漏記 | 准入2，counter1 |
| R10 | 有限批次11事件接受後必須全處理／入帳 | 處理10仍OK |
| C1 | 所有TDX key grant各記1次；允許拒絕，不能grant漏記 | grant2，counter1 |

這些測試利用現有P0-2 VM driver與可控重入hook，不是真正跨程序／GAS併發。未來改動至驗簽job與DB權威後，需將fixture driver、狀態觀測與交錯注入點對應新邊界，**保留行為與安全斷言**；不能因新auth拒絕全部正常事件而假通過R1–R7。R1明確先斷言合法第一個query成功，R6／R7驗證交錯hook實際發生；未來新adapter亦需等價前提與R8拒絕測試分開。

P0-3 `test/preflight/delivery-risks.test.mjs` 是原始風險刻畫，未刪除修改；修復後可以轉為安全斷言或以新adapter取代舊刻畫，需保存此基準TAP與一對一案例映射。不能讓風險刻畫的35項綠燈掩蓋本輪11項紅燈。

## 下一階段補充測試規格（尚未執行／未實作）

| 編號／階段 | 固定fixture／故障注入 | 必須觀察與拒絕條件 |
|---|---|---|
| S01 I1 | 正確、缺失、錯誤、錯頻道、重複signature header；缺secret | 只有正確簽章可入帳；其餘零DB工作／query／LINE，缺配置不可fail open |
| S02 I1 | 含中文、emoji、CRLF、空白、不同JSON鍵順序、相同語義不同bytes；固定獨立HMAC測試向量 | 驗原始bytes；重寫body的簽章失敗；不能使用待測函式自行產生所有expected MAC |
| S03 I1 | 大body、錯encoding、錯schema、空events驗證請求 | 明確HTTP結果；有限記憶體；空events零副作用成功；超限不得先parse或默默截斷 |
| S04 I1 | origin裸body、錯kid／aud／MAC、過期、future timestamp、nonce replay、operation同ID不同payload | query為0；valid duplicate至多status回執，不重新執行；新nonce也不能重作同op |
| S05 I1 | secret雙key輪替、撤銷舊key、response MAC反射、GAS redirect錯目標 | 有界過渡，撤銷後拒絕；response綁operation與來源版；不把HTML／HTTP200當成功 |
| S06 I2 | isRedelivery false重複、true首次出現、同ID換replyToken／redelivery旗標 | 一個業務事件；已處理不改分類、不延長TTL、不重扣；旗標不作認證 |
| S07 I2 | 相同ID不同位置／source／message、缺eventId、兩channel同ID | conflict／rejected零新query；不同channel隔離；不用replyToken作key |
| S08 I2 | 0、1、10、11、100事件，在設定body上限內；batch含重複／unsupported；持久層第N步失敗 | 全批atomic接受或未ACK；accepted／ignored／rejected皆有結果；零默默丟失 |
| S09 I2 | 獨立程序同ID同時claim、崩潰重啟、工作租約過期、延遲舊owner回寫 | durable唯一claim／版本；不能只用同程序Map／reentrant hook證明跨程序安全 |
| S10 I2 | dispatch前crash、GAS STARTED後斷線、provider回應後但結果未保存 | 未dispatch可恢復；其他未知不自動query；不能單靠lease超時重領工作 |
| S11 I2 | 保留期邊界、過期ledger／fence、儲存滿、DB不可用 | policy到期stale處理；未決不被GC；拒絕新工作而非清空計數放行 |
| S12 I3 | 599／600秒，重送分類與fresh分類，DM／group／room，同群不同人，未知／menu | TTL、不默認parking及scope隔離保持；同ID不刷新；無userId不混用群組key |
| S13 I3 | 六種分類切換、舊query晚完成、舊位置重送、未見舊命令延遲 | intentVersion正確；舊工作不清新分類；watermark及tie規則可重現 |
| S14 I3 | quota 0／未設、每月邊界／時區、白名單85%／100%、群組成員、接近上限100並行 | 保留既有政策；准入數不超上限、reservation等於已准入；不得由client傳bypass |
| S15 I3 | 每日新政策／重置、GAS另一Script共用key、TDX rolling window前後／Cache清空 | 不把月額度當daily；Cache miss不重設；共用帳號的限制明確不保證或統一協調 |
| S16 I3 | TDX雙NearBy／fetchAll／401／403／429輪替／token失敗、RPC→Maps fallback、NTPC分頁 | 每個實際attempt對應獨立budget；不漏計／重扣event；維持原失敗提示及直線備援 |
| S17 I3 | ScriptLock拿不到、Properties單key／多key部分寫入失敗、儲存滿 | 未持久保留前零外呼；不自動回滾可能已用預算；不長鎖網路；告警不洩漏資料 |
| S18 I4 | query成功、LINE200／400→text／400→400／401／429／500／timeout／崩潰 | 單一reply owner；query不重做；400最多同快照一次備援；未知不改push／token重試 |
| S19 I4 | 新token重送、reply deadline邊界、回覆前後crash、result snapshot hash不符 | 不延長已終結事件；結果完整性拒絕；不可宣稱reply exactly-once |
| S20 I4 | 缺發布清單、來源指紋變更／撤銷、異常座標、UNKNOWN、公園跨市邊界 | 原P0-1 gate保持；核准9筆不新增或覆蓋；UNKNOWN不變成無；未驗入口不聲稱入口 |
| S21 I5 | log中故意放合成Token／replyToken／userId／位置canary；儲存刪除與ACL | 無secret或raw body洩漏，僅受控hash；密文與TTL可驗證；fixtures只能合成 |
| S22 I6 | 隔離真LINE header/body、official validate、redelivery、DO真交易／重啟恢復、GAS真Lock／版本／權限、公開點導航與停車故障 | 逐項passed／not_exercised及UTC／版本回執；mock不可算E2E；正式環境不變 |

S01–S22為測試設計，不納入本輪已通過數。故障與quota邊界用隔離adapter注入，不以耗盡正式TDX／Maps額度或改正式key來測試。

## 本輪實際回歸與證據

| 命令 | 結果 |
|---|---:|
| `node --test --test-reporter=tap test/line/*.test.mjs test/parks/*.test.mjs test/facilities/*.test.mjs test/parking/*.test.mjs` | 381／381：LINE62、公園170、共用設施77、停車72 |
| `python -m unittest discover -s test/park_sources -v` | 33／33 |
| `python -m unittest discover -s test/park_review -v` | 22／22 |
| 原功能回歸總計 | **436／436**，無刪除、弱化或skip |
| `node --test --test-reporter=tap test/preflight/*.test.mjs` | 35／35，仍含10項未修復風險刻畫 |
| `node --test --test-reporter=tap test/security-spec/*.test.mjs` | **0／11，11 fail，exit 1**；預期修復前紅燈，但不算通過 |

不要合稱「482項全過」：實際是原功能436綠、P0-3刻畫／preflight35綠、P0-4安全規格11紅。未執行sponsor-worker測試、官方schema、真實GAS／LINE／TDX／Maps，未部署。

證據 `.local/mvp1-p04-20261021/`：`security-red.tap`、`regression.tap`、`p03-preflight.tap`、`park-sources.log`、`park-review.log`、`P0-3_PUBLISH_REVIEW.json`及收據。P0-3原始目錄／zip完整保留，未覆寫。

## 修復後的release gate

I1–I5完成後，436功能回歸與安全規格全部綠、S01–S21有實際可重跑結果；不可用accept-risk切掉紅燈。CI只跑合成資料／本地持久層，不自動部署或持有正式憑證。I6需另外授權並取得真實平台證據；仍須使用者依部署／回復計畫明確核准，才可改正式Webhook／GAS。
