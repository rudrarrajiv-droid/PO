function setupCustomFeatures() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. JOB CARD SHEET CHANGES
  var jcSheet = ss.getSheetByName("1. Job Card");
  if (jcSheet) {
    // Unmerge existing B5:F5
    var oldMerge = jcSheet.getRange("B5:F5");
    oldMerge.breakApart();
    oldMerge.clearFormat();
    oldMerge.clearContent();
    
    // Merge B5:D5 and set "ORDER DETAILS" exactly as before
    jcSheet.getRange("B5:D5").merge().setValue("📋 ORDER DETAILS")
           .setBackground("#E0E0E0").setFontWeight("bold").setFontSize(14)
           .setHorizontalAlignment("left").setVerticalAlignment("middle")
           .setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
           
    // Write F/QA/016 in F5 with large size and different color
    jcSheet.getRange("F5").setValue("F/QA/016")
           .setFontSize(14).setFontWeight("bold").setFontColor("#990000") // Dark Red color
           .setBackground("#FFF2CC") // Light yellow background
           .setHorizontalAlignment("center").setVerticalAlignment("middle")
           .setBorder(true, true, true, true, false, false, "#000000", SpreadsheetApp.BorderStyle.SOLID);
  }
  
  // 2. DASHBOARD SHEET CHANGES
  var dashSheet = ss.getSheetByName("0. Dashboard");
  if (dashSheet) {
    // Freeze up to Row 5
    dashSheet.setFrozenRows(5);
    
    // Fix Dropdowns: Remove from G18 downwards
    dashSheet.getRange("G18:G100").clearDataValidations();
    
    // Put dropdown ONLY in G17 (as a Filter) with 5 options
    var rule = SpreadsheetApp.newDataValidation()
               .requireValueInList(["Pending", "Issued", "Completed", "Cancelled", "All"], true)
               .build();
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(['Pending', 'Issued', 'Completed', 'Cancelled', 'All', 'Smart Search'], true).build();
    dashSheet.getRange("G17").setDataValidation(rule).setValue("Pending");
    
    // Clear old formulas and legacy search box
    try { dashSheet.getRange("B18").clearContent(); } catch(e){}
    try { dashSheet.getRange("I18:I100").clearContent(); } catch(e){}
    try { dashSheet.getRange("L3:M4").clearContent().clearFormat(); } catch(e){}
    
    // Initial run to load data
    updateDashboardRecords();
    calculateDashboardKPIs();
  }
  
  // 3. TRACKER SORTING
  sortTracker();
  
  SpreadsheetApp.getUi().alert("Custom Features Setup Complete! Dashboard dropdown fixed, formulas hidden via scripts, Tracker sorted, and Search feature added to J4.");
}

// -------------------------------------------------------------
// DASHBOARD LOGIC (No Formulas)
// -------------------------------------------------------------

function handleDashboardOnEdit(e) {
  var sheet = e.range.getSheet();
  
  // Update Dashboard Records on G17 change
  if (sheet.getName() === "0. Dashboard" && e.range.getA1Notation() === "G17") {
    var val = e.value;
    if (val === "Smart Search") {
      var ui = SpreadsheetApp.getUi();
      var response = ui.prompt("Smart Search", "Enter Job Card ID or Item/Product Name:", ui.ButtonSet.OK_CANCEL);
      if (response.getSelectedButton() == ui.Button.OK && response.getResponseText()) {
        updateDashboardRecords(response.getResponseText());
      } else {
        e.range.setValue("Pending");
        updateDashboardRecords();
      }
    } else {
      updateDashboardRecords();
    }
  }
  
  // Trigger Tracker sort on edit
  if (sheet.getName() === "5. Tracker" && e.range.getRow() > 1 && e.range.getColumn() !== 23) {
    sortTracker();
  }
  
  // Refresh KPIs on Data Base edit
  if (sheet.getName() === "2. Data Base" && e.range.getRow() > 1) {
    calculateDashboardKPIs();
  }
}

