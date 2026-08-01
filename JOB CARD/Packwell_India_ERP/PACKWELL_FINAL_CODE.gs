/**
 * Packwell India ERP - Automated Job Card System
 * Code Version: 1.0 (FINAL)
 */

function onOpen() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dash = ss.getSheetByName("0. Dashboard");
    if (dash) {
      dash.getRange("D15:E15").clearDataValidations().clearContent().setBackground("#F4F6F9").setBorder(false, false, false, false, false, false);
    }
    
    // Auto-Reset Master Data Filter
    var masterSheet = ss.getSheetByName("3. Master Data");
    if (masterSheet) {
      var filter = masterSheet.getFilter();
      if (filter) {
        filter.remove();
      }
      masterSheet.getRange("H1:AF" + masterSheet.getMaxRows()).createFilter();
      
      // Enforce read-only protection for Master Data
      var protection = masterSheet.protect().setDescription("Read Only Master Data");
      var me = Session.getEffectiveUser();
      protection.addEditor(me);
      protection.removeEditors(protection.getEditors());
      if (protection.canDomainEdit()) {
        protection.setDomainEdit(false);
      }
    }
  } catch(e) {}

  var ui = SpreadsheetApp.getUi();
  ui.createMenu('📦 Packwell ERP')
      .addItem('🚀 1. Setup ERP Workspace', 'setupERPWorkspace')
      .addItem('🖼️ Upload Company Logo', 'showLogoUploadSidebar')
      .addSeparator()
      .addItem('🖨️ Generate Job Card (PDF & Save)', 'generateJobCard')
      .addItem('🔍 Check & Allocate Reels', 'startSmartAllocation')
      .addItem('🖨️ Print Corrugation Plan (Next 4 Days)', 'printCorrugationPlan')
      .addItem('💾 Save New Master Item', 'saveNewMasterItem')
      .addItem('🔄 Refresh Tracker Data', 'refreshTrackerData')
      .addItem('🧹 Remove Red Validation Errors', 'removeRedValidations')
      .addItem('🚫 Disable Calendar & Lock Dates', 'disableDatePickers')
      .addItem('📊 View Production Report', 'showProductionReport')
      .addSeparator()
      .addItem('📥 Process Daily Reels', 'processDailyReels')
      .addToUi();
}

function setupERPWorkspace() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Delete Manage Job Card if it exists
  var manageSheet = ss.getSheetByName("6. Manage Job Card");
  if (manageSheet) {
    ss.deleteSheet(manageSheet);
  }
  
  var sheet1 = ss.getSheetByName("Sheet1");
  if (sheet1) {
    ss.deleteSheet(sheet1);
  }
  
  var oldJobCardSheet = ss.getSheetByName("1. Job Card Generator");
  if (oldJobCardSheet) {
    ss.deleteSheet(oldJobCardSheet);
  }

  var smartReel = ss.getSheetByName("7. Smart Reel Entry");
  if (smartReel) {
    ss.deleteSheet(smartReel);
  }
  var sheets = [
    "0. Dashboard",
    "1. Job Card",
    "2. Data Base",
    "3. Master Data",
    "4. Add New Item",
    "5. Tracker",
    "6. Reel Inventory",
    "7. Daily Reel Entry"
  ];
  
  sheets.forEach(function(name) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
  });
  
  // Reorder sheets so 0. Dashboard is first
  var dash = ss.getSheetByName("0. Dashboard");
  if (dash.getIndex() !== 1) {
    ss.setActiveSheet(dash);
    ss.moveActiveSheet(1);
  }

  setupDashboard(ss.getSheetByName(sheets[0]));
  setupJobCardGenerator(ss.getSheetByName(sheets[1]));
  setupDatabase(ss.getSheetByName(sheets[2]));
  setupMasterData(ss.getSheetByName(sheets[3]));
  setupAddNewItem(ss.getSheetByName(sheets[4]));
  setupTracker(ss.getSheetByName(sheets[5]));
  setupInventory(ss.getSheetByName(sheets[6]));
  setupDailyReelEntry(ss.getSheetByName(sheets[7]));

  SpreadsheetApp.getUi().alert("SUCCESS: LAJAWAB! ERP Workspace has been successfully setup. You can now start using it!");
}

function setupDashboard(sheet) {
  var existingLogo = sheet.getRange("B2").getFormula();
  var hasLogo = existingLogo && existingLogo.toUpperCase().indexOf("IMAGE") !== -1;
  sheet.clear();
  sheet.setHiddenGridlines(true);
  
  // Set Background for the whole sheet to Light Gray
  sheet.getRange(1, 1, 50, 20).setBackground("#F4F6F9");
  
  // Standardize Column Widths (B to G used for cards and table)
  sheet.setColumnWidth(1, 20); // A margin
  sheet.setColumnWidth(2, 100); // B Job Card
  sheet.setColumnWidth(3, 100); // C Date
  sheet.setColumnWidth(4, 130); // D Customer
  sheet.setColumnWidth(5, 130); // E Product
  sheet.setColumnWidth(6, 115); // F Qty
  sheet.setColumnWidth(7, 115); // G Status
  sheet.setColumnWidth(8, 20); // H margin
  sheet.setColumnWidth(9, 120); // I chart
  sheet.setColumnWidth(10, 120); // J chart
  sheet.setColumnWidth(11, 120); // K chart
  
  // Title & Logo Layout
  sheet.getRange("B2:B4").merge().setBackground("#1A237E"); // Insert Logo in B2:B4 using Insert > Image > Image in cell
  if (hasLogo) sheet.getRange("B2:B4").setFormula(existingLogo);
  sheet.getRange("C2:G4").merge().setValue("🏢 PACKWELL INDIA - EXECUTIVE DASHBOARD")
      .setFontSize(18).setFontWeight("bold").setFontColor("#FFFFFF")
      .setBackground("#1A237E").setHorizontalAlignment("center").setVerticalAlignment("middle");
      
  // Subtitle (Date)
  sheet.getRange("B5:G5").merge().setValue("Last Updated: " + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd-MMM-yyyy hh:mm a"))
      .setFontSize(10).setFontColor("#555555").setHorizontalAlignment("right").setFontStyle("italic");
  
  // Helper function to create KPI Card
  function createCard(rangeA1, title, formula, bgColor, fontColor) {
    var range = sheet.getRange(rangeA1);
    range.setBackground(bgColor).setBorder(true, true, true, true, false, false, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID);
    var sr = range.getRow(); var sc = range.getColumn(); var ec = range.getLastColumn(); var er = range.getLastRow();
    
    sheet.getRange(sr, sc, 1, ec - sc + 1).merge().setValue(title)
         .setFontSize(11).setFontWeight("bold").setFontColor(fontColor)
         .setHorizontalAlignment("center").setVerticalAlignment("middle");
         
    sheet.getRange(sr + 1, sc, er - sr, ec - sc + 1).merge().setValue("Loading...")
         .setFontSize(22).setFontWeight("bold").setFontColor(fontColor)
         .setHorizontalAlignment("center").setVerticalAlignment("middle");
  }
  
  // Create KPI Cards
  createCard("B7:C9", "TOTAL ORDERS", "=COUNTA('2. Data Base'!A2:A)", "#FFFFFF", "#1A237E");
  createCard("D7:E9", "PENDING", '=COUNTIF(\'2. Data Base\'!V2:V, "Pending")', "#FFF9C4", "#F57F17");
  createCard("F7:G9", "IN-PROCESS", '=COUNTIF(\'2. Data Base\'!V2:V, "Issued")', "#E3F2FD", "#1565C0");
  
  createCard("B11:C13", "COMPLETED", '=COUNTIF(\'2. Data Base\'!V2:V, "Completed")', "#E8F5E9", "#2E7D32");
  createCard("D11:E13", "CANCELLED", '=COUNTIF(\'2. Data Base\'!V2:V, "Cancelled")', "#FFEBEE", "#C62828");
  createCard("F11:G13", "AVG WASTAGE", "=IFERROR(AVERAGE('2. Data Base'!U2:U), 0)", "#F3E5F5", "#6A1B9A");
  sheet.getRange("F12:G13").setNumberFormat("0.00%"); // Format formula part of the card
  
  // Ensure enough columns exist for Z and AA
  if (sheet.getMaxColumns() < 27) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), 27 - sheet.getMaxColumns());
  }
  
  // 1. Tracker Performance Progress Bar (I2:K2)
  sheet.getRange("I2:K2").merge().setValue("Loading...")
       .setFontSize(11).setFontWeight("bold").setFontColor("#1A237E").setBackground("#E8EAF6")
       .setHorizontalAlignment("center").setVerticalAlignment("middle")
       .setBorder(true, true, false, true, false, false, "#9FA8DA", SpreadsheetApp.BorderStyle.SOLID);
       
  // 2. Database Status Progress Bar (I3:K3)
  sheet.getRange("I3:K3").merge().setValue("Loading...")
       .setFontSize(11).setFontWeight("bold").setFontColor("#1A237E").setBackground("#E8EAF6")
       .setHorizontalAlignment("center").setVerticalAlignment("middle")
       .setBorder(false, true, false, true, false, false, "#9FA8DA", SpreadsheetApp.BorderStyle.SOLID);
       
  // Avg Wastage (I4:K4)
  sheet.getRange("I4:K4").merge().setValue("Loading...")
       .setFontSize(11).setFontWeight("bold").setFontColor("#2E7D32").setBackground("#E8F5E9")
       .setHorizontalAlignment("center").setVerticalAlignment("middle")
       .setBorder(false, true, true, true, false, false, "#9FA8DA", SpreadsheetApp.BorderStyle.SOLID);
  
  // Setup Chart Data in Hidden Columns
  sheet.getRange("Z1").setValue("Status");
  sheet.getRange("AA1").setValue("Count");
  sheet.getRange("Z2").setValue("Pending");
  sheet.getRange("AA2").setValue(0);
  sheet.getRange("Z3").setValue("In-Process");
  sheet.getRange("AA3").setValue(0);
  sheet.getRange("Z4").setValue("Completed");
  sheet.getRange("AA4").setValue(0);
  sheet.getRange("Z1:AA4").setFontColor("#F4F6F9"); // Match background instead of hiding columns to allow chart rendering
  
  // Remove existing charts if any
  var existingCharts = sheet.getCharts();
  for (var i = 0; i < existingCharts.length; i++) {
    sheet.removeChart(existingCharts[i]);
  }
  
  // Create Embedded Pie Chart
  var chart = sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange("Z1:AA4"))
      .setPosition(6, 9, 0, 0) // Row 6 (I6)
      .setOption('title', '')
      .setOption('pieHole', 0.4)
      .setOption('colors', ['#F57F17', '#1565C0', '#2E7D32'])
      .setOption('backgroundColor', '#F4F6F9')
      .setOption('width', 360)
      .setOption('height', 231)
      .build();
  sheet.insertChart(chart);
  
  // Active Jobs Monitor Section
  sheet.getRange("D15:E15").clearDataValidations().clearContent().setBackground("#F4F6F9").setBorder(false, false, false, false, false, false);
  sheet.getRange("B16:G16").merge().setValue("JOB CARD TRACKER (FILTER BY STATUS)")
      .setFontSize(11).setFontWeight("bold").setFontColor("#FFFFFF")
      .setBackground("#37474F").setHorizontalAlignment("center").setVerticalAlignment("middle");
      
  sheet.getRange("B17:F17").setValues([["Job Card No", "Target Date", "Customer Name", "Product Name", "Order Qty"]])
       .setBackground("#CFD8DC").setFontWeight("bold").setHorizontalAlignment("center")
       .setBorder(true, true, true, true, true, true, "#90A4AE", SpreadsheetApp.BorderStyle.SOLID);
       
  // Dropdown for Status Filter in G17
  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(["Pending", "Issued", "Completed", "Cancelled", "All", "Smart Search"], true).build();
  sheet.getRange("G17").setDataValidation(statusRule).setValue("Pending")
       .setBackground("#FFF2CC").setFontWeight("bold").setHorizontalAlignment("center")
       .setBorder(true, true, true, true, true, true, "#90A4AE", SpreadsheetApp.BorderStyle.SOLID);
       
  sheet.getRange("G18:G100").clearDataValidations();
       
  // Remarks column in I17:I
  sheet.getRange("I17").setValue("Remarks");
  sheet.getRange("I17").setFontWeight("bold").setBackground("#CFD8DC").setHorizontalAlignment("center")
           .setBorder(true, true, true, true, true, true, "#90A4AE", SpreadsheetApp.BorderStyle.SOLID);
           
  // Call Custom Features to render
  if (typeof updateDashboardRecords === "function") {
    updateDashboardRecords();
    calculateDashboardKPIs();
  }
  
  // Format the table output
  sheet.getRange("B18:G32").setFontSize(10).setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
  sheet.getRange("C18:C32").setNumberFormat("dd-MMM-yyyy");
  
  sheet.setActiveSelection("A1");
}

