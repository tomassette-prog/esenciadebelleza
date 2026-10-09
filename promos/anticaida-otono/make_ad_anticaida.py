from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).resolve().parent
ROOT = BASE.parent.parent
W, H = 1080, 1350

MARRON = (61, 32, 24)
ROSA = (196, 133, 122)
GRIS = (107, 90, 82)
BLANCO = (255, 255, 255)

FUENTES = Path(r"C:\Windows\Fonts")


def fuente(nombre, tam):
    return ImageFont.truetype(str(FUENTES / nombre), tam)


def centrado(draw, y, texto, fnt, color):
    ancho = draw.textlength(texto, font=fnt)
    draw.text(((W - ancho) / 2, y), texto, font=fnt, fill=color)


def recortar_logo(ruta):
    logo = Image.open(ruta).convert("RGBA")
    fondo = Image.new("RGBA", logo.size, (255, 255, 255, 255))
    caja = Image.alpha_composite(fondo, logo).convert("L").point(lambda p: 255 if p < 245 else 0).getbbox()
    return logo.crop(caja) if caja else logo


img = Image.new("RGB", (W, H), BLANCO)
d = ImageDraw.Draw(img)

d.rectangle([0, 0, W, 14], fill=ROSA)

logo = recortar_logo(ROOT / "public" / "logo.png")
logo.thumbnail((150, 150))
img.paste(logo, ((W - logo.width) // 2, 45), logo)

gancho = fuente("georgiab.ttf", 64)
centrado(d, 225, "¿SE TE CAE EL PELO", gancho, MARRON)
centrado(d, 305, "ESTE OTOÑO?", gancho, MARRON)

centrado(d, 410, "Tratamiento anticaída profesional", fuente("georgia.ttf", 36), GRIS)
centrado(d, 458, "Montibello Cryogen · 10 viales", fuente("georgia.ttf", 36), GRIS)

prod = Image.open(BASE / "mon033.png").convert("RGB")
caja = prod.convert("L").point(lambda p: 255 if p < 248 else 0).getbbox()
prod = prod.crop(caja)
escala = min(900 / prod.width, 470 / prod.height)
prod = prod.resize((round(prod.width * escala), round(prod.height * escala)), Image.LANCZOS)
img.paste(prod, ((W - prod.width) // 2, 520 + (470 - prod.height) // 2))

centrado(d, 1000, "28,75 €", fuente("georgiab.ttf", 110), ROSA)
centrado(d, 1135, "En farmacia, tratamientos similares desde 45 €", fuente("georgia.ttf", 30), GRIS)

d.rounded_rectangle([230, 1195, 850, 1262], radius=34, fill=ROSA)
centrado(d, 1210, "TRATAMIENTO DE CHOQUE", fuente("georgiab.ttf", 32), BLANCO)

d.rectangle([0, 1292, W, H], fill=MARRON)
centrado(d, 1307, "Envío rápido · esenciadebelleza.es", fuente("georgia.ttf", 28), BLANCO)

img.save(BASE / "ad_anticaida.jpg", quality=95)
print("ad_anticaida.jpg", img.size)
