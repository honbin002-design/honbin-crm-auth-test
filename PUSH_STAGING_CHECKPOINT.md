# iPhone CRM Web Push｜安全施工交接｜2026-10-22

**狀態：FIRST_IPHONE_LOCKSCREEN_PUSH_PASS／MULTI_MEMBER_SENDER_SAFE_HOLD（第一支 iPhone 真正收到鎖定畫面推播；正式多人任務與記事背景發送仍未啟用）**

## 2026-10-22 18:57（台北時間）｜零費用續作，最新權威結論

- 在原有 TEST 儲存庫 `main` 上完成免費施工，不增開任何付費服務，沒有碰 CRM 主資料、報價或其他非推播功能。
- sender 現在額外強制既有**專用** `honbin-test-push-sender@honbin-crm-notes-spark.iam.gserviceaccount.com` 服務帳號，拒絕使用泛用 Firebase Admin 憑證（commit `463439c694`）。
- 新增 `push-vapid-local-setup.html`：在 iPhone 瀏覽器以 Web Crypto 本機建立 P-256 VAPID 金鑰，不使用 Firebase、網路上傳、localStorage、IndexedDB，也不將私人金鑰寫入 GitHub 原始碼。生成是使用者直接按鈕操作；使用者必須將公開／私人金鑰分別儲存在 GitHub Actions encrypted secrets。新增加密金鑰及配對測試 `push-vapid-local-preflight.mjs`，現有 `auth-only` CI PASS。
- 從加密 TEST service account 執行只讀 GitHub Actions run `39766548800`：`TEST_AUTH_READ_OK`、`TEST_TASK_CREATED_QUERY_OK`、`TEST_TASK_COMPLETED_QUERY_OK`、`TEST_NOTE_CREATED_QUERY_OK` 全部 PASS。只查三項索引及 Auth 讀取，不寫資料、不送通知。完成後已把該工作流程回復 manual-only。
- 使用私人 GitHub Actions 環境執行零網路 VAPID Secret 探測 run `39766903442`，**三項確認未設定**：`TEST_VAPID_PUBLIC_KEY`、`TEST_VAPID_PRIVATE_KEY`、`TEST_PUSH_CONTACT`；保持 `PUSH_SENDER_STILL_DISABLED_SAFE_HOLD`。探測程式只顯示缺少的 Secret 名稱，不輸出任何憑證。新增 `push-secret-readiness-probe.mjs` 可在密鑰安裝後驗證公私鑰匹配，而不顯示內容。
- 在能安全設定 GitHub encrypted repository secrets 的連線／介面可用之前，**不可自行把私鑰透過公開 GitHub 原始碼、檔案、對話或 console log 寫入**。此 ChatGPT GitHub connector 支援 GitHub 程式修改／CI 檢查，但不支援編輯 Repository Actions Secrets。
- 剩餘必要操作：由系統管理者在本機金鑰頁產生並複製一次性的配對金鑰，在 GitHub Actions Secrets 設定 `TEST_VAPID_PUBLIC_KEY`、`TEST_VAPID_PRIVATE_KEY` 和 `TEST_PUSH_CONTACT`（mailto: 自己控制的地址）。私鑰絕不可貼回聊天。此後仍需校驗目前 Firebase 正式 Rules 中訂閱 ACL（此前有發布讀回，但未在本輪獨立讀回完整 Rules）、跨帳號、兩支已加入主畫面的 iPhone 訂閱與關閉 App 接收測試。通過才把 CRM 公開金鑰配置及 sender 啟用旗標打開。
- 不重做已 PASS／不啟用 Blaze、Cloud Functions、不切 Work 模式。GitHub Pages 的正式 CRM 與 Firestore Spark 主資料安全維持原狀。不要把「程式可運作」錯報為「iPhone 已收到通知」。

## 2026-10-22｜手機通知 ACL 驗證施工（本輪）

