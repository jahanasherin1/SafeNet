$body = @{
    userEmail = "aidhin@gmail.com"
    userName = "Test User"
    location = @{latitude = 10.5; longitude = 75.5}
    reason = "Test Alert"
    alertType = "ACTIVITY_MONITOR"
    timestamp = "2026-02-04T10:00:00Z"
} | ConvertTo-Json

Write-Host "Sending alert request..."
Write-Host "Body: $body"

try {
    $response = Invoke-WebRequest -Uri "http://172.20.10.4:5000/api/sos/trigger" `
        -Method POST `
        -ContentType "application/json" `
        -Body $body `
        -TimeoutSec 10
    
    Write-Host "Status: $($response.StatusCode)"
    Write-Host "Response: $($response.Content)"
} catch {
    Write-Host "Error: $($_.Exception.Message)"
    Write-Host "Full error: $_"
}
