$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open('d:\ca\Antigravity\Packwell_India_ERP\Job Card JUNE 2026.xlsx')
$sheet = $workbook.Sheets.Item('Job Card')
Write-Output "G5: "
Write-Output $sheet.Range('G5').Value2
Write-Output "H4: "
Write-Output $sheet.Range('H4').Value2
Write-Output "G4: "
Write-Output $sheet.Range('G4').Value2
$workbook.Close($false)
$excel.Quit()
