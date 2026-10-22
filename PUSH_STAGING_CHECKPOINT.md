# iPhone CRM Web Push｜安全施工交接｜2026-10-22

**狀態：TWO_IPHONES_LOCKSCREEN_PUSH_PASS／MULTI_MEMBER_SENDER_SAFE_HOLD（兩支不同 Google 帳號的 iPhone 都已實際收到鎖定畫面測試通知；正式多人任務與記事背景發送仍未啟用）**

## 2026-10-22 晚間｜真實任務事件推播首次 Apple 201／本人收件待驗收

- 正式任務事件發送器有額外安全補強：再次核對「事件建立者或完成者」在群組內仍 ACTIVE；撤銷發布人時不應寄送舊事件；Apple 回應必須為 HTTP 201 或 202 才能將已發紀錄改為 SENT。既有 Auth-only static CI 已 PASS。
- GitHub Actions live read-only 事件權限計畫 run `39802553044`：在一個「鴻繽」記事簿讀取 4 筆任務／記事事件，2 筆仍符合事件條件，2 組現有收件對象通過權限及狀態核對、未核准／撤銷收件對象 0、伺服器讀取錯誤 0；輸出 `PUSH_EVENT_READONLY_ROUTING_CHECK_PASS_NO_SEND_NO_WRITES`。只讀取，不發送、不修改正式資料；一次性 workflow 已移除。
- 同時以現有 TEST 專用服務帳號，於 `notificationDeliveryLedger` 與 `notificationSenderCursors` 僅建立兩個 `probe_` 合成文件、伺服器讀回並立即刪除。GitHub Actions run `39803170925` 輸出 `TEST_SENDER_TWO_BOOKKEEPING_COLLECTION_WRITES_CONFIRMED`、`TEST_SENDER_WRITE_READ_DELETE_PASS_NO_TEST_DATA_REMAINING`；不涉及真實使用者、任務、記事或手機訂閱。一次性工作流程已移除。
- 完成一則**真實既有 TASK_COMPLETED 任務事件** Apple Web Push 發送驗證：GitHub Actions run `39803632916`、job `119910922163`，紀錄 `ONE_REAL_EVENT_APPLE_ACCEPTED_201`、`ONE_REAL_EVENT_KIND_TASK_COMPLETED`、`ONE_REAL_EVENT_TARGET_ORIGINAL_OWNER`、`ONE_REAL_EVENT_SENT_MAX_ONE_NO_FIRESTORE_WRITES`。此事件經 server-only 重新核對活動群組、發布者、收件者、時間與唯一 Apple iPhone 訂閱後，限制**只向第一支管理員 iPhone 一次**、僅發送 kind/groupId/taskId（不含任務標題或內文），沒有寫入 Firebase 資料。
- 完成後立即移除可執行的一次性 workflow（commit `29afca279fa3cadc111d56e2107cf40af9d92d42`）及一次性私用發送 JS（commit `505646ec2de1cf2c8c90dfd2e11310a004c02c5c`），防止誤重送。
- 此新驗收**僅證明 Apple HTTP 201**，尚無第一支 iPhone 實際收到「你發布的任務已完成」與按下通知後打開正確任務的使用者截圖。不能先行宣稱背景真實任務深連結實機 PASS；請下一步使用者確認第一支手機是否看到、點後是否開啟任務詳情。
- 既有兩支手機通用推播收件及點擊、第二支 CRM 內通知按「查看」的任務詳情 PASS 全部 FROZEN 不重做。公開設定仍為 `subscriptionsEnabled=true`、`senderEnabled=false`、`environment=SPARK_SUBSCRIPTION_STAGING`；工作流程 `push-sender-review.yml` 仍無 schedule、無推播 secrets，沒有新增付費服務。不得自行開啟全員自動發送。

## 2026-10-22｜第二支 iPhone 通知查看指定任務 PASS

使用者已提供 iPhone 實機截圖：從 CRM「通知」列表按「查看」後，成功開啟指定任務的詳細卡片。畫面可見狀態「已完成」、建立者、完成者、發布與完成時間、回覆，以及「返回通知」。此項是 CRM 內通知導覽實機 PASS，已完成，不需要重做。

