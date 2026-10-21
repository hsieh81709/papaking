# GAS 程式與函式盤點

盤點日期：2026-10-21（Asia/Taipei）。GitHub 工作分支 `feature/flex-message-v2`，Commit `26b7842ca43946c63bbaa658e5a2a9cbf2cfae62`。

範圍：目前可讀的5個GitHub GAS JavaScript檔案與附件park_geocoding.txt。列出每個頂層具名function宣告，並非已讀回線上GAS全部檔案。附件只作靜態文字分析，未執行其任何函式。

`gas/appsscript.json`另有V8、Asia/Taipei、USER_DEPLOYING及ANYONE_ANONYMOUS設定；無函式，沒有明列oauthScopes，不能據此證明目前帳號授權或實際部署設定。

## gas/line_webhook_gas.js

SHA-256：`a454e4ff5147db11dfb55d15e53ef8a584f981999603b2c2fa058004d55c78f8`。1925行，103個頂層具名函式。

| 函式 | 行號 |
|---|---:|
| `parseTDXKeys` | 34 |
| `buildPapaKingQuickMenu_` | 146 |
| `buildPapaKingLocationPrompt_` | 163 |
| `doPost` | 174 |
| `handleLocation` | 283 |
| `quotaPrefix` | 295 |
| `quotaUserKey` | 300 |
| `purgeOldQuotaKeys` | 312 |
| `consumeQuota` | 325 |
| `buildReply` | 353 |
| `section` | 409 |
| `renderSafely` | 414 |
| `papaKingFlexTheme_` | 429 |
| `papaKingMapUrl_` | 433 |
| `flexBubble` | 437 |
| `buildFlexCarousel` | 476 |
| `lineTextMessage_` | 494 |
| `replyLine` | 497 |
| `postLineReply` | 516 |
| `getTDXToken` | 535 |
| `tdxRateKey` | 568 |
| `markTDXKeyExhausted` | 573 |
| `pickTDXKey` | 578 |
| `tdxFetch` | 596 |
| `tdxEndpointName` | 635 |
| `logTDXRequest` | 641 |
| `logTDXResponse` | 645 |
| `fetchAllSafe` | 651 |
| `nearbyCached` | 669 |
| `nearbyStore` | 686 |
| `textResponse` | 707 |
| `validParkingPosition` | 713 |
| `nearestWithin` | 718 |
| `tdxFetchAll` | 732 |
| `resolveTDXCity` | 767 |
| `cachePutChunked` | 796 |
| `cacheGetChunked` | 807 |
| `getSegmentInfo` | 823 |
| `tdxText` | 864 |
| `segmentTitle` | 868 |
| `getNtpcStaticRoads` | 878 |
| `normalizeRoadName` | 893 |
| `normalizeNtpcStaticRoad` | 898 |
| `findNtpcStaticRoadMatch` | 910 |
| `twd97ToWgs84` | 937 |
| `ntpcPageUrl` | 964 |
| `ntpcFirstPageRequests` | 968 |
| `ntpcFetchAllPages` | 972 |
| `ntpcRowsFromPages` | 977 |
| `getNtpcCarparks` | 1000 |
| `getNtpcLive` | 1029 |
| `parseNtpcLive` | 1041 |
| `dedupeInto` | 1057 |
| `ntpcCarparksNear` | 1066 |
| `geocodeCached` | 1084 |
| `klcgNormalizeName` | 1114 |
| `getKlcgCarparks` | 1120 |
| `getKlcgLive` | 1150 |
| `parseKlcgLive` | 1163 |
| `klcgKeyMatches` | 1185 |
| `klcgAssignLive` | 1196 |
| `klcgCarparksNear` | 1219 |
| `liveRequests` | 1231 |
| `loadLive` | 1240 |
| `extraCarparksNear` | 1253 |
| `googleTokenFromHtml` | 1264 |
| `googleTokenRequest` | 1272 |
| `getGoogleToken` | 1277 |
| `b64url` | 1289 |
| `googleSearchUrl` | 1293 |
| `cleanGoogleText` | 1300 |
| `googleHoursOf` | 1306 |
| `parseGooglePlaces` | 1313 |
| `googleCarparksNear` | 1335 |
| `carparkNameKey` | 1365 |
| `sameCarpark` | 1375 |
| `googleDirectionsUrl` | 1385 |
| `parseGoogleDrive` | 1396 |
| `driveTimesBatch` | 1417 |
| `driveTime` | 1444 |
| `driveCacheKey` | 1463 |
| `byDriveThenKm` | 1467 |
| `rankSections` | 1475 |
| `travelLine` | 1518 |
| `navUrl` | 1527 |
| `navLink` | 1531 |
| `parseOnStreet` | 1536 |
| `renderOnStreet` | 1568 |
| `parseParking` | 1606 |
| `renderParking` | 1640 |
| `warmCaches` | 1665 |
| `randomTestPoint` | 1681 |
| `runTestPoint` | 1691 |
| `testPapaKingLiveParkingV2` | 1702 |
| `testPapaKingStaticFallbackV2` | 1782 |
| `testPapaKingFlexV2_` | 1808 |
| `testFlexValidate` | 1848 |
| `describeReply` | 1863 |
| `testGooglePlaces` | 1870 |
| `calculateDistance` | 1880 |
| `testNearbyCache` | 1896 |
| `testConfig` | 1904 |
| `testFull` | 1913 |

