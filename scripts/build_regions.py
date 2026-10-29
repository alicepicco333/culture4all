"""
Build data/story/regions.geojson: the 20 Italian regions, each the union of its
provinces in data/story/provinces.geojson (already simplified by build_story_data.py).
Used by the opening map, where the reader picks the region to follow.

    python scripts/build_regions.py      (needs shapely)
"""
import json, os
from collections import defaultdict
from shapely.geometry import shape, mapping, MultiPolygon
from shapely.geometry.polygon import orient
from shapely.ops import unary_union

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "story", "provinces.geojson")
OUT = os.path.join(ROOT, "data", "story", "regions.geojson")


def rnd(c):
    if isinstance(c, (list, tuple)) and c and isinstance(c[0], (int, float)):
        return [round(c[0], 4), round(c[1], 4)]
    return [rnd(x) for x in c]


with open(SRC, encoding="utf-8") as f:
    geo = json.load(f)
groups = defaultdict(list)
for ft in geo["features"]:
    region = ft["properties"]["region"].split("/")[0].strip()
    groups[region].append(shape(ft["geometry"]).buffer(0))
features = []
for region, shapes in sorted(groups.items()):
    # a hair of buffer closes slivers left between simplified province edges
    g = unary_union([s.buffer(0.002) for s in shapes]).buffer(-0.002).simplify(0.002)
    # d3 draws spherical polygons: exterior rings must be clockwise
    polys = list(g.geoms) if isinstance(g, MultiPolygon) else [g]
    g = MultiPolygon([orient(p, sign=-1.0) for p in polys if p.area > 1e-5])
    m = mapping(g)
    features.append({"type": "Feature", "properties": {"region": region},
                     "geometry": {"type": m["type"], "coordinates": rnd(m["coordinates"])}})
with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": features}, f, ensure_ascii=False, separators=(",", ":"))
print("wrote regions.geojson:", len(features), "regions,", os.path.getsize(OUT), "bytes")