不同於通用 Web Push 開啟 CRM，背景系統通知攜帶真實任務或記事深層連結的實機發送，仍待驗證。已通過的兩支 iPhone 收件與點擊 CRM 成果全部保留。

公開設定維持 subscriptionsEnabled=true、senderEnabled=false，正式多人自動發送未開通，沒有新的付費服務。

## 2026-10-22 晚間｜第二支 iPhone 點通知返回 CRM 畫面 PASS；正式任務深層導覽仍未證明

- 使用者提供第二支 iPhone 推播點擊後的實機截圖，畫面清楚可見 **鴻繽科技 CRM → 雲端記事與任務 → 通知**、共用群組「鴻繽」的「有新任務指派」、事件時間「10/22 下午05:15」、通知卡片「查看」。因此第二支 iPhone 的 **點通知進入 CRM 已 PASS/FROZEN**。沒有第二位帳號信箱畫面，因此此張不能單獨再證明登入狀態；此前「不同 Google 帳號」PASS 保留。
- 此前發給第二支 iPhone 的系統測試通知為**無任務 ID 的通用 payload**：`kind:'SECOND_ACCOUNT_ONE_TIME_TEST_NO_PRIVATE_DATA'`，`sw.js` fallback 會開啟 CRM 首頁。截圖中的「有新任務指派」屬於**CRM 內建通知列表**，不應錯報成正式背景 sender 發送了該任務。畫面上方雖有「已開啟通知指定的任務」，但截圖仍在通知列表、含「查看」按鈕，尚不足證明本次由系統推播直接打開指定任務完整內容。任務深層連結與真正事件 sender 仍需另行驗證。
- 已針對**已停用記事簿的殘留通知風險**新增兩層 fail-closed 安全：
  1. `notification-recipient-router.mjs` 若 group 有 `deleteState` 則拒絕任務指派、完成、共用記事三種路由；
  2. `notification-free-sender-REVIEW-ONLY.mjs` 在每次發送前重讀 `stillMember`，也拒絕 `deleteState` 的群組，即使舊成員紀錄仍 ACTIVE 或是原群組擁有者。
  已新增合成 `notification-recipient-router-preflight.mjs` 與 `notification-sender-review-preflight.mjs` 防回歸檢查。**只施工程式，不修改 Firebase 正式資料、不開啟發送。**
- 既有第一支 iPhone 訂閱/Apple 201/鎖定畫面/點擊 PASS 全保留；第二支 iPhone 訂閱/不同身分/EDITOR/Apple 201/鎖定畫面/點擊進 CRM PASS 全保留。
- 正式多人發送持續 **SAFE_HOLD**：公開設定 `subscriptionsEnabled=true`、`senderEnabled=false`、`SPARK_SUBSCRIPTION_STAGING`，GitHub sender `TEST_PUSH_SEND_ENABLED` 未設為 `EXPLICITLY_APPROVED`；沒有新增費用。下一步是測試單筆任務/記事事件如何依權限投遞，驗證帳號隔離、撤銷後不再送，以及點「查看」真的出現指定任務詳情後才啟用廣泛正式發送；不要重送通用測試。

## 2026-10-22 22:47（台南）｜第二支 iPhone 重送／鎖定畫面實機 PASS（勿重做）

