/**
 * Packwell India ERP - Automated Job Card System
 * Code Version: 1.0 (FINAL)
 */

function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('ðŸ“¦ Packwell ERP')
      .addItem('1. Setup ERP Workspace', 'setupERPWorkspace')
      .addSeparator()
      .addItem('Generate Job Card (PDF & Save)', 'generateJobCard')
      .addItem('Save New Master Item', 'saveNewMasterItem')
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

  var sheets = [
    "0. Dashboard",
    "1. Job Card",
    "2. Data Base",
    "3. Master Data",
    "4. Add New Item",
    "5. Tracker"
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

  SpreadsheetApp.getUi().alert("âœ… LAJAWAB! ERP Workspace has been successfully setup. You can now start using it!");
}

function setupDashboard(sheet) {
  sheet.clear();
  sheet.setHiddenGridlines(true);
  
  // Set Background for the whole sheet to Light Gray
  sheet.getRange(1, 1, 50, 20).setBackground("#F4F6F9");
  
  // Standardize Column Widths (B to G used for cards and table)
  sheet.setColumnWidth(1, 20); // A margin
  sheet.setColumnWidth(2, 120); // B Job Card
  sheet.setColumnWidth(3, 120); // C Date
  sheet.setColumnWidth(4, 160); // D Customer
  sheet.setColumnWidth(5, 160); // E Product
  sheet.setColumnWidth(6, 140); // F Qty
  sheet.setColumnWidth(7, 140); // G Status
  sheet.setColumnWidth(8, 20); // H margin
  sheet.setColumnWidth(9, 150); // I chart
  sheet.setColumnWidth(10, 150); // J chart
  sheet.setColumnWidth(11, 150); // K chart
  
  // Title
  sheet.getRange("B2:G4").merge().setValue("PACKWELL INDIA - EXECUTIVE DASHBOARD")
      .setFontSize(22).setFontWeight("bold").setFontColor("#FFFFFF")
      .setBackground("#1A237E").setHorizontalAlignment("center").setVerticalAlignment("middle");
      
  // Subtitle (Date)
  sheet.getRange("B5:G5").merge().setFormula('="Last Updated: " & TEXT(NOW(), "dd-MMM-yyyy hh:mm AM/PM")')
      .setFontSize(10).setFontColor("#555555").setHorizontalAlignment("right").setFontStyle("italic");
  
  // Helper function to create KPI Card
  function createCard(rangeA1, title, formula, bgColor, fontColor) {
    var range = sheet.getRange(rangeA1);
    range.setBackground(bgColor).setBorder(true, true, true, true, false, false, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID);
    var sr = range.getRow(); var sc = range.getColumn(); var ec = range.getLastColumn(); var er = range.getLastRow();
    
    sheet.getRange(sr, sc, 1, ec - sc + 1).merge().setValue(title)
         .setFontSize(14).setFontWeight("bold").setFontColor(fontColor)
         .setHorizontalAlignment("center").setVerticalAlignment("middle");
         
    sheet.getRange(sr + 1, sc, er - sr, ec - sc + 1).merge().setFormula(formula)
         .setFontSize(28).setFontWeight("bold").setFontColor(fontColor)
         .setHorizontalAlignment("center").setVerticalAlignment("middle");
  }
  
  // Create KPI Cards
  createCard("B7:C9", "TOTAL ORDERS", "=COUNTA('2. Data Base'!A3:A)", "#FFFFFF", "#1A237E");
  createCard("D7:E9", "PENDING", '=COUNTIF(\'2. Data Base\'!V3:V, "Pending")', "#FFF9C4", "#F57F17");
  createCard("F7:G9", "IN-PROCESS", '=COUNTIF(\'2. Data Base\'!V3:V, "Issued")', "#E3F2FD", "#1565C0");
  
  createCard("B11:C13", "COMPLETED", '=COUNTIF(\'2. Data Base\'!V3:V, "Completed")', "#E8F5E9", "#2E7D32");
  createCard("D11:E13", "CANCELLED", '=COUNTIF(\'2. Data Base\'!V3:V, "Cancelled")', "#FFEBEE", "#C62828");
  createCard("F11:G13", "AVG WASTAGE", "=IFERROR(AVERAGE('2. Data Base'!U3:U), 0)", "#F3E5F5", "#6A1B9A");
  sheet.getRange("F12:G13").setNumberFormat("0.00%"); // Format formula part of the card
  
  // Setup Chart Data in Hidden Columns
  sheet.getRange("Z1").setValue("Status");
  sheet.getRange("AA1").setValue("Count");
  sheet.getRange("Z2").setValue("Pending");
  sheet.getRange("AA2").setFormula('=COUNTIF(\'2. Data Base\'!V3:V, "Pending")');
  sheet.getRange("Z3").setValue("In-Process");
  sheet.getRange("AA3").setFormula('=COUNTIF(\'2. Data Base\'!V3:V, "Issued")');
  sheet.getRange("Z4").setValue("Completed");
  sheet.getRange("AA4").setFormula('=COUNTIF(\'2. Data Base\'!V3:V, "Completed")');
  sheet.hideColumns(26, 2);
  
  // Remove existing charts if any
  var existingCharts = sheet.getCharts();
  for (var i = 0; i < existingCharts.length; i++) {
    sheet.removeChart(existingCharts[i]);
  }
  
  // Create Embedded Pie Chart
  var chart = sheet.newChart()
      .setChartType(Charts.ChartType.PIE)
      .addRange(sheet.getRange("Z1:AA4"))
      .setPosition(7, 9, 0, 0) // Row 7, Col 9 (I)
      .setOption('title', 'Job Status Distribution')
      .setOption('pieHole', 0.4)
      .setOption('colors', ['#F57F17', '#1565C0', '#2E7D32'])
      .setOption('backgroundColor', '#F4F6F9')
      .setOption('width', 430)
      .setOption('height', 280)
      .build();
  sheet.insertChart(chart);
  
  // Active Jobs Monitor Section
  sheet.getRange("B16:G16").merge().setValue("URGENT ACTIVE JOBS (PENDING & ISSUED)")
      .setFontSize(14).setFontWeight("bold").setFontColor("#FFFFFF")
      .setBackground("#37474F").setHorizontalAlignment("center").setVerticalAlignment("middle");
      
  sheet.getRange("B17:G17").setValues([["Job Card No", "Target Date", "Customer Name", "Product Name", "Order Qty", "Status"]])
       .setBackground("#CFD8DC").setFontWeight("bold").setHorizontalAlignment("center")
       .setBorder(true, true, true, true, true, true, "#90A4AE", SpreadsheetApp.BorderStyle.SOLID);
       
  sheet.getRange("B18").setFormula('=IFERROR(QUERY(\'2. Data Base\'!A3:V, "SELECT A, C, D, E, F, V WHERE V = \'Pending\' OR V = \'Issued\' ORDER BY C ASC LIMIT 15", 0), "No active jobs.")');
  
  // Format the table output
  sheet.getRange("B18:G32").setFontSize(10).setHorizontalAlignment("center").setVerticalAlignment("middle").setWrap(true);
  sheet.getRange("C18:C32").setNumberFormat("dd-MMM-yyyy");
  
  sheet.setActiveSelection("A1");
}

