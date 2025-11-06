#
# 블렌더 애드온 최종 수정 코드
#
import sys
import os
import traceback
import platform #<-- 운영체제 감지를 위해 추가

# --- ▼▼▼ [핵심 수정] 라이브러리 경로 추가 코드를 맨 위로 이동 ▼▼▼ ---
# 1. 애드온의 루트 디렉토리(__file__가 있는 곳)를 기준으로 'lib' 폴더의 절대 경로를 생성합니다.
lib_dir = os.path.join(os.path.dirname(__file__), 'lib')

# 2. 생성된 경로를 파이썬 모듈 검색 경로 리스트(sys.path)에 추가합니다.
#    이렇게 하면 'lib' 폴더 안에 있는 'websockets' 같은 라이브러리를 import 할 수 있게 됩니다.
if lib_dir not in sys.path:
    sys.path.append(lib_dir)
# --- ▲▲▲ 여기까지가 핵심 수정입니다 ▲▲▲ ---

# --- 이제 외부 라이브러리를 import 합니다. ---
import bpy
import json
import ifcopenshell
import ifcopenshell.api
import asyncio
import threading
import websockets # <- 이제 이 import가 정상적으로 동작합니다.
from bpy.app.handlers import persistent
import io
import subprocess
import time
import urllib.request
import webbrowser
import queue  # Add standard queue module for thread-safe communication


bl_info = {
    "name": "Cost Estimator Connector", "author": "AI Assistant & User",
    "description": "Cost Estimator 웹 애플리케이션과 실시간으로 통신합니다.",
    "blender": (4, 2, 0), "version": (1, 2, 0), # 버전 업데이트
    "location": "3D 뷰 > 사이드바(N) > Cost Estimator", "category": "Object",
}

# --- 전역 변수 관리 ---
websocket_client = None
event_queue = queue.Queue()  # Use standard queue for thread-safe communication
status_message = "연결 대기 중..."
websocket_thread_loop = None

server_process = None
server_status = "서버 꺼짐" # "서버 꺼짐", "시작 중...", "실행 중", "오류"
SERVER_CHECK_TIMEOUT = 30 


def schedule_blender_task(task_callable, *args, **kwargs):
    def safe_task():
        try: task_callable(*args, **kwargs)
        except Exception as e: print(f"Blender 작업 실행 오류: {e}")
        return None
    bpy.app.timers.register(safe_task)


def stop_server_process():
    """백그라운드에서 실행 중인 Django 서버 프로세스를 종료합니다."""
    global server_process, server_status
    if server_process and server_process.poll() is None:
        print("🔌 [Blender] Django 서버 프로세스를 종료합니다...")
        try:
            server_process.terminate() 
            server_process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            server_process.kill() 
            print("🛑 [Blender] 서버 프로세스가 응답하지 않아 강제 종료했습니다.")
        except Exception as e:
            print(f"서버 프로세스 종료 중 오류: {e}")
        
    server_process = None
    server_status = "서버 꺼짐"
    print("✅ [Blender] 서버가 성공적으로 종료되었습니다.")


def get_ifc_file():
    try:
        ifc_file_path = bpy.data.scenes["Scene"].BIMProperties.ifc_file
        if not ifc_file_path or not os.path.exists(ifc_file_path):
            return None, "IFC 파일 경로를 찾을 수 없습니다. BlenderBIM 프로젝트를 확인하세요."
        return ifcopenshell.open(ifc_file_path), None
    except Exception as e:
        print(f"IFC 파일을 여는 데 실패했습니다: {e}")
        return None, f"IFC 파일을 여는 데 실패했습니다: {e}"

def get_quantity_value(quantity):
    if quantity.is_a("IfcQuantityArea"): return quantity.AreaValue
    if quantity.is_a("IfcQuantityLength"): return quantity.LengthValue
    if quantity.is_a("IfcQuantityVolume"): return quantity.VolumeValue
    if quantity.is_a("IfcQuantityCount"): return quantity.CountValue
    if quantity.is_a("IfcQuantityWeight"): return quantity.WeightValue
    return None

