"""Build a GitHub Pages photo gallery from photos/<album-id>/ files.

Preserves full-resolution originals, produces small JPEG previews, and creates
one ZIP per album. Requires Pillow, runs automatically in GitHub Actions.
"""
from __future__ import annotations

import json
import re
import shutil
import sys
import zipfile
from pathlib import Path
from PIL import Image, ImageOps, UnidentifiedImageError

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config" / "albums.json"
PHOTOS = ROOT / "photos"
DIST = ROOT / "dist"
SITE = ROOT / "site"
IMAGE_TYPES = {".jpg", ".jpeg", ".png", ".webp"}
THUMB_MAX = (1100, 1100)
ZIP_COMPRESSION = zipfile.ZIP_STORED  # JPEG/PNG are already compressed.


def build() -> None:
    conf = json.loads(CONFIG.read_text(encoding="utf-8"))
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    for page in SITE.iterdir():
        if page.is_file():
            shutil.copy2(page, DIST / page.name)
    (DIST / ".nojekyll").touch()

    catalog = {"title": conf["title"], "subtitle": conf.get("subtitle", ""), "albums": []}
    used_ids: set[str] = set()
    for album in conf["albums"]:
        album_id = album["id"]
        if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", album_id) or album_id in used_ids:
            raise ValueError(f"Invalid or duplicate album id: {album_id}")
        used_ids.add(album_id)
        originals_dir = PHOTOS / album_id
        originals_dir.mkdir(parents=True, exist_ok=True)
        files = sorted(
            (path for path in originals_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_TYPES),
            key=lambda path: [int(x) if x.isdigit() else x.casefold() for x in re.split(r"(\d+)", path.name)],
        )

        full_out = DIST / "media" / "originals" / album_id
        thumbs_out = DIST / "media" / "thumbs" / album_id
        zip_out = DIST / "media" / "archives"
        full_out.mkdir(parents=True, exist_ok=True)
        thumbs_out.mkdir(parents=True, exist_ok=True)
        zip_out.mkdir(parents=True, exist_ok=True)
        photos = []

        for file in files:
            try:
                with Image.open(file) as loaded:
                    loaded.verify()
                with Image.open(file) as loaded:
                    with ImageOps.exif_transpose(loaded) as image:
                        width, height = image.size
                        # EXIF rotation is applied to thumbnails; originals are never modified.
                        image.thumbnail(THUMB_MAX, Image.Resampling.LANCZOS)
                        thumb = image.convert("RGB")
                        index = len(photos) + 1
                        thumb_name = f"{index:04d}.jpg"
                        thumb.save(thumbs_out / thumb_name, format="JPEG", quality=85, optimize=True)
            except (UnidentifiedImageError, OSError, ValueError) as error:
                print(f"Skipping unreadable image {file}: {error}", file=sys.stderr)
                continue

            shutil.copy2(file, full_out / file.name)
            # Encode each path segment. JS receives full paths as already percent-escaped URLs.
            from urllib.parse import quote
            original_url = f"media/originals/{album_id}/{quote(file.name, safe='')}"
            thumb_url = f"media/thumbs/{album_id}/{thumb_name}"
            photos.append({
                "id": str(index),
                "name": file.name,
                "full": original_url,
                "thumb": thumb_url,
                "width": width,
                "height": height,
            })

        zip_url = None
        if photos:
            archive_name = f"{album_id}.zip"
            archive = zip_out / archive_name
            with zipfile.ZipFile(archive, "w", ZIP_COMPRESSION, allowZip64=True) as out:
                for photo in photos:
                    out.write(full_out / photo["name"], arcname=photo["name"])
            zip_url = f"media/archives/{archive_name}"

        cover = photos[0]["thumb"] if photos else None
        catalog["albums"].append({
            "id": album_id,
            "title": album["title"],
            "description": album.get("description", ""),
            "theme": album.get("theme", "peach"),
            "count": len(photos),
            "cover": cover,
            "zip": zip_url,
            "photos": photos,
        })
        print(f"{album['title']}: {len(photos)} photo(s)")

    (DIST / "album-data.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    site_size = sum(p.stat().st_size for p in DIST.rglob("*") if p.is_file())
    print(f"Built {DIST} ({site_size / 1024 / 1024:.1f} MiB)")
    if site_size > 900 * 1024 * 1024:
        print("WARNING: GitHub Pages published sites have a 1 GB limit. This build is close to or above it.", file=sys.stderr)


if __name__ == "__main__":
    build()
