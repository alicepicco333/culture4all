# Fonts

Both faces were chosen from Free Faces (freefaces.gallery) and are licensed under the SIL Open Font License 1.1, which allows web embedding and commercial use. Neither declares a Reserved Font Name. The files here are Latin subsets (Basic Latin, Latin-1, Latin Extended-A, so all Italian accents) built by `scripts/build_font.py`.

| File | Face | Designer | Source | Licence |
|---|---|---|---|---|
| `hyperlegible-sans-400.woff2`, `-500`, `-700` | Hyperlegible Sans | Matthew Larn | https://github.com/matthewlarn/hyperlegible-sans (listed at https://www.freefaces.gallery/typefaces/hyperlegible-sans) | `OFL-HyperlegibleSans.txt` |
| `haskoy-var.woff2` (weight 400-700) | Hasköy | Ertekin Nazif Oğuz | https://github.com/ertekinno/haskoy, https://haskoy.ertekinn.com/ (listed at https://www.freefaces.gallery/typefaces/haskoy) | `OFL-Haskoy.txt` |

Change to Hyperlegible Sans: the default zero carries a slash; the build replaces it with the font's own plain tabular zero, centred in the proportional width, so every zero on the page is plain. Hasköy is unchanged apart from subsetting and the weight range.