def serialize_ifc_elements_to_string_list(ifc_file):
    import ifcopenshell.geom  # Import geometry module
    import ifcopenshell.util.shape # Import shape utility module
    elements_data = []
    products = ifc_file.by_type("IfcProduct")
    print(f"🔍 [Blender] {len(products)}개의 IFC 객체 데이터 직렬화를 시작합니다.") # 디버깅 추가

    # Geometry settings
    settings = ifcopenshell.geom.settings()
    
    for element in products:
        if not element.GlobalId: continue
        element_dict = {
            "Name": element.Name or "이름 없음",
            "IfcClass": element.is_a(),
            "ElementId": element.id(),
            "UniqueId": element.GlobalId,
            "Tag": getattr(element, 'Tag', None) or "",  # ▼▼▼ [추가] Tag 속성 추출 (2025-11-05) ▼▼▼
            "PredefinedType": getattr(element, 'PredefinedType', None) or "",  # ▼▼▼ [추가] PredefinedType 속성 추출 (2025-11-05) ▼▼▼
            "Attributes": {},           # IFC 기본 속성들
            "PropertySet": {},          # Property Sets (Pset_*)
            "QuantitySet": {},          # Quantity Sets (Qto_*)
            "Spatial_Container": {},    # 공간 컨테이너 정보
            "Aggregates_Whole": {},     # 집합 관계 - 전체 객체 정보
            "Aggregates_Parts": {},     # 집합 관계 - 부분 객체들 정보
            "Nest_Host": {},            # Nest 관계 - 호스트 정보
            "Nest_Components": {},      # Nest 관계 - 구성요소들 정보
            "Type": {},                 # 타입 정보
            "System": {},               # 시스템 정보 (웹에서 추가)
        }

        # ▼▼▼ IFC 요소의 모든 Attributes 동적 추출 ▼▼▼
        # element.get_info()는 모든 IFC 속성을 딕셔너리로 반환
        # GlobalId, Name, Description, ObjectType, Tag, PredefinedType 등 포함
        info = element.get_info()

        for attr_name, attr_value in info.items():
            # 내부 속성만 제외 (type, id는 내부용, GlobalId는 UniqueId로 이미 저장)
            if attr_name in ['type', 'id', 'GlobalId']:
                continue

            # 관계형 속성은 제외 (별도 섹션에서 처리)
            # 리스트/튜플이면서 대문자로 시작하는 것들 (IsDefinedBy, ContainsElements 등)
            if isinstance(attr_value, (list, tuple)) and attr_name[0].isupper():
                continue

            # 모든 Attributes를 추가 (None 값도 포함 - 속성이 있다는 것 자체가 의미)
            if hasattr(attr_value, 'is_a'):
                # IFC 엔티티 참조인 경우
                element_dict["Attributes"][attr_name] = f"{attr_value.is_a()}: {getattr(attr_value, 'Name', str(attr_value))}"
            elif attr_value is not None:
                # 일반 값
                element_dict["Attributes"][attr_name] = attr_value
            else:
                # None 값도 저장 (속성이 정의되어 있다는 정보)
                element_dict["Attributes"][attr_name] = None

        print(f"[DEBUG] Element {element.id()} Attributes extracted: {list(element_dict['Attributes'].keys())}")
        # ▲▲▲ Attributes 추출 끝 ▲▲▲
        
        # Add Geometry Data
        try:
            shape = ifcopenshell.geom.create_shape(settings, element)

            # Use ifcopenshell.util.shape to get verts and faces reliably
            verts = ifcopenshell.util.shape.get_vertices(shape.geometry)
            faces = ifcopenshell.util.shape.get_faces(shape.geometry)

            # Extract transformation matrix
            matrix = None
            try:
                trans = shape.transformation
                if trans:
                    trans_type = str(type(trans))
                    print(f"[DEBUG] Element {element.id()} trans type: {trans_type}")

                    # Try to get attributes safely
                    try:
                        attrs = [x for x in dir(trans) if not x.startswith('_')]
                        print(f"[DEBUG] Element {element.id()} attrs: {attrs}")
                    except:
                        print(f"[DEBUG] Element {element.id()} could not get attributes")

                    # Method 1: Try trans.matrix
                    if hasattr(trans, 'matrix'):
                        try:
                            trans_matrix = trans.matrix
                            print(f"[DEBUG] Element {element.id()} trans.matrix type: {type(trans_matrix)}")

                            # Try 2D array access (4x4)
                            matrix = []
                            for i in range(4):
                                for j in range(4):
                                    matrix.append(float(trans_matrix[i][j]))
                            print(f"[DEBUG] Element {element.id()} extracted via [i][j], length: {len(matrix)}")
                        except Exception as e1:
                            print(f"[DEBUG] Element {element.id()} [i][j] failed: {e1}")
                            # Try flat access (16 elements)
                            try:
                                matrix = [float(trans_matrix[i]) for i in range(16)]
                                print(f"[DEBUG] Element {element.id()} extracted via [i], length: {len(matrix)}")
                            except Exception as e2:
                                print(f"[DEBUG] Element {element.id()} [i] failed: {e2}")
                                matrix = None

                    # Method 2: Try trans.data
                    if not matrix and hasattr(trans, 'data'):
                        try:
                            matrix = list(trans.data)
                            print(f"[DEBUG] Element {element.id()} extracted via .data, length: {len(matrix)}")
                        except Exception as e:
                            print(f"[DEBUG] Element {element.id()} .data failed: {e}")

                    if matrix and len(matrix) == 12:
                        # 3x4 matrix, convert to 4x4
                        matrix = [
                            matrix[0], matrix[1], matrix[2], 0,
                            matrix[3], matrix[4], matrix[5], 0,
                            matrix[6], matrix[7], matrix[8], 0,
                            matrix[9], matrix[10], matrix[11], 1
                        ]
                        print(f"[DEBUG] Element {element.id()} converted 3x4 to 4x4")

                    if matrix and len(matrix) == 16:
                        print(f"[DEBUG] Element {element.id()} SUCCESS - matrix ready, length: {len(matrix)}")
                    else:
                        print(f"[WARN] Element {element.id()} - no valid matrix extracted")
                        matrix = None
            except Exception as matrix_error:
                print(f"[ERROR] Matrix extraction failed for element {element.id()}: {str(matrix_error)}")
                matrix = None

            # ▼▼▼ 색상 및 재질 정보 추출 ▼▼▼
            colors = None
            materials = {}

            try:
                # IFC 스타일 색상 정보 추출
                if hasattr(shape, 'styles') and shape.styles:
                    # shape.styles는 (style_id, surface_style) 튜플 리스트
                    for style_id, surface_style in shape.styles:
                        if surface_style and hasattr(surface_style, 'Styles'):
                            for style in surface_style.Styles:
                                # IfcSurfaceStyleShading 또는 IfcSurfaceStyleRendering (Rendering은 Shading의 하위 클래스)
                                if style.is_a('IfcSurfaceStyleShading') or style.is_a('IfcSurfaceStyleRendering'):
                                    # Diffuse 색상 추출
                                    if hasattr(style, 'SurfaceColour') and style.SurfaceColour:
                                        color = style.SurfaceColour
                                        materials['diffuse_color'] = [
                                            float(getattr(color, 'Red', 0.8)),
                                            float(getattr(color, 'Green', 0.8)),
                                            float(getattr(color, 'Blue', 0.8))
                                        ]

                                    # Transparency 정보
                                    if hasattr(style, 'Transparency') and style.Transparency is not None:
                                        materials['transparency'] = float(style.Transparency)

                                    # Reflectance method (IfcSurfaceStyleRendering에만 있음)
                                    if hasattr(style, 'ReflectanceMethod'):
                                        materials['reflectance_method'] = str(style.ReflectanceMethod)

                                    # Specular color (IfcSurfaceStyleRendering에만 있음)
                                    if hasattr(style, 'SpecularColour') and style.SpecularColour:
                                        spec_color = style.SpecularColour
                                        materials['specular_color'] = [
                                            float(getattr(spec_color, 'Red', 0.0)),
                                            float(getattr(spec_color, 'Green', 0.0)),
                                            float(getattr(spec_color, 'Blue', 0.0))
                                        ]

                                    # Style name 추출
                                    if hasattr(surface_style, 'Name') and surface_style.Name:
                                        materials['style_name'] = surface_style.Name

                # Material name 추출 (IfcMaterial 관계에서)
                # 그리고 Material → MaterialDefinitionRepresentation → StyledItem → SurfaceStyle 경로 탐색
                if hasattr(element, 'HasAssociations'):
                    for association in element.HasAssociations:
                        if association.is_a('IfcRelAssociatesMaterial'):
                            material = association.RelatingMaterial
                            if material:
                                # Material 객체 저장 (나중에 스타일 추출에 사용)
                                actual_material = None

                                if material.is_a('IfcMaterial'):
                                    materials['name'] = material.Name or 'Unknown'
                                    actual_material = material
                                elif material.is_a('IfcMaterialLayerSetUsage'):
                                    if hasattr(material, 'ForLayerSet') and material.ForLayerSet:
                                        layer_set = material.ForLayerSet
                                        if hasattr(layer_set, 'MaterialLayers') and layer_set.MaterialLayers:
                                            # 첫 번째 레이어의 재질 이름
                                            first_layer = layer_set.MaterialLayers[0]
                                            if hasattr(first_layer, 'Material') and first_layer.Material:
                                                materials['name'] = first_layer.Material.Name or 'Unknown'
                                                actual_material = first_layer.Material

                                # ▼▼▼ Material에서 Style 정보 추출 (Material → MaterialDefinitionRepresentation 경로) ▼▼▼
                                if actual_material and hasattr(actual_material, 'HasRepresentation'):
                                    for mat_rep in actual_material.HasRepresentation:
                                        if mat_rep.is_a('IfcMaterialDefinitionRepresentation'):
                                            for representation in mat_rep.Representations:
                                                if representation.is_a('IfcStyledRepresentation'):
                                                    for item in representation.Items:
                                                        if item.is_a('IfcStyledItem'):
                                                            # StyledItem에서 Styles 추출
                                                            if hasattr(item, 'Styles') and item.Styles:
                                                                for style_select in item.Styles:
                                                                    if style_select.is_a('IfcSurfaceStyle'):
                                                                        # Surface Style 이름 추출
                                                                        if hasattr(style_select, 'Name') and style_select.Name:
                                                                            materials['style_name'] = style_select.Name

                                                                        # Surface Style의 Styles 리스트에서 색상/투명도 추출
                                                                        if hasattr(style_select, 'Styles') and style_select.Styles:
                                                                            for surface_style_element in style_select.Styles:
                                                                                # IfcSurfaceStyleShading 또는 IfcSurfaceStyleRendering
                                                                                if surface_style_element.is_a('IfcSurfaceStyleShading') or surface_style_element.is_a('IfcSurfaceStyleRendering'):
                                                                                    # Diffuse 색상 추출
                                                                                    if hasattr(surface_style_element, 'SurfaceColour') and surface_style_element.SurfaceColour:
                                                                                        color = surface_style_element.SurfaceColour
                                                                                        materials['diffuse_color'] = [
                                                                                            float(getattr(color, 'Red', 0.8)),
                                                                                            float(getattr(color, 'Green', 0.8)),
                                                                                            float(getattr(color, 'Blue', 0.8))
                                                                                        ]
                                                                                        print(f"[DEBUG] Extracted style color from Material->StyledRepresentation: RGB({materials['diffuse_color']})")

                                                                                    # Transparency 정보
                                                                                    if hasattr(surface_style_element, 'Transparency') and surface_style_element.Transparency is not None:
                                                                                        materials['transparency'] = float(surface_style_element.Transparency)
                                                                                        print(f"[DEBUG] Extracted transparency from Material->StyledRepresentation: {materials['transparency']}")

                                                                                    # Reflectance method (IfcSurfaceStyleRendering에만 있음)
                                                                                    if hasattr(surface_style_element, 'ReflectanceMethod'):
                                                                                        materials['reflectance_method'] = str(surface_style_element.ReflectanceMethod)

                                                                                    # Specular color (IfcSurfaceStyleRendering에만 있음)
                                                                                    if hasattr(surface_style_element, 'SpecularColour') and surface_style_element.SpecularColour:
                                                                                        spec_color = surface_style_element.SpecularColour
                                                                                        materials['specular_color'] = [
                                                                                            float(getattr(spec_color, 'Red', 0.0)),
                                                                                            float(getattr(spec_color, 'Green', 0.0)),
                                                                                            float(getattr(spec_color, 'Blue', 0.0))
                                                                                        ]
                                # ▲▲▲ Material에서 Style 정보 추출 끝 ▲▲▲

                # 기본 색상이 없으면 회색 설정
                if 'diffuse_color' not in materials:
                    materials['diffuse_color'] = [0.8, 0.8, 0.8]

            except Exception as color_error:
                print(f"[WARN] Color/Material extraction failed for element {element.id()}: {str(color_error)}")
                materials['diffuse_color'] = [0.8, 0.8, 0.8]  # 기본 회색
            # ▲▲▲ 색상 및 재질 정보 추출 끝 ▲▲▲

            element_dict["System"]["Geometry"] = {
                "verts": verts.tolist(), # Use .tolist() for robust conversion
                "faces": faces.tolist(),  # Use .tolist() for robust conversion
                "matrix": matrix,  # Add transformation matrix
                "materials": materials  # ▼▼▼ [추가] 재질 및 색상 정보 ▼▼▼
            }
        except Exception as e:
            print(f"Could not get geometry for element {element.id()}: {e}")
            element_dict["System"]["Geometry"] = None

        is_spatial_element = element.is_a("IfcSpatialStructureElement")
        try:
            # ▼▼▼ PropertySet 추출 ▼▼▼
            if hasattr(element, 'IsDefinedBy') and element.IsDefinedBy:
                for definition in element.IsDefinedBy:
                    if definition.is_a("IfcRelDefinesByProperties"):
                        prop_set = definition.RelatingPropertyDefinition
                        if prop_set and prop_set.is_a("IfcPropertySet"):
                            if hasattr(prop_set, 'HasProperties') and prop_set.HasProperties:
                                for prop in prop_set.HasProperties:
                                    if prop.is_a("IfcPropertySingleValue"):
                                        prop_key = f"{prop_set.Name}__{prop.Name}"
                                        element_dict["PropertySet"][prop_key] = prop.NominalValue.wrappedValue if prop.NominalValue else None

            # ▼▼▼ QuantitySet 추출 ▼▼▼
            if not is_spatial_element:
                if hasattr(element, 'IsDefinedBy') and element.IsDefinedBy:
                    for definition in element.IsDefinedBy:
                        if definition.is_a("IfcRelDefinesByProperties"):
                            prop_set = definition.RelatingPropertyDefinition
                            if prop_set and prop_set.is_a("IfcElementQuantity"):
                                if hasattr(prop_set, 'Quantities') and prop_set.Quantities:
                                    for quantity in prop_set.Quantities:
                                        prop_value = get_quantity_value(quantity)
                                        if prop_value is not None:
                                            prop_key = f"{prop_set.Name}__{quantity.Name}"
                                            element_dict["QuantitySet"][prop_key] = prop_value

            # ▼▼▼ Type 정보 추출 (확장: Attributes 포함) ▼▼▼
            if hasattr(element, 'IsTypedBy') and element.IsTypedBy:
                type_definition = element.IsTypedBy[0]
                if type_definition and type_definition.is_a("IfcRelDefinesByType"):
                    relating_type = type_definition.RelatingType
                    if relating_type:
                        # 기본 Type 정보
                        element_dict["Type"]["Name"] = relating_type.Name
                        element_dict["Type"]["IfcClass"] = relating_type.is_a()

                        # ▼▼▼ [NEW] Type Attributes 추출 ▼▼▼
                        element_dict["Type"]["Attributes"] = {}
                        type_info = relating_type.get_info()

                        for attr_name, attr_value in type_info.items():
                            # 내부 속성 제외
                            if attr_name in ['type', 'id', 'GlobalId']:
                                continue

                            # 관계형 속성 제외 (리스트/튜플이면서 대문자 시작)
                            if isinstance(attr_value, (list, tuple)) and attr_name[0].isupper():
                                continue

                            # Attributes 추가
                            if hasattr(attr_value, 'is_a'):
                                # IFC 엔티티 참조
                                element_dict["Type"]["Attributes"][attr_name] = f"{attr_value.is_a()}: {getattr(attr_value, 'Name', str(attr_value))}"
                            elif attr_value is not None:
                                element_dict["Type"]["Attributes"][attr_name] = attr_value
                            else:
                                element_dict["Type"]["Attributes"][attr_name] = None

                        print(f"[DEBUG] Type {relating_type.id()} Attributes extracted: {list(element_dict['Type']['Attributes'].keys())}")
                        # ▲▲▲ [NEW] Type Attributes 추출 끝 ▲▲▲

                        # Type의 PropertySets 추출
                        element_dict["Type"]["PropertySet"] = {}
                        if hasattr(relating_type, 'HasPropertySets') and relating_type.HasPropertySets:
                            for prop_set in relating_type.HasPropertySets:
                                if prop_set and prop_set.is_a("IfcPropertySet"):
                                    if hasattr(prop_set, 'HasProperties') and prop_set.HasProperties:
                                        for prop in prop_set.HasProperties:
                                            if prop.is_a("IfcPropertySingleValue"):
                                                prop_key = f"{prop_set.Name}__{prop.Name}"
                                                element_dict["Type"]["PropertySet"][prop_key] = prop.NominalValue.wrappedValue if prop.NominalValue else None

            # ▼▼▼ Spatial Container 정보 추출 ▼▼▼
            if hasattr(element, 'ContainedInStructure') and element.ContainedInStructure:
                relating_structure = element.ContainedInStructure[0].RelatingStructure
                element_dict["Spatial_Container"]["IfcClass"] = relating_structure.is_a()
                element_dict["Spatial_Container"]["Name"] = relating_structure.Name
                element_dict["Spatial_Container"]["GlobalId"] = relating_structure.GlobalId

            # ▼▼▼ Aggregates (Decomposes) 정보 추출 ▼▼▼
            if hasattr(element, 'Decomposes') and element.Decomposes:
                relating_object = element.Decomposes[0].RelatingObject
                element_dict["Aggregates_Whole"]["IfcClass"] = relating_object.is_a()
                element_dict["Aggregates_Whole"]["Name"] = relating_object.Name
                element_dict["Aggregates_Whole"]["GlobalId"] = relating_object.GlobalId

            # ▼▼▼ Aggregates Parts (IsDecomposedBy) 정보 추출 ▼▼▼
            if hasattr(element, 'IsDecomposedBy') and element.IsDecomposedBy:
                parts = []
                for decomposition in element.IsDecomposedBy:
                    if hasattr(decomposition, 'RelatedObjects'):
                        for part in decomposition.RelatedObjects:
                            parts.append({
                                "IfcClass": part.is_a(),
                                "Name": part.Name,
                                "GlobalId": part.GlobalId
                            })
                if parts:
                    element_dict["Aggregates_Parts"]["Parts"] = parts

            # ▼▼▼ Nest Host 정보 추출 ▼▼▼
            if hasattr(element, 'Nests') and element.Nests:
                relating_object = element.Nests[0].RelatingObject
                element_dict["Nest_Host"]["IfcClass"] = relating_object.is_a()
                element_dict["Nest_Host"]["Name"] = relating_object.Name
                element_dict["Nest_Host"]["GlobalId"] = relating_object.GlobalId

            # ▼▼▼ Nest Components (IsNestedBy) 정보 추출 ▼▼▼
            if hasattr(element, 'IsNestedBy') and element.IsNestedBy:
                components = []
                for nesting in element.IsNestedBy:
                    if hasattr(nesting, 'RelatedObjects'):
                        for component in nesting.RelatedObjects:
                            components.append({
                                "IfcClass": component.is_a(),
                                "Name": component.Name,
                                "GlobalId": component.GlobalId
                            })
                if components:
                    element_dict["Nest_Components"]["Components"] = components

        except (AttributeError, IndexError, TypeError) as e:
            print(f"[WARN] Error extracting properties for element {element.id()}: {e}")

        # ▼▼▼ [DEBUG] System.Geometry.materials 확인 ▼▼▼
        geometry = element_dict.get("System", {}).get("Geometry")
        if geometry and isinstance(geometry, dict) and geometry.get("materials"):
            mat = geometry["materials"]
            print(f"[DEBUG] Element {element.id()} serializing with materials: color={mat.get('diffuse_color')}, transparency={mat.get('transparency')}, style={mat.get('style_name')}, name={mat.get('name')}")
        # ▲▲▲ [DEBUG] 끝 ▲▲▲

        elements_data.append(json.dumps(element_dict))
    print(f"✅ [Blender] 객체 데이터 직렬화 완료.") # 디버깅 추가
    return elements_data
