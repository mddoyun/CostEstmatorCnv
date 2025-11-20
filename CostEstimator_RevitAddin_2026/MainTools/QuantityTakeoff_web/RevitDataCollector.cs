// RevitDataCollector.cs (Blender 구조 100% 호환)
using Autodesk.Revit.DB;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;
using System.IO;

namespace RevitDjangoConnector
{
    // ▼▼▼ 파일 로거 클래스 ▼▼▼
    public static class FileLogger
    {
        private static string logFilePath;
        private static object lockObj = new object();

        static FileLogger()
        {
            // Log file path: %USERPROFILE%\CostEstimator_Data\logs\revit_geometry.log
            string userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
            string logDir = Path.Combine(userProfile, "CostEstimator_Data", "logs");

            // Create directory if it doesn't exist
            if (!Directory.Exists(logDir))
            {
                Directory.CreateDirectory(logDir);
            }

            logFilePath = Path.Combine(logDir, "revit_geometry.log");

            // Write startup message
            WriteToFile($"[INFO] Revit Geometry Logger initialized - {DateTime.Now:yyyy-MM-dd HH:mm:ss}");
        }

        public static void LogInfo(string message)
        {
            WriteToFile($"[INFO] {DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}");
            System.Diagnostics.Debug.WriteLine($"[Geometry] {message}");
        }

        public static void LogWarning(string message)
        {
            WriteToFile($"[WARN] {DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}");
            System.Diagnostics.Debug.WriteLine($"[Geometry] {message}");
        }

        public static void LogError(string message)
        {
            WriteToFile($"[ERROR] {DateTime.Now:yyyy-MM-dd HH:mm:ss} {message}");
            System.Diagnostics.Debug.WriteLine($"[Geometry] {message}");
        }

        private static void WriteToFile(string message)
        {
            try
            {
                lock (lockObj)
                {
                    File.AppendAllText(logFilePath, message + Environment.NewLine);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[FileLogger] Failed to write to log file: {ex.Message}");
            }
        }
    }
    // ▲▲▲ 파일 로거 클래스 끝 ▲▲▲

    public static class RevitDataCollector
    {
        // Revit Category → IFC Class 매핑
        private static readonly Dictionary<string, string> CategoryToIfcClassMap = new Dictionary<string, string>
        {
            { "Walls", "IfcWall" },
            { "Floors", "IfcSlab" },
            { "Roofs", "IfcRoof" },
            { "Ceilings", "IfcCovering" },
            { "Columns", "IfcColumn" },
            { "Structural Columns", "IfcColumn" },
            { "Beams", "IfcBeam" },
            { "Structural Framing", "IfcBeam" },
            { "Doors", "IfcDoor" },
            { "Windows", "IfcWindow" },
            { "Stairs", "IfcStair" },
            { "Railings", "IfcRailing" },
            { "Ramps", "IfcRamp" },
            { "Curtain Panels", "IfcPlate" },
            { "Curtain Wall Mullions", "IfcMember" },
            { "Structural Foundations", "IfcFooting" },
            { "Generic Models", "IfcBuildingElementProxy" },
            { "Furniture", "IfcFurnishingElement" },
            { "Casework", "IfcFurnishingElement" },
            { "Plumbing Fixtures", "IfcSanitaryTerminal" },
            { "Mechanical Equipment", "IfcFlowTerminal" },
            { "Electrical Equipment", "IfcElectricAppliance" },
            { "Lighting Fixtures", "IfcLightFixture" },
            { "Pipes", "IfcPipeSegment" },
            { "Pipe Fittings", "IfcPipeFitting" },
            { "Ducts", "IfcDuctSegment" },
            { "Duct Fittings", "IfcDuctFitting" },
            { "Cable Trays", "IfcCableCarrierSegment" },
            { "Conduits", "IfcCableCarrierSegment" }
        };

