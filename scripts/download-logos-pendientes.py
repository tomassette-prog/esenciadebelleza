import os
import requests

RUTA_HOME = os.path.expanduser("~")
for ruta in [os.path.join(RUTA_HOME, "Desktop"), os.path.join(RUTA_HOME, "Escritorio")]:
    if os.path.exists(ruta):
        BASE = ruta
        break

RUTA_DESCARGA = os.path.join(BASE, "imagenes", "logos peluqueria")
os.makedirs(RUTA_DESCARGA, exist_ok=True)

API = "https://logos.hunter.io/{domain}"
HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

PENDIENTES = {
    "Candelahn":  ["candelahn.com", "cosmeticoscandelahn.com"],
    "Cantu":      ["cantubeauty.com", "cantu.com"],
    "Coiffer":    ["coiffer.com", "coiffercosmetics.com"],
    "Don Algodon":["donalgodon.com", "don-algodon.com"],
    "Dr. Sante":  ["drsante.ua", "dr-sante.eu", "drsante.com"],
    "Hairtalk":   ["hairtalk.de", "hairtalk.com"],
    "Hey Joe":    ["heyjoe.eu", "heyjoe-barbershop.com", "heyjoebarbershop.com"],
    "Keler":      ["keler.es", "kelercosmetics.com"],
    "L'Oreal":    ["loreal-professionnel.com", "loreal.com", "lorealprofessionnel.es"],
    "Lendan":     ["lendan.es", "lendan.com"],
    "Novon":      ["novonprofessional.com", "novon.es"],
    "Olaplex":    ["olaplex.com", "olaplex.es"],
    "Vis Plantis":["vis-plantis.pl", "visplantis.com", "vis-plantis.com"],
}

ok = 0
fail = []

for marca, dominios in PENDIENTES.items():
    nombre_archivo = "logo_" + marca.lower().replace(" ", "_").replace("'", "").replace(".", "") + ".png"
    ruta_guardado = os.path.join(RUTA_DESCARGA, nombre_archivo)
    encontrado = False
    for dominio in dominios:
        try:
            r = requests.get(API.format(domain=dominio), headers=HEADERS, timeout=10)
            if r.status_code == 200 and len(r.content) > 500:
                with open(ruta_guardado, "wb") as f:
                    f.write(r.content)
                print(f"[OK] {marca} via {dominio}")
                encontrado = True
                ok += 1
                break
        except:
            pass
    if not encontrado:
        fail.append(marca)
        print(f"[FAIL] {marca}")

print(f"\nOK: {ok} | Fallidos: {len(fail)}")
if fail:
    print("Sin logo:", ", ".join(fail))