- 已用 TEST 專用 Firebase Admin 帳號執行**只讀** Firebase Rules REST API live readback；GitHub Actions Run `39771849577` 返回 `FIRESTORE_RULES_API_READ_DENIED_403_SAFE_HOLD`。此帳號能讀 Auth 與三個 notification collection-group indexes，但不具有 Firestore Rules 發布版內容讀取權限，**不得因此自動提升 IAM、覆蓋原有 Firestore Rules 或宣稱 ACL 已 PASS**。
- 已將 `notification-deployed-rules-readonly.mjs` 留作人工讀回驗證，工作流程 `push-deployed-rules-readback-once.yml` 回復 `workflow_dispatch`（manual only）；無排程、無寫入、無 Secrets 外洩。
- 正式登入 CRM 的**最高權限**「雲端記事與任務 → 設定」現會顯示原本已施工但被誤隱藏的「伺服器規則安全核對（唯讀）」與「手機通知帳號隔離驗證（唯讀）」；其他帳號、登出後仍隱藏。這兩個既有按鈕走目前 Firebase Auth ID token 與 `getDocFromServer` / `getDocsFromServer`，不能由服務帳號繞過 Firestore Rules；只測唯讀、沒有發送通知。已加 root-only 顯示回歸斷言。
- GitHub Actions `Auth-only static safety checks` 最新 PASS，`TEST task V4/V5 Firestore emulator ACL` PASS，`pages build and deployment` 在 commit `90d563f3718` PASS。這些**不是**手機實機收信證據。
- **下一個無法代按的實機步驟**：系統管理員由 iPhone 主畫面 CRM 開啟 → 雲端記事與任務 → 設定 → 「手機通知帳號隔離驗證（唯讀）」按「核對三項越權拒絕（唯讀）」。應有三個 `SERVER_DENIED_PASS`。同頁亦按「伺服器規則安全核對（唯讀）」核實本人訂閱的讀取（即使清單沒有資料）。若任何 HOLD 或 UNEXPECTED_ALLOWED，不得開通。之後需成員獨立帳號及兩支 iPhone 身分、訂閱、鎖屏通知驗收。
- 正式 CRM `push-public-config.json` 僅有先前 verified PUBLIC VAPID 值；`subscriptionsEnabled=false`、`senderEnabled=false`，GitHub sender `TEST_PUSH_SEND_ENABLED` 未啟用。iPhone 系統通知依然 SAFE_HOLD；無新增費用或任何現有業務資料改動。

## 2026-10-22 19:43+｜iPhone Firebase 實機驗收 PASS 與本人訂閱寫入新 Gate

- 使用者在正式 iPhone CRM 畫面，已完成**三項 Firebase 伺服器越權讀取拒絕**：列出所有公開暱稱 `SERVER_DENIED_PASS`；讀其他帳號私人推播訂閱 `SERVER_DENIED_PASS`；讀取未加入群組任務 `SERVER_DENIED_PASS`。該三項已實機驗證，不再要求重做。
- 原頁面「伺服器規則安全核對（唯讀）」在同一截圖仍顯示「尚未核對」，故不可誤判本人訂閱 `GET/LIST` 已成功，也不可誤判 `CREATE/DELETE` 通過。
- 已在最高權限專屬「設定」頁新增 `pushWriteProbe`，讓本人**明確點按**「驗證本人訂閱可寫入並清除」，使用 `firestore-push-write-probe.mjs` 在 Firestore 真實伺服器按本人 UID 建立一筆**合成、不可實際推播**的短暫裝置資料，立即讀回，最後刪除並再次伺服器核對不存在。未點按不寫入。任何未核實清除、權限拒絕或網路錯誤一律 `SAFE_HOLD`，顯示定位用合成路徑供人工確認；不蒐集、輸出真實 endpoint 或私人金鑰。全程不向 iPhone 要求通知權限。
- 已新增 `firestore-push-write-probe-preflight.mjs` 純內存 PASS 測試：正常寫入/讀回/刪除、寫入拒絕、清除失敗，以及非根帳號零寫入拒絕；並納入既有 `auth-only` CI。
- 額外讓伺服器 sender 跳過所有 ID 為 `probe_` 開頭的測試裝置；即便手機斷網導致測試紀錄清除失敗，也不得嘗試對它發送 Apple Push。安全回歸測試納入既有 CI。
- 最新工作仍保持 `subscriptionsEnabled=false`、`senderEnabled=false`、`TEST_PUSH_SEND_ENABLED` 未啟用；未新增付費資源。**下一步只需要使用者測試新本人寫入驗證按鈕一次，回報畫面結果**，不用重做三項拒絕 PASS；合格後才規劃實際 iPhone 訂閱及開通發送。