function updateDashboardRecords(searchTerm) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dashSheet = ss.getSheetByName("0. Dashboard");
  var dbSheet = ss.getSheetByName("2. Data Base");
  
  if (!dashSheet || !dbSheet) return;
  
  var filter = dashSheet.getRange("G17").getValue();
  var data = dbSheet.getDataRange().getValues();
  
  var isSmartSearch = (filter === "Smart Search" && searchTerm);
  
  if (isSmartSearch) {
    // Write Data Base headers, skipping G column
    var dbHeaders = data[0]; // Row 1 of Data Base
    var leftHeaders = dbHeaders.slice(0, 5); // First 5
    var rightHeaders = dbHeaders.slice(5);   // The rest
    
    dashSheet.getRange(17, 2, 1, 5).setValues([leftHeaders])
             .setBackground("#CFD8DC").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true,true,true,true,true,true,"#90A4AE",SpreadsheetApp.BorderStyle.SOLID);
    
    if (rightHeaders.length > 0) {
      dashSheet.getRange(17, 8, 1, rightHeaders.length).setValues([rightHeaders])
               .setBackground("#CFD8DC").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true,true,true,true,true,true,"#90A4AE",SpreadsheetApp.BorderStyle.SOLID);
    }
    
    // Collect search results
    var sStr = searchTerm.toString().toLowerCase();
    var resultsLeft = [];
    var resultsRight = [];
    var resultsStatus = [];
    
    for (var i = 1; i < data.length; i++) {
      var jc = data[i][0] ? data[i][0].toString().toLowerCase() : "";
      var prod = data[i][4] ? data[i][4].toString().toLowerCase() : ""; // Fix: Column E (index 4) is Product Name
      
      if (jc.indexOf(sStr) !== -1 || prod.indexOf(sStr) !== -1) {
        resultsLeft.push(data[i].slice(0, 5));
        resultsRight.push(data[i].slice(5));
        resultsStatus.push([data[i][21] || ""]); // Job Status from DB
      }
    }
    
    // Clear old results safely
    try { dashSheet.getRange("B18:F100").clearContent(); } catch(e){}
    try { dashSheet.getRange("H18:AA100").clearContent(); } catch(e){}
    try { dashSheet.getRange("G18:G100").clearContent(); } catch(e){}
    
    if (resultsLeft.length > 0) {
      dashSheet.getRange(18, 2, resultsLeft.length, 5).setValues(resultsLeft);
      dashSheet.getRange(18, 8, resultsRight.length, resultsRight[0].length).setValues(resultsRight);
      dashSheet.getRange(18, 7, resultsStatus.length, 1).setValues(resultsStatus);
    } else {
      dashSheet.getRange("B18").setValue("No results found for: " + searchTerm);
    }
    
  } else {
    // Normal Dashboard view
    dashSheet.getRange("B17:F17").setValues([["Job Card No", "Target Date", "Customer Name", "Product Name", "Order Qty"]])
             .setBackground("#CFD8DC").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true,true,true,true,true,true,"#90A4AE",SpreadsheetApp.BorderStyle.SOLID);
    dashSheet.getRange("I17").setValue("Remarks")
             .setBackground("#CFD8DC").setFontWeight("bold").setHorizontalAlignment("center").setBorder(true,true,true,true,true,true,"#90A4AE",SpreadsheetApp.BorderStyle.SOLID);
    try { dashSheet.getRange("H17:H17").clearContent().setBorder(false,false,false,false,false,false); } catch(e){}
    try { dashSheet.getRange("J17:AA100").clearContent().setBorder(false,false,false,false,false,false); } catch(e){}
    
    // Clear old results
    try { dashSheet.getRange("B18:I100").clearContent(); } catch(e) {}
    
    var combined = [];
    for (var i = 1; i < data.length; i++) {
      var jc = data[i][0];
      var status = data[i][21];
      if (jc && (filter === "All" || status === filter)) {
        combined.push([jc, data[i][2], data[i][3], data[i][4], data[i][5], status, data[i][22] || ""]);
      }
    }
    
    // Sort by Target Date (C), then Job Card No (B)
    combined.sort(function(a, b) {
      var timeA = parseDateValue(a[1]);
      var timeB = parseDateValue(b[1]);
      if (timeA !== timeB) {
        return timeA - timeB;
      }
      var jcA = a[0] ? a[0].toString() : "";
      var jcB = b[0] ? b[0].toString() : "";
      
      // Numeric sort for job card if possible
      var numA = parseInt(jcA.replace(/\D/g, ''));
      var numB = parseInt(jcB.replace(/\D/g, ''));
      if (!isNaN(numA) && !isNaN(numB) && numA !== numB) {
        return numA - numB;
      }
      return jcA.localeCompare(jcB);
    });
    
    // Process all results without limits
    var results = [];
    var remarks = [];
    for (var i = 0; i < combined.length; i++) {
      results.push(combined[i].slice(0, 6));
      remarks.push([combined[i][6]]);
    }
    
    if (results.length > 0) {
      dashSheet.getRange(18, 2, results.length, 6).setValues(results);
      dashSheet.getRange(18, 9, remarks.length, 1).setValues(remarks);
    } else {
      dashSheet.getRange("B18").setValue("No active jobs for: " + filter);
    }
  }
}