def get_selected_element_guids():
    guids = []
    ifc_file, error = get_ifc_file()
    if error: return guids
    for obj in bpy.context.selected_objects:
        if hasattr(obj, "BIMObjectProperties") and hasattr(obj.BIMObjectProperties, "ifc_definition_id"):
            step_id = obj.BIMObjectProperties.ifc_definition_id
            if step_id:
                element = ifc_file.by_id(step_id)
                if element and element.GlobalId: guids.append(element.GlobalId)
    return guids

def select_elements_by_guids(guids):
    if not guids:
        bpy.ops.object.select_all(action='DESELECT')
        return
    ifc_file, error = get_ifc_file()
    if error: return
    target_step_ids = {ifc_file.by_guid(guid).id() for guid in guids if ifc_file.by_guid(guid)}
    if not target_step_ids: return
    bpy.ops.object.select_all(action='DESELECT')
    target_objects = []
    for obj in bpy.context.scene.objects:
        if hasattr(obj, "BIMObjectProperties") and hasattr(obj.BIMObjectProperties, "ifc_definition_id"):
            if obj.BIMObjectProperties.ifc_definition_id in target_step_ids:
                obj.select_set(True)
                target_objects.append(obj)
    if target_objects:
        bpy.context.view_layer.objects.active = target_objects[0]
        for area in bpy.context.screen.areas:
            if area.type == 'VIEW_3D':
                override = {'area': area, 'region': next(r for r in area.regions if r.type == 'WINDOW')}
                with bpy.context.temp_override(**override): bpy.ops.view3d.view_selected(use_all_regions=False)
                break