- 第二支 iPhone 使用者上傳真實 iOS 鎖定畫面截圖，通知時間約 22:47，顯示「鴻繽科技 CRM 有新通知」、「from 鴻繽科技 CRM」、「點一下即可開啟 CRM 查看資訊」；該手機此前已確認為**不同 Google 帳號**的已註冊 iPhone，且「鴻繽」群組為 ACTIVE EDITOR，與管理員手機不同。
- GitHub Actions 指定一次性 run `39795231630` 產生了**兩次執行 attempt**。第 1 次 job `119880764246` 記錄 `2026-10-22T14:24:04Z SECOND_APPROVED_EDITOR_ONE_SHOT_APPLE_ACCEPTED_201`；第 2 次 job `119892429706` 記錄 `2026-10-22T14:46:51Z SECOND_APPROVED_EDITOR_ONE_SHOT_APPLE_ACCEPTED_201`。兩次均有 `NO_OTHER_MEMBER_NOTIFIED_NO_FIRESTORE_WRITES_SENDER_STAYS_OFF`，最多每次 1 則，沒有寫 Firestore。使用者看到的截圖與第二次 22:46:51 台南時間的重送吻合。**不把只有 Apple HTTP 201 當成實機收件；這次另有使用者手機實拍，因此標記 END_TO_END_DELIVERY_PASS。**
- 第二支手機「訂閱、身分獨立、目前 EDITOR 角色、Apple 接受、鎖定畫面收件」正式 **PASS/FROZEN**。第二支手機**通知點擊是否開啟 CRM 尚未驗收**；具體任務／共用記事推播事件、群組隔離與取消權限後不送仍未驗收。
- 已在本輪移除一度可被觸發的一次性 GitHub workflow `.github/workflows/second-iphone-one-shot-once.yml`（commit `83fcd16125b8cb81a6172f5ff33c680a888538ad`）以及一次性專用 sender JS（commit `024ee5f758cc039e26905de7d4d3c01bc8a14c2c`），防止未來重新執行；不會設定新排程。
- 正式 CRM 公開設定核對為 `subscriptionsEnabled=true`、`senderEnabled=false`、`environment=SPARK_SUBSCRIPTION_STAGING`，既有 GitHub 5 分鐘發送器仍鎖定，**免費 Spark 無升級、無付費資源**。
- 後續最小使用者驗收：請第二支 iPhone 的持有人**點這次通知**，確認進入原本 CRM 並維持該成員 Google 登入；不再傳送更多重複測試通知。下一階段才做真實任務／共用記事事件導覽與收件人隔離，不重做已通過之兩台 iPhone 收件測試。

## 2026-10-22 22:13｜已停用測試記事簿舊邀請：正式 Firebase 單筆撤回 PASS

- 使用者明確確認那本是**已刪除的測試記事簿**。既有程式實際為將 group root 設定 `deleteState=DELETING` 並移出可見列表，並非直接硬刪 Firestore 所有子資料。舊的 `PENDING VIEWER` 邀請沒有同步處理，造成第二支手機殘留提示。
- 在之前已用 Firebase server READBACK 驗證「鴻繽」正確具有三位 ACTIVE EDITOR、唯一另一筆 PENDING 來自 root-owner 已停用的不同記事簿之後，執行一次性 GitHub Actions `39793705292`，job `119875730458`，在寫入之前從 Firebase server 重讀並確認全部條件：同一 verified root 擁有、正好三位 ACTIVE EDITOR、正好一筆已退役群組的 PENDING VIEWER、對應 sentInvites 完整一致，才只把這筆 inbox 的 `status` 從 `PENDING` 更新為 `REVOKED`。
- GitHub 執行紀錄明確回報 `RETIRED_TEST_INVITE_REVOKED_ONE_STATUS_FIELD_PASS`、`ACTIVE_PRIMARY_EDITOR_ROLE_PRESERVED_PASS`、`NO_GROUP_NOTES_TASKS_OR_MEMBERS_MODIFIED_PASS`。**正式伺服器狀態已撤銷，是真實 LIVE PASS，不是模擬**；舊邀請歷史文件還在，但不應再被當成待接受。
- 一次性寫入工作流程已移除（commit `40eb16b39223df6fc102a90d5f3d273df6889828`），不能再次自動執行；不留排程。
- 往後的 `firebase-group-service.mjs` `retireNotebook()` 已加上「先限量從伺服器查所有發出的邀請 → 逐筆驗證 → 撤回所有 PENDING 及伺服器讀回 → 最後才將記事簿設成 DELETING」。ACCEPTED 歷史不動，驗證失敗不設停用鎖。新增 `notebook-lifecycle-preflight.mjs` 合成測試：已接受邀請不變／順序正確／不一致發送紀錄零寫入拒絕。必須等待最新 CI 回報才能標記自動測試 PASS。
- 主 CRM 的第一支 iPhone 推播 4 項 PASS、第二支 iPhone 訂閱和獨立帳號 PASS 持續保留；尚未開啟多人自動發送，沒有新增費用。
- 後續僅需第二支 iPhone 重新讀取「設定 → 收到的共用群組邀請」，應顯示沒有待接受邀請；若介面有歷史資料可見，狀態應已撤回，不可再按接受。不必重做已 PASS。

