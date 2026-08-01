$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open('d:\ca\Antigravity\Packwell_India_ERP\Job Card JUNE 2026.xlsx')
$sheet = $workbook.Sheets.Item('Job Card')
$formula = $sheet.Range('H5').Formula
$value = $sheet.Range('H5').Value2
Write-Output "Formula in H5:"
Write-Output $formula
Write-Output "Value:"
Write-Output $value
$workbook.Close($false)
$excel.Quit()
