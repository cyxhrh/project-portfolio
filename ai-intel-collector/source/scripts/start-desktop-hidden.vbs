Set shell = CreateObject("WScript.Shell")
projectRoot = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
projectRoot = CreateObject("Scripting.FileSystemObject").GetParentFolderName(projectRoot)
command = "cmd.exe /c cd /d """ & projectRoot & """ && npm run desktop:dev"
shell.Run command, 0, False
