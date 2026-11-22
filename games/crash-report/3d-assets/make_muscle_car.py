"""Starter muscle car: retro PS2 look, worn paint, split into crash parts.

Run in a live Blender:
    exec(open(PATH).read(), {"__file__": PATH, "__name__": "__main__"})
It only touches the "MuscleCar" collection, so it is safe to run again.

Car faces +Y. Ground is z=0. 1 unit = 1 m.
Parts (all children of "Body", each with its origin at its own center):
    Hood, Trunk, Door_L, Door_R, Bumper_F, Bumper_R,
    Windshield, RearWindow, Window_L, Window_R,
    Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR (origin = wheel center)
"""
import bpy, bmesh, math, random, os
from mathutils import Vector, Matrix

COLL_NAME = "MuscleCar"
OUT_DIR = os.path.dirname(os.path.abspath(__file__))

PAINT, TRIM, GLASS, CHROME, HEAD, TAIL, TIRE, RIM = range(8)
MATS = []

WHEEL_R = 0.36
WHEEL_Y = 1.45
WHEEL_X = 0.80


# ---------------------------------------------------------------- helpers
def smooth01(a, b, x):
    if x <= a:
        return 0.0
    if x >= b:
        return 1.0
    t = (x - a) / (b - a)
    return t * t * (3 - 2 * t)


def mix(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def reset_collection():
    old = bpy.data.collections.get(COLL_NAME)
    if old:
        for ob in list(old.objects):
            me = ob.data if ob.type == "MESH" else None
            bpy.data.objects.remove(ob)
            if me and me.users == 0:
                bpy.data.meshes.remove(me)
        bpy.data.collections.remove(old)
    coll = bpy.data.collections.new(COLL_NAME)
    bpy.context.scene.collection.children.link(coll)
    return coll


def new_obj(name, bm, coll):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in MATS:
        me.materials.append(m)
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def set_mat(bm, idx):
    for f in bm.faces:
        f.material_index = idx


def box_bm(center, size, mat):
    bm = bmesh.new()
    m = Matrix.Translation(center) @ Matrix.Diagonal((*size, 1))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)
    set_mat(bm, mat)
    return bm


def cyl_bm(center, r, depth, axis, segs, mat):
    bm = bmesh.new()
    rot = {"x": Matrix.Rotation(math.pi / 2, 4, "Y"),
           "y": Matrix.Rotation(math.pi / 2, 4, "X"),
           "z": Matrix.Identity(4)}[axis]
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs,
                          radius1=r, radius2=r, depth=depth,
                          matrix=Matrix.Translation(center) @ rot)
    set_mat(bm, mat)
    return bm


def join(dst, parts):
    """Merge bmeshes or objects into dst. Material order is the same everywhere."""
    bm = bmesh.new()
    bm.from_mesh(dst.data)
    for p in parts:
        if isinstance(p, bpy.types.Object):
            bm.from_mesh(p.data)
            me = p.data
            bpy.data.objects.remove(p)
            bpy.data.meshes.remove(me)
        else:
            tmp = bpy.data.meshes.new("tmp")
            p.to_mesh(tmp)
            p.free()
            bm.from_mesh(tmp)
            bpy.data.meshes.remove(tmp)
    bm.to_mesh(dst.data)
    bm.free()


def bake_modifiers(ob):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(dg))
    old = ob.data
    ob.modifiers.clear()
    ob.data = me
    bpy.data.meshes.remove(old)
    me.name = ob.name
    me.materials.clear()
    for m in MATS:
        me.materials.append(m)


def split_off(src, name, pred, coll):
    bm = bmesh.new()
    bm.from_mesh(src.data)
    if not any(pred(f) for f in bm.faces):
        bm.free()
        return None
    bm2 = bm.copy()
    bmesh.ops.delete(bm2, geom=[f for f in bm2.faces if not pred(f)], context="FACES")
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if pred(f)], context="FACES")
    bm.to_mesh(src.data)
    bm.free()
    return new_obj(name, bm2, coll)


def thicken(ob, t=0.02):
    mod = ob.modifiers.new("thick", "SOLIDIFY")
    mod.thickness = t
    mod.offset = -1.0
    bake_modifiers(ob)


