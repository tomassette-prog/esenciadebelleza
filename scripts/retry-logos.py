import os, requests

RUTA_DESCARGA = os.path.join(os.path.expanduser("~"), "Desktop", "imagenes", "logos peluqueria")
headers = {"User-Agent": "Mozilla/5.0"}
API = "https://logos.hunter.io/{domain}"

fallidos = {
    "Fanola":       ["fanola.com", "fanola-haircolor.com"],
    "Loreal":       ["loreal-professionnel.com", "loreal-paris.es", "lorealparisusa.com"],
    "Alan Coar":    ["grupoalancoar.com", "alancoarcosmetics.com"],
    "Dr Sante":     ["drsante.ua", "drsante.com.ua"],
    "Arual":        ["arual.es", "cosmeticosarual.com"],
    "Keyra":        ["keyra.es", "keyraprofessional.com"],
    "Liheto":       ["liheto.es", "liheto.net"],
    "Kerastase":    ["kerastase-paris.com", "kerastase.co.uk", "kerastase.fr"],
    "Kuul":         ["kuul.mx", "kuulhair.com"],
    "Ufaes":        ["ufaes.es", "cosmeticosufaes.com"],
    "Belkos":       ["belkos.es", "belkoscosmetics.com"],
    "Bullon":       ["bullon.com", "laboratoriosbullon.com"],
    "Onefull":      ["onefull.com", "onefullcosmetics.com"],
}

for marca, dominios in fallidos.items():
    nombre = "logo_" + marca.lower().replace(" ", "_") + ".png"
    ruta = os.path.join(RUTA_DESCARGA, nombre)
    encontrado = False
    for dominio in dominios:
        try:
            r = requests.get(API.format(domain=dominio), headers=headers, timeout=10)
            if r.status_code == 200 and len(r.content) > 500:
                with open(ruta, "wb") as f:
                    f.write(r.content)
                print("[OK] " + marca + " via " + dominio)
                encontrado = True
                break
        except Exception as e:
            pass
    if not encontrado:
        print("[FAIL] " + marca)
