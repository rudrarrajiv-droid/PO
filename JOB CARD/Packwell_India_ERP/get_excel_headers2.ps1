$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$workbook = $excel.Workbooks.Open('d:\ca\Antigravity\Packwell_India_ERP\Job Card JUNE 2026.xlsx')
$sheet = $workbook.Sheets.Item('Job Card')

Write-Output "C5:D12 Range:"
for ($row = 5; $row -le 12; $row++) {
    $c = $sheet.Cells.Item($row, 3).Value2
    $d = $sheet.Cells.Item($row, 4).Value2
    Write-Output "Row $row : C='$c' D='$d'"
}

Write-Output "G8:H12 Range:"
for ($row = 8; $row -le 12; $row++) {
    $g = $sheet.Cells.Item($row, 7).Value2
    $h = $sheet.Cells.Item($row, 8).Value2
    Write-Output "Row $row : G='$g' H='$h'"
}

$workbook.Close($false)
$excel.Quit()