def send_message_to_server(message_dict):
    if websocket_client and websocket_thread_loop: asyncio.run_coroutine_threadsafe(websocket_client.send(json.dumps(message_dict)), websocket_thread_loop)

async def websocket_handler(uri):
    global websocket_client, status_message
    try:
        print(f"[DEBUG] Attempting to connect to {uri}")
        async with websockets.connect(uri) as websocket:
            websocket_client = websocket
            status_message = "서버에 연결되었습니다."
            print("[DEBUG] WebSocket connected successfully")
            while True:
                try:
                    message_str = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    message_data = json.loads(message_str)
                    print(f"[DEBUG] Received message: {message_data.get('command', 'unknown')}")
                    event_queue.put(message_data)  # Use standard queue.put() instead of await
                    print(f"[DEBUG] Message added to queue")
                except asyncio.TimeoutError: continue
                except websockets.exceptions.ConnectionClosed:
                    print("[DEBUG] WebSocket connection closed")
                    break
    except Exception as e:
        status_message = f"연결 실패: {e}"
        print(f"[ERROR] WebSocket connection failed: {e}")
        traceback.print_exc()
    finally:
        status_message = "연결이 끊어졌습니다."
        websocket_client = None
        print("[DEBUG] WebSocket handler finished")

def run_websocket_in_thread(uri):
    def loop_in_thread():
        global websocket_thread_loop
        loop = asyncio.new_event_loop(); asyncio.set_event_loop(loop)
        websocket_thread_loop = loop
        loop.run_until_complete(websocket_handler(uri))
        loop.close()
    thread = threading.Thread(target=loop_in_thread, daemon=True); thread.start()