        public static List<string> SerializeElementsToStringList(List<Element> elements, Document doc)
        {
            var elementDataList = new List<string>();

            foreach (Element element in elements)
            {
                if (element == null || element.Category == null) continue;

                // ▼▼▼ Blender와 100% 동일한 구조 ▼▼▼
                var elementDict = new Dictionary<string, object>
                {
                    ["Name"] = element.Name ?? "이름 없음",
                    ["IfcClass"] = GetIfcClass(element),
                    ["ElementId"] = (int)element.Id.Value,
                    ["UniqueId"] = element.UniqueId,
                    ["Tag"] = GetParameterValueAsString(element, BuiltInParameter.ALL_MODEL_MARK) ?? "",  // Mark parameter
                    ["PredefinedType"] = "",  // Revit에서는 Type에서 추출할 수 있지만, 일단 빈 문자열
                    ["Attributes"] = ExtractAttributes(element),
                    ["PropertySet"] = ExtractPropertySets(element),
                    ["QuantitySet"] = ExtractQuantitySets(element, doc),
                    ["Spatial_Container"] = ExtractSpatialContainer(element, doc),
                    ["Aggregates_Whole"] = new Dictionary<string, object>(),  // Revit에서는 간단하게 빈 딕셔너리
                    ["Aggregates_Parts"] = new Dictionary<string, object>(),
                    ["Nest_Host"] = new Dictionary<string, object>(),
                    ["Nest_Components"] = new Dictionary<string, object>(),
                    ["Type"] = ExtractTypeInfo(element, doc),
                    ["System"] = new Dictionary<string, object>
                    {
                        ["Geometry"] = ExtractGeometry(element, doc)
                    }
                };

                elementDataList.Add(JsonConvert.SerializeObject(elementDict));
            }
            return elementDataList;
        }

        private static string GetIfcClass(Element element)
        {
            if (element.Category == null) return "IfcBuildingElementProxy";

            string categoryName = element.Category.Name;
            if (CategoryToIfcClassMap.ContainsKey(categoryName))
            {
                return CategoryToIfcClassMap[categoryName];
            }

            // 기본값
            return "IfcBuildingElementProxy";
        }

        private static Dictionary<string, object> ExtractAttributes(Element element)
        {
            var attributes = new Dictionary<string, object>();

            // Revit의 기본 속성들 (IFC의 Attributes에 해당)
            // Name은 이미 최상위에 있으므로 여기서는 제외
            attributes["Description"] = element.get_Parameter(BuiltInParameter.ALL_MODEL_DESCRIPTION)?.AsString() ?? null;
            attributes["ObjectType"] = element.get_Parameter(BuiltInParameter.ELEM_TYPE_PARAM)?.AsValueString() ?? null;

            // Category 정보
            if (element.Category != null)
            {
                attributes["Category"] = element.Category.Name;
            }

            // Family 정보 (IFC의 ObjectType에 해당)
            if (element is FamilyInstance familyInstance && familyInstance.Symbol != null)
            {
                attributes["Family"] = familyInstance.Symbol.Family.Name;
                attributes["FamilyType"] = familyInstance.Symbol.Name;
            }

            // Level 정보
            if (element.LevelId != null && element.LevelId != ElementId.InvalidElementId)
            {
                var level = element.Document.GetElement(element.LevelId) as Level;
                if (level != null)
                {
                    attributes["Level"] = level.Name;
                }
            }

            return attributes;
        }

        private static Dictionary<string, object> ExtractPropertySets(Element element)
        {
            var propertySets = new Dictionary<string, object>();

            // Revit Parameters를 Blender의 PropertySet 형식으로 변환
            // 형식: "PsetName__PropertyName" (Blender와 동일)
            // Revit에서는 Parameter Group을 Pset 이름으로 사용

            foreach (Parameter param in element.Parameters)
            {
                if (param == null || !param.HasValue) continue;

                try
                {
                    string groupName = param.Definition.ParameterGroup.ToString();
                    string paramName = param.Definition.Name;
                    string key = $"{groupName}__{paramName}";

                    // 값 추출
                    object value = GetParameterValue(param);
                    if (value != null)
                    {
                        propertySets[key] = value;
                    }
                }
                catch { /* 실패 시 건너뛰기 */ }
            }

            return propertySets;
        }

