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


# =====================================================================================
# ATLAS (v2): every institution with coordinates, for the clickable map and "your place"
# =====================================================================================
# Inputs
#   data/Dataset_luoghi_cultura/dataset_luoghi_cultura_2022.rdf
#       dati.cultura "Luoghi della cultura" (Ministry of Culture), 6,641 places with
#       name, type, address, city/province/region, coordinates, website, opening hours,
#       full and reduced ticket price ("Gratuito" = free), record source and dates.
#   data/Dati_biblioteche/lat_long.json
#       ICCU register of libraries, 2022: name and coordinates only.
#   geojson/comuni.geojson
#       used to place every point in a municipality (point-in-polygon, computed here).
# Outputs
#   data/story/atlas_points.json   compact arrays for the map + search (all points)
#   data/story/atlas/<region>.json record details, loaded only when a card is opened
#   data/story/places.json         per-region / per-province aggregates for "your place"
# Contact e-mails and phone numbers are deliberately NOT copied: some are personal.
import xml.etree.ElementTree as ET

RDFNS = "{http://www.w3.org/1999/02/22-rdf-syntax-ns#}"
RES = "http://dati.beniculturali.it/mibact/luoghi/resource/"
graph = {}
for ev, el in ET.iterparse(P("data/Dataset_luoghi_cultura/dataset_luoghi_cultura_2022.rdf")):
    if el.tag == RDFNS + "Description":
        d = graph.setdefault(el.get(RDFNS + "about"), {})
        for c in el:
            d.setdefault(c.tag.split("}")[1], []).append(c.get(RDFNS + "resource") or (c.text or "").strip())
        el.clear()


def first(node, p):
    return (node.get(p) or [None])[0] if node else None


TYPE_EN = {
    "Museo, Galleria e/o raccolta": "Museum, gallery or collection",
    "Area Archeologica": "Archaeological area", "Parco Archeologico": "Archaeological park",
    "Chiesa o edificio di culto": "Church or place of worship",
    "Villa o Palazzo di interesse storico o artistico": "Historic villa or palace",
    "Architettura Civile": "Civil architecture", "Architettura Fortificata": "Fortified architecture",
    "Monumento": "Monument", "Monumento Funerario": "Funerary monument",
    "Monumento di Archeologia Industriale": "Industrial heritage",
    "Parco o Giardino di interesse storico o artistico": "Historic park or garden",
    "Archivio di Stato": "State archive", "Archivio": "Archive",
    "Biblioteca Statale": "State library", "Biblioteca": "Library",
    "Altro": "Other", "Fondazione": "Foundation",
}


def cat_of(t):
    if t.startswith("Biblioteca"):
        return 0
    if t.startswith("Museo"):
        return 1
    if t.startswith("Archivio") or t == "Soprintendenza Archivistica e Bibliografica":
        return 2
    return 3


def price(v):
    if v is None:
        return None
    if v.strip().lower() == "gratuito":
        return 0.0
    try:
        return float(v.replace(",", "."))
    except ValueError:
        return None


def excerpt(s, n=420):
    s = re.sub(r"\s+", " ", s or "").strip()
    if len(s) <= n:
        return s
    cut = s[:n].rsplit(" ", 1)[0]
    return cut.rstrip(",;:.") + "…"


def site_url(u):
    u = (u or "").strip()
    if not u or " " in u or "." not in u:
        return None
    return u if re.match(r"https?://", u, re.I) else "http://" + u


def tail(uri):
    return uri.rsplit("/", 1)[-1].replace("_", " ") if uri else None