## 2026-10-22 22:05（台南）｜舊 PENDING 邀請原因已用正式 Firebase READBACK 確診

- 使用者在第一支最高權限 iPhone 的「鴻繽 → 查看此群組邀請紀錄」截圖顯示三位成員的 `已接受／EDITOR`，自己**完全沒有修改**；「收到的共用群組邀請」顯示目前沒有待接受邀請。第二支成員 iPhone 此前顯示一筆原角色 VIEWER 的 PENDING，但 `Firebase permission-denied` SAFE_HOLD。
- 為確認是否同一記事簿，使用既有專用 TEST Firebase service account 以**一次性的 GitHub Actions 唯讀分析**（run `39792660723`, job `119872300657`）對根帳號的「鴻繽」記事簿、三位 ACTIVE 編輯者、各自的 inbox PENDING 與所屬記事簿存在／退休狀態進行有上限的 server-admin reads，不輸出 email／UID／groupId／私人資料。
- **真正根因 PASS**：`INVITE_AUDIT_NOTEBOOKS_1`、`INVITE_AUDIT_ACTIVEEDITORS_3`、`INVITE_AUDIT_MEMBERSWITHPENDING_1`、`INVITE_AUDIT_PENDINGSAMENOTEBOOK_0`、`INVITE_AUDIT_PENDINGOTHERNOTEBOOK_0`、**`INVITE_AUDIT_PENDINGRETIREDNOTEBOOK_1`**，`INVITE_AUDIT_READ_ONLY_NO_RECORDS_MODIFIED`。也就是**不是「鴻繽」的重複邀請**，而是某個**已停用的不同記事簿**留下的 PENDING 舊邀請；因此非該群組成員時，用客戶端 Firebase Rules get/active gate 會被拒絕，造成第二支手機 SAFE_HOLD。
- 管理員「鴻繽」頁只有三筆已接受的 EDITOR 是**正確的**，不會出現「取消重複邀請」按鈕，不要再要求使用者在「鴻繽」找那個按鈕；也不要要求成員點任何舊 VIEWER 邀請，更不能擅自更動 GROUP 成員權限。
- 一次性 GitHub Actions 檢查工作流程 `one-time-invitation-live-readback.yml` 已在成功讀回後移除（commit `e2f3b38249630982cdf6706fb44baf3c100c92a6`），以免以後無意反覆掃描。保留唯讀診斷原始碼作稽核但不執行。**沒有任何 Firebase 寫入或資料刪除。**
- UI 應將這種權限拒絕／無法讀回的過期或未知邀請移至**「歷史／需管理員核對」**，不列入可接受邀請數；不能從一般客戶端 permission-denied 就斷言該筆確實停用（本例已經由專用管理端 READBACK 確認）。不替使用者批次清除歷史 inbox 記錄、不更動 Firebase Rules，也不開付費服務。
- 第一支 iPhone 原有 Push 訂閱、Apple HTTP 201、鎖定畫面收到、點擊進 CRM 等四項 PASS，以及第二支的獨立身分與訂閱 PASS 保留；正式多人 sender 持續安全關閉 `subscriptionsEnabled=true`／`senderEnabled=false`。

## 2026-10-22 晚間｜第二支 iPhone 邀請顯示 SAFE_HOLD 的接續修正