function calculateDashboardKPIs() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dashSheet = ss.getSheetByName("0. Dashboard");
  var dbSheet = ss.getSheetByName("2. Data Base");
  
  if (!dashSheet || !dbSheet) return;
  
  var data = dbSheet.getDataRange().getValues();
  
  var total = 0;
  var pending = 0;
  var inProcess = 0;
  var completed = 0;
  var cancelled = 0;
  var totalWastage = 0;
  var wastageCount = 0;
  
  for (var i = 1; i < data.length; i++) {
    if (data[i][0]) { // If Job Card exists
      total++;
      var status = data[i][21];
      if (status === "Pending") pending++;
      else if (status === "Issued") inProcess++;
      else if (status === "Completed") completed++;
      else if (status === "Cancelled") cancelled++;
      
      var wastage = parseFloat(data[i][20]);
      if (!isNaN(wastage)) {
        totalWastage += wastage;
        wastageCount++;
      }
    }
  }
  
  var avgWastage = wastageCount > 0 ? (totalWastage / wastageCount) : 0;
  
  // Overwrite formulas with static values
  dashSheet.getRange("B8:C9").setValue(total);
  dashSheet.getRange("D8:E9").setValue(pending);
  dashSheet.getRange("F8:G9").setValue(inProcess);
  
  dashSheet.getRange("B12:C13").setValue(completed);
  dashSheet.getRange("D12:E13").setValue(cancelled);
  dashSheet.getRange("F12:G13").setValue(avgWastage);
  
  // 1 & 2. Progress Bars for Tracker and Database
  var delayedJobsCount = 0;
  var onTimeJobsCount = 0;
  var trackerSheet = ss.getSheetByName("5. Tracker");
  if (trackerSheet) {
    var trData = trackerSheet.getRange("V2:V" + Math.max(trackerSheet.getLastRow(), 2)).getValues();
    for (var j = 0; j < trData.length; j++) {
      if (trData[j][0]) {
        if (trData[j][0].toString().indexOf("DELAY") !== -1) {
          delayedJobsCount++;
        } else if (trData[j][0].toString() === "ON-TIME") {
          onTimeJobsCount++;
        }
      }
    }
  }
  
  // Tracker Progress Bar (I2:K2)
  var trTotal = delayedJobsCount + onTimeJobsCount;
  var trBar = "";
  if (trTotal > 0) {
    var onTimePerc = Math.round((onTimeJobsCount / trTotal) * 100);
    var onTimeBlocks = Math.round((onTimeJobsCount / trTotal) * 10);
    var delayedBlocks = 10 - onTimeBlocks;
    
    for (var b = 0; b < onTimeBlocks; b++) trBar += "🟩";
    for (var b = 0; b < delayedBlocks; b++) trBar += "🟥";
    
    trBar = "TRACKER: " + trBar + " " + onTimePerc + "% On-Time";
  } else {
    trBar = "TRACKER: NO DATA";
  }
  dashSheet.getRange("I2:K2").setValue(trBar);
  
  // Database Progress Bar (I3:K3)
  var dbTotal = pending + inProcess + completed;
  var dbBar = "";
  if (dbTotal > 0) {
    var pendPerc = Math.round((pending / dbTotal) * 100);
    var issPerc = Math.round((inProcess / dbTotal) * 100);
    var compPerc = 100 - pendPerc - issPerc;
    
    var pendBlocks = Math.round((pending / dbTotal) * 10);
    var issBlocks = Math.round((inProcess / dbTotal) * 10);
    var compBlocks = 10 - pendBlocks - issBlocks;
    
    for (var b = 0; b < pendBlocks; b++) dbBar += "🟨";
    for (var b = 0; b < issBlocks; b++) dbBar += "🟦";
    for (var b = 0; b < compBlocks; b++) dbBar += "🟩";
    
    dbBar = "DB: " + dbBar + " " + compPerc + "% Comp";
  } else {
    dbBar = "DATABASE: NO DATA";
  }
  dashSheet.getRange("I3:K3").setValue(dbBar);
  
  // Avg Wastage (I4:K4)
  dashSheet.getRange("I4:K4").setValue("📉 Avg Wastage: " + (avgWastage * 100).toFixed(2) + "%");

  // Hidden chart values
  dashSheet.getRange("AA2").setValue(pending);
  dashSheet.getRange("AA3").setValue(inProcess);
  dashSheet.getRange("AA4").setValue(completed);
}