## 2026-10-22｜iPhone 使用者驗收與自願訂閱測試狀態

- 使用者本人在 iPhone 實機截圖正式確認 `SERVER_WRITE_READBACK_CLEANUP_PASS`：根帳號已完成本人手機訂閱合成紀錄的**實際 Firestore 建立／伺服器讀回／刪除回讀**，沒有留下測試訂閱。與先前 3 個 `SERVER_DENIED_PASS` 一併標記為 **PASS／勿重做**。
- 現在開啟下一階段：正式 CRM `push-public-config.json` 設為 `subscriptionsEnabled=true`、`senderEnabled=false`、`environment="SPARK_SUBSCRIPTION_STAGING"`。verified VAPID 公開金鑰不變，私鑰保持 GitHub encrypted Secret。**此階段僅由 iPhone 使用者自己點擊通知按鈕並同意，才在登入帳號名下建立私人裝置訂閱；絕不發送手機鎖定畫面通知。**
- 正式 CRM `crm-push-setup.mjs` 與同源雲端 iframe 的 `firebase-installed-crm-push-bridge.mjs` 已解除「必須 sender 先啟用才能訂閱」的錯誤耦合；要求 VAPID 公鑰 87 字元、`subscriptionsEnabled===true`、`senderEnabled` 合法布林、本人 Firebase 身分及伺服器讀回。未登入/非同源/UID 變更必須拒絕。無自動請求手機通知權限。
- 推播 GitHub Actions sender 的 `TEST_PUSH_SEND_ENABLED` 仍保持關閉，`senderEnabled=false`；沒有付費伺服器、付費 API 或 Firebase Blaze。
- 下一個真正的 iPhone 驗收：由手機主畫面的獨立 CRM App 開啟「雲端記事與任務」，在 CRM **外層標題右側**按「登記這支 iPhone（測試）」→ iPhone 系統提示時本人按允許 → 顯示「Firebase 伺服器核對成功」「發送仍關閉」才算真實訂閱 PASS。若使用 Safari 一般分頁，先分享加入主畫面。每位成員每支 iPhone 必須各自登記；獨立成員帳號驗收仍待完成。
- 正式送達、撤銷成員權限即停止投遞、其他成員兩支手機鎖屏推播未驗收，**絕對不得聲稱背景推播已成功**。後續再以可稽核的 TEST 方案啟用有限發送，並確保取消訂閱機制。

## 2026-10-22 20:15｜首次真實 Apple Web Push 接受成功／手機畫面仍待使用者確認

