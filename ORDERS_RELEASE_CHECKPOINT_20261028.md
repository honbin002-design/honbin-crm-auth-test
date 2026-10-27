# 訂貨上線接續紀錄

狀態：RELEASE_CANDIDATE_TESTED / FIREBASE_DEPLOY_BLOCKED

使用者已要求零新增費用完成正式上線。限 Spark、現有公開 GitHub 儲存庫及標準免費 runner；禁止 Blaze、付費服務、付費 API、付費 runner。

## 已完成

- 官方控制台唯讀讀回：現行規則仍含記事、任務 V5 bridge、帳號核准、暱稱、本人推播訂閱及管理員進價限制，沒有 orders match。
- 手動複合索引頁為空；自動索引例外為 notes.createdAt、tasks.createdAt、tasks.completedAt 集合群組遞增，既有集合索引保持不變。
- 修正直接轉部分到貨／已完成可能缺訂貨日期與訂貨人；client 與 rules 同步強制檢查。
- 修正群組／帳號切換後舊查詢或儲存回應覆蓋新畫面，防止重複載入更多；搜尋支援已載入的公開暱稱。
- 新增純函式合併器，只插入 orders 區塊，移除新增區塊後必須與輸入逐字相同。
- 本機 Firestore emulator：訂貨與異動紀錄交易、越權拒絕、既有記事／帳號／推播／進價限制，以及任務延期 V5 bridge 相容性全部 PASS。這是合成身分和資料，沒有存取正式 Firebase。

## 真實阻擋與未完成

- 新瀏覽器工作階段開啟 Firebase 時回報 net::ERR_TOO_MANY_REDIRECTS；讀取錯誤頁遭 URL policy 拒絕，沒有繞過。
- 本輪沒有發布 Firestore 規則、沒有建立索引、沒有修改正式資料，也沒有宣稱真實 TEST 或 iPhone 驗收 PASS。
- 本機 emulator 使用與已觀察結構相符的合成 baseline；不是完整已發布規則的字元雜湊證明。正式部署前必須再次從控制台讀回完整規則，透過合併器逐字保存既有內容，並測試實際合併結果。
- 原始 CRM 行事曆候選 PR #3 仍需真實授權及 TEST 驗收；不得只靠靜態檢查宣稱手機日曆同步完成。

## 後續必要順序

1. 恢復 Firebase 官方控制台登入，不進行重開循環；如遇登入、CAPTCHA、敏感權限確認則交接。
2. 讀回最新完整 rules 並產生 additive-only 候選，使用此候選執行合成回歸及隔離 TEST。
3. 訂貨複合索引：orders / COLLECTION / isCompleted ASC + updatedAt DESC；保留現有 indexes。
4. 真實 TEST：建立一筆合成訂貨、依序變更狀態、伺服器讀回 history 的更動者及時間、檢查全部／已完成／未完成與帳號隔離。任何拒絕或不明狀態皆保持 HOLD。
5. 通過後才發布正式規則與 CRM UI，讀回已部署內容及 GitHub Pages 成功結果。不要把 emulator PASS 寫成真實驗收 PASS。