function setupJobCardGenerator(sheet) {
  var existingLogo = sheet.getRange("B2").getFormula();
  var hasLogo = existingLogo && existingLogo.toUpperCase().indexOf("IMAGE") !== -1;
  sheet.clear();
  sheet.setColumnWidth(1, 20); // Spacer
  sheet.setColumnWidth(2, 180); // Labels
  sheet.setColumnWidth(3, 280); // Inputs
  sheet.setColumnWidth(4, 180); // Labels
  sheet.setColumnWidth(5, 140); // Inputs (Merged with F)
  sheet.setColumnWidth(6, 140); // Inputs (Merged with E)
  
  sheet.getRange("B2:B3").merge().setBackground("#0F9D58"); // Insert Logo here
  if (hasLogo) sheet.getRange("B2:B3").setFormula(existingLogo);
  sheet.getRange("C2:D3").merge().setValue("📋 PACKWELL INDIA - JOB CARD")
       .setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle")
       .setBackground("#0F9D58").setFontColor("#FFFFFF");
       
  sheet.getRange("E2:F3").merge().setBackground("#0F9D58");
       
  sheet.getRange("B4").setValue("Search Job Card No. to Edit:");
  sheet.getRange("C4").setBackground("#FFF2CC").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  
  sheet.getRange("D4").setValue("Action:");
  sheet.getRange("E4:F4").merge().setBackground("#FFF2CC").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  var actionRule = SpreadsheetApp.newDataValidation().requireValueInList(["Save / Update", "Cancel Job Card"], true).build();
  sheet.getRange("E4").setDataValidation(actionRule).setValue("Save / Update").setFontWeight("bold").setFontColor("#CC0000");

  sheet.getRange("B5:D5").merge().setValue("📋 ORDER DETAILS").setBackground("#E0E0E0").setFontWeight("bold");
  sheet.getRange("E5:F5").merge().setValue("Document No.: F/QA/016").setFontSize(14).setFontWeight("bold").setFontColor("#990000").setBackground("#FFF2CC").setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange("B6").setValue("Job Card No:");
  sheet.getRange("B7").setValue("Date & Time:");
  sheet.getRange("B8").setValue("Customer Name:");
  sheet.getRange("B9").setValue("Item Code:");
  sheet.getRange("B10").setValue("Product Name:");
  sheet.getRange("B11").setValue("Order Qty (Boxes):");
  sheet.getRange("B12").setValue("Target Delivery Date:");
  sheet.getRange("B13").setValue("Priority (High/Normal):");
  sheet.getRange("B14").setValue("Packing:");

  sheet.getRange("D6").setValue("Length (L):");
  sheet.getRange("D7").setValue("Width (W):");
  sheet.getRange("D8").setValue("Height (H):");
  sheet.getRange("D9").setValue("Ply:");
  sheet.getRange("D10").setValue("Flute:");
  sheet.getRange("D11").setValue("UPS:");
  sheet.getRange("D12").setValue("Creasing:");
  sheet.getRange("D13").setValue("Color:");
  sheet.getRange("D14").setValue("Special Req:");

  var inputRanges = ["C6:C14", "E6:F14"];
  inputRanges.forEach(function(r) {
    sheet.getRange(r).setBackground("#F3F3F3").setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID)
         .setHorizontalAlignment("center").setVerticalAlignment("middle").setFontSize(12).setFontWeight("bold");
  });
  
  for(var i=6; i<=14; i++) sheet.getRange("E"+i+":F"+i).merge();

  sheet.getRange("C9:C10").setBackground("#FFF2CC").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  
  var masterSheet = sheet.getParent().getSheetByName("3. Master Data");
  if (masterSheet) {
    var itemCodeRule = SpreadsheetApp.newDataValidation().requireValueInRange(masterSheet.getRange("B2:B"), true).setAllowInvalid(true).build();
    sheet.getRange("C9").setDataValidation(itemCodeRule);
    var productNameRule = SpreadsheetApp.newDataValidation().requireValueInRange(masterSheet.getRange("C2:C"), true).setAllowInvalid(true).build();
    sheet.getRange("C10").setDataValidation(productNameRule);
  }
  
  sheet.getRange("B13").setValue("Priority:");
  var priorityRule = SpreadsheetApp.newDataValidation().requireValueInList(["Routine", "Moderate", "High", "Urgent"], true).build();
  sheet.getRange("C13").setDataValidation(priorityRule);
  
  var dateRule = SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build();
  sheet.getRange("C12").setDataValidation(dateRule).setNumberFormat("dd-MMM-yyyy");
  
  sheet.getRange("C14").clearDataValidations();
  sheet.getRange("E14").clearDataValidations();
  sheet.getRange("E13").clearDataValidations();

  sheet.getRange("B16:F16").merge().setValue("📄 PAPER SPECIFICATIONS").setBackground("#E0E0E0").setFontWeight("bold");
  
  var paperHeaders = ["Layer", "Paper Type", "BF", "GSM", "Weight (Kg)"];
  sheet.getRange("B17:F17").setValues([paperHeaders]).setFontWeight("bold").setBackground("#4285F4").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  
  var layers = [["Top"], ["Flute 1"], ["Liner 2"], ["Flute 2"], ["Liner 3"], ["Flute 3"], ["Liner 4"]];
  sheet.getRange("B18:B24").setValues(layers).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("C18:F24").setBackground("#F3F3F3").setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID)
       .setHorizontalAlignment("center").setVerticalAlignment("middle").setFontSize(12).setFontWeight("bold");
  sheet.getRange("F18:F24").clearDataValidations().clearContent();

  sheet.getRange("B26:F26").merge().setValue("🏭 PRODUCTION SUMMARY").setBackground("#E0E0E0").setFontWeight("bold");
  sheet.getRange("B27").setValue("Reel Size:");
  sheet.getRange("B28").setValue("Cut Size:");
  sheet.getRange("B29").setValue("One Box Weight (Kg):");
  sheet.getRange("B30").setValue("No. of Paper:");
  
  sheet.getRange("D27").setValue("Pin Qty:");
  sheet.getRange("D28").setValue("Pin/Glue:");
  sheet.getRange("D29").setValue("Total Order Weight (Kg):");
  sheet.getRange("D30").setValue("No. of Ply:");

  sheet.getRange("C27:C30").setBackground("#F3F3F3").setHorizontalAlignment("center").setVerticalAlignment("middle").setFontSize(12).setFontWeight("bold");
  sheet.getRange("E27:F30").setBackground("#F3F3F3").setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID).setHorizontalAlignment("center").setVerticalAlignment("middle").setFontSize(12).setFontWeight("bold");
  for(var i=27; i<=30; i++) sheet.getRange("E"+i+":F"+i).merge();
  
  sheet.getRange("C29:C30").clearDataValidations().clearContent();
  sheet.getRange("E29:F30").clearDataValidations().clearContent();
  
  sheet.getRange("E26").clearDataValidations();
  sheet.getRange("C27").clearDataValidations();

  sheet.getRange("B32:F32").merge().setValue("👨‍🔧 DEPARTMENT PRODUCTION & SIGNATURES").setBackground("#E0E0E0").setFontWeight("bold");
  
  sheet.getRange("B33").setValue("Department");
  sheet.getRange("C33").setValue("Production Qty");
  sheet.getRange("D33").setValue("Operator Name");
  sheet.getRange("E33:F33").merge().setValue("Supervisor Sign");
  sheet.getRange("B33:F33").setFontWeight("bold").setBackground("#8E7CC3").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  
  var depts = [
    ["1. Corrugation Deptt"],
    ["2. Paper Cutting Deptt"],
    ["3. Pasting Deptt"],
    ["4. Rotary / Die"],
    ["5. RS4"],
    ["6. Finish Goods"]
  ];
  sheet.getRange("B34:B39").setValues(depts).setFontWeight("bold");
  sheet.getRange("C34:F39").setBackground("#F3F3F3").setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID)
       .setHorizontalAlignment("center").setVerticalAlignment("middle");
       
  for(var i=34; i<=39; i++) sheet.getRange("E"+i+":F"+i).merge();
  
  sheet.getRange("C6:C9").setFontSize(12);
  sheet.getRange("C11:C14").setFontSize(12);
  sheet.getRange("E6:F14").setFontSize(12);
  
  sheet.getRange("C10").setFontSize(20).setWrap(true); // Product Name as Size 20
  sheet.getRange("B4:F39").setFontSize(12);
  sheet.getRange("B2:F3").setFontSize(20);
  sheet.getRange("B5:D5").setFontSize(14);
  sheet.getRange("B16:F16").setFontSize(14);
  sheet.getRange("B26:F26").setFontSize(14);
  sheet.getRange("B32:F32").setFontSize(14);
       
  sheet.setRowHeights(34, 6, 30);
  
  sheet.getRange("B40").insertCheckboxes();
  sheet.getRange("C40:F40").merge().setValue("Reels Not Available (Tick to override and save as PENDING)").setFontColor("#CC0000").setFontWeight("bold");
}

function setupDatabase(sheet) {
  sheet.setFrozenRows(1);
  var headers = [
    "Job Card No", "Date & Time", "Target Delivery Date", "Customer Name", "Product Name", 
    "Order Qty", "UPS", "No. of Paper", "No. of Ply", "Printing Color", "Reel Size", 
    "Cut Size", "Carton Size L", "Carton Size W", "Carton Size H", "Carton Style", 
    "Priority", "Total Weight (Kg)", "Corrugation Production", "Finish Goods", "Wastage %", "Job Status", "Remarks", "Last Updated By", "Last Updated On"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setFontWeight("bold").setBackground("#1155CC").setFontColor("#FFFFFF").setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");
  sheet.setColumnWidths(1, headers.length, 120);

  sheet.getRange(2, 1, sheet.getMaxRows() - 1, headers.length).setFontSize(9).setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");

  // Status Dropdown
  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(["Pending", "Issued", "Cancelled"], true).build();
  var vRange = sheet.getRange("V2:V");
  vRange.setDataValidation(statusRule);
  
  // Clear validation for Completed jobs to remove red flags
  var vValues = vRange.getValues();
  var rules = vRange.getDataValidations();
  for (var i = 0; i < vValues.length; i++) {
    if (vValues[i][0] === "Completed") {
      rules[i][0] = null;
    }
  }
  vRange.setDataValidations(rules);

  // Status Row Colors
  var range = sheet.getRange("A2:Y");
  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$V2="Pending"').setBackground("#FFF2CC").setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$V2="Issued"').setBackground("#CFE2F3").setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$V2="Completed"').setBackground("#D9EAD3").setRanges([range]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$V2="Cancelled"').setBackground("#F4CCCC").setRanges([range]).build());
  sheet.setConditionalFormatRules(rules);
}

function setupMasterData(sheet) {
  sheet.setFrozenRows(1);
  var headers = [
    "Customer Name", "Artwork No.", "Item Name", "Length", "Width", 
    "Height", "Color", "Reel Size", "Cut Size", "Ply", "Flute", 
    "Top", "BF1", "GSM1", "P2", "BF2", "GSM2", "P3", "BF3", "GSM3", 
    "P4", "BF4", "GSM4", "P5", "BF5", "GSM5", "P6", "BF6", "GSM6", 
    "P7", "BF7", "GSM7", "Pin/Pasting", "Pin Type", "Pin Qty", 
    "Creasing", "Ups", "Packing", "Special Req", "Last Updated By", "Last Updated On"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setFontWeight("bold").setBackground("#6AA84F").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  sheet.autoResizeColumns(1, headers.length);
}

function setupAddNewItem(sheet) {
  sheet.clear();
  sheet.setColumnWidth(1, 20); 
  sheet.setColumnWidth(2, 130); 
  sheet.setColumnWidth(3, 160); 
  sheet.setColumnWidth(4, 130); 
  sheet.setColumnWidth(5, 160); 
  sheet.setColumnWidth(6, 130); 
  sheet.setColumnWidth(7, 160); 
  
  sheet.getRange("B2:G3").merge().setValue("🆕 ADD NEW ITEM TO MASTER DATA")
       .setFontSize(16).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle")
       .setBackground("#6AA84F").setFontColor("#FFFFFF");
       
  sheet.getRange("B4").setValue("Search Artwork No. to Edit:");
  sheet.getRange("C4").setBackground("#FFF2CC").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange("D4:G4").merge().setValue("Leave blank to create new Item").setFontStyle("italic").setFontColor("#666666");

  sheet.getRange("B5:E5").merge().setValue("ℹ️ GENERAL INFO").setBackground("#E0E0E0").setFontWeight("bold");
  sheet.getRange("F5:G5").merge().setValue("✂️ FINISHING DETAILS").setBackground("#E0E0E0").setFontWeight("bold");
  
  sheet.getRange("B6").setValue("Customer Name:");
  sheet.getRange("D6").setValue("Length (L):");
  sheet.getRange("F6").setValue("Pin/Pasting:");
  
  sheet.getRange("B7").setValue("Artwork No.:");
  sheet.getRange("D7").setValue("Width (W):");
  sheet.getRange("F7").setValue("Pin Type:");
  
  sheet.getRange("B8").setValue("Item Name:");
  sheet.getRange("D8").setValue("Height (H):");
  sheet.getRange("F8").setValue("Pin Qty:");
  
  sheet.getRange("B9").setValue("Color:");
  sheet.getRange("D9").setValue("Reel Size:");
  sheet.getRange("F9").setValue("Creasing:");
  
  sheet.getRange("B10").setValue("Ply (2/3/5/7):");
  sheet.getRange("D10").setValue("Cut Size:");
  sheet.getRange("F10").setValue("Ups:");
  
  sheet.getRange("B11").setValue("Flute:");
  sheet.getRange("F11").setValue("Packing:");
  
  sheet.getRange("F12").setValue("Special Req:");

  var generalInputs = ["C6:C11", "E6:E10", "G6:G12"];
  generalInputs.forEach(function(r) {
    sheet.getRange(r).setBackground("#F3F3F3").setBorder(true, true, true, true, false, false, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID);
  });
  
  var plyRule = SpreadsheetApp.newDataValidation().requireValueInList(["2", "3", "5", "7"], true).build();
  sheet.getRange("C10").setDataValidation(plyRule);
  
  sheet.getRange("G11").clearDataValidations();
  sheet.getRange("G12").clearDataValidations();
  sheet.getRange("C9").clearDataValidations(); // Color dropdown removal
  sheet.getRange("G17:G20").clearDataValidations(); // G17 and G18 dropdown removal
  
  sheet.getRange("B14:E14").merge().setValue("📄 PAPER SPECIFICATIONS").setBackground("#E0E0E0").setFontWeight("bold");
  
  var paperHeaders = ["Layer", "Paper Type", "BF", "GSM"];
  sheet.getRange("B15:E15").setValues([paperHeaders]).setFontWeight("bold").setBackground("#4285F4").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  
  var layers = [["Top"], ["P2"], ["P3"], ["P4"], ["P5"], ["P6"], ["P7"]];
  sheet.getRange("B16:B22").setValues(layers).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("C16:E22").setBackground("#F3F3F3").setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID);
  
  sheet.getRange("B24:G25").merge().setValue("Use Menu: Packwell ERP > Save New Master Item")
       .setFontSize(12).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle")
       .setBackground("#3C78D8").setFontColor("#FFFFFF");
}