- 使用者第二支 iPhone 顯示「邀請狀態待核對，暫不可接受；目前無法從 Firebase 伺服器確認是否已有成員權限」，因此不能把先前靜態測試 PASS 誤稱該手機實機驗收 PASS。**本輪沒有刪除邀請、改角色、動任何業務資料。**
- 核查 groupService：舊邀請卡住時，可能是待接受邀請所屬記事簿與已加入的「鴻繽」群組不同，或該群組已退休／規則拒絕無成員者的自我查詢。光看截圖不能確認是哪一個；禁止直接把 pending VIEWER 當成現在 EDITOR 應重新接受。
- `firebase-group-service.mjs` 新增 `listGroupsFromServer()`，只從已登入 UID 的 groupIndex 執行 Firestore server-only 枚舉，逐筆 server-only 驗證群組與 ACTIVE 角色；`workspace-v2.html` 以這種正向證據識別已是成員的同群組舊邀請。若讀自己 member 路徑仍被 permission-denied，顯示分類原因與安全說明，**不假裝是可接受的邀請**，也不計入「待接受」數字。
- `firebase-owner-member-service.mjs` 新增最高權限帳號專用 `revokeRedundantPendingInvite()`，必須交易核實：同一群組的 ownerUid、成員 UID 目前 ACTIVE 與角色、成員既有被接受的獨立邀請（同一 recipientEmail）、本次過時 PENDING 邀請與 sent index 均匹配，才只進行 `tx.update(obsolete,{status:'REVOKED'})` 一欄位修改。清除後重新 server readback 驗證舊邀請已 REVOKED 和原成員角色仍 ACTIVE 未變。UI 只有在管理員的 `ownerMembers.roster()` 驗證成員 email 已匹配時，才顯示「取消重複邀請（保留成員權限）」並要求管理員明確二次確認。沒有獲得同群組正向證據就**不顯示**此寫入按鈕。
- 純記憶體合成測試 `redundant-invite-revocation-preflight.mjs` 覆蓋：原本 EDITOR 保持不變、跨群組拒絕、錯誤 email 拒絕、已撤銷成員拒絕、角色漂移拒絕、重複撤銷拒絕、非 root UID 拒絕；新 read-only 目錄模擬測試排除過期 pointer。雲端 repo 的最新 static run `39788549853`、V4 `39788549861`、V5 `39788550289` **PASS**；GitHub Pages `39788549297` **success**。
- 正式 CRM `index.html` iframe 改用 `workspace-v2.html?embedded=1&v=20261022-invitation-acl-diagnostics` 強制 iPhone 快取更新。正式 repo Pages run `39788612263` **success**；全量 R73 WebKit `39788613701` 在本輪紀錄時仍未有最終 verdict，不得記為已 PASS。
- 下一步先讓第二支 iPhone 用「重新整理」重新打開「設定 → 收到的共用群組邀請」，核對新分類。若顯示「已是群組成員，舊邀請不需接受」，無需按任何邀請；若顯示「無法確認／permission-denied」，代表還需要 root owner 查看該邀請所屬群組，由已有正向 evidence 的同群組管理員確認才可取消。**不要求重新做第一支推播等先前 PASS**。
- 仍為 `subscriptionsEnabled=true`、`senderEnabled=false`、`SPARK_SUBSCRIPTION_STAGING`，所有付費服務保持停用；第二支手機實際鎖屏收件與多成員自動 sender 仍待驗證。

## 2026-10-22 21:21（台南時間）｜舊邀請判斷精修完成／不更改實際 EDITOR 權限

- 本輪接續「已經是編輯者，為何又有待接受邀請」問題。**不能只憑兩張截圖斷言 VIEWER 邀請與 EDITOR 所屬同一個群組**：不同記事簿的角色互不衝突。
- 根據真實登入身分對每筆 PENDING 的邀請群組做 `getDocFromServer(groups/{gid}/members/{uid})`：
  1. 若同群組已有 ACTIVE EDITOR/ADMIN/VIEWER → 不計入待接受數字、不提供「接受邀請」，設定頁顯示「已是群組成員，舊邀請不需接受」及現在角色／邀請角色；不得改變現有角色。
  2. 若另一個尚未加入的群組 → 顯示「另一個尚未加入的共用記事簿邀請」，明確提醒接受只影響該記事簿，不會影響在「鴻繽」或其他群組原有角色。
  3. 若伺服器讀取失敗／格式異常 → 顯示待核對並**拒絕提供接受操作**，不能把未知狀態當作尚未加入。
