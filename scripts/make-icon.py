#!/usr/bin/env python3
"""Генератор иконки Toolbox: транспортир (угломер) + горизонтальная ампула (уровень).

Одна геометрия (холст 108x108, как у адаптивной иконки Android) даёт:
  public/icon.svg                                     — favicon и исходник
  native-res/res/drawable/ic_toolbox_*.xml            — векторные слои адаптивной иконки
  native-res/res/mipmap-anydpi-v26/ic_launcher*.xml   — адаптивная иконка (+ monochrome для Android 13)
  native-res/res/mipmap-*dpi/ic_launcher*.png         — запасные PNG для старых версий
  assets/icon-preview.png                             — превью 512x512

Запуск: python3 scripts/make-icon.py   (нужен Pillow, только для PNG)
Результат закоммичен, перегенерировать нужно лишь при смене дизайна.
Всё содержимое укладывается в безопасную зону адаптивной иконки (круг диаметром 72 из 108).
"""
import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

BG = "#101216"
DISC = "#171a1f"
INNER = "#1b1f25"
AMBER = "#ffb000"
GRAY = "#8b9097"
WHITE = "#f2f2f2"

# --- геометрия (единицы холста 108x108) ---
CX, CY = 54.0, 58.0  # центр транспортира
ARC_R, ARC_W = 30.0, 4.0
BASE = (22.0, 86.0, 2.5)  # базовая линия: x1, x2, толщина (y = CY)
NEEDLE_DEG, NEEDLE_LEN = 50.0, 25.0
HUB_R = 3.2
VIAL = (32.0, 68.0, 44.0, 12.0)  # x, y, w, h
VIAL_STROKE = 1.5
BUB = (54.0, 74.0, 6.5, 4.0)  # cx, cy, rx, ry
HILITE = (52.4, 72.7, 2.2, 1.2)

# деления транспортира: каждые 15° (кроме краёв), на 45/90/135 — длиннее и белые
TICKS = []
for deg in range(15, 180, 15):
    a = math.radians(deg)
    major = deg % 45 == 0
    r1, r2 = (17.5, 24.5) if major else (21.0, 24.5)
    TICKS.append(
        (
            CX + r1 * math.cos(a),
            CY - r1 * math.sin(a),
            CX + r2 * math.cos(a),
            CY - r2 * math.sin(a),
            WHITE if major else GRAY,
            2.0 if major else 1.5,
        )
    )

_na = math.radians(NEEDLE_DEG)
NEEDLE_END = (CX + NEEDLE_LEN * math.cos(_na), CY - NEEDLE_LEN * math.sin(_na))
WEDGE_END = (CX + NEEDLE_LEN * math.cos(_na), CY - NEEDLE_LEN * math.sin(_na))
VMARKS = [BUB[0] - BUB[2], BUB[0] + BUB[2]]


