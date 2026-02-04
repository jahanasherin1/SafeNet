# Filter crime data for women's safety crimes only
$inputFile = "c:\Users\ADMIN\Documents\SafeNet\backend\crime-data-coordinates.csv"
$outputFile = "c:\Users\ADMIN\Documents\SafeNet\backend\crime-data-coordinates.csv"

# Women safety related crime types
$womenSafetyCrimes = @(
    "Rape",
    "Sexual harassment",
    "Molestation",
    "Cruelty by husband or relatives",
    "Dowry Deaths(304(B) IPC)",
    "Kidnapping & abduction - of women & girls",
    "Dowry Prohibition Act",
    "Immoral Traffic (P) Act",
    "Indecent representation of women Act",
    "Murder",
    "Attempt to commit murder"
)

Write-Host "Reading crime data..."
$data = Import-Csv $inputFile

Write-Host "Filtering for women's safety crimes..."
$filtered = $data | Where-Object { $womenSafetyCrimes -contains $_.Crime_Type }

Write-Host "Total records before filtering: $($data.Count)"
Write-Host "Total records after filtering: $($filtered.Count)"

Write-Host "Exporting filtered data..."
$filtered | Export-Csv $outputFile -NoTypeInformation

Write-Host "✅ Women's safety crime data exported successfully!"
Write-Host "File saved: $outputFile"

# Show summary
$crimeSummary = $filtered | Group-Object Crime_Type | Select-Object Name, Count | Sort-Object Count -Descending
Write-Host "`nCrime Type Summary:"
$crimeSummary | Format-Table -AutoSize