        private static Dictionary<string, object> ExtractQuantitySets(Element element, Document doc)
        {
            var quantitySets = new Dictionary<string, object>();

            // Revit의 계산된 수량 정보 추출
            // 형식: "Qto_ElementBaseQuantities__QuantityName" (Blender와 동일)

            // 면적, 체적, 길이 등 기본 수량 정보
            try
            {
                // 체적 (Volume)
                var volumeParam = element.get_Parameter(BuiltInParameter.HOST_VOLUME_COMPUTED);
                if (volumeParam != null && volumeParam.HasValue)
                {
                    quantitySets["Qto_ElementBaseQuantities__GrossVolume"] = volumeParam.AsDouble();
                }

                // 면적 (Area)
                var areaParam = element.get_Parameter(BuiltInParameter.HOST_AREA_COMPUTED);
                if (areaParam != null && areaParam.HasValue)
                {
                    quantitySets["Qto_ElementBaseQuantities__GrossArea"] = areaParam.AsDouble();
                }

                // 길이 (Length)
                var lengthParam = element.get_Parameter(BuiltInParameter.CURVE_ELEM_LENGTH);
                if (lengthParam != null && lengthParam.HasValue)
                {
                    quantitySets["Qto_ElementBaseQuantities__Length"] = lengthParam.AsDouble();
                }

                // Wall specific quantities
                if (element is Wall wall)
                {
                    quantitySets["Qto_WallBaseQuantities__GrossVolume"] = volumeParam?.AsDouble() ?? 0.0;
                    quantitySets["Qto_WallBaseQuantities__GrossSideArea"] = areaParam?.AsDouble() ?? 0.0;
                    quantitySets["Qto_WallBaseQuantities__Length"] = wall.get_Parameter(BuiltInParameter.CURVE_ELEM_LENGTH)?.AsDouble() ?? 0.0;
                    quantitySets["Qto_WallBaseQuantities__Height"] = wall.get_Parameter(BuiltInParameter.WALL_USER_HEIGHT_PARAM)?.AsDouble() ?? 0.0;
                    quantitySets["Qto_WallBaseQuantities__Width"] = wall.WallType.Width;
                }

                // Floor specific quantities
                if (element is Floor floor)
                {
                    quantitySets["Qto_SlabBaseQuantities__GrossVolume"] = volumeParam?.AsDouble() ?? 0.0;
                    quantitySets["Qto_SlabBaseQuantities__GrossArea"] = areaParam?.AsDouble() ?? 0.0;
                }
            }
            catch { /* 실패 시 건너뛰기 */ }

            return quantitySets;
        }

        private static Dictionary<string, object> ExtractSpatialContainer(Element element, Document doc)
        {
            var spatialContainer = new Dictionary<string, object>();

            try
            {
                // Room 또는 Space 정보 추출
                if (element.Location is LocationPoint locationPoint)
                {
                    XYZ point = locationPoint.Point;
                    Room room = doc.GetRoomAtPoint(point);
                    if (room != null)
                    {
                        spatialContainer["IfcClass"] = "IfcSpace";
                        spatialContainer["Name"] = room.Name ?? "Unknown Room";
                        spatialContainer["GlobalId"] = room.UniqueId;
                    }
                }
                else if (element.Location is LocationCurve locationCurve)
                {
                    XYZ point = locationCurve.Curve.GetEndPoint(0);
                    Room room = doc.GetRoomAtPoint(point);
                    if (room != null)
                    {
                        spatialContainer["IfcClass"] = "IfcSpace";
                        spatialContainer["Name"] = room.Name ?? "Unknown Room";
                        spatialContainer["GlobalId"] = room.UniqueId;
                    }
                }

                // Level 정보도 추가 (공간 컨테이너의 일종)
                if (spatialContainer.Count == 0 && element.LevelId != null && element.LevelId != ElementId.InvalidElementId)
                {
                    var level = doc.GetElement(element.LevelId) as Level;
                    if (level != null)
                    {
                        spatialContainer["IfcClass"] = "IfcBuildingStorey";
                        spatialContainer["Name"] = level.Name;
                        spatialContainer["GlobalId"] = level.UniqueId;
                    }
                }
            }
            catch { /* 실패 시 빈 딕셔너리 */ }

            return spatialContainer;
        }

