@echo off
setlocal EnableExtensions EnableDelayedExpansion
title Otomatik Erisim yardimci kurulumu

fltmc >nul 2>&1
if errorlevel 1 (
  echo Bu kurulum Windows yonetici izni gerektirir.
  echo install.cmd dosyasina sag tiklayip "Yonetici olarak calistir" secenegini kullanin.
  echo.
  pause
  exit /b 1
)

set "BACKEND_SERVICE=SelectiveAccessByeDPI"
set "GATEWAY_SERVICE=SelectiveAccessGateway"
set "INSTALL_DIR=%ProgramData%\SelectiveAccess"
set "SOURCE_BACKEND=%~dp0bin\ciadpi.exe"
set "SOURCE_GATEWAY=%~dp0bin\SelectiveAccessGateway.exe"
set "TARGET_BACKEND=%INSTALL_DIR%\ciadpi.exe"
set "TARGET_GATEWAY=%INSTALL_DIR%\SelectiveAccessGateway.exe"
set "BACKEND_HASH=EB53CEEEB981CC6735AC24BB1E51E725280B86630E80FDF19DDC4EE4A5B54EF4"
set "GATEWAY_HASH=DE485D0B7A437EC61AA56C57C94F333BFD55EEE3FC8443FFF28351A3ED7D17D0"

call "%~dp0migrate-legacy.cmd"
if errorlevel 1 goto MigrationFailed
call :VerifyHash "%SOURCE_BACKEND%" "%BACKEND_HASH%"
if errorlevel 1 goto SourceVerificationFailed
call :VerifyHash "%SOURCE_GATEWAY%" "%GATEWAY_HASH%"
if errorlevel 1 goto SourceVerificationFailed
call :RemoveService "%GATEWAY_SERVICE%"
if errorlevel 1 goto RemovalFailed
call :RemoveService "%BACKEND_SERVICE%"
if errorlevel 1 goto RemovalFailed

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if errorlevel 1 goto CopyFailed
copy /y "%SOURCE_BACKEND%" "%TARGET_BACKEND%" >nul
if errorlevel 1 goto CopyFailed
copy /y "%SOURCE_GATEWAY%" "%TARGET_GATEWAY%" >nul
if errorlevel 1 goto CopyFailed
call :VerifyHash "%TARGET_BACKEND%" "%BACKEND_HASH%"
if errorlevel 1 goto CopyFailed
call :VerifyHash "%TARGET_GATEWAY%" "%GATEWAY_HASH%"
if errorlevel 1 goto CopyFailed
icacls.exe "%INSTALL_DIR%" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-19:(OI)(CI)RX" >nul
if errorlevel 1 goto CopyFailed

sc.exe create "%BACKEND_SERVICE%" binPath= "\"%TARGET_BACKEND%\" --ip 127.0.0.1 --port 1081 --no-udp --split 1 --oob 1 --auto r --auto t --fake -1 --tlsrec 1+s --auto s" start= auto obj= "NT AUTHORITY\LocalService" DisplayName= "Selective Access ByeDPI" >nul
if errorlevel 1 goto ServiceConfigurationFailed
sc.exe description "%BACKEND_SERVICE%" "Yalniz 127.0.0.1:1081 adresinde calisan DPI arka gecidi." >nul
call :ConfigureRecovery "%BACKEND_SERVICE%"
if errorlevel 1 goto ServiceConfigurationFailed
sc.exe create "%GATEWAY_SERVICE%" binPath= "\"%TARGET_GATEWAY%\"" start= auto depend= "%BACKEND_SERVICE%" obj= "NT AUTHORITY\LocalService" DisplayName= "Selective Access Gateway" >nul
if errorlevel 1 goto ServiceConfigurationFailed
sc.exe description "%GATEWAY_SERVICE%" "Sistem DNS ayarini degistirmeyen secici SOCKS5 on gecidi." >nul
call :ConfigureRecovery "%GATEWAY_SERVICE%"
if errorlevel 1 goto ServiceConfigurationFailed

sc.exe start "%BACKEND_SERVICE%" >nul
if errorlevel 1 goto ServiceStartFailed
call :WaitForServicePort "%BACKEND_SERVICE%" "127.0.0.1:1081"
if errorlevel 1 goto ServiceStartFailed
sc.exe start "%GATEWAY_SERVICE%" >nul
if errorlevel 1 goto ServiceStartFailed
call :WaitForServicePort "%GATEWAY_SERVICE%" "127.0.0.1:1080"
if errorlevel 1 goto ServiceStartFailed

echo.
echo Kurulum tamamlandi. Yerel gecit: 127.0.0.1:1080
echo Sistem, tarayici ve ag DNS ayarlari degistirilmedi.
echo Chrome eklenti kartindaki yenile simgesine bir kez basin.
exit /b 0

:MigrationFailed
echo Eski surum kalintilari temizlenemedi. Kurulum durduruldu.
goto Failed
:SourceVerificationFailed
echo Yardimci ikililer guvenlik dogrulamasindan gecemedi.
goto Failed
:RemovalFailed
echo Eski yerel gecit hizmetleri silinemedi. Birkaç saniye sonra yeniden deneyin.
goto Failed
:CopyFailed
echo Yerel gecit dosyalari guvenli bicimde kopyalanamadi.
goto Rollback
:ServiceConfigurationFailed
echo Windows hizmetleri guvenli bicimde yapilandirilamadi.
goto Rollback
:ServiceStartFailed
echo Yerel gecit hizmetleri baslatilamadi.
:Rollback
call :RemoveService "%GATEWAY_SERVICE%"
call :RemoveService "%BACKEND_SERVICE%"
:Failed
pause
exit /b 1

:VerifyHash
if not exist "%~1" exit /b 1
set "ACTUAL_HASH="
for /f "skip=1 delims=" %%H in ('certutil.exe -hashfile "%~1" SHA256 2^>nul') do if not defined ACTUAL_HASH set "ACTUAL_HASH=%%H"
set "ACTUAL_HASH=!ACTUAL_HASH: =!"
if /I "!ACTUAL_HASH!"=="%~2" exit /b 0
exit /b 1

:ConfigureRecovery
sc.exe failure "%~1" reset= 86400 actions= restart/5000/restart/15000/restart/60000 >nul
if errorlevel 1 exit /b 1
sc.exe failureflag "%~1" 1 >nul
exit /b %ERRORLEVEL%

:RemoveService
sc.exe stop "%~1" >nul 2>&1
sc.exe delete "%~1" >nul 2>&1
for /l %%I in (1,1,20) do (
  sc.exe query "%~1" >nul 2>&1
  if errorlevel 1 exit /b 0
  ping.exe 127.0.0.1 -n 2 >nul
)
exit /b 1

:WaitForServicePort
for /l %%I in (1,1,20) do (
  set "SERVICE_PID="
  for /f "tokens=3" %%P in ('sc.exe queryex "%~1" ^| findstr.exe /c:"PID"') do set "SERVICE_PID=%%P"
  if defined SERVICE_PID if not "!SERVICE_PID!"=="0" (
    netstat.exe -ano | findstr.exe "%~2" | findstr.exe /r /c:" !SERVICE_PID!$" >nul 2>&1
    if not errorlevel 1 exit /b 0
  )
  ping.exe 127.0.0.1 -n 2 >nul
)
exit /b 1
