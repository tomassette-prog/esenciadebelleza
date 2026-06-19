import os
import requests

RUTA_HOME = os.path.expanduser("~")
OPCIONES_ESCRITORIO = [os.path.join(RUTA_HOME, "Escritorio"), os.path.join(RUTA_HOME, "Desktop")]
ESCRITORIO_LOCAL = OPCIONES_ESCRITORIO[0]
for ruta in OPCIONES_ESCRITORIO:
    if os.path.exists(ruta):
        ESCRITORIO_LOCAL = ruta
        break

CARPETA_RAIZ = os.path.join(ESCRITORIO_LOCAL, "imagenes")
SUB_CARPETA = "logos peluqueria"
RUTA_DESCARGA = os.path.join(CARPETA_RAIZ, SUB_CARPETA)

MARCAS_DOMINIOS = {
    "Yunsey": "yunsey.com", "Valquer": "valquer.com", "Glossco": "glosscoprofessional.com",
    "Fanola": "fanola.it", "Tahe": "tahecosmetics.com", "Karseell": "karseell.com",
    "Schwarzkopf": "schwarzkopf.com", "Revlon": "revlon.com", "Loreal": "loreal.com",
    "Alan Coar": "alancoar.com", "Dr Sante": "dr-sante.com", "Arual": "arual.com",
    "Salerm": "salerm.com", "Hipertin": "hipertin.com", "Periche": "periche-profesional.com",
    "Keen Strok": "keenstrok.com", "Keyra": "keyracosmetics.com", "Liheto": "liheto.com",
    "Kerastase": "kerastase.com", "Pure Green": "puregreen.at", "Wella": "wella.com",
    "Montibello": "montibello.com", "Kuul": "kuulcolor.com", "Celine": "celineprofessional.com",
    "Ufaes": "ufaes.com", "Belkos": "belkosvegan.com", "Termix": "termix.net",
    "Bullon": "bullon.es", "Saga": "sagacosmetics.com", "The Fruit Company": "thefruitcompany.es",
    "Steinhart": "steinhartprofessional.com", "Denman": "denmanbrush.com", "Onefull": "onefull.es",
    "Moroccanoil": "moroccanoil.com", "Keratin Cure": "keratincure.com", "Risfort": "risfort.com",
    "Ghd": "ghdhair.com", "Nioxin": "nioxin.com"
}

API_LOGOS_URL = "https://logos.hunter.io/{domain}"

def crear_estructura_directorios():
    if not os.path.exists(CARPETA_RAIZ):
        os.makedirs(CARPETA_RAIZ)
    if not os.path.exists(RUTA_DESCARGA):
        os.makedirs(RUTA_DESCARGA)
        print(f"[DIRECTORIO] Subcarpeta creada: {RUTA_DESCARGA}")
    else:
        print(f"[DIRECTORIO] Ya existe: {RUTA_DESCARGA}")

def descargar_logos_limpios():
    print("\n[PROCESO] Descargando logos corporativos...")
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
    ok = 0
    fail = 0
    for marca, dominio in MARCAS_DOMINIOS.items():
        url_logo = API_LOGOS_URL.format(domain=dominio)
        nombre_archivo = f"logo_{marca.lower().replace(' ', '_')}.png"
        ruta_guardado = os.path.join(RUTA_DESCARGA, nombre_archivo)
        try:
            r = requests.get(url_logo, headers=headers, timeout=15)
            if r.status_code == 200 and len(r.content) > 500:
                with open(ruta_guardado, "wb") as f:
                    f.write(r.content)
                print(f"  [OK] {marca}")
                ok += 1
            else:
                print(f"  [FAIL] {marca} ({dominio}) - status {r.status_code} size {len(r.content)}")
                fail += 1
        except Exception as e:
            print(f"  [ERROR] {marca}: {e}")
            fail += 1
    print(f"\n[RESUMEN] OK: {ok} | Fallidos: {fail}")

if __name__ == "__main__":
    crear_estructura_directorios()
    descargar_logos_limpios()
    print(f"\n[FIN] Logos en: {RUTA_DESCARGA}")
