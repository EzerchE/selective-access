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
set "OLD_DNS_SERVICE=SelectiveAccessDns"
set "INSTALL_DIR=%ProgramData%\SelectiveAccess"

schtasks.exe /End /TN "SelectiveAccessDnsSync" >nul 2>&1
schtasks.exe /Delete /F /TN "SelectiveAccessDnsSync" >nul 2>&1
schtasks.exe /End /TN "SelectiveAccessDns" >nul 2>&1
schtasks.exe /Delete /F /TN "SelectiveAccessDns" >nul 2>&1
sc.exe stop "%OLD_DNS_SERVICE%" >nul 2>&1
sc.exe delete "%OLD_DNS_SERVICE%" >nul 2>&1
sc.exe stop "%SERVICE_NAME%" >nul 2>&1
sc.exe delete "%SERVICE_NAME%" >nul 2>&1
reg.exe delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.ezerche.selective_access" /f >nul 2>&1
call :RemoveNrptRules "HKLM\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters\DnsPolicyConfig"
call :RemoveNrptRules "HKLM\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient\DnsPolicyConfig"

for /l %%I in (1,1,20) do (
  sc.exe query "%SERVICE_NAME%" >nul 2>&1
  if errorlevel 1 goto ServiceRemoved
  ping.exe 127.0.0.1 -n 2 >nul
)

:ServiceRemoved
rmdir /s /q "%INSTALL_DIR%" >nul 2>&1
rmdir /s /q "%LOCALAPPDATA%\SelectiveAccess" >nul 2>&1
echo Otomatik Erisim yerel yardimcisi kaldirildi.
exit /b 0

:RemoveNrptRules
for %%C in ("SelectiveAccess managed encrypted DNS" "SelectiveAccess managed fallback DNS") do (
  for /f "delims=" %%K in ('reg.exe query "%~1" /s /f %%C /d 2^>nul ^| findstr.exe /b /c:"HKEY_"') do reg.exe delete "%%K" /f >nul 2>&1
)
exit /b 0
