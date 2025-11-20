// ConnectorWindow.xaml.cs (직접 실행 방식으로 수정)
using Autodesk.Revit.UI;
using Newtonsoft.Json.Linq;
using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Threading;
using MessageBox = System.Windows.MessageBox;

namespace RevitDjangoConnector
{
    public partial class ConnectorWindow : Window
    {
        private readonly ExternalEvent _externalEvent;
        private readonly RevitApiHandler _apiHandler;
        private WebSocketService _webSocketService;
        private Process _serverProcess; // Django 서버 프로세스를 관리하기 위한 변수

        // 서버 헬스체크용 타이머 및 상태
        private DispatcherTimer _serverHealthCheckTimer;
        private DateTime _serverStartTime;
        private const int SERVER_CHECK_TIMEOUT_SECONDS = 180; // 3분
        private const double SERVER_CHECK_INTERVAL_MS = 500; // 0.5초마다 체크

        public ConnectorWindow(ExternalEvent externalEvent, RevitApiHandler apiHandler)
        {
            InitializeComponent();
            _externalEvent = externalEvent;
            _apiHandler = apiHandler;

            // 포트 변경 시 URL 자동 업데이트
            UpdateServerUrl();
        }

        // 포트 변경 이벤트 핸들러
        private void PortTextBox_TextChanged(object sender, System.Windows.Controls.TextChangedEventArgs e)
        {
            UpdateServerUrl();
        }

        // 서버 URL 업데이트
        private void UpdateServerUrl()
        {
            // Null check - UI 컨트롤이 초기화되지 않았을 수 있음
            if (PortTextBox == null || ServerUrlTextBox == null)
                return;

            if (int.TryParse(PortTextBox.Text, out int port))
            {
                ServerUrlTextBox.Text = $"ws://127.0.0.1:{port}/ws/revit-connector/";
            }
        }

        // 서버 상태 업데이트
        private void UpdateServerStatus(string status)
        {
            Dispatcher.Invoke(() =>
            {
                if (ServerStatusTextBlock != null)
                    ServerStatusTextBlock.Text = $"서버 상태: {status}";
            });
        }

        // 웹소켓 상태 업데이트
        private void UpdateWebSocketStatus(string status)
        {
            Dispatcher.Invoke(() =>
            {
                if (WebSocketStatusTextBlock != null)
                    WebSocketStatusTextBlock.Text = $"웹소켓 상태: {status}";
            });
        }

