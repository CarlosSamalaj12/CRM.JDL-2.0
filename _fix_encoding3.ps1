$path = 'C:\Users\samal\Desktop\CRM\CRM.JDL-2.0\src\modules\reports\ReportsSatisfaccion.jsx'
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# Comprehensive map using actual .NET char codes (post UTF-8 decode)
# These represent double-encoded UTF-8 in the file
# Pattern: file has char1+char2 (2 or 3 chars) which should be 1 char
$map = [ordered]@{}
# Double-encoded 2-byte UTF-8 starting with U+00C3 (Ã) — Spanish accented letters
$map[[char]0xC3 + [char]0xB3] = [char]0x00F3  # ó
$map[[char]0xC3 + [char]0xB1] = [char]0x00F1  # ñ
$map[[char]0xC3 + [char]0xBA] = [char]0x00FA  # ú
$map[[char]0xC3 + [char]0xA9] = [char]0x00E9  # é
$map[[char]0xC3 + [char]0xAD] = [char]0x00ED  # í
$map[[char]0xC3 + [char]0xA1] = [char]0x00E1  # á
$map[[char]0xC3 + [char]0xA0] = [char]0x00E0  # à
$map[[char]0xC3 + [char]0xA8] = [char]0x00E8  # è
$map[[char]0xC3 + [char]0xAC] = [char]0x00EC  # ì
$map[[char]0xC3 + [char]0xB2] = [char]0x00F2  # ò
$map[[char]0xC3 + [char]0xB9] = [char]0x00F9  # ù
$map[[char]0xC3 + [char]0xBC] = [char]0x00FC  # ü
$map[[char]0xC3 + [char]0x89] = [char]0x00C9  # É
$map[[char]0xC3 + [char]0x93] = [char]0x00D3  # Ó
$map[[char]0xC3 + [char]0x0161] = [char]0x00DA # Ú (was incorrectly U+009A before)
# Double-encoded 2-byte UTF-8 starting with U+00C2 (Â) — special symbols
$map[[char]0xC2 + [char]0xA1] = [char]0x00A1  # ¡
$map[[char]0xC2 + [char]0xBF] = [char]0x00BF  # ¿
$map[[char]0xC2 + [char]0xB0] = [char]0x00B0  # °
$map[[char]0xC2 + [char]0xAA] = [char]0x00AA  # ª
$map[[char]0xC2 + [char]0xBA] = [char]0x00BA  # º
$map[[char]0xC2 + [char]0xB7] = [char]0x00B7  # ·
# Double-encoded 3-byte UTF-8 starting with U+00E2 (â) — symbols/arrows
$map[[char]0xE2 + [char]0x20AC + [char]0x201D] = [char]0x2014  # — em dash
$map[[char]0xE2 + [char]0x20AC + [char]0x201C] = [char]0x2013  # – en dash
$map[[char]0xE2 + [char]0x20AC + [char]0x0153] = [char]0x201C  # " left double quote
$map[[char]0xE2 + [char]0x20AC + [char]0x00A6] = [char]0x2026  # … ellipsis
$map[[char]0xE2 + [char]0x20AC + [char]0x00A2] = [char]0x2022  # • bullet
$map[[char]0xE2 + [char]0x2014 + [char]0x20AC] = [char]0x2500  # ─ box horizontal
$map[[char]0xE2 + [char]0x2020 + [char]0x2018] = [char]0x2191  # ↑ up arrow
$map[[char]0xE2 + [char]0x2020 + [char]0x201C] = [char]0x2193  # ↓ down arrow
$map[[char]0xE2 + [char]0x008F + [char]0x00B3] = [char]0x23F3  # ⏳ hourglass
$map[[char]0xE2 + [char]0x201D + [char]0x20AC] = [char]0x2500  # ─ box horizontal (corrupted order)
$map[[char]0xE2 + [char]0x0080 + [char]0x00AC] = [char]0x20AC  # € euro

# Apply replacements
$replacements = 0
foreach ($key in $map.Keys) {
  $count = ([regex]::Matches($content, [regex]::Escape($key))).Count
  if ($count -gt 0) {
    $keyDisplay = if ($key.Length -le 8) { $key } else { $key.Substring(0, 8) + '...' }
    $valDisplay = $map[$key]
    Write-Host ("Replace {0,-15} → '{1}' (count={2,3})" -f "'$keyDisplay'", $valDisplay, $count)
    $content = $content.Replace($key, $map[$key])
    $replacements += $count
  }
}
Write-Host ""
Write-Host "Total replacements: $replacements"

# Save as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
Write-Host "File saved"

# Verify - look for any remaining high-byte sequences
$verify = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)
$remaining = @{}
for ($i = 0; $i -lt $verify.Length - 1; $i++) {
  $c1 = $verify[$i]
  $c2 = $verify[$i + 1]
  $code1 = [int][char]$c1
  $code2 = [int][char]$c2
  if (($code1 -eq 0xC3 -or $code1 -eq 0xC2) -and $code2 -ge 0x80) {
    $key = "$c1$c2"
    if ($remaining.ContainsKey($key)) {
      $remaining[$key]++
    } else {
      $remaining[$key] = 1
    }
  }
}
Write-Host ""
Write-Host "=== Remaining double-encoded (2-char) sequences ==="
foreach ($k in ($remaining.Keys | Sort-Object)) {
  $codes = ''
  for ($i = 0; $i -lt $k.Length; $i++) {
    $codes += "U+$('{0:X4}' -f [int][char]$k[$i]) "
  }
  Write-Host ("'{0}' count={1} [{2}]" -f $k, $remaining[$k], $codes)
}

# Check for 3-char E2 patterns
$remaining3 = @{}
for ($i = 0; $i -lt $verify.Length - 2; $i++) {
  $c1 = $verify[$i]
  $c2 = $verify[$i + 1]
  $c3 = $verify[$i + 2]
  $code1 = [int][char]$c1
  $code2 = [int][char]$c2
  $code3 = [int][char]$c3
  if ($code1 -eq 0xE2 -and $code2 -ge 0x80 -and $code3 -ge 0x80) {
    $key = "$c1$c2$c3"
    if ($remaining3.ContainsKey($key)) {
      $remaining3[$key]++
    } else {
      $remaining3[$key] = 1
    }
  }
}
Write-Host ""
Write-Host "=== Remaining E2-prefixed 3-char sequences ==="
foreach ($k in ($remaining3.Keys | Sort-Object)) {
  Write-Host "  '$k' count=$($remaining3[$k])"
}

Write-Host ""
Write-Host "=== Spanish chars verification ==="
Write-Host "Satisfacción: $(([regex]::Matches($verify, 'Satisfacción')).Count)"
Write-Host "Evaluación: $(([regex]::Matches($verify, 'Evaluación')).Count)"
Write-Host "Análisis: $(([regex]::Matches($verify, 'Análisis')).Count)"
Write-Host "Últimos: $(([regex]::Matches($verify, 'Últimos')).Count)"
Write-Host "Buscar evento: $(([regex]::Matches($verify, 'Buscar evento')).Count)"
Write-Host "Buscar: $(([regex]::Matches($verify, 'Buscar')).Count)"
