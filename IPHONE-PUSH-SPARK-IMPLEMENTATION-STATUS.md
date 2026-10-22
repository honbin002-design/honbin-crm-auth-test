# CRM iPhone 系統推播｜零新增費用施工紀錄

狀態：**已完成接收／訂閱串接程式；正式背景推播未啟用，安全鎖定**。

> 禁止把「程式已施工」回報為「手機已收到推播」。所有實體通知送達狀態必須以實機證據為準。

## 架構與免費限制

- 原正式 CRM 主程式：`honbin002-design/-hongbin-personal-crm-beta`（公開 GitHub Pages）
- Firebase 專案：`honbin-crm-notes-spark`，維持 Spark，**不綁定帳單、不升級 Blaze**。
- GitHub Actions 僅用**公開儲存庫標準 Ubuntu runner**，其執行分鐘目前免費。
- 預計於背景最多每五分鐘檢查新事件；GitHub cron 可能延遲或取消，**不提供即時送達保證**。
- 手機系統通知以 Apple iPhone 主畫面網頁 App 的 Web Push 為目標；一般 Safari 分頁只提供 CRM 內通知。
- 由 App 明確點選「啟用」才可以要求系統通知權限。
- 若 Spark 每日額度耗盡，Firebase 會拒絕額外作業；此工作流程**不得自行改用計費服務**。

## 已施工檔案

正式 CRM：
- `sw.js`：同一個主畫面 App 接收推播、驗證識別碼，點擊通知返回既有 CRM／記事頁。
- `simple-core.js`：將已授權通知的目標記事／任務連結傳給 Firebase iframe。
- `crm-push-setup.mjs`：在主畫面網頁 App、使用者主動授權後建立 Apple push 訂閱，透過同源 iframe 傳遞到已登入 Firebase。
- `push-public-config.json`：公開 VAPID 設定，目前 `subscriptionsEnabled=false`、`senderEnabled=false`、`publicVapidKey=""`，不儲存任何私人金鑰。
- `manifest.webmanifest`／`index.html`：正式 CRM 主畫面入口與行動版介面。

雲端記事／推播：
- `firebase-installed-crm-push-bridge.mjs`：僅接受同源正式 CRM 視窗要求，以目前 Firebase UID 寫入自己設備，且必須伺服器 readback 通過。
- `workspace-v2.html`：接上已登入身分。
- `notification-free-sender-REVIEW-ONLY.mjs`：對事件／群組／接收者／設備重新檢查；限量送達、不暴露私人內容。
- `.github/workflows/free-iphone-push-sender.yml`：有定時排程但**工作只有在 repository variable `TEST_PUSH_SEND_ENABLED=EXPLICITLY_APPROVED` 時才會執行**。預設不使用 runner、不讀取 Firebase。
- `firestore-push-subscriptions-REVIEW-ONLY.rules`：待合併的設備私有 ACL，不可以整檔覆蓋正式規則。

## 真正啟用前不可跳過的檢查

1. 用 Firebase 主控台或已授權的管理連線讀回**目前已發布的完整 Firestore Rules**，只增補 `pushSubscriptions/{uid}/devices/{deviceId}` 私有 ACL，禁止其他使用者讀寫設備 endpoint／金鑰。執行 Emulator 拒絕測試並且發布後讀回比對；**不得覆蓋既有記事與任務規則**。
2. 準備配對的 VAPID 公／私鑰，私鑰僅放 GitHub Actions encrypted repository secrets，不寫入程式、訊息、工作紀錄、Google Drive 共用檔案。
3. Firebase 管理身分只能透過加密的 GitHub Secrets 提供給 sender，且須確認其權限與專案 ID 完全符合；**不要把 service account JSON 貼進聊天**。
4. 完成零費用配置後，公開 `push-public-config.json` 才能填入 VAPID 公鑰並同時切換 `subscriptionsEnabled`、`senderEnabled`。這是正式手機允許授權前的機制。
5. 使用兩支已加入主畫面的 CRM iPhone，分別登入核准帳號，點選訂閱，取得 Firebase 設備 readback PASS。先只發 TEST 測試通知，驗證關閉 App 後鎖定畫面、通知中心及點擊返回。
6. 確認手動 sender 限量無誤，將 GitHub encrypted secrets：`TEST_FIREBASE_SERVICE_ACCOUNT_JSON`、`TEST_VAPID_PUBLIC_KEY`、`TEST_VAPID_PRIVATE_KEY`、`TEST_PUSH_CONTACT` 及 repository variables `TEST_PUSH_START_ISO` 設定完成，再最後啟用 `TEST_PUSH_SEND_ENABLED=EXPLICITLY_APPROVED`。
7. 限額、異常及權限測試未 PASS 時**不得啟用**，需保留關閉開關和原本 CRM 內通知為備援。

## 不能宣稱完成

- 已發布正式 Firestore 訂閱 ACL：**尚未證實**。
- 安全金鑰已儲存於 GitHub encrypted secrets：**尚未證實**。
- 系統 Web Push 實機送達：**尚未驗證**。
- GitHub 每五分鐘跑送達：**保持安全鎖定**。
- 準時立即推播：GitHub Actions cron 架構**本來就不能保證**。

## 已完成不重做

- CRM 正式客戶／報價／本機資料不清除、不遷移。
- 記事與任務、登入／群組、共用記事簿、CRM 內通知已通過部分不回退。
- 獨立 TEST 網站不替代正式 CRM，也不重新加入另一個手機入口。