def box_uv(ob, scale=0.4):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    uv = bm.loops.layers.uv.verify()
    mw = ob.matrix_world
    for f in bm.faces:
        n = f.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for loop in f.loops:
            co = mw @ loop.vert.co
            u, v = ((co.y, co.z), (co.x, co.z), (co.x, co.y))[ax]
            loop[uv].uv = (u * scale, v * scale)
    bm.to_mesh(ob.data)
    bm.free()


def hard_edges(ob, deg=35):
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    lim = math.radians(deg)
    for f in bm.faces:
        f.smooth = True
    for e in bm.edges:
        lf = e.link_faces
        if len(lf) != 2 or lf[0].material_index != lf[1].material_index:
            e.smooth = False
        else:
            e.smooth = e.calc_face_angle(0) < lim
    bm.to_mesh(ob.data)
    bm.free()


def origin_to_center(ob):
    vs = [v.co for v in ob.data.vertices]
    mn = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
    mx = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
    c = (mn + mx) / 2
    ob.data.transform(Matrix.Translation(-c))
    ob.location = c


# ---------------------------------------------------------------- paint texture
def make_paint_image(size=256, seed=11):
    rnd = random.Random(seed)

    def vnoise(c):
        g = [[rnd.random() for _ in range(c)] for _ in range(c)]
        out = [0.0] * (size * size)
        for y in range(size):
            fy = y * c / size
            iy = int(fy)
            ty = fy - iy
            ty = ty * ty * (3 - 2 * ty)
            r0, r1 = g[iy % c], g[(iy + 1) % c]
            row = y * size
            for x in range(size):
                fx = x * c / size
                ix = int(fx)
                tx = fx - ix
                tx = tx * tx * (3 - 2 * tx)
                x0, x1 = ix % c, (ix + 1) % c
                a = r0[x0] + (r0[x1] - r0[x0]) * tx
                b = r1[x0] + (r1[x1] - r1[x0]) * tx
                out[row + x] = a + (b - a) * ty
        return out

    def fbm(cells):
        layers = [vnoise(c) for c in cells]
        ws = [0.5 ** i for i in range(len(cells))]
        tot = sum(ws)
        v = [sum(l[i] * w for l, w in zip(layers, ws)) / tot for i in range(size * size)]
        mn, mx = min(v), max(v)
        return [(x - mn) / (mx - mn) for x in v]

    fade = fbm([4, 8, 16, 32])
    rust = fbm([8, 16, 32, 64])
    primer = fbm([3, 6, 12, 24])
    grime = fbm([16, 32, 64])

    DARK, FADED = (0.12, 0.29, 0.32), (0.36, 0.50, 0.49)
    PRIMER = (0.50, 0.50, 0.47)
    RUST_L, RUST_D = (0.55, 0.27, 0.10), (0.27, 0.12, 0.05)
    BROWN = (0.33, 0.22, 0.13)

    px = []
    for i in range(size * size):
        c = mix(DARK, FADED, smooth01(0.25, 0.85, fade[i]))
        c = mix(c, PRIMER, smooth01(0.84, 0.87, primer[i]))
        rv = rust[i]
        ring = smooth01(0.70, 0.75, rv)
        c = mix(c, BROWN, ring * 0.35)
        c = mix(c, mix(RUST_L, RUST_D, smooth01(0.80, 0.95, rv)), smooth01(0.75, 0.78, rv))
        k = 0.75 + 0.25 * grime[i]
        px.append([c[0] * k, c[1] * k, c[2] * k])

    # scratches: short, mostly flat lines of bare metal
    for _ in range(35):
        x, y = rnd.uniform(0, size), rnd.uniform(0, size)
        ang = rnd.uniform(-0.35, 0.35) + (math.pi if rnd.random() < 0.5 else 0)
        ln = rnd.randint(6, 34)
        strength = rnd.uniform(0.2, 0.45)
        for s in range(ln):
            ix = int(x + math.cos(ang) * s) % size
            iy = int(y + math.sin(ang) * s) % size
            p = px[iy * size + ix]
            px[iy * size + ix] = list(mix(p, (0.68, 0.70, 0.66), strength))

    name = "MC_PaintWorn"
    img = bpy.data.images.get(name)
    if img:
        bpy.data.images.remove(img)
    img = bpy.data.images.new(name, size, size, alpha=False)
    flat = []
    for p in px:
        flat.extend((p[0], p[1], p[2], 1.0))
    img.pixels.foreach_set(flat)
    img.filepath_raw = os.path.join(OUT_DIR, "muscle-car-paint.png")
    img.file_format = "PNG"
    img.save()
    img.pack()
    return img