function setupTracker(sheet) {
  sheet.setFrozenRows(1);
  var headers = [
    "S. NO.", "JOB CARD NO.", "JOB DATE AND TIME", "TARGET DELIVERY DATE", "JOB NAME", 
    "CUSTOMER NAME", "ORDER QTY", "UPS", "NO. OF PAPER", "NO. OF PLY", "PRINTING COLOR", 
    "FLUTE", "REEL SIZE", "CUT SIZE", "CARTON SIZE (LXWXH)", "CARTON STYLE", 
    "CORRUGATION PRODUCTION", "FINISH GOODS", "WASTAGE %", "DISPATCH QTY", "BALANCE QTY", 
    "DELIVERY STATUS", "FINISH DATE", "REMARKS", "CORRUGATION M/C PLAN"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setFontWeight("bold").setBackground("#E69138").setFontColor("#FFFFFF").setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");
  sheet.autoResizeColumns(1, headers.length);

  sheet.getRange(2, 1, sheet.getMaxRows() - 1, headers.length).setFontSize(9).setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");

  // Setup Conditional Formatting for Delivery Status
  var rule1 = SpreadsheetApp.newConditionalFormatRule().whenTextContains("ON-TIME").setBackground("#D9EAD3").setFontColor("#274E13").setRanges([sheet.getRange("V2:V")]).build();
  var rule2 = SpreadsheetApp.newConditionalFormatRule().whenTextContains("DELAY").setBackground("#F4CCCC").setFontColor("#990000").setRanges([sheet.getRange("V2:V")]).build();
  sheet.setConditionalFormatRules([rule1, rule2]);
}

// ---------------------------------------------------------
// Logic Functions
// ---------------------------------------------------------

function generateJobCard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("1. Job Card");
  
  var action = sheet.getRange("E4").getValue();
  if (action === "Cancel Job Card") {
    var searchJobCancel = sheet.getRange("C4").getValue();
    if (!searchJobCancel) {
      SpreadsheetApp.getUi().alert("WARNING: Please select a Job Card No. in C4 to cancel.");
      return;
    }
    var dbSheetCancel = ss.getSheetByName("2. Data Base");
    var dbDataCancel = dbSheetCancel.getDataRange().getValues();
    var cancelRow = -1;
    for (var r = 1; r < dbDataCancel.length; r++) {
      if (dbDataCancel[r][0] == searchJobCancel) { 
        cancelRow = r + 1;
        break;
      }
    }
    if (cancelRow > -1) {
      dbSheetCancel.getRange(cancelRow, 22).setValue("Cancelled"); // Job Status column
      dbSheetCancel.getRange(cancelRow, 23).clearContent(); // Clear remarks for cancelled
      dbSheetCancel.getRange(cancelRow, 24).setValue("RAJIV PAL");
      dbSheetCancel.getRange(cancelRow, 25).setValue(new Date());
      SpreadsheetApp.getUi().alert("SUCCESS: Job Card " + searchJobCancel + " has been Cancelled successfully.");
      
      var clearRangesCancel = ["C4", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "C18:E24", "F18:F24", "C27:C28", "E27:E28", "C29:C30", "E29:E30", "C34:E39", "B43:F100"];
      clearRangesCancel.forEach(function(rng) {
        sheet.getRange(rng).clearContent();
      });
      sheet.getRange("E4").setValue("Save / Update");
    } else {
      SpreadsheetApp.getUi().alert("WARNING: Job Card not found in Database!");
    }
    return;
  }
  
  var orderQty = sheet.getRange("C11").getValue();
  var targetDate = sheet.getRange("C12").getValue();
  
  if (!orderQty || !targetDate) {
    SpreadsheetApp.getUi().alert("WARNING: Validation Error\n\nPlease fill both 'Order Qty (Boxes)' and 'Target Delivery Date' before generating the Job Card.");
    return;
  }

  var dbSheet = ss.getSheetByName("2. Data Base");
  
  // NEW LOGIC: Enforce Allocation before generating
    var isOverrideChecked = sheet.getRange("B40").getValue() === true;
  var isAllocated = (sheet.getRange("B41").getValue().toString().indexOf("REEL ALLOCATION SUMMARY") !== -1);
  if (!isAllocated && !isOverrideChecked) {
    SpreadsheetApp.getUi().alert("Error", "Job Card generate karne ke liye pehle 'Check & Allocate Reels' (Menu se) run karna zaroori hai!", SpreadsheetApp.getUi().ButtonSet.OK);
    sheet.getRange("E4").setValue("Select Action"); 
    return;
  }
  
  var hasShortfall = false;
  var allocationData = sheet.getRange(43, 7, Math.max(1, sheet.getMaxRows() - 42), 1).getValues();
  for (var i = 0; i < allocationData.length; i++) {
    if (allocationData[i][0] && allocationData[i][0].toString().indexOf("SHORTFALL") !== -1) {
      hasShortfall = true;
      break;
    }
  }
  
  var isOverrideChecked = sheet.getRange("B40").getValue() === true;
  
  if (hasShortfall && !isOverrideChecked) {
    SpreadsheetApp.getUi().alert("Warning", "Reels shortage hai! Job Card generate karne ke liye ya to reels poori allocate karein, ya phir B40 me 'Reels Not Available' box ko tick karein.", SpreadsheetApp.getUi().ButtonSet.OK);
    sheet.getRange("E4").setValue("Select Action");
    return;
  }
  
  var status = "Pending";
  
  // Fix merged cell exception by breaking apart B2:F3 if it exists and restructuring
  sheet.getRange("B2:F3").breakApart();
  sheet.getRange("B2:B3").merge().setBackground("#0F9D58"); // Preserve Logo layout
  sheet.getRange("C2:D3").merge().setValue("📋 PACKWELL INDIA - JOB CARD").setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle").setBackground("#0F9D58").setFontColor("#FFFFFF");
  
  if (hasShortfall || isOverrideChecked) {
    sheet.getRange("E2:F3").merge().setValue("STATUS: PENDING\nREELS NOT AVAILABLE").setBackground("#F4CCCC").setFontColor("#990000").setFontWeight("bold").setFontSize(11).setHorizontalAlignment("center").setVerticalAlignment("middle");
  } else {
    sheet.getRange("E2:F3").clearContent().clearFormat();
    sheet.getRange("E2:F3").merge().setBackground("#0F9D58"); // Keep the color consistent with the header
  }

  var jobCardNo = sheet.getRange("C6").getValue();
  if (!jobCardNo || jobCardNo === "Job Card No:") {
    jobCardNo = generateNextJobCardNo(dbSheet);
    sheet.getRange("C6").setValue(jobCardNo);
  }
  
  var cartonStyle = "Packing: " + (sheet.getRange("C14").getValue() || "N/A") + " | Spcl: " + (sheet.getRange("E14").getValue() || "N/A");
  
  function formatD(val) {
    if (!val) return "";
    var tz = Session.getScriptTimeZone();
    if (Object.prototype.toString.call(val) === "[object Date]") return "'" + Utilities.formatDate(val, tz, "dd/MM/yyyy");
    if (typeof val === "string" && val.indexOf("/") > 0) return "'" + val.replace(/^'/, "");
    return val;
  }
  
  var dataRow = [
    jobCardNo,
    formatD(sheet.getRange("C7").getValue()), // Date & Time
    formatD(sheet.getRange("C12").getValue()), // Target Delivery Date
    sheet.getRange("C8").getValue(), // Customer Name
    sheet.getRange("C10").getValue(), // Product Name
    sheet.getRange("C11").getValue(), // Order Qty
    sheet.getRange("E11").getValue(), // UPS
    sheet.getRange("C30").getValue(), // No. of Paper
    sheet.getRange("E9").getValue(), // No. of Ply
    sheet.getRange("E13").getValue(), // Printing Color
    sheet.getRange("C27").getValue(), // Reel Size
    sheet.getRange("C28").getValue(), // Cut Size
    sheet.getRange("E6").getValue(), // Carton Size L
    sheet.getRange("E7").getValue(), // Carton Size W
    sheet.getRange("E8").getValue(), // Carton Size H
    cartonStyle, // Carton Style
    sheet.getRange("C13").getValue(), // Priority
    sheet.getRange("E29").getValue(), // Total Weight (Kg)
    "", // Corrugation Production
    "", // Finish Goods
    "", // Wastage %
    status, // Job Status
    "For Issue" // Remarks
  ];
  
  var email = "RAJIV PAL";
  var now = new Date();
  dataRow.push(email);
  dataRow.push(formatD(now));
  
  var searchJob = sheet.getRange("C4").getValue();
  var dbData = dbSheet.getDataRange().getValues();
  var foundRow = -1;
  
  var searchId = searchJob || jobCardNo;
  for (var r = 1; r < dbData.length; r++) {
    if (dbData[r][0] == searchId) { 
      foundRow = r + 1;
      break;
    }
  }
  
  if (foundRow > -1) {
    if (dbData[foundRow - 2][21] === "Completed" || dbData[foundRow - 2][21] === "Cancelled") {
      SpreadsheetApp.getUi().alert("⚠️ Job Card is already " + dbData[foundRow - 2][21] + " and cannot be modified.");
      return;
    }
    
    dataRow[21] = status; // Keep status calculated above
    dataRow[22] = "For Issue"; 
  }
  
  var message = "";
  if (foundRow > -1) {
    dbSheet.getRange(foundRow, 1, 1, dataRow.length).setValues([dataRow]);
    message = "SUCCESS: Job Card Updated Successfully!";
  } else {
    dbSheet.insertRowAfter(1);
    var newRowRange = dbSheet.getRange(2, 1, 1, dbSheet.getMaxColumns());
    newRowRange.clearFormat();
    newRowRange.setFontWeight("normal").setFontColor("#000000").setBackground(null).setFontSize(9).setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");
    var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(["Pending", "Issued", "Cancelled"], true).build();
    dbSheet.getRange(2, 22).setDataValidation(statusRule);
    dbSheet.getRange(2, 1, 1, dataRow.length).setValues([dataRow]);
    message = "SUCCESS: New Job Card Generated Successfully!";
  }
  
  var tempSheet = null;
  try {
    var spreadsheetId = ss.getId();
    var folderName = "Job Cards PDF"; 
    var folder;
    var folders = DriveApp.getFoldersByName(folderName);
    if (folders.hasNext()) {
      folder = folders.next();
    } else {
      folder = DriveApp.createFolder(folderName);
    }
    
    sheet.hideRows(4); // Hide Search Row before export
    
    // --- PRINT-FRIENDLY PDF LOGIC ---
    tempSheet = ss.insertSheet("Temp_Print_PDF_" + new Date().getTime());
    var tempSheetId = tempSheet.getSheetId();
    var range = sheet.getDataRange();
    var tempRange = tempSheet.getRange(1, 1, range.getNumRows(), range.getNumColumns());
    range.copyTo(tempRange); 
    
    // Copy column widths and row heights
    for (var i = 1; i <= range.getNumColumns(); i++) {
      tempSheet.setColumnWidth(i, sheet.getColumnWidth(i));
    }
    for (var i = 1; i <= range.getNumRows(); i++) {
      tempSheet.setRowHeight(i, sheet.getRowHeight(i));
    }
    
    // Remove all backgrounds and set text color to black
    tempRange.setBackground(null);
    tempRange.setFontColor("#000000");
    
    // Increase font size by 20% on auto-fill fields
    var dataRanges = ["C4", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "C18:E24", "F18:F24", "C27:C28", "E27:E28", "C29:C30", "E29:E30", "C34:E39", "B41:F100"];
    dataRanges.forEach(function(r) {
      try {
        var rObj = tempSheet.getRange(r);
        var currentSizes = rObj.getFontSizes();
        var newSizes = currentSizes.map(function(rowSizes) {
          return rowSizes.map(function(size) {
             return Math.round((size || 10) * 1.2); 
          });
        });
        rObj.setFontSizes(newSizes);
      } catch(err) {}
    });
    
    SpreadsheetApp.flush();
    
    // Construct the export URL for PDF using the tempSheet
    var url = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export" +
              "?exportFormat=pdf&format=pdf" +
              "&size=letter" +
              "&portrait=true" +
              "&scale=4" +
              "&sheetnames=false&printtitle=false&pagenumbers=false" +
              "&gridlines=false&fzr=false" +
              "&gid=" + tempSheetId;
              
    var token = ScriptApp.getOAuthToken();
    var options = {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true
    };
    
    var response = UrlFetchApp.fetch(url, options);
    
    if (response.getResponseCode() == 200) {
      var blob = response.getBlob().setName(jobCardNo + ".pdf");
      var file = folder.createFile(blob);
      
      // Clear fields for new entry in the Original Sheet
      var clearRanges = ["C4", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "C18:E24", "F18:F24", "C27:C28", "E27:E28", "C29:C30", "E29:E30", "C34:E39", "B41:F100"];
      clearRanges.forEach(function(r) {
        sheet.getRange(r).clearContent();
      });
      sheet.getRange("B40").uncheck(); // Uncheck override
      
      // Show dialog with link to print/download
      var html = HtmlService.createHtmlOutput(
        '<html><body style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">' +
        '<h3 style="color: #0F9D58;">' + message + '</h3>' +
        '<p>Your Job Card PDF has been generated successfully.</p>' +
'<a href="' + file.getUrl() + '" target="_blank" style="display: inline-block; padding: 10px 20px; background-color: #4285F4; color: white; text-decoration: none; border-radius: 5px;">Open / Print PDF (A4)</a>' +
        '</body></html>'
      ).setWidth(400).setHeight(250);
      
      SpreadsheetApp.getUi().showModalDialog(html, "Job Card PDF");
    } else {
      SpreadsheetApp.getUi().alert(message + "\n\nERROR: Error generating PDF. Check authorization or try again.");
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert(message + "\n\nERROR: Error generating PDF: " + e.message + "\n\nPlease make sure you have authorized Drive permissions.");
  } finally {
    if (tempSheet) {
      ss.deleteSheet(tempSheet);
    }
    sheet.showRows(4); // Show Search Row after export
    SpreadsheetApp.flush();
  }
}function generateNextJobCardNo(dbSheet) {
  var data = dbSheet.getDataRange().getValues();
  var maxNo = 0;
  for (var i = 1; i < data.length; i++) {
    var jc = data[i][0];
    if (jc && typeof jc === 'string' && jc.indexOf("JC-") === 0) {
      var num = parseInt(jc.substring(3), 10);
      if (!isNaN(num) && num > maxNo) {
        maxNo = num;
      }
    }
  }
  if (maxNo === 0) {
    return "JC-1001";
  }
  return "JC-" + (maxNo + 1);
}

function saveNewMasterItem() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("4. Add New Item");
  var masterSheet = ss.getSheetByName("3. Master Data");
  
  var artworkNo = sheet.getRange("C7").getValue(); 
  if (!artworkNo) {
    SpreadsheetApp.getUi().alert("Please enter Artwork No.");
    return;
  }
  
  var dataRow = [
    sheet.getRange("C6").getValue(), // Customer Name
    artworkNo,
    sheet.getRange("C8").getValue(), // Item Name
    sheet.getRange("E6").getValue(), // L
    sheet.getRange("E7").getValue(), // W
    sheet.getRange("E8").getValue(), // H
    sheet.getRange("C9").getValue(), // Color
    sheet.getRange("E9").getValue(), // Reel Size
    sheet.getRange("E10").getValue(), // Cut Size
    sheet.getRange("C10").getValue(), // Ply
    sheet.getRange("C11").getValue(), // Flute
  ];
  
  for (var i = 16; i <= 22; i++) {
    dataRow.push(sheet.getRange("C"+i).getValue());
    dataRow.push(sheet.getRange("D"+i).getValue());
    dataRow.push(sheet.getRange("E"+i).getValue());
  }
  
  dataRow.push(sheet.getRange("G6").getValue()); // Pin/Pasting
  dataRow.push(sheet.getRange("G7").getValue()); // Pin Type
  dataRow.push(sheet.getRange("G8").getValue()); // Pin Qty
  dataRow.push(sheet.getRange("G9").getValue()); // Creasing
  dataRow.push(sheet.getRange("G10").getValue()); // Ups
  dataRow.push(sheet.getRange("G11").getValue()); // Packing
  dataRow.push(sheet.getRange("G12").getValue()); // Special Req
  
  var email = Session.getActiveUser().getEmail() || "Unknown User";
  var now = new Date();
  dataRow.push(email);
  dataRow.push(now);
  
  var searchArtwork = sheet.getRange("C4").getValue();
  var masterData = masterSheet.getDataRange().getValues();
  var foundRow = -1;
  
  var searchId = searchArtwork || artworkNo;
  for (var r = 1; r < masterData.length; r++) {
    if (masterData[r][1] == searchId) {
      foundRow = r + 1;
      break;
    }
  }
  
  if (foundRow > -1) {
    masterSheet.getRange(foundRow, 1, 1, dataRow.length).setValues([dataRow]);
    SpreadsheetApp.getUi().alert("SUCCESS: Master Item Updated Successfully!");
  } else {
    masterSheet.appendRow(dataRow);
    SpreadsheetApp.getUi().alert("SUCCESS: New Master Item Saved Successfully!");
  }
  
  // Clear fields after success
  var clearRanges = ["C4", "C6", "C7", "C8", "C9", "C10", "C11", "E6", "E7", "E8", "E9", "E10", "G6", "G7", "G8", "G9", "G10", "G11", "G12", "C16:E22"];
  clearRanges.forEach(function(r) { sheet.getRange(r).clearContent(); });
}

function onEdit(e) {
  if (!e || !e.range) return;
  
  // Hard block unauthorized edits using Tracker_Logic.gs
  if (typeof checkUnauthorizedEdits === "function") {
    checkUnauthorizedEdits(e);
  }
  
  var sheet = e.range.getSheet();
  
  // Hook for Dashboard custom features
  if (typeof handleDashboardOnEdit === "function") {
    handleDashboardOnEdit(e);
  }
  
  if (sheet.getName() === "6. Reel Inventory") {
    if (e.range.getRow() >= 4) {
      updateInventoryCalculations(sheet);
    }
    return;
  }
  
  if (sheet.getName() === "2. Data Base") {
    if (e.range.getColumn() === 22 && e.value) {
      var row = e.range.getRow();
      var status = e.value;
      var remarkCell = sheet.getRange(row, 23);
      var lastCol = sheet.getLastColumn();
      
      if (status === "Pending") {
        e.range.setValue("Pending");
        remarkCell.setValue("For Issue");
        sheet.getRange(row, 1, 1, lastCol).setBackground("#FFF2CC"); 
      } else if (status === "Cancelled") {
        remarkCell.clearContent();
        sheet.getRange(row, 1, 1, lastCol).setBackground("#F4CCCC"); 
        
        var trackerSheet = e.source.getSheetByName("5. Tracker");
        if (trackerSheet) {
          var trackerData = trackerSheet.getDataRange().getValues();
          var jobCardNo = sheet.getRange(row, 1).getValue();
          for (var t = 1; t < trackerData.length; t++) {
            if (trackerData[t][1] == jobCardNo) {
              trackerSheet.deleteRow(t + 1);
              break;
            }
          }
        }
        
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
            var itemName = dbData[4]; // Job Name / Product Name
            
            // Fetch Flute from Master Data
            var flute = "";
            var masterSheet = e.source.getSheetByName("3. Master Data");
            if (masterSheet) {
              var masterData = masterSheet.getDataRange().getValues();
              for (var m = 1; m < masterData.length; m++) {
                if (masterData[m][2] == itemName) {
                  flute = masterData[m][10]; // Column K is index 10
                  break;
                }
              }
            }
            
            var targetDateText = targetDate;
            if (Object.prototype.toString.call(targetDate) === "[object Date]") {
              targetDateText = "'" + Utilities.formatDate(targetDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
            } else if (typeof targetDate === "string" && targetDate.indexOf("/") > 0) {
              targetDateText = "'" + targetDate.replace(/^'/, "");
            }
            
            var nextRow = trackerSheet.getLastRow() + 1;
            var cartonSize = (dbData[12] || "") + "x" + (dbData[13] || "") + "x" + (dbData[14] || "");
            
            // Calculate Corrugation Plan static date (Target Date - 3 days)
            var corrDate = "";
            if (targetDate) {
              var tDate = new Date(targetDate);
              if (isNaN(tDate.getTime()) && typeof targetDate === "string") {
                 var parts = targetDate.split("/");
                 if (parts.length === 3) tDate = new Date(parts[2], parts[1]-1, parts[0]);
              }
              if (!isNaN(tDate.getTime())) {
                tDate.setDate(tDate.getDate() - 3);
                corrDate = "'" + Utilities.formatDate(tDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
              }
            }
            
            // Calculate static delivery status
            var deliveryStatus = "";
            if (targetDate) {
              var today = new Date();
              today.setHours(0,0,0,0);
              var tDate2 = new Date(targetDate);
              if (isNaN(tDate2.getTime()) && typeof targetDate === "string") {
                 var parts = targetDate.replace(/^'/, "").split("/");
                 if (parts.length === 3) tDate2 = new Date(parts[2], parts[1]-1, parts[0]);
              }
              if (!isNaN(tDate2.getTime())) {
                tDate2.setDate(tDate2.getDate() - 3); // Based on Corrugation Plan Date
                tDate2.setHours(0,0,0,0);
                if (today <= tDate2) {
                  deliveryStatus = "ON-TIME";
                } else {
                  var diffTime = Math.abs(today - tDate2);
                  var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                  deliveryStatus = diffDays + " DAY DELAY";
                }
              }
            }

            var trackerRow = [
              nextRow - 1, jobCardNo, dbData[1], targetDateText, itemName, dbData[3], dbData[5], dbData[6], dbData[7], dbData[8], dbData[9], flute, dbData[10], dbData[11], cartonSize, dbData[15], "", "", 
              "", "", 
              "", 
              deliveryStatus, "", "", corrDate
            ];
            trackerSheet.appendRow(trackerRow);
            trackerSheet.getRange(nextRow, 19).setNumberFormat("0.00%");
            trackerSheet.getRange(nextRow, 1, 1, trackerRow.length).setFontSize(9).setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");
            e.source.toast("Job Card " + jobCardNo + " added to Tracker.");
            
            // Auto sort after inserting
            if (typeof sortTracker === "function") sortTracker();
            if (typeof sortDatabase === "function") sortDatabase();
          }
        }
      }
    }
  }
  
  if (sheet.getName() === "5. Tracker") {
    var editedCol = e.range.getColumn();
    if (editedCol === 17 || editedCol === 18 || editedCol === 20 || editedCol === 4) {
      if (typeof updateTrackerCalculations === "function") {
        updateTrackerCalculations(sheet, e.range.getRow());
      }
    }
    
    if (editedCol === 23 && e.value) {
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
        
        for (var j = 1; j < dbData.length; j++) {
          if (dbData[j][0] == jobCardNo) {
            foundDbRow = j + 1;
            break;
          }
        }
        
        if (foundDbRow > -1) {
          dbSheet.getRange(foundDbRow, 22).setValue("Completed"); 
          dbSheet.getRange(foundDbRow, 22).clearDataValidations();
          dbSheet.getRange(foundDbRow, 19).setValue(corrugation);
          dbSheet.getRange(foundDbRow, 20).setValue(finishGoods);
          dbSheet.getRange(foundDbRow, 21).setValue(wastage);
          if (typeof wastage === "number") {
            dbSheet.getRange(foundDbRow, 21).setNumberFormat("0.00%");
          }
          dbSheet.getRange(foundDbRow, 23).setValue("Finished on dated " + finishDate);
          dbSheet.getRange(foundDbRow, 1, 1, dbSheet.getLastColumn()).setBackground("#D9EAD3");
        }
      }
      e.source.toast("Job Completed & updated in Data Base.");
    }
  }
  if (sheet.getName() === "4. Add New Item") {
    if (e.range.getRow() === 4 && e.range.getColumn() === 3) {
      autoFillNewItemData(sheet, e.value);
    }
    // Dynamic layer hiding on Ply edit
    if (e.range.getRow() === 10 && e.range.getColumn() === 3) {
      var ply = parseInt(e.value);
      if (ply === 2) sheet.hideRows(18, 5);
      else if (ply === 3) { sheet.showRows(18, 1); sheet.hideRows(19, 4); }
      else if (ply === 5) { sheet.showRows(18, 3); sheet.hideRows(21, 2); }
      else sheet.showRows(18, 5);
    }
  }
  
  if (sheet.getName() === "1. Job Card") {
    var row = e.range.getRow();
    var col = e.range.getColumn();
    var isWeightDep = (col === 3 && (row === 11 || row === 27 || row === 28)) || 
                      (col === 5 && (row === 9 || row === 11)) || 
                      (col === 5 && (row >= 18 && row <= 24));
    if (isWeightDep) {
      calculateJobCardWeights(sheet);
    }
    
    // Search auto-fill for existing Job Card Edit
    if (e.range.getRow() === 4 && e.range.getColumn() === 3) {
      var searchJob = e.value;
      if (searchJob) {
        var dbSheet = sheet.getParent().getSheetByName("2. Data Base");
        var data = dbSheet.getDataRange().getValues();
        var found = null;
        for (var i = 1; i < data.length; i++) {
          if (data[i][0] == searchJob) {
            found = data[i];
            break;
          }
        }
        if (found) {
          sheet.getRange("C6").setValue(found[0]); // Job Card No
          sheet.getRange("C7").setValue(found[1]); // Date & Time
          sheet.getRange("C12").setValue(found[2]); // Target Delivery Date
          sheet.getRange("C8").setValue(found[3]); // Customer Name
          sheet.getRange("C10").setValue(found[4]); // Product Name
          
          sheet.getRange("C11").setValue(found[5]); // Order Qty
          sheet.getRange("E11").setValue(found[6]); // UPS
          sheet.getRange("C30").setValue(found[7]); // No of Paper
          sheet.getRange("E9").setValue(found[8]); // No. of Ply
          sheet.getRange("E13").setValue(found[9]); // Printing Color
          sheet.getRange("C27").setValue(found[10]); // Reel Size
          sheet.getRange("C28").setValue(found[11]); // Cut Size
          sheet.getRange("E6").setValue(found[12]); // L
          sheet.getRange("E7").setValue(found[13]); // W
          sheet.getRange("E8").setValue(found[14]); // H
          
          var cStyle = found[15] || "";
          var pck = "";
          var spcl = "";
          if (cStyle.indexOf("Packing: ") !== -1 && cStyle.indexOf(" | Spcl: ") !== -1) {
            var parts = cStyle.split(" | Spcl: ");
            pck = parts[0].replace("Packing: ", "");
            spcl = parts[1];
          }
          sheet.getRange("C14").setValue(pck);
          sheet.getRange("E14").setValue(spcl);
          
          sheet.getRange("C13").setValue(found[16]); // Priority
          sheet.getRange("E29").setValue(found[17]); // Total Weight
          
          // Attempt to load Paper Specs from Master Data
          var masterSheet = sheet.getParent().getSheetByName("3. Master Data");
          if (masterSheet) {
            var masterData = masterSheet.getDataRange().getValues();
            var itemCode = "";
            var mFound = null;
            for(var m=1; m<masterData.length; m++) {
              if(masterData[m][2] == found[4]) { // Match Product Name
                mFound = masterData[m];
                itemCode = mFound[1];
                break;
              }
            }
            if (mFound) {
              sheet.getRange("C9").setValue(itemCode); // Item Code
              
              var masterIdx = 11; // Layer 1 Paper Type
              for (var r = 18; r <= 24; r++) { // Layers
                var pType = mFound[masterIdx];
                var pBF = mFound[masterIdx + 1];
                sheet.getRange("C" + r).setValue(pType || ""); 
                sheet.getRange("D" + r).setValue(pBF || ""); 
                sheet.getRange("E" + r).setValue(mFound[masterIdx + 2] || ""); // GSM
                masterIdx += 3;
              }
              
              sheet.getRange("E27").setValue(mFound[34]); // Pin Qty
              sheet.getRange("E28").setValue(mFound[32]); // Pin/Pasting
              sheet.getRange("E12").setValue(mFound[35]); // Creasing
              
              // Dynamic layers
              var ply = parseInt(found[8]);
              if (ply === 2) sheet.hideRows(20, 5);
              else if (ply === 3) { sheet.showRows(20, 1); sheet.hideRows(21, 4); }
              else if (ply === 5) { sheet.showRows(20, 3); sheet.hideRows(23, 2); }
              else sheet.showRows(20, 5);
            }
          }
          
          SpreadsheetApp.getActiveSpreadsheet().toast("Loaded existing Job Card: " + searchJob);
        } else {
          SpreadsheetApp.getActiveSpreadsheet().toast("Job Card not found!");
        }
      } else {
        // C4 is cleared -> Start fresh
        var clearRanges = ["C8", "C9", "C10", "C11", "C12", "C13", "C14", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "C18:E24", "F18:F24", "C27:C28", "E27:E28", "C29:C30", "E29:E30", "C34:E39", "B41:F100"];
        clearRanges.forEach(function(r) {
          sheet.getRange(r).clearContent();
        });
        var dbSheet = sheet.getParent().getSheetByName("2. Data Base");
        sheet.getRange("C6").setValue(generateNextJobCardNo(dbSheet));
        var now = new Date();
        var formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm");
        sheet.getRange("C7").setValue(formattedDate);
        calculateJobCardWeights(sheet);
        SpreadsheetApp.getActiveSpreadsheet().toast("Ready for New Job Card!");
      }
    }
    
    // Auto-fill from Master Data when Item Code or Product Name is entered
    var isItemCode = (e.range.getRow() === 9 && e.range.getColumn() === 3);
    var isProductName = (e.range.getRow() === 10 && e.range.getColumn() === 3);
    
    if (isItemCode || isProductName) {
      var searchValue = e.value;
      if (searchValue) {
        var searchStr = searchValue.toString().toLowerCase();
        var masterSheet = sheet.getParent().getSheetByName("3. Master Data");
        var data = masterSheet.getDataRange().getValues();
        var found = null;
        for (var i = 1; i < data.length; i++) {
          var matchCode = data[i][1] && data[i][1].toString().toLowerCase() === searchStr;
          var matchName = data[i][2] && data[i][2].toString().toLowerCase() === searchStr;
          
          if (matchCode || matchName) {
            found = data[i];
            break;
          }
        }
        if (found) {
          sheet.getRange("C9").setValue(found[1]); // Set full Item Code
          sheet.getRange("C10").setValue(found[2]); // Set full Product Name
          
          sheet.getRange("C8").setValue(found[0]); // Customer Name
          sheet.getRange("E6").setValue(found[3]); // L
          sheet.getRange("E7").setValue(found[4]); // W
          sheet.getRange("E8").setValue(found[5]); // H
          sheet.getRange("E13").setValue(found[6]); // Color
          sheet.getRange("E9").setValue(found[9]); // Ply
          sheet.getRange("E10").setValue(found[10]); // Flute
          sheet.getRange("E11").setValue(found[36]); // UPS
          sheet.getRange("E12").setValue(found[35]); // Creasing
          
          sheet.getRange("C27").setValue(found[7]); // Reel Size
          sheet.getRange("C28").setValue(found[8]); // Cut Size
          sheet.getRange("E27").setValue(found[34]); // Pin Qty (AI)
          sheet.getRange("E28").setValue(found[32]); // Pin/Pasting
          sheet.getRange("C14").setValue(found[37]); // Packing
          sheet.getRange("E14").setValue(found[38]); // Special Req

          var masterIdx = 11; // Layer 1 Paper Type
          for (var r = 18; r <= 24; r++) { // Layers
            var pType = found[masterIdx];
            var pBF = found[masterIdx + 1];
            sheet.getRange("C" + r).setValue(pType || ""); // Paper Type
            sheet.getRange("D" + r).setValue(pBF || ""); // BF
            sheet.getRange("E" + r).setValue(found[masterIdx + 2] || ""); // GSM
            // Column F contains the Weight formula, so we don't overwrite it
            masterIdx += 3;
          }

          // Trigger layer hide/show based on loaded Ply
          var ply = parseInt(found[9]);
          if (ply === 2) sheet.hideRows(20, 5);
          else if (ply === 3) { sheet.showRows(20, 1); sheet.hideRows(21, 4); }
          else if (ply === 5) { sheet.showRows(20, 3); sheet.hideRows(23, 2); }
          else sheet.showRows(20, 5);

          // Generate Job Card No and Date automatically
          var jcRange = sheet.getRange("C6");
          if (!jcRange.getValue()) {
            var dbSheet = sheet.getParent().getSheetByName("2. Data Base");
            jcRange.setValue(generateNextJobCardNo(dbSheet));
          }
          var dateRange = sheet.getRange("C7");
          if (!dateRange.getValue()) {
            var now = new Date();
            var formattedDate = Utilities.formatDate(now, Session.getScriptTimeZone(), "dd-MM-yyyy HH:mm");
            dateRange.setValue(formattedDate);
          }
          
          calculateJobCardWeights(sheet);
          
          SpreadsheetApp.getActiveSpreadsheet().toast("Loaded Master Data & Generated Job Card No!");
        } else {
          SpreadsheetApp.getActiveSpreadsheet().toast("Item Code not found in Master Data!");
        }
      } else {
        // If the searchValue is empty (e.g. user pressed Delete/Backspace), clear the generated fields
        var clearRanges = ["C8", "C9", "C10", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "C18:E24", "F18:F24", "C27:C28", "E27:E28", "C29:C30", "E29:E30", "B41:F100"];
        clearRanges.forEach(function(r) {
          sheet.getRange(r).clearContent();
        });
        calculateJobCardWeights(sheet);
      }
    }
    
    // Dynamic layer hiding on Ply edit for Job Card
    if (e.range.getRow() === 9 && e.range.getColumn() === 5) {
      var ply = parseInt(e.value);
      if (ply === 2) sheet.hideRows(20, 5);
      else if (ply === 3) { sheet.showRows(20, 1); sheet.hideRows(21, 4); }
      else if (ply === 5) { sheet.showRows(20, 3); sheet.hideRows(23, 2); }
      else sheet.showRows(20, 5);
    }
  }
  
  // DAILY REEL ENTRY HOOKS
  if (sheet.getName() === "7. Daily Reel Entry") {
    var type = sheet.getRange("F2").getValue();
    var row = e.range.getRow();
    var col = e.range.getColumn();
    
    // If Global Entry Type changes
    if (e.range.getA1Notation() === "F2") {
      redrawDailyReelLayout(sheet, type);
      return;
    }
    
    // IN LOGIC: Auto-generate Reel No. and Repeat Data when Weight (Col 7) is typed
    if (type === "IN" && col === 7 && row >= 5) {
      var weight = e.value;
      if (weight !== "" && weight !== undefined && !isNaN(weight)) {
        // Generate Prefix
        var dateVal = sheet.getRange("C2").getValue();
        var dateObj = dateVal ? new Date(dateVal) : new Date();
        var month = dateObj.getMonth() + 1; // 1 to 12
        var yearStr = dateObj.getFullYear().toString().substring(2); // "26"
        var prefix = month + yearStr; // "726"
        
        var invSheet = e.source.getSheetByName("6. Reel Inventory");
        var maxNum = 0;
        
        // Find max in Inventory
        if (invSheet) {
          var invData = invSheet.getDataRange().getValues();
          for (var i = 3; i < invData.length; i++) {
            var rNoStr = invData[i][2] ? invData[i][2].toString() : "";
            if (rNoStr.indexOf(prefix) === 0) {
              var seqPart = parseInt(rNoStr.substring(prefix.length), 10);
              if (!isNaN(seqPart) && seqPart > maxNum) {
                maxNum = seqPart;
              }
            }
          }
        }
        
        // Find max in current sheet
        var currentData = sheet.getRange("C5:C" + row).getValues();
        for (var j = 0; j < currentData.length; j++) {
          var currentRNoStr = currentData[j][0] ? currentData[j][0].toString() : "";
          if (currentRNoStr.indexOf(prefix) === 0) {
            var seqPart = parseInt(currentRNoStr.substring(prefix.length), 10);
            if (!isNaN(seqPart) && seqPart > maxNum) {
              maxNum = seqPart;
            }
          }
        }
        
        // Set new Reel No
        var newReelNo = prefix + (maxNum + 1);
        sheet.getRange(row, 3).setValue(newReelNo);
        
        // Auto-repeat to next row
        var nextRow = row + 1;
        var pType = sheet.getRange(row, 2).getValue();
        var pSize = sheet.getRange(row, 4).getValue();
        var pBF = sheet.getRange(row, 5).getValue();
        var pGSM = sheet.getRange(row, 6).getValue();
        var pRate = sheet.getRange(row, 8).getValue();
        if ((pRate === "" || pRate === undefined) && row > 5) {
          pRate = sheet.getRange(row - 1, 8).getValue(); // Fallback: copy from above if empty
          sheet.getRange(row, 8).setValue(pRate); // Auto-fill the current row's rate too
        }
        
        var nextType = sheet.getRange(nextRow, 2).getValue();
        if (!nextType) { // Only repeat if next row is empty
          sheet.getRange(nextRow, 2).setValue(pType);
          sheet.getRange(nextRow, 4).setValue(pSize);
          sheet.getRange(nextRow, 5).setValue(pBF);
          sheet.getRange(nextRow, 6).setValue(pGSM);
          sheet.getRange(nextRow, 8).setValue(pRate);
        }
      }
    }
    
    // IN LOGIC: Auto-repeat Rate if Rate is typed manually after the row was already generated
    if (type === "IN" && col === 8 && row >= 5) {
      var nextType = sheet.getRange(row + 1, 2).getValue();
      if (nextType) {
        sheet.getRange(row + 1, 8).setValue(e.value);
      }
    }
    
    // OUT LOGIC: Smart Filtering
    if (type === "OUT") {
      // If typing in search box (Row 5, Col 2 to 6)
      if (row === 5 && col >= 2 && col <= 6) {
        var sPaper = sheet.getRange("B5").getValue();
        var sReel = sheet.getRange("C5").getValue();
        var sSize = sheet.getRange("D5").getValue();
        var sBF = sheet.getRange("E5").getValue();
        var sGSM = sheet.getRange("F5").getValue();
        
        var invSheet = e.source.getSheetByName("6. Reel Inventory");
        if (!invSheet) return;
        var invData = invSheet.getDataRange().getValues();
        var results = [];
        
        for (var i = 3; i < invData.length; i++) {
          var sNo = invData[i][0]; // S.No is Col A
          var rType = invData[i][1];
          var rNo = invData[i][2];
          var rSize = invData[i][3];
          var rBF = invData[i][4];
          var rGSM = invData[i][5];
          var rBal = Number(invData[i][6]) || 0;
          
          if (rBal > 0 && rNo) {
            var match = true;
            if (sPaper && rType != sPaper) match = false;
            if (sReel && rNo.toString().indexOf(sReel.toString()) === -1) match = false;
            if (sSize && rSize != sSize) match = false;
            if (sBF && rBF != sBF) match = false;
            if (sGSM && rGSM != sGSM) match = false;
            
            if (match) {
              results.push([sNo, rType, rNo, rSize, rBF, rGSM, rBal]);
            }
          }
        }
        
        // Clear old results
        sheet.getRange("A9:H150").clearContent();
        
        // Print new results
        if (results.length > 0) {
          sheet.getRange(9, 1, results.length, 7).setValues(results);
        }
      }
      
      // If typing Remaining Weight in H (Row >= 9) to submit
      if (row >= 9 && col === 8) {
        var remWt = e.value;
        if (remWt !== "" && remWt !== undefined && !isNaN(remWt)) {
          var rType = sheet.getRange(row, 2).getValue();
          var rNo = sheet.getRange(row, 3).getValue();
          var rBal = sheet.getRange(row, 7).getValue();
          
          if (rNo) {
            var invSheet = e.source.getSheetByName("6. Reel Inventory");
            var dateVal = sheet.getRange("C2").getValue();
            if (!dateVal) {
              e.source.toast("Please enter Date in C2!", "Error");
              return;
            }
            var dateObj = new Date(dateVal);
            var day = dateObj.getDate();
            if (isNaN(day) || day < 1 || day > 31) {
              e.source.toast("Invalid Date in C2!", "Error");
              return;
            }
            
            var invData = invSheet.getDataRange().getValues();
            var foundIdx = -1;
            for (var i = 3; i < invData.length; i++) {
              if (invData[i][2] == rNo) {
                foundIdx = i;
                break;
              }
            }
            
            if (foundIdx !== -1) {
              var targetRow = foundIdx + 1;
              var outCol = 9 + (day - 1) * 2;
              var consumedWt = Number(rBal) - Number(remWt);
              if (consumedWt > 0) {
                var currentVal = invSheet.getRange(targetRow, outCol).getValue() || 0;
                invSheet.getRange(targetRow, outCol).setValue(currentVal + consumedWt);
                
                updateInventoryCalculations(invSheet);
                e.source.toast("✅ Reel " + rNo + " Consumed Weight: " + consumedWt + " kg submitted!", "Success");
                
                sheet.getRange("B5:F5").clearContent(); // ONLY clear B5:F5 so G5 formula remains intact
                sheet.getRange("A9:H150").clearContent();
              } else {
                e.source.toast("Remaining weight must be less than closing balance!", "Error");
                sheet.getRange(row, 8).clearContent();
              }
            }
          }
        }
      }
    }
  }
}
function checkInventoryAvailability(sheet) {
  var invSheet = sheet.getParent().getSheetByName("6. Reel Inventory");
  if (!invSheet) return false;
  
  var reqReelSize = Number(sheet.getRange("C27").getValue()) || 0;
  var invData = invSheet.getDataRange().getValues();
  
  var requirements = {};
  for (var r = 18; r <= 24; r++) {
    var pType = sheet.getRange("C" + r).getValue();
    var pBF = sheet.getRange("D" + r).getValue();
    var pGSM = Number(sheet.getRange("E" + r).getValue()) || 0;
    var weight = Number(sheet.getRange("F" + r).getValue()) || 0;
    
    if (weight > 0 && pType) {
      var key = pType + "|" + pBF + "|" + pGSM;
      if (!requirements[key]) requirements[key] = 0;
      requirements[key] += weight;
    }
  }
  
  for (var key in requirements) {
    var reqWeight = requirements[key];
    var parts = key.split("|");
    var rType = parts[0];
    var rBF = parts[1];
    var rGSM = Number(parts[2]);
    
    var available = 0;
    for (var i = 1; i < invData.length; i++) {
      var rowType = invData[i][1]; 
      var rowSize = Number(invData[i][3]) || 0;
      var rowBF = invData[i][4];
      var rowGSM = Number(invData[i][5]) || 0;
      var rowClBal = Number(invData[i][6]) || 0; 
      
      if (rowType == rType && rowSize == reqReelSize && rowBF == rBF && rowGSM == rGSM) {
        available += rowClBal;
      }
    }
    
    if (available < reqWeight) {
      return false; 
    }
  }
  return Object.keys(requirements).length > 0;
}

function setupInventory(sheet) {
  // sheet.clear(); // REMOVED TO PREVENT DATA LOSS
  sheet.setFrozenRows(3);
  sheet.setFrozenColumns(7);
  
  var colCount = 74; 
  if (sheet.getMaxColumns() < colCount) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), colCount - sheet.getMaxColumns());
  }
  
  sheet.getRange("A1:A2").merge().setValue("S. No.");
  sheet.getRange("B1:B2").merge().setValue("Paper Type");
  sheet.getRange("C1:C2").merge().setValue("Reel No.");
  sheet.getRange("D1:D2").merge().setValue("Size");
  sheet.getRange("E1:E2").merge().setValue("BF");
  sheet.getRange("F1:F2").merge().setValue("GSM");
  sheet.getRange("G1:G2").merge().setValue("Closing Balance");
  
  var c = 8;
  for (var day = 1; day <= 31; day++) {
    sheet.getRange(1, c, 1, 2).merge().setValue(day + " Date");
    sheet.getRange(2, c).setValue("In");
    sheet.getRange(2, c + 1).setValue("Out");
    c += 2;
  }
  
  sheet.getRange(1, 70, 2, 1).merge().setValue("Opn. Bal"); 
  sheet.getRange(1, 71, 2, 1).merge().setValue("Total In"); 
  sheet.getRange(1, 72, 2, 1).merge().setValue("Total Out"); 
  sheet.getRange(1, 73, 2, 1).merge().setValue("Rate / Kg"); 
  sheet.getRange(1, 74, 2, 1).merge().setValue("Closing Value"); 
  
  var headerRange = sheet.getRange(1, 1, 2, 74);
  headerRange.setFontWeight("bold").setBackground("#990000").setFontColor("#FFFFFF")
             .setHorizontalAlignment("center").setVerticalAlignment("middle").setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  
  sheet.getRange("A3:F3").merge().setValue("GRAND TOTALS âž”").setHorizontalAlignment("right").setFontWeight("bold").setBackground("#FCE5CD");
  
  // Sum formulas removed from row 3 as requested
  // sheet.getRange("G3").setFormula('=SUM(G4:G)');
  // for (var i = 8; i <= 69; i++) { ... }
  
  sheet.getRange(3, 7, 1, 68).setFontWeight("bold").setBackground("#FCE5CD").setHorizontalAlignment("center").setVerticalAlignment("middle")
       .setBorder(true, true, true, true, true, true, "#000000", SpreadsheetApp.BorderStyle.SOLID);
       
  sheet.setColumnWidth(1, 60); // S.No
  sheet.setColumnWidth(2, 110); // Paper Type
  sheet.setColumnWidth(3, 100); // Reel No
  sheet.setColumnWidths(4, 3, 65); // Size, BF, GSM
  sheet.setColumnWidth(7, 130); // Closing Balance
  sheet.setColumnWidths(8, 62, 50); // Dates
  sheet.setColumnWidth(70, 90); // Opn Bal
  sheet.setColumnWidth(71, 80); // Total In
  sheet.setColumnWidth(72, 90); // Total Out
  sheet.setColumnWidth(73, 90); // Rate / Kg
  sheet.setColumnWidth(74, 110); // Closing Value
  
  var maxRows = sheet.getMaxRows();
  sheet.getRange(4, 1, maxRows - 3, 74).setHorizontalAlignment("center").setVerticalAlignment("middle");
}