// -------------------------------------------------------------
// DATABASE SORTING
// -------------------------------------------------------------

function sortDatabase() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dbSheet = ss.getSheetByName("2. Data Base");
  if (!dbSheet) return;
  
  var lastRow = dbSheet.getLastRow();
  var lastCol = dbSheet.getLastColumn();
  if (lastRow > 1) {
    var range = dbSheet.getRange(2, 1, lastRow - 1, lastCol);
    var data = range.getValues();
    
    var statusOrder = {
      "Pending": 1,
      "Issued": 2,
      "Completed": 3,
      "Cancelled": 4
    };
    
    data.sort(function(a, b) {
      var statA = a[21] ? a[21].toString().trim() : "Pending";
      var statB = b[21] ? b[21].toString().trim() : "Pending";
      
      var orderA = statusOrder[statA] || 99;
      var orderB = statusOrder[statB] || 99;
      
      if (orderA !== orderB) {
        return orderA - orderB;
      }
      
      var timeA = parseDateValue(a[2]); // Col C
      var timeB = parseDateValue(b[2]);
      return timeA - timeB; // Oldest to Newest
    });
    
    range.setValues(data);
    
    // Fix Data Validations (Remove red flags from Completed)
    var statusRule = SpreadsheetApp.newDataValidation().requireValueInList(["Pending", "Issued", "Cancelled"], true).build();
    var vRange = dbSheet.getRange(2, 22, lastRow - 1, 1);
    vRange.setDataValidation(statusRule);
    
    var vValues = vRange.getValues();
    var rules = vRange.getDataValidations();
    for (var i = 0; i < vValues.length; i++) {
      if (vValues[i][0] === "Completed") {
        rules[i][0] = null; // Clear validation
      }
    }
    vRange.setDataValidations(rules);
  }
}

// -------------------------------------------------------------
// TRACKER SORTING
// -------------------------------------------------------------

function sortTracker() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var trackerSheet = ss.getSheetByName("5. Tracker");
  if (!trackerSheet) return;
  
  var lastRow = trackerSheet.getLastRow();
  var lastCol = trackerSheet.getLastColumn();
  if (lastRow > 1) {
    var sortCol = Math.max(lastCol, 25);
    var range = trackerSheet.getRange(2, 1, lastRow - 1, sortCol);
    var data = range.getValues();
    
    data.sort(function(a, b) {
      var statA = a[21] ? a[21].toString() : ""; // Col V
      var statB = b[21] ? b[21].toString() : "";
      
      var isDelayA = statA.indexOf("DELAY") !== -1 ? 0 : 1;
      var isDelayB = statB.indexOf("DELAY") !== -1 ? 0 : 1;
      
      if (isDelayA !== isDelayB) {
        return isDelayA - isDelayB; // Delay (0) before ON-TIME (1)
      }
      
      var timeA = parseDateValue(a[24]); // Col Y
      var timeB = parseDateValue(b[24]);
      return timeA - timeB; // Oldest to Newest
    });
    
    range.setValues(data);
  }
}