- `firebase-group-service.mjs` 的 `acceptInvite()` 在一切批次寫入之前再讀取已發布 Firestore 伺服器的本人角色。已有 ACTIVE 角色會 `ALREADY_ACTIVE_MEMBER_KEEP_EXISTING_ROLE` 停止；已存在但欄位異常的成員資料會 `MEMBERSHIP_SERVER_STATE_UNEXPECTED_STOP`；網路不可用時也停止。舊邀請文件、原始成員資料與角色**均不刪不改**。
- 合成回歸 `invite-membership-recovery-preflight.mjs` 已覆蓋：舊 VIEWER 不可覆蓋 EDITOR 或 ADMIN、異常狀態 fail-closed、伺服器離線無寫入、普通新成員接受邀請仍成功、原有索引修復仍可使用。對應 `workspace-v2-preflight.mjs` 斷言兩類 UI。
- GitHub Actions `Auth-only static safety checks` run `39785912263` **success**，log `INVITE_MEMBERSHIP_RECOVERY_SYNTHETIC_PASS` / `WORKSPACE_V2_STATIC_GATES_PASS`；雲端記事 GitHub Pages run `39785911537` **success**。主 CRM GitHub Pages run `39785768490` **success**，主頁 iframe 引用版本 `v=20261022-existing-editor-safe-v2`，雲端 JS import `v=20261022-safe-existing-member-v2`，避免 iPhone 舊快取。
- 實際伺服器群組角色**沒有被本次程式施工更動**。除非使用者在第二支 iPhone 的新版設定頁驗收，不能宣稱該 PENDING 邀請已被刪除或 UI 實機 PASS。
- 第一支 iPhone 鎖定畫面推播、點擊 CRM 的 PASS 保留。第二支 iPhone 已有 Firebase 訂閱與不同 Google 身分 PASS；第二支手機背景推播正式收件及任務/記事深層導覽仍待實機驗收。正式群組自動發送 `senderEnabled=false`、`TEST_PUSH_SEND_ENABLED` 未啟用；無新增費用、不重做之前 PASS。

## 2026-10-22 20:39+｜現有 EDITOR 與舊 PENDING 邀請衝突：UI/寫入雙重保護

- 用戶在最高權限「鴻繽」共用記事簿群組的成員管理截圖看到 **3 位其他成員**，其中第二支 iPhone 對應成員顯示目前角色 **EDITOR**；但此前第二支 iPhone「收到的邀請」有一筆 **PENDING VIEWER**。這兩種來源獨立，故已編輯者仍見待接受邀請。**照片並未提供該邀請的群組 ID，因此不能斷言兩畫面必定是同一群組。**
- 已檢查 `firebase-group-service.mjs`，原 `acceptInvite()` 對 `PENDING` 邀請使用 `writeBatch().set(member(...),{role:invitation.role})`，如 UI 不先檢查已存在的 ACTIVE 成員角色，就可能請求把 EDITOR 角色改寫成 VIEWER（最終 Firestore Rules 仍具權威，禁止假定真的降級）。
- 已施工 **Client Safety Gate**：`currentMembershipRole(groupId)` 使用本人登入身分及 **getDocFromServer** 查自己的當前成員紀錄；`acceptInvite()` 於任何批次寫入前必須通過伺服器查核，若已經 ACTIVE，拋出 `ALREADY_ACTIVE_MEMBER_KEEP_EXISTING_ROLE`，原有角色與歷史邀請資料均不修改。
- 已施工 **UI Gate**：收到 PENDING 邀請時逐一對應 `groupId` 執行 server readback；若本群已是 EDITOR/ADMIN/VIEWER，**不再視為待接受、不再顯示「接受邀請」按鈕**；於設定中僅說明「已是群組成員，舊邀請不需接受」及原/新角色。若伺服器核對失敗，以 SAFE_HOLD 暫不顯示接受按鈕。若本來就不同群組／非成員，仍保留正常邀請流程。成員索引失落時以當前權限而非舊邀請進行獨立索引修復。
- `invite-membership-recovery-preflight.mjs` 新增純記憶體測試：已有 EDITOR 時再次收到 VIEWER invite 不可覆蓋角色、不修改 invitation、不產生 pointer write；原本正常非成員接收邀請，以及 REVOKED 邏輯仍保留。新增 `workspace-v2-preflight.mjs` 靜態 UI Gate。**不動任何正式 Firestore 成員權限、群組、邀請文件、報價或供應商進價。**
- GitHub 雲端記事服務、iPhone 內嵌頁快取版本已更新，等最新版部署 readback PASS。注意不是「已經刪除舊邀請」：此階段保留歷史文件，只防止過時邀請誤導 UI 或更動既有權限。
- 不要求用戶再次按此前 PENDING VIEWER 邀請；請重新開啟第二支 iPhone 的「記事 → 設定」，查看是否顯示舊邀請無需接受。若仍為真正待接受，代表不是同群組，須核對該邀請的群組 ID，絕不自動調整 EDITOR 角色。