function calculateJobCardWeights(sheet) {
  var qty = Number(sheet.getRange("C11").getValue()) || 0;
  var ups = Number(sheet.getRange("E11").getValue()) || 1;
  var ply = Number(sheet.getRange("E9").getValue()) || 0;
  var reelSize = Number(sheet.getRange("C27").getValue()) || 0;
  var cutSize = Number(sheet.getRange("C28").getValue()) || 0;
  
  var noOfPaper = ups > 0 ? Math.ceil(qty / ups) : 0;
  sheet.getRange("C30").setValue(noOfPaper > 0 ? noOfPaper : "");
  
  var e30_val = "";
  if (ups === 2 && ply === 5) e30_val = qty * 1;
  else if (ups === 3 && ply === 7) e30_val = qty * 1;
  else if (ups === 2 && ply === 3) e30_val = qty * 1 / 2;
  else if (ups === 3 && ply === 5) e30_val = qty * 2 / 3;
  else if (ups === 3 && ply === 3) e30_val = qty * 1 / 3;
  else if (ups === 0.5 && ply === 5) e30_val = qty * 4;
  else if (ups === 1 && ply === 5) e30_val = qty * 2;
  else if (ups === 1 && ply === 3) e30_val = qty * 1;
  else if (ups === 6 && ply === 3) e30_val = qty * 0.17;
  else if (ups === 1 && ply === 7) e30_val = qty * 3;
  else if (ups === 0.5 && ply === 7) e30_val = qty * 6;
  else if (ups === 4 && ply === 3) e30_val = qty * 1 / 4;
  sheet.getRange("E30").setValue(e30_val !== "" ? e30_val : "");
  
  var totalSum = 0;
  for (var r = 18; r <= 24; r++) {
    var rawValue = sheet.getRange("E" + r).getValue().toString();
    var gsm = parseFloat(rawValue.replace(/[^\d.]/g, '')) || 0;
    
    if (gsm > 0 && reelSize > 0 && cutSize > 0) {
      var eff_gsm = gsm;
      if (r === 19 || r === 21 || r === 23) {
        eff_gsm = gsm * 1.4;
      }
      var f_val = Math.round((reelSize * cutSize * eff_gsm) / 3100 / 500 * noOfPaper * 100) / 100;
      sheet.getRange("F" + r).setValue(f_val);
      totalSum += f_val;
    } else {
      sheet.getRange("F" + r).clearContent();
    }
  }
  
  totalSum = Math.round(totalSum * 100) / 100;
  sheet.getRange("E29").setValue(totalSum);
  if (qty > 0) {
    var c29_val = Math.round((totalSum / qty) * 100) / 100;
    sheet.getRange("C29").setValue(c29_val);
  } else {
    sheet.getRange("C29").clearContent();
  }
}

