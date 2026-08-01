$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open('d:\ca\Antigravity\Packwell_India_ERP\Job Card JUNE 2026.xlsx')
$sheet = $workbook.Sheets.Item('Job Card')
Write-Output "D6 Header: "
Write-Output $sheet.Range('C6').Value2
Write-Output "H9 Header: "
Write-Output $sheet.Range('G9').Value2
Write-Output "D10 Header: "
Write-Output $sheet.Range('C10').Value2
Write-Output "D6: "
Write-Output $sheet.Range('D6').Value2
Write-Output "H9: "
Write-Output $sheet.Range('H9').Value2
Write-Output "D10: "
Write-Output $sheet.Range('D10').Value2
$workbook.Close($false)
$excel.Quit()