timer_call_count = 0
last_timer_tick_time = 0

def watchdog_timer():
    """타이머가 정지되었는지 확인하고 재등록하는 감시 타이머"""
    global last_timer_tick_time, timer_call_count

    import time
    current_time = time.time()

    # 메인 타이머가 1초 이상 응답이 없으면 재등록
    if current_time - last_timer_tick_time > 1.0:
        if not bpy.app.timers.is_registered(process_event_queue_timer):
            print(f"[WATCHDOG] Main timer is dead (last tick: {timer_call_count}). Re-registering...")
            try:
                bpy.app.timers.register(process_event_queue_timer)
                print("[WATCHDOG] Successfully re-registered main timer")
            except Exception as e:
                print(f"[WATCHDOG ERROR] Failed to re-register: {e}")
        else:
            print(f"[WATCHDOG] Timer registered but not ticking (last: {timer_call_count})")

    return 0.5  # Check every 0.5 seconds

def process_event_queue_timer():
    global timer_call_count, last_timer_tick_time
    timer_call_count += 1

    # ▼▼▼ [추가] 타이머 활동 시간 업데이트 (watchdog용) ▼▼▼
    import time
    last_timer_tick_time = time.time()
    # ▲▲▲ [추가] 여기까지 ▲▲▲

    # ▼▼▼ [추가] 타이머가 해제되었는지 확인하고 재등록 ▼▼▼
    if not bpy.app.timers.is_registered(process_event_queue_timer):
        print("[WARN] Timer was unregistered! Re-registering...")
        bpy.app.timers.register(process_event_queue_timer)
        return 0.1
    # ▲▲▲ [추가] 여기까지 ▲▲▲

    # ▼▼▼ [CRITICAL FIX] 전체를 try로 감싸고 qsize() 제거 ▼▼▼
    try:
        # qsize()는 스레드 간 충돌 가능성 있음 - empty() 사용
        is_empty = event_queue.empty()

        if timer_call_count % 10 == 0 or not is_empty:
            print(f"[DEBUG] Timer tick #{timer_call_count}, queue empty: {is_empty}")

        if not is_empty:
            print(f"[DEBUG] Queue has messages (timer call #{timer_call_count})")

        while not event_queue.empty():
            try:
                command_data = event_queue.get_nowait()
                command = command_data.get("command")
                print(f"[DEBUG] Processing command: {command}")
                if command == "fetch_all_elements_chunked":
                    print("[DEBUG] Scheduling handle_fetch_all_elements")
                    schedule_blender_task(handle_fetch_all_elements, command_data)
                elif command == "get_selection":
                    print("[DEBUG] Scheduling handle_get_selection")
                    schedule_blender_task(handle_get_selection)
                elif command == "select_elements":
                    print("[DEBUG] Scheduling select_elements_by_guids")
                    schedule_blender_task(select_elements_by_guids, command_data.get("unique_ids", []))
                else:
                    print(f"[WARN] Unknown command: {command}")
            except queue.Empty:
                break  # 큐가 비었으면 종료
    except Exception as e:
        print(f"[ERROR] 타이머 오류 (계속 실행됨): {e}")
        traceback.print_exc()
    # ▲▲▲ [CRITICAL FIX] 예외 발생해도 반드시 return 0.1 실행 ▲▲▲
    return 0.1

