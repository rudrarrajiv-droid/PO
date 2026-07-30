/**
 * 3_Dispatch.gs
 * Handles Dispatch submissions (single/bulk) and updates 3 sheets:
 * Dispatch_DB, Open_PO_DB, Priority_PO_DB, and Freight_Sheet.
 */

function submitDispatch(dispatchArray) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dispatchDb = ss.getSheetByName("Dispatch_DB");
  var openPoDb = ss.getSheetByName("Open_PO_DB");
  var priorityPoDb = ss.getSheetByName("Priority_PO_DB");
  var freightDb = ss.getSheetByName("Freight_Sheet");
  
  if (!dispatchDb || !openPoDb || !priorityPoDb || !freightDb) {
    return "Error: One or more databases are missing. Please run Setup.";
  }
  
  var timestamp = new Date();
  
  for (var i = 0; i < dispatchArray.length; i++) {
    var d = dispatchArray[i];
    
    // 1. Add to Dispatch_DB
    // Headers: Timestamp, S.No, Date, Customer, Consignee, Item Name, PO Number, Dispatch Qty, Transporter, Place, Vehicle No, Gaadi Size, Freight, Point, Holding, Overload
    dispatchDb.appendRow([
      timestamp, d.sNo, d.date, d.customer, d.consignee, d.itemName, d.poNumber, d.dispatchQty, d.transporter, d.place, d.vehicleNo, d.gaadiSize, d.freight, d.point, d.holding, d.overload
    ]);
    
    // 2. Add to Freight_Sheet
    // Headers: Timestamp, S.No, Receiving, Date, Invoice No, Transporter, Vehicle No, Gaadi Size, Place, Customer, Consignee, Inward, Outward, Holding, Point, Remarks
    freightDb.appendRow([
      timestamp, d.sNo, "", d.date, d.invoiceNo, d.transporter, d.vehicleNo, d.gaadiSize, d.place, d.customer, d.consignee, "", "", d.holding, d.point, ""
    ]);
    
    // 3. Update Open_PO_DB (Match Item + PO, insert/update date column)
    updatePOWithDispatch(openPoDb, d, 11); // dynamic dates start at col index 11 (0-based 10, wait, array index 11 means 12th col)
    
    // 4. Update Priority_PO_DB
    updatePOWithDispatch(priorityPoDb, d, 8); // dynamic dates start at col index 8
    
    // 5. Update Dashboard (Record the dispatch amount)
    Dashboard.addDispatch(d.customer, d.itemName, d.poNumber, parseFloat(d.dispatchQty) || 0);
  }
  
  // Trigger dashboard rollover calculation
  Dashboard.calculateRollover();
  
  return "Success";
}

function updatePOWithDispatch(db, d, dynamicStartColIndex) {
  var data = db.getDataRange().getValues();
  var headers = data[0];
  
  // Find the exact PO and Item row
  var rowIndex = -1;
  // Look backwards to find the most recent matching PO
  for (var i = data.length - 1; i > 0; i--) {
    // Assuming Item Name is always at index 7 (for both Open & Priority)
    // Assuming PO Number is at index 4 (Open) or 3 (Priority)
    // Wait, let's dynamically find PO Number and Item Name column index
    var poCol = headers.indexOf("PO Number");
    var itemCol = headers.indexOf("Item Name");
    
    if (poCol > -1 && itemCol > -1) {
      if (data[i][poCol] == d.poNumber && data[i][itemCol] == d.itemName) {
        rowIndex = i;
        break;
      }
    }
  }
  
  if (rowIndex > -1) {
    var dateStr = d.date; // E.g., "2023-08-05"
    var colIndex = headers.indexOf(dateStr);
    
    if (colIndex === -1) {
      // Create new column for this date
      db.insertColumnAfter(headers.length);
      headers.push(dateStr);
      db.getRange(1, headers.length).setValue(dateStr).setFontWeight("bold").setBackground("#d9ead3");
      colIndex = headers.length - 1;
    }
    
    var currentVal = parseFloat(db.getRange(rowIndex + 1, colIndex + 1).getValue()) || 0;
    db.getRange(rowIndex + 1, colIndex + 1).setValue(currentVal + (parseFloat(d.dispatchQty) || 0));
  }
}
