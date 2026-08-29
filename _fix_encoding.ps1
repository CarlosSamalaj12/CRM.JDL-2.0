$path = 'C:\Users\samal\Desktop\CRM\CRM.JDL-2.0\src\modules\reports\ReportsSatisfaccion.jsx'
$bytes = [System.IO.File]::ReadAllBytes($path)
$hasBom = $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
$start = if ($hasBom) { 3 } else { 0 }
$content = [System.Text.Encoding]::UTF8.GetString($bytes, $start, $bytes.Length - $start)

# Use char codes to avoid PowerShell quoting issues with curly quotes
# ó = U+00F3
$oAcute = [char]0x00F3
# ñ = U+00F1
$nTilde = [char]0x00F1
# ú = U+00FA
$uAcute = [char]0x00FA
# é = U+00E9
$eAcute = [char]0x00E9
# í = U+00ED
$iAcute = [char]0x00ED
# á = U+00E1
$aAcute = [char]0x00E1
# à = U+00E0
$aGrave = [char]0x00E0
# è = U+00E8
$eGrave = [char]0x00E8
# ì = U+00EC
$iGrave = [char]0x00EC
# ò = U+00F2
$oGrave = [char]0x00F2
# ù = U+00F9
$uGrave = [char]0x00F9
# ü = U+00FC
$uUml = [char]0x00FC
# É = U+00C9
$EAcu = [char]0x00C9
# Ó = U+00D3
$OAcu = [char]0x00D3
# Ú = U+00DA
$UAcu = [char]0x00DA
# — em dash = U+2014
$emDash = [char]0x2014
# " left double quote = U+201C
$ldq = [char]0x201C
# " right double quote = U+201D
$rdq = [char]0x201D
# ' left single quote = U+2018
$lsq = [char]0x2018
# ' right single quote = U+2019
$rsq = [char]0x2019
# … ellipsis = U+2026
$ellipsis = [char]0x2026
# € euro = U+20AC
$euro = [char]0x20AC
# • bullet = U+2022
$bullet = [char]0x2022
# ¡ inverted exclamation = U+00A1
$iexcl = [char]0x00A1
# ¿ inverted question = U+00BF
$iquest = [char]0x00BF
# ° degree = U+00B0
$deg = [char]0x00B0
# ª feminine ordinal = U+00AA
$ford = [char]0x00AA
# º masculine ordinal = U+00BA
$mord = [char]0x00BA
# Ã = U+00C3
$Auml = [char]0x00C3

# The double-encoded patterns in the file (read as UTF-8, these are the literal chars)
$map = [ordered]@{
  ([char]0xC3 + [char]0xB3) = $oAcute     # ó
  ([char]0xC3 + [char]0xB1) = $nTilde     # ñ
  ([char]0xC3 + [char]0xBA) = $uAcute     # ú
  ([char]0xC3 + [char]0xA9) = $eAcute     # é
  ([char]0xC3 + [char]0xAD) = $iAcute     # í
  ([char]0xC3 + [char]0xA1) = $aAcute     # á
  ([char]0xC3 + [char]0xA0) = $aGrave     # à
  ([char]0xC3 + [char]0xA8) = $eGrave     # è
  ([char]0xC3 + [char]0xAC) = $iGrave     # ì
  ([char]0xC3 + [char]0xB2) = $oGrave     # ò
  ([char]0xC3 + [char]0xB9) = $uGrave     # ù
  ([char]0xC3 + [char]0xBC) = $uUml       # ü
  ([char]0xC3 + [char]0x89) = $EAcu       # É
  ([char]0xC3 + [char]0x93) = $OAcu       # Ó
  ([char]0xC3 + [char]0x9A) = $UAcu       # Ú
  ([char]0xE2 + [char]0x80 + [char]0x94) = $emDash     # —
  ([char]0xE2 + [char]0x80 + [char]0x9C) = $ldq        # "
  ([char]0xE2 + [char]0x80 + [char]0x9D) = $rdq        # "
  ([char]0xE2 + [char]0x80 + [char]0x98) = $lsq        # '
  ([char]0xE2 + [char]0x80 + [char]0x99) = $rsq        # '
  ([char]0xE2 + [char]0x80 + [char]0xA6) = $ellipsis   # …
  ([char]0xE2 + [char]0x82 + [char]0xAC) = $euro       # €
  ([char]0xE2 + [char]0x80 + [char]0xA2) = $bullet     # •
  ([char]0xC2 + [char]0xA1) = $iexcl       # ¡
  ([char]0xC2 + [char]0xBF) = $iquest      # ¿
  ([char]0xC2 + [char]0xB0) = $deg         # °
  ([char]0xC2 + [char]0xAA) = $ford        # ª
  ([char]0xC2 + [char]0xBA) = $mord        # º
  ([char]0xC3 + [char]0x83) = $Auml        # Ã (if double-encoded)
}

$replacements = 0
foreach ($key in $map.Keys) {
  $count = ([regex]::Matches($content, [regex]::Escape($key))).Count
  if ($count -gt 0) {
    $keyHex = ''
    foreach ($c in $key.ToCharArray()) { $keyHex += [int]$c.ToString().ToCharArray()[0] }
    $keyHex = $keyHex.PadLeft($key.Length * 2, ' ')
    Write-Host ("Replace {0,-25} (count={1,3})" -f $key, $count)
    $content = $content.Replace($key, $map[$key])
    $replacements += $count
  }
}
Write-Host ""
Write-Host "Total replacements: $replacements"

# Save as UTF-8 without BOM
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $content, $utf8NoBom)
Write-Host "File saved: $path"
$newBytes = [System.IO.File]::ReadAllBytes($path)
$newBom = if ($newBytes[0] -eq 0xEF -and $newBytes[1] -eq 0xBB -and $newBytes[2] -eq 0xBF) { 'WITH BOM' } else { 'NO BOM' }
Write-Host "Encoding: $newBom"
Write-Host "New size: $($newBytes.Length) bytes"

# Final verification
$verifyContent = [System.Text.Encoding]::UTF8.GetString($newBytes)
$stillMojibake = ([regex]::Matches($verifyContent, 'SatisfacciÃ³n|EvaluaciÃ³n|AnÃ¡lisis|percepciÃ³n|asÃ­gnalas|aquÃ|CalificaciÃ³n|SecciÃ³n|DistribuciÃ³n|NarraciÃ³n|EvoluciÃ³n|ProporciÃ³n|SalÃ³n|EvalÃºa')).Count
Write-Host "Remaining mojibake matches: $stillMojibake"
Write-Host "Satisfacción count: $(([regex]::Matches($verifyContent, 'Satisfacción')).Count)"
Write-Host "Evaluación count: $(([regex]::Matches($verifyContent, 'Evaluación')).Count)"
Write-Host "Análisis count: $(([regex]::Matches($verifyContent, 'Análisis')).Count)"