dc = []
for uri, n in graph.items():
    if not uri.startswith(RES + "CulturalInstituteOrSite/") or uri.endswith(".rdf"):
        continue
    ident = uri.rsplit("/", 1)[-1]
    try:
        lat, lon = float(first(n, "lat")), float(first(n, "long"))
    except (TypeError, ValueError):
        continue
    if not (6 < lon < 19.5 and 35 < lat < 47.5):
        continue
    t_it = next((x for x in n.get("type", []) if not x.startswith("http")), "Altro")
    site = graph.get(first(n, "hasSite"), {})
    addr = graph.get(first(site, "siteAddress"), {})
    city = graph.get(first(addr, "hasCity"), {})
    prov = graph.get(first(addr, "hasProvince"), {})
    webs = []
    for cp in n.get("hasOnlineContactPoint", []):
        for w in graph.get(cp, {}).get("hasWebSite", []):
            u = site_url(first(graph.get(w, {}), "URL"))
            if u and u not in webs:
                webs.append(u)
    hours = None
    for ac in n.get("hasAccessCondition", []):
        if "/OpeningHoursSpecification/Orari_di_apertura" in ac:
            hours = first(graph.get(ac), "description")
    base = price(first(graph.get(RES + "PriceSpecification/" + ident + "_Base"), "hasCurrencyValue"))
    red = price(first(graph.get(RES + "PriceSpecification/" + ident + "_Riduzione"), "hasCurrencyValue"))
    meta = graph.get(uri + ".rdf", {})
    dc.append({
        "id": ident, "lon": lon, "lat": lat, "cat": cat_of(t_it),
        "name": re.sub(r"\s+", " ", first(n, "institutionalCISName") or first(n, "label") or "").strip(),
        "type_it": t_it, "type_en": TYPE_EN.get(t_it, t_it),
        "address": (first(addr, "fullAddress") or "").strip() or None,
        "postcode": first(addr, "postCode"),
        "city": first(city, "name") or tail(first(addr, "hasCity")),
        "province": first(prov, "name") or tail(first(addr, "hasProvince")),
        "region": tail(first(addr, "hasRegion")),
        "web": webs[:2], "hours": hours,
        "free": None if base is None else (1 if base == 0 else 2),
        "price": base, "reduced": red,
        "about": excerpt(first(n, "description")),
        "src": first(meta, "source"), "modified": (first(meta, "modified") or "")[:10] or None,
    })

iccu = [d for d in json.load(open(P("data/Dati_biblioteche/lat_long.json"), encoding="utf-8"))
        if d.get("latitudine") and d.get("longitudine") and 6 < d["longitudine"] < 19.5 and 35 < d["latitudine"] < 47.5]

# de-duplicate: an ICCU library within ~150 m of a dati.cultura library record is taken to be
# the same place; the richer dati.cultura record is kept.
dclib = [(d["lon"], d["lat"]) for d in dc if d["cat"] == 0]


def near_dc_library(lon, lat):
    return any(abs(lon - x) < 0.002 and abs(lat - y) < 0.0015 for x, y in dclib)


iccu_kept = [d for d in iccu if not near_dc_library(d["longitudine"], d["latitudine"])]
dups = len(iccu) - len(iccu_kept)


def locate(x, y):
    for pi in grid.get((int(x / G), int(y / G)), []):
        x0, y0, x1, y1, poly, i = polys[pi]
        if x0 <= x <= x1 and y0 <= y <= y1 and inside(x, y, poly[0]) and not any(inside(x, y, h) for h in poly[1:]):
            return i
    return None


REG_NAMES = [r for r, _ in REGIONS]
cprops = [f["properties"] for f in com["features"]]
prov_names = sorted({p["prov_name"] for p in cprops})
prov_region = {p["prov_name"]: REG_NAMES.index(region_of(p["reg_name"])[0]) for p in cprops}
com_used = {}


def com_idx(i):
    if i not in com_used:
        com_used[i] = len(com_used)
    return com_used[i]


pts_out = {"x": [], "y": [], "t": [], "f": [], "m": [], "r": [], "n": [], "id": []}
details = defaultdict(dict)
agg_reg = [defaultdict(int) for _ in REGIONS]
agg_prov = {p: defaultdict(int) for p in prov_names}
outside = [0]


def bump(a, cat, free):
    a["t%d" % cat] += 1
    if free == 1:
        a["free%d" % cat] += 1
    if free == 2:
        a["tick%d" % cat] += 1


