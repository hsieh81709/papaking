# P0-3 LINE 訊息格式驗證

2026-10-21 UTC；來源855f5f2。**本地格式檢查完成，LINE官方格式驗收未完成。**

## 官方驗證狀態與網路證據

於2026-10-21 05:03:11 UTC執行一次：

```sh
curl --max-time 20 -sS -o /tmp/papaking-line-doc.html \
  -w 'connect=%{http_connect} http=%{http_code} exit=%{exitcode}\n' \
  https://developers.line.biz/en/reference/messaging-api/
```

實際輸出：`curl: (56) CONNECT tunnel failed, response 403`；`connect=403 http=000 exit=56`。

這是**代理拒絕建立 HTTPS tunnel**，沒有取得來源 HTTP 回應；不是LINE來源403、DNS失敗、Google授權失敗或查無文件404。未變更網路政策，未再批次重試。授權存在性檢查同時未找到測試LINE頻道憑證，故未呼叫訊息驗證端點；不宣稱api.line.me也實測403。

後續官方唯驗證端點：`POST https://api.line.me/v2/bot/message/validate/reply`，body為 `{"messages":[...]}`；由保管憑證的操作者以**測試頻道** Access Token 在安全環境執行。此端點不寄送訊息、無replyToken。僅HTTP200／官方錯誤回執可計入官方schema證據，不能用本地檢查代替；真實手機投遞仍另驗。

待可讀後複核的官方文件：

- [Validate reply messages](https://developers.line.biz/en/reference/messaging-api/#validate-reply-messages)
- [Flex Message](https://developers.line.biz/en/reference/messaging-api/#flex-message)
- [Webhook signature](https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/)
- [Redelivered webhooks](https://developers.line.biz/en/docs/messaging-api/receiving-messages/#redelivered-webhooks)
- [GAS Web Apps 事件參數](https://developers.google.com/apps-script/guides/web)

本輪僅第一個網域根文件實際嘗試存取；其餘為後續查核參考，沒有假稱已讀取最新版。

## 本地限定規格與實際輸出

`tools/line-preflight.mjs` 不引入外部套件，不傳送訊息。檢查reply 1–5則、text非空／5000 UTF-16單位、Flex altText非空／400、quickReply 1–13、按鈕label20、message action文字300、URI1000且HTTPS、box layout與產物使用的text／box／button／separator。公園／公廁產品限制carousel最多5卡，bubble採30000 bytes、carousel採50000 bytes的本地保守預算。

這些是 repository 驗證profile，**不是本輪已向LINE確認的完整官方規格**；例如沒有聲稱平台最多只能5卡。採UTF-16長度作保守上限，不證明所有emoji或特殊組合在不同客戶端的呈現。其餘Flex屬性、style枚舉、全JSON schema仍待官方驗證。

工具本輪重新產生9批訊息，所有本地errors皆0：

| 合成批次 | JSON UTF-8 bytes |
|---|---:|
| 三分類選單 | 427 |
| 停車位置提示 | 328 |
| 停車Flex（僅真正renderer，不查TDX） | 1143 |
| 公園位置提示 | 328 |
| 臺北公園Flex（合成Sheets） | 1128 |
| 公廁位置提示 | 328 |
| 一筆公廁Flex（合成核准） | 1162 |
| 五筆公廁Flex（六筆來源截取前五） | 5346 |
| 無核准公廁提示 | 132 |

每批原文及自動檢查結果在 `.local/mvp1-p03-20261021/LINE_MESSAGES.json` 與 [來源收據](P0-3_SOURCE_MANIFEST.json)。固定P0-2範例亦逐批通過本地檢查。負例涵蓋空／過長altText、空／超量carousel、錯誤box、空text、缺action、非HTTPS URI、超過bytes、過多reply與quickReply，證實檢查器會拒絕這些錯誤。

公廁導航必須經 `toiletSearch_` → 來源指紋／核准 → `facilityNavigationUrl_`；UNKNOWN顯示「未確認」，不以合成核准證據推及正式資料。官方schema200也不代表座標人工核准、可達入口或真實訊息投遞成功。
