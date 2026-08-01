/**
 * 0_Setup.gs
 * Initializes all required sheets for the PO & Dispatch Management System.
 */

function setupInitialSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Open PO DB
  var openPoSheet = ss.getSheetByName("Open_PO_DB");
  if (!openPoSheet) {
    openPoSheet = ss.insertSheet("Open_PO_DB");
    openPoSheet.appendRow(["Timestamp", "Customer", "Consignee", "PO Date", "PO Number", "S.No", "Item Code", "Item Name", "Rate", "Total PO Qty", "Delivery Date"]);
    openPoSheet.getRange("A1:K1").setFontWeight("bold").setBackground("#d9ead3");
    openPoSheet.setFrozenRows(1);
  }
  
  // 2. Priority PO DB
  var priorityPoSheet = ss.getSheetByName("Priority_PO_DB");
  if (!priorityPoSheet) {
    priorityPoSheet = ss.insertSheet("Priority_PO_DB");
    priorityPoSheet.appendRow(["Timestamp", "Customer", "Consignee", "PO Number", "Priority Date", "S.No", "Item Code", "Item Name", "Status"]);
    priorityPoSheet.getRange("A1:I1").setFontWeight("bold").setBackground("#cfe2f3");
    priorityPoSheet.setFrozenRows(1);
  } else {
    // Migration: ensure Status exists
    var headers = priorityPoSheet.getRange(1, 1, 1, priorityPoSheet.getLastColumn() || 1).getValues()[0];
    if (headers.indexOf("Status") === -1) {
      priorityPoSheet.insertColumnAfter(8);
      priorityPoSheet.getRange(1, 9).setValue("Status").setFontWeight("bold").setBackground("#cfe2f3");
    }
  }
  
  // 3. Dispatch DB
  var dispatchSheet = ss.getSheetByName("Dispatch_DB");
  if (!dispatchSheet) {
    dispatchSheet = ss.insertSheet("Dispatch_DB");
    dispatchSheet.appendRow(["Timestamp", "S.No", "Date", "Customer", "Consignee", "Item Name", "PO Number", "Dispatch Qty", "Transporter", "Place", "Vehicle No", "Gaadi Size", "Freight", "Point", "Holding", "Overload"]);
    dispatchSheet.getRange("A1:P1").setFontWeight("bold").setBackground("#fce5cd");
    dispatchSheet.setFrozenRows(1);
  }
  
  // 4. Freight Sheet
  var freightSheet = ss.getSheetByName("Freight_Sheet");
  if (!freightSheet) {
    freightSheet = ss.insertSheet("Freight_Sheet");
    freightSheet.appendRow(["Timestamp", "S.No", "Receiving", "Date", "Invoice No", "Transporter", "Vehicle No", "Gaadi Size", "Place", "Customer", "Consignee", "Inward", "Outward", "Holding", "Point", "Remarks"]);
    freightSheet.getRange("A1:P1").setFontWeight("bold").setBackground("#fff2cc");
    freightSheet.setFrozenRows(1);
  }
  
  // 5. Dashboard (Matrix & Rollover logic)
  var dashboardSheet = ss.getSheetByName("Dashboard");
  if (!dashboardSheet) {
    dashboardSheet = ss.insertSheet("Dashboard");
    dashboardSheet.appendRow(["Customer", "Item Name", "PO Number", "Total Plan", "Total Dispatched", "Delay/Status"]);
    dashboardSheet.getRange("A1:F1").setFontWeight("bold").setBackground("#ead1dc");
    dashboardSheet.setFrozenRows(1);
  }
  
  // 6. Masters (For Dropdowns)
  var mastersSheet = ss.getSheetByName("Masters");
  if (!mastersSheet) {
    mastersSheet = ss.insertSheet("Masters");
    mastersSheet.appendRow(["Customers", "Items"]);
    mastersSheet.getRange("A1:B1").setFontWeight("bold").setBackground("#efefef");
  }

  Logger.log("Setup Complete! All required modular sheets have been created.");
}

/**
 * Creates a custom menu in Google Sheets
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('PO & Dispatch System')
      .addItem('Setup Initial Sheets', 'setupInitialSheets')
      .addToUi();
}