def add(lon, lat, cat, free, name, ident, rec_region):
    ci = locate(lon, lat)
    if ci is not None:
        pp = cprops[ci]
        reg_i = prov_region[pp["prov_name"]]
        m = com_idx(ci)
        bump(agg_prov[pp["prov_name"]], cat, free)
    else:
        outside[0] += 1
        rr = region_of(rec_region or "")
        if rr is None:
            return None
        reg_i, m = REG_NAMES.index(rr[0]), -1
    bump(agg_reg[reg_i], cat, free)
    for k, v in (("x", round(lon * 1e4)), ("y", round(lat * 1e4)), ("t", cat), ("f", free or 0), ("m", m),
                 ("r", reg_i), ("n", name), ("id", ident)):
        pts_out[k].append(v)
    return reg_i


for d in dc:
    reg_i = add(d["lon"], d["lat"], d["cat"], d["free"], d["name"], d["id"], d["region"])
    if reg_i is not None:
        details[reg_i][d["id"]] = {k: d[k] for k in ("type_it", "type_en", "address", "postcode", "city", "province",
                                                     "region", "web", "hours", "price", "reduced", "about", "src", "modified")
                                   if d[k] not in (None, [], "")}
for d in iccu_kept:
    add(d["longitudine"], d["latitudine"], 0, None, re.sub(r"\s+", " ", d["denominazione"]).strip(), "", None)

inv = sorted(com_used.items(), key=lambda kv: kv[1])
towns = [[cprops[i]["name"], prov_names.index(cprops[i]["prov_name"])] for i, _ in inv]
dump("atlas_points.json", {
    "regions": REG_NAMES, "provinces": [[p, prov_region[p]] for p in prov_names], "towns": towns,
    "types": ["Library", "Museum", "Archive", "Other heritage site"], **pts_out,
    "count": len(pts_out["x"]), "n_dc": sum(1 for i in pts_out["id"] if i), "n_iccu": sum(1 for i in pts_out["id"] if not i),
    "iccu_duplicates_dropped": dups, "outside_municipalities": outside[0],
    "note": "x, y = lon, lat x 10^4. t = type index. f: 0 not stated, 1 free, 2 ticket. m = town index (-1 = outside every "
            "municipal boundary). r = region index. id = dati.cultura record id ('' = ICCU library: name and coordinates only).",
})
os.makedirs(os.path.join(OUT, "atlas"), exist_ok=True)
for ri, recs in details.items():
    with open(os.path.join(OUT, "atlas", key(REG_NAMES[ri]) + ".json"), "w", encoding="utf-8") as fh:
        json.dump(recs, fh, ensure_ascii=False, separators=(",", ":"))
print("wrote atlas/ shards:", len(details))

# ---------------------------------------------------------------- places ("your place")
prov_mun = {p: {"municipalities": 0, "with_library": 0} for p in prov_names}
for i, pp in enumerate(cprops):
    prov_mun[pp["prov_name"]]["municipalities"] += 1
    prov_mun[pp["prov_name"]]["with_library"] += 1 if count[i] else 0
lib12 = {p["key"]: p for p in prov12}


def lib12_of(name):
    k = key(name)
    if k in lib12:
        return lib12[k]
    for kk, v in lib12.items():
        if kk.startswith(k) or k.startswith(kk):
            return v
    return None


provinces_out = []
for p in prov_names:
    l = lib12_of(p)
    rec = {"name": p, "region": REG_NAMES[prov_region[p]], **prov_mun[p],
           "lib2012": l["libraries"] if l else None, "per10k2012": l["per10k"] if l else None}
    rec.update({k: agg_prov[p][k] for k in sorted(agg_prov[p])})
    provinces_out.append(rec)
regions_out = [{"region": r, "area": a, **{k: agg_reg[i][k] for k in sorted(agg_reg[i])}} for i, (r, a) in enumerate(REGIONS)]
dump("places.json", {"regions": regions_out, "provinces": provinces_out,
                     "method": "Institution counts per place: atlas points (dati.cultura 2022 + ICCU 2022) placed in municipal "
                               "boundaries by point-in-polygon. Municipalities without a library as in municipalities.json. "
                               "2012 library rates are ISTAT's own."})
