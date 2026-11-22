import bpy, bmesh, math, sys, os
from mathutils import Vector

out_dir = sys.argv[sys.argv.index("--") + 1]

# --- clean scene ---
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def mat(name, color, rough=0.6, metal=0.0, emit=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1)
        b.inputs["Emission Strength"].default_value = 2.0
    m.diffuse_color = (*color, 1)
    return m

M_BODY  = mat("Body",  (0.85, 0.12, 0.10), 0.45)
M_GLASS = mat("Glass", (0.08, 0.12, 0.18), 0.1)
M_TIRE  = mat("Tire",  (0.05, 0.05, 0.05), 0.9)
M_RIM   = mat("Rim",   (0.75, 0.75, 0.78), 0.3, 0.8)
M_TRIM  = mat("Trim",  (0.12, 0.12, 0.13), 0.7)
M_HEAD  = mat("Headlight", (1.0, 0.95, 0.75), 0.2, emit=(1.0, 0.95, 0.75))
M_TAIL  = mat("Taillight", (0.9, 0.05, 0.05), 0.2, emit=(0.9, 0.05, 0.05))

def extrude_profile(name, pts, half_w, mats, face_mat):
    """pts: side profile (y, z) counter-clockwise seen from +X. Extruded along X."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    L = [bm.verts.new((-half_w, y, z)) for y, z in pts]
    R = [bm.verts.new(( half_w, y, z)) for y, z in pts]
    n = len(pts)
    side_r = bm.faces.new(R)
    side_l = bm.faces.new(list(reversed(L)))
    side_r.material_index = side_l.material_index = face_mat("side", -1)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((L[i], L[j], R[j], R[i]))
        f.material_index = face_mat("edge", i)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    for m in mats: me.materials.append(m)
    scene.collection.objects.link(ob)
    return ob

def box(name, loc, size, m):
    bpy.ops.mesh.primitive_cube_add(location=loc)
    ob = bpy.context.object
    ob.name = name
    ob.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    ob.data.materials.append(m)
    return ob

# Car faces +Y in Blender (becomes -Z in glTF / three.js forward).
# --- lower body: side profile (y, z) ---
body_pts = [
    (-2.00, 0.32), ( 2.00, 0.32), ( 2.05, 0.55), ( 1.95, 0.72),
    ( 0.95, 0.85), (-1.85, 0.88), (-2.05, 0.70),
]
body = extrude_profile("Body", body_pts, 0.88, [M_BODY], lambda k, i: 0)

# --- cabin: glass slopes + sides, painted roof ---
cab_pts = [(-1.55, 0.87), (0.90, 0.85), (0.25, 1.38), (-1.20, 1.40)]
# edges: 0 bottom, 1 windshield, 2 roof, 3 rear window
cabin = extrude_profile("Cabin", cab_pts, 0.76, [M_GLASS, M_BODY],
                        lambda k, i: 1 if (k == "edge" and i in (0, 2)) else 0)
# narrow the roof a bit for a tapered greenhouse
for v in cabin.data.vertices:
    if v.co.z > 1.3:
        v.co.x *= 0.88

# --- details ---
parts = [body, cabin]
parts.append(box("BumperF", (0, 2.07, 0.40), (1.80, 0.12, 0.18), M_TRIM))
parts.append(box("BumperR", (0, -2.07, 0.40), (1.80, 0.12, 0.18), M_TRIM))
for s in (-1, 1):
    parts.append(box("HeadL", (s * 0.60, 2.04, 0.62), (0.40, 0.08, 0.12), M_HEAD))
    parts.append(box("TailL", (s * 0.62, -2.07, 0.72), (0.38, 0.06, 0.10), M_TAIL))
    parts.append(box("Mirror", (s * 0.90, 0.75, 0.90), (0.18, 0.10, 0.10), M_BODY))
parts.append(box("Grille", (0, 2.06, 0.48), (0.80, 0.06, 0.10), M_TRIM))

bpy.ops.object.select_all(action="DESELECT")
for p in parts: p.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = "CarBody"

# --- wheels (separate so the game can spin/steer them) ---
R, W = 0.38, 0.30
wheel_pos = {"Wheel_FL": (-0.86, 1.30), "Wheel_FR": (0.86, 1.30),
             "Wheel_RL": (-0.86, -1.30), "Wheel_RR": (0.86, -1.30)}
for name, (x, y) in wheel_pos.items():
    bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=R, depth=W,
                                        location=(x, y, R), rotation=(0, math.pi / 2, 0))
    tire = bpy.context.object
    tire.data.materials.append(M_TIRE)
    side = 1 if x > 0 else -1
    bpy.ops.mesh.primitive_cylinder_add(vertices=6, radius=R * 0.55, depth=0.04,
                                        location=(x + side * (W / 2), y, R),
                                        rotation=(0, math.pi / 2, 0))
    rim = bpy.context.object
    rim.data.materials.append(M_RIM)
    bpy.ops.object.select_all(action="DESELECT")
    tire.select_set(True); rim.select_set(True)
    bpy.context.view_layer.objects.active = tire
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(rotation=True)
    # origin at wheel center so it spins in place
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    tire.name = name
    tire.parent = body
    tire.location = (x, y, R)

# flat shading everywhere
for ob in scene.objects:
    if ob.type == "MESH":
        for poly in ob.data.polygons: poly.use_smooth = False

tris = sum(len(o.data.polygons) for o in scene.objects if o.type == "MESH")
print("FACES", tris)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out_dir, "low-poly-car.blend"))
bpy.ops.export_scene.gltf(filepath=os.path.join(out_dir, "low-poly-car.glb"),
                          export_format="GLB", export_apply=True)

# --- preview render ---
world = bpy.data.worlds.new("W"); scene.world = world
world.color = (0.55, 0.6, 0.7)
bpy.ops.mesh.primitive_plane_add(size=20)
bpy.context.object.data.materials.append(mat("Ground", (0.35, 0.37, 0.4), 0.9))
cam_data = bpy.data.cameras.new("Cam"); cam = bpy.data.objects.new("Cam", cam_data)
scene.collection.objects.link(cam); scene.camera = cam
cam.location = (5.2, 5.0, 3.2)
cam.rotation_euler = (Vector((0, 0, 0.6)) - cam.location).to_track_quat("-Z", "Y").to_euler()
cam_data.lens = 40
sun = bpy.data.objects.new("Sun", bpy.data.lights.new("Sun", "SUN"))
sun.data.energy = 4; sun.rotation_euler = (0.8, 0.2, 0.9)
scene.collection.objects.link(sun)
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = True
scene.render.resolution_x, scene.render.resolution_y = 1000, 700
scene.render.filepath = sys.argv[sys.argv.index("--") + 2]
bpy.ops.render.render(write_still=True)