## gas/park_b43_regeocode_gas.js

SHA-256：`6485e944286bb7f6cc6b185f925694db8bc99b9e998bbf64349d3a18da89bb09`。77行，2個頂層具名函式。

| 函式 | 行號 |
|---|---:|
| `runPapaKingParkB43Regeocode` | 7 |
| `papaKingParkB43Regeocode_` | 13 |

## gas/park_b45_sync_gas.js

SHA-256：`0b3281ef4dc3234fec5478d1e30a424eaa413b1e77db01c4adcdcbe5f6e05c64`。200行，18個頂層具名函式。

| 函式 | 行號 |
|---|---:|
| `papaKingParkB45CheckHeaders_` | 10 |
| `papaKingParkB45Index_` | 14 |
| `papaKingParkB45Rows_` | 25 |
| `papaKingParkB45Open_` | 28 |
| `papaKingParkB45Pack_` | 37 |
| `papaKingParkB45Unpack_` | 40 |
| `papaKingParkB45Equal_` | 41 |
| `papaKingParkB45Fingerprint_` | 42 |
| `papaKingParkB45Plan_` | 46 |
| `papaKingParkB45ReadPlan_` | 70 |
| `runPapaKingParkB45Preview` | 80 |
| `papaKingParkB45Confirm_` | 85 |
| `papaKingParkB45WriteCell_` | 88 |
| `runPapaKingParkB45Sync` | 93 |
| `papaKingParkB45Verify_` | 145 |
| `papaKingParkB45Restore_` | 154 |
| `runPapaKingParkB45RecoveryPreview` | 169 |
| `runPapaKingParkB45Rollback` | 187 |

## gas/park_geocoding_gas.js

SHA-256：`cd8edb1d714590c72d3204374278ee01dd70a7486f918db938d1951dda9cc5a8`。212行，13個頂層具名函式。

| 函式 | 行號 |
|---|---:|
| `parkAuditText_` | 6 |
| `parkAuditNumber_` | 7 |
| `parkAuditCoordinate_` | 12 |
| `parkAuditIndex_` | 16 |
| `parkAuditNormalize_` | 27 |
| `parkAuditDistance_` | 28 |
| `parkAuditData_` | 32 |
| `parkAuditNewTaipeiScope_` | 119 |
| `parkAuditColumnTypes_` | 133 |
| `parkAuditReviewApprovals_` | 142 |
| `parkAuditSheetObjects_` | 163 |
| `runPapaKingParkQualityAudit` | 179 |
| `runPapaKingParkInventory` | 196 |

## gas/park_search_gas.js

SHA-256：`d937a4dc1feb5b634460fc85cc5813589daaf0d3dc06afe2b766e6720684998e`。251行，17個頂層具名函式。

| 函式 | 行號 |
|---|---:|
| `parkIntentFromText_` | 10 |
| `parkIntentKey_` | 19 |
| `rememberParkIntent_` | 29 |
| `takeParkIntent_` | 35 |
| `parkSearchCoordinate_` | 43 |
| `parkDistanceKm_` | 49 |
| `parkRowsAsObjects_` | 55 |
| `parkSearch_` | 63 |
| `parkNavigationUrl_` | 102 |
| `buildParkReply_` | 105 |
| `formatParkReply_` | 110 |
| `testParkSearch_` | 118 |
| `testPapaKingParkConnection` | 123 |
| `testPapaKingParkMVP` | 137 |
| `testPapaKingRouting` | 179 |
| `buildParkFlexReply_` | 198 |
| `testPapaKingParkFlex_` | 236 |

## 附件 park_geocoding.txt

SHA-256：`6b2d59d8c5b66f3736340bd28cb20c5cbe13e5d2e1158355237b4b8deeeb4406`。239行，2個頂層具名函式。

| 函式 | 行號 |
|---|---:|
| `runPapaKingParkGeocodingBatch` | 13 |
| `auditPapaKingParkCandidates` | 182 |

## 可核對與不可推定的版本資訊

遠端`git ls-remote origin`本輪成功讀回：

- `feature/flex-message-v2`：`26b7842ca43946c63bbaa658e5a2a9cbf2cfae62`（與分析checkout一致）
- `feature/v0.3.1-park-flex`：`b3bb7c1cf7bc501a5d7c5b02073203c385fa52d8`
- `main`：`734ace5702736dd069399b1188b4b122d4f5e2fe`

這是Git分支參照，不是GAS版本、部署或測試結果。本輪不切分支、不合併、不下載線上GAS。附件未附完整專案manifest、其他檔案、版本號與部署對照，無法確認它是目前正式運行版本。檔頭V0.4.0-B3或Webhook的V0.3.0註解不代替完整版本指紋。
