#!/usr/bin/env python3
"""
Pack per-yaw PNGs or stitch half-sheets into full 0..345° (24-frame) horizontal strips.

Layout:
  frame i at x = i * CELL_W, yaw = i * 15  (i = 0..23)

Usage:
  python scripts/pack-player-sheets.py
  python scripts/pack-player-sheets.py --from-regen
"""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLAYERS = ROOT / "static" / "players"
POSES = PLAYERS / "poses"
EQUIP = PLAYERS / "equipment"
ASSETS = Path.home() / ".cursor" / "projects" / "c-Users-connan-fc-fc-tactics" / "assets"

CELL_W = 160
CELL_H = 160
YAW_FULL = list(range(0, 360, 15))  # 0..345, 24 frames
YAW_COUNT = len(YAW_FULL)
# Fit inside cell: leave margin so limbs/ball are not cropped (kick needs more).
FIT_DEFAULT = 0.84
FIT_BY_POSE = {"idle": 0.86, "run": 0.80, "kick": 0.74}


def knock_out_white(im: Image.Image) -> Image.Image:
    """
    Remove white / near-white background and AA fringe (halo on black).
    Hard-key very light pixels; fade mid fringe; keep saturated kit colors.
    """
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            dist = (255 - r) + (255 - g) + (255 - b)
            chroma = max(r, g, b) - min(r, g, b)
            lum = (r + g + b) / 3.0
            # Grey AA from black-outline-on-white → halo on dark UIs. Kill mid greys.
            if chroma < 22 and lum > 90:
                px[x, y] = (0, 0, 0, 0)
                continue
            if chroma < 30 and lum >= 200:
                px[x, y] = (0, 0, 0, 0)
            elif chroma < 26 and lum >= 170 and a < 240:
                px[x, y] = (0, 0, 0, 0)
            elif dist <= 18 and chroma < 18:
                px[x, y] = (0, 0, 0, 0)
            elif dist <= 55 and chroma < 28:
                t = (dist - 18) / 37.0
                na = int(a * t * t)
                if na < 20:
                    px[x, y] = (0, 0, 0, 0)
                else:
                    px[x, y] = (r, g, b, na)
            elif r >= 242 and g >= 242 and b >= 242:
                px[x, y] = (0, 0, 0, 0)
    return im