- 使用者從 iPhone 主畫面 CRM 提供截圖，顯示本人登入最高權限 `honbin002@gmail.com`，上方「這支 iPhone 的訂閱已由 Firebase 伺服器核對成功（測試 PASS）；背景發送仍關閉」。**真實裝置註冊 PASS**，不用重做。
- 發送端未開通排程/正式啟用旗標。為此執行嚴格限縮的一次性 TEST：`push-owner-iphone-one-shot.mjs` 驗證 GitHub 加密 VAPID 公鑰與正式 CRM 公開金鑰一致、專用 Firebase service account、Firebase Auth 查得 Google 已驗證的 root email、僅一支真實已登記 Apple endpoint、非 probe 裝置與最近 7 日內建立；**不讀取任何客戶內容、記事、任務、不寫入 Firestore**。只送一則 generic safe payload，其他帳號 0 次。
- GitHub Actions **run `39776813890`** PASS，job `119817741694` 有 `OWNER_IPHONE_ONE_SHOT_APPLE_PUSH_ACCEPTED_201`。此證據**只證明 Apple Web Push 遠端服務接受 HTTP 201，不能聲稱已在手機通知中心或鎖定畫面實際看到通知**。需請使用者回報實機通知截圖或明確結果。
- 已立即移除自動觸發的一次性測試工作流程 `.github/workflows/iphone-owner-push-one-shot.yml`（commit `1347a927deaf96b707b2995eca46ce3d3fab0cd3`），不會再次自動測試。保留安全限制的 one-shot JS 腳本作審計但無啟動路徑。
- GitHub 正式發送排程仍保持 `TEST_PUSH_SEND_ENABLED` 未啟用，主 CRM `push-public-config.json` 為 `subscriptionsEnabled=true`、`senderEnabled=false`、`environment="SPARK_SUBSCRIPTION_STAGING"`；無付費服務。
- 下一個關鍵驗收：本人這支 iPhone 是否實際看到「鴻繽科技 CRM 有新通知」。若未收到，查 iOS「設定 → 通知」、主畫面 App、通知摘要及專注模式、Web Push/SW 處理，不要跳過實機驗收。若收到，進行第二個不同 Google 帳號與另一台 iPhone 訂閱及各角色通知授權／撤銷測試，確定資料隔離後才啟用正式群組發送。

## 2026-10-22 20:17｜第一支 iPhone 鎖定畫面通知確實收到｜PASS FROZEN

- 使用者提供原生 iOS **鎖定畫面／通知中心實機截圖**，畫面約 `20:17`，出現「鴻繽科技 CRM 有新通知」、「from 鴻繽科技 CRM」、「點一下即可開啟 CRM 查看資訊」。與此前一則特定 root-owner-only 一次性 TEST `OWNER_IPHONE_ONE_SHOT_APPLE_PUSH_ACCEPTED_201`（run `39776813890`，發送完成於 20:15 台南時間）對上。
- 正式記錄三項 **PASS，不得重做**：(1) 本人 `honbin002@gmail.com` Firebase 私人手機訂閱建立／伺服器讀回；(2) 使用 GitHub encrypted VAPID 對 Apple Web Push 送出並收到 HTTP 201；(3) 第一支 iPhone 系統鎖定畫面／通知中心顯示一則該 CRM 測試推播，端到端 PASS。
- 此圖還**沒有證明**「點擊通知後是否正確打開 CRM」，也**沒有證明**第二支 iPhone／另一位 Google 帳號的任務、記事通知或權限撤銷後停止發送。
- 單次推播自動工作流程已移除，持續發送依然關閉；正式 CRM 的公開開關須維持 `subscriptionsEnabled=true`、`senderEnabled=false`、`environment=SPARK_SUBSCRIPTION_STAGING`。不得只因第一支手機收件 PASS 就啟動群組正式推播。
- 下一步**僅需本人點剛才收到的通知**，回報是否進入「鴻繽科技 CRM」主畫面；這是通知點擊驗收。該次只有不含任務 ID 的通用測試訊息，正常應打開 CRM 首頁，不應連結到任何特定記事。之後再測第二個已核准的成員 Google 帳號及第二支 iPhone，驗證各帳號分隔、任務分派、任務完成與權限撤銷無通知。
- 不修改客戶／產品／報價／本機資料，不新增付費服務，不在 GitHub 檔案或聊天中放私人金鑰。

