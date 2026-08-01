function onEdit(e) {
  if (!e || !e.range) return;
  var sheet = e.range.getSheet();
  
  if (sheet.getName() === "6. Reel Inventory") {
    if (e.range.getRow() >= 4) {
      updateInventoryCalculations(sheet);
    }
    return;
  }
  
  if (sheet.getName() === "7. Smart Reel Entry") {
    var row = e.range.getRow();
    var col = e.range.getColumn();
    
    if (row >= 8 && col >= 2 && col <= 7) {
      var searchVal = e.value;
      if (searchVal) {
        var invSheet = e.source.getSheetByName("6. Reel Inventory");
        if (invSheet) {
          var invData = invSheet.getDataRange().getValues();
          var matchedRows = [];
          var searchStr = searchVal.toString().toLowerCase();
          
          for (var i = 3; i < invData.length; i++) {
            var match = false;
            for (var j = 1; j <= 6; j++) {
              if (invData[i][j] && invData[i][j].toString().toLowerCase().indexOf(searchStr) !== -1) {
                match = true;
                break;
              }
            }
            if (match && (!invData[i][8] || invData[i][8].toString().toLowerCase() !== "consumed")) {
              matchedRows.push([invData[i][1], invData[i][2], invData[i][3], invData[i][4], invData[i][5], invData[i][6]]);
            }
          }
          
          if (matchedRows.length > 0) {
            var targetRange = sheet.getRange(row, 2, matchedRows.length, 6);
            targetRange.setValues(matchedRows);
            e.source.toast(matchedRows.length + " reels found and populated.", "Smart Search");
          } else {
            e.source.toast("No matching active reels found.", "Smart Search");
          }
        }
      }
    }
    
    if (row === 5 && col === 3) {
      var dateVal = e.value;
      if (dateVal) {
        var inputDate = new Date(dateVal);
        var today = new Date();
        today.setHours(23, 59, 59, 999);
        if (inputDate > today) {
          e.range.clearContent();
          SpreadsheetApp.getUi().alert("Warning", "Future date is not allowed. Date cleared.", SpreadsheetApp.getUi().ButtonSet.OK);
        }
      }
    }
  }
  
  if (sheet.getName() === "2. Data Base") {
    if (e.range.getColumn() === 22 && e.value) {
      var row = e.range.getRow();
      var status = e.value;
      var remarkCell = sheet.getRange(row, 23);
      var lastCol = sheet.getLastColumn();
      
      if (status === "Generated" || status === "Pending") {
        e.range.setValue("Pending");
        remarkCell.setValue("For Issue");
        sheet.getRange(row, 1, 1, lastCol).setBackground("#FFF2CC"); 
      } else if (status === "Cancelled") {
        remarkCell.clearContent();
        sheet.getRange(row, 1, 1, lastCol).setBackground("#F4CCCC"); 
        var lastRow = sheet.getLastRow();
        if (row < lastRow) {
          sheet.moveRows(sheet.getRange(row, 1), lastRow + 1);
        }
      } else if (status === "Issued") {
        if (remarkCell.getValue() === "Reels Missing") {
          e.range.setValue("Pending");
          SpreadsheetApp.getUi().alert("Error", "Reels missing. Cannot issue.", SpreadsheetApp.getUi().ButtonSet.OK);
          return;
        }
        remarkCell.setValue("In-Process");
        sheet.getRange(row, 1, 1, lastCol).setBackground("#C9DAF8"); 
        if (row > 2) {
          sheet.moveRows(sheet.getRange(row, 1), 2);
          row = 2; // update row index after moving
        }
        
        var dbData = sheet.getRange(row, 1, 1, 25).getValues()[0];
        var jobCardNo = dbData[0];
        var trackerSheet = e.source.getSheetByName("5. Tracker");
        
        if (trackerSheet) {
          var trackerData = trackerSheet.getDataRange().getValues();
          var exists = false;
          for (var i = 1; i < trackerData.length; i++) {
            if (trackerData[i][1] == jobCardNo) {
              exists = true;
              break;
            }
          }
          
          if (!exists) {
            var targetDate = dbData[2];
            var nextRow = trackerSheet.getLastRow() + 1;
            var cartonSize = (dbData[12] || "") + "x" + (dbData[13] || "") + "x" + (dbData[14] || "");
            var trackerRow = [
              "=ROW()-1", jobCardNo, dbData[1], targetDate, dbData[4], dbData[3], dbData[5], dbData[6], dbData[7], dbData[8], dbData[9], "", dbData[10], dbData[11], cartonSize, dbData[15], "", "", 
              '=IF(INDIRECT("Q"&ROW())="","", (INDIRECT("Q"&ROW())-INDIRECT("R"&ROW()))/INDIRECT("Q"&ROW()))', "", 
              '=INDIRECT("R"&ROW())-INDIRECT("T"&ROW())', 
              '=IF(INDIRECT("D"&ROW())="","", IF(TODAY()<=INDIRECT("D"&ROW()), "ON-TIME", (TODAY()-INDIRECT("D"&ROW())) & " DAY DELAY"))', "", ""
            ];
            trackerSheet.appendRow(trackerRow);
            trackerSheet.getRange(nextRow, 19).setNumberFormat("0.00%");
            trackerSheet.getRange(nextRow, 1, 1, 24).setFontSize(9).setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");
            e.source.toast("Job Card " + jobCardNo + " added to Tracker.");
          }
        }
      }
    }
  }
  
  if (sheet.getName() === "5. Tracker") {
    if (e.range.getColumn() === 23 && e.value) {
      var row = e.range.getRow();
      var jobCardNo = sheet.getRange(row, 2).getValue();
      var finishDate = e.value;
      
      var trackerRowValues = sheet.getRange(row, 1, 1, 19).getValues()[0];
      var corrugation = trackerRowValues[16]; 
      var finishGoods = trackerRowValues[17]; 
      var wastage = trackerRowValues[18];     
      
      sheet.deleteRow(row);
      
      var dbSheet = e.source.getSheetByName("2. Data Base");
      if (dbSheet) {
        var dbData = dbSheet.getDataRange().getValues();
        var foundDbRow = -1;
        for (var i = 1; i < dbData.length; i++) {
          if (dbData[i][0] == jobCardNo) {
            foundDbRow = i + 1;
            break;
          }
        }
        
        if (foundDbRow > -1) {
          dbSheet.getRange(foundDbRow, 22).setValue("Completed"); 
          dbSheet.getRange(foundDbRow, 19).setValue(corrugation);
          dbSheet.getRange(foundDbRow, 20).setValue(finishGoods);
          dbSheet.getRange(foundDbRow, 21).setValue(wastage);
          if (wastage !== "") {
            dbSheet.getRange(foundDbRow, 21).setNumberFormat("0.00%");
          }
          dbSheet.getRange(foundDbRow, 23).setValue("Finished on dated " + finishDate);
          dbSheet.getRange(foundDbRow, 1, 1, dbSheet.getLastColumn()).setBackground("#D9EAD3");
        }
      }
      e.source.toast("Job Completed & updated in Data Base.");
    }
  }
