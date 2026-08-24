@echo off
setlocal EnableExtensions
title Otomatik Erisim yardimcisini kaldir

fltmc >nul 2>&1
if errorlevel 1 (
  echo Bu islem Windows yonetici izni gerektirir.
  echo uninstall.cmd dosyasina sag tiklayip "Yonetici olarak calistir" secenegini kullanin.
  echo.
  pause
  exit /b 1
)

set "SERVICE_NAME=SelectiveAccessByeDPI"
set "INSTALL_DIR=%ProgramData%\SelectiveAccess"

sc.exe stop "%SERVICE_NAME%" >nul 2>&1
sc.exe delete "%SERVICE_NAME%" >nul 2>&1
call :WaitForServiceRemoval
if errorlevel 1 (
  echo Yerel gecit hizmeti silinemedi. Bilgisayari yeniden baslatip yeniden deneyin.
  pause
  exit /b 1
)

rmdir /s /q "%INSTALL_DIR%" >nul 2>&1
if exist "%INSTALL_DIR%" (
  echo Yerel gecit dosyalari kaldirilamadi.
  pause
  exit /b 1
)

netstat.exe -ano | findstr.exe "127.0.0.1:1080" | findstr.exe "LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo Yerel gecit hizmeti silindi ancak 127.0.0.1:1080 baska bir islem tarafindan kullaniliyor.
  pause
  exit /b 1
)

echo Otomatik Erisim yerel yardimcisi kaldirildi.
exit /b 0

:WaitForServiceRemoval
for /l %%I in (1,1,20) do (
  sc.exe query "%SERVICE_NAME%" >nul 2>&1
  if errorlevel 1 exit /b 0
  ping.exe 127.0.0.1 -n 2 >nul
)
exit /b 1
