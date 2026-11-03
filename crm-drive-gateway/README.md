# CRM 集中上傳接續狀態（2026-11-03）

本次需求：所有 CRM 核准 Google 帳號在 CRM 直接選取手機照片／檔案；集中存入公司 honbin002@gmail.com 的 CRM 資料夾，在 CRM 查看。不得以貼連結代替上傳。

- CRM 資料夾：1hC6sjOpvyO-vHb8QYi5JlEj0o-FP_m5k。公司帳號已建立；未公開、未授予整個資料夾給同事。
- Apps Script 專案：1b_X9wDwLa0ZhNqHLaY2g3C3FX-ydTkUQBxRTBAVx9FigtIjQOIgCTxcs，名稱 HONBIN_CRM_Drive_Upload；已儲存來源，尚未授權或部署。
- 使用者於本輪已明確同意新 Drive 權限與獨立入口部署。公司 Google 帳號已透過安全登入表單重新登入成功。Google 授權頁顯示「這個應用程式未經 Google 驗證」；已展開進階，按「前往 HONBIN_CRM_Drive_Upload（不安全）」遭自動核准審查拒絕，要求使用者親自操作（handoff），不得以重試或 API 規避。尚未授予 OAuth 權限、尚未部署；使用者不需要再次同意相同權限。
- appsscript.json 是期望部署設定；須在專案 manifest 核對／套用，避免自動推導多餘權限。
- CRM_DRIVE_ENDPOINT 仍空白。不可合併上線，直到服務授權、部署、真實上傳／讀取與拒絕驗收通過。

## 實作

- 以 Google Apps Script 免費服務執行，Drive 檔案集中在既有 CRM 資料夾的 private_UID 或 shared_GROUP 子資料夾；無 Firebase Storage、Blaze、付費 API、背景觸發器。
- 以 Firebase ID token 經 Google accounts.lookup 驗證，再以同一 token 讀取最多一筆自身記事版本，要求 HTTP 200，沿用正式核准帳號規則，不讀取或公開核准帳號名單。
- 共用附件另核對群組可讀、未封存、本人 ACTIVE 成員；私人檔案只允許相同 UID。檔案不公開、不分享整個根資料夾，讀取經相同 gateway 驗證。
- 每個檔案 20 MB，每筆記事 10 個集中附件。檔案內容只存 Drive；Firestore 仍使用既有 content 文字欄位保存附件中繼資料。
- 同一選檔的 requestId／checksum／寫入意圖鎖防止未知 ACK 重複建立；伺服器不確定結果時保留 PENDING 並停止重建。
- Token 僅置於 HTTPS POST body，無寫入 localStorage、Drive 或 Git；不記錄 payload 或商業資料。
- 所有一般帳號不須獲得公司 Drive 全碟權限；集中服務程式的 Apps Script OAuth 會要求公司帳號 Drive 讀寫權限。程式以固定 CRM 資料夾限制用途，但 Google 授權範圍本身不是單資料夾。

## 已完成的離線驗證

`node crm-drive-gateway-preflight.mjs`：無登入拒絕、未核准／停用拒絕、非群組成員拒絕、跨 scope 私人附件拒絕、SHA256 核對、同 ID 重試不重複、未知網路 ACK 用原 requestId 重試、換帳號拒絕。

記事與訂貨現有四項檢查通過。以上皆非真實 Firebase／Drive 或 iPhone 驗收。

## 接續順序

1. 使用者已確認新權限與 gateway 設計。先完成目前 Google 未驗證應用程式警告的必要人工操作，再核對 scopes；只授權公司帳號，不授權其他專案、不開收費。
2. 核對／套用 manifest；部署執行身分為公司 owner，網頁入口可接收請求，所有讀寫仍由 Firebase token+Rules 核准。公開入口不等於公開檔案。
3. 取得實際 /exec URL 填入 crm-drive-config.mjs。真實測試 fetch ContentService redirect／iPhone 跨來源存取；未通過則改受限 postMessage iframe transport，禁止 no-cors 假成功。
4. 實際合成檔案上傳、CRM 顯示、下載、私人／群組拒絕測試，不發送測試通知給同事。保留已授權測試資料隔離。
5. CI、服務與瀏覽器核對後才合併部署；最後 iPhone 真實選檔驗收。

前一回合本機 commit 5694f85 是已被 PR17 取代的貼連結方案，不應再推送至 main。正式 main 基準為 0482ba3（PR17）。本候選改為真正集中上傳，尚未上線。