def n(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


def write(path, text):
    full = os.path.join(ROOT, path)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        f.write(text)


# ---------------------------------------------------------------- пути
def circle_path(cx, cy, r):
    return f"M{n(cx - r)},{n(cy)} a{n(r)},{n(r)} 0 1,0 {n(2 * r)},0 a{n(r)},{n(r)} 0 1,0 {n(-2 * r)},0"


def ellipse_path(cx, cy, rx, ry):
    return f"M{n(cx - rx)},{n(cy)} a{n(rx)},{n(ry)} 0 1,0 {n(2 * rx)},0 a{n(rx)},{n(ry)} 0 1,0 {n(-2 * rx)},0"


def arc_path():
    return f"M{n(CX - ARC_R)},{n(CY)} A{n(ARC_R)},{n(ARC_R)} 0 0,1 {n(CX + ARC_R)},{n(CY)}"


def wedge_path():
    return (
        f"M{n(CX)},{n(CY)} L{n(CX + NEEDLE_LEN)},{n(CY)} "
        f"A{n(NEEDLE_LEN)},{n(NEEDLE_LEN)} 0 0,0 {n(WEDGE_END[0])},{n(WEDGE_END[1])} Z"
    )


def vial_path():
    x, y, w, h = VIAL
    r = h / 2
    return (
        f"M{n(x + r)},{n(y)} h{n(w - 2 * r)} a{n(r)},{n(r)} 0 0,1 0,{n(h)} "
        f"h{n(-(w - 2 * r))} a{n(r)},{n(r)} 0 0,1 0,{n(-h)} z"
    )


def line_path(x1, y1, x2, y2):
    return f"M{n(x1)},{n(y1)} L{n(x2)},{n(y2)}"


VMARK_Y = (VIAL[1] + 2.5, VIAL[1] + VIAL[3] - 2.5)


# ---------------------------------------------------------------- SVG
def svg():
    s = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108">']
    s.append(f'<rect width="108" height="108" rx="24" fill="{BG}"/>')
    s.append(f'<circle cx="54" cy="54" r="46" fill="{DISC}"/>')
    s.append(f'<path d="{wedge_path()}" fill="{AMBER}" fill-opacity=".3"/>')
    s.append(
        f'<path d="{arc_path()}" fill="none" stroke="{AMBER}" stroke-width="{n(ARC_W)}" stroke-linecap="round"/>'
    )
    s.append(
        f'<path d="{line_path(BASE[0], CY, BASE[1], CY)}" stroke="{GRAY}" stroke-width="{n(BASE[2])}" stroke-linecap="round"/>'
    )
    for x1, y1, x2, y2, col, w in TICKS:
        s.append(
            f'<path d="{line_path(x1, y1, x2, y2)}" stroke="{col}" stroke-width="{n(w)}" stroke-linecap="round"/>'
        )
    s.append(
        f'<path d="{line_path(CX, CY, *NEEDLE_END)}" stroke="{WHITE}" stroke-width="2.5" stroke-linecap="round"/>'
    )
    s.append(f'<circle cx="{n(CX)}" cy="{n(CY)}" r="{n(HUB_R)}" fill="{AMBER}"/>')
    s.append(f'<path d="{vial_path()}" fill="{INNER}" stroke="{GRAY}" stroke-width="{n(VIAL_STROKE)}"/>')
    for mx in VMARKS:
        s.append(f'<path d="{line_path(mx, VMARK_Y[0], mx, VMARK_Y[1])}" stroke="{GRAY}" stroke-width="1"/>')
    s.append(f'<path d="{ellipse_path(*BUB)}" fill="{AMBER}"/>')
    s.append(f'<path d="{ellipse_path(*HILITE)}" fill="#fff" fill-opacity=".5"/>')
    s.append("</svg>")
    return "\n".join(s) + "\n"


# ---------------------------------------------------------------- Android vector
def vec_header():
    return (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<vector xmlns:android="http://schemas.android.com/apk/res/android"\n'
        '    android:width="108dp"\n    android:height="108dp"\n'
        '    android:viewportWidth="108"\n    android:viewportHeight="108">\n'
    )


def stroke(path, color, width, alpha=None, cap=True):
    a = f' android:strokeAlpha="{alpha}"' if alpha else ""
    c = ' android:strokeLineCap="round"' if cap else ""
    return f'  <path android:strokeColor="{color}" android:strokeWidth="{n(width)}"{a}{c}\n      android:pathData="{path}"/>\n'


def fill(path, color, alpha=None):
    a = f' android:fillAlpha="{alpha}"' if alpha else ""
    return f'  <path android:fillColor="{color}"{a}\n      android:pathData="{path}"/>\n'


def vec_background():
    return (
        vec_header()
        + fill("M0,0h108v108h-108z", BG)
        + fill(circle_path(54, 54, 46), DISC)
        + "</vector>\n"
    )


def vec_foreground():
    p = [vec_header()]
    p.append(fill(wedge_path(), AMBER, "0.3"))
    p.append(stroke(arc_path(), AMBER, ARC_W))
    p.append(stroke(line_path(BASE[0], CY, BASE[1], CY), GRAY, BASE[2]))
    for x1, y1, x2, y2, col, w in TICKS:
        p.append(stroke(line_path(x1, y1, x2, y2), col, w))
    p.append(stroke(line_path(CX, CY, *NEEDLE_END), WHITE, 2.5))
    p.append(fill(circle_path(CX, CY, HUB_R), AMBER))
    p.append(
        f'  <path android:fillColor="{INNER}" android:strokeColor="{GRAY}" android:strokeWidth="{n(VIAL_STROKE)}"\n'
        f'      android:pathData="{vial_path()}"/>\n'
    )
    for mx in VMARKS:
        p.append(stroke(line_path(mx, VMARK_Y[0], mx, VMARK_Y[1]), GRAY, 1, cap=False))
    p.append(fill(ellipse_path(*BUB), AMBER))
    p.append(fill(ellipse_path(*HILITE), "#FFFFFF", "0.5"))
    p.append("</vector>\n")
    return "".join(p)


def vec_monochrome():
    p = [vec_header()]
    p.append(stroke(arc_path(), "#000000", ARC_W))
    p.append(stroke(line_path(BASE[0], CY, BASE[1], CY), "#000000", BASE[2]))
    for x1, y1, x2, y2, _c, w in TICKS:
        p.append(stroke(line_path(x1, y1, x2, y2), "#000000", w))
    p.append(stroke(line_path(CX, CY, *NEEDLE_END), "#000000", 2.5))
    p.append(
        f'  <path android:strokeColor="#000000" android:strokeWidth="{n(VIAL_STROKE + 0.5)}"\n'
        f'      android:pathData="{vial_path()}"/>\n'
    )
    p.append(fill(ellipse_path(*BUB), "#000000"))
    p.append("</vector>\n")
    return "".join(p)


ADAPTIVE = """<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_toolbox_background"/>
    <foreground android:drawable="@drawable/ic_toolbox_foreground"/>
    <monochrome android:drawable="@drawable/ic_toolbox_monochrome"/>
</adaptive-icon>
"""


# ---------------------------------------------------------------- PNG (PIL)
SS = 4  # суперсэмплинг


class Painter:
    """Рисует холст 108x108 и вырезает квадрат со стороной 2*crop_half вокруг центра (54, 54)."""

    def __init__(self, size, crop_half):
        self.px = size * SS
        self.k = self.px / (2 * crop_half)
        self.off = 54.0 - crop_half
        self.img = Image.new("RGBA", (self.px, self.px), BG)

    def _p(self, x, y):
        return ((x - self.off) * self.k, (y - self.off) * self.k)

    def _rgba(self, color, alpha):
        rgb = Image.new("RGB", (1, 1), color).getpixel((0, 0))
        return rgb + (int(255 * alpha),)

    def _commit(self, lay):
        self.img = Image.alpha_composite(self.img, lay)

    def _layer(self):
        lay = Image.new("RGBA", (self.px, self.px), (0, 0, 0, 0))
        return lay, ImageDraw.Draw(lay)

    def ellipse(self, cx, cy, rx, ry, color, alpha=1.0):
        lay, d = self._layer()
        x0, y0 = self._p(cx - rx, cy - ry)
        x1, y1 = self._p(cx + rx, cy + ry)
        d.ellipse([x0, y0, x1, y1], fill=self._rgba(color, alpha))
        self._commit(lay)

    def line(self, x1, y1, x2, y2, color, w):
        lay, d = self._layer()
        a, b = self._p(x1, y1), self._p(x2, y2)
        wpx = max(1, round(w * self.k))
        col = self._rgba(color, 1.0)
        d.line([a, b], fill=col, width=wpx)
        r = wpx / 2
        for cx, cy in (a, b):
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
        self._commit(lay)

    def pie(self, cx, cy, r, start, end, color, alpha):
        lay, d = self._layer()
        x0, y0 = self._p(cx - r, cy - r)
        x1, y1 = self._p(cx + r, cy + r)
        d.pieslice([x0, y0, x1, y1], start, end, fill=self._rgba(color, alpha))
        self._commit(lay)

    def semi_arc(self, cx, cy, r, w, color):
        lay, d = self._layer()
        ro = r + w / 2
        x0, y0 = self._p(cx - ro, cy - ro)
        x1, y1 = self._p(cx + ro, cy + ro)
        wpx = max(1, round(w * self.k))
        col = self._rgba(color, 1.0)
        d.arc([x0, y0, x1, y1], 180, 360, fill=col, width=wpx)
        cap = wpx / 2
        for ex in (cx - r, cx + r):  # скруглённые концы
            px, py = self._p(ex, cy)
            d.ellipse([px - cap, py - cap, px + cap, py + cap], fill=col)
        self._commit(lay)

    def vial(self, x, y, w, h, fill_color, outline, ow):
        lay, d = self._layer()
        x0, y0 = self._p(x, y)
        x1, y1 = self._p(x + w, y + h)
        d.rounded_rectangle(
            [x0, y0, x1, y1],
            radius=(y1 - y0) / 2,
            fill=self._rgba(fill_color, 1.0),
            outline=self._rgba(outline, 1.0),
            width=max(1, round(ow * self.k)),
        )
        self._commit(lay)

    def result(self, size):
        return self.img.resize((size, size), Image.LANCZOS)


def render(size, crop_half=54.0):
    pt = Painter(size, crop_half)
    pt.ellipse(54, 54, 46, 46, DISC)
    pt.pie(CX, CY, NEEDLE_LEN, 360 - NEEDLE_DEG, 360, AMBER, 0.3)
    pt.semi_arc(CX, CY, ARC_R, ARC_W, AMBER)
    pt.line(BASE[0], CY, BASE[1], CY, GRAY, BASE[2])
    for x1, y1, x2, y2, col, w in TICKS:
        pt.line(x1, y1, x2, y2, col, w)
    pt.line(CX, CY, NEEDLE_END[0], NEEDLE_END[1], WHITE, 2.5)
    pt.ellipse(CX, CY, HUB_R, HUB_R, AMBER)
    pt.vial(*VIAL, INNER, GRAY, VIAL_STROKE)
    for mx in VMARKS:
        pt.line(mx, VMARK_Y[0], mx, VMARK_Y[1], GRAY, 1)
    pt.ellipse(BUB[0], BUB[1], BUB[2], BUB[3], AMBER)
    pt.ellipse(HILITE[0], HILITE[1], HILITE[2], HILITE[3], "#ffffff", 0.5)
    return pt.result(size)


def masked(img, shape):
    size = img.size[0]
    mask = Image.new("L", (size * SS, size * SS), 0)
    d = ImageDraw.Draw(mask)
    if shape == "round":
        d.ellipse([0, 0, size * SS - 1, size * SS - 1], fill=255)
    else:
        d.rounded_rectangle([0, 0, size * SS - 1, size * SS - 1], radius=int(size * SS * 0.22), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def main():
    write("public/icon.svg", svg())
    write("native-res/res/drawable/ic_toolbox_background.xml", vec_background())
    write("native-res/res/drawable/ic_toolbox_foreground.xml", vec_foreground())
    write("native-res/res/drawable/ic_toolbox_monochrome.xml", vec_monochrome())
    write("native-res/res/mipmap-anydpi-v26/ic_launcher.xml", ADAPTIVE)
    write("native-res/res/mipmap-anydpi-v26/ic_launcher_round.xml", ADAPTIVE)

    sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for dens, px in sizes.items():
        base = render(px, crop_half=40.0)
        folder = os.path.join(ROOT, f"native-res/res/mipmap-{dens}")
        os.makedirs(folder, exist_ok=True)
        masked(base, "square").save(os.path.join(folder, "ic_launcher.png"))
        masked(base, "round").save(os.path.join(folder, "ic_launcher_round.png"))

    os.makedirs(os.path.join(ROOT, "assets"), exist_ok=True)
    masked(render(512, crop_half=54.0), "square").save(os.path.join(ROOT, "assets/icon-preview.png"))
    print("Иконка сгенерирована")


if __name__ == "__main__":
    main()