def make_material(name, color, rough, metal=0.0, emit=0.0, image=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    try:
        m.use_nodes = True
    except Exception:
        pass
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (300, 0)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*color, 1)
        b.inputs["Emission Strength"].default_value = emit
    if image:
        t = nt.nodes.new("ShaderNodeTexImage")
        t.image = image
        t.interpolation = "Closest"
        t.location = (-350, 0)
        nt.links.new(t.outputs["Color"], b.inputs["Base Color"])
    m.diffuse_color = (*color, 1)
    return m


def make_materials():
    img = make_paint_image()
    MATS[:] = [
        make_material("MC_Paint", (1, 1, 1), 0.7, image=img),
        make_material("MC_Trim", (0.02, 0.02, 0.022), 0.8),
        make_material("MC_Glass", (0.02, 0.03, 0.035), 0.08),
        make_material("MC_Chrome", (0.62, 0.62, 0.64), 0.35, metal=1.0),
        make_material("MC_Headlight", (1.0, 0.9, 0.6), 0.2, emit=1.5),
        make_material("MC_Taillight", (0.6, 0.02, 0.02), 0.3, emit=0.8),
        make_material("MC_Tire", (0.03, 0.03, 0.03), 0.95),
        make_material("MC_Rim", (0.12, 0.12, 0.13), 0.5, metal=0.6),
    ]


# ---------------------------------------------------------------- body
# (y, half width, bottom z, beltline z, hood/deck crown) from rear to front
BODY_STATIONS = [
    (-2.45, 0.90, 0.34, 0.94, 0.01),
    (-2.36, 0.95, 0.27, 0.97, 0.01),   # ducktail lip
    (-2.10, 0.97, 0.24, 0.935, 0.03),
    (-1.85, 0.97, 0.24, 0.92, 0.04),
    (-1.55, 0.97, 0.24, 0.915, 0.04),  # wide rear haunches
    (-1.25, 0.97, 0.24, 0.91, 0.04),
    (-0.95, 0.955, 0.24, 0.905, 0.04),
    (-0.60, 0.935, 0.24, 0.90, 0.04),  # pinched waist (coke bottle)
    (-0.20, 0.93, 0.24, 0.90, 0.04),
    (0.20, 0.935, 0.24, 0.90, 0.04),
    (0.55, 0.945, 0.24, 0.895, 0.04),  # cowl
    (0.85, 0.95, 0.24, 0.89, 0.06),
    (1.15, 0.95, 0.24, 0.885, 0.07),   # long hood with a center bulge
    (1.45, 0.95, 0.24, 0.88, 0.07),
    (1.75, 0.95, 0.24, 0.875, 0.07),
    (2.10, 0.94, 0.25, 0.865, 0.06),
    (2.38, 0.92, 0.27, 0.84, 0.04),
    (2.46, 0.88, 0.34, 0.80, 0.02),    # nose
]


def body_ring(hw, zb, zt, crown):
    h = zt - zb
    half = [(0, zb), (hw * 0.90, zb), (hw, zb + 0.10), (hw, zb + 0.40 * h),
            (hw * 0.99, zb + 0.78 * h), (hw * 0.965, zt - 0.025), (hw * 0.90, zt),
            (hw * 0.5, zt + crown * 0.75), (0, zt + crown)]
    return half + [(-x, z) for x, z in reversed(half[1:-1])]


