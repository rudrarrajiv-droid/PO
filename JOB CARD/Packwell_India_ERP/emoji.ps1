$content = Get-Content d:\ca\Antigravity\Packwell_India_ERP\PACKWELL_FINAL_CODE.gs -Raw -Encoding UTF8

$content = $content.Replace("ui.createMenu('Packwell ERP')", "ui.createMenu('📦 Packwell ERP')")
$content = $content.Replace(".addItem('1. Setup ERP Workspace'", ".addItem('🚀 1. Setup ERP Workspace'")
$content = $content.Replace(".addItem('Generate Job Card (PDF & Save)'", ".addItem('🖨️ Generate Job Card (PDF & Save)'")
$content = $content.Replace(".addItem('Check & Allocate Reels'", ".addItem('🔍 Check & Allocate Reels'")
$content = $content.Replace(".addItem('Check Pending Job Cards'", ".addItem('⏳ Check Pending Job Cards'")
$content = $content.Replace(".addItem('Save New Master Item'", ".addItem('💾 Save New Master Item'")
$content = $content.Replace(".addItem('Refresh Tracker Data'", ".addItem('🔄 Refresh Tracker Data'")
$content = $content.Replace(".addItem('View Production Report'", ".addItem('📊 View Production Report'")

$content = $content.Replace('setValue("PACKWELL INDIA - EXECUTIVE DASHBOARD")', 'setValue("🏢 PACKWELL INDIA - EXECUTIVE DASHBOARD")')
$content = $content.Replace('setValue("--- ORDER DETAILS ---")', 'setValue("📋 ORDER DETAILS")')
$content = $content.Replace('setValue("--- PAPER SPECIFICATIONS ---")', 'setValue("📄 PAPER SPECIFICATIONS")')
$content = $content.Replace('setValue("--- PRODUCTION SUMMARY ---")', 'setValue("🏭 PRODUCTION SUMMARY")')
$content = $content.Replace('setValue("--- DEPARTMENT PRODUCTION & SIGNATURES ---")', 'setValue("👨‍🔧 DEPARTMENT PRODUCTION & SIGNATURES")')
$content = $content.Replace('setValue("--- GENERAL INFO ---")', 'setValue("ℹ️ GENERAL INFO")')
$content = $content.Replace('setValue("--- FINISHING DETAILS ---")', 'setValue("✂️ FINISHING DETAILS")')
$content = $content.Replace('setValue("--- REEL ALLOCATION SUMMARY ---")', 'setValue("📦 REEL ALLOCATION SUMMARY")')
$content = $content.Replace('setValue("PACKWELL INDIA - JOB CARD")', 'setValue("📋 PACKWELL INDIA - JOB CARD")')
$content = $content.Replace('setValue("ADD NEW ITEM TO MASTER DATA")', 'setValue("🆕 ADD NEW ITEM TO MASTER DATA")')

$content | Out-File -FilePath d:\ca\Antigravity\Packwell_India_ERP\PACKWELL_FINAL_CODE.gs -Encoding UTF8
Write-Output "Replaced with emojis"