function updateInventoryCalculations(sheet) {
  var data = sheet.getDataRange().getValues();
  if (data.length < 4) return;
  
  var updates = [];
  var totalInUpdates = [];
  var totalOutUpdates = [];
  var closingValueUpdates = [];
  
  for (var i = 3; i < data.length; i++) {
    var row = data[i];
    var isRowEmpty = (row.join("").trim() === "");
    if (isRowEmpty) {
      updates.push([""]);
      totalInUpdates.push([""]);
      totalOutUpdates.push([""]);
      closingValueUpdates.push([""]);
      continue;
    }
    
    var totalIn = 0;
    for (var d = 7; d < 69; d += 2) {
      totalIn += (Number(row[d]) || 0);
    }
    
    var totalOut = 0;
    for (var d = 8; d < 69; d += 2) {
      totalOut += (Number(row[d]) || 0);
    }
    
    var opnBal = Number(row[69]) || 0; // Col BR (Index 69)
    var rate = Number(row[72]) || 0; // Col BU (Index 72)
    
    var closingBal = opnBal + totalIn - totalOut;
    var closingVal = closingBal * rate;
    
    updates.push([closingBal]);
    totalInUpdates.push([totalIn]);
    totalOutUpdates.push([totalOut]);
    closingValueUpdates.push([closingVal]);
  }
  
  // Calculate S No. for Reel Inventory (Automatically populated when Size is added)
  var sNoUpdates = [];
  for (var i = 3; i < data.length; i++) {
    var row = data[i];
    var isRowEmpty = (row.join("").trim() === "");
    if (isRowEmpty) {
      sNoUpdates.push([""]);
      continue;
    }
    
    var sizeVal = row[3]; // Column D (Index 3)
    if (sizeVal && sizeVal.toString().trim() !== "") {
      sNoUpdates.push([i - 2]); 
    } else {
      sNoUpdates.push([""]);
    }
  }

  sheet.getRange(4, 7, updates.length, 1).setValues(updates); // G
  sheet.getRange(4, 71, updates.length, 1).setValues(totalInUpdates); // BS
  sheet.getRange(4, 72, updates.length, 1).setValues(totalOutUpdates); // BT
  sheet.getRange(4, 74, updates.length, 1).setValues(closingValueUpdates); // BV
  
  // Note: We don't write sNoUpdates here anymore, because sortInventory will handle it natively.
  
  // Finally, sort and sequence the inventory automatically
  sortInventory(sheet);
}

