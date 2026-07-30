/**
 * Code.gs
 * Core entry point for the Web App and common utilities.
 */

function doGet(e) {
  var html = HtmlService.createTemplateFromFile('index');
  return html.evaluate()
      .setTitle('PO & Dispatch ERP System')
      .setSandboxMode(HtmlService.SandboxMode.IFRAME)
      .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Helper function to include HTML parts into main index
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Gets data for Dropdowns from Masters and DB sheets for Smart Search
 */
function getDropdownData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Get Masters (Customers, Items)
  var mastersSheet = ss.getSheetByName("Masters");
  var customers = [];
  var items = [];
  if (mastersSheet) {
    var data = mastersSheet.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][0]) customers.push(data[i][0].toString().trim());
      if (data[i][1]) items.push(data[i][1].toString().trim());
    }
  }
  
  // 2. Get Open POs (for Dispatch Dropdown and Priority Smart Search)
  var openPoSheet = ss.getSheetByName("Open_PO_DB");
  var openPOs = [];
  if (openPoSheet) {
    var poData = openPoSheet.getDataRange().getValues();
    // Headers: Timestamp, Customer, Consignee, PO Date, PO Number, S.No, Item Code, Item Name...
    for (var i = 1; i < poData.length; i++) {
      if (poData[i][4]) {
        openPOs.push({
          customer: poData[i][1].toString().trim(),
          poDate: poData[i][3] instanceof Date ? Utilities.formatDate(poData[i][3], Session.getScriptTimeZone(), "yyyy-MM-dd") : poData[i][3].toString().trim(),
          poNumber: poData[i][4].toString().trim(),
          itemName: poData[i][7].toString().trim()
        });
      }
    }
  }
  
  return { 
    customers: [...new Set(customers)],
    items: [...new Set(items)],
    openPOs: openPOs // Used for smart search mapping
  };
}

/**
 * Checks if a value exists in an array, used for smart search
 */
function arrayIncludes(arr, obj) {
    for(var i=0; i<arr.length; i++) {
        if (arr[i] == obj) return true;
    }
}
