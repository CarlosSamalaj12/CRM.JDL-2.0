$path = 'C:\Users\samal\Desktop\CRM\CRM.JDL-2.0\src\modules\reports\ReportsSatisfaccion.jsx'
$content = [System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8)

# Build pattern → replacement map using char codes
$emDash = [char]0x2014
$enDash = [char]0x2013
$middleDot = [char]0x00B7
$upArrow = [char]0x2191
$downArrow = [char]0x2193
$UAcu = [char]0x00DA
$hourglass = [char]0x23F3
$boxH = [char]0x2500
$timesX = [char]0x00D7
$rdq = [char]0x201D
$ldq = [char]0x201C
$lsq = [char]0x2018
$rsq = [char]0x2019
$ellipsis = [char]0x2026
$euro = [char]0x20AC
$deg = [char]0x00B0
$ford = [char]0x00AA
$mord = [char]0x00BA
$iexcl = [char]0x00A1
$iquest = [char]0x00BF
$bullet = [char]0x2022

# Double-encoded sequences (U+00C3/U+00C2/U+00E2 followed by continuation byte)
$map = [ordered]@{
  # Ã followed by Latin-1 continuation (double-encoded 2-byte UTF-8)
  ([char]0xC3 + [char]0xB3) = [char]0x00F3  # ó
  ([char]0xC3 + [char]0xB1) = [char]0x00F1                              # ñ
  ([char]0xC3 + [char]0xBA) = [char]0x00FA                              # ú
  ([char]0xC3 + [char]0xA9) = [char]0x00E9                              # é
  ([char]0xC3 + [char]0xAD) = [char]0x00ED                              # í
  ([char]0xC3 + [char]0xA1) = [char]0x00E1                              # á
  ([char]0xC3 + [char]0xA0) = [char]0x00E0                              # à
  ([char]0xC3 + [char]0xA8) = [char]0x00E8                              # è
  ([char]0xC3 + [char]0xAC) = [char]0x00EC                              # ì
  ([char]0xC3 + [char]0xB2) = [char]0x00F2                              # ò
  ([char]0xC3 + [char]0xB9) = [char]0x00F9                              # ù
  ([char]0xC3 + [char]0xBC) = [char]0x00FC                              # ü
  ([char]0xC3 + [char]0x89) = [char]0x00C9                              # É
  ([char]0xC3 + [char]0x93) = [char]0x00D3                              # Ó
  ([char]0xC3 + [char]0x9A) = $UAcu                                     # Ú
  # Â followed by Latin-1 continuation (double-encoded 2-byte UTF-8 starting with C2)
  ([char]0xC2 + [char]0xA1) = $iexcl                                    # ¡
  ([char]0xC2 + [char]0xBF) = $iquest                                   # ¿
  ([char]0xC2 + [char]0xB0) = $deg                                      # °
  ([char]0xC2 + [char]0xAA) = $ford                                     # ª
  ([char]0xC2 + [char]0xBA) = $mord                                     # º
  ([char]0xC2 + [char]0xB7) = $middleDot                                # ·
  # â followed by Latin-1 continuation (double-encoded 3-byte UTF-8 starting with E2)
  # Em dash (—, U+2014) → UTF-8: E2 80 94 → chars U+00E2 U+20AC U+201D
  ([char]0xE2 + [char]0x20AC + [char]0x201D) = $emDash                  # —
  # Left double quote (", U+201C) → UTF-8: E2 80 9C → chars U+00E2 U+20AC U+0153
  ([char]0xE2 + [char]0x20AC + [char]0x0153) = $ldq                     # "
  # Right double quote (", U+201D) → UTF-8: E2 80 9D → chars U+00E2 U+20AC U+201D
  # (already handled by em dash since they share pattern) — this is a duplicate
  # En dash (–, U+2013) → UTF-8: E2 80 93 → chars U+00E2 U+20AC U+201C
  ([char]0xE2 + [char]0x20AC + [char]0x201C) = $enDash                  # –
  # Box drawings light horizontal (─, U+2500) → UTF-8: E2 94 80 → chars U+00E2 U+2014 U+20AC
  ([char]0xE2 + [char]0x2014 + [char]0x20AC) = $boxH                    # ─
  # Up arrow (↑, U+2191) → UTF-8: E2 86 91 → chars U+00E2 U+2020 U+2018
  ([char]0xE2 + [char]0x2020 + [char]0x2018) = $upArrow                 # ↑
  # Down arrow (↓, U+2193) → UTF-8: E2 86 93 → chars U+00E2 U+2020 U+201C
  ([char]0xE2 + [char]0x2020 + [char]0x201C) = $downArrow               # ↓
  # Hourglass (⏳, U+23F3) → UTF-8: E2 8F B3 → chars U+00E2 U+008F U+00B3
  ([char]0xE2 + [char]0x008F + [char]0x00B3) = $hourglass               # ⏳
  # Ellipsis (…, U+2026) → UTF-8: E2 80 A6 → chars U+00E2 U+20AC U+00A6
  ([char]0xE2 + [char]0x20AC + [char]0x00A6) = $ellipsis                # …
  # Bullet (•, U+2022) → UTF-8: E2 80 A2 → chars U+00E2 U+20AC U+00A2
  ([char]0xE2 + [char]0x20AC + [char]0x00A2) = $bullet                  # •
  # Euro (€, U+20AC) → UTF-8: E2 82 AC → chars U+00E2 U+0080 U+00AC (0x80 is undefined in Win-1252, mapped to U+0080)
  ([char]0xE2 + [char]0x0080 + [char]0x00AC) = $euro                    # €
  # Special: "â”€" pattern (U+00E2 U+201D U+20AC) — used as decorative divider in comments
  # This was the Box Drawings char but with chars in wrong order due to earlier corruption
  # Replace with clean box-drawing char
  ([char]0xE2 + [char]0x201D + [char]0x20AC) = $boxH                    # ─
  # Multiplication sign (×, U+00D7) — appears as Ã— in some renders
  # In this file, we saw `Ã—` in modal close button. UTF-8: C3 97 → chars U+00C3 U+2014
  ([char]0xC3 + [char]0x2014) = $timesX                                 # ×
}

