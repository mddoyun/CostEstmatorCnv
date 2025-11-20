using Autodesk.Revit.UI;
using System.IO;
using System.Windows.Media.Imaging;
using System;

namespace AiBimCost.StartTools
{
    [Autodesk.Revit.Attributes.Transaction(Autodesk.Revit.Attributes.TransactionMode.Manual)]
    [Autodesk.Revit.Attributes.Regeneration(Autodesk.Revit.Attributes.RegenerationOption.Manual)]
    class CreateRibbon :IExternalApplication
    {
        #region DLL 경로 지정 - 빌드시 빌드경로로 수정해야함
        //DLL경로 지정 (빌드시 빌드경로로 수정)
        // 경로를 저장할 멤버 변수를 선언합니다.
        private string THISCLASSDLLPATH;
        private string ADDINFOLDERPATH;
        private string LOG_FILE_PATH;
        #endregion

        #region Debug Logging
        private void LogDebug(string message)
        {
            try
            {
                string timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
                string logMessage = $"[{timestamp}] {message}\n";
                File.AppendAllText(LOG_FILE_PATH, logMessage);
            }
            catch { } // Fail silently if logging fails
        }

        private void LogException(string context, Exception ex)
        {
            try
            {
                string timestamp = DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss.fff");
                string logMessage = $"[{timestamp}] ERROR in {context}:\n";
                logMessage += $"  Message: {ex.Message}\n";
                logMessage += $"  Type: {ex.GetType().Name}\n";
                logMessage += $"  StackTrace: {ex.StackTrace}\n";
                if (ex.InnerException != null)
                {
                    logMessage += $"  InnerException: {ex.InnerException.Message}\n";
                }
                logMessage += "\n";
                File.AppendAllText(LOG_FILE_PATH, logMessage);
            }
            catch { }
        }
        #endregion

        #region 수정하지 말것
        // (수정x)
        public Autodesk.Revit.UI.Result OnStartup(UIControlledApplication uiConApp)
        {
            try
            {
                // Revit 버전을 동적으로 가져와 경로를 설정합니다.
                string version = uiConApp.ControlledApplication.VersionNumber;
                string addinsFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
                    "Autodesk",
                    "Revit",
                    "Addins",
                    version);

                // 1단계에서 선언한 멤버 변수에 실제 경로를 할당합니다.
                // 루트 폴더의 DLL을 직접 참조 (Release/Debug 구분 불필요)
                THISCLASSDLLPATH = Path.Combine(addinsFolder,
                    "CostEstimator_RevitAddin_2026",
                    "AiBimCost.dll");

                ADDINFOLDERPATH = Path.Combine(addinsFolder, "CostEstimator_RevitAddin_2026");
                LOG_FILE_PATH = Path.Combine(ADDINFOLDERPATH, "debug.log");

                // Initialize log file
                LogDebug("=".PadRight(80, '='));
                LogDebug("AiBimCost Addin Starting...");
                LogDebug($"Revit Version: {version}");
                LogDebug($"Addins Folder: {addinsFolder}");
                LogDebug($"THIS CLASS DLL PATH: {THISCLASSDLLPATH}");
                LogDebug($"ADDIN FOLDER PATH: {ADDINFOLDERPATH}");
                LogDebug($"DLL Exists: {File.Exists(THISCLASSDLLPATH)}");

                // 경로 설정이 끝난 후 리본 패널을 생성합니다.
                CreateRibbonPanel(uiConApp);

                LogDebug("AiBimCost Addin Started Successfully!");
                LogDebug("=".PadRight(80, '='));
                return Autodesk.Revit.UI.Result.Succeeded;
            }
            catch (Exception ex)
            {
                LogException("OnStartup", ex);
                return Autodesk.Revit.UI.Result.Failed;
            }
        }

        public Autodesk.Revit.UI.Result OnShutdown(UIControlledApplication uiConApp)
        {
            return Autodesk.Revit.UI.Result.Succeeded;
        }
        #endregion

