/**
 * 1_Open_PO.gs
 * Handles Open PO submissions, bulk imports, and upsert logic.
 */

function submitOpenPO(dataArray) {
  // Support both single object and array for backward compatibility
  if (!Array.isArray(dataArray)) {
    dataArray = [dataArray];
  }
  
  if (dataArray.length === 0) return "No data provided.";
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var db = ss.getSheetByName("Open_PO_DB");
  if (!db) return "Error: Open_PO_DB not found.";
  
  var data = db.getDataRange().getValues();
  var headers = data[0];
  var timestamp = new Date();
  
  var poCol = headers.indexOf("PO Number");
  var itemCol = headers.indexOf("Item Name");
  
  if (poCol === -1 || itemCol === -1) {
    return "Error: Database headers missing 'PO Number' or 'Item Name'.";
  }
  
  for (var k = 0; k < dataArray.length; k++) {
    var rowData = dataArray[k];
    
    // Find existing row (Upsert Logic)
    var existingRowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][poCol] == rowData.poNumber && data[i][itemCol] == rowData.itemName) {
        existingRowIndex = i;
        break;
      }
    }
    
    var rowToUpdate;
    var isNew = false;
    
    if (existingRowIndex > -1) {
      rowToUpdate = data[existingRowIndex];
      rowToUpdate[0] = timestamp; // Update timestamp
    } else {
      rowToUpdate = new Array(headers.length).fill("");
      rowToUpdate[0] = timestamp;
      isNew = true;
    }
    
    // Update basic fields
    rowToUpdate[1] = rowData.customer;
    rowToUpdate[2] = rowData.consignee;
    rowToUpdate[3] = rowData.poDate;
    rowToUpdate[4] = rowData.poNumber;
    rowToUpdate[5] = rowData.sNo || (existingRowIndex > -1 ? rowToUpdate[5] : "");
    rowToUpdate[6] = rowData.itemCode || "";
    rowToUpdate[7] = rowData.itemName;
    rowToUpdate[8] = rowData.rate || 0;
    rowToUpdate[9] = rowData.totalPoQty || 0;
    rowToUpdate[10] = rowData.deliveryDate || "";
    
    // Handle dynamic dispatch plan dates
    if (rowData.dispatchDates && rowData.dispatchDates.length > 0) {
      for (var j = 0; j < rowData.dispatchDates.length; j++) {
        var dObj = rowData.dispatchDates[j];
        var dateStr = dObj.date;
        var qty = parseFloat(dObj.qty) || 0;
        
        var colIndex = headers.indexOf(dateStr);
        if (colIndex === -1) {
          // If a new date is introduced, we need to add a column.
          // Since we might add columns, we must sync with the sheet immediately 
          // to avoid index out of bounds in the array.
          db.insertColumnAfter(headers.length);
          headers.push(dateStr);
          db.getRange(1, headers.length).setValue(dateStr).setFontWeight("bold").setBackground("#d9ead3");
          
          // Expand all existing rows in our local 'data' array
          for(var r=0; r<data.length; r++) {
             data[r].push("");
          }
          if (isNew) rowToUpdate.push("");
          colIndex = headers.length - 1;
        }
        rowToUpdate[colIndex] = qty;
      }
    }
    
    if (isNew) {
      data.push(rowToUpdate);
    } else {
      data[existingRowIndex] = rowToUpdate;
    }
    
    // Update Dashboard Plan
    Dashboard.addToPlan(rowData.customer, rowData.itemName, rowData.poNumber, parseFloat(rowData.totalPoQty) || 0);
  }
  
  // Write everything back to sheet
  db.getRange(1, 1, data.length, headers.length).setValues(data);
  
  return "Successfully imported/updated " + dataArray.length + " PO record(s).";
}
