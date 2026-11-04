# CRM 集中上傳 CURRENT｜2026-11-04

## 已上線

- 核准帳號可在私人／共用記事編輯器直接選取手機照片與檔案；選取後上傳，按儲存完成記事雲端保存。共用記事的編輯仍遵守既有角色權限。
- 檔案集中存入公司 honbin002@gmail.com 的 Drive CRM 資料夾：1hC6sjOpvyO-vHb8QYi5JlEj0o-FP_m5k。根資料夾及檔案未公開，private_UID／shared_GROUP 子資料夾分離。
- Apps Script 專案：1b_X9wDwLa0ZhNqHLaY2g3C3FX-ydTkUQBxRTBAVx9FigtIjQOIgCTxcs，HONBIN_CRM_Drive_Upload。使用者已親自完成 Google 警告與權限核准，另明確同意請求入口設為所有人。不得再重問相同授權。
- 已部署 v1，實際 /exec URL 存於 crm-drive-config.mjs；PR18 已合併，整合 commit 9baedbcaa8f1d909dd8af2f902da8b5ccf0824a9。
- 正式 CRM host 入口已更新 workspace query 版本及離線快取，commit 6ca8bbd76433be8c1b2e343fd9905361dd16e3c8。發布檢查固定舊版字串已修正至新版本，commit 3f589f0da075a24794c4bbe59741795d27b10237。
- 不啟用 Blaze、Firebase Storage、付費 API 或付費伺服器；使用既有 Spark 與免費 Apps Script 配額。

## 安全與行為

- 每次請求以 Firebase ID token 經 Google accounts.lookup 驗證，再要求現有 Firestore 自身記事 list 回應 HTTP 200，沿用核准／停用帳號規則；不以 404 推測核准。
- 共用檔案另核對可讀群組、未封存與本人 ACTIVE 成員。私人檔案只允許相同 UID。檔案讀取也走相同 gateway，不建立公開連結或把整個資料夾分享給同事。
- 每檔最多 20 MB，每筆記事最多 10 個集中附件。Firestore 只存既有 content 中的附件參照，檔案內容在 Drive。
- SHA256、requestId、寫入意圖鎖與同檔重試去重；未知寫入結果停止重建。Token 不落地、不加入網址、不記錄到日誌。
- 公司 owner 的 Apps Script OAuth 範圍涵蓋 Drive；程式以固定 CRM 資料夾限制用途。一般核准帳號無須取得公司 Drive 全碟權限。

## 驗證證據

- 真實網頁驗證結果：ANONYMOUS_DENIED_PASS、AUTH_AND_CRM_FOLDER_PASS、UPLOAD_TEXT_PASS、READBACK_TEXT_PASS、SERVER_IDEMPOTENT_RETRY_PASS、UPLOAD_IMAGE_AND_READBACK_PASS、CROSS_SCOPE_DENIED_PASS（GROUP_ACCESS_DENIED）、LIVE_CENTRAL_DRIVE_VERIFICATION_PASS。
- Drive 連接工具確認合成文字檔及圖片確實存於 CRM/private_UID，shared=false；四個合成測試檔已清除，不留正式記事或通知。
- PR18 四組 CI 已通過；集中 gateway 權限、checksum、未知 ACK、換帳號、私人／群組隔離之離線測試，以及既有記事／訂貨檢查通過。
- 正式頁已觀察到從手機上傳照片／檔案、選取後自動上傳、儲存記事入口。

## 驗證限制／接續範圍

- 雲端瀏覽器的 native file chooser 工具逾時；該次未新增 Drive 檔案。不可宣稱已完成 iPhone 相簿／檔案選取與整筆記事附件實機驗收。
- 尚未用第二個真實 Google 帳號完成核准／未核准及群組隔離實測；不得把模擬器結果宣稱雙帳號實機 PASS。
- 若手機回報看不到入口，先由正式 CRM 重新整理並核對 iframe 版本 20261104-central-drive-upload；不可要求重新部署已完成的 Google gateway 或再次授權同一權限。
- 本輪範圍為手機集中上傳；其他行事曆、訂貨、推播未完項目沿用原 checkpoint，不因本輪結束而宣稱全部完成。
- 禁止推送舊本機 5694f85（貼連結替代方案）；它已被 PR17／PR18 取代。
