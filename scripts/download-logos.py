import os
import re
import time
import random
from urllib.parse import urljoin, urlparse
import requests
from bs4 import BeautifulSoup

# 1. Localización dinámica del Escritorio (Desktop) del usuario
RUTA_HOME = os.path.expanduser("~")

OPCIONES_ESCRITORIO = [
    os.path.join(RUTA_HOME, "Escritorio"),
    os.path.join(RUTA_HOME, "Desktop")
]

ESCRITORIO_LOCAL = OPCIONES_ESCRITORIO[0]
for ruta in OPCIONES_ESCRITORIO:
    if os.path.exists(ruta):
        ESCRITORIO_LOCAL = ruta
        break

# 2. Definición de la estructura de carpetas requerida en tu Escritorio
BASE_URL = "https://depeluqueriaproductos.com"
CARPETA_RAIZ = os.path.join(ESCRITORIO_LOCAL, "imagenes")
SUB_CARPETA = "logos peluqueria"
RUTA_DESCARGA = os.path.join(CARPETA_RAIZ, SUB_CARPETA)

# Base de datos de las marcas identificadas en el catálogo de la tienda
DICCIONARIO_MARCAS = {
    "yunsey": "Yunsey", "valquer": "Valquer", "glossco": "Glossco", "fanola": "Fanola", 
    "tahe": "Tahe", "karseell": "Karseell", "schwarzkopf": "Schwarzkopf", "revlon": "Revlon", 
    "loreal": "Loreal", "alan-coar": "Alan Coar", "dr-sante": "Dr Sante", "arual": "Arual", 
    "salerm": "Salerm", "hipertin": "Hipertin", "periche": "Periche", "keen-strok": "Keen Strok", 
    "keyra": "Keyra", "liheto": "Liheto", "kerastase": "Kerastase", "pure-green": "Pure Green", 
    "wella": "Wella", "montibello": "Montibello", "kuul": "Kuul", "celine": "Celine", 
    "ufaes": "Ufaes", "belkos": "Belkos", "termix": "Termix", "bullon": "Bullon", 
    "saga": "Saga", "the-fruit-company": "The Fruit Company", "steinhart": "Steinhart", 
    "denman": "Denman", "onefull": "Onefull", "bioplacenta": "Bioplacenta", 
    "moroccanoil": "Moroccanoil", "keratin-cure": "Keratin Cure", "unico": "UniCo", 
    "vanila": "Vanila", "risfort": "Risfort", "ghd": "Ghd", "nioxin": "Nioxin"
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/118.0.0.0 Safari/537.36"
    )
}

def crear_estructura_directorios():
    """Crea de forma jerárquica las carpetas en tu Escritorio local."""
    try:
        if not os.path.exists(CARPETA_RAIZ):
            os.makedirs(CARPETA_RAIZ)
            print(f"[DIRECTORIO] Carpeta principal creada en: '{CARPETA_RAIZ}'")
        
        if not os.path.exists(RUTA_DESCARGA):
            os.makedirs(RUTA_DESCARGA)
            print(f"[DIRECTORIO] Subcarpeta creada en: '{RUTA_DESCARGA}'")
        else:
            print(f"[DIRECTORIO] La ruta de destino ya existe en el Escritorio: '{RUTA_DESCARGA}'")
    except Exception as e:
        print(f"[FALLO CRÍTICO] No se pudieron estructurar los directorios: {str(e)}")
        raise

def normalizar_nombre_archivo(marca, url_recurso):
    """Limpia el nombre de la marca y mantiene la extensión de la imagen."""
    path_url = urlparse(url_recurso).path
    extension = os.path.splitext(path_url)[1]
    
    if not extension or extension.lower() not in ['.png', '.jpg', '.jpeg', '.svg', '.webp']:
        extension = '.png'
        
    marca_limpia = re.sub(r'[^a-zA-Z0-9_-]', '', marca.lower())
    return f"logo_{marca_limpia}{extension}"

def descargar_activo_binario(url_origen, marca_objetivo):
    """Guarda físicamente la imagen descargada en tu disco duro."""
    nombre_archivo = normalizar_nombre_archivo(marca_objetivo, url_origen)
    ruta_completa_destino = os.path.join(RUTA_DESCARGA, nombre_archivo)
    
    if os.path.exists(ruta_completa_destino):
        print(f"[OMITIDO] El logotipo para '{marca_objetivo}' ya existe localmente.")
        return True

    try:
        response = requests.get(url_origen, headers=HEADERS, timeout=12)
        if response.status_code == 200:
            with open(ruta_completa_destino, "wb") as archivo_salida:
                archivo_salida.write(response.content)
            print(f"[ÉXITO] Descargado: {nombre_archivo}")
            return True
        else:
            print(f"[ERROR {response.status_code}] No disponible para: {marca_objetivo}")
            return False
    except Exception as e:
        print(f"[EXCEPCIÓN] Error de conexión al descargar '{marca_objetivo}': {str(e)}")
        return False