        #region 메인 도구
        // 메인(도구 추가할 경우 추가 및 관리)
        private void CreateRibbonPanel(UIControlledApplication uiConApp)
        {
            LogDebug("CreateRibbonPanel: Starting...");

            #region 도구생성용 변수-수정x
            string tabName;
            string panelName;
            string toolName;
            string innerToolName;
            string toolTip;
            string classPath;
            string contextHelp;
            string iconImagePath;
            RibbonPanel ribbonPanel = null;
            PushButton pushButton = null;
            BitmapImage bitmap = null;
            #endregion




            #region QuantityTakeoff_web
            // Input
            tabName = "AiBim";
            panelName = "QuantityTakeoff";
            toolName = "수량산출(web)";
            innerToolName = "수량산출(web)";
            toolTip = "수량산출(web)";
            classPath = "AiBimCost.MainTools.QuantityTakeoff_web.Command";
            contextHelp = "-";
            iconImagePath = Path.Combine(ADDINFOLDERPATH, "Icons", "Tool.png");

            LogDebug($"Tab Name: {tabName}");
            LogDebug($"Panel Name: {panelName}");
            LogDebug($"Tool Name: {toolName}");
            LogDebug($"Class Path: {classPath}");
            LogDebug($"Icon Path: {iconImagePath}");
            LogDebug($"Icon Exists: {File.Exists(iconImagePath)}");

            #region Creating - 수정x
            // Create Tab
            try
            {
                LogDebug("Attempting to create ribbon tab...");
                uiConApp.CreateRibbonTab(tabName);
                LogDebug("Ribbon tab created successfully!");
            }
            catch (Exception ex)
            {
                LogDebug($"Tab already exists or creation failed: {ex.Message}");
            }

            // Create Panel (or get existing panel)
            try
            {
                LogDebug("Attempting to create ribbon panel...");
                ribbonPanel = uiConApp.CreateRibbonPanel(tabName, panelName);
                LogDebug($"Ribbon panel created successfully! Panel is null: {ribbonPanel == null}");
            }
            catch (Exception ex)
            {
                LogDebug($"Panel creation failed: {ex.Message}");
                LogDebug("Attempting to find existing panel...");
                // Panel already exists, try to get it
                try
                {
                    var panels = uiConApp.GetRibbonPanels(tabName);
                    LogDebug($"Found {panels.Count} panels in tab '{tabName}'");
                    foreach (var panel in panels)
                    {
                        LogDebug($"  Panel: {panel.Name}");
                        if (panel.Name == panelName)
                        {
                            ribbonPanel = panel;
                            LogDebug($"Found existing panel: {panelName}");
                            break;
                        }
                    }
                }
                catch (Exception ex2)
                {
                    LogException("GetRibbonPanels", ex2);
                }
            }

            // Check if panel was created/found
            if (ribbonPanel == null)
            {
                LogDebug("ERROR: RibbonPanel is NULL! Cannot create button. Exiting.");
                return; // Exit if panel creation failed
            }

            LogDebug($"RibbonPanel is valid. Proceeding to create button...");

            // Create Tool
            try
            {
                LogDebug($"Creating PushButtonData with:");
                LogDebug($"  innerToolName: {innerToolName}");
                LogDebug($"  toolName: {toolName}");
                LogDebug($"  THISCLASSDLLPATH: {THISCLASSDLLPATH}");
                LogDebug($"  classPath: {classPath}");

                var buttonData = new PushButtonData(innerToolName, toolName, THISCLASSDLLPATH, classPath);
                LogDebug("PushButtonData created successfully!");

                pushButton = ribbonPanel.AddItem(buttonData) as PushButton;
                LogDebug($"AddItem called. PushButton is null: {pushButton == null}");
            }
            catch (Exception ex)
            {
                LogException("CreateButton", ex);
            }

            if (pushButton != null)
            {
                LogDebug("PushButton created successfully! Setting properties...");
                try
                {
                    pushButton.ToolTip = toolTip;
                    pushButton.SetContextualHelp(new ContextualHelp(ContextualHelpType.Url, contextHelp));
                    LogDebug("Properties set successfully!");

                    // Set icon if file exists
                    if (File.Exists(iconImagePath))
                    {
                        LogDebug("Setting icon...");
                        bitmap = new BitmapImage();
                        bitmap.BeginInit();
                        bitmap.UriSource = new Uri(iconImagePath);
                        bitmap.DecodePixelWidth = 32;
                        bitmap.DecodePixelHeight = 32;
                        bitmap.CacheOption = BitmapCacheOption.OnLoad;
                        bitmap.EndInit();
                        pushButton.LargeImage = bitmap;
                        LogDebug("Icon set successfully!");
                    }
                    else
                    {
                        LogDebug("Icon file not found, skipping icon.");
                    }
                }
                catch (Exception ex)
                {
                    LogException("SetButtonProperties", ex);
                }
            }
            else
            {
                LogDebug("ERROR: PushButton is NULL after AddItem!");
            }
            #endregion
            #endregion

            LogDebug("CreateRibbonPanel: Completed!");
        }







        #endregion

    }
}