        private static Dictionary<string, object> ExtractTypeInfo(Element element, Document doc)
        {
            var typeInfo = new Dictionary<string, object>();

            try
            {
                Element elementType = doc.GetElement(element.GetTypeId());
                if (elementType != null)
                {
                    typeInfo["Name"] = elementType.Name ?? "Unknown Type";
                    typeInfo["IfcClass"] = GetIfcClass(element) + "Type";  // e.g., IfcWallType

                    // Type Attributes
                    var typeAttributes = new Dictionary<string, object>();
                    typeAttributes["Description"] = elementType.get_Parameter(BuiltInParameter.ALL_MODEL_TYPE_COMMENTS)?.AsString() ?? null;
                    typeAttributes["Category"] = elementType.Category?.Name ?? "";

                    if (elementType is FamilySymbol familySymbol)
                    {
                        typeAttributes["Family"] = familySymbol.Family.Name;
                    }

                    typeInfo["Attributes"] = typeAttributes;

                    // Type PropertySets
                    var typePropertySets = new Dictionary<string, object>();
                    foreach (Parameter param in elementType.Parameters)
                    {
                        if (param == null || !param.HasValue) continue;

                        try
                        {
                            string groupName = param.Definition.ParameterGroup.ToString();
                            string paramName = param.Definition.Name;
                            string key = $"{groupName}__{paramName}";

                            object value = GetParameterValue(param);
                            if (value != null)
                            {
                                typePropertySets[key] = value;
                            }
                        }
                        catch { /* 실패 시 건너뛰기 */ }
                    }
                    typeInfo["PropertySet"] = typePropertySets;
                }
                else
                {
                    // Type이 없는 경우 기본값
                    typeInfo["Name"] = "";
                    typeInfo["IfcClass"] = "";
                    typeInfo["Attributes"] = new Dictionary<string, object>();
                    typeInfo["PropertySet"] = new Dictionary<string, object>();
                }
            }
            catch
            {
                typeInfo["Name"] = "";
                typeInfo["IfcClass"] = "";
                typeInfo["Attributes"] = new Dictionary<string, object>();
                typeInfo["PropertySet"] = new Dictionary<string, object>();
            }

            return typeInfo;
        }

        // ▼▼▼ Blender와 동일한 Geometry 구조 추출 ▼▼▼
        private static Dictionary<string, object> ExtractGeometry(Element element, Document doc)
        {
            try
            {
                var options = new Options
                {
                    ComputeReferences = false,
                    DetailLevel = ViewDetailLevel.Fine,  // Medium → Fine으로 변경 (더 상세한 geometry)
                    IncludeNonVisibleObjects = true  // false → true로 변경 (모든 객체의 geometry 추출)
                };

                var geomElement = element.get_Geometry(options);
                if (geomElement == null)
                {
                    FileLogger.LogWarning($"Element {element.Id.Value} ({element.Name}): No geometry element");

                    // Options 없이 다시 시도
                    geomElement = element.get_Geometry(new Options());
                    if (geomElement == null)
                    {
                        return null;
                    }
                    FileLogger.LogInfo($"Element {element.Id.Value} ({element.Name}): Got geometry with default options");
                }

                var allVerts = new List<double>();
                var allFaces = new List<int>();
                var matrix = ExtractTransformMatrix();

                foreach (GeometryObject geomObj in geomElement)
                {
                    ProcessGeometryObject(geomObj, allVerts, allFaces, Transform.Identity);
                }

                if (allVerts.Count == 0)
                {
                    FileLogger.LogWarning($"Element {element.Id.Value} ({element.Name}): No vertices extracted");
                    return null;
                }

                // Materials 정보 추출
                var materials = ExtractMaterials(element, doc);

                FileLogger.LogInfo($"Element {element.Id.Value} ({element.Name}): SUCCESS - {allVerts.Count / 3} vertices, {allFaces.Count / 3} faces");

                // Blender와 100% 동일한 구조로 반환
                return new Dictionary<string, object>
                {
                    ["verts"] = allVerts,
                    ["faces"] = allFaces,
                    ["matrix"] = matrix,
                    ["materials"] = materials
                };
            }
            catch (Exception ex)
            {
                FileLogger.LogError($"Element {element.Id.Value}: EXCEPTION - {ex.Message}");
                FileLogger.LogError($"Stack trace: {ex.StackTrace}");
                return null;
            }
        }

