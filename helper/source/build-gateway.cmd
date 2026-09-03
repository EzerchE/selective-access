@echo off
setlocal EnableExtensions
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" exit /b 1
"%CSC%" /nologo /optimize+ /target:exe /out:"%~dp0..\bin\SelectiveAccessGateway.exe" "%~dp0SelectiveAccessGateway.cs"
exit /b %ERRORLEVEL%
