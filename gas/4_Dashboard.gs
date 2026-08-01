/**
 * 4_Dashboard.gs
 * Handles Dashboard matrix, rollover logic, delay tracking, 
 * charting data, and Priority Tracking Report.
 */

var Dashboard = {
  
  // Adds or updates a Plan entry in the dashboard
  addToPlan: function(customer, itemName, poNumber, planQty) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dashboard");
    if (!sheet) return;
    
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == customer && data[i][1] == itemName && data[i][2] == poNumber) {
        rowIndex = i + 1;
        break;
      }
    }
    
    if (rowIndex === -1) {
      sheet.appendRow([customer, itemName, poNumber, planQty, 0, ""]);
    } else {
      var currentPlan = parseFloat(sheet.getRange(rowIndex, 4).getValue()) || 0;
      sheet.getRange(rowIndex, 4).setValue(currentPlan + planQty);
    }
  },
  
  // Adds to Dispatch Total in Dashboard
  addDispatch: function(customer, itemName, poNumber, dispatchQty) {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Dashboard");
    if (!sheet) return;
    
    var data = sheet.getDataRange().getValues();
    var rowIndex = -1;
    for (var i = 1; i < data.length; i++) {
      if (data[i][0] == customer && data[i][1] == itemName && data[i][2] == poNumber) {
        rowIndex = i + 1;
        break;
      }
    }
    if (rowIndex !== -1) {
      var currentDisp = parseFloat(sheet.getRange(rowIndex, 5).getValue()) || 0;
      sheet.getRange(rowIndex, 5).setValue(currentDisp + dispatchQty);
    }
  },
  
  // calculateRollover has been deprecated to prevent destructive edits to Priority_PO_DB.
  // Smart quantity adjustments are now calculated dynamically in getPriorityTrackingReport.
  calculateRollover: function() {
    return true; 
  }
};

/**
 * Exposes Dashboard data to the Web App (Phase 2 & 3)
 */
function getWebAppDashboardData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var response = {
    kpis: { totalValue: 0, totalCustomers: 0, dispatchRatio: 0 },
    alerts: [],
    delays: [],
    chartData: {
      labels: [],
      openPoValues: [],
      dispatchRatioData: [0, 0] // [Dispatched, Pending]
    }
  };
  
  try {
    var openPoDb = ss.getSheetByName("Open_PO_DB");
    var dashboardDb = ss.getSheetByName("Dashboard");
    
    // KPI & Charts
    if (openPoDb) {
      var poData = openPoDb.getDataRange().getValues();
      var uniqueCustomers = new Set();
      var custMap = {}; // for chart
      
      for (var i = 1; i < poData.length; i++) {
        var cName = poData[i][1].toString().trim();
        var qty = parseFloat(poData[i][9]) || 0;
        var rate = parseFloat(poData[i][8]) || 0;
        var val = qty * rate;
        
        response.kpis.totalValue += val;
        if (cName) {
          uniqueCustomers.add(cName);
          custMap[cName] = (custMap[cName] || 0) + val;
        }
      }
      response.kpis.totalCustomers = uniqueCustomers.size;
      
      // Populate bar chart data (Top 5 customers by value)
      var sortedCust = Object.keys(custMap).sort(function(a,b){return custMap[b]-custMap[a]}).slice(0,5);
      response.chartData.labels = sortedCust;
      sortedCust.forEach(function(c) {
        response.chartData.openPoValues.push(custMap[c]);
      });
    }
    
    if (dashboardDb) {
      var dashData = dashboardDb.getDataRange().getValues();
      var overallPlan = 0;
      var overallDisp = 0;
      
      for (var i = 1; i < dashData.length; i++) {
        var plan = parseFloat(dashData[i][3]) || 0;
        var disp = parseFloat(dashData[i][4]) || 0;
        overallPlan += plan;
        overallDisp += disp;
        
        var status = (disp >= plan && plan > 0) ? "Completed" : (plan > 0 ? "Pending" : "No Plan");
        response.delays.push({
          customer: dashData[i][0],
          po: dashData[i][2],
          item: dashData[i][1],
          plan: plan,
          disp: disp,
          status: status
        });
      }
      
      if (overallPlan > 0) {
        response.kpis.dispatchRatio = Math.round((overallDisp / overallPlan) * 100);
        response.chartData.dispatchRatioData = [overallDisp, Math.max(0, overallPlan - overallDisp)];
      }
    }
    
    // Alerts (Tomorrow) - Dynamically read from Active priorities
    var priDb = ss.getSheetByName("Priority_PO_DB");
    if (priDb) {
      var priData = priDb.getDataRange().getValues();
      var headers = priData[0];
      var statusCol = headers.indexOf("Status");
      
      var tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      var tomorrowStr = Utilities.formatDate(tomorrow, Session.getScriptTimeZone(), "yyyy-MM-dd");
      var tomColIndex = headers.indexOf(tomorrowStr);
      
      if (tomColIndex > -1 && statusCol > -1) {
        for (var i = 1; i < priData.length; i++) {
          if (priData[i][statusCol] === "Active") {
            var qty = parseFloat(priData[i][tomColIndex]) || 0;
            if (qty > 0) {
              response.alerts.push({
                customer: priData[i][1],
                po: priData[i][3],
                item: priData[i][7],
                qty: qty
              });
            }
          }
        }
      }
    }
  } catch(e) { Logger.log(e.toString()); }
  return response;
}

