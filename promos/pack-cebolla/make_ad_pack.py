from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent.parent

MARRON = (61, 32, 24)
ROSA = (196, 133, 122)
GRIS = (107, 90, 82)
BLANCO = (255, 255, 255)
FUENTES = Path(r"C:\Windows\Fonts")


def fuente(nombre, tam):
    return ImageFont.truetype(str(FUENTES / nombre), tam)


def centrado(d, w, y, texto, fnt, color):
    ancho = d.textlength(texto, font=fnt)
    d.text(((w - ancho) / 2, y), texto, font=fnt, fill=color)


def recortar(ruta, umbral=248):
    im = Image.open(ruta).convert("RGBA")
    fondo = Image.new("RGBA", im.size, (255, 255, 255, 255))
    rgb = Image.alpha_composite(fondo, im).convert("RGB")
    caja = rgb.convert("L").point(lambda p: 255 if p < umbral else 0).getbbox()
    return rgb.crop(caja) if caja else rgb


def pegar(img, prod, cx, base_y, alto_max, ancho_max):
    esc = min(ancho_max / prod.width, alto_max / prod.height)
    p = prod.resize((round(prod.width * esc), round(prod.height * esc)), Image.LANCZOS)
    img.paste(p, (cx - p.width // 2, base_y - p.height))
    return p


def sello(d, cx, cy, r, l1, l2):
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ROSA)
    f1, f2 = fuente("georgiab.ttf", int(r * 0.30)), fuente("georgiab.ttf", int(r * 0.22))
    w1, w2 = d.textlength(l1, font=f1), d.textlength(l2, font=f2)
    d.text((cx - w1 / 2, cy - r * 0.38), l1, font=f1, fill=BLANCO)
    d.text((cx - w2 / 2, cy + r * 0.12), l2, font=f2, fill=BLANCO)


mascarilla = recortar(BASE / "mascarilla-valquer.png")
champu = recortar(BASE / "champu-babaria-cebolla.png")

# Imagen del pack para la ficha (cuadrada)
S = 1000
ficha = Image.new("RGB", (S, S), BLANCO)
df = ImageDraw.Draw(ficha)
pegar(ficha, mascarilla, 330, 800, 420, 560)
pegar(ficha, champu, 745, 860, 640, 300)
sello(df, 160, 160, 120, "SOLO 2 \u20ac", "champ\u00fa 700 ml")
centrado(df, S, 890, "Mascarilla Valquer 300 ml + Champ\u00fa Babaria 700 ml", fuente("georgia.ttf", 34), GRIS)
ficha.save(BASE / "pack_cebolla_ficha.jpg", quality=92)

# Anuncio 4:5
W, H = 1080, 1350
img = Image.new("RGB", (W, H), BLANCO)
d = ImageDraw.Draw(img)
d.rectangle([0, 0, W, 14], fill=ROSA)

logo = Image.open(ROOT / "public" / "logo.png").convert("RGBA")
fondo = Image.new("RGBA", logo.size, (255, 255, 255, 255))
caja = Image.alpha_composite(fondo, logo).convert("L").point(lambda p: 255 if p < 245 else 0).getbbox()
logo = logo.crop(caja) if caja else logo
logo.thumbnail((150, 150))
img.paste(logo, ((W - logo.width) // 2, 45), logo)

gancho = fuente("georgiab.ttf", 54)
centrado(d, W, 225, "PACK CEBOLLA ANTICA\u00cdDA", gancho, MARRON)
centrado(d, W, 295, "CHAMP\u00da POR SOLO 2 \u20ac M\u00c1S", gancho, ROSA)

pegar(img, mascarilla, 330, 1010, 420, 580)
pegar(img, champu, 790, 1040, 620, 330)
sello(d, 960, 470, 100, "+ 2 \u20ac", "champ\u00fa")

centrado(d, W, 1060, "Mascarilla Valquer 300 ml + Champ\u00fa Babaria 700 ml", fuente("georgia.ttf", 32), GRIS)
d.rounded_rectangle([140, 1125, 940, 1235], radius=50, fill=ROSA)
centrado(d, W, 1153, "Mascarilla + champ\u00fa de cebolla: 17,50 \u20ac", fuente("georgiab.ttf", 38), BLANCO)
centrado(d, W, 1252, "Champ\u00fa solo en pack \u00b7 Unidades limitadas", fuente("georgia.ttf", 30), MARRON)

d.rectangle([0, 1292, W, H], fill=MARRON)
centrado(d, W, 1307, "Env\u00edo r\u00e1pido \u00b7 esenciadebelleza.es", fuente("georgia.ttf", 28), BLANCO)
img.save(BASE / "ad_pack_cebolla.jpg", quality=95)
print("ok")
