; CostEstimator All-in-One Installer
; Includes: Django Server + Revit 2026 Addin
; Server is installed in the Revit Addin folder for integrated execution

#define MyAppName "CostEstimator"
#define MyAppVersion "1.3.1"
#define MyAppPublisher "AiBimCost"
#define RevitAddinPath "{userappdata}\Autodesk\Revit\Addins\2026\CostEstimator"
; Build output path (uses AppData because csproj sets BaseOutputPath there)
#define BuildOutputPath GetEnv("APPDATA") + "\Autodesk\Revit\Addins\2026\CostEstimator_RevitAddin_2026\Release\net8.0-windows"

[Setup]
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputBaseFilename=CostEstimator_AllInOne_v{#MyAppVersion}_Setup
OutputDir=dist
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
WizardStyle=modern
UninstallDisplayIcon={#RevitAddinPath}\AiBimCost.dll

[Languages]
Name: "korean"; MessagesFile: "compiler:Languages\Korean.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
; Revit Addin DLLs - Install to user AppData (Revit addins folder)
; Source from build output in AppData
Source: "{#BuildOutputPath}\*.dll"; DestDir: "{#RevitAddinPath}"; Flags: ignoreversion
Source: "{#BuildOutputPath}\*.pdb"; DestDir: "{#RevitAddinPath}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#BuildOutputPath}\*.json"; DestDir: "{#RevitAddinPath}"; Flags: ignoreversion skipifsourcedoesntexist
Source: "{#BuildOutputPath}\runtimes\*"; DestDir: "{#RevitAddinPath}\runtimes"; Flags: ignoreversion recursesubdirs createallsubdirs skipifsourcedoesntexist

; Icons folder for ribbon button icons
Source: "CostEstimator_RevitAddin_2026\Icons\*"; DestDir: "{#RevitAddinPath}\Icons"; Flags: ignoreversion recursesubdirs createallsubdirs

; Django Server - Install in the same Revit Addin folder under 'server' subfolder
Source: "CostEstimator_RevitAddin_2026\server\CostEstimatorServer.exe"; DestDir: "{#RevitAddinPath}\server"; Flags: ignoreversion

; Documentation
Source: "README_INSTALLER.md"; DestDir: "{app}"; DestName: "README.md"; Flags: ignoreversion isreadme skipifsourcedoesntexist

[Dirs]
; Create server data directory
Name: "{#RevitAddinPath}\server\data"

[Code]
procedure CreateAddinFile();
var
  AddinContent: String;
  AddinPath: String;
begin
  AddinPath := ExpandConstant('{userappdata}\Autodesk\Revit\Addins\2026\CostEstimator.addin');

  AddinContent := '<?xml version="1.0" encoding="utf-8" standalone="no"?>' + #13#10 +
    '<RevitAddIns>' + #13#10 +
    '  <AddIn Type="Application">' + #13#10 +
    '    <Assembly>.\CostEstimator\AiBimCost.dll</Assembly>' + #13#10 +
    '    <AddInId>B52857E4-5C8D-42AA-9E83-B0211EC27EFE</AddInId>' + #13#10 +
    '    <FullClassName>AiBimCost.StartTools.CreateRibbon</FullClassName>' + #13#10 +
    '    <Name>CostEstimator</Name>' + #13#10 +
    '    <VendorId>AiBimCost</VendorId>' + #13#10 +
    '    <VendorDescription>AI-powered BIM Cost Estimation</VendorDescription>' + #13#10 +
    '  </AddIn>' + #13#10 +
    '</RevitAddIns>';

  SaveStringToFile(AddinPath, AddinContent, False);
end;

procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then
  begin
    CreateAddinFile();
  end;
end;

[Icons]
Name: "{group}\Start Server"; Filename: "{#RevitAddinPath}\server\CostEstimatorServer.exe"; WorkingDir: "{#RevitAddinPath}\server"
Name: "{group}\Open Web Interface"; Filename: "http://127.0.0.1:8000"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\CostEstimator Server"; Filename: "{#RevitAddinPath}\server\CostEstimatorServer.exe"; WorkingDir: "{#RevitAddinPath}\server"; Tasks: desktopicon

[Run]
Filename: "{#RevitAddinPath}\server\CostEstimatorServer.exe"; Description: "서버 시작"; WorkingDir: "{#RevitAddinPath}\server"; Flags: nowait postinstall skipifsilent unchecked

[UninstallDelete]
Type: filesandordirs; Name: "{#RevitAddinPath}"
Type: files; Name: "{userappdata}\Autodesk\Revit\Addins\2026\CostEstimator.addin"

[Messages]
korean.SetupWindowTitle=CostEstimator 설치
korean.WelcomeLabel1=CostEstimator All-in-One 설치
korean.WelcomeLabel2=이 설치 프로그램은 다음을 설치합니다:%n%n  - CostEstimator 서버 (Django)%n  - Revit 2026 애드인%n%nRevit에서 직접 서버를 시작할 수 있습니다.%n%n계속하려면 [다음]을 클릭하세요.
korean.FinishedHeadingLabel=CostEstimator 설치 완료!
korean.FinishedLabel=설치가 완료되었습니다.%n%nRevit 2026을 열어서 CostEstimator를 사용하세요!%n%n애드인에서 "서버 시작" 버튼을 눌러 서버를 실행할 수 있습니다.