## 既有主架構（不可重建）
- 正式 CRM：`honbin002-design/-hongbin-personal-crm-beta`，入口 `https://honbin002-design.github.io/-hongbin-personal-crm-beta/`
- Firebase 雲端記事與任務：`honbin002-design/honbin-crm-auth-test`，以同網域 iframe 整合
- Firebase 專案：`honbin-crm-notes-spark`，Spark 零付費
- 原有 CRM 客戶、產品、報價儲存在 iPhone localStorage；嚴禁清除、搬移或覆寫
- 既有雲端記事／任務／群組／權限／通知中心 PASS，不可重做
- 必須保留 `honbin002@gmail.com` 最高權限；不得將敏感採購價公開

## 本階段已建立
- 正式 CRM `sw.js`：處理標準 Web Push 接收／通知點擊，限制群組及項目識別碼，通知不包含記事內容
- `simple-core.js`：從主畫面 App 通知點擊直接進入正式 CRM 的雲端記事／任務明細，由原有 Firebase 權限驗證
- `index.html`：主畫面 PWA manifest 宣告／通知設定按鈕；保持緊湊抬頭
- `crm-push-setup.mjs`：iOS Home Screen 手勢許可、CRM scope 訂閱、與登入 iframe 通訊；設定不足時不要求通知權限
- `push-public-config.json`：`subscriptionsEnabled=false`、`senderEnabled=false`、`publicVapidKey=""`，刻意停用
- `firebase-installed-crm-push-bridge.mjs`：只接受同源、已登入的父視窗訂閱要求，寫入 Firestore `pushSubscriptions/{uid}/devices/{deviceId}` 並回讀
- `.github/workflows/free-iphone-push-sender.yml`：每五分鐘 GitHub Actions 排程，但需 `TEST_PUSH_SEND_ENABLED=EXPLICITLY_APPROVED` 才能執行。變數目前未經驗證，不得假設已啟用。
- 候選發送器 `notification-free-sender-REVIEW-ONLY.mjs`：Admin 身分核准、群組即時成員驗證、任務新鮮度驗證、發送收據去重、每次上限 30 個發送
- 安全性與合成測試：`push-host-bridge-preflight.mjs`、`tests/crm-push-receiver-preflight.cjs`、`tests/crm-push-setup-preflight.mjs`

## 下一階段真正上線前必須通過的門檻
1. 唯一正式 Firestore Rules 讀回：確定 `pushSubscriptions/{subscriberUid}/devices/{deviceId}` 不存在衝突，僅帳號本人能讀寫自己的訂閱；發布前與發布後都需 ACL 驗證。
2. 使用安全管道產生 VAPID 公開與私密金鑰。公開金鑰可置入主 CRM `push-public-config.json`，**私鑰不得出現在 GitHub 程式碼、網站、對話或測試紀錄**。
3. Firebase Admin service account 只放 GitHub Actions 加密 Secret；不得公開 JSON 憑證，不得開通付費 API／Blaze。
4. 用獨立測試帳號與兩支 iPhone 完成：訂閱建立、帳號隔離、任務指派通知、任務完成通知、通知點擊、權限撤銷拒送、App 關閉鎖定畫面實測。
5. 確認 GitHub Actions 標準 `ubuntu-latest` 公開倉庫免費額度、Firestore Spark 每日讀取與寫入上限不會被超出。
6. **只有上述全部 PASS**，才把 `subscriptionsEnabled`／`senderEnabled` 打開，設定開始時間與安全啟用變數。若無憑證管理或 Firebase 部署權限，維持 SAFE_HOLD，不得聲稱正式手機通知成功。

## 可驗證與不可冒稱
- 合成測試及 GitHub Pages 部署成功 ≠ 兩支手機收到背景通知。
- 網頁內「訊息通知」仍可正常使用；iOS 鎖定畫面推播尚未啟用。
- 不可利用公共程式碼或客戶端存取 Firebase Admin，不能偷渡憑證以繞過安全關卡。
- 不得切換 Work 模式、要求付費升級，或自行擴充其他 CRM 功能。
