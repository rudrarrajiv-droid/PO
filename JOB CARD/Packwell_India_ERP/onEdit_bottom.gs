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
}

