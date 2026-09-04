const SPREADSHEET_ID = '1-8pCQtFgyE2XjKvN-0NT9_sgQm-oYOPEvHjzlb6jWzU';
const RECORDS_SHEET = '帳目';
const SETTINGS_SHEET = '月份設定';
const ACCESS_KEY_PROPERTY = 'ACCESS_KEY';
const SHORTCUT_KEY_PROPERTY = 'SHORTCUT_KEY';

const SHORTCUT_ALLOWED_TYPES = ['expense','income','advance','reimbursement'];
const SHORTCUT_ALLOWED_PAYMENTS = ['現金','永豐信用卡','國泰cube卡','富邦possible卡','聯邦吉鶴卡','台新信用卡'];
const SHORTCUT_ALLOWED_CATEGORIES = ['餐飲','交通','日用品','娛樂','服飾','保險','電信規費','奉獻款','其他'];

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const action = p.action || 'load';
    const data = p.data ? JSON.parse(p.data) : {};
    let result;
    if (action !== 'ping') requireAccess_(p.key);
    switch (action) {
      case 'load':
        result = loadAll_();
        break;
      case 'ping':
        result = {ok:true,version:3,auth:'required'};
        break;
      case 'upsertRecord':
        withLock_(function(){ upsertRecord_(data.record); });
        result = {ok:true};
        break;
      case 'deleteRecord':
        withLock_(function(){ deleteRecord_(data.id); });
        result = {ok:true};
        break;
      case 'saveSettings':
        withLock_(function(){ saveSettings_(data.month, data.salary, data.saving, data.offeringReserve); });
        result = {ok:true};
        break;
      default:
        result = {ok:false,error:'unknown_action'};
    }
    return output_(result, p.callback);
  } catch (err) {
    return output_({ok:false,error:String(err && err.message ? err.message : err)}, e && e.parameter && e.parameter.callback);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');

    if (body.action === 'shortcutAddRecord') {
      requireShortcutAccess_(body.shortcutKey);
      let insertedId = '';
      withLock_(function(){ insertedId = shortcutAddRecord_(body.record); });
      return json_({ok:true,id:insertedId});
    }

    requireAccess_(body.key);
    switch (body.action) {
      case 'upsertRecord': withLock_(function(){ upsertRecord_(body.record); }); break;
      case 'deleteRecord': withLock_(function(){ deleteRecord_(body.id); }); break;
      case 'saveSettings': withLock_(function(){ saveSettings_(body.month, body.salary, body.saving, body.offeringReserve); }); break;
      default: return json_({ok:false,error:'unknown_action'});
    }
    return json_({ok:true});
  } catch (err) {
    return json_({ok:false,error:String(err && err.message ? err.message : err)});
  }
}

function loadAll_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rs = ss.getSheetByName(RECORDS_SHEET);
  const settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
  const records = [];

  if (rs.getLastRow() > 1) {
    const count = rs.getLastRow() - 1;
    const raw = rs.getRange(2,1,count,11).getValues();
    const shown = rs.getRange(2,1,count,11).getDisplayValues();
    raw.forEach(function(r,i) {
      if (!shown[i][0]) return;
      records.push({
        id:String(shown[i][0]),
        date:String(shown[i][1]),
        time:String(shown[i][2]),
        type:String(shown[i][3]),
        amount:Number(r[4]) || 0,
        payment:String(shown[i][5] || ''),
        category:String(shown[i][6] || ''),
        incomeSource:String(shown[i][7] || ''),
        note:String(shown[i][8] || ''),
        createdAt:iso_(r[9]),
        updatedAt:iso_(r[10])
      });
    });
  }

  const monthlySettings = {};
  if (settingsSheet.getLastRow() > 1) {
    const count = settingsSheet.getLastRow()-1;
    const values = settingsSheet.getRange(2,1,count,5).getValues();
    const shown = settingsSheet.getRange(2,1,count,5).getDisplayValues();
    values.forEach(function(r,i) {
      if (shown[i][0]) monthlySettings[String(shown[i][0])] = {salary:Number(r[1])||0,saving:Number(r[2])||0,offeringReserve:Number(r[3])||0};
    });
  }
  return {ok:true,version:2,records:records,monthlySettings:monthlySettings};
}

