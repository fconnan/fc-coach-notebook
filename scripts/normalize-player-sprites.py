#!/usr/bin/env python3
"""
Normalize player/equipment sprites into static/players/.

- Trim near-white background → alpha
- Scale so standing-equivalent body height ≈ STANDING_H
- Place feet on baseline of a fixed canvas
- Optionally extract connected components from a sheet

Usage:
  python scripts/normalize-player-sprites.py
  python scripts/normalize-player-sprites.py --extract-sheets
"""

from __future__ import annotations

import argparse
import json
import re
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PLAYERS = ROOT / "static" / "players"
POSES = PLAYERS / "poses"
EQUIP = PLAYERS / "equipment"
GEMINI = ROOT / "docs" / "specs" / "gemini"

STANDING_H = 128
CANVAS_W = 160
CANVAS_H = 160
WHITE_THR = 248


def is_content(px, x, y) -> bool:
    p = px[x, y]
    if len(p) == 4 and p[3] < 200:
        return False
    r, g, b = p[0], p[1], p[2]
    return not (r >= WHITE_THR and g >= WHITE_THR and b >= WHITE_THR)


def trim_to_content(im: Image.Image, margin: int = 2) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    minx, miny, maxx, maxy = w, h, 0, 0
    found = False
    for y in range(h):
        for x in range(w):
            if is_content(px, x, y):
                found = True
                minx = min(minx, x)
                miny = min(miny, y)
                maxx = max(maxx, x)
                maxy = max(maxy, y)
    if not found:
        return im
    return im.crop(
        (
            max(0, minx - margin),
            max(0, miny - margin),
            min(w, maxx + 1 + margin),
            min(h, maxy + 1 + margin),
        )
    )


def white_to_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= WHITE_THR and g >= WHITE_THR and b >= WHITE_THR:
                px[x, y] = (255, 255, 255, 0)
    return im