def handle_fetch_all_elements(command_data):
    global status_message
    print("[DEBUG] handle_fetch_all_elements called")
    if not websocket_client:
        print("[ERROR] websocket_client is None")
        return
    project_id = command_data.get("project_id")
    print(f"[DEBUG] Fetching elements for project: {project_id}")
    status_message = "IFC 데이터 추출 중..."
    ifc_file, error = get_ifc_file()
    if error:
        status_message = error
        # Send error message to server
        send_message_to_server({
            "type": "fetch_progress_complete",
            "payload": {"total_sent": 0, "error": error}
        })
        print(f"[ERROR] {error}")
        return

    elements_data = serialize_ifc_elements_to_string_list(ifc_file)
    total_elements = len(elements_data)
    send_message_to_server({"type": "fetch_progress_start", "payload": {"total_elements": total_elements, "project_id": project_id}})
    status_message = f"{total_elements}개 객체 전송 중..."
    chunk_size = 100
    for i in range(0, total_elements, chunk_size):
        chunk = elements_data[i:i+chunk_size]
        processed_count = i + len(chunk)
        send_message_to_server({"type": "fetch_progress_update", "payload": {"project_id": project_id, "processed_count": processed_count, "elements": chunk}})
    send_message_to_server({"type": "fetch_progress_complete", "payload": {"total_sent": total_elements}})
    status_message = "데이터 전송 완료."