def normalize_cell(
    im: Image.Image,
    cell_w: int = CELL_W,
    cell_h: int = CELL_H,
    fit: float = FIT_DEFAULT,
) -> Image.Image:
    im = knock_out_white(im.convert("RGBA"))
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 16:
                continue
            found = True
            minx = min(minx, x)
            miny = min(miny, y)
            maxx = max(maxx, x)
            maxy = max(maxy, y)
    if found:
        pad = 4
        im = im.crop(
            (max(0, minx - pad), max(0, miny - pad), min(w, maxx + pad + 1), min(h, maxy + pad + 1))
        )

    bw, bh = im.size
    scale = min(cell_w / max(bw, 1), cell_h / max(bh, 1)) * fit
    nw, nh = max(1, int(bw * scale)), max(1, int(bh * scale))
    scaled = im.resize((nw, nh), Image.Resampling.LANCZOS)
    # Second pass: LANCZOS reintroduces light fringe on edges
    scaled = knock_out_white(scaled)
    canvas = Image.new("RGBA", (cell_w, cell_h), (0, 0, 0, 0))
    # Feet on baseline
    canvas.paste(scaled, ((cell_w - nw) // 2, cell_h - nh), scaled)
    return canvas


def pack_row(frames: list[Image.Image], fit: float = FIT_DEFAULT) -> Image.Image:
    sheet = Image.new("RGBA", (CELL_W * len(frames), CELL_H), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        cell = normalize_cell(fr, fit=fit)
        sheet.paste(cell, (i * CELL_W, 0), cell)
    return sheet


def split_equal_frames(im: Image.Image, n: int) -> list[Image.Image]:
    """Split a wide sheet into n equal-width columns."""
    im = im.convert("RGBA")
    # trim vertical whitespace but keep full width structure
    w, h = im.size
    fw = w // n
    if fw < 8:
        raise ValueError(f"sheet too narrow for {n} frames: {w}x{h}")
    frames = []
    for i in range(n):
        frames.append(im.crop((i * fw, 0, (i + 1) * fw, h)))
    return frames


def find_sprites_row(im: Image.Image) -> list[Image.Image]:
    """Detect separate sprites in a horizontal row via column gaps."""
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    thr = 248

    def col_has(x: int) -> bool:
        for y in range(0, h, 2):
            r, g, b, a = px[x, y]
            if a > 200 and not (r >= thr and g >= thr and b >= thr):
                return True
        return False

    dens = [col_has(x) for x in range(w)]
    segs = []
    in_s = False
    s0 = 0
    for x, d in enumerate(dens):
        if d and not in_s:
            in_s = True
            s0 = x
        elif not d and in_s:
            in_s = False
            if x - s0 > 12:
                segs.append((s0, x))
    if in_s and w - s0 > 12:
        segs.append((s0, w))

    # merge tiny gaps
    merged = []
    for a, b in segs:
        if merged and a - merged[-1][1] < 8:
            merged[-1] = (merged[-1][0], b)
        else:
            merged.append((a, b))
    return [im.crop((a, 0, b, h)) for a, b in merged]


def collect_yaw_files(folder: Path, posture_id: str) -> dict[int, Path]:
    found: dict[int, Path] = {}
    for p in folder.glob(f"{posture_id}_*.png"):
        m = re.match(rf"^{re.escape(posture_id)}_(\d+)\.png$", p.name)
        if m:
            found[int(m.group(1))] = p
    return found


def nearest_path(yaw: int, available: dict[int, Image.Image | Path]) -> Image.Image:
    keys = list(available.keys())
    best = min(keys, key=lambda y: min(abs(y - yaw), 360 - abs(y - yaw)))
    v = available[best]
    return Image.open(v) if isinstance(v, Path) else v


def pack_from_loose(folder: Path, pid: str) -> tuple[Image.Image, list[int]] | None:
    yaw_files = collect_yaw_files(folder, pid)
    if not yaw_files:
        return None
    frames = []
    yaws = []
    for y in YAW_FULL:
        frames.append(nearest_path(y, yaw_files))
        yaws.append(y)
    return pack_row(frames), yaws


def find_ink_segments(
    im: Image.Image, thr: int = 248, min_w: int = 8, merge_gap: int = 6
) -> list[tuple[int, int]]:
    """Horizontal ink spans (inclusive-exclusive x ranges)."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    dens = []
    for x in range(w):
        has = False
        for y in range(0, h, 2):
            r, g, b, a = px[x, y]
            if a > 200 and not (r >= thr and g >= thr and b >= thr):
                has = True
                break
        dens.append(has)
    segs: list[list[int]] = []
    in_s = False
    s0 = 0
    for x, d in enumerate(dens):
        if d and not in_s:
            in_s = True
            s0 = x
        elif not d and in_s:
            in_s = False
            if x - s0 >= min_w:
                segs.append([s0, x])
    if in_s and w - s0 >= min_w:
        segs.append([s0, w])
    merged: list[list[int]] = []
    for a, b in segs:
        if merged and a - merged[-1][1] < merge_gap:
            merged[-1][1] = b
        else:
            merged.append([a, b])
    return [(a, b) for a, b in merged]


def frames_from_half(im: Image.Image, expected: int = 12) -> list[Image.Image]:
    """
    Split a half-sheet into `expected` character crops.
    Prefer ink gaps; subdivide only oversized blobs; else equal columns.
    """
    im = im.convert("RGBA")
    segs = find_ink_segments(im)
    if not segs:
        print(f"    no ink, equal split x{expected}")
        return split_equal_frames(im, expected)

    # Near-miss: pad/trim without cutting a normal-width figure
    if abs(len(segs) - expected) <= 1:
        crops = [im.crop((a, 0, b, im.height)) for a, b in segs]
        crops = crops[:expected]
        while len(crops) < expected and crops:
            crops.append(crops[-1].copy())
        print(f"    gap-detect {len(segs)} -> {len(crops)} (pad/trim)")
        return crops

    # Touching row (few gaps): equal-split the full ink span — avoids edge crumbs
    if len(segs) <= expected // 2:
        left, right = segs[0][0], segs[-1][1]
        span = right - left
        # Inset each column slightly so neighboring limbs don't bleed into the cell
        inset = max(2, int(span / expected * 0.04))
        print(f"    touching row ({len(segs)} segs), equal ink split x{expected} (inset={inset})")
        frames = []
        for i in range(expected):
            x0 = int(left + span * i / expected) + inset
            x1 = int(left + span * (i + 1) / expected) - inset
            if x1 <= x0:
                x0 = int(left + span * i / expected)
                x1 = int(left + span * (i + 1) / expected)
            frames.append(im.crop((x0, 0, x1, im.height)))
        return frames

    widths = [b - a for a, b in segs]
    typical = min(widths)  # smallest span ≈ one character
    counts = [1] * len(segs)
    need = expected - len(segs)
    if need > 0:
        # Prefer blobs with the most excess width beyond N×typical
        while need > 0:
            i = max(
                range(len(segs)),
                key=lambda j: widths[j] - typical * counts[j],
            )
            counts[i] += 1
            need -= 1
    elif need < 0:
        # Too many segs: merge closest pairs
        segs_m = [list(s) for s in segs]
        while len(segs_m) > expected:
            gaps = [(segs_m[i + 1][0] - segs_m[i][1], i) for i in range(len(segs_m) - 1)]
            _, i = min(gaps)
            segs_m[i][1] = segs_m[i + 1][1]
            del segs_m[i + 1]
        print(f"    gap-detect {len(segs)} merged -> {expected}")
        return [im.crop((a, 0, b, im.height)) for a, b in segs_m]

    frames: list[Image.Image] = []
    for (a, b), c in zip(segs, counts):
        if c == 1:
            frames.append(im.crop((a, 0, b, im.height)))
        else:
            step = (b - a) / c
            for i in range(c):
                x0 = int(a + i * step)
                x1 = int(a + (i + 1) * step)
                frames.append(im.crop((x0, 0, x1, im.height)))
    print(f"    gap-detect={len(segs)} subdivided -> {len(frames)} (counts={counts})")
    return frames[:expected]


def stitch_regen_halves(a: Path, b: Path, fit: float = FIT_DEFAULT) -> Image.Image:
    """Two sheets of ~12 figures each → 24-frame row."""
    im_a = Image.open(a)
    im_b = Image.open(b)
    fa = frames_from_half(im_a, 12)
    fb = frames_from_half(im_b, 12)
    print(f"    halves: {len(fa)} + {len(fb)} frames (fit={fit})")
    return pack_row((fa + fb)[:24], fit=fit)


def write_pose_manifest(postures: list[dict]):
    manifest = {
        "standingHeightPx": 128,
        "sheet": {"layout": "row", "cell": {"w": CELL_W, "h": CELL_H}},
        "anchor": {"x": 0.5, "y": 1.0},
        "yaws": YAW_FULL,
        "rotation": "character_turns_left",
        "postures": postures,
    }
    (POSES / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote {POSES / 'manifest.json'}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from-regen", action="store_true", help="Stitch assets/regen*-{a,b}.png halves")
    ap.add_argument(
        "--prefix",
        default="regen2",
        help="Asset prefix (default regen2; falls back to regen)",
    )
    args = ap.parse_args()

    labels = {"idle": "Debout", "run": "Course", "kick": "Frappe"}
    tags = {"idle": ["base"], "run": ["move"], "kick": ["shoot", "outfield"]}
    by_id: dict[str, dict] = {}

    if args.from_regen:
        print("Stitching regen halves…")
        for morph, mid in (("man", "man"), ("woman", "woman"), ("child", "child")):
            out_dir = POSES / morph
            out_dir.mkdir(parents=True, exist_ok=True)
            for pose in ("idle", "kick", "run"):
                fit = FIT_BY_POSE.get(pose, FIT_DEFAULT)
                # Prefer --prefix (regen2), then legacy regen
                candidates = [
                    (ASSETS / f"{args.prefix}-{mid}-{pose}-a.png", ASSETS / f"{args.prefix}-{mid}-{pose}-b.png"),
                    (ASSETS / f"regen-{mid}-{pose}-a.png", ASSETS / f"regen-{mid}-{pose}-b.png"),
                ]
                sheet = None
                for ha, hb in candidates:
                    if ha.exists() and hb.exists():
                        print(f"  {morph}/{pose} from {ha.name} + {hb.name}")
                        sheet = stitch_regen_halves(ha, hb, fit=fit)
                        break
                if sheet is None:
                    full = ASSETS / f"{args.prefix}-{mid}-{pose}.png"
                    if not full.exists():
                        full = ASSETS / f"regen-{mid}-{pose}.png"
                    if full.exists():
                        sprites = find_sprites_row(Image.open(full))
                        print(f"  {morph}/{pose} from full: {len(sprites)} sprites")
                        if not sprites:
                            continue
                        while len(sprites) < 24:
                            sprites.append(sprites[-1])
                        sheet = pack_row(sprites[:24], fit=fit)
                    else:
                        print(f"  skip {morph}/{pose} (no regen assets)")
                        continue
                dest = out_dir / f"{pose}.png"
                sheet.save(dest)
                print(f"  wrote {dest.relative_to(ROOT)} ({sheet.size[0]//CELL_W} frames)")
                if pose not in by_id:
                    by_id[pose] = {
                        "id": pose,
                        "label": labels[pose],
                        "tags": tags[pose],
                        "yaws": {},
                    }
                by_id[pose]["yaws"][morph] = list(YAW_FULL)
        write_pose_manifest([by_id[k] for k in sorted(by_id)])
        return

    # Default: pack loose {id}_{yaw}.png
    print("Packing from loose yaw files…")
    for morph in ("man", "woman", "child"):
        folder = POSES / morph
        folder.mkdir(parents=True, exist_ok=True)
        ids = set()
        for p in folder.glob("*_*.png"):
            m = re.match(r"^(.+)_(\d+)\.png$", p.name)
            if m:
                ids.add(m.group(1))
        for pid in sorted(ids):
            packed = pack_from_loose(folder, pid)
            if not packed:
                continue
            sheet, yaws = packed
            dest = folder / f"{pid}.png"
            sheet.save(dest)
            print(f"  {dest.relative_to(ROOT)}")
            if pid not in by_id:
                by_id[pid] = {
                    "id": pid,
                    "label": labels.get(pid, pid),
                    "tags": tags.get(pid, []),
                    "yaws": {},
                }
            by_id[pid]["yaws"][morph] = yaws
            for p in collect_yaw_files(folder, pid).values():
                p.unlink(missing_ok=True)

    write_pose_manifest([by_id[k] for k in sorted(by_id)])

    # Equipment
    print("Packing equipment…")
    EQUIP.mkdir(parents=True, exist_ok=True)
    items = []
    meta = {
        "ladder": ("Échelle d'agilité", True),
        "hurdle": ("Haie", True),
        "cone": ("Plot", False),
        "ball": ("Ballon", False),
    }
    ids = set()
    for p in EQUIP.glob("*_*.png"):
        m = re.match(r"^(.+)_(\d+)\.png$", p.name)
        if m:
            ids.add(m.group(1))
    # also single-frame sheets already named cone.png etc — skip
    for eid in sorted(ids):
        yaw_files = collect_yaw_files(EQUIP, eid)
        oriented = meta.get(eid, (eid, True))[1]
        label = meta.get(eid, (eid, True))[0]
        if oriented:
            frames = [nearest_path(y, {k: Image.open(v) for k, v in yaw_files.items()}) for y in YAW_FULL]
            # fix nearest_path for Image dict
            avail = {k: Image.open(v) for k, v in yaw_files.items()}
            frames = []
            for y in YAW_FULL:
                best = min(avail.keys(), key=lambda k: min(abs(k - y), 360 - abs(k - y)))
                frames.append(avail[best])
            yaws = list(YAW_FULL)
        else:
            y0 = sorted(yaw_files.keys())[0]
            frames = [Image.open(yaw_files[y0])]
            yaws = [0]
        sheet = pack_row(frames)
        (EQUIP / f"{eid}.png").save(sheet)
        item = {
            "id": eid,
            "label": label,
            "oriented": oriented,
            "yaws": yaws,
            "anchor": {"x": 0.5, "y": 0.5 if eid == "ladder" else 1.0},
        }
        if eid == "ball":
            item["recolor"] = "ball"
        items.append(item)
        for p in yaw_files.values():
            p.unlink(missing_ok=True)

    # Keep existing equipment sheets if no loose files
    if not items:
        for eid, (label, oriented) in meta.items():
            p = EQUIP / f"{eid}.png"
            if not p.exists():
                continue
            im = Image.open(p)
            n = max(1, im.size[0] // CELL_W)
            yaws = list(YAW_FULL) if oriented and n >= 20 else ([0] if n == 1 else [i * 15 for i in range(n)])
            item = {
                "id": eid,
                "label": label,
                "oriented": oriented,
                "yaws": yaws if oriented else [0],
                "anchor": {"x": 0.5, "y": 0.5 if eid == "ladder" else 1.0},
            }
            if eid == "ball":
                item["recolor"] = "ball"
            items.append(item)

    equip_manifest = {
        "sheet": {"layout": "row", "cell": {"w": CELL_W, "h": CELL_H}},
        "yaws": YAW_FULL,
        "rotation": "character_turns_left",
        "items": items,
    }
    (EQUIP / "manifest.json").write_text(json.dumps(equip_manifest, indent=2), encoding="utf-8")
    print(f"wrote {EQUIP / 'manifest.json'}")
    print("Done.")


if __name__ == "__main__":
    main()