        private static Dictionary<string, object> ExtractMaterials(Element element, Document doc)
        {
            var materials = new Dictionary<string, object>();

            try
            {
                // Material 정보 추출
                ElementId materialId = ElementId.InvalidElementId;

                // 1. Category Material 가져오기
                if (element.Category != null)
                {
                    Material catMaterial = element.Category.Material;
                    if (catMaterial != null)
                    {
                        materialId = catMaterial.Id;
                    }
                }

                // 2. Element Material 가져오기 (우선순위 높음)
                var structuralMaterialParam = element.get_Parameter(BuiltInParameter.STRUCTURAL_MATERIAL_PARAM);
                var materialParam = element.get_Parameter(BuiltInParameter.MATERIAL_ID_PARAM);

                if (structuralMaterialParam != null && structuralMaterialParam.HasValue)
                {
                    materialId = structuralMaterialParam.AsElementId();
                }
                else if (materialParam != null && materialParam.HasValue)
                {
                    materialId = materialParam.AsElementId();
                }

                // Material 정보 추출
                if (materialId != ElementId.InvalidElementId)
                {
                    Material material = doc.GetElement(materialId) as Material;
                    if (material != null)
                    {
                        materials["name"] = material.Name ?? "Unknown";

                        // Color 정보 추출
                        try
                        {
                            Color color = material.Color;
                            materials["diffuse_color"] = new List<double>
                            {
                                color.Red / 255.0,
                                color.Green / 255.0,
                                color.Blue / 255.0
                            };

                            // Transparency (Revit에서는 transparency parameter 사용)
                            var transparencyParam = material.get_Parameter(BuiltInParameter.MATERIAL_TRANSPARENCY);
                            if (transparencyParam != null && transparencyParam.HasValue)
                            {
                                materials["transparency"] = transparencyParam.AsDouble() / 100.0;  // Revit: 0-100, IFC: 0-1
                            }
                            else
                            {
                                materials["transparency"] = 0.0;
                            }

                            // Shininess (Revit의 gloss)
                            var shininessParam = material.get_Parameter(BuiltInParameter.MATERIAL_SHININESS);
                            if (shininessParam != null && shininessParam.HasValue)
                            {
                                double shininess = shininessParam.AsDouble();
                                // Shininess를 specular color intensity로 변환 (간단한 매핑)
                                double specIntensity = shininess / 128.0;  // Revit: 0-128, normalize to 0-1
                                materials["specular_color"] = new List<double>
                                {
                                    specIntensity,
                                    specIntensity,
                                    specIntensity
                                };
                            }
                        }
                        catch { /* Color 추출 실패 시 기본값 사용 */ }
                    }
                }

                // 기본 색상이 없으면 회색 설정 (Blender와 동일)
                if (!materials.ContainsKey("diffuse_color"))
                {
                    materials["diffuse_color"] = new List<double> { 0.8, 0.8, 0.8 };
                }

                if (!materials.ContainsKey("transparency"))
                {
                    materials["transparency"] = 0.0;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Material extraction failed: {ex.Message}");
                materials["diffuse_color"] = new List<double> { 0.8, 0.8, 0.8 };
                materials["transparency"] = 0.0;
            }

            return materials;
        }

        private static void ProcessGeometryObject(GeometryObject geomObj, List<double> allVerts, List<int> allFaces, Transform parentTransform)
        {
            if (geomObj is Solid solid)
            {
                ProcessSolid(solid, allVerts, allFaces, parentTransform);
            }
            else if (geomObj is Mesh mesh)
            {
                ProcessMesh(mesh, allVerts, allFaces, parentTransform);
            }
            else if (geomObj is GeometryInstance instance)
            {
                try
                {
                    var instanceGeom = instance.GetSymbolGeometry();
                    if (instanceGeom != null)
                    {
                        var transform = parentTransform.Multiply(instance.Transform);
                        foreach (GeometryObject instanceObj in instanceGeom)
                        {
                            ProcessGeometryObject(instanceObj, allVerts, allFaces, transform);
                        }
                    }
                }
                catch (Exception ex)
                {
                    FileLogger.LogWarning($"GeometryInstance processing failed: {ex.Message}");
                }
            }
            else
            {
                // Curve, Point 등 다른 타입은 무시 (로깅은 너무 많아서 생략)
            }
        }

        private static void ProcessMesh(Mesh mesh, List<double> allVerts, List<int> allFaces, Transform transform)
        {
            if (mesh == null || mesh.Vertices == null || mesh.Vertices.Count == 0)
            {
                return;
            }

            int vertexOffset = allVerts.Count / 3;

            // Vertices 추가
            for (int i = 0; i < mesh.Vertices.Count; i++)
            {
                XYZ vertex = mesh.Vertices[i];
                XYZ transformedVertex = transform.OfPoint(vertex);

                allVerts.Add(transformedVertex.X);
                allVerts.Add(transformedVertex.Y);
                allVerts.Add(transformedVertex.Z);
            }

            // Triangles 추가 (Mesh는 NumTriangles 속성 사용)
            for (int i = 0; i < mesh.NumTriangles; i++)
            {
                MeshTriangle triangle = mesh.get_Triangle(i);

                allFaces.Add(vertexOffset + (int)triangle.get_Index(0));
                allFaces.Add(vertexOffset + (int)triangle.get_Index(1));
                allFaces.Add(vertexOffset + (int)triangle.get_Index(2));
            }

            FileLogger.LogInfo($"ProcessMesh: {mesh.Vertices.Count} vertices, {mesh.NumTriangles} triangles");
        }

        private static void ProcessSolid(Solid solid, List<double> allVerts, List<int> allFaces, Transform transform)
        {
            // Volume 체크 제거 - Face가 있으면 처리
            if (solid == null || solid.Faces == null || solid.Faces.Size == 0)
            {
                return;
            }

            int faceCount = 0;
            int triangleCount = 0;

            foreach (Face face in solid.Faces)
            {
                try
                {
                    var triangulation = face.Triangulate();
                    if (triangulation == null || triangulation.NumTriangles == 0)
                    {
                        continue;
                    }

                    faceCount++;
                    int vertexOffset = allVerts.Count / 3;

                    for (int i = 0; i < triangulation.NumTriangles; i++)
                    {
                        var triangle = triangulation.get_Triangle(i);

                        for (int j = 0; j < 3; j++)
                        {
                            XYZ vertex = triangle.get_Vertex(j);
                            XYZ transformedVertex = transform.OfPoint(vertex);

                            allVerts.Add(transformedVertex.X);
                            allVerts.Add(transformedVertex.Y);
                            allVerts.Add(transformedVertex.Z);

                            allFaces.Add(vertexOffset + i * 3 + j);
                        }
                        triangleCount++;
                    }
                }
                catch (Exception ex)
                {
                    // Face triangulation 실패 시 로깅 후 계속 진행
                    FileLogger.LogWarning($"Face triangulation failed: {ex.Message}");
                }
            }

            if (faceCount > 0)
            {
                FileLogger.LogInfo($"ProcessSolid: Processed {faceCount} faces, {triangleCount} triangles");
            }
        }

        private static List<double> ExtractTransformMatrix()
        {
            // Revit geometry is already in global coordinates
            Transform transform = Transform.Identity;

            // Blender 방식: 4x4 행렬을 1차원 배열로 (column-major order)
            var matrix = new List<double>(16);
            for (int col = 0; col < 4; col++)
            {
                for (int row = 0; row < 4; row++)
                {
                    if (row < 3 && col < 3)
                    {
                        // Basis vectors (rotation + scale)
                        var basisVector = col == 0 ? transform.BasisX : (col == 1 ? transform.BasisY : transform.BasisZ);
                        matrix.Add(row == 0 ? basisVector.X : (row == 1 ? basisVector.Y : basisVector.Z));
                    }
                    else if (row < 3 && col == 3)
                    {
                        // Translation
                        matrix.Add(row == 0 ? transform.Origin.X : (row == 1 ? transform.Origin.Y : transform.Origin.Z));
                    }
                    else if (row == 3)
                    {
                        // Bottom row: [0, 0, 0, 1]
                        matrix.Add(col == 3 ? 1.0 : 0.0);
                    }
                }
            }

            return matrix;
        }

        // ▼▼▼ Helper Methods ▼▼▼
        private static object GetParameterValue(Parameter param)
        {
            if (param == null || !param.HasValue) return null;

            switch (param.StorageType)
            {
                case StorageType.String:
                    return param.AsString();
                case StorageType.Integer:
                    return param.AsInteger();
                case StorageType.Double:
                    return param.AsDouble();
                case StorageType.ElementId:
                    return param.AsValueString();  // ElementId를 문자열로 변환
                default:
                    return param.AsValueString();  // 기본적으로 문자열 표현 사용
            }
        }

        private static string GetParameterValueAsString(Element element, BuiltInParameter builtInParam)
        {
            var param = element.get_Parameter(builtInParam);
            if (param == null || !param.HasValue) return null;

            return param.AsValueString() ?? param.AsString();
        }
    }
}
