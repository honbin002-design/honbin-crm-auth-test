# iPhone CRM Web Push｜安全施工交接｜2026-10-22

**狀態：STAGING_SAFE_HOLD（尚未實際送達 iPhone 系統通知，不得報成正式完成）**

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
