$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
try {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class SylvanaFileMove {
    [DllImport("kernel32.dll", EntryPoint="MoveFileW", CharSet=CharSet.Unicode, SetLastError=true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool MoveFile(string source, string destination);
    public static int Move(string source, string destination) {
        return MoveFile(source, destination) ? 0 : Marshal.GetLastWin32Error();
    }
}
'@
    # Compile before the parent does its final path and content checks.
    [Console]::WriteLine('READY')
    $line = [Console]::ReadLine()
    if ($null -eq $line) { exit 0 }
    $request = $line | ConvertFrom-Json
    if ($request.source -isnot [string] -or $request.destination -isnot [string] -or
        -not [IO.Path]::IsPathRooted($request.source) -or -not [IO.Path]::IsPathRooted($request.destination)) {
        throw 'A move requires two absolute paths.'
    }
    $result = [SylvanaFileMove]::Move($request.source, $request.destination)
    [Console]::WriteLine('RESULT:' + $result)
    if ($result -ne 0) { exit 1 }
} catch {
    [Console]::WriteLine('ERROR:' + [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Exception.Message)))
    exit 1
}
