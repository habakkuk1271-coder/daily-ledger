const SPREADSHEET_ID = '1-8pCQtFgyE2XjKvN-0NT9_sgQm-oYOPEvHjzlb6jWzU';
const RECORDS_SHEET = '帳目';
const SETTINGS_SHEET = '月份設定';

// 正式部署前，請只在 Apps Script 編輯器內把下方字串換成你的私有存取碼。
// 不要把真正的存取碼提交到公開 GitHub repository。
const ACCESS_KEY = 'CHANGE_ME';

function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    const callback = safeCallback_(p.callback || '');
    if (!isAuthorized_(p.key)) return respond_({ok:false,error:'unauthorized'}, callback);
    const action = p.action || 'load';
    const payload = p.payload ? JSON.parse(p.payload) : {};
    let result;
    switch (action) {
      case 'load':
        result = loadAll_();
        break;
      case 'upsertRecord':
        upsertRecord_(payload.record);
        result = {ok:true};
        break;
      case 'deleteRecord':
        deleteRecord_(payload.id);
        result = {ok:true};
        break;
      case 'saveSettings':
        saveSettings_(payload.month, payload.salary, payload.saving);
        result = {ok:true};
        break;
      default:
        result = {ok:false,error:'unknown_action'};
    }
    return respond_(result, callback);
  } catch (err) {
    return respond_({ok:false,error:String(err)}, safeCallback_(e && e.parameter && e.parameter.callback || ''));
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!isAuthorized_(body.key)) return json_({ok:false,error:'unauthorized'});
    switch (body.action) {
      case 'upsertRecord': upsertRecord_(body.record); break;
      case 'deleteRecord': deleteRecord_(body.id); break;
      case 'saveSettings': saveSettings_(body.month, body.salary, body.saving); break;
      default: return json_({ok:false,error:'unknown_action'});
    }
    return json_({ok:true});
  } catch (err) {
    return json_({ok:false,error:String(err)});
  }
}

function isAuthorized_(key) {
  return ACCESS_KEY !== 'CHANGE_ME' && String(key || '') === ACCESS_KEY;
}

function loadAll_() {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rs = ss.getSheetByName(RECORDS_SHEET);
  const settingsSheet = ss.getSheetByName(SETTINGS_SHEET);
  const records = [];
  if (rs.getLastRow() > 1) {
    const values = rs.getRange(2,1,rs.getLastRow()-1,10).getValues();
    values.forEach(r => {
      if (!r[0]) return;
      records.push({
        id:String(r[0]), date:String(r[1]), time:String(r[2]), type:String(r[3]),
        amount:Number(r[4])||0, payment:String(r[5]||''), category:String(r[6]||''),
        note:String(r[7]||''), createdAt:dateText_(r[8]), updatedAt:dateText_(r[9])
      });
    });
  }
  const monthlySettings = {};
  if (settingsSheet.getLastRow() > 1) {
    const values = settingsSheet.getRange(2,1,settingsSheet.getLastRow()-1,4).getValues();
    values.forEach(r => {
      if (r[0]) monthlySettings[String(r[0])] = {salary:Number(r[1])||0,saving:Number(r[2])||0};
    });
  }
  return {ok:true,records,monthlySettings};
}

function upsertRecord_(record) {
  if (!record || !record.id) throw new Error('missing_record_id');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(RECORDS_SHEET);
  const id = String(record.id);
  const now = new Date();
  const row = findRowByFirstColumn_(sh,id);
  const created = row ? sh.getRange(row,9).getValue() : now;
  const sourceOrNote = record.note || record.incomeSource || '';
  const values = [[id,record.date||'',record.time||'',record.type||'',Number(record.amount)||0,record.payment||'',record.category||'',sourceOrNote,created,now]];
  if (row) sh.getRange(row,1,1,10).setValues(values); else sh.appendRow(values[0]);
}

function deleteRecord_(id) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(RECORDS_SHEET);
  const row = findRowByFirstColumn_(sh,String(id));
  if (row) sh.deleteRow(row);
}

function saveSettings_(month,salary,saving) {
  if (!month) throw new Error('missing_month');
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sh = ss.getSheetByName(SETTINGS_SHEET);
  const row = findRowByFirstColumn_(sh,String(month));
  const values = [[String(month),Number(salary)||0,Number(saving)||0,new Date()]];
  if (row) sh.getRange(row,1,1,4).setValues(values); else sh.appendRow(values[0]);
}

function findRowByFirstColumn_(sheet,value) {
  const last = sheet.getLastRow();
  if (last < 2) return 0;
  const vals = sheet.getRange(2,1,last-1,1).getDisplayValues();
  for (let i=0;i<vals.length;i++) if (String(vals[i][0]) === String(value)) return i+2;
  return 0;
}

function dateText_(v) {
  if (!v) return '';
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function safeCallback_(name) {
  return /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(String(name || '')) ? String(name) : '';
}

function respond_(obj, callback) {
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(obj) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return json_(obj);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