def build_lower_body(coll):
    bm = bmesh.new()
    rings = []
    for y, hw, zb, zt, cr in BODY_STATIONS:
        rings.append([bm.verts.new((x, y, z)) for x, z in body_ring(hw, zb, zt, cr)])
    n = len(rings[0])
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    set_mat(bm, PAINT)
    body = new_obj("Body", bm, coll)

    # wheel arches: cut with cylinders, leaving wheel wells
    cut = bmesh.new()
    for wy in (WHEEL_Y, -WHEEL_Y):
        for s in (-1, 1):
            c = cyl_bm(Vector((s * 0.95, wy, WHEEL_R + 0.01)), 0.42, 0.74, "x", 18, TRIM)
            tmp = bpy.data.meshes.new("tmp")
            c.to_mesh(tmp)
            c.free()
            cut.from_mesh(tmp)
            bpy.data.meshes.remove(tmp)
    cutter = new_obj("ArchCutter", cut, coll)
    mod = body.modifiers.new("arches", "BOOLEAN")
    mod.operation = "DIFFERENCE"
    mod.object = cutter
    mod.solver = "EXACT"
    try:
        mod.material_mode = "INDEX"
    except Exception:
        pass
    bake_modifiers(body)
    me = cutter.data
    bpy.data.objects.remove(cutter)
    bpy.data.meshes.remove(me)
    return body


# (y, base half width, roof half width, base z, roof z, span to next station)
CABIN_STATIONS = [
    (0.58, 0.83, 0.80, 0.885, 0.90, "wind"),
    (-0.12, 0.81, 0.66, 0.89, 1.29, "roof"),
    (-0.55, 0.81, 0.67, 0.895, 1.30, "roof"),
    (-0.98, 0.82, 0.67, 0.90, 1.29, "rear"),
    (-1.45, 0.84, 0.71, 0.905, 1.10, "rear"),   # long fastback slope
    (-1.86, 0.85, 0.75, 0.91, 0.93, None),
]
# segment kinds around the ring: side, rail, roof x4, rail, side
SEG_KIND = ["side", "rail", "roof", "roof", "roof", "roof", "rail", "side"]
SPAN_MAT = {
    "wind": {"side": PAINT, "rail": PAINT, "roof": GLASS},
    "roof": {"side": GLASS, "rail": PAINT, "roof": PAINT},
    "rear": {"side": PAINT, "rail": PAINT, "roof": GLASS},
}


def build_cabin():
    bm = bmesh.new()
    rings = []
    for y, gb, gt, zb, zr, _ in CABIN_STATIONS:
        half = [(gb, zb), (gt, zr), (gt * 0.92, zr + 0.025), (gt * 0.55, zr + 0.045)]
        pts = [(-x, z) for x, z in half] + [(0, zr + 0.05)] + [(x, z) for x, z in reversed(half)]
        rings.append([bm.verts.new((x, y, z)) for x, z in pts])
    for k, (a, b) in enumerate(zip(rings, rings[1:])):
        span = CABIN_STATIONS[k][5]
        for i in range(len(a) - 1):
            f = bm.faces.new((a[i], a[i + 1], b[i + 1], b[i]))
            f.material_index = SPAN_MAT[span][SEG_KIND[i]]
    caps = []
    for r in (rings[0], rings[-1]):
        cap = bm.faces.new(r)
        cap.material_index = PAINT
        caps.append(cap)
    bm.normal_update()
    # normals: point away from the cabin's center line
    for f in bm.faces:
        if f in caps:
            continue
        c = f.calc_center_median()
        if f.normal.dot(c - Vector((0, c.y, 0.9))) < 0:
            f.normal_flip()
    for f in caps:
        want = 1 if f.calc_center_median().y > 0 else -1
        if f.normal.y * want < 0:
            f.normal_flip()
    return bm


# ---------------------------------------------------------------- details
def hood_scoop():
    bm = bmesh.new()
    yf, yr, z0 = 1.68, 0.98, 0.935
    v = [bm.verts.new(p) for p in [
        (-0.26, yr, z0), (0.26, yr, z0), (0.26, yf, z0), (-0.26, yf, z0),
        (-0.21, yr, 0.975), (0.21, yr, 0.975), (0.24, yf, 1.035), (-0.24, yf, 1.035)]]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (3, 2, 6, 7), (0, 3, 7, 4)]
    for idx, fv in enumerate(faces):
        f = bm.faces.new([v[i] for i in fv])
        f.material_index = TRIM if idx == 4 else PAINT
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    # dark inner lip on the scoop mouth
    lip = box_bm(Vector((0, yf + 0.004, 0.985)), (0.40, 0.01, 0.07), TRIM)
    return [bm, lip]