function setupJobCardGenerator(sheet) {
  sheet.clear();
  sheet.setColumnWidth(1, 20); // Spacer
  sheet.setColumnWidth(2, 200); // Labels
  sheet.setColumnWidth(3, 360); // Inputs
  sheet.setColumnWidth(4, 240); // Labels
  sheet.setColumnWidth(5, 360); // Inputs
  
  sheet.getRange("B2:E3").merge().setValue("PACKWELL INDIA - JOB CARD")
       .setFontSize(18).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle")
       .setBackground("#0F9D58").setFontColor("#FFFFFF");
       
  sheet.getRange("B4").setValue("Search Job Card No. to Edit:");
  sheet.getRange("C4").setBackground("#FFF2CC").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  
  sheet.getRange("D4").setValue("Action:");
  sheet.getRange("E4").setBackground("#FFF2CC").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  var actionRule = SpreadsheetApp.newDataValidation().requireValueInList(["Save / Update", "Cancel Job Card"], true).build();
  sheet.getRange("E4").setDataValidation(actionRule).setValue("Save / Update").setFontWeight("bold").setFontColor("#CC0000");

  sheet.getRange("B5:E5").merge().setValue("â–º ORDER DETAILS").setBackground("#E0E0E0").setFontWeight("bold");
  sheet.getRange("B6").setValue("Job Card No (Auto):");
  sheet.getRange("B7").setValue("Date & Time:");
  sheet.getRange("B8").setValue("Customer Name:");
  sheet.getRange("B9").setValue("Item Code (Search Master):");
  sheet.getRange("B10").setValue("Product Name:");
  sheet.getRange("B11").setValue("Order Qty (Boxes):");
  sheet.getRange("B12").setValue("Target Delivery Date:");
  sheet.getRange("B13").setValue("Priority (High/Normal):");

  sheet.getRange("D6").setValue("Length (L):");
  sheet.getRange("D7").setValue("Width (W):");
  sheet.getRange("D8").setValue("Height (H):");
  sheet.getRange("D9").setValue("Ply:");
  sheet.getRange("D10").setValue("Flute:");
  sheet.getRange("D11").setValue("UPS:");
  sheet.getRange("D12").setValue("Creasing:");
  sheet.getRange("D13").setValue("Color:");

  var inputRanges = ["C6:C14", "E6:E14"];
  inputRanges.forEach(function(r) {
    sheet.getRange(r).setBackground("#F3F3F3").setBorder(true, true, true, true, false, false, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID)
         .setHorizontalAlignment("center").setVerticalAlignment("middle");
  });
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
  
  // Custom Options
  sheet.getRange("B14").setValue("Packing:");
  sheet.getRange("D14").setValue("Special Req:");
  sheet.getRange("C14").clearDataValidations();
  sheet.getRange("E14").clearDataValidations();
  sheet.getRange("E13").clearDataValidations(); // Color dropdown removal

  sheet.getRange("B16:E16").merge().setValue("â–º PAPER SPECIFICATIONS (Auto-Calculated)").setBackground("#E0E0E0").setFontWeight("bold");
  
  var paperHeaders = ["Layer", "Paper Details (Type & BF)", "GSM", "Weight (Kg)"];
  sheet.getRange("B17:E17").setValues([paperHeaders]).setFontWeight("bold").setBackground("#4285F4").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  
  var layers = [["Top"], ["Flute 1"], ["Liner 2"], ["Flute 2"], ["Liner 3"], ["Flute 3"], ["Liner 4"]];
  sheet.getRange("B18:B24").setValues(layers).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange("C18:E24").setBackground("#F3F3F3").setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID)
       .setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.getRange("E18:E24").clearDataValidations().clearContent();

  sheet.getRange("B26:E26").merge().setValue("â–º PRODUCTION SUMMARY").setBackground("#E0E0E0").setFontWeight("bold");
  sheet.getRange("B27").setValue("Reel Size:");
  sheet.getRange("B28").setValue("Cut Size:");
  sheet.getRange("B29").setValue("One Box Weight (Kg):");
  sheet.getRange("B30").setValue("No. of Paper:");
  
  sheet.getRange("D27").setValue("Pin Qty:");
  sheet.getRange("D28").setValue("Pin/Glue:");
  sheet.getRange("D29").setValue("Total Order Weight (Kg):");
  sheet.getRange("D30").setValue("No. of Ply:");

  sheet.getRange("C27:C30").setBackground("#F3F3F3").setHorizontalAlignment("center").setVerticalAlignment("middle");
  sheet.getRange("E27:E30").setBackground("#F3F3F3").setHorizontalAlignment("center").setVerticalAlignment("middle");
  
  sheet.getRange("C29:C30").clearDataValidations().clearContent();
  sheet.getRange("E29:E30").clearDataValidations().clearContent();
  
  sheet.getRange("E26").clearDataValidations();
  sheet.getRange("C27").clearDataValidations();

  sheet.getRange("B32:E32").merge().setValue("â–º DEPARTMENT PRODUCTION & SIGNATURES").setBackground("#E0E0E0").setFontWeight("bold");
  
  var deptHeaders = ["Department", "Production Qty", "Operator Name", "Supervisor Sign"];
  sheet.getRange("B33:E33").setValues([deptHeaders]).setFontWeight("bold").setBackground("#8E7CC3").setFontColor("#FFFFFF").setHorizontalAlignment("center");
  
  var depts = [
    ["1. Corrugation Deptt"],
    ["2. Paper Cutting Deptt"],
    ["3. Pasting Deptt"],
    ["4. Rotary / Die"],
    ["5. RS4"],
    ["6. Finish Goods"]
  ];
  sheet.getRange("B34:B39").setValues(depts).setFontWeight("bold");
  sheet.getRange("C34:E39").setBackground("#F3F3F3").setBorder(true, true, true, true, true, true, "#CCCCCC", SpreadsheetApp.BorderStyle.SOLID)
       .setHorizontalAlignment("center").setVerticalAlignment("middle");
       
  sheet.setRowHeights(34, 6, 30);
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
  var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(["Generated", "Pending", "Issued", "Cancelled"], true).build();
  sheet.getRange("V2:V").setDataValidation(statusRule);

  // Status Row Colors
  var range = sheet.getRange("A2:Y");
  var rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$V2="Generated"').setBackground("#EFEFEF").setRanges([range]).build());
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
  sheet.setColumnWidths(1, headers.length, 100);
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
  
  sheet.getRange("B2:G3").merge().setValue("ADD NEW ITEM TO MASTER DATA")
       .setFontSize(16).setFontWeight("bold").setHorizontalAlignment("center").setVerticalAlignment("middle")
       .setBackground("#6AA84F").setFontColor("#FFFFFF");
       
  sheet.getRange("B4").setValue("Search Artwork No. to Edit:");
  sheet.getRange("C4").setBackground("#FFF2CC").setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange("D4:G4").merge().setValue("Leave blank to create new Item").setFontStyle("italic").setFontColor("#666666");

  sheet.getRange("B5:E5").merge().setValue("â–º GENERAL INFO").setBackground("#E0E0E0").setFontWeight("bold");
  sheet.getRange("F5:G5").merge().setValue("â–º FINISHING DETAILS").setBackground("#E0E0E0").setFontWeight("bold");
  
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
  
  sheet.getRange("B14:E14").merge().setValue("â–º PAPER SPECIFICATIONS").setBackground("#E0E0E0").setFontWeight("bold");
  
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
    "PENDING AT", "REEL SIZE", "CUT SIZE", "CARTON SIZE (LXWXH)", "CARTON STYLE", 
    "CORRUGATION PRODUCTION", "FINISH GOODS", "WASTAGE %", "DISPATCH QTY", "BALANCE QTY", 
    "DELIVERY STATUS", "FINISH DATE", "REMARKS"
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers])
       .setFontWeight("bold").setBackground("#E69138").setFontColor("#FFFFFF").setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");
  sheet.setColumnWidths(1, headers.length, 120);

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
      SpreadsheetApp.getUi().alert("âš ï¸ Please select a Job Card No. in C4 to cancel.");
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
      SpreadsheetApp.getUi().alert("âœ… Job Card " + searchJobCancel + " has been Cancelled successfully.");
      
      var clearRangesCancel = ["C4", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "C18:D24", "E18:E24", "C27:C28", "E27:E28", "C29:C30", "E29:E30", "C34:E39"];
      clearRangesCancel.forEach(function(rng) {
        sheet.getRange(rng).clearContent();
      });
      sheet.getRange("E4").setValue("Save / Update");
    } else {
      SpreadsheetApp.getUi().alert("âš ï¸ Job Card not found in Database!");
    }
    return;
  }
  
  var orderQty = sheet.getRange("C11").getValue();
  var targetDate = sheet.getRange("C12").getValue();
  
  if (!orderQty || !targetDate) {
    SpreadsheetApp.getUi().alert("âš ï¸ Validation Error\n\nPlease fill both 'Order Qty (Boxes)' and 'Target Delivery Date' before generating the Job Card.");
    return;
  }

  var dbSheet = ss.getSheetByName("2. Data Base");
  
  var jobCardNo = sheet.getRange("C6").getValue();
  if (!jobCardNo) {
    jobCardNo = generateNextJobCardNo(dbSheet);
    sheet.getRange("C6").setValue(jobCardNo);
  }
  
  var status = "Generated";
  var cartonStyle = "Packing: " + (sheet.getRange("C14").getValue() || "N/A") + " | Spcl: " + (sheet.getRange("E14").getValue() || "N/A");
  
  var dataRow = [
    jobCardNo,
    sheet.getRange("C7").getValue(), // Date & Time
    sheet.getRange("C12").getValue(), // Target Delivery Date
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
  dataRow.push(now);
  
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
    dataRow[21] = "Updated"; // Change status
    dataRow[22] = dbSheet.getRange(foundRow, 23).getValue(); // Preserve existing remarks
  }
  
  var message = "";
  if (foundRow > -1) {
    dbSheet.getRange(foundRow, 1, 1, dataRow.length).setValues([dataRow]);
    message = "âœ… Job Card Updated Successfully!";
  } else {
    dbSheet.insertRowAfter(1);
    
    // Fix formatting inheritance from Header (Row 1)
    var newRowRange = dbSheet.getRange(2, 1, 1, dbSheet.getMaxColumns());
    newRowRange.clearFormat();
    newRowRange.setFontWeight("normal").setFontColor("#000000").setBackground(null).setFontSize(9).setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");
    
    // Re-apply Status Dropdown for the new row
    var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(["Generated", "Pending", "Issued", "Cancelled"], true).build();
    dbSheet.getRange(2, 22).setDataValidation(statusRule);
    
    dbSheet.getRange(2, 1, 1, dataRow.length).setValues([dataRow]);
    m  // --- PDF GENERATION LOGIC ---
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
    var dataRanges = ["C4", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "C18:D24", "E18:E24", "C27:C28", "E27:E28", "C29:C30", "E29:E30", "C34:E39"];
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
    
    // Construct the export URL for PDF, A4 size, Portrait
    var url = "https://docs.google.com/spreadsheets/d/" + spreadsheetId + "/export" +
              "?exportFormat=pdf&format=pdf" +
              "&size=A4" +
              "&portrait=true" +
              "&fitw=true" +
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
      var clearRanges = ["C4", "C6", "C7", "C8", "C9", "C10", "C11", "C12", "C13", "C14", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "C18:D24", "E18:E24", "C27:C28", "E27:E28", "C29:C30", "E29:E30", "C34:E39"];
      clearRanges.forEach(function(r) {
        sheet.getRange(r).clearContent();
      });
      
      // Show dialog with link to print/download
      var html = HtmlService.createHtmlOutput(
        '<html><body style="font-family: Arial, sans-serif; text-align: center; padding: 20px;">' +
        '<h3 style="color: #0F9D58;">' + message + '</h3>' +
        '<p>Your Job Card PDF has been generated successfully.</p>' +
        '<a href="' + file.getUrl() + '" target="_blank" onclick="setTimeout(function(){ google.script.host.close(); }, 500);" style="display: inline-block; padding: 10px 20px; margin-top: 15px; background-color: #4285F4; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">ðŸ“„ Open / Print PDF (A4)</a>' +
        '</body></html>'
      ).setWidth(400).setHeight(250);
      
      SpreadsheetApp.getUi().showModalDialog(html, "Job Card PDF");
    } else {
      SpreadsheetApp.getUi().alert(message + "\\n\\nâš ï¸  Error generating PDF. Check authorization or try again.");
    }
  } catch (e) {
    SpreadsheetApp.getUi().alert(message + "\\n\\nâš ï¸  Error generating PDF: " + e.message + "\\n\\nPlease make sure you have authorized Drive permissions.");
  } finally {
    if (tempSheet) {
      ss.deleteSheet(tempSheet);
    }
    sheet.showRows(4); // Show Search Row after export
    SpreadsheetApp.flush();
  }
}

