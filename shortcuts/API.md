# iPhone 捷徑專用寫入 API

此接口只供 iPhone「捷徑」快速記帳使用，與日日帳完整管理權限分離。

## Action

POST JSON 到現有 Apps Script Web App：

`action = shortcutAddRecord`

需要：

`shortcutKey`

此 key 來自 Apps Script Script Properties 的 `SHORTCUT_KEY`，不可放入 GitHub。

## 權限限制

捷徑接口只能：
- 新增一筆新紀錄。

不能：
- 讀取帳目。
- 修改既有紀錄。
- 刪除紀錄。
- 修改月份設定。
- 使用完整 `ACCESS_KEY` 權限。

## 安全限制

- id 必須以 `shortcut-` 開頭。
- 重複 id 會拒絕，不會覆蓋既有紀錄。
- amount 必須 > 0 且 <= 10,000,000。
- 日期格式固定 YYYY-MM-DD。
- 時間格式固定 HH:mm。
- type 僅允許 expense / income / advance / reimbursement。
- 支出與代墊付款方式只允許日日帳現有付款方式。
- expense 分類只允許日日帳現有分類。
- note 最多 300 字元。

## Request 範例

```json
{
  "action": "shortcutAddRecord",
  "shortcutKey": "<裝置內保存的捷徑專用密鑰>",
  "record": {
    "id": "shortcut-<UUID>",
    "date": "2026-09-04",
    "time": "22:40",
    "type": "expense",
    "amount": 120,
    "payment": "現金",
    "category": "餐飲",
    "incomeSource": "",
    "note": "晚餐"
  }
}
```

成功：

```json
{"ok":true,"id":"shortcut-..."}
```

## 部署

部署前須在 Apps Script → 專案設定 → 指令碼屬性新增：

`SHORTCUT_KEY = <長隨機密鑰>`

然後更新原本同一個 Web App 部署，不建立新網址。
