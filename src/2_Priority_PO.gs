/**
 * 2_Priority_PO.gs
 * Handles Priority PO plan submissions, bulk imports, and status tracking.
 */

function submitPriorityPO(dataArray) {
  // Support both single object and array
  if (!Array.isArray(dataArray)) {
    dataArray = [dataArray];
  }
  
  if (dataArray.length === 0) return "No data provided.";

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var db = ss.getSheetByName("Priority_PO_DB");
  if (!db) return "Error: Priority_PO_DB not found.";
  
  var data = db.getDataRange().getValues();
  var headers = data[0];
  var timestamp = new Date();
  
  var custCol = headers.indexOf("Customer");
  var statusCol = headers.indexOf("Status");
  
  if (custCol === -1 || statusCol === -1) {
    return "Error: Priority_PO_DB missing 'Customer' or 'Status' column. Please run Setup.";
  }
  
  // 1. Identify all customers being updated in this batch
  var updatingCustomers = {};
  for (var k = 0; k < dataArray.length; k++) {
    if (dataArray[k].customer) {
      updatingCustomers[dataArray[k].customer] = true;
    }
  }
  
  // 2. Mark existing priorities for these customers as 'Inactive'
  for (var i = 1; i < data.length; i++) {
    var cName = data[i][custCol];
    if (updatingCustomers[cName]) {
      data[i][statusCol] = "Inactive";
    }
  }
  
  // 3. Append new priorities as 'Active'
  for (var k = 0; k < dataArray.length; k++) {
    var rowData = dataArray[k];
    
    var newRow = new Array(headers.length).fill("");
    newRow[0] = timestamp;
    newRow[1] = rowData.customer;
    newRow[2] = rowData.consignee;
    newRow[3] = rowData.poNumber;
    newRow[4] = rowData.priorityDate;
    newRow[5] = rowData.sNo || "";
    newRow[6] = rowData.itemCode || "";
    newRow[7] = rowData.itemName;
    newRow[statusCol] = "Active";
    
    var totalPriorityAdded = 0;
    
    if (rowData.dispatchDates && rowData.dispatchDates.length > 0) {
      for (var j = 0; j < rowData.dispatchDates.length; j++) {
        var dObj = rowData.dispatchDates[j];
        var dateStr = dObj.date;
        var qty = parseFloat(dObj.qty) || 0;
        totalPriorityAdded += qty;
        
        var colIndex = headers.indexOf(dateStr);
        if (colIndex === -1) {
          // Add new column
          db.insertColumnAfter(headers.length);
          headers.push(dateStr);
          db.getRange(1, headers.length).setValue(dateStr).setFontWeight("bold").setBackground("#cfe2f3");
          
          for(var r=0; r<data.length; r++) { data[r].push(""); }
          newRow.push("");
          colIndex = headers.length - 1;
        }
        newRow[colIndex] = qty;
      }
    }
    
    data.push(newRow);
    Dashboard.addToPlan(rowData.customer, rowData.itemName, rowData.poNumber, totalPriorityAdded);
  }
  
  // Write everything back
  db.getRange(1, 1, data.length, headers.length).setValues(data);
  
  return "Successfully updated Priority Plan. Previous priorities for these customers are now Inactive.";
}
