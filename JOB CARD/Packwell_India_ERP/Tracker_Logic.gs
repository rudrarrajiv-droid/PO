// ==========================================
// TRACKER & DATABASE LOGIC (STATIC VALUES & PROTECTIONS)
// ==========================================

/**
 * Recalculates Wastage %, Balance Qty, and Delivery Status statically.
 * Called from onEdit whenever Tracker Q, R, T, or D are modified.
 */
function updateTrackerCalculations(sheet, row) {
  var dataRow = sheet.getRange(row, 1, 1, 24).getValues()[0];
  
  // Q = 17th column (index 16), R = 18th column (index 17), T = 20th column (index 19)
  // D = 4th column (index 3)
  
  var targetDate = dataRow[3];
  var corrugation = parseFloat(dataRow[16]) || 0;
  var finishGoods = parseFloat(dataRow[17]) || 0;
  var dispatchQty = parseFloat(dataRow[19]) || 0;
  
  // 1. Calculate Wastage % (Column S / Index 18)
  var wastage = "";
  if (corrugation > 0) {
    wastage = (corrugation - finishGoods) / corrugation;
    sheet.getRange(row, 19).setValue(wastage).setNumberFormat("0.00%");
  } else {
    sheet.getRange(row, 19).setValue("");
  }
  
  // 2. Calculate Balance Qty (Column U / Index 20)
  var balanceQty = finishGoods - dispatchQty;
  sheet.getRange(row, 21).setValue(balanceQty);
  
  // 3. Calculate Corrugation Plan Date (Target Date - 3 days)
  var corrDateStr = "";
  var tDate2 = null;
  if (targetDate) {
    tDate2 = new Date(targetDate);
    if (isNaN(tDate2.getTime()) && typeof targetDate === "string") {
       var parts = targetDate.replace(/^'/, "").split("/");
       if (parts.length === 3) tDate2 = new Date(parts[2], parts[1]-1, parts[0]);
    }
    if (!isNaN(tDate2.getTime())) {
      tDate2.setDate(tDate2.getDate() - 3);
      corrDateStr = "'" + Utilities.formatDate(tDate2, Session.getScriptTimeZone(), "dd/MM/yyyy");
    }
  }
  sheet.getRange(row, 25).setValue(corrDateStr);

  // 4. Calculate Delivery Status based on Corrugation Plan Date
  var deliveryStatus = "";
  if (tDate2 && !isNaN(tDate2.getTime())) {
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var planDate = new Date(tDate2.getTime());
    planDate.setHours(0, 0, 0, 0);
    
    if (today <= planDate) {
      deliveryStatus = "ON-TIME";
    } else {
      var diffTime = Math.abs(today - planDate);
      var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
      deliveryStatus = diffDays + " DAY DELAY";
    }
  }
  sheet.getRange(row, 22).setValue(deliveryStatus);
}

/**
 * Removes the old Data Validations causing red triangles.
 * Run this function manually ONCE from the editor to clean up the red triangles.
 */
function removeRedValidations() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  var trackerSheet = ss.getSheetByName("5. Tracker");
  if (trackerSheet) {
    trackerSheet.getRange("C2:D").clearDataValidations();
    trackerSheet.getRange("Y2:Y").clearDataValidations();
  }
  
  var dbSheet = ss.getSheetByName("2. Data Base");
  if (dbSheet) {
    // Clear validations from all columns except V
    var lastColDb = dbSheet.getMaxColumns();
    dbSheet.getRange(2, 1, dbSheet.getMaxRows(), 21).clearDataValidations();
    if (lastColDb >= 23) {
      dbSheet.getRange(2, 23, dbSheet.getMaxRows(), lastColDb - 22).clearDataValidations();
    }
    
    // Ensure V still has dropdown
    var vRule = SpreadsheetApp.newDataValidation().requireValueInList(["Pending", "Issued", "Cancelled"], true).setAllowInvalid(false).setHelpText("Select only Pending, Issued, or Cancelled.").build();
    dbSheet.getRange(2, 22, dbSheet.getMaxRows(), 1).setDataValidation(vRule);
  }
}

/**
 * Hard block for manual edits to restricted areas.
 * Called from onEdit. Reverts unauthorized manual changes.
 */
function checkUnauthorizedEdits(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  var sheetName = sheet.getName();
  var col = e.range.getColumn();
  
  // 1. Prevent Database edits entirely (except Column V dropdown)
  if (sheetName === "2. Data Base" && col !== 22) {
    if (e.oldValue !== undefined) {
      e.range.setValue(e.oldValue);
    } else {
      e.source.toast("⛔ ERROR: Use Ctrl+Z to Undo! Manual edits are locked.");
    }
    e.source.toast("⛔ Database is locked! You can only use 'Save/Update' from Job Card.");
    return;
  }
  
  // 2. Prevent Tracker C, D, Y edits
  if (sheetName === "5. Tracker") {
    if (col === 3 || col === 4 || col === 25) {
      if (e.oldValue !== undefined) {
        e.range.setValue(e.oldValue);
      } else {
        e.source.toast("⛔ ERROR: Use Ctrl+Z to Undo! Manual edits are locked.");
      }
      e.source.toast("⛔ This column is locked and auto-generated.");
      return;
    }
  }
}

/**
 * Converts date columns to hardcoded text to permanently disable the 
 * double-click calendar picker which causes accidental edits.
 */
function disableDatePickers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tz = Session.getScriptTimeZone();
  
  function processSheet(sheetName, columns) {
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;
    
    for (var i = 0; i < columns.length; i++) {
      var col = columns[i];
      var range = sheet.getRange(2, col, lastRow - 1, 1);
      range.setNumberFormat("@");
      
      var values = range.getValues();
      for (var r = 0; r < values.length; r++) {
        var val = values[r][0];
        if (val) {
          if (Object.prototype.toString.call(val) === "[object Date]") {
            values[r][0] = "'" + Utilities.formatDate(val, tz, "dd/MM/yyyy");
          } else if (typeof val === "string" && val.indexOf("/") > 0) {
            values[r][0] = "'" + val.replace(/^'/, ""); // ensure single quote
          }
        }
      }
      range.setValues(values);
    }
  }
  
  processSheet("2. Data Base", [2, 3, 24]); // B, C, X
  processSheet("5. Tracker", [2, 3, 4, 23, 24, 25]); // B, C, D, W, X, Y
  
  SpreadsheetApp.getUi().alert("✅ Success: All date columns converted to locked text. The calendar picker will no longer appear!");
}
