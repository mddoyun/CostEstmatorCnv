// RevitDataCollector.cs
using Autodesk.Revit.DB;
using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Linq;

namespace RevitDjangoConnector
{
    public static class RevitDataCollector
    {
        public static List<string> SerializeElementsToStringList(List<Element> elements, Document doc)
        {
            var elementDataList = new List<string>();

            foreach (Element element in elements)
            {
                if (element == null || element.Category == null) continue;

                var elementDict = new Dictionary<string, object>
                {
                    ["Name"] = element.Name,
                    ["Category"] = element.Category.Name,
                    ["ElementId"] = element.Id.Value,
                    ["UniqueId"] = element.UniqueId
                };

                var parameters = new Dictionary<string, object>();
                foreach (Parameter param in element.Parameters)
                {
                    if (param.HasValue)
                    {
                        parameters[param.Definition.Name] = param.AsValueString() ?? param.AsString();
                    }
                }

                // ▼▼▼ [추가] Blender와 동일한 구조로 Geometry 추출 ▼▼▼
                try
                {
                    var geometryData = ExtractGeometry(element, doc);
                    if (geometryData != null)
                    {
                        // Blender 구조: { "verts": [...], "faces": [...], "matrix": [...] }
                        parameters["Geometry"] = geometryData;
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"Geometry extraction failed for element {element.Id.Value}: {ex.Message}");
                    parameters["Geometry"] = null;
                }
                // ▲▲▲ [추가] 여기까지 ▲▲▲

                elementDict["Parameters"] = parameters;

                Element elementType = doc.GetElement(element.GetTypeId());
                if (elementType != null)
                {
                    var typeParameters = new Dictionary<string, object>();
                    foreach (Parameter param in elementType.Parameters)
                    {
                        if (param.HasValue)
                        {
                            typeParameters[param.Definition.Name] = param.AsValueString() ?? param.AsString();
                        }
                    }
                    elementDict["TypeParameters"] = typeParameters;
                }

                elementDataList.Add(JsonConvert.SerializeObject(elementDict));
            }
            return elementDataList;
        }

        // ▼▼▼ [추가] Blender와 동일한 Geometry 구조 추출 메서드 ▼▼▼
        private static Dictionary<string, object> ExtractGeometry(Element element, Document doc)
        {
            var options = new Options
            {
                ComputeReferences = false,
                DetailLevel = ViewDetailLevel.Medium,
                IncludeNonVisibleObjects = false
            };

            var geomElement = element.get_Geometry(options);
            if (geomElement == null) return null;

            var allVerts = new List<double>();
            var allFaces = new List<int>();
            var matrix = ExtractTransformMatrix(element);

            foreach (GeometryObject geomObj in geomElement)
            {
                ProcessGeometryObject(geomObj, allVerts, allFaces, Transform.Identity);
            }

            if (allVerts.Count == 0) return null;

            // Blender와 동일한 구조로 반환
            return new Dictionary<string, object>
            {
                ["verts"] = allVerts,
                ["faces"] = allFaces,
                ["matrix"] = matrix
            };
        }

        private static void ProcessGeometryObject(GeometryObject geomObj, List<double> allVerts, List<int> allFaces, Transform parentTransform)
        {
            if (geomObj is Solid solid)
            {
                ProcessSolid(solid, allVerts, allFaces, parentTransform);
            }
            else if (geomObj is GeometryInstance instance)
            {
                var instanceGeom = instance.GetInstanceGeometry();
                var transform = parentTransform.Multiply(instance.Transform);
                foreach (GeometryObject instanceObj in instanceGeom)
                {
                    ProcessGeometryObject(instanceObj, allVerts, allFaces, transform);
                }
            }
            // Mesh 처리는 Solid로 충분히 커버됨 - 제거
        }

        private static void ProcessSolid(Solid solid, List<double> allVerts, List<int> allFaces, Transform transform)
        {
            if (solid == null || solid.Volume <= 0) return;

            foreach (Face face in solid.Faces)
            {
                try
                {
                    var triangulation = face.Triangulate();
                    if (triangulation == null) continue;

                    int vertexOffset = allVerts.Count / 3;

                    for (int i = 0; i < triangulation.NumTriangles; i++)
                    {
                        var triangle = triangulation.GetTriangle(i);

                        for (int j = 0; j < 3; j++)
                        {
                            XYZ vertex = triangle.get_Vertex(j);
                            XYZ transformedVertex = transform.OfPoint(vertex);

                            allVerts.Add(transformedVertex.X);
                            allVerts.Add(transformedVertex.Y);
                            allVerts.Add(transformedVertex.Z);

                            allFaces.Add(vertexOffset + i * 3 + j);
                        }
                    }
                }
                catch { /* 실패 시 건너뛰기 */ }
            }
        }

        private static List<double> ExtractTransformMatrix(Element element)
        {
            try
            {
                Transform transform = null;

                if (element.Location is LocationPoint locationPoint)
                {
                    transform = Transform.CreateTranslation(locationPoint.Point);
                    if (locationPoint.Rotation != 0)
                    {
                        var rotationTransform = Transform.CreateRotationAtPoint(XYZ.BasisZ, locationPoint.Rotation, locationPoint.Point);
                        transform = transform.Multiply(rotationTransform);
                    }
                }
                else if (element.Location is LocationCurve locationCurve)
                {
                    var curve = locationCurve.Curve;
                    var startPoint = curve.GetEndPoint(0);
                    transform = Transform.CreateTranslation(startPoint);
                }

                if (transform == null)
                {
                    transform = Transform.Identity;
                }

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
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"Matrix extraction failed: {ex.Message}");
                return null;
            }
        }
        // ▲▲▲ [추가] 여기까지 ▲▲▲
    }
}