/**
 * Exposes Master Search Data (Phase 2)
 */
function masterSearch(query) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dispatchDb = ss.getSheetByName("Dispatch_DB");
  var results = [];
  query = query.toString().toLowerCase();
  
  if (dispatchDb) {
    var data = dispatchDb.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      var poNo = data[i][6] ? data[i][6].toString().toLowerCase() : "";
      var cust = data[i][3] ? data[i][3].toString().toLowerCase() : "";
      var item = data[i][5] ? data[i][5].toString().toLowerCase() : "";
      var invNo = data[i][1] ? data[i][1].toString().toLowerCase() : "";
      
      if (poNo.indexOf(query) > -1 || cust.indexOf(query) > -1 || item.indexOf(query) > -1 || invNo.indexOf(query) > -1) {
        results.push({
          invoiceNo: data[i][1],
          date: data[i][2] instanceof Date ? Utilities.formatDate(data[i][2], Session.getScriptTimeZone(), "yyyy-MM-dd") : data[i][2],
          customer: data[i][3],
          item: data[i][5],
          po: data[i][6],
          qty: data[i][7],
          transporter: data[i][8],
          vehicle: data[i][10],
          freight: data[i][12]
        });
      }
    }
  }
  return results;
}

/**
 * Gets unique Priority Entry Dates for a given PO (Phase 3)
 */
function getPriorityDatesForPO(poNumber) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var priDb = ss.getSheetByName("Priority_PO_DB");
  var dates = [];
  if (priDb) {
    var data = priDb.getDataRange().getValues();
    for (var i = 1; i < data.length; i++) {
      if (data[i][3] == poNumber) {
        var rawDate = data[i][4]; // Priority Date column
        var dateStr = rawDate instanceof Date ? Utilities.formatDate(rawDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : rawDate.toString();
        if (dateStr && dates.indexOf(dateStr) === -1) {
          dates.push(dateStr);
        }
      }
    }
  }
  // Sort descending
  dates.sort(function(a, b) { return new Date(b) - new Date(a); });
  return dates;
}

/**
 * Generates the Priority Tracking Report with Smart Rollover (Phase 4)
 */