## 2026-10-22 20:32｜第二支 iPhone 帳號獨立驗收 PASS／邀請仍待接受

- 第二支 iPhone 先前已有真實 Firebase 訂閱「測試 PASS」截圖；本次新增「設定 → Google 帳號」實機截圖，確認它使用與第一支最高權限帳號**不同**的 Google 登入帳號。**第二支手機訂閱＋不同身分 PASS／FROZEN**。
- 第二支手機畫面顯示「收到的共用群組邀請」內有一筆**尚未接受**的邀請，權限是 **VIEWER／檢視者**；同頁可見其獨立設定的公開暱稱。基於個資最小化，交接紀錄不保存第二位使用者的完整信箱、UID 或裝置推播 endpoint。
- 請第二位使用者在自己的 iPhone「設定 → 收到的共用群組邀請」親自按「接受邀請」，等待狀態變成已加入群組；再以 VIEWER 身分驗證應可讀共用記事、不可取得管理員權限，不得修改成員權限。
- 目前**尚無**第二支 iPhone 鎖定畫面收到訊息、任務指派或記事通知／點擊深層導覽的 PASS；第一支手機四項驗收維持 FROZEN，不重做。
- `notification-recipient-router.mjs` 只將 `status==='ACTIVE'` 且角色在 `OWNER/ADMIN/EDITOR/VIEWER` 的成員列入推播名單；因此第二位使用者**未接受邀請前不得對其送群組推播**。
- 繼續維持 `subscriptionsEnabled=true`、`senderEnabled=false`、`SPARK_SUBSCRIPTION_STAGING`；不得啟用定時群組發送或付費資源。

## 2026-10-22 20:21｜第一支 iPhone 推播點擊開啟 CRM｜實機 PASS／FROZEN

- 使用者提供第二張 iPhone 實機截圖，確認**實際點擊先前已收到的鎖定畫面通用通知後，已回到「鴻繽科技 CRM」既有 App**，畫面停留在「雲端記事與任務 → 設定」，Google 帳號 `honbin002@gmail.com` 仍保持登入；沒跳往第三方網站。對應 push `notificationclick`／啟動 CRM 的端到端驗收 **PASS**，不得重做。
- 第一支 iPhone 的四項完成證據鎖定：實際 Firebase 本人訂閱建立與伺服器讀回 PASS；Apple HTTP 201 PASS；鎖定畫面收到系統通知 PASS；點擊後返回同一 CRM PASS。
- 上述通知是**通用測試訊息**、不含任務 ID／記事 ID，故本輪不能推論具體任務、共用記事的點擊深層導覽已通過，也不能推論所有成員會收到。
- 下一階段需要**另一支 iPhone、另一個已由最高權限帳號核准的 Google 帳號**：Safari 開啟同一正式 CRM 加入主畫面、以成員自己的 Google 帳號登入、在雲端記事與任務標題右側自行按「登記這支 iPhone（測試）」並允許通知；取得 Firebase 訂閱讀回 PASS 後，再執行**只針對第二位成員一支裝置**的有限測試，驗證越權拒絕、群組成員/撤銷後拒送，以及 task/note 深層導覽。不同帳號不得共用最高權限登入身分。
- 此時安全發布狀態仍為 `subscriptionsEnabled=true`、`senderEnabled=false`、`environment=SPARK_SUBSCRIPTION_STAGING`；一鍵測試工作流程已移除，五分鐘排程在 `TEST_PUSH_SEND_ENABLED` 未設為 `EXPLICITLY_APPROVED` 時絕不執行。保持 Firebase Spark、零新增費用、正式資料不更動。

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
