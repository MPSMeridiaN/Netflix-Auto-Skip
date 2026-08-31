"""
Reproducible extension packager for Netflix Auto Skip.
Reads metadata from manifest.json and packages extension files for distribution.
"""
import json
import os
import zipfile

def build_zip():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    manifest_path = os.path.join(root_dir, "manifest.json")
    
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    
    version = manifest.get("version", "1.0.0")
    dist_dir = os.path.join(root_dir, "dist")
    os.makedirs(dist_dir, exist_ok=True)
    
    zip_filename = f"netflix-auto-skip-v{version}.zip"
    zip_path = os.path.join(dist_dir, zip_filename)
    
    files_to_include = [
        "manifest.json",
        "LICENSE",
        "README.md",
        "CHANGELOG.md",
        "background/service-worker.js",
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
    
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for rel_path in files_to_include:
            abs_path = os.path.join(root_dir, rel_path)
            if os.path.exists(abs_path):
                zipf.write(abs_path, rel_path)
            else:
                print(f"Warning: File missing: {rel_path}")
                
    print(f"Successfully packaged: {zip_path} (v{version})")

if __name__ == "__main__":
    build_zip()
