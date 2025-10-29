# Gemini 코드 동반 에이전트 컨텍스트

이 문서는 Gemini 코드 동반 에이전트가 프로젝트 구조, 기술 및 개발 규칙을 이해하는 데 필요한 컨텍스트를 제공합니다.

## 프로젝트 개요

이 프로젝트는 AEC(건축, 엔지니어링 및 건설) 산업을 위해 설계된 포괄적인 비용 추정기 애플리케이션입니다. 중앙 웹 애플리케이션과 Blender 및 Autodesk Revit과의 통합으로 구성됩니다.

프로젝트의 핵심은 **Django 웹 애플리케이션**입니다. 이 애플리케이션은 REST API를 제공하고 WebSockets(Django Channels를 통해)을 사용하여 클라이언트 애플리케이션과 실시간으로 통신합니다. 백엔드는 데이터 저장(SQLite 사용), 비즈니스 로직을 처리하고 프론트엔드를 제공합니다. 이 프로젝트에는 TensorFlow 및 Keras와 같은 머신러닝 라이브러리도 포함되어 있어 AI 기반 추정과 관련된 기능을 나타냅니다.

**프론트엔드**는 바닐라 JavaScript로 작성된 복잡한 단일 페이지 애플리케이션(SPA)입니다. 프로젝트 데이터를 관리하고, 수량 산출을 위한 규칙 세트를 정의하고, 비용 코드를 관리하고, 비용 추정을 수행하기 위한 풍부한 사용자 인터페이스를 제공합니다.

프로젝트에는 두 가지 주요 통합이 포함됩니다.

-   **Blender 애드온**: 이 애드온은 WebSockets를 통해 Django 서버에 연결됩니다. Blender 프로젝트에서 IFC 데이터(형상 및 속성)를 추출하여 서버로 보낼 수 있습니다. 또한 웹 애플리케이션이 Blender를 제어할 수 있도록 합니다(예: 3D 뷰에서 요소 선택).
-   **Revit 애드인**: 이것은 Autodesk Revit용 .NET 기반 애드인입니다. Blender 애드온과 유사하게 WebSockets를 통해 서버에 연결하여 Revit과 웹 애플리케이션 간의 데이터 교환 및 제어를 가능하게 합니다.

백엔드 서버는 Blender 및 Revit 애드인과 쉽게 배포할 수 있도록 PyInstaller를 사용하여 독립 실행형 실행 파일로 패키징되도록 설계되었습니다.

## 빌드 및 실행

### 백엔드 서버

백엔드는 Django 애플리케이션입니다.

**종속성:**

-   Python 종속성은 `requirements.txt`에 나열되어 있습니다. `pip install -r requirements.txt`를 사용하여 설치합니다.
-   프로젝트는 `.mddoyun` 디렉토리에 있는 가상 환경을 사용합니다.

**서버 실행:**

표준 Django `manage.py` 스크립트를 사용하여 개발 서버를 실행할 수 있습니다.

```bash
python manage.py runserver
```

또는 PyInstaller 빌드의 진입점이기도 한 `run_server.py` 스크립트를 사용할 수 있습니다.

```bash
python run_server.py
```

**실행 파일 빌드:**

`run_server.py` 파일에는 macOS 및 Windows용 PyInstaller를 사용하여 서버 실행 파일을 빌드하는 명령이 포함되어 있습니다.

macOS용:

```bash
pyinstaller --name "CostEstimatorServer" \
--onefile \
--add-data "db.sqlite3:." \
--add-data "aibim_quantity_takeoff_web:aibim_quantity_takeoff_web" \
--add-data "connections:connections" \
run_server.py
```

Windows용:

```bash
pyinstaller --name "CostEstimatorServer" --onefile --add-data "db.sqlite3;." --add-data "aibim_quantity_takeoff_web;aibim_quantity_takeoff_web" --add-data "connections;connections" run_server.py
```

### 프론트엔드

프론트엔드는 바닐라 JavaScript로 빌드됩니다. 프론트엔드에 대한 별도의 빌드 프로세스는 없습니다. 정적 파일(`app.js`와 같은)은 Django 애플리케이션에서 직접 제공됩니다.

### Blender 애드온

Blender 애드온은 `CostEstimator_BlenderAddon_453` 디렉토리에 있습니다. 이를 사용하려면 이 디렉토리를 Blender 애드온으로 설치해야 합니다. 애드온에는 미리 빌드된 서버 실행 파일이 포함되어 있습니다.

### Revit 애드인

Revit 애드인은 `CostEstimator_RevitAddin_2026` 디렉토리에 있는 .NET 프로젝트입니다. Visual Studio 또는 .NET CLI를 사용하여 빌드할 수 있습니다. 프로젝트는 성공적인 빌드 시 필요한 파일을 Revit 애드인 디렉토리에 복사하도록 구성되어 있습니다.

## 개발 규칙

-   **Python:** Python 코드는 표준 Django 규칙을 따릅니다.
-   **JavaScript:** 프론트엔드 코드는 여러 JavaScript 파일로 모듈화되어 있습니다. 최신 프레임워크를 사용하지 않으므로 일관성을 유지하기 위해 변경 사항을 신중하게 적용해야 합니다.
-   **Blender/Revit:** 애드온/애드인 코드는 각 플랫폼의 규칙 및 모범 사례를 따라야 합니다.
-   **WebSockets:** 클라이언트(Blender, Revit, 웹 프론트엔드)와 서버 간의 통신은 WebSockets를 통한 JSON 메시지로 이루어집니다. 메시지 형식은 일관성을 유지해야 합니다.