// -------------------------------------------------------------
// PRINT CORRUGATION PLAN
// -------------------------------------------------------------

function printCorrugationPlan() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var trackerSheet = ss.getSheetByName("5. Tracker");
  if (!trackerSheet) {
    SpreadsheetApp.getUi().alert("Tracker sheet not found.");
    return;
  }
  
  var data = trackerSheet.getDataRange().getValues();
  if (data.length <= 1) {
    SpreadsheetApp.getUi().alert("No jobs found in Tracker.");
    return;
  }
  
  var dbSheet = ss.getSheetByName("2. Data Base");
  var dbData = dbSheet ? dbSheet.getDataRange().getValues() : [];
  
  // Build a map of JobCardNo to DB Dispatch Date
  var dbDateMap = {};
  if (dbData.length > 0) {
    for (var m = 1; m < dbData.length; m++) {
      var jc = dbData[m][0];
      if (jc) dbDateMap[jc.toString()] = dbData[m][2]; // Column C (Target Date)
    }
  }
  
  // Collect all valid jobs with plan date >= today
  var validJobs = [];
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var pDate = row[24]; // Column Y is index 24
    var parsedDate = null;
    
    if (pDate) {
      if (pDate instanceof Date) {
        parsedDate = pDate;
      } else if (typeof pDate === "string") {
        var str = pDate.replace(/^'/, ""); // remove prefix if any
        var parts = str.split("/");
        if (parts.length === 3) {
          // assuming dd/mm/yyyy
          parsedDate = new Date(parts[2], parts[1] - 1, parts[0]);
        } else {
           parsedDate = new Date(str);
        }
      } else if (typeof pDate === "number") {
          // Excel/Sheets serial date (rare but possible if fetched weirdly)
          parsedDate = new Date(Math.round((pDate - 25569) * 86400 * 1000));
      }
    }
    
  var today = new Date();
  today.setHours(0,0,0,0);
  
  var htmlStr = "<html><head><style>" +
    "body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 11px; margin: 20px; color: #333; }" +
    "h2 { text-align: center; font-size: 18px; font-weight: 600; margin-bottom: 5px; color: #1E3A8A; text-transform: uppercase; letter-spacing: 1px; }" +
    ".print-btn-container { text-align: center; margin-bottom: 20px; }" +
    ".print-btn { background-color: #2563EB; color: white; border: none; padding: 10px 20px; font-size: 14px; font-weight: bold; border-radius: 6px; cursor: pointer; transition: background-color 0.2s; box-shadow: 0 2px 4px rgba(37, 99, 235, 0.2); }" +
    ".print-btn:hover { background-color: #1D4ED8; }" +
    "table { width: 100%; border-collapse: collapse; margin-top: 15px; background: white; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-radius: 4px; overflow: hidden; }" +
    "th, td { border: 1px solid #E5E7EB; padding: 8px 10px; text-align: center; }" +
    "th { background-color: #F3F4F6; color: #374151; font-weight: 600; font-size: 10px; text-transform: uppercase; border-bottom: 2px solid #D1D5DB; }" +
    "tr:nth-child(even) { background-color: #F9FAFB; }" +
    "tr:hover { background-color: #F3F4F6; }" +
    ".day-header { background-color: #DBEAFE !important; color: #1E40AF; font-weight: bold; font-size: 14px; text-align: left; padding: 12px 10px; border-bottom: 2px solid #93C5FD; text-transform: uppercase; letter-spacing: 0.5px; }" +
    "@media print { " +
    "  .print-btn-container { display: none; } " +
    "  body { margin: 0; background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }" +
    "  table { box-shadow: none; border-radius: 0; }" +
    "}" +
    "</style></head><body>" +
    "<div class='print-btn-container'>" +
    "  <button class='print-btn' onclick='window.print()'>🖨️ Print Plan</button>" +
    "</div>" +
    "<h2>📦 CORRUGATION MACHINE PLAN</h2>" +
    "<table>";
    
  var headers = ["Job Card No", "Job Name", "Order Qty", "Flute", "Reel & Cut Size", "Carton Size", "Dispatch Date", "Remarks"];
  var hRow = "<tr>";
  for(var h=0; h<headers.length; h++) hRow += "<th>" + headers[h] + "</th>";
  hRow += "</tr>";
  htmlStr += hRow;
    if (parsedDate && !isNaN(parsedDate.getTime())) {
      parsedDate.setHours(0,0,0,0);
      row[24] = parsedDate; // Update the array with the actual Date object so sorting works
      validJobs.push(row);
    }
  }
  
  // Sort jobs by Corrugation Plan date
  validJobs.sort(function(a, b) { return a[24].getTime() - b[24].getTime(); });
  
  var jobsByDate = {};
  var uniqueDates = [];
  var backlogJobs = [];
  
  for (var j = 0; j < validJobs.length; j++) {
    var job = validJobs[j];
    var pDate = job[24];
    if (pDate.getTime() < today.getTime()) {
      backlogJobs.push(job);
    } else {
      var dStr = Utilities.formatDate(pDate, Session.getScriptTimeZone(), "dd-MMM-yyyy");
      if (uniqueDates.indexOf(dStr) === -1) {
        if (uniqueDates.length >= 4) continue; // we already have 4 upcoming days
        uniqueDates.push(dStr);
        jobsByDate[dStr] = [];
      }
      jobsByDate[dStr].push(job);
    }
  }
  
  var renderGroups = [];
  
  // Sort backlog by Dispatch Date
  backlogJobs.sort(function(a, b) {
    var jcA = a[1] ? a[1].toString() : "";
    var jcB = b[1] ? b[1].toString() : "";
    var da = parseDateValue(dbDateMap[jcA]);
    var db = parseDateValue(dbDateMap[jcB]);
    return da - db;
  });
  
  if (backlogJobs.length > 0) {
    renderGroups.push({ title: "🔴 PENDING BACKLOG (DELAYED JOBS)", jobs: backlogJobs, style: "background-color: #FEE2E2 !important; color: #991B1B; border-bottom: 2px solid #FCA5A5;" });
  }
  
  for (var d = 0; d < uniqueDates.length; d++) {
    var dStr = uniqueDates[d];
    var jobs = jobsByDate[dStr];
    
    // Sort group by Dispatch Date
    jobs.sort(function(a, b) {
      var jcA = a[1] ? a[1].toString() : "";
      var jcB = b[1] ? b[1].toString() : "";
      var da = parseDateValue(dbDateMap[jcA]);
      var db = parseDateValue(dbDateMap[jcB]);
      return da - db;
    });
    
    var dayTitle = "📅 " + dStr;
    var checkDate = new Date(jobs[0][24]);
    if (checkDate.getTime() === today.getTime()) dayTitle += " (Today)";
    else if (checkDate.getTime() === today.getTime() + (24 * 60 * 60 * 1000)) dayTitle += " (Tomorrow)";
    renderGroups.push({ title: dayTitle, jobs: jobs, style: "" });
  }
  
  // Render table
  for (var g = 0; g < renderGroups.length; g++) {
    var group = renderGroups[g];
    var styleAttr = group.style ? " style='" + group.style + "'" : "";
    htmlStr += "<tr><td colspan='" + headers.length + "' class='day-header'" + styleAttr + ">" + group.title + "</td></tr>";
    
    var jobs = group.jobs;
    for (var j = 0; j < jobs.length; j++) {
      var job = jobs[j];
      // Tracker Index Mapping:
      // 1=JobCard, 3=Target Delivery Date (Dispatch Date), 4=JobName, 5=Customer Name
      // 11=Flute, 12=ReelSize, 13=CutSize
      
      var dispatchDateStr = "";
      var jcNum = job[1] ? job[1].toString() : "";
      var dbDispatchDate = dbDateMap[jcNum] || "";
      
      if (dbDispatchDate) {
        if (dbDispatchDate instanceof Date) {
          dispatchDateStr = Utilities.formatDate(dbDispatchDate, Session.getScriptTimeZone(), "dd-MMM-yyyy");
        } else if (typeof dbDispatchDate === "string") {
          var str = dbDispatchDate.replace(/^'/, ""); // remove prefix if any
          var parts = str.split("/");
          if (parts.length === 3) {
            // assuming dd/mm/yyyy
            var pD = new Date(parts[2], parts[1] - 1, parts[0]);
            if (!isNaN(pD.getTime())) {
              dispatchDateStr = Utilities.formatDate(pD, Session.getScriptTimeZone(), "dd-MMM-yyyy");
            } else {
              dispatchDateStr = str;
            }
          } else {
            dispatchDateStr = str;
          }
        } else {
          dispatchDateStr = dbDispatchDate.toString();
        }
      }
      
      var reelSize = job[12] || "";
      var cutSize = job[13] || "";
      var reelCutStr = (reelSize && cutSize) ? (reelSize + " x " + cutSize) : (reelSize || cutSize);
      
      htmlStr += "<tr>" +
        "<td>" + (job[1] || "") + "</td>" +
        "<td>" + (job[4] || "") + "</td>" +
        "<td>" + (job[6] || "") + "</td>" +
        "<td>" + (job[11] || "") + "</td>" +
        "<td>" + reelCutStr + "</td>" +
        "<td>" + (job[14] || "") + "</td>" +
        "<td>" + dispatchDateStr + "</td>" +
        "<td>" + (job[23] || "") + "</td>" +
        "</tr>";
    }
  }
  
  if (renderGroups.length === 0) {
    htmlStr += "<tr><td colspan='" + headers.length + "' style='text-align:center; color:#6B7280; font-style:italic; padding:15px;'>No upcoming plans found.</td></tr>";
  }
  
  htmlStr += "</table></body></html>";
  
  var htmlOutput = HtmlService.createHtmlOutput(htmlStr)
      .setWidth(950)
      .setHeight(650);
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, "Corrugation Plan");
}

