@echo off
setlocal EnableExtensions
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
set "OLD_DNS_SERVICE=SelectiveAccessDns"
set "OLD_DNS_TASK=SelectiveAccessDns"
set "OLD_SYNC_TASK=SelectiveAccessDnsSync"
set "INSTALL_DIR=%ProgramData%\SelectiveAccess"
set "SOURCE_EXE=%~dp0bin\ciadpi.exe"
set "TARGET_EXE=%INSTALL_DIR%\ciadpi.exe"
set "EXPECTED_HASH=EB53CEEEB981CC6735AC24BB1E51E725280B86630E80FDF19DDC4EE4A5B54EF4"

if not exist "%SOURCE_EXE%" (
  echo Kurulum dosyasi bulunamadi: %SOURCE_EXE%
  pause
  exit /b 1
)

set "ACTUAL_HASH="
for /f "skip=1 delims=" %%H in ('certutil.exe -hashfile "%SOURCE_EXE%" SHA256 2^>nul') do if not defined ACTUAL_HASH set "ACTUAL_HASH=%%H"
set "ACTUAL_HASH=%ACTUAL_HASH: =%"
if /I not "%ACTUAL_HASH%"=="%EXPECTED_HASH%" (
  echo Yardimci ikili guvenlik dogrulamasindan gecemedi.
  pause
  exit /b 1
)

echo Eski kurulum bilesenleri temizleniyor...
schtasks.exe /End /TN "%OLD_SYNC_TASK%" >nul 2>&1
schtasks.exe /Delete /F /TN "%OLD_SYNC_TASK%" >nul 2>&1
schtasks.exe /End /TN "%OLD_DNS_TASK%" >nul 2>&1
schtasks.exe /Delete /F /TN "%OLD_DNS_TASK%" >nul 2>&1
sc.exe stop "%OLD_DNS_SERVICE%" >nul 2>&1
sc.exe delete "%OLD_DNS_SERVICE%" >nul 2>&1
reg.exe delete "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.ezerche.selective_access" /f >nul 2>&1
call :RemoveNrptRules "HKLM\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters\DnsPolicyConfig"
call :RemoveNrptRules "HKLM\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient\DnsPolicyConfig"

sc.exe stop "%SERVICE_NAME%" >nul 2>&1
sc.exe delete "%SERVICE_NAME%" >nul 2>&1
for /l %%I in (1,1,20) do (
  sc.exe query "%SERVICE_NAME%" >nul 2>&1
  if errorlevel 1 goto ServiceRemoved
  ping.exe 127.0.0.1 -n 2 >nul
)
echo Eski yerel gecit hizmeti silinemedi. Birkaç saniye sonra yeniden deneyin.
pause
exit /b 1

:ServiceRemoved
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"
del /q "%INSTALL_DIR%\dnsproxy.exe" "%INSTALL_DIR%\SelectiveAccessDnsHost.exe" "%INSTALL_DIR%\com.ezerche.selective_access.json" "%INSTALL_DIR%\sync-dns.ps1" "%INSTALL_DIR%\sync-dns.vbs" >nul 2>&1
rmdir /s /q "%LOCALAPPDATA%\SelectiveAccess" >nul 2>&1
copy /y "%SOURCE_EXE%" "%TARGET_EXE%" >nul
if errorlevel 1 (
  echo Yerel gecit dosyasi kopyalanamadi.
  pause
  exit /b 1
)

sc.exe create "%SERVICE_NAME%" binPath= "\"%TARGET_EXE%\" --ip 127.0.0.1 --port 1080 --no-udp --split 1 --oob 1 --auto r --oob 1 --auto t --fake -1 --tlsrec 1+s --auto s" start= auto DisplayName= "Selective Access ByeDPI" >nul
if errorlevel 1 (
  echo Windows hizmeti olusturulamadi.
  pause
  exit /b 1
)
sc.exe description "%SERVICE_NAME%" "Yalniz 127.0.0.1:1080 adresinde calisan secici SOCKS5 gecidi." >nul
sc.exe start "%SERVICE_NAME%" >nul
if errorlevel 1 (
  echo Yerel gecit hizmeti baslatilamadi.
  pause
  exit /b 1
)

echo.
echo Kurulum tamamlandi. Yerel gecit: 127.0.0.1:1080
echo Sistem ve ag DNS ayarlari degistirilmedi.
echo Chrome eklenti kartindaki yenile simgesine bir kez basin.
exit /b 0

:RemoveNrptRules
for %%C in ("SelectiveAccess managed encrypted DNS" "SelectiveAccess managed fallback DNS") do (
  for /f "delims=" %%K in ('reg.exe query "%~1" /s /f %%C /d 2^>nul ^| findstr.exe /b /c:"HKEY_"') do reg.exe delete "%%K" /f >nul 2>&1
)
exit /b 0
