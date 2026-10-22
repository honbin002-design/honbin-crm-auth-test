# iPhone CRM Web Push｜安全施工交接｜2026-10-22

**狀態：STAGING_SAFE_HOLD（尚未實際送達 iPhone 系統通知，不得報成正式完成）**

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
