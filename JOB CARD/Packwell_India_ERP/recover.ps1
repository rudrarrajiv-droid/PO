$logPath = "C:\Users\91999\.gemini\antigravity-ide\brain\a158a523-b054-4ad2-b396-85545b5262d9\.system_generated\logs\transcript_full.jsonl"
$targetPath = "d:\ca\Antigravity\Packwell_India_ERP\Recovered_ERP_Code.gs"

$lines = Get-Content $logPath
$fullCode = $null

foreach ($line in $lines) {
    if ($line -match "@@ -1,1153 \+1,1 @@") {
        $obj = $line | ConvertFrom-Json
        $content = $obj.content
        if ($content -match '\[diff_block_start\]') {
            $codeLines = $content -split "`n"
            $recording = $false
            $recovered = @()
            foreach ($cl in $codeLines) {
                if ($cl -match '^@@') {
                    $recording = $true
                    continue
                }
                if ($cl -match '^\[diff_block_end\]') {
                    $recording = $false
                }
                if ($recording) {
                    if ($cl.StartsWith("-")) {
                        $recovered += $cl.Substring(1)
                    }
                }
            }
            if ($recovered.Length -gt 100) {
                $fullCode = $recovered -join "`r`n"
                # Keep going to find the LATEST occurrence
            }
        }
    }
}

if ($fullCode) {
    Set-Content -Path $targetPath -Value $fullCode -Encoding UTF8
    Write-Output "Successfully recovered $($fullCode.Length) characters!"
} else {
    Write-Output "Could not find the original code."
}
