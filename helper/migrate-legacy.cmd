@echo off
setlocal EnableExtensions EnableDelayedExpansion

rem Removes only components created by obsolete DNS-based releases.
rem This script never creates DNS rules or changes a network adapter.

fltmc >nul 2>&1
if errorlevel 1 exit /b 1
if not defined ProgramData exit /b 1

set "LEGACY_SERVICE=SelectiveAccessDns"
set "LEGACY_TASK=SelectiveAccessDns"
set "LEGACY_SYNC_TASK=SelectiveAccessDnsSync"
set "LEGACY_NATIVE_HOST=com.ezerche.selective_access"
set "INSTALL_DIR=%ProgramData%\SelectiveAccess"
set "LEGACY_USER_DIR=%LOCALAPPDATA%\SelectiveAccess"
set "LEGACY_NRPT_REMOVED=0"

call :RemoveLegacyTask "%LEGACY_SYNC_TASK%"
if errorlevel 1 goto MigrationFailed
call :RemoveLegacyTask "%LEGACY_TASK%"
if errorlevel 1 goto MigrationFailed

sc.exe query "%LEGACY_SERVICE%" >nul 2>&1
if not errorlevel 1 (
  sc.exe stop "%LEGACY_SERVICE%" >nul 2>&1
  sc.exe delete "%LEGACY_SERVICE%" >nul 2>&1
  if errorlevel 1 goto MigrationFailed
  call :WaitForLegacyServiceRemoval
  if errorlevel 1 goto MigrationFailed
)

call :RemoveLegacyRegistryKey "HKCU\Software\Google\Chrome\NativeMessagingHosts\%LEGACY_NATIVE_HOST%"
if errorlevel 1 goto MigrationFailed
call :RemoveLegacyRegistryKey "HKLM\Software\Google\Chrome\NativeMessagingHosts\%LEGACY_NATIVE_HOST%"
if errorlevel 1 goto MigrationFailed
for /f "delims=" %%U in ('reg.exe query HKEY_USERS 2^>nul ^| findstr.exe /r /b /c:"HKEY_USERS\\S-1-5-21-[0-9-]*$"') do (
  call :RemoveLegacyRegistryKey "%%U\Software\Google\Chrome\NativeMessagingHosts\%LEGACY_NATIVE_HOST%"
  if errorlevel 1 goto MigrationFailed
)

call :RemoveNrptRulesAtRoot "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters\DnsPolicyConfig" "SelectiveAccess managed encrypted DNS"
if errorlevel 1 goto MigrationFailed
call :RemoveNrptRulesAtRoot "HKEY_LOCAL_MACHINE\SYSTEM\CurrentControlSet\Services\Dnscache\Parameters\DnsPolicyConfig" "SelectiveAccess managed fallback DNS"
if errorlevel 1 goto MigrationFailed
call :RemoveNrptRulesAtRoot "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient\DnsPolicyConfig" "SelectiveAccess managed encrypted DNS"
if errorlevel 1 goto MigrationFailed
call :RemoveNrptRulesAtRoot "HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\Windows NT\DNSClient\DnsPolicyConfig" "SelectiveAccess managed fallback DNS"
if errorlevel 1 goto MigrationFailed

for %%F in (
  "dnsproxy.exe"
  "SelectiveAccessDnsHost.exe"
  "com.ezerche.selective_access.json"
  "sync-dns.ps1"
  "sync-dns.vbs"
) do (
  if exist "%INSTALL_DIR%\%%~F" del /f /q "%INSTALL_DIR%\%%~F" >nul 2>&1
  if exist "%INSTALL_DIR%\%%~F" goto MigrationFailed
)

if defined LOCALAPPDATA (
  for %%F in (
    "dns-domains.txt"
    "dns-domains.txt.tmp"
    "dns-result.txt"
  ) do (
    if exist "%LEGACY_USER_DIR%\%%~F" del /f /q "%LEGACY_USER_DIR%\%%~F" >nul 2>&1
    if exist "%LEGACY_USER_DIR%\%%~F" goto MigrationFailed
  )
  rmdir "%LEGACY_USER_DIR%" >nul 2>&1
)

if "%LEGACY_NRPT_REMOVED%"=="1" ipconfig.exe /flushdns >nul 2>&1
exit /b 0

:RemoveLegacyTask
schtasks.exe /Query /TN "%~1" >nul 2>&1
if errorlevel 1 exit /b 0
schtasks.exe /End /TN "%~1" >nul 2>&1
schtasks.exe /Delete /F /TN "%~1" >nul 2>&1
if errorlevel 1 exit /b 1
schtasks.exe /Query /TN "%~1" >nul 2>&1
if not errorlevel 1 exit /b 1
exit /b 0

:WaitForLegacyServiceRemoval
for /l %%I in (1,1,20) do (
  sc.exe query "%LEGACY_SERVICE%" >nul 2>&1
  if errorlevel 1 exit /b 0
  ping.exe 127.0.0.1 -n 2 >nul
)
exit /b 1

:RemoveLegacyRegistryKey
reg.exe query "%~1" >nul 2>&1
if errorlevel 1 exit /b 0
reg.exe delete "%~1" /f >nul 2>&1
if errorlevel 1 exit /b 1
reg.exe query "%~1" >nul 2>&1
if not errorlevel 1 exit /b 1
exit /b 0

:RemoveNrptRulesAtRoot
for /f "delims=" %%K in ('reg.exe query "%~1" /s /f "%~2" /d /e 2^>nul ^| findstr.exe /b /c:"HKEY_"') do (
  call :RemoveExactNrptKey "%%K" "%~1" "%~2"
  if errorlevel 1 exit /b 1
)
reg.exe query "%~1" /s /f "%~2" /d /e 2>nul | findstr.exe /b /c:"HKEY_" >nul
if not errorlevel 1 exit /b 1
exit /b 0

:RemoveExactNrptKey
set "FOUND_KEY=%~1"
set "ROOT_KEY=%~2"
set "EXPECTED_COMMENT=%~3"
set "CHILD_KEY=!FOUND_KEY:%~2\=!"
if /I "!CHILD_KEY!"=="!FOUND_KEY!" exit /b 1
echo(!CHILD_KEY!| findstr.exe /l /c:"\" >nul
if not errorlevel 1 exit /b 1
reg.exe query "!FOUND_KEY!" /v Comment 2>nul | findstr.exe /i /l /e /c:"!EXPECTED_COMMENT!" >nul
if errorlevel 1 exit /b 1
reg.exe delete "!FOUND_KEY!" /f >nul 2>&1
if errorlevel 1 exit /b 1
reg.exe query "!FOUND_KEY!" >nul 2>&1
if not errorlevel 1 exit /b 1
set "LEGACY_NRPT_REMOVED=1"
exit /b 0

:MigrationFailed
echo Eski surumun ag bilesenleri guvenli bicimde temizlenemedi.
echo Sistem DNS ayarlari degistirilmedi. Kuruluma devam edilmedi.
exit /b 1