# Apply replacements
$replacements = 0
foreach ($key in $map.Keys) {
  $count = ([regex]::Matches($content, [regex]::Escape($key))).Count
  if ($count -gt 0) {
    $keyDisplay = $key -replace "`n", '\n' -replace "`r", '\r'
    $valDisplay = $map[$key] -replace "`n", '\n' -replace "`r", '\r'
    Write-Host ("Replace '{0,-12}' → '{1,-3}' (count={2,3})" -f $keyDisplay, $valDisplay, $count)
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

# Verify
$newBytes = [System.IO.File]::ReadAllBytes($path)
$newBom = if ($newBytes[0] -eq 0xEF -and $newBytes[1] -eq 0xBB -and $newBytes[2] -eq 0xBF) { 'WITH BOM' } else { 'NO BOM' }
Write-Host "Encoding: $newBom"
$verify = [System.Text.Encoding]::UTF8.GetString($newBytes)

# Check for any remaining double-encoded patterns
$remaining = 0
for ($i = 0; $i -lt $verify.Length - 1; $i++) {
  $c = $verify[$i]
  $n = $verify[$i + 1]
  $code = [int][char]$c
  $ncode = [int][char]$n
  if (($code -eq 0xC3 -or $code -eq 0xC2) -and $ncode -ge 0x80 -and $ncode -le 0xBF) {
    # Check if this was a known "letter" pattern (C3 + 80-BF where the n is a letter char)
    $remaining++
  }
}
Write-Host "Remaining double-encoded sequences: $remaining"

# Confirm key Spanish chars
Write-Host "Satisfacción count: $(([regex]::Matches($verify, 'Satisfacción')).Count)"
Write-Host "Evaluación count: $(([regex]::Matches($verify, 'Evaluación')).Count)"
Write-Host "Análisis count: $(([regex]::Matches($verify, 'Análisis')).Count)"
Write-Host "Buscador count: $(([regex]::Matches($verify, 'Buscador')).Count)"
$emCount = ([regex]::Matches($verify, [regex]::Escape($emDash))).Count
$hgCount = ([regex]::Matches($verify, [regex]::Escape($hourglass))).Count
Write-Host "Em dash count: $emCount"
Write-Host "Hourglass count: $hgCount"
