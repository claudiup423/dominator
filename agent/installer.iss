; DominanceBot Installer — Inno Setup Script
; Requires: Inno Setup 6+ (https://jrsoftware.org/isdl.php)
;
; Build steps:
;   1. Run PyInstaller:  pyinstaller DominanceBot.spec
;   2. Open this file in Inno Setup Compiler
;   3. Click Build > Compile (or press F9)
;   Output: installer/DominanceBotSetup.exe

#define MyAppName "DominanceBot"
#define MyAppVersion "1.3.2"
#define MyAppPublisher "DominanceBot"
#define MyAppURL "https://dominancebot.com"
#define MyAppExeName "DominanceBot.exe"

[Setup]
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=installer
OutputBaseFilename=DominanceBotSetup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=lowest
; Uncomment if you have an icon:
; SetupIconFile=assets\icon.ico

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked
Name: "startupicon"; Description: "Start DominanceBot when Windows starts"; GroupDescription: "Startup:"; Flags: unchecked

[Files]
; PyInstaller output folder — everything in dist/DominanceBot/
Source: "dist\DominanceBot\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\Uninstall {#MyAppName}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon
Name: "{userstartup}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: startupicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch DominanceBot"; Flags: nowait postinstall skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{localappdata}\DominanceBot"

[Code]
// Check if RLBot is installed and download if needed
procedure CurStepChanged(CurStep: TSetupStep);
var
  RLBotPath: String;
begin
  if CurStep = ssPostInstall then
  begin
    RLBotPath := ExpandConstant('{localappdata}\RLBot5\bin\RLBotServer.exe');
    if not FileExists(RLBotPath) then
    begin
      MsgBox('DominanceBot requires RLBot to be installed.' + #13#10 +
             'RLBot will be downloaded automatically on first launch.' + #13#10 +
             'Make sure you have an internet connection.',
             mbInformation, MB_OK);
    end;
  end;
end;
