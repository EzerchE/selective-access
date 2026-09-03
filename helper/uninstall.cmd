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

set "BACKEND_SERVICE=SelectiveAccessByeDPI"
set "GATEWAY_SERVICE=SelectiveAccessGateway"
set "INSTALL_DIR=%ProgramData%\SelectiveAccess"
call "%~dp0migrate-legacy.cmd"
if errorlevel 1 goto Failed
call :RemoveService "%GATEWAY_SERVICE%"
if errorlevel 1 goto Failed
call :RemoveService "%BACKEND_SERVICE%"
if errorlevel 1 goto Failed
rmdir /s /q "%INSTALL_DIR%" >nul 2>&1
if exist "%INSTALL_DIR%" goto Failed
netstat.exe -ano | findstr.exe "127.0.0.1:1080" | findstr.exe "LISTENING" >nul 2>&1
if not errorlevel 1 goto PortInUse
netstat.exe -ano | findstr.exe "127.0.0.1:1081" | findstr.exe "LISTENING" >nul 2>&1
if not errorlevel 1 goto PortInUse
echo Otomatik Erisim yerel yardimcisi kaldirildi.
exit /b 0

:PortInUse
echo Hizmetler silindi ancak yerel gecit portlarindan biri baska bir islem tarafindan kullaniliyor.
pause
exit /b 1
:Failed
echo Yerel gecit tamamen kaldirilamadi. Bilgisayari yeniden baslatip yeniden deneyin.
pause
exit /b 1

:RemoveService
sc.exe stop "%~1" >nul 2>&1
sc.exe delete "%~1" >nul 2>&1
for /l %%I in (1,1,20) do (
  sc.exe query "%~1" >nul 2>&1
  if errorlevel 1 exit /b 0
  ping.exe 127.0.0.1 -n 2 >nul
)
exit /b 1
