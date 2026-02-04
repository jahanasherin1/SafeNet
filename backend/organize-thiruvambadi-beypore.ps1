# Organize thiruvambadi and beypore data
$inputFile = "c:\Users\ADMIN\Documents\SafeNet\backend\crime-data-coordinates.csv"

# Coordinates for these locations (Kerala)
$locations = @{
    "thiruvambadi" = @{ Latitude = "11.2500"; Longitude = "75.7667" }
    "beypore" = @{ Latitude = "11.1700"; Longitude = "75.8167" }
}

# Women safety related crime types
$womenSafetyCrimes = @(
    "Rape",
    "Sexual harassment",
    "Molestation",
    "Cruelty by husband or relatives",
    "Dowry Deaths(304(B) IPC)",
    "Kidnapping & abduction - of women & girls",
    "Murder",
    "Attempt to commit murder"
)

# Thiruvambadi data (2014-2025)
$thiruvambadiData = @(
    @("Sexual harassment", @(0,0,0,0,0,0,1,0,0,0,0,0)),
    @("Kidnapping & abduction - of women & girls", @(0,0,0,0,0,0,0,0,0,0,0,0)),
    @("Molestation", @(6,4,0,3,1,2,7,0,6,4,5,0)),
    @("Dowry Deaths(304(B) IPC)", @(0,0,0,0,0,0,0,0,0,0,0,0)),
    @("Rape", @(0,0,0,2,1,1,2,0,3,4,2,0)),
    @("Attempt to commit murder", @(0,2,1,0,0,0,0,0,1,0,4,6)),
    @("Cruelty by husband or relatives", @(5,4,3,4,1,2,2,5,11,4,12,10)),
    @("Murder", @(1,0,0,0,0,3,0,0,0,0,1,1))
)

# Beypore data (2014-2024, note: 2015-2016 missing)
$beyporeData = @(
    @("Cruelty by husband or relatives", @(12,0,0,7,7,6,1,10,20,0,0)),
    @("Attempt to commit murder", @(0,0,0,0,0,0,0,0,7,4,4)),
    @("Kidnapping & abduction - of women & girls", @(0,0,0,1,0,0,0,0,1,0,0)),
    @("Sexual harassment", @(0,0,0,0,0,0,1,0,0,0,0)),
    @("Murder", @(0,0,0,0,1,0,0,0,0,0,0)),
    @("Molestation", @(0,0,0,4,0,10,2,3,6,0,0)),
    @("Rape", @(0,0,0,1,2,3,1,1,4,2,0)),
    @("Dowry Deaths(304(B) IPC)", @(0,0,0,0,0,0,0,0,0,0,0))
)

Write-Host "Reading existing data..." -ForegroundColor Cyan
$existingData = Get-Content $inputFile | Where-Object { $_ -notmatch "thiruvambadi|beypore|Crime Head" -and $_.Trim() }

Write-Host "Generating new data for thiruvambadi and beypore..." -ForegroundColor Cyan
$newRecords = @()

# Process thiruvambadi
$city = "Thiruvambadi"
$lat = $locations["thiruvambadi"].Latitude
$lng = $locations["thiruvambadi"].Longitude
$years = 2014..2025

foreach ($crimeData in $thiruvambadiData) {
    $crimeType = $crimeData[0]
    $counts = $crimeData[1]
    
    for ($i = 0; $i -lt $counts.Length; $i++) {
        $year = $years[$i]
        $count = $counts[$i]
        $newRecords += "`"$city`",`"$lat`",`"$lng`",`"$crimeType`",`"$year`",`"$count`""
    }
}

# Process beypore
$city = "Beypore"
$lat = $locations["beypore"].Latitude
$lng = $locations["beypore"].Longitude
$beyporeYears = @(2014,2017,2018,2019,2020,2021,2022,2023,2024)

foreach ($crimeData in $beyporeData) {
    $crimeType = $crimeData[0]
    $counts = $crimeData[1]
    
    for ($i = 0; $i -lt $counts.Length; $i++) {
        $year = $beyporeYears[$i]
        $count = $counts[$i]
        $newRecords += "`"$city`",`"$lat`",`"$lng`",`"$crimeType`",`"$year`",`"$count`""
    }
}

Write-Host "Writing organized data..." -ForegroundColor Cyan
$existingData + $newRecords | Set-Content $inputFile

Write-Host "`n✅ Successfully organized data!" -ForegroundColor Green
Write-Host "Added $($newRecords.Count) records for Thiruvambadi and Beypore" -ForegroundColor Yellow
