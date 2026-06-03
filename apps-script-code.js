// 1. SPREADSHEET_ID adalah ID dari Google Spreadsheet (Excel) tempat Anda menyimpan data.
// BUKAN URL Apps Script.
// Format yang benar: '1KY7OgtH51lCAe8jXFZtoM5oyO01fryCJ35tMmiLgfHU'
// (Dapat diambil dari URL Spreadsheet Anda: https://docs.google.com/spreadsheets/d/ID_INI/edit)
const SPREADSHEET_ID = 'GANTI_DENGAN_SPREADSHEET_ID_ANDA';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    if (action === 'addUser') return addUser(data.user);
    if (action === 'updateUser') return updateUser(data.uid, data.updates);
    
    if (action === 'addTransaction') return addTransaction(data.transaction);
    if (action === 'updateTransaction') return updateTransaction(data.id, data.updates);
    if (action === 'deleteTransaction') return deleteTransaction(data.id);
    
    if (action === 'addExpense') return addExpense(data.expense);
    if (action === 'updateExpense') return updateExpense(data.id, data.updates);
    if (action === 'deleteExpense') return deleteExpense(data.id);
    
    if (action === 'saveMenu') return saveMenu(data.menu);
    if (action === 'deleteMenu') return deleteMenu(data.categoryId, data.name, data.type);

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'syncAll') return syncAll();
    
    return jsonResponse({ success: true, message: 'Google Apps Script API is running!' });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message });
  }
}

function getSpreadsheet() {
  let spId = SPREADSHEET_ID;
  if (spId.includes('docs.google.com/spreadsheets/d/')) {
    const match = spId.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
      spId = match[1];
    }
  } else if (spId.includes('script.google.com')) {
    throw new Error('SPREADSHEET_ID salah! Anda memasukkan URL Apps Script (' + spId + '). Tolong ganti dengan ID dari file Google Spreadsheet Anda (yang berakhiran dengan /edit).');
  }
  
  if (spId === 'GANTI_DENGAN_SPREADSHEET_ID_ANDA') {
    return SpreadsheetApp.getActiveSpreadsheet();
  }
  return SpreadsheetApp.openById(spId);
}

function getSheet(sheetName) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    // Initialize headers if new sheet
    if (sheetName === 'users') {
      sheet.appendRow(['uid', 'email', 'displayName', 'photoURL', 'role', 'status', 'createdAt']);
    } else if (sheetName === 'transactions') {
      sheet.appendRow(['id', 'categoryId', 'date', 'itemName', 'quantity', 'totalPrice', 'paymentMethod', 'notes', 'sisaBon', 'sisaJualKembali', 'sisaLaukNotes', 'sisaLakuNotes', 'authorId']);
    } else if (sheetName === 'expenses') {
      sheet.appendRow(['id', 'categoryId', 'date', 'itemName', 'amount', 'notes', 'authorId']);
    } else if (sheetName === 'menus') {
      sheet.appendRow(['categoryId', 'name', 'price', 'type']);
    }
  }
  return sheet;
}

function syncAll() {
  return jsonResponse({
    success: true,
    users: getSheetData('users'),
    transactions: getSheetData('transactions'),
    expenses: getSheetData('expenses'),
    menus: getSheetData('menus')
  });
}

function getSheetData(sheetName) {
  const sheet = getSheet(sheetName);
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Only headers
  
  const headers = data[0];
  const rows = data.slice(1);
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

function addUser(user) {
  const sheet = getSheet('users');
  // Check for duplicate uid
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === user.uid) {
      return jsonResponse({ success: true, message: 'User already exists' });
    }
  }

  const row = [
    user.uid,
    user.email,
    user.displayName,
    user.photoURL || '',
    user.role,
    user.status,
    user.createdAt || new Date().toISOString()
  ];
  sheet.appendRow(row);
  return jsonResponse({ success: true });
}

function updateUser(uid, updates) {
  const sheet = getSheet('users');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === uid) {
      // Update fields
      const headers = data[0];
      headers.forEach((h, colIndex) => {
        if (updates[h] !== undefined) {
          sheet.getRange(i + 1, colIndex + 1).setValue(updates[h]);
        }
      });
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'User not found' });
}

function addTransaction(t) {
  const sheet = getSheet('transactions');
  const row = [
    t.id,
    t.categoryId,
    t.date || new Date().toISOString(),
    t.itemName,
    t.quantity,
    t.totalPrice,
    t.paymentMethod,
    t.notes || '',
    t.wartegDetails?.sisaBon !== undefined ? t.wartegDetails.sisaBon : '',
    t.wartegDetails?.sisaJualKembali !== undefined ? t.wartegDetails.sisaJualKembali : '',
    t.wartegDetails?.sisaLaukNotes || '',
    t.wartegDetails?.sisaLakuNotes || '',
    t.authorId || ''
  ];
  sheet.appendRow(row);
  return jsonResponse({ success: true, id: t.id });
}

function updateTransaction(id, updates) {
  const sheet = getSheet('transactions');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const headers = data[0];
      
      // Handle nested wartegDetails flat mapping
      let flatUpdates = { ...updates };
      if (updates.wartegDetails) {
        flatUpdates.sisaBon = updates.wartegDetails.sisaBon;
        flatUpdates.sisaJualKembali = updates.wartegDetails.sisaJualKembali;
        flatUpdates.sisaLaukNotes = updates.wartegDetails.sisaLaukNotes;
        flatUpdates.sisaLakuNotes = updates.wartegDetails.sisaLakuNotes;
        delete flatUpdates.wartegDetails;
      }
      
      headers.forEach((h, colIndex) => {
        if (flatUpdates[h] !== undefined) {
          sheet.getRange(i + 1, colIndex + 1).setValue(flatUpdates[h]);
        }
      });
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Transaction not found' });
}

function deleteTransaction(id) {
  const sheet = getSheet('transactions');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Transaction not found' });
}

function addExpense(e) {
  const sheet = getSheet('expenses');
  const row = [
    e.id,
    e.categoryId,
    e.date || new Date().toISOString(),
    e.itemName,
    e.amount,
    e.notes || '',
    e.authorId || ''
  ];
  sheet.appendRow(row);
  return jsonResponse({ success: true, id: e.id });
}

function updateExpense(id, updates) {
  const sheet = getSheet('expenses');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const headers = data[0];
      headers.forEach((h, colIndex) => {
        if (updates[h] !== undefined) {
          sheet.getRange(i + 1, colIndex + 1).setValue(updates[h]);
        }
      });
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Expense not found' });
}

function deleteExpense(id) {
  const sheet = getSheet('expenses');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Expense not found' });
}

function saveMenu(menu) {
  const sheet = getSheet('menus');
  const row = [menu.categoryId, menu.name, menu.price, menu.type];
  sheet.appendRow(row);
  return jsonResponse({ success: true });
}

function deleteMenu(categoryId, name, type) {
  const sheet = getSheet('menus');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === categoryId && data[i][1] === name && data[i][3] === type) {
      sheet.deleteRow(i + 1);
      return jsonResponse({ success: true });
    }
  }
  return jsonResponse({ success: false, error: 'Menu not found' });
}

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
