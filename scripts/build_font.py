"""Build the self-hosted web fonts for Culture for All from their official releases (both found on freefaces.gallery).

- Hyperlegible Sans by Matthew Larn, SIL OFL 1.1, github.com/matthewlarn/hyperlegible-sans (fonts/ttf/HyperlegibleSans-
  {Regular,Medium,Bold}.ttf). Text, labels and charts. One change: the default zero carries a slash; it becomes the font's
  own plain tabular zero (`zero.tf`), centred in the proportional advance, so every zero on the page is plain.
- Haskoy by Ertekin Nazif Oğuz, SIL OFL 1.1, github.com/ertekinno/haskoy (fonts/ttf/Haskoy-variable.ttf). Headings,
  chapter markers and large figures. Kept variable, wght axis limited to 400-700.
Neither licence declares a Reserved Font Name, so the subsets keep their names. Both are subset to Latin, Latin-1 and
Latin Extended-A (Italian accents included) plus the typographic marks the page uses, and written as woff2.
usage: python -I build_font.py <dir with the source files> <out-dir>
"""
import sys, os
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer
from fontTools.ttLib.tables._g_l_y_f import Glyph, GlyphComponent
from fontTools.subset import Subsetter, Options

SRC, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
UNICODES = list(range(0x20, 0x7F)) + list(range(0xA0, 0x180)) + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026,
            0x20AC, 0x00D7, 0x2265, 0x2264, 0x2192, 0x2191, 0x2190, 0x2193, 0x00B7, 0x2212, 0x2022, 0x2009, 0x202F, 0x2032, 0xFFFD]
FEATURES = ["kern", "liga", "calt", "ccmp", "locl", "mark", "mkmk", "case", "tnum", "pnum", "lnum"]


def subset_save(f, path, after=None):
    opts = Options(); opts.layout_features = FEATURES; opts.flavor = "woff2"; opts.name_IDs = ["*"]; opts.notdef_outline = True
    sub = Subsetter(opts); sub.populate(unicodes=UNICODES); sub.subset(f)
    if after: f = after(f)
    f.flavor = "woff2"; f.save(path)
    print(path, os.path.getsize(path), "bytes")


def tabular_zero(f):
    """The glyph the tnum feature substitutes for zero (glyph names differ between the weights)."""
    gsub = f["GSUB"].table
    for fr in gsub.FeatureList.FeatureRecord:
        if fr.FeatureTag != "tnum": continue
        for li in fr.Feature.LookupListIndex:
            for st in gsub.LookupList.Lookup[li].SubTable:
                m = getattr(st, "mapping", None) or getattr(getattr(st, "ExtSubTable", None), "mapping", None)
                if m and "zero" in m: return m["zero"]
    raise SystemExit("no tabular zero")


for wght, style in [(400, "Regular"), (500, "Medium"), (700, "Bold")]:
    f = TTFont(os.path.join(SRC, f"HyperlegibleSans-{style}.ttf"))
    glyf, hmtx = f["glyf"], f["hmtx"]
    adv = hmtx["zero"][0]
    tz = tabular_zero(f)
    tf_adv = hmtx[tz][0]
    comp = GlyphComponent(); comp.glyphName, comp.x, comp.y, comp.flags = tz, round((adv - tf_adv) / 2), 0, 0
    g = Glyph(); g.numberOfContours = -1; g.components = [comp]
    glyf["zero"] = g; g.recalcBounds(glyf); hmtx["zero"] = (adv, g.xMin)
    subset_save(f, os.path.join(OUT, f"hyperlegible-sans-{wght}.woff2"))

subset_save(TTFont(os.path.join(SRC, "Haskoy-variable.ttf")), os.path.join(OUT, "haskoy-var.woff2"),
            after=lambda f: instancer.instantiateVariableFont(f, {"wght": (400, 700)}))