// -------------------------------------------------------------
// REFRESH TRACKER DATA
// -------------------------------------------------------------

function refreshTrackerData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var trackerSheet = ss.getSheetByName("5. Tracker");
  var masterSheet = ss.getSheetByName("3. Master Data");
  
  if (!trackerSheet || !masterSheet) {
    SpreadsheetApp.getUi().alert("Tracker or Master Data sheet missing.");
    return;
  }
  
  var lastRow = trackerSheet.getLastRow();
  if (lastRow <= 1) {
    SpreadsheetApp.getUi().alert("Tracker is empty.");
    return;
  }
  
  var trackerData = trackerSheet.getRange(2, 1, lastRow - 1, 25).getValues();
  var masterData = masterSheet.getDataRange().getValues();
  
  var updatesL = [];
  var updatesV = [];
  var updatesY = [];
  var updatesA = [];
  var updatesS = [];
  var updatesU = [];
  
  for (var i = 0; i < trackerData.length; i++) {
    var row = trackerData[i];
    var rowIndex = i + 2;
    var jobCardNo = row[1]; // Column B is Job Card No, or maybe we just want serial number?
    var itemName = row[4]; // Job Name
    
    // Column A is likely Serial No (1, 2, 3...) based on row
    updatesA.push([i + 1]);
    
    // Column S (Wastage) and U (Balance Qty)
    var corrugation = parseFloat(row[16]) || 0; // Q
    var finishGoods = parseFloat(row[17]) || 0; // R
    var dispatchQty = parseFloat(row[19]) || 0; // T
    
    var wastage = "";
    if (corrugation > 0) {
      wastage = (corrugation - finishGoods) / corrugation;
    }
    updatesS.push([wastage]);
    
    var balanceQty = finishGoods - dispatchQty;
    updatesU.push([balanceQty]);
    
    // Determine Flute
    var flute = row[11]; // Existing flute or PENDING AT
    for (var m = 1; m < masterData.length; m++) {
      if (masterData[m][2] == itemName) {
        flute = masterData[m][10];
        break;
      }
    }
    updatesL.push([flute]);
    
    // Determine Corrugation Plan Date (Static Value)
    var targetDate = row[3]; // Column D (index 3)
    var corrDateVal = "";
    var tDate2 = null;
    if (targetDate) {
      var tDate = new Date(targetDate);
      if (isNaN(tDate.getTime()) && typeof targetDate === "string") {
         var parts = targetDate.replace(/^'/, "").split("/");
         if (parts.length === 3) tDate = new Date(parts[2], parts[1]-1, parts[0]);
      }
      if (!isNaN(tDate.getTime())) {
        tDate.setDate(tDate.getDate() - 3);
        tDate2 = new Date(tDate.getTime());
        corrDateVal = "'" + Utilities.formatDate(tDate, Session.getScriptTimeZone(), "dd/MM/yyyy");
      }
    }
    updatesY.push([corrDateVal]);
    
    // Determine Delivery Status based on Corrugation Plan Date
    var deliveryStatus = "";
    if (tDate2 && !isNaN(tDate2.getTime())) {
      var today = new Date();
      today.setHours(0, 0, 0, 0);
      tDate2.setHours(0, 0, 0, 0);
      
      if (today <= tDate2) {
        deliveryStatus = "ON-TIME";
      } else {
        var diffTime = Math.abs(today - tDate2);
        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        deliveryStatus = diffDays + " DAY DELAY";
      }
    }
    updatesV.push([deliveryStatus]);
  }
  
  trackerSheet.getRange(2, 1, updatesA.length, 1).setValues(updatesA);  // Col A (1)
  trackerSheet.getRange(2, 12, updatesL.length, 1).setValues(updatesL); // Col L (12)
  trackerSheet.getRange(2, 19, updatesS.length, 1).setValues(updatesS).setNumberFormat("0.00%"); // Col S (19)
  trackerSheet.getRange(2, 21, updatesU.length, 1).setValues(updatesU); // Col U (21)
  trackerSheet.getRange(2, 22, updatesV.length, 1).setValues(updatesV); // Col V (22)
  trackerSheet.getRange(2, 25, updatesY.length, 1).setValues(updatesY); // Col Y (25) as Values
  
  sortTracker();
  sortDatabase();
  
  SpreadsheetApp.getUi().alert("✅ Tracker Refreshed!", "Flute data and Corrugation dates have been updated for all jobs, and Tracker has been sorted.", SpreadsheetApp.getUi().ButtonSet.OK);
}

