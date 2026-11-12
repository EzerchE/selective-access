@echo off
setlocal EnableExtensions
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" exit /b 1
"%CSC%" /nologo /optimize+ /target:exe /reference:Microsoft.CSharp.dll /reference:System.ServiceProcess.dll /out:"%~dp0..\bin\SelectiveAccessLanShare.exe" "%~dp0SelectiveAccessLanShare.cs"
exit /b %ERRORLEVEL%
