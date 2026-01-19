# generar_data.ps1
# Generador de Base de Datos para Beyblade Deck Builder
# Solución robusta para rutas de imágenes

$rootPath = ".\piezas"
$outputFile = "parts_data.js"

$data = @{
    blades = @()
    ratchets = @()
    bits = @()
    cx_chips = @()
    cx_main_blades = @()
    cx_assists = @()
}

# Función que limpia la ruta cortando todo lo que esté antes de "piezas"
Function Get-Clean-Relative-Path($fullPath) {
    # Normalizar barras a backslash para buscar
    $norm = $fullPath.Replace('/', '\')
    # Buscar donde empieza "piezas" (insensible a mayúsculas)
    $idx = $norm.IndexOf("\piezas\", [System.StringComparison]::OrdinalIgnoreCase)
    
    if ($idx -eq -1) {
        # Si estamos DENTRO de piezas, quizas empiece directo
        if ($norm.StartsWith("piezas")) { return $norm.Replace('\', '/') }
        # Fallback: intentar buscar solo "piezas"
        $idx = $norm.IndexOf("piezas", [System.StringComparison]::OrdinalIgnoreCase)
    }

    if ($idx -ge 0) {
        # Cortar desde "piezas" en adelante
        $rel = $norm.Substring($idx)
        # Cambiar a slash normal para web
        return $rel.Replace('\', '/')
    }
    return ""
}

Function Get-FolderParts($path) {
    $results = @()
    if (Test-Path $path) {
        $folders = Get-ChildItem -Path $path -Directory
        foreach ($folder in $folders) {
            $images = Get-ChildItem -Path $folder.FullName -Filter *.png
            if ($images.Count -gt 0) {
                $cleanPath = Get-Clean-Relative-Path $folder.FullName
                if ($cleanPath -ne "") {
                    $results += @{ name = $folder.Name; path = $cleanPath; variants = @($images.Name) }
                }
            }
        }
    }
    return $results
}

Function Get-FileParts($path) {
    $results = @()
    if (Test-Path $path) {
        $files = Get-ChildItem -Path $path -Filter *.png
        $cleanPath = Get-Clean-Relative-Path (Get-Item $path).FullName
        
        if ($cleanPath -ne "") {
            foreach ($file in $files) {
                $results += @{ name = $file.BaseName; path = $cleanPath; variants = @($file.Name) }
            }
        }
    }
    return $results
}

Write-Host "Escaneando carpetas..."

# 1. Blades Normales (Carpetas)
if (Test-Path "$rootPath\blades") {
    $all = Get-ChildItem -Path "$rootPath\blades" -Directory
    foreach ($f in $all) {
        if ($f.Name -ne "cx") {
            $imgs = Get-ChildItem -Path $f.FullName -Filter *.png
            if ($imgs.Count -gt 0) {
                $clean = Get-Clean-Relative-Path $f.FullName
                $data.blades += @{ name = $f.Name; path = $clean; variants = @($imgs.Name) }
            }
        }
    }
}

# 2. CX (Archivos sueltos) - Detectamos nombres comunes
$pChips = if (Test-Path "$rootPath\blades\cx\chips") { "$rootPath\blades\cx\chips" } else { "$rootPath\blades\cx\Chip" }
$pMain  = if (Test-Path "$rootPath\blades\cx\main_blade") { "$rootPath\blades\cx\main_blade" } else { "$rootPath\blades\cx\main blade" }
$pAssist= if (Test-Path "$rootPath\blades\cx\assist") { "$rootPath\blades\cx\assist" } else { "$rootPath\blades\cx\assists" }

$data.cx_chips = Get-FileParts $pChips
$data.cx_main_blades = Get-FileParts $pMain
$data.cx_assists = Get-FileParts $pAssist

# 3. Piezas (Carpetas)
$data.ratchets = Get-FolderParts "$rootPath\ratchets"
$data.bits = Get-FolderParts "$rootPath\bits"

$json = $data | ConvertTo-Json -Depth 4
Set-Content -Path $outputFile -Value "const partsData = $json;" -Encoding UTF8

Write-Host "LISTO. Abre index.html y prueba."