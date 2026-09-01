# SessionStart hook: injeta docs/STATUS_PROJETO.md no contexto da sessão.
# A memória em ~/.claude é efêmera neste projeto (container recriado zera tudo);
# o arquivo versionado no git é a fonte de verdade. Este hook garante que ele
# seja sempre lido no início da sessão.
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$path = Join-Path $PSScriptRoot '..\..\docs\STATUS_PROJETO.md'
if (-not (Test-Path $path)) {
    '{"suppressOutput": true}'
    exit 0
}
$content = Get-Content -Path $path -Raw -Encoding UTF8
$context = @"
=== STATUS DO PROJETO (docs/STATUS_PROJETO.md) ===
Fonte de verdade duravel do estado atual. A memoria ~/.claude e efemera neste projeto.
Ao encerrar uma sessao com mudanca relevante de estado, ATUALIZE docs/STATUS_PROJETO.md
E docs/CONTEXTO_SESSOES.md e faca commit.

$content
"@
$payload = @{
    hookSpecificOutput = @{
        hookEventName     = 'SessionStart'
        additionalContext = $context
    }
}
$payload | ConvertTo-Json -Depth 5 -Compress