function sortInventory(invSheet) {
  var lastRow = invSheet.getLastRow();
  if (lastRow < 4) return;
  
  // 1. Assign Sorting States
  // 0 = Active, 1 = Exhausted (<= 0), 2 = Empty Row
  var balsAndTypes = invSheet.getRange(4, 2, lastRow - 3, 6).getValues(); // Col B (2) to Col G (7)
  var zeroFormulas = [];
  for (var i = 0; i < balsAndTypes.length; i++) {
    var pType = balsAndTypes[i][0];
    var bal = balsAndTypes[i][5];
    if (!pType || pType.toString().trim() === "") {
      zeroFormulas.push([2]);
    } else if (bal <= 0) {
      zeroFormulas.push([1]);
    } else {
      zeroFormulas.push([0]);
    }
  }
  
  // Use Column 75 (BW) for temporary sort flag
  invSheet.getRange(4, 75, lastRow - 3, 1).setValues(zeroFormulas);
  
  // 2. Sort the Data Range B4:BW
  var rangeToSort = invSheet.getRange(4, 2, lastRow - 3, 74); 
  rangeToSort.sort([
    {column: 75, ascending: true}, // IsZero Flag
    {column: 2, ascending: true},  // Paper Type
    {column: 4, ascending: true},  // Size
    {column: 5, ascending: true},  // BF
    {column: 6, ascending: true}   // GSM
  ]);
  
  // 3. Find bounds for Red Highlight
  var sortedFlags = invSheet.getRange(4, 75, lastRow - 3, 1).getValues();
  var startZero = -1;
  var countZero = 0;
  var activeCount = 0;
  
  for (var i = 0; i < sortedFlags.length; i++) {
    if (sortedFlags[i][0] === 1) {
      if (startZero === -1) startZero = i + 4;
      countZero++;
    } else if (sortedFlags[i][0] === 0) {
      activeCount++;
    }
  }
  
  // 4. Clean up Helper Column
  invSheet.getRange(4, 75, lastRow - 3, 1).clearContent();
  
  // 5. Sequence S.No in Col A
  var snoArray = [];
  var totalReels = activeCount + countZero; // Only number the actual reels
  for (var i = 0; i < (lastRow - 3); i++) {
    if (i < totalReels) {
      snoArray.push([i + 1]);
    } else {
      snoArray.push([""]);
    }
  }
  invSheet.getRange(4, 1, lastRow - 3, 1).setValues(snoArray);
  
  // 6. Apply Red Highlight to Zero Balance Reels
  invSheet.getRange(4, 1, lastRow - 3, 74).setBackground(null).setFontColor(null);
  
  if (countZero > 0) {
    invSheet.getRange(startZero, 1, countZero, 74)
            .setBackground("#F4CCCC")
            .setFontColor("#990000");
  }
}
function startSmartAllocation() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("1. Job Card");
  var invSheet = ss.getSheetByName("6. Reel Inventory");
  
  if (!sheet || !invSheet) {
    SpreadsheetApp.getUi().alert("Error: Job Card or Reel Inventory sheet not found.");
    return;
  }
  
  var reqReelSize = Number(sheet.getRange("C27").getValue()) || 0;
  if (reqReelSize === 0) {
    SpreadsheetApp.getUi().alert("Error: Reel Size is missing. Please ensure Paper Specifications are filled and weights are calculated.");
    return;
  }
  
  var invData = invSheet.getDataRange().getValues();
  var allocations = [];
  var hasShortfall = false;
  var allowAlternates = null;
  
  for (var r = 18; r <= 24; r++) {
    var layer = sheet.getRange("B" + r).getValue();
    var pType = sheet.getRange("C" + r).getValue();
    var pBF = Number(sheet.getRange("D" + r).getValue()) || 0;
    var pGSM = Number(sheet.getRange("E" + r).getValue()) || 0;
    var reqWeight = Number(sheet.getRange("F" + r).getValue()) || 0;
    
    if (reqWeight > 0 && pType) {
      var allocatedWt = 0;
      var reelsUsed = [];
      var warnings = [];
      
      var exact = findReels(invData, pType, reqReelSize, pBF, pGSM, reqWeight);
      allocatedWt += exact.wt;
      if (exact.reels.length > 0) reelsUsed = reelsUsed.concat(exact.reels);
      
      if (allocatedWt < reqWeight) {
        if (allowAlternates === null) {
          var ui = SpreadsheetApp.getUi();
          var resp = ui.alert("Allocation Shortfall: " + layer, 
            "Exact Match failed for " + layer + " (" + pType + ", Size:" + reqReelSize + ", BF:" + pBF + ", GSM:" + pGSM + ").\n" +
            "Kya aap is Job Card me saare missing layers ke liye Alternate (Over size +0.5 ya Alt BF/GSM) check karna chahte hain?", ui.ButtonSet.YES_NO);
          allowAlternates = (resp === ui.Button.YES);
        }
          
        if (allowAlternates) {
          var altCombos = [
            { size: reqReelSize, bf: pBF + 2, gsm: pGSM - 20, warn: "Alt Specs(BF+2/GSM-20)" },
            { size: reqReelSize, bf: pBF - 2, gsm: pGSM + 20, warn: "Alt Specs(BF-2/GSM+20)" },
            { size: reqReelSize + 0.5, bf: pBF, gsm: pGSM, warn: "OVER SIZE(+0.5)" },
            { size: reqReelSize + 0.5, bf: pBF + 2, gsm: pGSM - 20, warn: "OVER SIZE(+0.5) & Alt(BF+2)" },
            { size: reqReelSize + 0.5, bf: pBF - 2, gsm: pGSM + 20, warn: "OVER SIZE(+0.5) & Alt(BF-2)" }
          ];
          
          for (var i = 0; i < altCombos.length; i++) {
            if (allocatedWt >= reqWeight) break;
            var needed = reqWeight - allocatedWt;
            var alt = altCombos[i];
            var res = findReels(invData, pType, alt.size, alt.bf, alt.gsm, needed);
            if (res.wt > 0) {
              allocatedWt += res.wt;
              var mappedReels = res.reels.map(function(r) { return r + "[" + alt.warn + "]"; });
              reelsUsed = reelsUsed.concat(mappedReels);
              if (warnings.indexOf(alt.warn) === -1) warnings.push(alt.warn);
            }
          }
        }
      }
      
      var status = (allocatedWt >= reqWeight) ? "OK" : "SHORTFALL";
      var warningStr = warnings.length > 0 ? "WARNING: " + warnings.join(", ") : "";
      if (allocatedWt < reqWeight) {
        warningStr = "Manual Selection Required";
        hasShortfall = true;
      }
      
      allocations.push([
        layer, 
        pType + " " + pBF + "BF " + pGSM + "GSM", 
        reqWeight.toFixed(2) + "\\n(Alloc: " + allocatedWt.toFixed(2) + ")", 
        reelsUsed.join(", "), 
        status + (warningStr ? "\\n" + warningStr : "")
      ]);
    }
  }
  
  printAllocationTable(sheet, allocations);
  
  if (hasShortfall) {
    var ui = SpreadsheetApp.getUi();
    var manResp = ui.alert("Manual Selection Required", 
      "Kuch layers me poora weight auto-match nahi hua. Ek dialog khulega jisme instructions honge.", ui.ButtonSet.OK);
    showManualSelectionDialog();
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast("Reel Allocation Completed successfully!");
  }
}

