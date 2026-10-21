# P0-3 實際測試紀錄

2026-10-21 UTC，Node v24.19.0、Python 3.12.14，候選855f5f2。全部本地、合成資料；未使用Google／LINE／TDX憑證。

| 命令／範圍 | 實際結果 |
|---|---:|
| `node --test --test-reporter=tap test/line/*.test.mjs test/parks/*.test.mjs test/facilities/*.test.mjs test/parking/*.test.mjs` | 381／381（62＋170＋77＋72） |
| `python -m unittest discover -s test/park_sources -v` | 33／33 |
| `python -m unittest discover -s test/park_review -v` | 22／22 |
| 既有回歸合計 | **436／436** |
| `node --test --test-reporter=tap test/preflight/*.test.mjs` | **35／35**：10項風險刻畫、4項安全行為、18項訊息profile及負例、3項來源／載入檢查 |
| 總計 | **471／471**；10項風險仍存在，不是安全驗收通過 |
| `node tools/mvp1-preflight.mjs .local/mvp1-p03-20261021` | 5檔候選一致，9批本地訊息檢查errors=0 |
| `node --check` 全7個 `gas/*.js` 與新增2個tools檔 | 通過 |
| `actionlint .github/workflows/offline-tests.yml` | 通過，workflow未改 |
| `git diff --check` | 通過 |

上述Node suite fail／skip／cancel皆0；Python失敗與skip皆0。既有套件沒有更動或刪除測試。未執行sponsor-worker測試，未讀回遠端GitHub Actions，本輪不引用其歷史結果作驗收。

新增檔案：

- `tools/line-preflight.mjs`：純本地產物profile檢查，不是官方完整schema。
- `tools/mvp1-preflight.mjs`：候選hash、合成LINE輸出與驗證收據；無外部I/O。
- `test/preflight/messages.test.mjs`：18項，6個固定訊息、當前產物、最多5筆長欄位、9個Flex負例及批次／文字／quickReply負例。
- `test/preflight/delivery-risks.test.mjs`：14項，R1–R10及4項現有安全行為。
- `test/preflight/bundle.test.mjs`：3項，855f5f2逐byte、24種載入順序、無全域具名函式重複。
- `docs/mvp1/P0-3_*.md` 與 `P0-3_SOURCE_MANIFEST.json`：報告、格式驗證、安全風險、部署回復與收據。

開發過程：第一批30項即全部通過；增加3項bundle成33項，補額度並行與批次截斷2項後最終35項全過。本輪目的為現況刻畫，**未把有風險的執行程式修成綠燈**。後續修復應先建立安全預期失敗測試，再改程式；本輪刻畫可用作重現證據。

原始log路徑 `.local/mvp1-p03-20261021/`：`preflight-first.tap`、`preflight.tap`、`regression.tap`、`park-sources.log`、`park-review.log`、`checks.log`、`AUTH_NETWORK_INVENTORY.json`、`SOURCE_MANIFEST.json`、`LINE_MESSAGES.json`；可由驗收報告命令重跑。該目錄為本地artifact，不提交含資料或憑證的正式資源。

未執行：官方LINE schema validate、實際LINE投遞、GAS staging、真實Cache併發、live原始碼／版本對照、正式Sheets讀寫、手機導航、TDX／Maps線上查詢。LINE文件請求遇到CONNECT403；授權／網路限制見 [訊息報告](P0-3_LINE_VALIDATION.md)。

未改動 `gas/`、`sponsor-worker/`、既有fixtures與workflow。執行版候選仍是855f5f2，P0-3 Commit僅含新增離線驗證和文件。完整變更由 `git diff 855f5f2..HEAD --stat`／`git show --stat HEAD`檢查；撤回本輪可另建revert Commit，不操作正式部署。