function getPriorityTrackingReport(poNumber, priorityDateStr) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var priDb = ss.getSheetByName("Priority_PO_DB");
  var dispDb = ss.getSheetByName("Dispatch_DB");
  
  if (!priDb || !dispDb) return { error: "Databases missing" };
  
  var priData = priDb.getDataRange().getValues();
  var priHeaders = priData[0];
  var dispData = dispDb.getDataRange().getValues();
  
  // itemsMap[itemName] = { dates: { '2023-10-01': planQty }, dispatchObj: { '2023-10-01': dispQty } }
  var itemsMap = {}; 
  
  for (var i = 1; i < priData.length; i++) {
    var rowPo = priData[i][3];
    var rowDate = priData[i][4] instanceof Date ? Utilities.formatDate(priData[i][4], Session.getScriptTimeZone(), "yyyy-MM-dd") : priData[i][4].toString();
    var status = priData[i][priHeaders.indexOf("Status")];
    
    // Match PO and Date. We can report on inactive history too if requested!
    if (rowPo == poNumber && rowDate == priorityDateStr) {
      var item = priData[i][7];
      if (!itemsMap[item]) {
        itemsMap[item] = { dates: {}, dispatchObj: {} };
      }
      
      // Get all plan dates from column 9 onwards (since Status is 8)
      var startCol = priHeaders.indexOf("Status") > -1 ? priHeaders.indexOf("Status") + 1 : 8;
      for (var c = startCol; c < priHeaders.length; c++) {
        var qty = parseFloat(priData[i][c]) || 0;
        if (qty > 0) {
          var planDate = priHeaders[c];
          itemsMap[item].dates[planDate] = qty;
        }
      }
    }
  }
  
  // Aggregate dispatches from the DispDb from priorityDateStr onwards
  var targetDateObj = new Date(priorityDateStr);
  
  for (var i = 1; i < dispData.length; i++) {
    if (dispData[i][6] == poNumber) {
      var item = dispData[i][5];
      var dRawDate = dispData[i][2];
      var dDate = new Date(dRawDate);
      var dDateStr = dRawDate instanceof Date ? Utilities.formatDate(dRawDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : dRawDate.toString();
      
      // Only count dispatches that occurred on or after the priority plan was made
      if (itemsMap[item] && dDate >= targetDateObj) {
        var qty = parseFloat(dispData[i][7]) || 0;
        itemsMap[item].dispatchObj[dDateStr] = (itemsMap[item].dispatchObj[dDateStr] || 0) + qty;
      }
    }
  }
  
  // Calculate Smart Adjustments (Carry forwards and Adjustments)
  var reportArray = [];
  
  for (var item in itemsMap) {
    var row = {
      itemName: item,
      totalPlan: 0,
      totalDisp: 0,
      balance: 0,
      details: []
    };
    
    // Sort all dates chronologically
    var allDatesSet = new Set([...Object.keys(itemsMap[item].dates), ...Object.keys(itemsMap[item].dispatchObj)]);
    var sortedDates = Array.from(allDatesSet).sort(function(a,b){return new Date(a)-new Date(b)});
    
    var carryForward = 0;
    
    sortedDates.forEach(d => {
      var origPlan = itemsMap[item].dates[d] || 0;
      var disp = itemsMap[item].dispatchObj[d] || 0;
      
      row.totalPlan += origPlan;
      row.totalDisp += disp;
      
      // Smart Quantity Adjustment Logic:
      // Adjusted Plan = Original Plan + Carry Forward from previous days
      var adjustedPlan = Math.max(0, origPlan + carryForward);
      
      // New Carry Forward = (Adjusted Plan - Dispatch)
      // If Dispatch > Adjusted Plan, carryForward becomes negative, 
      // which automatically reduces the next day's adjusted plan!
      carryForward = adjustedPlan - disp;
      
      row.details.push({
        date: d,
        originalPlan: origPlan,
        adjustedPlan: adjustedPlan, // What they actually needed to dispatch today
        disp: disp,
        variance: disp - adjustedPlan // Over or under dispatch for the day
      });
    });
    
    row.balance = row.totalPlan - row.totalDisp;
    reportArray.push(row);
  }
  
  return {
    poNumber: poNumber,
    priorityDate: priorityDateStr,
    items: reportArray
  };
}
