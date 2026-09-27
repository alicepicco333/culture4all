"""
Build the small, derived data files used by the redesigned story page (data/story/).

Every number on the page comes from files already in this repository. This script
only parses, reshapes, simplifies geometry and counts. Run from the repo root:

    python scripts/build_story_data.py

Inputs -> outputs
  data/Dati_biblioteche/Dati_Generali_biblioteche/BiblioProvincieRegioni2012.csv
      ISTAT/ICCU table 4.1: libraries per province, count and per 10,000 inhabitants
      -> data/story/libraries_2012.json
  data/Dati_biblioteche/Dati_Generali_biblioteche/PrestitiBiblioRegioni2022.csv
      ISTAT table 4.12: local loans 2022, totals and averages per library
      -> data/story/loans_2022.json
  Dati-Abitudini-lettura-regioni-2021.csv
      ISTAT: reading habits 2021, % of people aged 6+
      -> data/story/reading_2021.json
  data/TicketCost_FreeEntry_Museums_Archives_Libraries_Data/Numbers_of_MALs_Per_*
      dati.cultura "Luoghi della cultura": museums recorded as free / with a ticket
      -> data/story/museums_entry.json
  data/Dati_biblioteche/lat_long.json   (13,326 geolocated libraries, 2022)
  geojson/comuni.geojson                (7,899 municipal boundaries)
      point-in-polygon count of libraries per municipality
      -> data/story/library_points.json, data/story/municipalities.json
  geojson/limits_IT_provinces.geojson
      simplified (Douglas-Peucker, ~0.004 deg) for fast loading
      -> data/story/provinces.geojson
"""
import csv, json, math, os, re, unicodedata
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "story")
os.makedirs(OUT, exist_ok=True)
P = lambda *a: os.path.join(ROOT, *a)


def key(s):
    """Accent/encoding-insensitive matching key (source files contain U+FFFD)."""
    s = unicodedata.normalize("NFKD", s)
    s = "".join(c for c in s if c.isascii() and c.isalnum())
    return s.lower()


def num(s):
    s = (s or "").strip().replace(",", "")
    try:
        return float(s)
    except ValueError:
        return None


