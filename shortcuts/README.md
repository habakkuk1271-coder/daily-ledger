# 日日帳｜iPhone 捷徑快速記帳 V1

> 開發分支：`shortcut-integration-v1`。本文件不改動正式 `main`、正式 GitHub Pages 或 Google Sheet 結構。

## 目標

從 iPhone 鎖定畫面或主畫面的「捷徑」小工具開始，在數秒內新增一筆日日帳支出；寫入既有 Apps Script / Google Sheet，之後由日日帳正常讀取並計入預算、紀錄與趨勢。

## V1 使用流程

1. 點「日日帳｜快速記帳」。
2. 輸入金額（必填，正數）。
3. 選付款方式：
   - 現金
   - 永豐信用卡
   - 國泰cube卡
   - 富邦possible卡
   - 聯邦吉鶴卡
   - 台新信用卡
4. 選分類：
   - 餐飲
   - 交通
   - 日用品
   - 娛樂
   - 服飾
   - 保險
   - 電信規費
   - 奉獻款
   - 其他
5. 備註：可略過。
6. 自動使用當下日期、時間，產生唯一 ID。
7. POST 到既有 Apps Script `upsertRecord`。
8. 後端回覆 `ok:true` 才顯示「已記帳 $金額」。失敗時顯示「尚未寫入，請改用日日帳 App」。

## 寫入資料格式

```json
{
  "action": "upsertRecord",
  "key": "<私人存取碼>",
  "record": {
    "id": "shortcut-<timestamp>-<random>",
    "date": "YYYY-MM-DD",
    "time": "HH:mm",
    "type": "expense",
    "amount": 120,
    "payment": "國泰cube卡",
    "category": "餐飲",
    "incomeSource": "",
    "note": "午餐"
  }
}
```

## 安全原則

- 不把私人存取碼寫進 GitHub。
- 不建立公開、免驗證的捷徑寫入 API。
- 捷徑透過 HTTPS POST 呼叫既有 Apps Script；存取碼只存在使用者自己的 iPhone 捷徑中。
- 正式 App 的 `main` 不需要為 V1 快速記帳改 UI。
- Apps Script 現有 `doPost` 已可接受 `upsertRecord`，因此第一版原則上不需更動 Google Sheet schema。

## 與正式 App 的一致性

捷徑建立的 `type=expense` 紀錄與 App 建立的支出使用相同欄位，因此：

- 信用卡刷卡仍在刷卡日算消費。
- 現金與信用卡付款方式沿用現有名稱。
- 分類沿用正式版固定分類。
- 不新增「捷徑支出」特殊類型，避免破壞預算與趨勢。

## V1 不做

- 不從捷徑直接修改月薪／儲蓄設定。
- 不處理信用卡預留或還款。
- 不在第一版加入大量常用模板。
- 不修改正式版資料庫結構。
- 不使用 UI 自動點擊 Safari。

## V1 驗收

使用一筆明確測試資料，例如 `$1 / 現金 / 其他 / 捷徑驗收`：

1. 捷徑回覆成功。
2. Google Sheet 恰好一筆、欄位正確。
3. 開啟日日帳後可讀到同一筆。
4. 本月消費增加 $1。
5. 趨勢計入 $1。
6. 刪除測試資料後 Google Sheet 與 App 都恢復原正式資料，不碰使用者其他帳目。

## 下一階段

V1 驗收後可再做：

- 「午餐」「加油」等一鍵模板，只問金額。
- 語音/Siri 記帳。
- Action Button（支援機型）觸發。
- 鎖定畫面與主畫面不同入口。
