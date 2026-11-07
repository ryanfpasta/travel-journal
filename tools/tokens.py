"""Copies the colour schemes from the shared design-tokens.json (the same file the Android app uses)
into js/app.js, between the SCHEMES markers. Run: python3 tools/tokens.py path/to/design-tokens.json"""
import json, re, sys

KEYS = {"RED": "red", "OCEAN": "blue", "FOREST": "green", "LAGOON": "teal", "SUNSET": "orange", "PLUM": "plum", "CHARCOAL": "charcoal"}
ORDER = ["red", "blue", "green", "teal", "orange", "plum", "charcoal"]
ROLES = ["primary", "onPrimary", "primaryContainer", "onPrimaryContainer", "secondaryContainer", "onSecondaryContainer",
         "background", "surfaceContainerLowest", "surfaceContainerLow", "surfaceContainer", "surfaceContainerHigh", "surfaceContainerHighest",
         "onSurface", "onSurfaceVariant", "outline", "outlineVariant", "inverseSurface", "inverseOnSurface", "error", "tertiary"]

tokens = json.load(open(sys.argv[1]))
out = {}
for key, s in tokens["color"]["schemes"].items():
    k = KEYS[key]
    out[k] = {"name": s["name"], "l": [s["light"][r].upper() for r in ROLES], "d": [s["dark"][r].upper() for r in ROLES]}
block = "  var SCHEMES = {\n" + ",\n".join("    %s: %s" % (k, json.dumps(out[k], separators=(",", ":"))) for k in ORDER) + ",\n  };\n"
p = "js/app.js"
src = open(p).read()
new, n = re.subn(r"  var SCHEMES = \{\n.*?\n  \};\n", lambda m: block, src, count=1, flags=re.S)
assert n == 1, "SCHEMES block not found"
open(p, "w").write(new)
print("schemes:", ", ".join(out[k]["name"] for k in ORDER))