def dump(name, obj):
    with open(os.path.join(OUT, name), "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print("wrote", name, os.path.getsize(os.path.join(OUT, name)), "bytes")


REGIONS = [  # ISTAT order, with macro-area used throughout the page
    ("Piemonte", "North"), ("Valle d'Aosta", "North"), ("Lombardia", "North"),
    ("Trentino-Alto Adige", "North"), ("Veneto", "North"), ("Friuli-Venezia Giulia", "North"),
    ("Liguria", "North"), ("Emilia-Romagna", "North"), ("Toscana", "Centre"),
    ("Umbria", "Centre"), ("Marche", "Centre"), ("Lazio", "Centre"),
    ("Abruzzo", "South & islands"), ("Molise", "South & islands"), ("Campania", "South & islands"),
    ("Puglia", "South & islands"), ("Basilicata", "South & islands"), ("Calabria", "South & islands"),
    ("Sicilia", "South & islands"), ("Sardegna", "South & islands"),
]
REG_BY_KEY = {key(r): (r, a) for r, a in REGIONS}
REG_BY_KEY[key("Valle d'Aosta/Vallée d'Aoste")] = ("Valle d'Aosta", "North")
REG_BY_KEY[key("Valle d'Aosta - Vallée d'Aoste")] = ("Valle d'Aosta", "North")


def region_of(name):
    k = key(name)
    for rk, v in REG_BY_KEY.items():
        if k == rk or k.startswith(rk) or ("aosta" in rk and "aosta" in k):
            return v
    return None


# ---------------------------------------------------------------- 2012 libraries
rows = list(csv.reader(open(P("data/Dati_biblioteche/Dati_Generali_biblioteche/BiblioProvincieRegioni2012.csv"), encoding="utf-8-sig")))
cells = []
for r in rows:
    for a, b, c in ((0, 1, 2), (8, 9, 10)):
        if len(r) > c and r[a].strip() and num(r[c]) is not None:
            cells.append((r[a].strip(), num(r[b]), num(r[c])))
prov12, reg12, area12, seen = [], [], {}, set()
for name, n, rate in cells:
    k = key(name)
    if k in seen:
        continue
    seen.add(k)
    if name in ("ITALIA", "Nord", "Centro", "Mezzogiorno"):
        area12[name] = rate  # (the source's "Nord" count is 0, a source error; only the rate is used)
        continue
    reg = region_of(name)
    if reg and not (k == key("Valle d'Aosta/Vallée d'Aoste") and any(p["key"] == k for p in prov12)):
        reg12.append({"region": reg[0], "area": reg[1], "libraries": n, "per10k": rate})
        if reg[0] == "Valle d'Aosta":  # one-province region: also a province
            prov12.append({"name": name, "key": k, "libraries": n, "per10k": rate})
        continue
    prov12.append({"name": name, "key": k, "libraries": n, "per10k": rate})
dump("libraries_2012.json", {"provinces": prov12, "regions": reg12, "areas": area12,
                             "source": "ISTAT on ICCU Anagrafe delle biblioteche, 31 Dec 2012 (Tavola 4.1)"})

# ---------------------------------------------------------------- 2022 loans
rows = list(csv.reader(open(P("data/Dati_biblioteche/Dati_Generali_biblioteche/PrestitiBiblioRegioni2022.csv"), encoding="utf-8-sig")))
blocks, cur = [], []
for r in rows[8:]:
    if not r or not r[0].strip() and not any(x.strip() for x in r[1:5]):
        continue
    label = r[0].strip()
    rec = {"label": label, "total": num(r[4]), "public_total": num(r[1]), "private_total": num(r[3]),
           "mean_public": num(r[6]), "mean_all": num(r[9])}
    if label == "":            # an "Italia" subtotal row closes each block
        blocks.append(cur); cur = []
        italy = rec
        continue
    cur.append(rec)
regions22 = []
for rec in blocks[0]:
    reg = region_of(rec["label"])
    if reg and rec["label"] not in ("Bolzano/Bozen", "Trento"):
        regions22.append({"region": reg[0], "area": reg[1], **{k: v for k, v in rec.items() if k != "label"}})
names = ["macro", "size", "classification", "urbanisation"]
loans = {"regions": regions22, "italy": {k: v for k, v in italy.items() if k != "label"},
         "note_trentino": "Trentino-Alto Adige figures cover Trento only; Bolzano/Bozen not available (d).",
         "source": "ISTAT, Indagine sulle biblioteche pubbliche e private, 2023 edition, year 2022 (Tavola 4.12)"}
for nm, blk in zip(names, blocks[1:5]):
    loans[nm] = [{"label": b["label"], "mean_all": b["mean_all"], "mean_public": b["mean_public"], "total": b["total"]} for b in blk]
dump("loans_2022.json", loans)

# ---------------------------------------------------------------- 2021 reading
rows = list(csv.reader(open(P("Dati-Abitudini-lettura-regioni-2021.csv"), encoding="utf-8-sig"), delimiter=";"))
read = []
italy_r = None
for r in rows[2:]:
    if not r or not r[0].strip():
        continue
    name = r[0].strip()
    vals = [float(x.replace(",", ".")) for x in r[1:7]]
    rec = dict(zip(["any", "one_to_three", "twelve_plus", "print_only", "digital_only", "both"], vals))
    if name == "Italia":
        italy_r = rec; continue
    if name in ("Bolzano", "Trento"):
        continue
    reg = region_of(name)
    read.append({"region": reg[0], "area": reg[1], **rec})
dump("reading_2021.json", {"regions": read, "italy": italy_r,
                           "source": "ISTAT, reading for non-school/non-work reasons, 2021, % of people aged 6+"})

# ---------------------------------------------------------------- museums entry
base = "data/TicketCost_FreeEntry_Museums_Archives_Libraries_Data/"
free = {r["Region"]: int(r["Museums_Number"]) for r in csv.DictReader(open(P(base + "Numbers_of_MALs_Per_Region_Free_Entry.csv"), encoding="utf-8-sig").readlines()[1:])}
tick = {r["Region"]: int(r["Museums_Number"]) for r in csv.DictReader(open(P(base + "Numbers_of_MALs_Per_region_Ticket_Cost.csv"), encoding="utf-8-sig").readlines()[1:])}
mus = []
for rname in free:
    if rname == "TOTAL":
        continue
    reg = region_of(rname.replace("_", " ").replace("Valle d Aosta Vallee d Aoste", "Valle d'Aosta"))
    f, t = free[rname], tick.get(rname, 0)
    mus.append({"region": reg[0], "area": reg[1], "free": f, "ticket": t, "share_free": round(100 * f / (f + t), 1)})
dump("museums_entry.json", {"regions": mus, "total_free": free["TOTAL"], "total_ticket": tick["TOTAL"],
                            "source": "dati.cultura.gov.it, Luoghi della cultura: museums whose record states free entry or a ticket price"})

# ---------------------------------------------------------------- geometry helpers
def dp(pts, eps):
    if len(pts) < 3:
        return pts
    a, b = pts[0], pts[-1]
    dx, dy = b[0] - a[0], b[1] - a[1]
    L = math.hypot(dx, dy) or 1e-12
    imax, dmax = 0, 0
    for i in range(1, len(pts) - 1):
        d = abs(dy * pts[i][0] - dx * pts[i][1] + b[0] * a[1] - b[1] * a[0]) / L
        if d > dmax:
            imax, dmax = i, d
    if dmax > eps:
        return dp(pts[: imax + 1], eps)[:-1] + dp(pts[imax:], eps)
    return [a, b]


def ring_area(r):
    return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2


def simplify(geom, eps=0.004, min_area=0.0002):
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    out = []
    for poly in polys:
        rings = []
        for j, ring in enumerate(poly):
            if ring_area(ring) < min_area:
                continue
            # a closed ring has first == last: split it at its midpoint so DP has a real chord
            m = len(ring) // 2
            simp = dp(ring[: m + 1], eps)[:-1] + dp(ring[m:], eps)
            s = [[round(x, 3), round(y, 3)] for x, y in simp]
            if len(s) >= 4:
                rings.append(s)
            if j == 0 and not rings:
                break
        if rings:
            out.append(rings)
    return {"type": "MultiPolygon", "coordinates": out}


import sys
sys.setrecursionlimit(20000)
g = json.load(open(P("geojson/limits_IT_provinces.geojson"), encoding="utf-8"))
feats = []
for f in g["features"]:
    p = f["properties"]
    feats.append({"type": "Feature", "properties": {"name": p["prov_name"], "key": key(p["prov_name"]), "region": p["reg_name"]},
                  "geometry": simplify(f["geometry"])})
dump("provinces.geojson", {"type": "FeatureCollection", "features": feats})

# ---------------------------------------------------------------- library points -> municipalities
pts = [(round(d["longitudine"], 3), round(d["latitudine"], 3)) for d in json.load(open(P("data/Dati_biblioteche/lat_long.json"), encoding="utf-8"))
       if d.get("latitudine") and d.get("longitudine") and 6 < d["longitudine"] < 19.5 and 35 < d["latitudine"] < 47.5]
dump("library_points.json", {"n": len(pts), "lonlat": [c for p_ in pts for c in p_]})


def inside(x, y, ring):
    c = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]; xj, yj = ring[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi:
            c = not c
        j = i
    return c


com = json.load(open(P("geojson/comuni.geojson"), encoding="utf-8"))
polys = []
for i, f in enumerate(com["features"]):
    geo = f["geometry"]
    ps = geo["coordinates"] if geo["type"] == "MultiPolygon" else [geo["coordinates"]]
    for poly in ps:
        xs = [c[0] for c in poly[0]]; ys = [c[1] for c in poly[0]]
        polys.append((min(xs), min(ys), max(xs), max(ys), poly, i))
grid = defaultdict(list)
G = 0.1
for pi, (x0, y0, x1, y1, _, _) in enumerate(polys):
    for gx in range(int(x0 / G), int(x1 / G) + 1):
        for gy in range(int(y0 / G), int(y1 / G) + 1):
            grid[(gx, gy)].append(pi)
count = defaultdict(int)
unmatched = 0
for x, y in pts:
    hit = None
    for pi in grid.get((int(x / G), int(y / G)), []):
        x0, y0, x1, y1, poly, i = polys[pi]
        if x0 <= x <= x1 and y0 <= y <= y1 and inside(x, y, poly[0]) and not any(inside(x, y, h) for h in poly[1:]):
            hit = i; break
    if hit is None:
        unmatched += 1
    else:
        count[hit] += 1
per_reg = defaultdict(lambda: {"municipalities": 0, "with_library": 0})
for i, f in enumerate(com["features"]):
    rk = f["properties"]["reg_name"]
    reg = region_of(rk)
    rr = per_reg[reg[0] if reg else rk]
    rr["municipalities"] += 1
    rr["with_library"] += 1 if count[i] else 0
regs = [{"region": r, "area": a, **per_reg[r], "without_library": per_reg[r]["municipalities"] - per_reg[r]["with_library"]} for r, a in REGIONS]
tot = sum(r["municipalities"] for r in regs); w = sum(r["with_library"] for r in regs)
dump("municipalities.json", {"regions": regs, "municipalities": tot, "with_library": w, "without_library": tot - w,
                             "points": len(pts), "points_outside_any_municipality": unmatched,
                             "method": "Point-in-polygon: each of the geolocated libraries in lat_long.json is placed in the municipal boundary (comuni.geojson) that contains it."})