function findReels(invData, pType, size, bf, gsm, targetWeight) {
  var allocated = 0;
  var usedReels = [];
  
  var searchType = pType ? pType.toString().trim().toUpperCase() : "";
  
  for (var i = 3; i < invData.length; i++) {
    if (allocated >= targetWeight) break;
    
    var rawType = invData[i][1];
    var rType = rawType ? rawType.toString().trim().toUpperCase() : "";
    var rSize = Number(invData[i][3]) || 0;
    var rBF = Number(invData[i][4]) || 0;
    var rGSM = Number(invData[i][5]) || 0;
    var rBal = Number(invData[i][6]) || 0;
    var rNo = invData[i][2];
    
    if (rBal > 0 && rType === searchType && Math.abs(rSize - size) < 0.01 && rBF === bf && rGSM === gsm) {
       var take = Math.min(rBal, targetWeight - allocated);
       allocated += take;
       usedReels.push(rNo + "[" + take.toFixed(2) + "kg]");
       invData[i][6] -= take; 
    }
  }
  return { wt: allocated, reels: usedReels };
}

function printAllocationTable(sheet, allocations) {
  var startRow = 41;
  var lastRow = sheet.getMaxRows();
  if (lastRow >= startRow) {
    var numRows = lastRow - startRow + 1;
    sheet.getRange(startRow, 1, numRows, sheet.getMaxColumns()).clearContent().clearFormat().clearDataValidations();
  }
  
  if (allocations.length === 0) return;
  
  sheet.getRange(startRow, 2, 1, 5).merge().setValue("📦 REEL ALLOCATION SUMMARY").setBackground("#E0E0E0").setFontWeight("bold").setFontSize(12);
  
  var headers = ["Layer", "Paper Details", "Req (Allocated)", "Reels [Weight]", "Status / Warning"];
  sheet.getRange(startRow + 1, 2, 1, 5).setValues([headers])
       .setFontWeight("bold").setBackground("#4285F4").setFontColor("#FFFFFF").setHorizontalAlignment("center");
       
  sheet.getRange(startRow + 2, 2, allocations.length, 5).setValues(allocations)
       .setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID)
       .setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
       
  // We apply Conditional Formatting to highlight Warnings
  var rule1 = SpreadsheetApp.newConditionalFormatRule().whenTextContains("OVER SIZE").setBackground("#FFF2CC").setFontColor("#990000").setRanges([sheet.getRange(startRow+2, 2, allocations.length, 5)]).build();
  var rule2 = SpreadsheetApp.newConditionalFormatRule().whenTextContains("SHORTFALL").setBackground("#F4CCCC").setFontColor("#990000").setRanges([sheet.getRange(startRow+2, 2, allocations.length, 5)]).build();
  var rules = sheet.getConditionalFormatRules();
  rules.push(rule1);
  rules.push(rule2);
  sheet.setConditionalFormatRules(rules);
}

function showManualSelectionDialog() {
  var html = HtmlService.createHtmlOutputFromFile('ReelSelection')
      .setWidth(900)
      .setHeight(600);
  SpreadsheetApp.getUi().showModalDialog(html, 'Smart Manual Reel Selection');
}

// --- Smart Manual Reel Selection Backend Functions ---
function getInventoryDataForUI() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var invSheet = ss.getSheetByName("6. Reel Inventory");
  if (!invSheet) return [];
  
  var data = invSheet.getDataRange().getValues();
  
  // -- Deduct already allocated weights from Job Card --
  var jobSheet = ss.getSheetByName("1. Job Card");
  var allocatedMap = {}; 
  if (jobSheet) {
    var lastRow = jobSheet.getLastRow();
    if (lastRow >= 43) {
      // Reels info is in Column E (index 5) from row 43 downwards
      var reelsData = jobSheet.getRange(43, 5, lastRow - 42, 1).getValues();
      for (var k = 0; k < reelsData.length; k++) {
        var str = reelsData[k][0];
        if (str && typeof str === 'string') {
          var parts = str.split(",");
          for (var p = 0; p < parts.length; p++) {
            var part = parts[p].trim();
            var firstBracket = part.indexOf("[");
            if (firstBracket > 0) {
              var rNo = part.substring(0, firstBracket).trim();
              var match = part.match(/\[([\d.]+)\s*kg/i);
              if (match) {
                var wt = parseFloat(match[1]) || 0;
                if (!allocatedMap[rNo]) allocatedMap[rNo] = 0;
                allocatedMap[rNo] += wt;
              }
            }
          }
        }
      }
    }
  }
  // -----------------------------------------------------

  var result = [];
  
  for (var i = 3; i < data.length; i++) {
    var type = data[i][1] || "";
    var reelNo = data[i][2] || "";
    var size = data[i][3] || "";
    var bf = data[i][4] || "";
    var gsm = data[i][5] || "";
    var avail = Number(data[i][6]) || 0;
    
    if (avail > 0 && reelNo) {
      var rNoStr = reelNo.toString().trim();
      
      if (allocatedMap[rNoStr]) {
        avail -= allocatedMap[rNoStr];
      }
      
      if (avail > 0.05) { // Show only if reel has meaningful weight left
        result.push({
          row: i + 1,
          type: type.toString().trim(),
          reelNo: rNoStr,
          size: size,
          bf: bf,
          gsm: gsm,
          avail: avail
        });
      }
    }
  }
  return result;
}

function getShortfallLayers() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("1. Job Card");
  if (!sheet) return [];
  
  var reelSize = sheet.getRange("C27").getValue();
  
  var startRow = 41;
  var lastRow = sheet.getLastRow();
  if (lastRow <= startRow) return [];
  
  var data = sheet.getRange(startRow + 2, 2, lastRow - startRow - 1, 5).getValues();
  var shortfalls = [];
  
  for (var i = 0; i < data.length; i++) {
    var layerName = data[i][0];
    var details = data[i][1];
    var reqAlloc = data[i][2]; 
    var status = data[i][4];
    
    if (layerName && status && status.toString().indexOf("SHORTFALL") !== -1) {
      var reqParts = reqAlloc.toString().split("\\n");
      if (reqParts.length === 1) reqParts = reqAlloc.toString().split("\n"); 
      var reqWt = parseFloat(reqParts[0]);
      var allocWt = 0;
      if (reqParts.length > 1) {
        var allocMatch = reqParts[1].match(/Alloc:\s*([\d.]+)/);
        if (allocMatch) allocWt = parseFloat(allocMatch[1]);
      }
      var needed = (reqWt - allocWt).toFixed(2);
      
      if (needed > 0) {
        shortfalls.push({
          rowNum: startRow + 2 + i,
          name: layerName,
          details: details,
          neededWt: needed,
          reqSize: reelSize
        });
      }
    }
  }
  return shortfalls;
}

function addManualReelToJobCard(layerRowNum, reelNo, weight) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("1. Job Card");
    
    var currentReelsVal = sheet.getRange(layerRowNum, 5).getValue();
    currentReelsVal = currentReelsVal ? currentReelsVal.toString() : "";
    var addString = reelNo + "[" + weight + "kg(M)]";
    var newReels = currentReelsVal ? currentReelsVal + ", " + addString : addString;
    sheet.getRange(layerRowNum, 5).setValue(newReels);
    
    var reqAllocVal = sheet.getRange(layerRowNum, 4).getValue();
    reqAllocVal = reqAllocVal ? reqAllocVal.toString() : "";
    var reqParts = reqAllocVal.split("\\n");
    if (reqParts.length === 1) reqParts = reqAllocVal.split("\n");
    
    var reqWt = parseFloat(reqParts[0]) || 0;
    var allocWt = 0;
    if (reqParts.length > 1) {
      var allocMatch = reqParts[1].match(/Alloc:\s*([\d.]+)/);
      if (allocMatch) allocWt = parseFloat(allocMatch[1]);
    }
    allocWt += parseFloat(weight);
    
    var newReqAlloc = reqWt.toFixed(2) + "\\n(Alloc: " + allocWt.toFixed(2) + ")";
    sheet.getRange(layerRowNum, 4).setValue(newReqAlloc);
    
    if (allocWt >= reqWt - 0.05) {
      var currentStatus = sheet.getRange(layerRowNum, 6).getValue().toString();
      var warnings = currentStatus.split("\\n");
      if (warnings.length === 1) warnings = currentStatus.split("\n");
      var newStatus = "OK";
      if (warnings.length > 1 && warnings[1].indexOf("WARNING") !== -1) {
        newStatus += "\\n" + warnings[1];
      }
      sheet.getRange(layerRowNum, 6).setValue(newStatus);
      
      // Update cell formatting if OK
      sheet.getRange(layerRowNum, 6).setBackground("#FFFFFF").setFontColor("#000000"); // Remove red highlight
    }
  } catch (e) {
    return { success: false, error: e.message };
  }
  return { success: true };
}

function checkPendingJobCards() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dbSheet = ss.getSheetByName("2. Data Base");
  var masterSheet = ss.getSheetByName("4. Master Data Sheet");
  var invSheet = ss.getSheetByName("6. Reel Inventory");
  
  if (!dbSheet || !masterSheet || !invSheet) {
    SpreadsheetApp.getUi().alert("Error: Required sheets missing.");
    return;
  }
  
  var dbData = dbSheet.getDataRange().getValues();
  var masterData = masterSheet.getDataRange().getValues();
  var invDataOriginal = invSheet.getDataRange().getValues();
  
  // We need to clone invData so we can simulate multiple allocations
  var invData = JSON.parse(JSON.stringify(invDataOriginal));
  
  var pendingFound = 0;
  var availableCount = 0;
  var newlyAvailableRows = [];
  
  for (var i = 1; i < dbData.length; i++) {
    var status = dbData[i][21];
    var remarks = dbData[i][22];
    
    if (status === "Pending" && (remarks === "Reels Missing" || remarks === "Reels Not Available" || remarks === "")) {
      pendingFound++;
      var itemName = dbData[i][4];
      var reqReelSize = Number(dbData[i][10]) || 0;
      var cutSize = Number(dbData[i][11]) || 0;
      var noOfPaper = Number(dbData[i][7]) || 0;
      
      // Find in Master Data
      var masterRow = null;
      for (var m = 1; m < masterData.length; m++) {
        if (masterData[m][2] == itemName) {
          masterRow = masterData[m];
          break;
        }
      }
      
      if (masterRow && noOfPaper > 0 && reqReelSize > 0) {
        // Layers: Top(11,12,13), P2(14,15,16), P3(17,18,19), P4(20,21,22), P5(23,24,25), P6(26,27,28), P7(29,30,31)
        var layerCols = [
          {p:11, bf:12, gsm:13, isFlute: false},
          {p:14, bf:15, gsm:16, isFlute: true},
          {p:17, bf:18, gsm:19, isFlute: false},
          {p:20, bf:21, gsm:22, isFlute: true},
          {p:23, bf:24, gsm:25, isFlute: false},
          {p:26, bf:27, gsm:28, isFlute: true},
          {p:29, bf:30, gsm:31, isFlute: false}
        ];
        
        var allLayersFulfilled = true;
        
        for (var l = 0; l < layerCols.length; l++) {
          var pType = masterRow[layerCols[l].p];
          if (!pType) continue; // Layer not used
          
          var pBF = Number(masterRow[layerCols[l].bf]) || 0;
          var pGSM = Number(masterRow[layerCols[l].gsm]) || 0;
          
          var multiplier = layerCols[l].isFlute ? 1.4 : 1;
          var reqWeight = (reqReelSize * cutSize * (pGSM * multiplier) / 1550000) * noOfPaper;
          
          if (reqWeight > 0) {
            // Find Exact Match (we won't auto-approve alternates for background check, to be safe)
            var exact = findReels(invData, pType, reqReelSize, pBF, pGSM, reqWeight);
            if (exact.wt < reqWeight) {
              allLayersFulfilled = false;
              break;
            }
          }
        }
        
        if (allLayersFulfilled) {
          availableCount++;
          newlyAvailableRows.push(i + 1);
          dbSheet.getRange(i + 1, 23).setValue("Reels Available!");
          dbSheet.getRange(i + 1, 23).setBackground("#d9ead3").setFontColor("#274e13").setFontWeight("bold");
        } else {
          dbSheet.getRange(i + 1, 23).setValue("Reels Missing");
          dbSheet.getRange(i + 1, 23).setBackground("#f4cccc").setFontColor("#990000").setFontWeight("normal");
        }
      }
    }
  }
  
  if (pendingFound === 0) {
    SpreadsheetApp.getUi().alert("Info", "Database me koi bhi Pending Job Card nahi hai jiske Reels Missing hon.", SpreadsheetApp.getUi().ButtonSet.OK);
  } else if (availableCount > 0) {
    SpreadsheetApp.getUi().alert("Success!", "Total " + pendingFound + " Pending Job Cards check kiye gaye.\n\n" + availableCount + " Job Cards ke liye material ab available ho gaya hai! 'Remarks' column me update kar diya gaya hai. Ab aap unhe 'Issued' mark kar sakte hain.", SpreadsheetApp.getUi().ButtonSet.OK);
  } else {
    SpreadsheetApp.getUi().alert("Notice", "Total " + pendingFound + " Pending Job Cards check kiye gaye.\n\nAbhi kisi ke liye bhi material poora available nahi hai.", SpreadsheetApp.getUi().ButtonSet.OK);
  }
}

function showProductionReport() {
  var html = HtmlService.createHtmlOutput('<html><body style="font-family: sans-serif; text-align: center; padding: 20px;">' +
    '<h2>Production Report</h2><p>Here you can view the details.</p>' +
    '<br><button onclick="google.script.host.close()" style="padding: 10px 20px; background: #ea4335; color: white; border: none; border-radius: 4px; cursor: pointer;">Close / Dismiss</button>' +
    '</body></html>')
    .setWidth(400)
    .setHeight(300);
  SpreadsheetApp.getUi().showModalDialog(html, 'Production Report');
}

function showProductionReportDetailsDismiss() {
  // Utility to dismiss the dialog if called from somewhere else
}

