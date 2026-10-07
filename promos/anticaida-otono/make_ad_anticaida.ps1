Add-Type -AssemblyName System.Drawing

$dir = "C:\Users\tomas\.copilot\session-state\54766e41-5908-4cda-ae76-0aff7ed14401\files"
$W = 1080
$H = 1350

$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAlias'
$g.Clear([System.Drawing.Color]::White)

$marron = [System.Drawing.Color]::FromArgb(255, 61, 32, 24)
$rosa = [System.Drawing.Color]::FromArgb(255, 196, 133, 122)
$gris = [System.Drawing.Color]::FromArgb(255, 107, 90, 82)

function RoundRect($g, $x, $y, $w, $h, $r, $brush) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $p.AddArc($x, $y, 2 * $r, 2 * $r, 180, 90)
  $p.AddArc($x + $w - 2 * $r, $y, 2 * $r, 2 * $r, 270, 90)
  $p.AddArc($x + $w - 2 * $r, $y + $h - 2 * $r, 2 * $r, 2 * $r, 0, 90)
  $p.AddArc($x, $y + $h - 2 * $r, 2 * $r, 2 * $r, 90, 90)
  $p.CloseFigure()
  $g.FillPath($brush, $p)
}

# Acento superior
$g.FillRectangle((New-Object System.Drawing.SolidBrush($rosa)), 0, 0, $W, 12)

# Logo oficial arriba a la izquierda
$logo = [System.Drawing.Image]::FromFile("C:\Users\tomas\esenciadebelleza\public\logo.png")
$g.DrawImage($logo, 50, 40, 150, 150)
$logo.Dispose()

$centro = New-Object System.Drawing.StringFormat
$centro.Alignment = 'Center'

# Gancho
$gancho = New-Object System.Drawing.Font("Georgia", 46, [System.Drawing.FontStyle]::Bold)
$g.DrawString("¿SE TE CAE EL PELO", $gancho, (New-Object System.Drawing.SolidBrush($marron)), (New-Object System.Drawing.RectangleF(0, 205, $W, 65)), $centro)
$g.DrawString("ESTE OTOÑO?", $gancho, (New-Object System.Drawing.SolidBrush($marron)), (New-Object System.Drawing.RectangleF(0, 265, $W, 65)), $centro)

# Subtítulo
$sub = New-Object System.Drawing.Font("Georgia", 27)
$g.DrawString("Tratamiento anticaída profesional Montibello", $sub, (New-Object System.Drawing.SolidBrush($gris)), (New-Object System.Drawing.RectangleF(0, 345, $W, 45)), $centro)
$sub2 = New-Object System.Drawing.Font("Georgia", 24)
$g.DrawString("Cryogen · 10 viales de 7 ml · el de las peluquerías", $sub2, (New-Object System.Drawing.SolidBrush($gris)), (New-Object System.Drawing.RectangleF(0, 390, $W, 40)), $centro)

# Foto REAL del producto
$prod = [System.Drawing.Image]::FromFile("$dir\mon033_ampollas.png")
$g.DrawImage($prod, 240, 445, 600, 620)
$prod.Dispose()

# Precio
$precio = New-Object System.Drawing.Font("Georgia", 66, [System.Drawing.FontStyle]::Bold)
$g.DrawString("28,75 €", $precio, (New-Object System.Drawing.SolidBrush($rosa)), (New-Object System.Drawing.RectangleF(0, 1085, $W, 95)), $centro)

# Ancla de valor
$ancla = New-Object System.Drawing.Font("Georgia", 24)
$g.DrawString("En farmacia, tratamientos similares desde 45 €", $ancla, (New-Object System.Drawing.SolidBrush($gris)), (New-Object System.Drawing.RectangleF(0, 1185, $W, 40)), $centro)

# Sello
RoundRect $g 290 1240 500 58 29 (New-Object System.Drawing.SolidBrush($rosa))
$sello = New-Object System.Drawing.Font("Georgia", 25, [System.Drawing.FontStyle]::Bold)
$g.DrawString("TRATAMIENTO DE CHOQUE", $sello, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), (New-Object System.Drawing.RectangleF(290, 1251, 500, 40)), $centro)

# Banda inferior
$g.FillRectangle((New-Object System.Drawing.SolidBrush($marron)), 0, 1305, $W, 45)
$pie = New-Object System.Drawing.Font("Georgia", 20)
$g.DrawString("ENVÍO RÁPIDO · esenciadebelleza.es", $pie, (New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)), (New-Object System.Drawing.RectangleF(0, 1315, $W, 30)), $centro)

$bmp.Save("$dir\ad_anticaida.jpg", [System.Drawing.Imaging.ImageFormat]::Jpeg)
$bmp.Dispose()
$g.Dispose()
Write-Output "ad_anticaida OK"