        // [핵심 수정] 서버 시작 버튼 클릭 이벤트
        private void StartServerButton_Click(object sender, RoutedEventArgs e)
        {
            if (_serverProcess != null && !_serverProcess.HasExited)
            {
                UpdateStatus("Server is already running.");
                UpdateServerStatus("실행 중");
                return;
            }

            // 포트 번호 가져오기
            if (!int.TryParse(PortTextBox.Text, out int port))
            {
                MessageBox.Show("올바른 포트 번호를 입력해주세요.", "입력 오류", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            string assemblyLocation = Assembly.GetExecutingAssembly().Location;
            string addonDirectory = Path.GetDirectoryName(assemblyLocation);
            string serverExecutablePath = Path.Combine(addonDirectory, "server", "CostEstimatorServer.exe");

            if (!File.Exists(serverExecutablePath))
            {
                UpdateStatus($"ERROR: Server executable not found at '{serverExecutablePath}'");
                UpdateServerStatus("오류: 파일 없음");
                MessageBox.Show($"Server executable not found. Please make sure 'CostEstimatorServer.exe' is in the correct location.\n\nSearched Path:\n{serverExecutablePath}", "File Not Found", MessageBoxButton.OK, MessageBoxImage.Error);
                return;
            }

            try
            {
                UpdateServerStatus("시작 중... (0%)");
                UpdateStatus($"Starting server on port {port}...");

                // 프로그레스 바 표시 및 연결 버튼 비활성화
                Dispatcher.Invoke(() =>
                {
                    ServerProgressBar.Visibility = Visibility.Visible;
                    ServerProgressBar.Value = 0;
                    ConnectButton.IsEnabled = false; // 서버 준비될 때까지 연결 버튼 비활성화
                });

                // ProcessStartInfo를 사용하여 셸 실행(더블클릭과 동일)을 활성화합니다.
                ProcessStartInfo startInfo = new ProcessStartInfo(serverExecutablePath)
                {
                    // UseShellExecute = true로 설정하면, 윈도우가 파일을 직접 실행하는 것처럼 동작합니다.
                    // .exe 파일이므로 새 콘솔 창이 뜨게 됩니다.
                    UseShellExecute = true,
                    Arguments = port.ToString() // 포트 번호를 인자로 전달
                };

                _serverProcess = Process.Start(startInfo);

                if (_serverProcess == null || _serverProcess.HasExited)
                {
                    throw new Exception("Process could not be started.");
                }

                UpdateStatus($"Server process launched. Waiting for server to be ready...");

                // 서버 헬스체크 시작
                _serverStartTime = DateTime.Now;
                StartServerHealthCheck(port);

                StartServerButton.IsEnabled = false;
            }
            catch (Exception ex)
            {
                UpdateStatus($"Failed to start server: {ex.Message}");
                UpdateServerStatus("오류");
                Dispatcher.Invoke(() =>
                {
                    ServerProgressBar.Visibility = Visibility.Collapsed;
                    ConnectButton.IsEnabled = true;
                });
                MessageBox.Show($"Could not start the server process: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        // 서버 헬스체크 시작
        private void StartServerHealthCheck(int port)
        {
            if (_serverHealthCheckTimer != null)
            {
                _serverHealthCheckTimer.Stop();
                _serverHealthCheckTimer = null;
            }

            _serverHealthCheckTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(SERVER_CHECK_INTERVAL_MS)
            };

            _serverHealthCheckTimer.Tick += async (sender, e) => await CheckServerHealth(port);
            _serverHealthCheckTimer.Start();
        }

        // 서버 헬스체크 (주기적으로 호출됨)
        private async Task CheckServerHealth(int port)
        {
            var elapsed = (DateTime.Now - _serverStartTime).TotalSeconds;

            // 타임아웃 체크
            if (elapsed > SERVER_CHECK_TIMEOUT_SECONDS)
            {
                UpdateStatus("ERROR: Server start timeout (180 seconds exceeded)");
                UpdateServerStatus("오류: 시간 초과");
                StopServerHealthCheck();
                StopServerProcess();
                Dispatcher.Invoke(() =>
                {
                    ServerProgressBar.Visibility = Visibility.Collapsed;
                    ConnectButton.IsEnabled = true;
                    StartServerButton.IsEnabled = true;
                });
                return;
            }

            // 진행률 계산 (시간 기반)
            int progressPercent = 0;
            string statusMessage = "시작 중...";

            if (elapsed < 15)
            {
                // 0-15초: 0% → 15% (초기화)
                progressPercent = (int)((elapsed / 15) * 15);
                statusMessage = $"시작 중... ⚙️ 초기화 중 ({elapsed:F1}초)";
            }
            else if (elapsed < 50)
            {
                // 15-50초: 15% → 40% (DB 마이그레이션)
                progressPercent = 15 + (int)(((elapsed - 15) / 35) * 25);
                statusMessage = $"시작 중... 🗄️ DB 마이그레이션 중 ({elapsed:F1}초)";
            }
            else if (elapsed < 100)
            {
                // 50-100초: 40% → 65% (서버 준비)
                progressPercent = 40 + (int)(((elapsed - 50) / 50) * 25);
                statusMessage = $"시작 중... 🚀 서버 준비 중 ({elapsed:F1}초)";
            }
            else if (elapsed < 150)
            {
                // 100-150초: 65% → 85% (포트 바인딩)
                progressPercent = 65 + (int)(((elapsed - 100) / 50) * 20);
                statusMessage = $"시작 중... 🔌 포트 바인딩 중 ({elapsed:F1}초)";
            }
            else
            {
                // 150초 이후: 85% → 95%
                progressPercent = Math.Min(95, 85 + (int)(((elapsed - 150) / 30) * 10));
                statusMessage = $"시작 중... 📚 라이브러리 로딩 중 ({elapsed:F1}초)";
            }

            Dispatcher.Invoke(() =>
            {
                ServerProgressBar.Value = progressPercent;
            });
            UpdateServerStatus($"{statusMessage} ({progressPercent}%)");

            // HTTP 요청으로 서버 응답 확인
            try
            {
                using (var httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(2) })
                {
                    var response = await httpClient.GetAsync($"http://127.0.0.1:{port}/");
                    if (response.IsSuccessStatusCode)
                    {
                        // 서버 응답 성공!
                        UpdateStatus($"✅ Server is ready! (Elapsed: {elapsed:F1} seconds)");
                        UpdateServerStatus("실행 중");
                        Dispatcher.Invoke(() =>
                        {
                            ServerProgressBar.Value = 100;
                            ServerProgressBar.Visibility = Visibility.Collapsed;
                            ConnectButton.IsEnabled = true; // 연결 버튼 활성화
                        });
                        StopServerHealthCheck();
                        return;
                    }
                }
            }
            catch
            {
                // 서버가 아직 준비 안 됨 (정상)
                // 계속 체크
            }
        }

        // 서버 헬스체크 중지
        private void StopServerHealthCheck()
        {
            if (_serverHealthCheckTimer != null)
            {
                _serverHealthCheckTimer.Stop();
                _serverHealthCheckTimer = null;
            }
        }

        private async void ConnectButton_Click(object sender, RoutedEventArgs e)
        {
            var serverUrl = ServerUrlTextBox.Text;
            if (string.IsNullOrWhiteSpace(serverUrl))
            {
                MessageBox.Show("Please enter a server URL.");
                return;
            }

            _webSocketService = new WebSocketService(serverUrl);
            _webSocketService.OnMessageReceived += HandleServerMessage;
            _apiHandler.Setup(_webSocketService, UpdateStatus, UpdateProgress, ResetProgress);

            try
            {
                UpdateStatus("Connecting to WebSocket server...");
                UpdateWebSocketStatus("연결 시도 중...");
                await _webSocketService.ConnectAsync();
                if (_webSocketService.IsConnected)
                {
                    UpdateStatus("Connected to server. Opening browser...");
                    UpdateWebSocketStatus("연결됨");
                    ConnectButton.IsEnabled = false;
                    DisconnectButton.IsEnabled = true;

                    try
                    {
                        string httpUrl = serverUrl.Replace("ws://", "http://").Split(new[] { "/ws/" }, StringSplitOptions.None)[0];
                        var psi = new ProcessStartInfo { FileName = httpUrl, UseShellExecute = true };
                        Process.Start(psi);
                    }
                    catch (Exception ex)
                    {
                        UpdateStatus($"Could not open browser: {ex.Message}");
                    }
                }
                else
                {
                    UpdateWebSocketStatus("연결 실패");
                    MessageBox.Show(
                        "Could not connect to the server.\n\n" +
                        "Please make sure:\n" +
                        "1. The server is running (Python manage.py runserver)\n" +
                        "2. Or click 'Start Server' button first\n" +
                        "3. The server URL is correct",
                        "Connection Failed",
                        MessageBoxButton.OK,
                        MessageBoxImage.Warning);
                }
            }
            catch (Exception ex)
            {
                UpdateStatus($"Failed to connect: {ex.Message}");
                UpdateWebSocketStatus("연결 실패");
                MessageBox.Show(
                    $"Connection error: {ex.Message}\n\n" +
                    "Please check if the server is running.",
                    "Connection Error",
                    MessageBoxButton.OK,
                    MessageBoxImage.Error);
            }
        }

        private async void DisconnectButton_Click(object sender, RoutedEventArgs e)
        {
            if (_webSocketService != null)
            {
                await _webSocketService.DisconnectAsync();
                _webSocketService = null;
            }
            UpdateStatus("Disconnected from WebSocket.");
            UpdateWebSocketStatus("연결 끊김");

            StopServerHealthCheck();
            StopServerProcess();

            ConnectButton.IsEnabled = true;
            DisconnectButton.IsEnabled = false;
            StartServerButton.IsEnabled = true;
            ResetProgress();
        }

        private void StopServerProcess()
        {
            if (_serverProcess != null && !_serverProcess.HasExited)
            {
                try
                {
                    UpdateStatus("Stopping server process...");
                    UpdateServerStatus("종료 중...");
                    // .Kill()은 프로세스를 강제 종료합니다.
                    _serverProcess.Kill();
                    _serverProcess.WaitForExit(5000);
                    UpdateStatus("Server process stopped.");
                    UpdateServerStatus("꺼짐");
                }
                catch (Exception ex)
                {
                    UpdateStatus($"Error stopping server process: {ex.Message}");
                    UpdateServerStatus("오류");
                }
                finally
                {
                    _serverProcess.Dispose();
                    _serverProcess = null;
                }
            }
        }

        private async void Window_Closing(object sender, System.ComponentModel.CancelEventArgs e)
        {
            if (_webSocketService != null && _webSocketService.IsConnected)
            {
                await _webSocketService.DisconnectAsync();
            }
            StopServerHealthCheck();
            StopServerProcess();
        }

        // --- 나머지 메서드는 변경 없음 ---
        public void UpdateProgress(int current, int total)
        {
            Dispatcher.Invoke(() => { if (total > 0 && current >= 0) { ProgressBar.Maximum = total; ProgressBar.Value = current; ProgressTextBlock.Text = $"{current} / {total} ({((double)current / total * 100):F0}%)"; } });
        }

        public void ResetProgress(string initialMessage = "Ready")
        {
            Dispatcher.Invoke(() => { ProgressBar.Value = 0; ProgressTextBlock.Text = initialMessage; });
        }

        private void HandleServerMessage(string message)
        {
            Dispatcher.Invoke(() => { try { var jsonMessage = JObject.Parse(message); if (jsonMessage.Value<string>("command") == "disconnected_by_server") { UpdateStatus("Disconnected by server. Please reconnect."); ConnectButton.IsEnabled = true; DisconnectButton.IsEnabled = false; return; } UpdateStatus($"Command received: {jsonMessage.Value<string>("command")}"); _apiHandler.LastCommandData = jsonMessage; _externalEvent.Raise(); } catch (Exception ex) { UpdateStatus($"Error processing message: {ex.Message}"); } });
        }

        private void UpdateStatus(string message)
        {
            Dispatcher.Invoke(() => { if (StatusTextBox.LineCount > 200) { StatusTextBox.Text = StatusTextBox.Text.Substring(StatusTextBox.Text.IndexOf('\n', 50) + 1); } StatusTextBox.AppendText($"[{DateTime.Now:HH:mm:ss}] {message}\n"); StatusTextBox.ScrollToEnd(); });
        }
    }
}