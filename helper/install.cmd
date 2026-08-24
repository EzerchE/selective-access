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

set "SERVICE_NAME=SelectiveAccessByeDPI"
set "INSTALL_DIR=%ProgramData%\SelectiveAccess"
set "SOURCE_EXE=%~dp0bin\ciadpi.exe"
set "TARGET_EXE=%INSTALL_DIR%\ciadpi.exe"
set "EXPECTED_HASH=EB53CEEEB981CC6735AC24BB1E51E725280B86630E80FDF19DDC4EE4A5B54EF4"

if not exist "%SOURCE_EXE%" (
  echo Kurulum dosyasi bulunamadi.
  pause
  exit /b 1
)

call :VerifyHash "%SOURCE_EXE%"
if errorlevel 1 (
  echo Yardimci ikili guvenlik dogrulamasindan gecemedi.
  pause
  exit /b 1
)

sc.exe stop "%SERVICE_NAME%" >nul 2>&1
sc.exe delete "%SERVICE_NAME%" >nul 2>&1
call :WaitForServiceRemoval
if errorlevel 1 (
  echo Eski yerel gecit hizmeti silinemedi. Birkaç saniye sonra yeniden deneyin.
  pause
  exit /b 1
)

if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
if errorlevel 1 (
  echo Kurulum klasoru olusturulamadi.
  pause
  exit /b 1
)

copy /y "%SOURCE_EXE%" "%TARGET_EXE%" >nul
if errorlevel 1 (
  echo Yerel gecit dosyasi kopyalanamadi.
  pause
  exit /b 1
)

call :VerifyHash "%TARGET_EXE%"
if errorlevel 1 (
  echo Kopyalanan yerel gecit dosyasi dogrulanamadi.
  del /q "%TARGET_EXE%" >nul 2>&1
  pause
  exit /b 1
)

icacls.exe "%INSTALL_DIR%" /inheritance:r /grant:r "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" "*S-1-5-19:(OI)(CI)RX" >nul
if errorlevel 1 (
  echo Kurulum klasoru izinleri guvenli duruma getirilemedi.
  pause
  exit /b 1
)

sc.exe create "%SERVICE_NAME%" binPath= "\"%TARGET_EXE%\" --ip 127.0.0.1 --port 1080 --no-udp --split 1 --oob 1 --auto r --auto t --fake -1 --tlsrec 1+s --auto s" start= delayed-auto obj= "NT AUTHORITY\LocalService" DisplayName= "Selective Access ByeDPI" >nul
if errorlevel 1 (
  echo Windows hizmeti olusturulamadi.
  pause
  exit /b 1
)

sc.exe description "%SERVICE_NAME%" "Yalniz 127.0.0.1:1080 adresinde calisan secici SOCKS5 gecidi." >nul
sc.exe failure "%SERVICE_NAME%" reset= 86400 actions= restart/5000/restart/15000/restart/60000 >nul
if errorlevel 1 goto ServiceConfigurationFailed
sc.exe failureflag "%SERVICE_NAME%" 1 >nul
if errorlevel 1 goto ServiceConfigurationFailed

sc.exe start "%SERVICE_NAME%" >nul
if errorlevel 1 goto ServiceStartFailed
call :WaitForServiceRunning
if errorlevel 1 goto ServiceStartFailed
call :WaitForServicePort
if errorlevel 1 goto ServiceStartFailed

echo.
echo Kurulum tamamlandi. Yerel gecit: 127.0.0.1:1080
echo Sistem ve ag DNS ayarlari degistirilmedi.
echo Chrome eklenti kartindaki yenile simgesine bir kez basin.
exit /b 0

:ServiceConfigurationFailed
echo Windows hizmeti guvenli bicimde yapilandirilamadi.
goto RollbackService

:ServiceStartFailed
echo Yerel gecit hizmeti baslatilamadi.

:RollbackService
sc.exe stop "%SERVICE_NAME%" >nul 2>&1
sc.exe delete "%SERVICE_NAME%" >nul 2>&1
pause
exit /b 1

:VerifyHash
set "ACTUAL_HASH="
for /f "skip=1 delims=" %%H in ('certutil.exe -hashfile "%~1" SHA256 2^>nul') do if not defined ACTUAL_HASH set "ACTUAL_HASH=%%H"
set "ACTUAL_HASH=%ACTUAL_HASH: =%"
if /I "%ACTUAL_HASH%"=="%EXPECTED_HASH%" exit /b 0
exit /b 1

:WaitForServiceRemoval
for /l %%I in (1,1,20) do (
  sc.exe query "%SERVICE_NAME%" >nul 2>&1
  if errorlevel 1 exit /b 0
  ping.exe 127.0.0.1 -n 2 >nul
)
exit /b 1

:WaitForServiceRunning
for /l %%I in (1,1,20) do (
  sc.exe query "%SERVICE_NAME%" | findstr.exe /c:"RUNNING" >nul 2>&1
  if not errorlevel 1 exit /b 0
  ping.exe 127.0.0.1 -n 2 >nul
)
exit /b 1

:WaitForServicePort
for /l %%I in (1,1,20) do (
  set "SERVICE_PID="
  for /f "tokens=3" %%P in ('sc.exe queryex "%SERVICE_NAME%" ^| findstr.exe /c:"PID"') do set "SERVICE_PID=%%P"
  if defined SERVICE_PID if not "!SERVICE_PID!"=="0" (
    netstat.exe -ano | findstr.exe "127.0.0.1:1080" | findstr.exe /r /c:" !SERVICE_PID!$" >nul 2>&1
    if not errorlevel 1 exit /b 0
  )
  ping.exe 127.0.0.1 -n 2 >nul
)
exit /b 1