def ejecutar_extraccion_plataforma():
    """Rastrea depeluqueriaproductos.com buscando los logos de cada marca."""
    print("[PROCESO] Iniciando el análisis de la tienda web...")
    sesion = requests.Session()
    sesion.headers.update(HEADERS)
    
    urls_de_analisis = [
        BASE_URL,
        f"{BASE_URL}/categoria-producto/peluqueria/",
        f"{BASE_URL}/categoria-producto/peluqueria/productospeluqueria/productos-de-peluqueria-packs/",
        f"{BASE_URL}/outlet-online-de-productos-de-peluqueria/",
        # Páginas de marcas específicas en WooCommerce
        f"{BASE_URL}/marca/wella/",
        f"{BASE_URL}/marca/schwarzkopf/",
        f"{BASE_URL}/marca/revlon/",
        f"{BASE_URL}/marca/loreal/",
        f"{BASE_URL}/marca/l-oreal/",
        f"{BASE_URL}/marca/montibello/",
        f"{BASE_URL}/marca/kerastase/",
        f"{BASE_URL}/marca/periche/",
        f"{BASE_URL}/marca/hipertin/",
        f"{BASE_URL}/marca/keen-strok/",
        f"{BASE_URL}/marca/dr-sante/",
        f"{BASE_URL}/marca/risfort/",
        f"{BASE_URL}/marca/novon/",
        f"{BASE_URL}/marca/kuul/",
        f"{BASE_URL}/marca/olaplex/",
        f"{BASE_URL}/marca/lendan/",
        f"{BASE_URL}/marca/vis-plantis/",
        f"{BASE_URL}/marca/don-algodon/",
        f"{BASE_URL}/marca/hey-joe/",
        f"{BASE_URL}/marca/cantu/",
        # Páginas de categorías adicionales
        f"{BASE_URL}/categoria-producto/peluqueria/coloracion-y-tintes/",
        f"{BASE_URL}/categoria-producto/peluqueria/champu-y-tratamientos-capilares/",
        f"{BASE_URL}/categoria-producto/peluqueria/maquinaria-y-herramientas/",
        f"{BASE_URL}/categoria-producto/barberia/",
        f"{BASE_URL}/categoria-producto/estetica/",
        f"{BASE_URL}/tienda/",
        f"{BASE_URL}/shop/",
    ]
    
    mapa_activos_localizados = {}
    
    for url in urls_de_analisis:
        try:
            print(f"[ANÁLISIS] Escaneando imágenes en: {url}")
            respuesta = sesion.get(url, timeout=15)
            if respuesta.status_code != 200:
                continue
            
            soup = BeautifulSoup(respuesta.text, 'html.parser')
            etiquetas_imagen = soup.find_all('img')
            
            for img in etiquetas_imagen:
                # Priorizar atributos lazy-load; ignorar data: URIs (placeholders)
                source_url = None
                for attr in ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-image', 'data-url', 'src']:
                    val = img.get(attr)
                    if val and not val.startswith('data:'):
                        source_url = val
                        break
                if not source_url:
                    continue
                
                url_absoluta_activo = urljoin(BASE_URL, source_url)
                texto_alt = img.get('alt', '')
                clases_html = " ".join(img.get('class', []))
                
                for identificador_marca, nombre_real in DICCIONARIO_MARCAS.items():
                    patron_busqueda = re.compile(rf"\b{identificador_marca.replace('-', '_')}\b", re.IGNORECASE)
                    
                    if (patron_busqueda.search(url_absoluta_activo) or 
                        patron_busqueda.search(texto_alt) or 
                        patron_busqueda.search(clases_html)):
                        
                        if identificador_marca not in mapa_activos_localizados:
                            mapa_activos_localizados[identificador_marca] = url_absoluta_activo
                            print(f"  -> Encontrado recurso para '{nombre_real}'")
                            
        except Exception as e:
            print(f"[ADVERTENCIA] Incidencia procesando la ruta {url}: {str(e)}")
            
    print(f"\n[PROCESO] Descargando y guardando imágenes en: '{RUTA_DESCARGA}'...")
    for marca_id, url_activo in mapa_activos_localizados.items():
        descargar_activo_binario(url_activo, DICCIONARIO_MARCAS[marca_id])
        # Retardo aleatorio prudencial para simular navegación humana
        time.sleep(random.uniform(1.2, 2.5))

if __name__ == "__main__":
    crear_estructura_directorios()
    ejecutar_extraccion_plataforma()
    print(f"\n[SISTEMA] ¡Proceso completado! La carpeta está lista en tu Escritorio: '{RUTA_DESCARGA}'")
