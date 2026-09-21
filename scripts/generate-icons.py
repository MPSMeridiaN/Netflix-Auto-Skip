"""
Premium Cinematic Icon Generator for Netflix Auto Skip Extension.
Renders ultra-luxury, high-definition icons with 2x supersampling,
rich continuous gradients, ambient lighting, and precision geometry.
"""
import os
from PIL import Image, ImageDraw, ImageFilter


def create_premium_icon(size=1024):
    ss = size * 2
    img = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))

    margin = ss * 0.045
    radius = ss * 0.22
    box = [margin, margin, ss - margin, ss - margin]

    # 1. Dark obsidian base squircle
    base = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    b_draw = ImageDraw.Draw(base)
    b_draw.rounded_rectangle(box, radius=radius, fill=(15, 15, 18, 255))

    # Radial ambient glow (Netflix Crimson backlight)
    ambient = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    a_draw = ImageDraw.Draw(ambient)
    a_draw.ellipse([ss * 0.16, ss * 0.16, ss * 0.84, ss * 0.84], fill=(229, 9, 20, 125))
    ambient = ambient.filter(ImageFilter.GaussianBlur(ss * 0.13))
    base.alpha_composite(ambient)

    # Sleek crimson outer rim
    b_draw.rounded_rectangle(box, radius=radius, outline=(229, 9, 20, 210), width=int(ss * 0.018))
    # Delicate inner specular highlight
    inner_box = [margin + ss * 0.014, margin + ss * 0.014, ss - margin - ss * 0.014, ss - margin - ss * 0.014]
    b_draw.rounded_rectangle(inner_box, radius=radius * 0.94, outline=(255, 255, 255, 22), width=int(ss * 0.006))

    # 2. Skip glyph geometry (Symmetrical & Balanced)
    top = ss * 0.27
    bottom = ss * 0.73
    mid_y = ss * 0.50
    h_glyph = bottom - top

    w_tri = ss * 0.225
    gap = ss * 0.045
    w_bar = ss * 0.055

    total_w = w_tri * 2 + gap * 2 + w_bar
    start_x = (ss - total_w) / 2

    t1_x = start_x
    t2_x = start_x + w_tri + gap
    bar_x = start_x + w_tri * 2 + gap * 2

    # Both triangles are 100% mathematically identical
    tri1 = [(t1_x, top), (t1_x + w_tri, mid_y), (t1_x, bottom)]
    tri2 = [(t2_x, top), (t2_x + w_tri, mid_y), (t2_x, bottom)]
    bar = [bar_x, top, bar_x + w_bar, bottom]

    # 3. Soft drop shadow behind glyph
    shadow = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_off = ss * 0.02
    s_tri1 = [(x, y + s_off) for x, y in tri1]
    s_tri2 = [(x, y + s_off) for x, y in tri2]
    s_bar = [bar_x, top + s_off, bar_x + w_bar, bottom + s_off]
    s_draw.polygon(s_tri1, fill=(0, 0, 0, 220))
    s_draw.polygon(s_tri2, fill=(0, 0, 0, 220))
    s_draw.rounded_rectangle(s_bar, radius=int(w_bar / 2), fill=(0, 0, 0, 220))
    shadow = shadow.filter(ImageFilter.GaussianBlur(ss * 0.026))

    # 4. Glyph layer with smooth continuous vertical gradient
    glyph_mask = Image.new("L", (ss, ss), 0)
    gm_draw = ImageDraw.Draw(glyph_mask)
    gm_draw.polygon(tri1, fill=255)
    gm_draw.polygon(tri2, fill=255)
    gm_draw.rounded_rectangle(bar, radius=int(w_bar / 2), fill=255)

    grad = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grad)
    c_top = (255, 56, 68)   # Luminous ruby red
    c_bot = (205, 8, 16)    # Deep Netflix crimson
    for y in range(int(top), int(bottom) + 1):
        ratio = (y - top) / h_glyph
        r = int(c_top[0] * (1 - ratio) + c_bot[0] * ratio)
        g = int(c_top[1] * (1 - ratio) + c_bot[1] * ratio)
        b = int(c_top[2] * (1 - ratio) + c_bot[2] * ratio)
        g_draw.line([(0, y), (ss, y)], fill=(r, g, b, 255))

    glyph_layer = Image.new("RGBA", (ss, ss), (0, 0, 0, 0))
    glyph_layer.paste(grad, (0, 0), glyph_mask)

    # 5. Composite layers
    img.alpha_composite(base)
    img.alpha_composite(shadow)
    img.alpha_composite(glyph_layer)

    return img.resize((size, size), Image.Resampling.LANCZOS)


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    icons_dir = os.path.join(root_dir, "icons")
    assets_dir = os.path.join(root_dir, "assets")
    os.makedirs(icons_dir, exist_ok=True)
    os.makedirs(assets_dir, exist_ok=True)

    master = create_premium_icon(1024)

    # Extension icons
    sizes = [16, 32, 48, 128]
    for s in sizes:
        resized = master.resize((s, s), Image.Resampling.LANCZOS)
        out_path = os.path.join(icons_dir, f"icon-{s}.png")
        resized.save(out_path, "PNG", optimize=True)
        print(f"Generated extension icon: {out_path} ({s}x{s})")

    # Store logo 300x300
    logo_300 = master.resize((300, 300), Image.Resampling.LANCZOS)
    logo_path = os.path.join(assets_dir, "store-logo-geometric-300x300.png")
    logo_300.save(logo_path, "PNG", optimize=True)
    print(f"Generated store logo: {logo_path} (300x300)")

    # Small Promotional Tile 440x280
    tile_w, tile_h = 440, 280
    tile = Image.new("RGBA", (tile_w, tile_h), (14, 14, 16, 255))
    t_glow = Image.new("RGBA", (tile_w, tile_h), (0, 0, 0, 0))
    tg_draw = ImageDraw.Draw(t_glow)
    tg_draw.ellipse([tile_w // 2 - 180, tile_h // 2 - 180, tile_w // 2 + 180, tile_h // 2 + 180], fill=(229, 9, 20, 60))
    t_glow = t_glow.filter(ImageFilter.GaussianBlur(60))
    tile.alpha_composite(t_glow)

    logo_resized = master.resize((150, 150), Image.Resampling.LANCZOS)
    tile.paste(logo_resized, (tile_w // 2 - 75, (tile_h - 150) // 2), logo_resized)
    promo_path = os.path.join(assets_dir, "promo-tile-440x280.png")
    tile.convert("RGB").save(promo_path, "PNG", optimize=True)
    print(f"Generated promotional tile: {promo_path} (440x280)")


if __name__ == "__main__":
    main()
