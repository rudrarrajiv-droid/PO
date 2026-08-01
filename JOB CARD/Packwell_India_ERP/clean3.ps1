$content = Get-Content d:\ca\Antigravity\Packwell_India_ERP\PACKWELL_FINAL_CODE.gs -Raw -Encoding UTF8

$start = $content.IndexOf("function submitSmartReelData")
if ($start -gt -1) {
    $end = $content.IndexOf("function showProductionReport", $start)
    if ($end -gt -1) {
        $content = $content.Substring(0, $start) + $content.Substring($end)
    }
}

$content | Out-File -FilePath d:\ca\Antigravity\Packwell_India_ERP\PACKWELL_FINAL_CODE.gs -Encoding UTF8
Write-Output "Removed submitSmartReelData."
