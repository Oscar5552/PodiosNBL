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
    cx_infinity_metal_blades = @()
    cx_infinity_over_blades = @()
    ux_infinity_blades = @()
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

# Nombre visible en JSON: solo texto latino (sin japonés)
Function Clean-PartName($name) {
    if (-not $name) { return "" }

    $normalized = $name.Normalize([Text.NormalizationForm]::FormKC)

    if ($normalized -match '_') {
        $parts = $normalized -split '_'
        for ($i = $parts.Length - 1; $i -ge 0; $i--) {
            $seg = Clean-LatinTokens $parts[$i].Trim()
            if ($seg.Length -gt 0) { return $seg }
        }
    }

    $cleaned = Clean-LatinTokens $normalized
    if ($cleaned.Length -gt 0) { return $cleaned }
    return $name.Trim()
}

Function Clean-LatinTokens($text) {
    if (-not $text) { return "" }

    $step = $text -replace '[\p{IsCJKUnifiedIdeographs}\p{IsHiragana}\p{IsKatakana}]+', ' '
    $step = ($step -replace '[^\p{L}\p{N}\s\(\)\.\-\+,''&]', '').Trim()
    $step = ($step -replace '\s+', ' ')
    if ($step.Length -eq 0) { return "" }

    $tokens = $step -split '\s+'
    $latin = @()
    for ($i = $tokens.Length - 1; $i -ge 0; $i--) {
        if ($tokens[$i] -match '^[A-Za-z0-9][A-Za-z0-9\.\-\(\)&'']*$') {
            $latin = ,$tokens[$i] + $latin
        } else { break }
    }

    if ($latin.Count -eq 0) { return "" }

    while ($latin.Count -gt 1 -and $latin[0].Length -le 2) {
        $latin = $latin[1..($latin.Count - 1)]
    }

    return ($latin -join ' ').Trim()
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
                    $results += @{ name = (Clean-PartName $folder.Name); path = $cleanPath; variants = @($images.Name) }
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
                $results += @{ name = (Clean-PartName $file.BaseName); path = $cleanPath; variants = @($file.Name) }
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
        if ($f.Name -notin @('cx', 'UX')) {
            $imgs = Get-ChildItem -Path $f.FullName -Filter *.png
            if ($imgs.Count -gt 0) {
                $clean = Get-Clean-Relative-Path $f.FullName
                $data.blades += @{ name = (Clean-PartName $f.Name); path = $clean; variants = @($imgs.Name) }
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

# Assists: PNG sueltos en raíz + subcarpetas (KNUCKLE, ODD, etc.)
$data.cx_assists = @()
$data.cx_assists += Get-FileParts $pAssist
$data.cx_assists += Get-FolderParts $pAssist

# CX Infinity (Expand Blade): Metal Blade + Over Blade
$pInfinityMetal = "$rootPath\blades\cx\cx infinity\blade infinity"
$pInfinityOver  = "$rootPath\blades\cx\cx infinity\assist infinity"
$data.cx_infinity_metal_blades = Get-FolderParts $pInfinityMetal
$data.cx_infinity_over_blades  = Get-FolderParts $pInfinityOver

# UX Infinity: solo main blade (carpetas en blades/UX)
$data.ux_infinity_blades = Get-FolderParts "$rootPath\blades\UX"

# 3. Piezas (Carpetas)
$data.ratchets = Get-FolderParts "$rootPath\ratchets"
$data.bits = Get-FolderParts "$rootPath\bits"

Add-Type -AssemblyName System.Web.Extensions
$serializer = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$serializer.MaxJsonLength = 33554432
$json = $serializer.Serialize($data)
Set-Content -Path $outputFile -Value "const partsData = $json;" -Encoding UTF8

Write-Host "LISTO. Abre index.html y prueba."