; installer.iss — 아주 단순: 지정 폴더 전체를 %APPDATA%\Autodesk\Revit\Addins\2026 로 복사

[Setup]
AppName=CostEstimator Revit Addin
AppVersion=1.0.0
; 사용자 AppData 경로로 고정
DefaultDirName={userappdata}\Autodesk\Revit\Addins\2026
DisableDirPage=yes
Compression=lzma
SolidCompression=yes
OutputBaseFilename=CostEstimator_Addin_Setup
PrivilegesRequired=none

[Files]
; 네가 말한 원본 폴더 전체를 그대로 복사
; ↓↓↓ 이 경로는 너가 준 그대로 사용
Source: "C:\Mac\Home\Desktop\CostEstimator_Setup\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs

; (선택) 설치 폴더 바로가기 — 필요 없으면 아래 두 섹션 삭제
[Tasks]
Name: "desktopicon"; Description: "바탕화면에 설치 폴더 바로가기 추가"; Flags: unchecked

[Icons]
Name: "{userdesktop}\CostEstimator Addin Folder"; Filename: "{app}"; Tasks: desktopicon
