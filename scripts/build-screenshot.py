"""
Generates production-grade store and README showcase screenshots (1280x800)
using authentic headless browser rendering of popup.html.
"""
import os
import subprocess
from PIL import Image, ImageDraw, ImageFilter, ImageFont


def render_popup_screenshot(root_dir):
    edge = r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
    popup_html = os.path.join(root_dir, "popup", "popup.html")
    temp_html = os.path.join(root_dir, "popup", "temp-showcase.html")
    raw_ss = os.path.join(root_dir, "assets", "raw-popup.png")

    with open(popup_html, "r", encoding="utf-8") as f:
        html = f.read()

    # Populate realistic stats for product showcase
    html = html.replace('id="stat-intros">0<', 'id="stat-intros">110<')
    html = html.replace('id="stat-recaps">0<', 'id="stat-recaps">14<')
    html = html.replace('id="stat-credits">0<', 'id="stat-credits">84<')
    html = html.replace('id="stat-total">0<', 'id="stat-total">208<')

    # Remove script tags that require extension runtime
    html = html.replace('<script src="../shared/constants.js"></script>', "")
    html = html.replace('<script src="../shared/storage.js"></script>', "")
    html = html.replace('<script src="popup.js"></script>', "")

    with open(temp_html, "w", encoding="utf-8") as f:
        f.write(html)

    try:
        cmd = [
            edge,
            "--headless=new",
            f"--screenshot={raw_ss}",
            "--window-size=380,685",
            "--default-background-color=00000000",
            "--hide-scrollbars",
            f"file:///{temp_html.replace(os.sep, '/')}",
        ]
        subprocess.run(cmd, check=True)
    finally:
        if os.path.exists(temp_html):
            os.remove(temp_html)

    return raw_ss


def build_showcase(root_dir, raw_popup_path):
    popup = Image.open(raw_popup_path).convert("RGBA")

    w, h = 1280, 800
    canvas = Image.new("RGBA", (w, h), (14, 14, 16, 255))

    # Glow effects
    glow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(glow)
    g_draw.ellipse([680, 40, 1320, 760], fill=(229, 9, 20, 60))
    g_draw.ellipse([-50, 200, 450, 700], fill=(20, 30, 60, 40))
    glow = glow.filter(ImageFilter.GaussianBlur(130))
    canvas.alpha_composite(glow)

    # Top accent line
    line_draw = ImageDraw.Draw(canvas)
    line_draw.line([(0, 0), (w, 0)], fill=(229, 9, 20, 220), width=3)

    def get_font(size, bold=False):
        candidates = [
            "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
            "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        ]
        for c in candidates:
            if os.path.exists(c):
                return ImageFont.truetype(c, size)
        return ImageFont.load_default()

    font_tag = get_font(13, bold=True)
    font_title = get_font(42, bold=True)
    font_sub = get_font(18, bold=False)
    font_num = get_font(14, bold=True)
    font_card_title = get_font(18, bold=True)
    font_card_desc = get_font(14, bold=False)
    font_footer = get_font(14, bold=True)

    draw = ImageDraw.Draw(canvas)

    lx = 75
    # Badge
    badge_box = [lx, 70, lx + 210, 102]
    draw.rounded_rectangle(badge_box, radius=6, fill=(229, 9, 20, 35), outline=(229, 9, 20, 220), width=1)
    draw.text((lx + 16, 77), "MANIFEST V3 READY", fill=(255, 80, 90), font=font_tag)

    # Title
    draw.text((lx, 120), "Intuitive Control Panel", fill=(255, 255, 255), font=font_title)
    draw.text((lx, 180), "Seamless, distraction-free Netflix streaming.", fill=(160, 160, 168), font=font_sub)

    features = [
        ("01", "Skip Intro & Recap", "Instant one-click bypass as soon as controls appear."),
        ("02", "Next Episode Autoplay", "Transitions smoothly during post-play countdowns."),
        ("03", "Dismiss Still Watching", "Auto-confirms pause prompts during binge sessions."),
        ("04", "Local Skip Analytics", "Track saved playback time directly on your device."),
    ]

    cy = 236
    for num, title, desc in features:
        card_box = [lx, cy, lx + 510, cy + 76]
        draw.rounded_rectangle(card_box, radius=10, fill=(22, 22, 26, 210), outline=(48, 48, 56, 255), width=1)

        num_box = [lx + 16, cy + 16, lx + 44, cy + 44]
        draw.rounded_rectangle(num_box, radius=6, fill=(229, 9, 20, 40), outline=(229, 9, 20, 180), width=1)
        draw.text((lx + 22, cy + 21), num, fill=(255, 100, 110), font=font_num)

        draw.text((lx + 58, cy + 15), title, fill=(250, 250, 252), font=font_card_title)
        draw.text((lx + 58, cy + 43), desc, fill=(155, 155, 165), font=font_card_desc)
        cy += 94

    foot_box = [lx, 628, lx + 510, 672]
    draw.rounded_rectangle(foot_box, radius=8, fill=(16, 32, 24, 230), outline=(52, 168, 83, 180), width=1)
    draw.text((lx + 22, 641), "100% Client-Side  |  No Telemetry  |  Open-Source", fill=(129, 199, 132), font=font_footer)

    # Scale popup
    popup_h = 716
    popup_w = int(popup.width * (popup_h / popup.height))
    scaled_popup = popup.resize((popup_w, popup_h), Image.Resampling.LANCZOS)

    mask = Image.new("L", (popup_w, popup_h), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle([0, 0, popup_w, popup_h], radius=24, fill=255)

    px = 780
    py = (h - popup_h) // 2

    # Drop shadow
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    s_draw = ImageDraw.Draw(shadow)
    s_draw.rounded_rectangle([px - 16, py + 16, px + popup_w + 16, py + popup_h + 24], radius=32, fill=(0, 0, 0, 240))
    shadow = shadow.filter(ImageFilter.GaussianBlur(36))
    canvas.alpha_composite(shadow)

    # Paste genuine popup
    canvas.paste(scaled_popup, (px, py), mask)

    # Refined outline
    outline = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    o_draw = ImageDraw.Draw(outline)
    o_draw.rounded_rectangle([px, py, px + popup_w, py + popup_h], radius=24, outline=(255, 255, 255, 30), width=1)
    canvas.alpha_composite(outline)

    # Save to assets/screenshot.png atomically
    out_assets = os.path.join(root_dir, "assets", "screenshot.png")
    tmp_assets = os.path.join(root_dir, "assets", "screenshot.tmp.png")
    canvas.convert("RGB").save(tmp_assets, "PNG", optimize=True)
    os.replace(tmp_assets, out_assets)
    print(f"Saved: {out_assets}")

    # Save copy to Desktop atomically
    desktop = os.path.expanduser("~/Desktop")
    out_desktop = os.path.join(desktop, "SS 1 - 1280x800.png")
    tmp_desktop = os.path.join(desktop, "SS 1 - 1280x800.tmp.png")
    canvas.convert("RGB").save(tmp_desktop, "PNG", optimize=True)
    os.replace(tmp_desktop, out_desktop)
    print(f"Saved: {out_desktop}")

    # Clean up raw popup
    if os.path.exists(raw_popup_path):
        os.remove(raw_popup_path)


def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    raw_popup = render_popup_screenshot(root_dir)
    build_showcase(root_dir, raw_popup)


if __name__ == "__main__":
    main()
