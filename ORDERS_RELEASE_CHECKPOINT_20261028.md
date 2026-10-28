# 訂貨上線接續紀錄｜2026-10-28 07:18 台北

狀態：EXACT_LIVE_RULES_EMULATOR_PASS / REAL_TEST_GATE_REQUIRES_USER_DECISION

## 固定限制與版本

- 零新增費用；只用 Spark、現有公開 GitHub 儲存庫與標準免費 runner，禁止 Blaze、付費 API／服務／runner。
- TEST 程式修正已合併 PR #2；commit d95161ced79b0e1ad0b74bfbc40fcfcce1abc3f4，Pages run 40596473692 SUCCESS。
- 正式 CRM 訂貨／行事曆候選 PR #3 仍未合併；尚未真實驗收、尚未正式上線。

## 本輪最新已完成

- 安全登入表單成功，Firebase 控制台已恢復且顯示 Spark 每月 0 美元。
- 透過 UI 複製現行已發布完整規則：35873 bytes / 676 lines，沒有 orders match。
- baseline SHA256：8217d307cd02f391ed95ede9546b2375771fcdf8e53fe08ccfd6e11d4fa5f678。
- 離線合併 orders，既有規則逐字保存；合併後 42335 bytes，SHA256：bfa1ef44d1b8df12cb2d1e0fec9876a845317bfaa5ac30931496ea796570698e。
- 使用這份實際合併規則執行 Firestore emulator；只在測試副本把固定 owner UID 對映為合成 uid_owner，正式候選未替換。訂貨交易／不可變更歷史／越權拒絕、既有記事／核准帳號／推播／進價 ACL、任務 V5 bridge 延期相容性三組全部 PASS。
- 既有 notes/tasks 集合群組索引保持原狀。

## 阻擋與未完成

- 已填好 orders / COLLECTION / isCompleted ASC + updatedAt DESC 索引設定，但按建立時自動審查拒絕：使用者原要求真實 TEST 通過後才能修改 PROD，emulator 不能代替真實 TEST。隨即取消設定，沒有索引被建立。
- 嘗試準備獨立免費 TEST 專案 HONBIN-CRM-ORDERS-TEST；Google 明確顯示帳號專案數量已達上限，無法建立。沒有新專案、沒有申請提高配額、沒有付費操作。
- 沒有發布規則、沒有改正式資料、沒有宣稱真實 TEST／iPhone 驗收 PASS。
- 目前需要使用者明確裁決：允許在現有 Spark 專案先新增訂貨規則與複合索引，僅以隔離測試群組進行真實驗收；通過後再開正式入口。這是對原真實 TEST 前不得改 PROD 限制的例外，尚未獲得，不得自行推定已批准。

## 後續順序

1. 保留登入與現有 Spark。若使用者批准上述例外，再次讀回 rules 確認 baseline 未漂移。
2. 以離線合併器只插入 orders 區塊，所有既有權限逐字不變。若先限制只允許指定隔離 TEST 群組，必須針對限制後的精確規則再測試，才能發布。
3. 建立上述單一 orders 複合索引；保留所有既有索引。
4. 真實 TEST 使用合成訂貨，驗證新增、狀態、全部／已完成／未完成、異動者與時間、重複儲存保護、跨群組及未授權拒絕。測試資料不可混入正式業務群組；不可發送測試通知給同事。
5. 真實 TEST 通過後再發布正式規則與 CRM UI，核對 Pages 部署和 Firebase readback。行事曆個人 Google 授權與真實同步也仍需完成，不能用靜態檢查替代。

## 2026-10-28 正式部署結果

- 使用者確認發布後，Firebase 官方控制台已發布訂貨規則；重新載入後全文 42,335 字元與已完成模擬驗收的增量規則完全一致（SHA-256 `bfa1ef44d1b8df12cb2d1e0fec9876a845317bfaa5ac30931496ea796570698e`）。原有正式規則全文保留。
- `orders` 集合複合索引 `isCompleted ASC, updatedAt DESC` 已啟用，索引 ID `CICAgJiUpoMK`。
- 正式 CRM 日曆 PR #3 已合併；其後 R73 七模組檢查與 GitHub Pages 部署成功。訂貨介面正式文字更新於本次提交。
- Firebase 計費方案仍為 Spark，每月 $0；未啟用 Blaze 或付費服務。
- 尚需瀏覽器實際登入後之訂貨建立／修改／歷史及跨帳號拒絕驗收；模擬器 ACL 與舊功能回歸已通過。
