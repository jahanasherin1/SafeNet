# Background Activity Monitoring Test Script
# This script helps you verify that activity monitoring works when app is minimized/locked

Write-Host "`n🧪 SafeNet Background Activity Monitoring Test" -ForegroundColor Cyan
Write-Host "=" * 60 -ForegroundColor Cyan

# Function to check if ADB is available
function Test-ADB {
    try {
        $null = adb version
        return $true
    } catch {
        Write-Host "❌ ADB not found. Please install Android SDK Platform Tools" -ForegroundColor Red
        return $false
    }
}

# Function to check if device is connected
function Test-Device {
    $devices = adb devices | Select-String "device$"
    if ($devices) {
        Write-Host "✅ Android device connected" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ No Android device connected" -ForegroundColor Red
        Write-Host "   Please connect your device and enable USB debugging" -ForegroundColor Yellow
        return $false
    }
}

# Main test sequence
if (-not (Test-ADB)) {
    exit 1
}

if (-not (Test-Device)) {
    exit 1
}

Write-Host "`n📱 Starting Background Monitoring Test Sequence..." -ForegroundColor Yellow
Write-Host ""

# Test 1: Check if service is running
Write-Host "Test 1: Checking if ActivityMonitoringService is running..." -ForegroundColor Cyan
$serviceStatus = adb shell dumpsys activity services | Select-String "ActivityMonitoring"
if ($serviceStatus) {
    Write-Host "✅ Service is RUNNING" -ForegroundColor Green
    Write-Host "   $serviceStatus" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Service not detected - Make sure you've started monitoring in the app" -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

# Test 2: Check for persistent notification
Write-Host "`nTest 2: Checking for persistent notification..." -ForegroundColor Cyan
$notification = adb shell dumpsys notification | Select-String -Pattern "SafeNet|activity_monitoring" -Context 0,2
if ($notification) {
    Write-Host "✅ Persistent notification found" -ForegroundColor Green
} else {
    Write-Host "⚠️  No notification found - Service may not be running" -ForegroundColor Yellow
}

Start-Sleep -Seconds 2

# Test 3: Minimize app and monitor
Write-Host "`nTest 3: Minimizing app to test background operation..." -ForegroundColor Cyan
Write-Host "   Sending HOME key..." -ForegroundColor Gray
adb shell input keyevent KEYCODE_HOME
Start-Sleep -Seconds 2

Write-Host "✅ App minimized" -ForegroundColor Green
Write-Host "   ℹ️  The service should continue running in background" -ForegroundColor Blue

# Test 4: Live log monitoring
Write-Host "`nTest 4: Starting live log monitor..." -ForegroundColor Cyan
Write-Host "   Watching for sensor readings and fall detections..." -ForegroundColor Gray
Write-Host "   Press Ctrl+C to stop monitoring" -ForegroundColor Yellow
Write-Host ""

# Instructions
Write-Host "📋 NEXT STEPS:" -ForegroundColor Cyan
Write-Host "   1. Shake your phone vigorously" -ForegroundColor White
Write-Host "   2. Hold it completely still for 2 seconds" -ForegroundColor White
Write-Host "   3. Watch for 'FALL DETECTED' in the logs below" -ForegroundColor White
Write-Host "   4. You should get a system notification" -ForegroundColor White
Write-Host ""
Write-Host "Logs:" -ForegroundColor Yellow
Write-Host "-" * 60 -ForegroundColor Gray

# Start log monitoring
try {
    adb logcat -s ActivityMonitoring:* -v time
} catch {
    Write-Host "❌ Log monitoring stopped" -ForegroundColor Red
}

Write-Host "`n✅ Test complete!" -ForegroundColor Green
