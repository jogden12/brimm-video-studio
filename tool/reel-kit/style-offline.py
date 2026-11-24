#!/usr/bin/env python3
"""BRIMM Video Studio's offline run of Reel Kit's pipeline/style.py (final review B2 of Reel Kit in Studio).

Reel Kit's style.py writes brand.css and fonts/ from a pack's style.json. Its write() always asks Google Fonts' web service for each family's
CSS (_fetch_css), and the worker has no network, so a change to her style could never finish. Studio's packs carry their fonts already:
the working copy's style/fonts/ holds The BRIMM's Josefin Sans and Allison, Google Fonts TTFs named as Reel Kit names them
(JosefinSans-normal-400.ttf). This runs style.py as it is, KIT untouched, with _fetch_css answered from those files alone, so
font_faces finds each one there and fetches nothing; a weight with no file is left out, as style.py leaves out one Google lacks, and a
family with none gets style.py's own warning. Any download that would still be tried is refused.

Studio puts this file in REEL_KIT_HOME/tools/studio/ before each style job (the worker can read it there, never write it), and the
worker runs it exactly as style.py's own help gives, by Reel Kit's Python, whose reel-kit.pth puts KIT/pipeline on the path:
    PY tools/studio/style-offline.py path/to/style.json [--out DIR]
"""
import os
import sys
import urllib.request

import style  # Reel Kit's own pipeline/style.py, from KIT/pipeline (reel-kit.pth)

_fonts_dir = None


def _refuse(*args, **kwargs):
    raise OSError("BRIMM Video Studio's style.py runs offline: nothing is downloaded")


def _local_css(family, pairs):
    """The @font-face blocks Google would give for `family` at `pairs` ((italic, weight)), for the files already in fonts/ alone."""
    blocks = []
    for italic, weight in sorted(pairs):
        font_style = "italic" if italic else "normal"
        name = f"{family.replace(' ', '')}-{font_style}-{weight}.ttf"
        path = os.path.join(_fonts_dir or "", name)
        if _fonts_dir and os.path.isfile(path) and not os.path.islink(path):
            # The URL is never fetched: font_faces names the file by family, style and weight, finds it there, and keeps it.
            blocks.append(f"@font-face {{ font-family: '{family}'; font-style: {font_style}; font-weight: {weight}; "
                          f"src: url(https://fonts.invalid/{name}) format('truetype'); }}\n")
    return "".join(blocks) or None


_font_faces = style.font_faces


def _offline_font_faces(S, outdir):
    global _fonts_dir
    _fonts_dir = outdir
    return _font_faces(S, outdir)


style._fetch_css = _local_css
style.font_faces = _offline_font_faces
style.urllib.request.urlopen = _refuse
style.urllib.request.urlretrieve = _refuse
urllib.request.urlopen = _refuse
urllib.request.urlretrieve = _refuse


if __name__ == "__main__":
    # As style.py's own: [path/to/style.json] [--out DIR].
    argv, out, pack = sys.argv[1:], None, None
    while argv:
        a = argv.pop(0)
        if a == "--out":
            out = argv.pop(0)
        else:
            pack = a
    pack = pack or os.path.join(style.STYLE_DIR, "style.json")
    S = style.load(pack)
    print(style.write(S, out or os.path.dirname(os.path.abspath(pack))))
    for w in style.check(S):
        print("WARNING", w)