def door_extras(side):
    s = side
    return [
        box_bm(Vector((s * 0.975, 0.38, 0.915)), (0.05, 0.03, 0.04), CHROME),   # mirror stalk
        box_bm(Vector((s * 1.02, 0.38, 0.95)), (0.09, 0.06, 0.07), CHROME),     # mirror head
        box_bm(Vector((s * 0.94, -0.55, 0.78)), (0.025, 0.13, 0.03), CHROME),   # handle
    ]


def body_extras():
    parts = [
        box_bm(Vector((0, 2.462, 0.585)), (1.34, 0.03, 0.26), TRIM),            # grille
        box_bm(Vector((0, 2.474, 0.585)), (0.08, 0.01, 0.20), CHROME),         # grille center bar
        box_bm(Vector((0, -2.462, 0.80)), (0.50, 0.03, 0.10), TRIM),           # rear center panel
    ]
    for s in (-1, 1):
        parts += [
            cyl_bm(Vector((s * 0.62, 2.47, 0.60)), 0.115, 0.03, "y", 14, CHROME),   # headlight bezel
            cyl_bm(Vector((s * 0.62, 2.482, 0.60)), 0.092, 0.02, "y", 14, HEAD),    # headlight
            box_bm(Vector((s * 0.52, -2.462, 0.80)), (0.50, 0.03, 0.10), TAIL),     # taillight
            cyl_bm(Vector((s * 0.55, -2.40, 0.28)), 0.045, 0.16, "y", 10, CHROME),  # exhaust
        ]
    # dark insides, seen when panels or glass come off
    parts += [
        box_bm(Vector((0, 1.45, 0.60)), (1.10, 1.60, 0.50), TRIM),        # engine block
        cyl_bm(Vector((0, 1.25, 0.86)), 0.20, 0.06, "z", 14, CHROME),     # air cleaner
        box_bm(Vector((0, -0.45, 0.60)), (1.60, 1.90, 0.56), TRIM),       # cabin tub
        box_bm(Vector((0, 0.28, 0.98)), (1.20, 0.25, 0.12), TRIM),        # dash
        box_bm(Vector((0, -2.10, 0.62)), (1.60, 0.45, 0.45), TRIM),       # trunk tub
    ]
    for s in (-1, 1):
        parts.append(box_bm(Vector((s * 0.38, -0.60, 1.03)), (0.48, 0.12, 0.38), TRIM))  # seat backs
    return parts