def handle_get_selection():
    selected_guids = get_selected_element_guids()
    send_message_to_server({"type": "revit_selection_response", "payload": selected_guids})
    global status_message; status_message = f"{len(selected_guids)}개 객체 선택 정보 전송."


start_time = 0
def check_server_status():
    """0.5초마다 서버 상태를 확인하는 타이머 함수"""
    global server_status, start_time

    if time.time() - start_time > SERVER_CHECK_TIMEOUT:
        print("🛑 [Blender] 서버 시작 시간 초과.")
        server_status = "오류: 시간 초과"
        stop_server_process()
        return None 

    try:
        uri = bpy.context.scene.costestimator_server_url
        base_address = uri.replace("ws://", "http://").replace("wss://", "").split("/ws/")[0]
        with urllib.request.urlopen(base_address, timeout=1) as response:
            if response.status == 200:
                print("✅ [Blender] 서버가 성공적으로 실행되었습니다.")
                server_status = "실행 중"
                return None 
    except Exception:
        return 0.5 

# --- ▼▼▼ [핵심 수정] 서버 시작 Operator 수정 ▼▼▼ ---
class COSTESTIMATOR_OT_StartServer(bpy.types.Operator):
    bl_idname = "costestimator.start_server"
    bl_label = "로컬 서버 시작"
    bl_description = "Cost Estimator 웹 서버를 백그라운드에서 실행합니다."

    def execute(self, context):
        global server_process, server_status, start_time
        if server_process and server_process.poll() is None:
            self.report({'WARNING'}, "서버가 이미 실행 중입니다.")
            return {'CANCELLED'}

        addon_dir = os.path.dirname(__file__)
        executable_path = None

        # 1. 운영체제를 확인하고 그에 맞는 실행 파일 경로를 설정합니다.
        if platform.system() == "Windows":
            executable_path = os.path.join(addon_dir, "server_win", "CostEstimatorServer.exe")
        elif platform.system() == "Darwin": # "Darwin"은 macOS의 공식 명칭입니다.
            executable_path = os.path.join(addon_dir, "server_mac", "CostEstimatorServer")
        else:
            self.report({'ERROR'}, f"지원하지 않는 운영체제입니다: {platform.system()}")
            return {'CANCELLED'}
        
        # 2. 실행 파일이 실제로 존재하는지 확인합니다.
        if not os.path.exists(executable_path):
            msg = f"실행 파일을 찾을 수 없습니다: {executable_path}"
            self.report({'ERROR'}, msg)
            server_status = "오류: 파일 없음"
            return {'CANCELLED'}

        try:
            # 3. macOS인 경우, 실행 권한을 부여합니다. (최초 1회만 필요)
            if platform.system() == "Darwin":
                try:
                    # 'chmod +x'와 동일한 효과
                    os.chmod(executable_path, 0o755)
                    print(f"macOS 실행 권한을 설정했습니다: {executable_path}")
                except Exception as e:
                    print(f"경고: 실행 권한 설정에 실패했습니다. 이미 권한이 있을 수 있습니다. ({e})")

            print(f"🚀 [Blender] 서버 실행 시도: {executable_path}")
            
            # 4. 백그라운드에서 서버 프로세스 시작
            #    Windows에서는 터미널 창이 뜨지 않도록 CREATE_NO_WINDOW 플래그를 추가합니다.
            creation_flags = 0
            if platform.system() == "Windows":
                creation_flags = subprocess.CREATE_NO_WINDOW

            server_process = subprocess.Popen([executable_path], creationflags=creation_flags)
            server_status = "시작 중..."
            
            # 5. 서버 상태 확인 타이머 시작
            start_time = time.time()
            bpy.app.timers.register(check_server_status)
            
            self.report({'INFO'}, "서버를 시작합니다. 잠시만 기다려주세요...")
        except Exception as e:
            msg = f"서버 시작 실패: {e}"
            self.report({'ERROR'}, msg)
            server_status = "오류"
            server_process = None
            return {'CANCELLED'}

        return {'FINISHED'}
# --- ▲▲▲ [핵심 수정] 여기까지 입니다 ▲▲▲ ---