def normalize_sprite(im: Image.Image, standing_h: int = STANDING_H) -> Image.Image:
    """Scale so content height ≈ standing_h * 0.92 (leave headroom), feet on baseline."""
    im = white_to_alpha(trim_to_content(im))
    bw, bh = im.size
    if bh < 1 or bw < 1:
        return Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    target_h = int(standing_h * 0.92)
    scale = target_h / bh
    nw = max(1, int(bw * scale))
    nh = max(1, int(bh * scale))
    scaled = im.resize((nw, nh), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
    x = (CANVAS_W - nw) // 2
    y = CANVAS_H - nh  # feet on bottom
    canvas.paste(scaled, (x, y), scaled)
    return canvas


def find_components(im: Image.Image, min_area: int = 80, step: int = 2):
    im = im.convert("RGBA")
    w, h = im.size
    px = im.load()
    mw, mh = w // step, h // step
    mask = [[False] * mw for _ in range(mh)]
    for y in range(mh):
        for x in range(mw):
            if is_content(px, x * step, y * step):
                mask[y][x] = True
    visited = [[False] * mw for _ in range(mh)]
    boxes = []
    for y in range(mh):
        for x in range(mw):
            if not mask[y][x] or visited[y][x]:
                continue
            q = deque([(y, x)])
            visited[y][x] = True
            minx = maxx = x
            miny = maxy = y
            area = 0
            while q:
                cy, cx = q.popleft()
                area += 1
                for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
                    ny, nx = cy + dy, cx + dx
                    if 0 <= ny < mh and 0 <= nx < mw and mask[ny][nx] and not visited[ny][nx]:
                        visited[ny][nx] = True
                        q.append((ny, nx))
                        minx = min(minx, nx)
                        maxx = max(maxx, nx)
                        miny = min(miny, ny)
                        maxy = max(maxy, ny)
            if area < min_area:
                continue
            boxes.append(
                [minx * step, miny * step, (maxx + 1) * step, (maxy + 1) * step, area]
            )
    return boxes  # no merge — dense sprite sheets collapse if merged


def merge_boxes(boxes, gap=14):
    if not boxes:
        return []
    boxes = [list(b) for b in boxes]
    changed = True
    while changed:
        changed = False
        out = []
        used = [False] * len(boxes)
        for i, a in enumerate(boxes):
            if used[i]:
                continue
            x0, y0, x1, y1, ar = a
            for j in range(i + 1, len(boxes)):
                if used[j]:
                    continue
                bx0, by0, bx1, by1, br = boxes[j]
                if x0 - gap <= bx1 and bx0 - gap <= x1 and y0 - gap <= by1 and by0 - gap <= y1:
                    x0 = min(x0, bx0)
                    y0 = min(y0, by0)
                    x1 = max(x1, bx1)
                    y1 = max(y1, by1)
                    ar += br
                    used[j] = True
                    changed = True
            out.append([x0, y0, x1, y1, ar])
            used[i] = True
        boxes = out
    return boxes


def extract_sheet(path: Path, out_dir: Path, prefix: str):
    im = Image.open(path)
    boxes = find_components(im)
    boxes.sort(key=lambda b: (b[1] // 50, b[0]))
    out_dir.mkdir(parents=True, exist_ok=True)
    areas = sorted((b[2] - b[0]) * (b[3] - b[1]) for b in boxes)
    if not areas:
        print(f"  no sprites in {path.name}")
        return []
    med = areas[len(areas) // 2]
    kept = []
    for i, (x0, y0, x1, y1, _) in enumerate(boxes):
        if (x1 - x0) * (y1 - y0) < med * 0.15:
            continue
        if (x1 - x0) > im.width * 0.4:
            continue
        crop = im.crop((max(0, x0 - 2), max(0, y0 - 2), min(im.width, x1 + 2), min(im.height, y1 + 2)))
        name = f"{prefix}_{i:03d}.png"
        dest = out_dir / name
        normalize_sprite(crop).save(dest)
        kept.append(dest)
    print(f"  {path.name}: {len(kept)} sprites → {out_dir}")
    return kept


# Curated mapping: sheet stem → list of (index, postureId, yaw)
# Indices are reading-order after extraction; re-run extract then adjust if sheets change.
PILOT_MAP = {
    "man": {
        "sheet": "man.png",
        "assigns": [
            (7, "idle", 0),
            (1, "idle", 90),
            (9, "idle", 180),
            (4, "run", 90),
            (20, "kick", 90),
        ],
    },
    "woman": {
        "sheet": "woman.png",
        "assigns": [
            (7, "idle", 0),
            (1, "idle", 90),
            (9, "idle", 180),
            (4, "run", 90),
            (20, "kick", 90),
        ],
    },
    "child": {
        "sheet": "boy.png",
        "assigns": [
            (7, "idle", 0),
            (1, "idle", 90),
            (9, "idle", 180),
            (4, "run", 90),
            (20, "kick", 90),
        ],
    },
}

SHOOT_MAP = {
    "man": [("shoot-man-face.png", "kick", 0), ("shoot-man.png", "kick", 90), ("shoot-man-dos.png", "kick", 180)],
    "woman": [("shoot-woman-face.png", "kick", 0), ("shoot-woman.png", "kick", 90), ("shoot-woman-dos.png", "kick", 180)],
    "child": [("shoot-boy-face.png", "kick", 0), ("shoot-boy.png", "kick", 90), ("shoot-boy-dos.png", "kick", 180)],
}


def list_sprite_boxes(im: Image.Image):
    """Connected components without merge (merge joins whole rows)."""
    boxes = find_components(im, min_area=60, step=2)
    # Skip merge — sheets are dense; merging collapses sprites
    boxes.sort(key=lambda b: (b[1] // 50, b[0]))
    areas = sorted((b[2] - b[0]) * (b[3] - b[1]) for b in boxes)
    if not areas:
        return []
    med = areas[len(areas) // 2]
    kept = []
    for x0, y0, x1, y1, _ in boxes:
        area = (x1 - x0) * (y1 - y0)
        if area < med * 0.12:
            continue
        if (x1 - x0) > im.width * 0.35:
            continue
        if (y1 - y0) < 28:
            continue
        kept.append((x0, y0, x1, y1))
    return kept


def pick_sprite_from_sheet(sheet: Path, index: int) -> Image.Image | None:
    im = Image.open(sheet)
    kept = list_sprite_boxes(im)
    if not kept:
        return None
    index = max(0, min(index, len(kept) - 1))
    x0, y0, x1, y1 = kept[index]
    return im.crop((max(0, x0 - 2), max(0, y0 - 2), min(im.width, x1 + 2), min(im.height, y1 + 2)))


def pick_first_tall(sheet: Path) -> Image.Image | None:
    """Prefer a tall sprite from the first row (face/back boards)."""
    im = Image.open(sheet)
    kept = list_sprite_boxes(im)
    if not kept:
        return None
    # Prefer among first ~15 (top rows)
    candidates = kept[:15] if len(kept) >= 15 else kept
    best = max(candidates, key=lambda b: b[3] - b[1])
    x0, y0, x1, y1 = best
    return im.crop((max(0, x0 - 2), max(0, y0 - 2), min(im.width, x1 + 2), min(im.height, y1 + 2)))

def build_pilot_bank():
    posture_yaws: dict[str, dict[str, list[int]]] = {}

    for morph, cfg in PILOT_MAP.items():
        out = POSES / morph
        out.mkdir(parents=True, exist_ok=True)
        sheet = GEMINI / cfg["sheet"]
        if not sheet.exists():
            print(f"missing {sheet}")
            continue
        for idx, pid, yaw in cfg["assigns"]:
            crop = pick_sprite_from_sheet(sheet, idx)
            if crop is None:
                print(f"  skip {morph} {pid}_{yaw} (idx {idx})")
                continue
            dest = out / f"{pid}_{yaw}.png"
            normalize_sprite(crop).save(dest)
            posture_yaws.setdefault(pid, {}).setdefault(morph, [])
            if yaw not in posture_yaws[pid][morph]:
                posture_yaws[pid][morph].append(yaw)
            print(f"  wrote {dest.relative_to(ROOT)}")

    for morph, entries in SHOOT_MAP.items():
        out = POSES / morph
        out.mkdir(parents=True, exist_ok=True)
        for sheet_name, pid, yaw in entries:
            sheet = GEMINI / sheet_name
            if not sheet.exists():
                continue
            crop = pick_first_tall(sheet)
            if crop is None:
                continue
            dest = out / f"{pid}_{yaw}.png"
            normalize_sprite(crop).save(dest)
            posture_yaws.setdefault(pid, {}).setdefault(morph, [])
            if yaw not in posture_yaws[pid][morph]:
                posture_yaws[pid][morph].append(yaw)
            print(f"  wrote {dest.relative_to(ROOT)} from {sheet_name}")

    # Also copy 30/60 as nearest from 0/90 if missing (duplicate for resolver coverage demo)
    for morph in ("man", "woman", "child"):
        out = POSES / morph
        for pid in ("idle", "kick", "run"):
            for src_yaw, dst_yaw in ((0, 30), (90, 60)):
                src = out / f"{pid}_{src_yaw}.png"
                dst = out / f"{pid}_{dst_yaw}.png"
                if src.exists() and not dst.exists():
                    Image.open(src).save(dst)
                    posture_yaws.setdefault(pid, {}).setdefault(morph, [])
                    if dst_yaw not in posture_yaws[pid][morph]:
                        posture_yaws[pid][morph].append(dst_yaw)

    # Rebuild yaws from files on disk (authoritative)
    posture_yaws = {}
    for morph in ("man", "woman", "child"):
        d = POSES / morph
        if not d.exists():
            continue
        for p in d.glob("*.png"):
            stem = p.stem
            if "_" not in stem:
                continue
            pid, yaw_s = stem.rsplit("_", 1)
            try:
                yaw = int(yaw_s)
            except ValueError:
                continue
            posture_yaws.setdefault(pid, {}).setdefault(morph, [])
            if yaw not in posture_yaws[pid][morph]:
                posture_yaws[pid][morph].append(yaw)

    labels = {"idle": "Debout", "run": "Course", "kick": "Frappe"}
    tags = {"idle": ["base"], "run": ["move"], "kick": ["shoot", "outfield"]}
    postures = []
    for pid, by_morph in sorted(posture_yaws.items()):
        for m in by_morph:
            by_morph[m] = sorted(by_morph[m])
        postures.append(
            {
                "id": pid,
                "label": labels.get(pid, pid),
                "tags": tags.get(pid, []),
                "yaws": by_morph,
            }
        )

    manifest = {
        "standingHeightPx": STANDING_H,
        "canvas": {"w": CANVAS_W, "h": CANVAS_H},
        "anchor": {"x": 0.5, "y": 1.0},
        "yaws": [0, 30, 60, 90, 120, 150, 180],
        "postures": postures,
    }
    (POSES / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"wrote {POSES / 'manifest.json'}")


def build_equipment():
    EQUIP.mkdir(parents=True, exist_ok=True)
    # Prefer low-man sheet for equipment (has ladder/cones/hurdles at bottom-right)
    sheet = GEMINI / "low-man.png"
    if not sheet.exists():
        sheet = GEMINI / "low.png"
    items_meta = []
    if sheet.exists():
        im = Image.open(sheet)
        boxes = find_components(im, min_area=40)
        boxes.sort(key=lambda b: (b[1] // 40, b[0]))
        # Heuristic: take small orange-ish / yellow objects from bottom of sheet
        h = im.height
        bottom = [b for b in boxes if b[1] > h * 0.55]
        # Sort by size ascending — equipment often smaller than players
        bottom.sort(key=lambda b: (b[2] - b[0]) * (b[3] - b[1]))

        def save_equip(name: str, box, yaws: list[int]):
            x0, y0, x1, y1, _ = box
            crop = im.crop((x0, y0, x1, y1))
            norm = normalize_sprite(crop, standing_h=64)
            for yaw in yaws:
                dest = EQUIP / f"{name}_{yaw}.png"
                norm.save(dest)
                print(f"  wrote {dest.relative_to(ROOT)}")

        # Generate simple procedural equipment if extraction is unreliable
        make_procedural_equipment()
    else:
        make_procedural_equipment()

    equip_manifest = {
        "yaws": [0, 30, 60, 90, 120, 150, 180],
        "items": [
            {
                "id": "ladder",
                "label": "Échelle d'agilité",
                "oriented": True,
                "yaws": [0, 30, 60, 90, 180],
                "anchor": {"x": 0.5, "y": 0.5},
            },
            {
                "id": "hurdle",
                "label": "Haie",
                "oriented": True,
                "yaws": [0, 90, 180],
                "anchor": {"x": 0.5, "y": 1.0},
            },
            {
                "id": "cone",
                "label": "Plot",
                "oriented": False,
                "yaws": [0],
                "anchor": {"x": 0.5, "y": 1.0},
            },
            {
                "id": "ball",
                "label": "Ballon",
                "oriented": False,
                "yaws": [0],
                "recolor": "ball",
                "anchor": {"x": 0.5, "y": 1.0},
            },
        ],
    }
    (EQUIP / "manifest.json").write_text(json.dumps(equip_manifest, indent=2), encoding="utf-8")
    print(f"wrote {EQUIP / 'manifest.json'}")


def make_procedural_equipment():
    """Flat-style equipment PNGs matching the board palette."""
    from PIL import ImageDraw

    def canvas():
        return Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))

    # Cone
    im = canvas()
    d = ImageDraw.Draw(im)
    d.polygon([(80, 40), (55, 140), (105, 140)], fill=(230, 68, 46, 255), outline=(0, 0, 0, 255))
    d.rectangle([58, 100, 102, 108], fill=(255, 255, 255, 200))
    for yaw in (0,):
        im.save(EQUIP / f"cone_{yaw}.png")

    # Ball
    im = canvas()
    d = ImageDraw.Draw(im)
    d.ellipse([55, 90, 105, 140], fill=(248, 120, 0, 255), outline=(0, 0, 0, 255), width=2)
    d.arc([60, 95, 100, 135], 20, 160, fill=(0, 0, 0, 255), width=2)
    im.save(EQUIP / "ball_0.png")

    # Hurdle — side and front-ish
    for yaw, pts in (
        (0, [(50, 130), (50, 90), (110, 90), (110, 130)]),
        (90, [(40, 120), (40, 85), (120, 85), (120, 120)]),
        (180, [(50, 130), (50, 90), (110, 90), (110, 130)]),
    ):
        im = canvas()
        d = ImageDraw.Draw(im)
        d.line([pts[0], pts[1], pts[2], pts[3]], fill=(230, 100, 40, 255), width=6)
        d.line([pts[1], pts[2]], fill=(230, 100, 40, 255), width=6)
        im.save(EQUIP / f"hurdle_{yaw}.png")

    # Ladder — horizontal rungs, different lengths by yaw
    for yaw in (0, 30, 60, 90, 180):
        im = canvas()
        d = ImageDraw.Draw(im)
        if yaw in (0, 180):
            # foreshortened
            d.rectangle([60, 50, 100, 140], outline=(245, 208, 0, 255), width=3)
            for i in range(1, 6):
                y = 50 + i * 15
                d.line([(60, y), (100, y)], fill=(245, 208, 0, 255), width=2)
        else:
            d.rectangle([30, 70, 130, 110], outline=(245, 208, 0, 255), width=3)
            for i in range(1, 8):
                x = 30 + i * 12
                d.line([(x, 70), (x, 110)], fill=(245, 208, 0, 255), width=2)
        im.save(EQUIP / f"ladder_{yaw}.png")

    print("  procedural equipment written")


def normalize_existing():
    """Re-normalize every pose/equipment png already in the bank."""
    for folder in (POSES / "man", POSES / "woman", POSES / "child", EQUIP):
        if not folder.exists():
            continue
        for p in folder.glob("*.png"):
            im = Image.open(p)
            h = STANDING_H if folder != EQUIP else 64
            if folder == EQUIP:
                # keep equipment as-is size but ensure alpha
                out = white_to_alpha(trim_to_content(im))
                # pad to canvas bottom-centered
                canvas = Image.new("RGBA", (CANVAS_W, CANVAS_H), (0, 0, 0, 0))
                bw, bh = out.size
                scale = min((CANVAS_W * 0.85) / max(bw, 1), (CANVAS_H * 0.75) / max(bh, 1))
                nw, nh = max(1, int(bw * scale)), max(1, int(bh * scale))
                scaled = out.resize((nw, nh), Image.Resampling.LANCZOS)
                canvas.paste(scaled, ((CANVAS_W - nw) // 2, CANVAS_H - nh), scaled)
                canvas.save(p)
            else:
                normalize_sprite(im).save(p)
            print(f"  normalized {p.relative_to(ROOT)}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--extract-sheets", action="store_true", help="Dump all components to _raw/")
    ap.add_argument("--normalize-only", action="store_true")
    args = ap.parse_args()

    PLAYERS.mkdir(parents=True, exist_ok=True)

    if args.extract_sheets:
        raw = PLAYERS / "_raw"
        for morph, sheet in (("man", "man.png"), ("woman", "woman.png"), ("child", "boy.png")):
            p = GEMINI / sheet
            if p.exists():
                extract_sheet(p, raw / morph, morph)
        return

    if args.normalize_only:
        normalize_existing()
        return

    print("Building pilot pose bank…")
    build_pilot_bank()
    print("Building equipment…")
    build_equipment()
    print("Done.")


if __name__ == "__main__":
    main()