function shortcutAddRecord_(record) {
  if (!record) throw new Error('missing_record');
  const type = String(record.type || '');
  if (SHORTCUT_ALLOWED_TYPES.indexOf(type) < 0) throw new Error('shortcut_type_not_allowed');

  const amount = Number(record.amount);
  if (!(amount > 0) || amount > 10000000) throw new Error('invalid_amount');

  const date = String(record.date || '');
  const time = String(record.time || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('invalid_date');
  if (!/^\d{2}:\d{2}$/.test(time)) throw new Error('invalid_time');

  const rawId = String(record.id || '');
  if (!/^shortcut-[A-Za-z0-9_-]{8,120}$/.test(rawId)) throw new Error('invalid_shortcut_id');

  let payment = String(record.payment || '');
  let category = String(record.category || '');
  let incomeSource = String(record.incomeSource || '');
  const note = String(record.note || '').slice(0,300);

  if (type === 'expense' || type === 'advance') {
    if (SHORTCUT_ALLOWED_PAYMENTS.indexOf(payment) < 0) throw new Error('invalid_payment');
  } else {
    payment = '';
  }

  if (type === 'expense') {
    if (SHORTCUT_ALLOWED_CATEGORIES.indexOf(category) < 0) throw new Error('invalid_category');
    incomeSource = '';
  } else if (type === 'advance') {
    category = '代墊';
    incomeSource = '';
  } else if (type === 'reimbursement') {
    category = '請款入帳';
    payment = '';
  } else if (type === 'income') {
    category = '額外收入';
    payment = '';
  }

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(RECORDS_SHEET);
  if (findRowByFirstColumn_(sh, rawId)) throw new Error('duplicate_shortcut_id');

  const now = new Date();
  sh.appendRow([
    rawId,
    date,
    time,
    type,
    amount,
    payment,
    category,
    incomeSource,
    note,
    now,
    now
  ]);
  return rawId;
}

function upsertRecord_(record) {
  if (!record || !record.id) throw new Error('missing_record_id');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(RECORDS_SHEET);
  const id = String(record.id);
  const now = new Date();
  const row = findRowByFirstColumn_(sh,id);
  const created = row ? sh.getRange(row,10).getValue() : now;
  const values = [[
    id,
    record.date || '',
    record.time || '',
    record.type || '',
    Number(record.amount) || 0,
    record.payment || '',
    record.category || '',
    record.incomeSource || '',
    record.note || '',
    created,
    now
  ]];
  if (row) sh.getRange(row,1,1,11).setValues(values);
  else sh.appendRow(values[0]);
}

function deleteRecord_(id) {
  if (!id) throw new Error('missing_record_id');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(RECORDS_SHEET);
  const row = findRowByFirstColumn_(sh,String(id));
  if (row) sh.deleteRow(row);
}

function saveSettings_(month,salary,saving,offeringReserve) {
  if (!month) throw new Error('missing_month');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SETTINGS_SHEET);
  const row = findRowByFirstColumn_(sh,String(month));
  const values = [[String(month),Number(salary)||0,Number(saving)||0,Number(offeringReserve)||0,new Date()]];
  if (row) sh.getRange(row,1,1,5).setValues(values);
  else sh.appendRow(values[0]);
}

function findRowByFirstColumn_(sheet,value) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const vals = sheet.getRange(2,1,last-1,1).getDisplayValues();
  for (let i=0;i<vals.length;i++) if (String(vals[i][0]) === String(value)) return i+2;
  return 0;
}

function requireAccess_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty(ACCESS_KEY_PROPERTY);
  if (!expected) throw new Error('access_key_not_configured');
  if (!provided || String(provided) !== String(expected)) throw new Error('unauthorized');
}

function requireShortcutAccess_(provided) {
  const expected = PropertiesService.getScriptProperties().getProperty(SHORTCUT_KEY_PROPERTY);
  if (!expected) throw new Error('shortcut_key_not_configured');
  if (!provided || String(provided) !== String(expected)) throw new Error('shortcut_unauthorized');
}

function withLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { fn(); } finally { lock.releaseLock(); }
}

function iso_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) return value.toISOString();
  return String(value);
}

function output_(obj, callback) {
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(String(callback))) {
    return ContentService.createTextOutput(String(callback) + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(obj);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
