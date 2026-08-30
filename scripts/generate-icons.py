"""
Premium Cinematic Icon Generator for Netflix Auto Skip Extension.
Renders ultra-luxury, high-definition icons (1024x1024 master) with rich gradients,
ambient lighting, precision geometry, and downscales with Lanczos resampling.
"""
import os
import math
from PIL import Image, ImageDraw, ImageFilter

def create_premium_icon(size=1024):
    # Base RGBA canvas
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    
    # 1. High-resolution Squircle Background with Radial Gradient
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    bg_draw = ImageDraw.Draw(bg)
    
    margin = size * 0.04
    radius = size * 0.24
    box = [margin, margin, size - margin, size - margin]
    
    # Draw dark obsidian base
    bg_draw.rounded_rectangle(box, radius=radius, fill=(14, 14, 16, 255))
    
    # Radial sheen layer for luxury glass/metallic feel
    sheen = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sheen_draw = ImageDraw.Draw(sheen)
    sheen_box = [margin + size * 0.02, margin + size * 0.02, size - margin - size * 0.02, size * 0.55]
    sheen_draw.rounded_rectangle(sheen_box, radius=radius * 0.8, fill=(255, 255, 255, 18))
    sheen = sheen.filter(ImageFilter.GaussianBlur(size * 0.04))
    
    # Composite sheen
    bg.alpha_composite(sheen)
    
    # Subtle Outer Glow & Crimson Rim Border
    border_draw = ImageDraw.Draw(bg)
    border_draw.rounded_rectangle(
        box,
        radius=radius,
        outline=(229, 9, 20, 200),
        width=int(size * 0.028)
    )
    
    # Inner subtle highlight ring
    inner_box = [margin + size * 0.025, margin + size * 0.025, size - margin - size * 0.025, size - margin - size * 0.025]
    border_draw.rounded_rectangle(
        inner_box,
        radius=radius * 0.88,
        outline=(255, 255, 255, 25),
        width=int(size * 0.01)
    )
    
    # 2. Modern Futuristic Skip / Fast-Forward Chevrons
    glyph = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    glyph_draw = ImageDraw.Draw(glyph)
    
    # Dimensions for modern chevrons
    top = size * 0.28
    bottom = size * 0.72
    mid_y = size * 0.50
    
    # Chevron 1 (Primary Netflix Crimson Gradient)
    c1_left = size * 0.20
    c1_tip = size * 0.44
    
    # Chevron 2 (Secondary Crimson/White Accent)
    c2_left = size * 0.46
    c2_tip = size * 0.70
    
    # End Bar (Skip Bar)
    bar_x1 = size * 0.73
    bar_x2 = size * 0.80
    
    # Draw soft drop shadow for glyph
    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    
    # First Chevron (Vibrant Netflix Red Gradient)
    triangle_1 = [(c1_left, top), (c1_tip, mid_y), (c1_left, bottom)]
    triangle_2 = [(c2_left, top), (c2_tip, mid_y), (c2_left, bottom)]
    
    shadow_offset = size * 0.02
    shadow_triangle_1 = [(c1_left, top + shadow_offset), (c1_tip, mid_y + shadow_offset), (c1_left, bottom + shadow_offset)]
    shadow_triangle_2 = [(c2_left, top + shadow_offset), (c2_tip, mid_y + shadow_offset), (c2_left, bottom + shadow_offset)]
    shadow_bar = [bar_x1, top + shadow_offset, bar_x2, bottom + shadow_offset]
    
    shadow_draw.polygon(shadow_triangle_1, fill=(0, 0, 0, 180))
    shadow_draw.polygon(shadow_triangle_2, fill=(0, 0, 0, 180))
    shadow_draw.rounded_rectangle(shadow_bar, radius=int((bar_x2 - bar_x1) / 2), fill=(0, 0, 0, 180))
    shadow = shadow.filter(ImageFilter.GaussianBlur(size * 0.025))
    
    # Draw Chevrons on glyph layer
    glyph_draw.polygon(triangle_1, fill=(229, 9, 20, 255))
    glyph_draw.polygon(triangle_2, fill=(255, 30, 39, 255))
    glyph_draw.rounded_rectangle([bar_x1, top, bar_x2, bottom], radius=int((bar_x2 - bar_x1) / 2), fill=(255, 255, 255, 240))
    
    # Subtle inner bevel/highlight on Triangle 1
    t1_highlight = [(c1_left, top), (c1_tip, mid_y), (c1_left + size * 0.05, top)]
    glyph_draw.polygon(t1_highlight, fill=(255, 80, 80, 120))
    
    # Merge layers: Base -> Shadow -> Glyph
    img.alpha_composite(bg)
    img.alpha_composite(shadow)
    img.alpha_composite(glyph)
    
    return img

def main():
    icons_dir = os.path.join(os.path.dirname(__file__), "icons")
    os.makedirs(icons_dir, exist_ok=True)
    
    master = create_premium_icon(1024)
    
    sizes = [16, 32, 48, 128]
    for s in sizes:
        resized = master.resize((s, s), Image.Resampling.LANCZOS)
        out_path = os.path.join(icons_dir, f"icon-{s}.png")
        resized.save(out_path, "PNG", optimize=True)
        print(f"Generated premium icon: {out_path} ({s}x{s})")

if __name__ == "__main__":
    main()
