$content = Get-Content d:\ca\Antigravity\Packwell_India_ERP\PACKWELL_FINAL_CODE.gs -Raw -Encoding UTF8

# Clean Menu Items
$content = $content -replace "ui\.createMenu\('.*?Packwell ERP'\)", "ui.createMenu('Packwell ERP')"
$content = $content -replace "\.addItem\('.*?Check & Allocate Reels'", ".addItem('Check & Allocate Reels'"
$content = $content -replace "\.addItem\('.*?Check Pending Job Cards'", ".addItem('Check Pending Job Cards'"
$content = $content -replace "\.addItem\('.*?Refresh Tracker Data'", ".addItem('Refresh Tracker Data'"
$content = $content -replace "\.addItem\('.*?View Production Report'", ".addItem('View Production Report'"

# Remove Smart Reel Entry menu items
$content = $content -replace "(?m)^\s*\.addItem\('Submit Smart Reel Entry', 'submitSmartReelData'\)\s*\r?\n?", ""
$content = $content -replace "(?m)^\s*\.addItem\('Clean Smart Reel Sheet', 'cleanSmartReelSheet'\)\s*\r?\n?", ""

# Clean Headings
$content = $content -replace 'setValue\(".*?ORDER DETAILS"\)', 'setValue("--- ORDER DETAILS ---")'
$content = $content -replace 'setValue\(".*?PAPER SPECIFICATIONS"\)', 'setValue("--- PAPER SPECIFICATIONS ---")'
$content = $content -replace 'setValue\(".*?PRODUCTION SUMMARY"\)', 'setValue("--- PRODUCTION SUMMARY ---")'
$content = $content -replace 'setValue\(".*?DEPARTMENT PRODUCTION & SIGNATURES"\)', 'setValue("--- DEPARTMENT PRODUCTION & SIGNATURES ---")'
$content = $content -replace 'setValue\(".*?GENERAL INFO"\)', 'setValue("--- GENERAL INFO ---")'
$content = $content -replace 'setValue\(".*?FINISHING DETAILS"\)', 'setValue("--- FINISHING DETAILS ---")'
$content = $content -replace 'setValue\(".*?REEL ALLOCATION SUMMARY"\)', 'setValue("--- REEL ALLOCATION SUMMARY ---")'

# Clean Alerts (Regex to catch the corrupted emojis)
$content = $content -replace 'alert\(".*?LAJAWAB!', 'alert("SUCCESS: LAJAWAB!'
$content = $content -replace 'alert\(".*?Please select a Job Card', 'alert("WARNING: Please select a Job Card'
$content = $content -replace 'alert\(".*?Job Card " \+ searchJobCancel \+ " has been Cancelled', 'alert("SUCCESS: Job Card " + searchJobCancel + " has been Cancelled'
$content = $content -replace 'alert\(".*?Job Card not found', 'alert("WARNING: Job Card not found'
$content = $content -replace 'alert\(".*?Validation Error', 'alert("WARNING: Validation Error'
$content = $content -replace 'message = ".*?Job Card Updated', 'message = "SUCCESS: Job Card Updated'
$content = $content -replace 'message = ".*?New Job Card Generated', 'message = "SUCCESS: New Job Card Generated'
$content = $content -replace 'alert\(message \+ "\\n\\n.*?Error generating PDF. Check authorization', 'alert(message + "\n\nERROR: Error generating PDF. Check authorization'
$content = $content -replace 'alert\(message \+ "\\n\\n.*?Error generating PDF: " \+ e\.message \+ "\\n\\nPlease', 'alert(message + "\n\nERROR: Error generating PDF: " + e.message + "\n\nPlease'
$content = $content -replace 'alert\(".*?Master Item Updated', 'alert("SUCCESS: Master Item Updated'
$content = $content -replace 'alert\(".*?New Master Item Saved', 'alert("SUCCESS: New Master Item Saved'

# Clean HTML link
$content = $content -replace '.*?Open / Print PDF \(A4\)</a>', 'Open / Print PDF (A4)</a>'

# Now to remove functions. We will use a more precise regex.
# Remove cleanSmartReelSheet
$content = $content -replace "(?ms)^function cleanSmartReelSheet\(\) \{.*?\n  \}\s*\n", "`n"

# Remove submitSmartReelData
$content = $content -replace "(?ms)^function submitSmartReelData\(\) \{.*?\n      \}\s*\n    \}\s*\n  \}\s*\n", "`n"

# The above regex for submitSmartReelData might be tricky because of nested blocks. Let's just find the index.
