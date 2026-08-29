$path = 'C:\Users\samal\Desktop\CRM\CRM.JDL-2.0\src\modules\reports\ReportsSatisfaccion.jsx'
$content = Get-Content $path -Raw
$bytes = [System.IO.File]::ReadAllBytes($path)
$hasBom = $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF
$mojibake = ([regex]::Matches($content, 'SatisfacciÃ³n|EvaluaciÃ³n|AnÃ¡lisis|percepciÃ³n|asÃ­gnalas|aquÃ|CalificaciÃ³n|SecciÃ³n|DistribuciÃ³n|NarraciÃ³n|EvoluciÃ³n|ProporciÃ³n|SalÃ³n|EvalÃºa|Ãšltimos')).Count
$emojiMojibake = ([regex]::Matches($content, 'ðŸ|â€¢|âœ…|â­')).Count
$boxMojibake = ([regex]::Matches($content, 'â”€|â”‚')).Count
# Use char codes for proper
$oAcute = [char]0x00F3
$proper = ([regex]::Matches($content, "Satisfacci${oAcute}n|Evaluaci${oAcute}n|An${oAcute}lisis")).Count
Write-Host "Mojibake: $mojibake"
Write-Host "Emoji mojibake: $emojiMojibake"
Write-Host "Box drawing mojibake: $boxMojibake"
Write-Host "Proper Spanish: $proper"
Write-Host "BOM: $hasBom"
Write-Host "File size: $($bytes.Length) bytes"
