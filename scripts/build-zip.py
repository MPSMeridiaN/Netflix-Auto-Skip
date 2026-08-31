"""Build and verify a deterministic Netflix Auto Skip release archive."""
import json
import os
import sys
import zipfile


FILES_TO_INCLUDE = [
    "manifest.json",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "docs/ARCHITECTURE.md",
    "assets/infographic.png",
    "shared/constants.js",
    "shared/storage.js",
    "background/service-worker.js",
    "content/engine.js",
    "content/content.js",
    "content/content.css",
    "popup/popup.html",
    "popup/popup.css",
    "popup/popup.js",
    "icons/icon-16.png",
    "icons/icon-32.png",
    "icons/icon-48.png",
    "icons/icon-128.png",
]

ZIP_TIMESTAMP = (1980, 1, 1, 0, 0, 0)


def read_manifest(root_dir):
    manifest_path = os.path.join(root_dir, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as manifest_file:
        return json.load(manifest_file)


def expected_zip_path(root_dir, manifest):
    version = manifest.get("version")
    if not version:
        raise ValueError("manifest.json is missing a version")
    return os.path.join(root_dir, "dist", f"netflix-auto-skip-v{version}.zip")


def build_zip():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    manifest = read_manifest(root_dir)
    zip_path = expected_zip_path(root_dir, manifest)
    os.makedirs(os.path.dirname(zip_path), exist_ok=True)

    missing = [
        rel_path for rel_path in FILES_TO_INCLUDE
        if not os.path.isfile(os.path.join(root_dir, rel_path))
    ]
    if missing:
        raise FileNotFoundError("Missing release files: " + ", ".join(missing))

    with zipfile.ZipFile(
        zip_path,
        "w",
        compression=zipfile.ZIP_DEFLATED,
        compresslevel=9,
    ) as archive:
        for rel_path in FILES_TO_INCLUDE:
            absolute_path = os.path.join(root_dir, rel_path)
            with open(absolute_path, "rb") as source_file:
                data = source_file.read()

            info = zipfile.ZipInfo(rel_path, ZIP_TIMESTAMP)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.flag_bits = 0x800
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

    print(f"Successfully packaged: {zip_path} (v{manifest['version']})")
    return zip_path


def verify_zip():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    manifest = read_manifest(root_dir)
    zip_path = expected_zip_path(root_dir, manifest)
    if not os.path.isfile(zip_path):
        raise FileNotFoundError(f"Release archive does not exist: {zip_path}")

    expected_names = set(FILES_TO_INCLUDE)
    with zipfile.ZipFile(zip_path, "r") as archive:
        actual_names = set(archive.namelist())
        if actual_names != expected_names:
            missing = sorted(expected_names - actual_names)
            unexpected = sorted(actual_names - expected_names)
            raise ValueError(f"Archive contents differ; missing={missing}, unexpected={unexpected}")

        for info in archive.infolist():
            if info.date_time != ZIP_TIMESTAMP:
                raise ValueError(f"Non-deterministic timestamp in archive: {info.filename}")
            source_path = os.path.join(root_dir, info.filename)
            with open(source_path, "rb") as source_file:
                if archive.read(info.filename) != source_file.read():
                    raise ValueError(f"Archive content differs from source: {info.filename}")

    print(f"Release archive verified: {zip_path}")


if __name__ == "__main__":
    if "--check" in sys.argv:
        verify_zip()
    else:
        build_zip()
