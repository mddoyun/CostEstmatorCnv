#!/usr/bin/env python
# -*- coding: utf-8 -*-
# check_geometry.py - Verify geometry data in database

import sqlite3
import json
import sys
from pathlib import Path

db_path = Path.home() / 'CostEstimator_Data' / 'db.sqlite3'

if not db_path.exists():
    print(f"[ERROR] Database not found: {db_path}")
    sys.exit(1)

conn = sqlite3.connect(str(db_path))
cursor = conn.cursor()

# Get total elements
cursor.execute('SELECT COUNT(*) FROM connections_rawelement')
total = cursor.fetchone()[0]

print(f"[INFO] Total RawElements: {total}")

if total == 0:
    print("[WARN] No elements in database. Please fetch data from Revit first.")
    sys.exit(0)

# Get all elements
cursor.execute('SELECT id, element_unique_id, raw_data FROM connections_rawelement LIMIT 10')
rows = cursor.fetchall()

success_count = 0
no_geometry_count = 0
old_structure_count = 0

print(f"\n[INFO] Checking first {len(rows)} elements:\n")

for i, (element_id, uid, raw_data_str) in enumerate(rows, 1):
    raw_data = json.loads(raw_data_str)
    name = raw_data.get('Name', 'Unnamed')

    print(f"{i}. {name} ({uid[:20]}...)")

    # Check structure
    has_system = 'System' in raw_data
    has_ifcclass = 'IfcClass' in raw_data
    has_old_category = 'Category' in raw_data

    if has_old_category:
        print(f"   [FAIL] OLD STRUCTURE (has Category field)")
        old_structure_count += 1
        continue

    if not has_system or not has_ifcclass:
        print(f"   [FAIL] INCOMPLETE (System={has_system}, IfcClass={has_ifcclass})")
        old_structure_count += 1
        continue

    print(f"   [OK] Correct structure (IfcClass: {raw_data.get('IfcClass', 'N/A')})")

    # Check System.Geometry
    if 'Geometry' in raw_data['System']:
        geom = raw_data['System']['Geometry']
        if geom and isinstance(geom, dict):
            verts = geom.get('verts', [])
            faces = geom.get('faces', [])
            has_matrix = 'matrix' in geom
            has_materials = 'materials' in geom

            print(f"   [OK] System.Geometry: {len(verts) // 3} vertices, {len(faces) // 3} faces")
            print(f"      matrix={has_matrix}, materials={has_materials}")

            # Check Parameters.Geometry (must exist for frontend)
            if 'Parameters' in raw_data and 'Geometry' in raw_data['Parameters']:
                print(f"   [OK] Parameters.Geometry: COPIED (ready for 3D viewer)")
                success_count += 1
            else:
                print(f"   [FAIL] Parameters.Geometry: MISSING (won't show in 3D viewer)")
                no_geometry_count += 1
        else:
            print(f"   [WARN] System.Geometry: NULL or invalid")
            no_geometry_count += 1
    else:
        print(f"   [FAIL] System.Geometry: MISSING")
        no_geometry_count += 1

conn.close()

print(f"\n" + "="*60)
print(f"[SUMMARY]")
print(f"   [OK] Success (ready for 3D): {success_count}")
print(f"   [FAIL] No geometry: {no_geometry_count}")
print(f"   [FAIL] Old structure: {old_structure_count}")
print("="*60)

if success_count > 0:
    print(f"\n[SUCCESS] {success_count} elements have valid geometry.")
    print(f"   They should appear in 3D viewport now.")
else:
    print(f"\n[WARN] No elements with valid geometry found.")
    print(f"\nPossible issues:")
    if old_structure_count > 0:
        print(f"   - Revit addin not rebuilt or Revit not restarted")
        print(f"   - Please rebuild addin and restart Revit")
    if no_geometry_count > 0:
        print(f"   - Elements have no extractable geometry")
        print(f"   - Check revit_geometry.log for extraction errors")