function generateNextJobCardNo(dbSheet) {
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
    SpreadsheetApp.getUi().alert("âœ… Master Item Updated Successfully!");
  } else {
    masterSheet.appendRow(dataRow);
    SpreadsheetApp.getUi().alert("âœ… New Master Item Saved Successfully!");
  }
}

function onEdit(e) {
  if (!e || !e.range) return;
  
  var sheet = e.range.getSheet();
  
  if (sheet.getName() === "2. Data Base") {
    if (e.range.getColumn() === 22 && e.value) {
      var row = e.range.getRow();
      var status = e.value;
      var remarkCell = sheet.getRange(row, 23);
      
      if (status === "Generated") {
        remarkCell.setValue("For Issue");
      } else if (status === "Pending" || status === "Cancelled") {
        remarkCell.clearContent();
      } else if (status === "Issued") {
        remarkCell.setValue("In-Process");
      }
      
      if (status === "Issued") {
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
          
          // Formulate Carton Size (L x W x H)
          var cartonSize = (dbData[12] || "") + "x" + (dbData[13] || "") + "x" + (dbData[14] || "");
          
          var trackerRow = [
            "=ROW()-1", // S. NO.
            jobCardNo, // JOB CARD NO.
            dbData[1], // JOB DATE AND TIME
            targetDate, // TARGET DELIVERY DATE
            dbData[4], // JOB NAME
            dbData[3], // CUSTOMER NAME
            dbData[5], // ORDER QTY
            dbData[6], // UPS
            dbData[7], // NO. OF PAPER
            dbData[8], // NO. OF PLY
            dbData[9], // PRINTING COLOR
            "", // PENDING AT
            dbData[10], // REEL SIZE
            dbData[11], // CUT SIZE
            cartonSize, // CARTON SIZE (LXWXH)
            dbData[15], // CARTON STYLE
            "", // CORRUGATION PRODUCTION
            "", // FINISH GOODS
            '=IF(Q' + nextRow + '="","", (Q' + nextRow + '-R' + nextRow + ')/Q' + nextRow + ')', // WASTAGE %
            "", // DISPATCH QTY
            '=R' + nextRow + '-T' + nextRow, // BALANCE QTY
            '=IF(D' + nextRow + '="","", IF(TODAY()<=D' + nextRow + ', "ON-TIME", (TODAY()-D' + nextRow + ') & " DAY DELAY"))', // DELIVERY STATUS
            "", // FINISH DATE
            "" // REMARKS
          ];
          
          trackerSheet.appendRow(trackerRow);
          
          // Format specific columns if needed (e.g. WASTAGE as %)
          trackerSheet.getRange(nextRow, 19).setNumberFormat("0.00%");
          trackerSheet.getRange(nextRow, 1, 1, 24).setFontSize(9).setHorizontalAlignment("center").setWrap(true).setVerticalAlignment("middle");
          
          e.source.toast("âœ… Job Card " + jobCardNo + " issued and added to Tracker.");
        } else {
          e.source.toast("âš ï¸ Job Card " + jobCardNo + " is already in Tracker.");
        }
      }
    }
  }
  }
  
  if (sheet.getName() === "5. Tracker") {
    // If Finish Date (Column W / 23) is edited
    if (e.range.getColumn() === 23 && e.value) {
      var row = e.range.getRow();
      var jobCardNo = sheet.getRange(row, 2).getValue();
      var finishDate = e.value;
      
      // Get computed values from Tracker for Corrugation, Finish Goods, Wastage before deleting
      var trackerRowValues = sheet.getRange(row, 1, 1, 19).getValues()[0];
      var corrugation = trackerRowValues[16]; // Q
      var finishGoods = trackerRowValues[17]; // R
      var wastage = trackerRowValues[18];     // S
      
      // 1. Remove from Tracker permanently
      sheet.deleteRow(row);
      
      // 2. Update Data Base
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
          dbSheet.getRange(foundDbRow, 22).setValue("Completed"); // Update Status
          
          // Add Tracker calculated values without formulas
          dbSheet.getRange(foundDbRow, 19).setValue(corrugation);
          dbSheet.getRange(foundDbRow, 20).setValue(finishGoods);
          dbSheet.getRange(foundDbRow, 21).setValue(wastage);
          if (wastage !== "") {
            dbSheet.getRange(foundDbRow, 21).setNumberFormat("0.00%");
          }
          
          dbSheet.getRange(foundDbRow, 23).setValue("Finished on dated " + finishDate);
          
          // Make entire row green
          dbSheet.getRange(foundDbRow, 1, 1, dbSheet.getLastColumn()).setBackground("#D9EAD3");
        }
      }
      
      e.source.toast("âœ… Job Completed! Removed from Tracker and updated in Data Base.");
    }
  }
  
  if (sheet.getName() === "4. Add New Item") {
    // Search auto-fill
    if (e.range.getRow() === 4 && e.range.getColumn() === 3) {
      var searchArt = e.value;
      if (searchArt) {
        var searchStr = searchArt.toString().toLowerCase();
        var masterSheet = sheet.getParent().getSheetByName("3. Master Data");
        var data = masterSheet.getDataRange().getValues();
        var found = null;
        for (var i = 1; i < data.length; i++) {
          if ((data[i][1] && data[i][1].toString().toLowerCase().indexOf(searchStr) !== -1) ||
              (data[i][2] && data[i][2].toString().toLowerCase().indexOf(searchStr) !== -1)) {
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
          sheet.getRange("E10").setValue(found[8]);
          sheet.getRange("C10").setValue(found[9]); // Ply
          sheet.getRange("C11").setValue(found[10]);
          
          var colIdx = 11;
          for (var r = 16; r <= 22; r++) {
            sheet.getRange("C" + r).setValue(found[colIdx++]);
            sheet.getRange("D" + r).setValue(found[colIdx++]);
            sheet.getRange("E" + r).setValue(found[colIdx++]);
          }
          
          sheet.getRange("G6").setValue(found[32]);
          sheet.getRange("G7").setValue(found[33]);
          sheet.getRange("G8").setValue(found[34]);
          sheet.getRange("G9").setValue(found[35]);
          sheet.getRange("G10").setValue(found[36]);
          sheet.getRange("G11").setValue(found[37]);
          sheet.getRange("G12").setValue(found[38]);
          
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
    
    // Dynamic layer hiding on Ply edit
    if (e.range.getRow() === 10 && e.range.getColumn() === 3) {
      var ply = parseInt(e.value);
      if (ply === 2) sheet.hideRows(18, 5);
      else if (ply === 3) { sheet.showRows(18, 1); sheet.hideRows(19, 4); }
      else if (ply === 5) { sheet.showRows(18, 3); sheet.hideRows(21, 2); }
      else sheet.showRows(18, 5);
    }
  } 
  else if (sheet.getName() === "1. Job Card") {
    var row = e.range.getRow();
    var col = e.range.getColumn();
    var isWeightDep = (col === 3 && (row === 11 || row === 27 || row === 28)) || 
                      (col === 5 && (row === 9 || row === 11)) || 
                      (col === 4 && (row >= 18 && row <= 24));
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
                sheet.getRange("C" + r).setValue(pType ? (pType + " (" + pBF + " BF)") : ""); 
                sheet.getRange("D" + r).setValue(mFound[masterIdx + 2]); // GSM
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
        var clearRanges = ["C8", "C9", "C10", "C11", "C12", "C13", "C14", "E6", "E7", "E8", "E9", "E10", "E11", "E12", "E13", "E14", "C18:D24", "E18:E24", "C27:C28", "E27:E28", "C29:C30", "E29:E30", "C34:E39"];
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
          var matchCode = data[i][1] && data[i][1].toString().toLowerCase().indexOf(searchStr) !== -1;
          var matchName = data[i][2] && data[i][2].toString().toLowerCase().indexOf(searchStr) !== -1;
          
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
            sheet.getRange("C" + r).setValue(pType ? (pType + " (" + pBF + " BF)") : ""); // Paper Type + BF
            sheet.getRange("D" + r).setValue(found[masterIdx + 2]); // GSM
            // Column E contains the Weight formula, so we don't overwrite it
            masterIdx += 3;
          }

          // Trigger layer hide/show based on loaded Ply
          var ply = parseInt(found[9]);
          if (ply === 2) sheet.hideRows(20, 5);
          else if (ply === 3) { sheet.showRows(20, 1); sheet.hideRows(21, 4); }
          else if (ply === 5) { sheet.showRows(20, 3); sheet.hideRow
