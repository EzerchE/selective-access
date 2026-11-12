@echo off
setlocal EnableExtensions
title Automatic Access - Private LAN sharing
set "APP=%ProgramData%\SelectiveAccess\SelectiveAccessLanShare.exe"
if not exist "%APP%" (
  echo Install/update the helper with install.cmd first.
  echo Once helper/install.cmd ile kurun veya guncelleyin.
  pause
  exit /b 1
)
:Menu
echo.
echo 1 - ON / Yerel agda paylasimi AC
echo 2 - OFF / Yerel agda paylasimi KAPAT
echo 3 - Status / Durum
echo 4 - Exit / Cikis
choice /c 1234 /n /m "Select / Secim: "
if errorlevel 4 exit /b 0
if errorlevel 3 goto Status
if errorlevel 2 goto Off
"%APP%" --on
goto Result
:Off
"%APP%" --off
goto Result
:Status
"%APP%" --status
:Result
if errorlevel 1 echo Operation failed or was cancelled / Islem basarisiz veya iptal edildi.
pause
goto Menu
