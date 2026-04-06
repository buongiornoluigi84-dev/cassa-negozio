// ============================================================
//  NEGOZIO — Daily Revenue App
//  Google Apps Script — Backend
//  Collega questo script al tuo nuovo Google Sheet
// ============================================================

var ss = SpreadsheetApp.getActiveSpreadsheet();
var sheetRevenue = ss.getSheetByName('DailyRevenue');
var sheetDB      = ss.getSheetByName('AnnualDB');

// ------------------------------------------------------------
// ROUTER
// ------------------------------------------------------------

function doPost(e) {
  var action = e.parameter.action;
  if (action === 'addRevenue')    return addRevenue(e);
  if (action === 'updateRevenue') return updateRevenue(e);
}

function doGet(e) {
  var action = e.parameter.action;
  if (action === 'getDBForDate')   return getDBForDate(e);
  if (action === 'getRevenues')    return getRevenues(e);
  if (action === 'checkDate')      return checkDate(e);
}

// ------------------------------------------------------------
// POST — Aggiunge una nuova riga in DailyRevenue
// ------------------------------------------------------------

function addRevenue(e) {
  var date          = e.parameter.date;           // es. 15/04/2025
  var cash          = e.parameter.cash;
  var card          = e.parameter.card;
  var justeat       = e.parameter.justeat;
  var notes         = e.parameter.notes || '';
  var forecast      = e.parameter.forecast;
  var lastyear      = e.parameter.lastyear;

  // Colonne:
  // A=Data  B=Contanti  C=Carte  D=JustEat
  // E=Totale(formula)  F=Forecast  G=Diff€(formula)  H=Diff%(formula)
  // I=LastYear  J=DiffLY€(formula)  K=DiffLY%(formula)  L=Note

  var nextRow = sheetRevenue.getLastRow() + 1;

  sheetRevenue.getRange(nextRow, 1).setValue(date);
  sheetRevenue.getRange(nextRow, 2).setValue(Number(cash));
  sheetRevenue.getRange(nextRow, 3).setValue(Number(card));
  sheetRevenue.getRange(nextRow, 4).setValue(Number(justeat));
  sheetRevenue.getRange(nextRow, 5).setFormula('=B'+nextRow+'+C'+nextRow+'+D'+nextRow);
  sheetRevenue.getRange(nextRow, 6).setValue(Number(forecast));
  sheetRevenue.getRange(nextRow, 7).setFormula('=E'+nextRow+'-F'+nextRow);
  sheetRevenue.getRange(nextRow, 8).setFormula('=IF(F'+nextRow+'=0,"",ROUND((E'+nextRow+'-F'+nextRow+')/F'+nextRow+'*100,1))');
  sheetRevenue.getRange(nextRow, 9).setValue(Number(lastyear));
  sheetRevenue.getRange(nextRow, 10).setFormula('=E'+nextRow+'-I'+nextRow);
  sheetRevenue.getRange(nextRow, 11).setFormula('=IF(I'+nextRow+'=0,"",ROUND((E'+nextRow+'-I'+nextRow+')/I'+nextRow+'*100,1))');
  sheetRevenue.getRange(nextRow, 12).setValue(notes);

  return ContentService
    .createTextOutput(JSON.stringify({status:'success', row: nextRow}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// POST — Aggiorna una riga esistente (per data)
// ------------------------------------------------------------

function updateRevenue(e) {
  var date    = e.parameter.date;
  var cash    = e.parameter.cash;
  var card    = e.parameter.card;
  var justeat = e.parameter.justeat;
  var notes   = e.parameter.notes || '';

  var rows    = sheetRevenue.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var rowDate = Utilities.formatDate(new Date(rows[i][0]), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    if (rowDate === date) {
      var r = i + 1;
      sheetRevenue.getRange(r, 2).setValue(Number(cash));
      sheetRevenue.getRange(r, 3).setValue(Number(card));
      sheetRevenue.getRange(r, 4).setValue(Number(justeat));
      sheetRevenue.getRange(r, 12).setValue(notes);
      return ContentService
        .createTextOutput(JSON.stringify({status:'updated', row: r}))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({status:'not_found'}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// GET — Legge Forecast e LastYear dal AnnualDB per una data
// ------------------------------------------------------------

function getDBForDate(e) {
  var dateStr = e.parameter.date; // dd/MM/yyyy
  var rows    = sheetDB.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var rowDate = Utilities.formatDate(new Date(rows[i][0]), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    if (rowDate === dateStr) {
      return ContentService
        .createTextOutput(JSON.stringify({
          status:   'found',
          forecast: rows[i][1],
          lastyear: rows[i][2]
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({status:'not_found', forecast:0, lastyear:0}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// GET — Controlla se esiste già una riga per quella data
// ------------------------------------------------------------

function checkDate(e) {
  var dateStr = e.parameter.date;
  var rows    = sheetRevenue.getDataRange().getValues();

  for (var i = 1; i < rows.length; i++) {
    var rowDate = Utilities.formatDate(new Date(rows[i][0]), Session.getScriptTimeZone(), 'dd/MM/yyyy');
    if (rowDate === dateStr) {
      return ContentService
        .createTextOutput(JSON.stringify({
          exists:   true,
          cash:     rows[i][1],
          card:     rows[i][2],
          justeat:  rows[i][3],
          forecast: rows[i][5],
          lastyear: rows[i][8],
          notes:    rows[i][11]
        }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  return ContentService
    .createTextOutput(JSON.stringify({exists: false}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// GET — Ritorna tutti gli incassi (per i resoconti futuri)
// ------------------------------------------------------------

function getRevenues(e) {
  var lastRow = sheetRevenue.getLastRow();
  if (lastRow < 2) {
    return ContentService
      .createTextOutput(JSON.stringify({items:[]}))
      .setMimeType(ContentService.MimeType.JSON);
  }

  var rows = sheetRevenue.getRange(2, 1, lastRow - 1, 12).getValues();
  var data = [];

  for (var i = 0; i < rows.length; i++) {
    var row = rows[i];
    data.push({
      date:           Utilities.formatDate(new Date(row[0]), Session.getScriptTimeZone(), 'dd/MM/yyyy'),
      cash:           row[1],
      card:           row[2],
      justeat:        row[3],
      total:          row[4],
      forecast:       row[5],
      diffEur:        row[6],
      diffPct:        row[7],
      lastyear:       row[8],
      diffLYEur:      row[9],
      diffLYPct:      row[10],
      notes:          row[11]
    });
  }

  return ContentService
    .createTextOutput(JSON.stringify({items: data}))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------------------------------------------------
// SETUP — Crea intestazioni nei fogli (esegui una sola volta)
// ------------------------------------------------------------

function setupSheets() {
  // DailyRevenue
  var headers1 = ['Data','Contanti','Carte','JustEat','Totale','Forecast','Diff €','Diff %','Last Year','Diff LY €','Diff LY %','Note'];
  sheetRevenue.getRange(1, 1, 1, headers1.length).setValues([headers1]);
  sheetRevenue.getRange(1, 1, 1, headers1.length).setFontWeight('bold');
  sheetRevenue.setFrozenRows(1);

  // AnnualDB
  var headers2 = ['Data','Forecast','Last Year'];
  sheetDB.getRange(1, 1, 1, headers2.length).setValues([headers2]);
  sheetDB.getRange(1, 1, 1, headers2.length).setFontWeight('bold');
  sheetDB.setFrozenRows(1);

  SpreadsheetApp.getUi().alert('Setup completato!');
}