// -------------------------------------------------------------
// HELPER: DATE PARSER FOR SORTING
// -------------------------------------------------------------
function parseDateValue(val) {
  if (!val) return Number.MAX_SAFE_INTEGER; // Push empty to bottom
  if (val instanceof Date) return val.getTime();
  
  var str = val.toString().replace(/^'/, "").trim();
  if (!str) return Number.MAX_SAFE_INTEGER;
  
  // Format: dd/mm/yyyy
  if (str.indexOf("/") !== -1) {
    var p = str.split("/");
    if (p.length === 3) return new Date(p[2], p[1] - 1, p[0]).getTime();
  }
  
  // Format: dd-MMM-yyyy
  if (str.indexOf("-") !== -1) {
    var p = str.split("-");
    if (p.length === 3) {
      var monthMap = {"Jan":0,"Feb":1,"Mar":2,"Apr":3,"May":4,"Jun":5,"Jul":6,"Aug":7,"Sep":8,"Oct":9,"Nov":10,"Dec":11};
      var m = monthMap[p[1]];
      if (m !== undefined) return new Date(p[2], m, p[0]).getTime();
    }
  }
  
  var d = new Date(str);
  if (!isNaN(d.getTime())) return d.getTime();
  
  return Number.MAX_SAFE_INTEGER;
}
