
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
