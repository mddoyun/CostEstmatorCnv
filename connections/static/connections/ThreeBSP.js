/**
 * ThreeBSP - CSG for Three.js r140+
 * Adapted for BufferGeometry
 */

(function() {
    'use strict';

    var ThreeBSP = function(geometry, matrix) {
        // Convert BufferGeometry to Geometry-like structure for BSP operations
        var polygons = [];

        if (geometry instanceof THREE.Mesh) {
            matrix = geometry.matrix.clone();
            geometry = geometry.geometry;
        }

        if (geometry.isBufferGeometry) {
            var positions = geometry.attributes.position.array;
            var normals = geometry.attributes.normal ? geometry.attributes.normal.array : null;
            var indices = geometry.index ? geometry.index.array : null;

            var vertexCount = positions.length / 3;
            var faceCount = indices ? indices.length / 3 : vertexCount / 3;

            for (var i = 0; i < faceCount; i++) {
                var vertices = [];

                for (var j = 0; j < 3; j++) {
                    var index = indices ? indices[i * 3 + j] : i * 3 + j;
                    var position = new THREE.Vector3(
                        positions[index * 3],
                        positions[index * 3 + 1],
                        positions[index * 3 + 2]
                    );

                    if (matrix) {
                        position.applyMatrix4(matrix);
                    }

                    var normal = normals ? new THREE.Vector3(
                        normals[index * 3],
                        normals[index * 3 + 1],
                        normals[index * 3 + 2]
                    ) : new THREE.Vector3(0, 0, 1);

                    vertices.push(new ThreeBSP.Vertex(position, normal));
                }

                if (vertices.length > 0) {
                    polygons.push(new ThreeBSP.Polygon(vertices));
                }
            }
        }

        this.matrix = matrix || new THREE.Matrix4();
        this.tree = new ThreeBSP.Node(polygons);
    };

    ThreeBSP.prototype.subtract = function(other) {
        var a = this.tree.clone();
        var b = other.tree.clone();

        a.invert();
        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.allPolygons());
        a.invert();

        return new ThreeBSP.FromPolygons(a.allPolygons(), this.matrix);
    };

    ThreeBSP.prototype.union = function(other) {
        var a = this.tree.clone();
        var b = other.tree.clone();

        a.clipTo(b);
        b.clipTo(a);
        b.invert();
        b.clipTo(a);
        b.invert();
        a.build(b.allPolygons());

        return new ThreeBSP.FromPolygons(a.allPolygons(), this.matrix);
    };

    ThreeBSP.prototype.intersect = function(other) {
        var a = this.tree.clone();
        var b = other.tree.clone();

        a.invert();
        b.clipTo(a);
        b.invert();
        a.clipTo(b);
        b.clipTo(a);
        a.build(b.allPolygons());
        a.invert();

        return new ThreeBSP.FromPolygons(a.allPolygons(), this.matrix);
    };

    ThreeBSP.prototype.toGeometry = function() {
        var matrix = new THREE.Matrix4().copy(this.matrix).invert();
        var polygons = this.tree.allPolygons();

        // Build BufferGeometry directly
        var positions = [];
        var normals = [];
        var indices = [];
        var vertexMap = {};
        var vertexIndex = 0;

        for (var i = 0; i < polygons.length; i++) {
            var polygon = polygons[i];
            var vertices = polygon.vertices;

            if (vertices.length < 3) continue;

            var polygonIndices = [];
            for (var j = 0; j < vertices.length; j++) {
                var vertex = vertices[j];
                var position = vertex.position.clone();
                position.applyMatrix4(matrix);

                var key = position.x.toFixed(5) + ',' + position.y.toFixed(5) + ',' + position.z.toFixed(5);

                if (vertexMap[key] === undefined) {
                    positions.push(position.x, position.y, position.z);
                    normals.push(vertex.normal.x, vertex.normal.y, vertex.normal.z);
                    vertexMap[key] = vertexIndex++;
                }

                polygonIndices.push(vertexMap[key]);
            }

            // Triangulate polygon if needed (fan triangulation)
            for (var j = 1; j < polygonIndices.length - 1; j++) {
                indices.push(polygonIndices[0], polygonIndices[j], polygonIndices[j + 1]);
            }
        }

        var geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setIndex(indices);

        geometry.computeVertexNormals();

        return geometry;
    };

    ThreeBSP.FromPolygons = function(polygons, matrix) {
        var bsp = Object.create(ThreeBSP.prototype);
        bsp.tree = new ThreeBSP.Node(polygons);
        bsp.matrix = matrix || new THREE.Matrix4();
        return bsp;
    };

    // Vertex class
    ThreeBSP.Vertex = function(position, normal) {
        this.position = position;
        this.normal = normal || new THREE.Vector3(0, 0, 1);
    };

    ThreeBSP.Vertex.prototype.clone = function() {
        return new ThreeBSP.Vertex(this.position.clone(), this.normal.clone());
    };

    ThreeBSP.Vertex.prototype.flip = function() {
        this.normal.multiplyScalar(-1);
    };

    ThreeBSP.Vertex.prototype.interpolate = function(other, t) {
        return new ThreeBSP.Vertex(
            this.position.clone().lerp(other.position, t),
            this.normal.clone().lerp(other.normal, t).normalize()
        );
    };

    // Polygon class
    ThreeBSP.Polygon = function(vertices) {
        this.vertices = vertices;
        if (vertices.length > 0) {
            this.calculateProperties();
        }
    };

    ThreeBSP.Polygon.prototype.calculateProperties = function() {
        var a = this.vertices[0].position;
        var b = this.vertices[1].position;
        var c = this.vertices[2].position;

        this.normal = new THREE.Vector3()
            .subVectors(c, b)
            .cross(new THREE.Vector3().subVectors(a, b))
            .normalize();

        this.w = this.normal.dot(a);
    };

    ThreeBSP.Polygon.prototype.clone = function() {
        return new ThreeBSP.Polygon(this.vertices.map(function(v) { return v.clone(); }));
    };

    ThreeBSP.Polygon.prototype.flip = function() {
        this.vertices.reverse().forEach(function(v) { v.flip(); });
        this.normal.multiplyScalar(-1);
        this.w = -this.w;
    };

    // Node class (BSP tree node)
    ThreeBSP.Node = function(polygons) {
        this.polygons = [];
        this.front = null;
        this.back = null;

        if (polygons) {
            this.build(polygons);
        }
    };

    ThreeBSP.Node.prototype.clone = function() {
        var node = new ThreeBSP.Node();
        node.plane = this.plane && this.plane.clone();
        node.front = this.front && this.front.clone();
        node.back = this.back && this.back.clone();
        node.polygons = this.polygons.map(function(p) { return p.clone(); });
        return node;
    };

    ThreeBSP.Node.prototype.invert = function() {
        var i;
        for (i = 0; i < this.polygons.length; i++) {
            this.polygons[i].flip();
        }

        if (this.plane) {
            this.plane.flip();
        }
        if (this.front) {
            this.front.invert();
        }
        if (this.back) {
            this.back.invert();
        }

        var temp = this.front;
        this.front = this.back;
        this.back = temp;
    };

    ThreeBSP.Node.prototype.clipPolygons = function(polygons) {
        if (!this.plane) return polygons.slice();

        var front = [];
        var back = [];

        for (var i = 0; i < polygons.length; i++) {
            this.plane.splitPolygon(polygons[i], front, back, front, back);
        }

        if (this.front) {
            front = this.front.clipPolygons(front);
        }
        if (this.back) {
            back = this.back.clipPolygons(back);
        } else {
            back = [];
        }

        return front.concat(back);
    };

    ThreeBSP.Node.prototype.clipTo = function(node) {
        this.polygons = node.clipPolygons(this.polygons);
        if (this.front) {
            this.front.clipTo(node);
        }
        if (this.back) {
            this.back.clipTo(node);
        }
    };

    ThreeBSP.Node.prototype.allPolygons = function() {
        var polygons = this.polygons.slice();
        if (this.front) {
            polygons = polygons.concat(this.front.allPolygons());
        }
        if (this.back) {
            polygons = polygons.concat(this.back.allPolygons());
        }
        return polygons;
    };

    ThreeBSP.Node.prototype.build = function(polygons) {
        if (polygons.length === 0) return;

        if (!this.plane) {
            this.plane = polygons[0].clone();
        }

        var front = [];
        var back = [];

        for (var i = 0; i < polygons.length; i++) {
            this.plane.splitPolygon(polygons[i], this.polygons, this.polygons, front, back);
        }

        if (front.length > 0) {
            if (!this.front) {
                this.front = new ThreeBSP.Node();
            }
            this.front.build(front);
        }

        if (back.length > 0) {
            if (!this.back) {
                this.back = new ThreeBSP.Node();
            }
            this.back.build(back);
        }
    };

    // Plane methods
    ThreeBSP.Polygon.prototype.clone = function() {
        return new ThreeBSP.Polygon(this.vertices.map(function(v) { return v.clone(); }));
    };

    ThreeBSP.Polygon.prototype.flip = function() {
        this.vertices.reverse().forEach(function(v) { v.flip(); });
        if (this.normal) {
            this.normal.multiplyScalar(-1);
            this.w = -this.w;
        }
    };

    var EPSILON = 1e-5;
    var COPLANAR = 0;
    var FRONT = 1;
    var BACK = 2;
    var SPANNING = 3;

    ThreeBSP.Polygon.prototype.splitPolygon = function(polygon, coplanarFront, coplanarBack, front, back) {
        var types = [];
        for (var i = 0; i < polygon.vertices.length; i++) {
            var t = this.normal.dot(polygon.vertices[i].position) - this.w;
            var type = (t < -EPSILON) ? BACK : (t > EPSILON) ? FRONT : COPLANAR;
            types.push(type);
        }

        var polygonType = types.reduce(function(a, b) { return a | b; }, 0);

        switch (polygonType) {
            case COPLANAR:
                if (this.normal.dot(polygon.normal) > 0) {
                    coplanarFront.push(polygon);
                } else {
                    coplanarBack.push(polygon);
                }
                break;
            case FRONT:
                front.push(polygon);
                break;
            case BACK:
                back.push(polygon);
                break;
            case SPANNING:
                var f = [];
                var b = [];
                for (var i = 0; i < polygon.vertices.length; i++) {
                    var j = (i + 1) % polygon.vertices.length;
                    var ti = types[i];
                    var tj = types[j];
                    var vi = polygon.vertices[i];
                    var vj = polygon.vertices[j];

                    if (ti != BACK) f.push(vi);
                    if (ti != FRONT) b.push(vi);

                    if ((ti | tj) == SPANNING) {
                        var t = (this.w - this.normal.dot(vi.position)) / this.normal.dot(new THREE.Vector3().subVectors(vj.position, vi.position));
                        var v = vi.interpolate(vj, t);
                        f.push(v);
                        b.push(v);
                    }
                }
                if (f.length >= 3) front.push(new ThreeBSP.Polygon(f));
                if (b.length >= 3) back.push(new ThreeBSP.Polygon(b));
                break;
        }
    };

    // Export
    window.ThreeBSP = ThreeBSP;

})();
