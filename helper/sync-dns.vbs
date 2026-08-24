Option Explicit

If WScript.Arguments.Count <> 3 Then
    WScript.Quit 2
End If

Dim shell, powerShellPath, command, exitCode
Set shell = CreateObject("WScript.Shell")
powerShellPath = shell.ExpandEnvironmentStrings("%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe")

Function QuoteArgument(value)
    QuoteArgument = Chr(34) & Replace(CStr(value), Chr(34), Chr(34) & Chr(34)) & Chr(34)
End Function

command = QuoteArgument(powerShellPath) & _
    " -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File " & _
    QuoteArgument(WScript.Arguments(0)) & " -DesiredFile " & _
    QuoteArgument(WScript.Arguments(1)) & " -ResultFile " & _
    QuoteArgument(WScript.Arguments(2))

exitCode = shell.Run(command, 0, True)
WScript.Quit exitCode