function setupDailyReelEntry(sheet) {
  sheet.clear();
  sheet.setHiddenGridlines(true);
  
  // Headers and Date/Type
  sheet.getRange("B1:I1").merge().setValue("📥 DAILY REEL ENTRY (IN / OUT)")
       .setFontSize(16).setFontWeight("bold").setBackground("#4CAF50").setFontColor("#FFFFFF")
       .setHorizontalAlignment("center").setVerticalAlignment("middle");
       
  sheet.getRange("B2").setValue("Date:").setFontWeight("bold").setHorizontalAlignment("right");
  sheet.getRange("C2").setBackground("#FFF2CC").setBorder(true,true,true,true,false,false,"#000000",SpreadsheetApp.BorderStyle.SOLID);
  var dateRule = SpreadsheetApp.newDataValidation().requireDate().build();
  sheet.getRange("C2").setDataValidation(dateRule);
  
  sheet.getRange("E2").setValue("Entry Type:").setFontWeight("bold").setHorizontalAlignment("right");
  sheet.getRange("F2").setBackground("#FFF2CC").setBorder(true,true,true,true,false,false,"#000000",SpreadsheetApp.BorderStyle.SOLID);
  var typeRule = SpreadsheetApp.newDataValidation().requireValueInList(["IN", "OUT"], true).build();
  sheet.getRange("F2").setDataValidation(typeRule);
  
  sheet.getRange("I2").setValue("Use Menu: Packwell ERP > 📥 Process Daily Reels").setFontWeight("bold").setFontColor("#E65100");
  
  sheet.getRange("C2").setValue(new Date());
  sheet.getRange("F2").setValue("IN");
  
  redrawDailyReelLayout(sheet, "IN");
}

function redrawDailyReelLayout(sheet, type) {
  // Clear layout
  sheet.getRange("A4:I150").clear();
  sheet.getRange("B4:I150").clearDataValidations();
  sheet.clearConditionalFormatRules();
  
  sheet.setColumnWidth(1, 60); // S.No
  sheet.setColumnWidth(2, 120); // Paper Type
  sheet.setColumnWidth(3, 120); // Reel No
  sheet.setColumnWidth(4, 80); // Size
  sheet.setColumnWidth(5, 60); // BF
  sheet.setColumnWidth(6, 60); // GSM
  sheet.setColumnWidth(7, 120); // Closing Bal / Weight
  sheet.setColumnWidth(8, 140); // Remaining / Status
  sheet.setColumnWidth(9, 150); // Empty / Gap
  
  if (type === "OUT") {
    sheet.getRange("G2").clearContent().setBackground(null);
    sheet.getRange("H2").setFormula('="Day Consumption: " & IF(C2="", 0, SUM(OFFSET(\'6. Reel Inventory\'!G4:G, 0, DAY(C2)*2)))')
         .setBackground("#FFF2CC").setFontWeight("bold").setHorizontalAlignment("center");

    var searchHeaders = ["S.No.", "🔍 Paper Type", "🔍 Reel No", "🔍 Size", "🔍 BF", "🔍 GSM", "Closing Bal (Auto)", "", ""];
    sheet.getRange("A4:I4").setValues([searchHeaders])
         .setFontWeight("bold").setBackground("#FFD966").setFontColor("#000000")
         .setHorizontalAlignment("center").setVerticalAlignment("middle");
         
    sheet.getRange("B5:F5").setBackground("#FFF2CC").setBorder(true,true,true,true,true,true,"#000000",SpreadsheetApp.BorderStyle.SOLID);
    
    // Set G5 formula for Total Search Weight
    sheet.getRange("G5").setFormula('=IFERROR(SUM(G9:G150), 0)')
         .setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle")
         .setBackground("#D9EAD3").setBorder(true,true,true,true,true,true,"#000000",SpreadsheetApp.BorderStyle.SOLID);
    
    var resHeaders = ["S.No.", "Paper Type", "Reel No", "Size", "BF", "GSM", "Closing Bal", "Remaining Wt (OUT)", ""];
    sheet.getRange("A8:I8").setValues([resHeaders])
         .setFontWeight("bold").setBackground("#37474F").setFontColor("#FFFFFF")
         .setHorizontalAlignment("center").setVerticalAlignment("middle");
         
    sheet.getRange("A9:H150").setHorizontalAlignment("center").setVerticalAlignment("middle")
         .setBorder(true,true,true,true,true,true,"#CCCCCC",SpreadsheetApp.BorderStyle.SOLID);
         
    var rules = [];
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenCellNotEmpty()
      .setBackground("#D9EAD3")
      .setRanges([sheet.getRange("H9:H150")])
      .build());
    sheet.setConditionalFormatRules(rules);
    
  } else {
    // IN MODE
    sheet.getRange("G2").setFormula('="Total Wt: " & SUM(G5:G)').setBackground("#FFF2CC").setFontWeight("bold").setHorizontalAlignment("center");
    sheet.getRange("H2").setFormula('="Total Reels: " & COUNTA(C5:C)').setBackground("#FFF2CC").setFontWeight("bold").setHorizontalAlignment("center");
    
    var headers = ["Paper Type", "Reel No (Auto)", "Size", "BF", "GSM", "Weight (IN)", "Rate", ""];
    sheet.getRange("B4:I4").setValues([headers])
         .setFontWeight("bold").setBackground("#37474F").setFontColor("#FFFFFF")
         .setHorizontalAlignment("center").setVerticalAlignment("middle");
         
    sheet.getRange("B5:H150").setHorizontalAlignment("center").setVerticalAlignment("middle")
         .setBorder(true,true,true,true,true,true,"#CCCCCC",SpreadsheetApp.BorderStyle.SOLID);
         
    var paperRule = SpreadsheetApp.newDataValidation().requireValueInList(["SK", "VK", "HWC", "OTHERS"], true).build();
    sheet.getRange("B5:B150").setDataValidation(paperRule);
    
    var rules = [];
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo("✅ OK")
      .setBackground("#D9EAD3")
      .setRanges([sheet.getRange("H5:H150")])
      .build());
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("❌ Error")
      .setBackground("#F4CCCC")
      .setRanges([sheet.getRange("H5:H150")])
      .build());
    sheet.setConditionalFormatRules(rules);
  }
}

function processDailyReels() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var entrySheet = ss.getSheetByName("7. Daily Reel Entry");
  var invSheet = ss.getSheetByName("6. Reel Inventory");
  
  if (!entrySheet || !invSheet) {
    SpreadsheetApp.getUi().alert("❌ Error: Missing required sheets!");
    return;
  }
  
  var dateVal = entrySheet.getRange("C2").getValue();
  var entryType = entrySheet.getRange("F2").getValue();
  
  if (entryType !== "IN") {
    SpreadsheetApp.getUi().alert("ℹ️ OUT entries are processed automatically when you type Remaining Weight in H column. This button is only for IN entries.");
    return;
  }
  
  if (!dateVal) {
    SpreadsheetApp.getUi().alert("⚠️ Please fill Date in C2!");
    return;
  }
  
  var dateObj = new Date(dateVal);
  var day = dateObj.getDate();
  if (isNaN(day) || day < 1 || day > 31) {
    SpreadsheetApp.getUi().alert("❌ Invalid Date Format!");
    return;
  }
  
  var data = entrySheet.getRange("B5:H150").getValues();
  var updatesCount = 0;
  
  for (var i = 0; i < data.length; i++) {
    var paperType = data[i][0]; // B
    var reelNo = data[i][1];    // C
    var size = data[i][2];      // D
    var bf = data[i][3];        // E
    var gsm = data[i][4];       // F
    var weight = data[i][5];    // G
    var rate = data[i][6];      // H
    
    if (reelNo && weight) {
      var invData = invSheet.getDataRange().getValues();
      var foundIdx = -1;
      for (var r = 3; r < invData.length; r++) {
        if (invData[r][2] == reelNo) {
          foundIdx = r;
          break;
        }
      }
      
      var targetRow;
      if (foundIdx === -1) {
        var lastInvRow = invSheet.getLastRow();
        targetRow = lastInvRow + 1;
        var sNo = lastInvRow - 2; 
        invSheet.getRange(targetRow, 1).setValue(sNo);
        invSheet.getRange(targetRow, 2).setValue(paperType);
        invSheet.getRange(targetRow, 3).setValue(reelNo);
        invSheet.getRange(targetRow, 4).setValue(size);
        invSheet.getRange(targetRow, 5).setValue(bf);
        invSheet.getRange(targetRow, 6).setValue(gsm);
      } else {
        targetRow = foundIdx + 1;
      }
      
      var inCol = 8 + (day - 1) * 2;
      var currentVal = invSheet.getRange(targetRow, inCol).getValue() || 0;
      invSheet.getRange(targetRow, inCol).setValue(currentVal + parseFloat(weight));
      
      if (rate) {
        invSheet.getRange(targetRow, 73).setValue(rate); // BU is 73
      }
      
      updatesCount++;
    }
  }
  
  if (updatesCount > 0) {
    updateInventoryCalculations(invSheet);
    SpreadsheetApp.getUi().alert("✅ SUCCESS: " + updatesCount + " IN entries processed!");
    entrySheet.getRange("B5:H150").clearContent();
  } else {
    SpreadsheetApp.getUi().alert("⚠️ WARNING: No valid entries were processed.");
  }
}

// --- Logo Upload Utility ---
function showLogoUploadSidebar() {
  var html = HtmlService.createHtmlOutput(
    '<html><body style="font-family: Arial, sans-serif; padding: 15px; background: #f4f6f9;">' +
    '<h3 style="color: #1A237E;">🖼️ Upload Company Logo</h3>' +
    '<p style="font-size: 13px; color: #555;">Select your logo image. It will be automatically added to the Dashboard and Job Card.</p>' +
    '<input type="file" id="logoFile" accept="image/*" style="margin-bottom: 15px;" /><br>' +
    '<button onclick="upload()" style="padding: 10px 15px; background: #0F9D58; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%;">Upload & Set Logo</button>' +
    '<p id="status" style="margin-top: 15px; font-weight: bold; color: #d93025; font-size: 14px;"></p>' +
    '<script>' +
    'function upload() {' +
    '  var file = document.getElementById("logoFile").files[0];' +
    '  if(!file) { document.getElementById("status").innerHTML = "Please select a file first!"; return; }' +
    '  document.getElementById("status").style.color = "#1A237E";' +
    '  document.getElementById("status").innerHTML = "Uploading... Please wait.";' +
    '  var reader = new FileReader();' +
    '  reader.onload = function(e) {' +
    '    var data = e.target.result;' +
    '    google.script.run.withSuccessHandler(function(msg) {' +
    '      document.getElementById("status").innerHTML = msg;' +
    '      if(msg.indexOf("✅") !== -1) document.getElementById("status").style.color = "#0F9D58";' +
    '    }).processLogoUpload(data, file.name, file.type);' +
    '  };' +
    '  reader.readAsDataURL(file);' +
    '}' +
    '</script></body></html>'
  ).setTitle('Logo Upload').setWidth(300);
  SpreadsheetApp.getUi().showSidebar(html);
}

function processLogoUpload(dataUrl, filename, mimeType) {
  try {
    var base64Data = dataUrl.split(",")[1];
    var blob = Utilities.newBlob(Utilities.base64Decode(base64Data), mimeType, filename);
    
    // Create or find folder
    var folderName = "Packwell ERP Assets";
    var folders = DriveApp.getFoldersByName(folderName);
    var folder;
    if (folders.hasNext()) folder = folders.next();
    else folder = DriveApp.createFolder(folderName);
    
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    var fileId = file.getId();
    var imageUrl = "https://drive.google.com/uc?export=view&id=" + fileId;
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    
    // Set in Dashboard
    var dash = ss.getSheetByName("0. Dashboard");
    if (dash) {
      dash.getRange("B2:B4").setFormula('=IMAGE("' + imageUrl + '", 2)');
    }
    
    // Set in Job Card
    var jc = ss.getSheetByName("1. Job Card");
    if (jc) {
      jc.getRange("B2:B3").setFormula('=IMAGE("' + imageUrl + '", 2)');
    }
    
    return "✅ Logo uploaded and set successfully! You can close this sidebar.";
  } catch (e) {
    return "❌ Error: " + e.message;
  }
}

function autoFillNewItemData(sheet, searchArt) {
  if (searchArt) {
    var searchStr = searchArt.toString().toLowerCase();
    var masterSheet = sheet.getParent().getSheetByName("3. Master Data");
    var data = masterSheet.getDataRange().getValues();
    var found = null;
    for (var i = 1; i < data.length; i++) {
      if ((data[i][1] && data[i][1].toString().toLowerCase() === searchStr) ||
          (data[i][2] && data[i][2].toString().toLowerCase() === searchStr)) {
        found = data[i];
        break;
      }
    }
    if (found) {
      sheet.getRange("C6").setValue(found[0]);
      sheet.getRange("C7").setValue(found[1]);
      sheet.getRange("C8").setValue(found[2]);
      sheet.getRange("E6").setValue(found[3]);
      sheet.getRange("E7").setValue(found[4]);
      sheet.getRange("E8").setValue(found[5]);
      sheet.getRange("C9").setValue(found[6]);
      sheet.getRange("E9").setValue(found[7]);
      sheet.getRange("E10").setValue(found[10]); // Flute
      sheet.getRange("C10").setValue(found[9]); // Ply
      sheet.getRange("E11").setValue(found[36]); // UPS
      sheet.getRange("E12").setValue(found[35]); // Creasing
      sheet.getRange("C14").setValue(found[37]); // Packing
      sheet.getRange("E14").setValue(found[38]); // Special Req
      
      var colIdx = 11;
      for (var r = 16; r <= 22; r++) {
        sheet.getRange("C" + r).setValue(found[colIdx++]);
        sheet.getRange("D" + r).setValue(found[colIdx++]);
        sheet.getRange("E" + r).setValue(found[colIdx++]);
      }
      
      // Set Production Summary Fields
      sheet.getRange("C27").setValue(found[26]); // Reel Size
      sheet.getRange("C28").setValue(found[8]); // Cut Size
      sheet.getRange("E27").setValue(found[34]); // Pin Qty
      sheet.getRange("E28").setValue(found[32]); // Pin/Glue
      
      // Removed formula injections here to keep the sheet purely formula-free as requested.
      if (sheet.getName() === "1. Job Card") {
        calculateJobCardWeights(sheet);
      }
      
      SpreadsheetApp.getActiveSpreadsheet().toast("Loaded existing data for Artwork No: " + searchArt);
      
      // Trigger layer hide/show based on loaded Ply
      var ply = parseInt(found[9]);
      if (ply === 2) sheet.hideRows(18, 5);
      else if (ply === 3) { sheet.showRows(18, 1); sheet.hideRows(19, 4); }
      else if (ply === 5) { sheet.showRows(18, 3); sheet.hideRows(21, 2); }
      else sheet.showRows(18, 5);
      
    } else {
      SpreadsheetApp.getActiveSpreadsheet().toast("Artwork No. not found!");
    }
  }
}
