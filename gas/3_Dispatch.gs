/**
 * 3_Dispatch.gs
 * Handles Dispatch submissions with strict validation.
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
  
  var openData = openPoDb.getDataRange().getValues();
  var openHeaders = openData[0];
  var openPoCol = openHeaders.indexOf("PO Number");
  var openItemCol = openHeaders.indexOf("Item Name");
  var openQtyCol = openHeaders.indexOf("Total PO Qty");
  
  var priData = priorityPoDb.getDataRange().getValues();
  var priHeaders = priData[0];
  var priPoCol = priHeaders.indexOf("PO Number");
  var priItemCol = priHeaders.indexOf("Item Name");
  var priStatusCol = priHeaders.indexOf("Status");
  
  var dispData = dispatchDb.getDataRange().getValues();
  var dPoCol = 6; // Fixed based on setup: PO Number is at index 6
  var dItemCol = 5; // Item Name is at index 5
  var dQtyCol = 7; // Dispatch Qty is at index 7
  
  var timestamp = new Date();
  var errors = [];
  var rowsToAppendDisp = [];
  var rowsToAppendFreight = [];
  
  // Create quick lookup for existing dispatches to calculate balances
  var dispatchedMap = {};
  for (var i = 1; i < dispData.length; i++) {
    var key = dispData[i][dPoCol] + "|" + dispData[i][dItemCol];
    dispatchedMap[key] = (dispatchedMap[key] || 0) + (parseFloat(dispData[i][dQtyCol]) || 0);
  }
  
  // Validate all entries before committing
  for (var i = 0; i < dispatchArray.length; i++) {
    var d = dispatchArray[i];
    var reqQty = parseFloat(d.dispatchQty) || 0;
    var lookupKey = d.poNumber + "|" + d.itemName;
    var alreadyDispatched = dispatchedMap[lookupKey] || 0;
    
    // 1. Check Open PO Balance
    var openTotal = 0;
    for (var r = 1; r < openData.length; r++) {
      if (openData[r][openPoCol] == d.poNumber && openData[r][openItemCol] == d.itemName) {
        openTotal = parseFloat(openData[r][openQtyCol]) || 0;
        break;
      }
    }
    
    var openBalance = openTotal - alreadyDispatched;
    if (reqQty > openBalance) {
      errors.push("Row " + (i+1) + ": Dispatch Qty (" + reqQty + ") exceeds Open PO Balance (" + openBalance + ") for " + d.itemName);
      continue;
    }
    
    // 2. Check Active Priority Balance
    var priTotal = 0;
    for (var r = 1; r < priData.length; r++) {
      if (priData[r][priPoCol] == d.poNumber && priData[r][priItemCol] == d.itemName && priData[r][priStatusCol] == "Active") {
        for (var c = 9; c < priHeaders.length; c++) { // Dates start at index 9 now
          priTotal += parseFloat(priData[r][c]) || 0;
        }
        break;
      }
    }
    
    var priBalance = priTotal - alreadyDispatched;
    // Note: If priTotal is 0, they might not have a plan, should we block? Yes.
    if (reqQty > priBalance) {
      errors.push("Row " + (i+1) + ": Dispatch Qty (" + reqQty + ") exceeds Active Priority Balance (" + priBalance + ") for " + d.itemName);
      continue;
    }
    
    // If passed, prepare data
    rowsToAppendDisp.push([
      timestamp, d.sNo, d.date, d.customer, d.consignee, d.itemName, d.poNumber, d.dispatchQty, d.transporter, d.place, d.vehicleNo, d.gaadiSize, d.freight, d.point, d.holding, d.overload
    ]);
    
    rowsToAppendFreight.push([
      timestamp, d.sNo, "", d.date, d.invoiceNo, d.transporter, d.vehicleNo, d.gaadiSize, d.place, d.customer, d.consignee, "", "", d.holding, d.point, ""
    ]);
    
    // Update local map so subsequent rows in same batch validate correctly
    dispatchedMap[lookupKey] += reqQty;
  }
  
  if (errors.length > 0) {
    return "Validation Failed:\n" + errors.join("\n");
  }
  
  if (rowsToAppendDisp.length === 0) return "No valid dispatch data.";
  
  // Append to DBs
  for (var i = 0; i < rowsToAppendDisp.length; i++) {
    dispatchDb.appendRow(rowsToAppendDisp[i]);
    freightDb.appendRow(rowsToAppendFreight[i]);
    
    // Update Dashboard (Record the dispatch amount)
    Dashboard.addDispatch(rowsToAppendDisp[i][3], rowsToAppendDisp[i][5], rowsToAppendDisp[i][6], rowsToAppendDisp[i][7]);
  }
  
  return "Successfully processed " + rowsToAppendDisp.length + " dispatch(es).";
}