class COSTESTIMATOR_OT_Connect(bpy.types.Operator):
    bl_idname = "costestimator.connect"
    bl_label = "웹소켓 연결 및 브라우저 열기"
    bl_description = "서버에 웹소켓으로 연결하고, 웹 브라우저에서 제어판을 엽니다."
    
    def execute(self, context):
        global status_message, last_timer_tick_time
        if websocket_client:
            self.report({'WARNING'}, "이미 연결되어 있습니다.")
            return {'CANCELLED'}

        # ▼▼▼ [추가] 타이머 등록 (Connect 버튼 클릭 시) ▼▼▼
        print("[DEBUG] Registering timers on Connect...")

        # 메인 타이머 등록
        if not bpy.app.timers.is_registered(process_event_queue_timer):
            bpy.app.timers.register(process_event_queue_timer)
            print("[DEBUG] Main timer registered successfully")
        else:
            print("[DEBUG] Main timer already registered")

        # Watchdog 타이머 등록
        if not bpy.app.timers.is_registered(watchdog_timer):
            import time
            last_timer_tick_time = time.time()
            bpy.app.timers.register(watchdog_timer)
            print("[DEBUG] Watchdog timer registered successfully")
        else:
            print("[DEBUG] Watchdog timer already registered")
        # ▲▲▲ [추가] 여기까지 ▲▲▲

        uri = context.scene.costestimator_server_url
        try:
            base_address = uri.replace("ws://", "http://").replace("wss://", "").split("/ws/")[0]
            webbrowser.open(base_address)
        except Exception as e:
            self.report({'WARNING'}, f"웹 브라우저 열기 실패: {e}")

        status_message = "서버에 연결 시도 중..."
        run_websocket_in_thread(uri)
        return {'FINISHED'}

class COSTESTIMATOR_OT_Disconnect(bpy.types.Operator):
    bl_idname = "costestimator.disconnect"
    bl_label = "연결 끊기 및 서버 종료"
    bl_description = "웹소켓 연결을 끊고, 실행 중인 로컬 서버도 함께 종료합니다."

    def execute(self, context):
        global websocket_client, status_message, websocket_thread_loop

        # ▼▼▼ [추가] 타이머 해제 (Disconnect 버튼 클릭 시) ▼▼▼
        print("[DEBUG] Unregistering timers on Disconnect...")

        if bpy.app.timers.is_registered(process_event_queue_timer):
            bpy.app.timers.unregister(process_event_queue_timer)
            print("[DEBUG] Main timer unregistered")

        if bpy.app.timers.is_registered(watchdog_timer):
            bpy.app.timers.unregister(watchdog_timer)
            print("[DEBUG] Watchdog timer unregistered")
        # ▲▲▲ [추가] 여기까지 ▲▲▲

        if websocket_client:
            if websocket_thread_loop:
                asyncio.run_coroutine_threadsafe(websocket_client.close(), websocket_thread_loop)
            websocket_client = None
            websocket_thread_loop = None
            status_message = "연결이 끊어졌습니다."
        else:
            self.report({'INFO'}, "웹소켓이 연결되어 있지 않습니다.")

        stop_server_process()
        self.report({'INFO'}, "서버가 종료되었습니다.")

        return {'FINISHED'}


class COSTESTIMATOR_PT_Panel(bpy.types.Panel):
    bl_label = "Cost Estimator"
    bl_idname = "COSTESTIMATOR_PT_Panel"
    bl_space_type = 'VIEW_3D'
    bl_region_type = 'UI'
    bl_category = 'Cost Estimator'

    def draw(self, context):
        layout = self.layout
        scene = context.scene

        box = layout.box()
        box.label(text="서버 관리")
        
        row = box.row()
        row.active = server_process is None or server_process.poll() is not None
        row.operator("costestimator.start_server", text="서버 시작", icon='PLAY')

        box.label(text=f"서버 상태: {server_status}")

        box = layout.box()
        box.label(text="웹소켓 연결")
        box.prop(scene, "costestimator_server_url")
        
        split = box.split(factor=0.5, align=True)
        
        col1 = split.column()
        col1.active = server_status == "실행 중" and websocket_client is None
        col1.operator("costestimator.connect", text="연결 및 브라우저 열기", icon='LINKED')
        
        col2 = split.column()
        col2.operator("costestimator.disconnect", text="연결 끊기 & 서버 종료", icon='UNLINKED')
        
        box.label(text=f"웹소켓 상태: {status_message}")


classes = (
    COSTESTIMATOR_OT_StartServer,
    COSTESTIMATOR_OT_Connect,
    COSTESTIMATOR_OT_Disconnect,
    COSTESTIMATOR_PT_Panel
)

def register():
    # 라이브러리 경로 설정 코드는 이미 파일 최상단으로 이동했습니다.
    for cls in classes:
        bpy.utils.register_class(cls)
    bpy.types.Scene.costestimator_server_url = bpy.props.StringProperty(
        name="서버 주소", default="ws://127.0.0.1:8000/ws/blender-connector/"
    )

    # 타이머는 애드온 설치 시가 아닌, Connect 버튼 클릭 시 시작됩니다.

def unregister():
    stop_server_process()

    # ▼▼▼ [수정] 메인 타이머와 watchdog 타이머 모두 해제 ▼▼▼
    if bpy.app.timers.is_registered(process_event_queue_timer):
        bpy.app.timers.unregister(process_event_queue_timer)
        print("[DEBUG] Main timer unregistered")

    if bpy.app.timers.is_registered(watchdog_timer):
        bpy.app.timers.unregister(watchdog_timer)
        print("[DEBUG] Watchdog timer unregistered")
    # ▲▲▲ [수정] 여기까지 ▲▲▲

    global websocket_client, websocket_thread_loop
    if websocket_client and websocket_thread_loop:
        asyncio.run_coroutine_threadsafe(websocket_client.close(), websocket_thread_loop)

    for cls in reversed(classes):
        bpy.utils.unregister_class(cls)
    del bpy.types.Scene.costestimator_server_url

if __name__ == "__main__":
    register()