def bumper(front=True):
    path = [(-0.97, -0.16), (-0.93, -0.06), (-0.80, 0.0), (0.0, 0.02),
            (0.80, 0.0), (0.93, -0.06), (0.97, -0.16)]
    sect = [(0, 0), (0.05, 0), (0.075, 0.03), (0.075, 0.11), (0.05, 0.14), (0, 0.14)]
    y0, z0 = 2.44, 0.34
    bm = bmesh.new()
    rings = []
    for i, (x, dy) in enumerate(path):
        a = path[max(i - 1, 0)]
        b = path[min(i + 1, len(path) - 1)]
        t = Vector((b[0] - a[0], b[1] - a[1])).normalized()
        nrm = Vector((-t.y, t.x))
        rings.append([bm.verts.new((x + nrm.x * f, y0 + dy + nrm.y * f, z0 + u)) for f, u in sect])
    n = len(sect)
    for a, b in zip(rings, rings[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((a[i], a[j], b[j], b[i]))
    bm.faces.new(rings[0])
    bm.faces.new(rings[-1])
    if not front:
        for v in bm.verts:
            v.co.y = -v.co.y
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    set_mat(bm, CHROME)
    return bm


def wheel_bm(w, seg=16):
    r = WHEEL_R
    bm = bmesh.new()
    # (radius, x) from inner side over the tread to the outer side, outer = +x
    prof = [(0.25, -w / 2), (0.33, -w / 2), (r, -w / 2 + 0.035), (r, w / 2 - 0.035),
            (0.33, w / 2), (0.255, w / 2),
            (0.235, w / 2 - 0.005), (0.225, w / 2 - 0.045),   # chrome lip, then drop to dish
            (0.09, w / 2 - 0.045), (0.08, w / 2 - 0.02)]       # dish, then hub cap
    kinds = [TIRE] * 5 + [CHROME, RIM, RIM, CHROME]
    rings = []
    for rad, x in prof:
        rings.append([bm.verts.new((x, rad * math.cos(2 * math.pi * i / seg),
                                    rad * math.sin(2 * math.pi * i / seg))) for i in range(seg)])
    for k in range(len(rings) - 1):
        for i in range(seg):
            j = (i + 1) % seg
            f = bm.faces.new((rings[k][i], rings[k][j], rings[k + 1][j], rings[k + 1][i]))
            f.material_index = kinds[k]
    bm.faces.new(rings[0]).material_index = TIRE
    bm.faces.new(rings[-1]).material_index = CHROME
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return bm


# ---------------------------------------------------------------- build
def build():
    coll = reset_collection()
    make_materials()

    body = build_lower_body(coll)
    join(body, [build_cabin()])

    # crash parts cut from the shell, so they fit back exactly
    def c(f):
        return f.calc_center_median()

    glass = {
        "Windshield": lambda f: f.material_index == GLASS and c(f).y > -0.12,
        "RearWindow": lambda f: f.material_index == GLASS and c(f).y < -0.98,
        "Window_L": lambda f: f.material_index == GLASS and c(f).x < 0,
        "Window_R": lambda f: f.material_index == GLASS and c(f).x > 0,
    }
    parts = {}
    for name, pred in glass.items():
        parts[name] = split_off(body, name, pred, coll)

    parts["Hood"] = split_off(body, "Hood", lambda f: f.normal.z > 0.6 and 0.56 < c(f).y < 2.40
                              and abs(c(f).x) < 0.9 and c(f).z < 1.0, coll)
    parts["Trunk"] = split_off(body, "Trunk", lambda f: f.normal.z > 0.6 and -2.32 < c(f).y < -1.87
                               and c(f).z < 1.0, coll)
    for name, s in (("Door_L", -1), ("Door_R", 1)):
        parts[name] = split_off(body, name, lambda f, s=s: f.normal.x * s > 0.5
                                and -0.94 < c(f).y < 0.54 and 0.36 < c(f).z < 0.9, coll)

    for name in ("Hood", "Trunk", "Door_L", "Door_R"):
        thicken(parts[name])
    join(parts["Hood"], hood_scoop())
    join(parts["Door_L"], door_extras(-1))
    join(parts["Door_R"], door_extras(1))
    join(body, body_extras())

    parts["Bumper_F"] = new_obj("Bumper_F", bumper(True), coll)
    parts["Bumper_R"] = new_obj("Bumper_R", bumper(False), coll)

    for ob in [body] + list(parts.values()):
        box_uv(ob)
        hard_edges(ob)
    for ob in parts.values():
        origin_to_center(ob)
        ob.parent = body

    for name, x, y, w in (("Wheel_FL", -WHEEL_X, WHEEL_Y, 0.27), ("Wheel_FR", WHEEL_X, WHEEL_Y, 0.27),
                          ("Wheel_RL", -WHEEL_X, -WHEEL_Y, 0.32), ("Wheel_RR", WHEEL_X, -WHEEL_Y, 0.32)):
        bm = wheel_bm(w)
        if x < 0:
            for v in bm.verts:
                v.co.x = -v.co.x
            bmesh.ops.reverse_faces(bm, faces=bm.faces)
        ob = new_obj(name, bm, coll)
        hard_edges(ob)
        ob.location = (x, y, WHEEL_R)
        ob.parent = body

    tris = 0
    for ob in coll.objects:
        tris += sum(len(p.vertices) - 2 for p in ob.data.polygons)
    return {"objects": sorted(o.name for o in coll.objects), "triangles": tris}


if __name__ == "__main__":
    result = build()
