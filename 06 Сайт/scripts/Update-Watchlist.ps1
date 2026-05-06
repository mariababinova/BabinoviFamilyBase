$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..\..')

function U([string]$Text) {
    return [regex]::Replace(
        $Text,
        '\\u([0-9a-fA-F]{4})',
        [System.Text.RegularExpressions.MatchEvaluator]{
            param($Match)
            return [string][char]([Convert]::ToInt32($Match.Groups[1].Value, 16))
        }
    )
}

$MembersDirName = U '01 \u0427\u043b\u0435\u043d\u044b \u0441\u0435\u043c\u044c\u0438'
$WatchDirName = U '09 \u041d\u0430\u0431\u043b\u044e\u0434\u0435\u043d\u0438\u0435'
$OutputDir = Join-Path $Root $WatchDirName
$OutputPath = Join-Path $OutputDir 'watchlist.json'

function Read-Utf8File([string]$Path) {
    return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8)
}

function Write-Utf8File([string]$Path, [string]$Content) {
    $encoding = [System.Text.UTF8Encoding]::new($false)
    [System.IO.File]::WriteAllText($Path, $Content, $encoding)
}

function Get-RelativePath([string]$Path) {
    $rootPath = $Root.Path.TrimEnd('\') + '\'
    return $Path.Substring($rootPath.Length) -replace '\\', '/'
}

function Parse-Frontmatter([string]$Content) {
    $result = [ordered]@{}
    if ($Content -match '(?s)^---\r?\n(.*?)\r?\n---\r?\n') {
        foreach ($line in ($Matches[1] -split '\r?\n')) {
            if ($line -match '^([^:#]+):\s*(.*)$') {
                $result[$Matches[1].Trim()] = $Matches[2].Trim()
            }
        }
    }
    return $result
}

function Get-FirstHeading([string]$Content, [string]$Fallback) {
    foreach ($line in ($Content -split '\r?\n')) {
        if ($line -match '^#\s+(.+)$') {
            return $Matches[1].Trim()
        }
    }
    return $Fallback
}

function Get-BodyWithoutFrontmatter([string]$Content) {
    if ($Content -match '(?s)^---\r?\n.*?\r?\n---\r?\n(.*)$') {
        return $Matches[1]
    }
    return $Content
}

function Get-MatchingEvidence($Doc, $Zone) {
    $evidenceRows = [System.Collections.Generic.List[object]]::new()
    $lines = $Doc.Body -split '\r?\n'

    for ($i = 0; $i -lt $lines.Count; $i++) {
        $line = ($lines[$i] -replace '\s+', ' ').Trim()
        if (-not $line -or $line -match '^(---|tags:|source_files:)$') {
            continue
        }
        if ($line -match '^\s*-\s*[^:]+:\s*$') {
            continue
        }

        foreach ($keyword in $Zone.keywords) {
            if ($line -match [regex]::Escape($keyword)) {
                $evidenceRows.Add([pscustomobject][ordered]@{
                    keyword = $keyword
                    line = $i + 1
                    text = $line
                })
                break
            }
        }

        if ($evidenceRows.Count -ge 8) {
            break
        }
    }

    return @($evidenceRows)
}

function Get-Priority($ZoneId, $EvidenceCount, [string]$NextDate) {
    if ($EvidenceCount -eq 0) {
        return 'quiet'
    }
    if ($NextDate -and $NextDate -ne 'null') {
        return 'active'
    }
    if ($ZoneId -in @('pregnancy_postpartum', 'nika_development')) {
        return 'active'
    }
    return 'watch'
}

$masha = U '\u041c\u0430\u0448\u0430'
$artem = U '\u0410\u0440\u0442\u0451\u043c'
$nika = U '\u041d\u0438\u043a\u0430'

$personIdsByName = @{
    $artem = 'artem'
    $masha = 'masha'
    $nika = 'nika'
}

$relatedMetricIdsByZone = @{
    cholesterol = @('total_cholesterol', 'ldl_cholesterol', 'hdl_cholesterol', 'triglycerides')
    thyroid = @('tsh', 'free_t4', 'free_t3')
}

$zones = @(
    [ordered]@{
        id = 'pregnancy_postpartum'
        title = U '\u0411\u0435\u0440\u0435\u043c\u0435\u043d\u043d\u043e\u0441\u0442\u044c / \u043f\u043e\u0441\u043b\u0435\u0440\u043e\u0434\u043e\u0432\u043e\u0439 \u043f\u0435\u0440\u0438\u043e\u0434'
        people = @($masha)
        keywords = @(
            (U '\u0431\u0435\u0440\u0435\u043c\u0435\u043d'),
            (U '\u043f\u043e\u0441\u043b\u0435\u0440\u043e\u0434'),
            (U '\u0440\u043e\u0434\u043e\u0432'),
            (U '\u0440\u043e\u0434\u044b'),
            (U '\u0433\u0438\u043d\u0435\u043a\u043e\u043b\u043e\u0433'),
            (U '\u0430\u043a\u0443\u0448\u0435\u0440'),
            (U '\u041a\u0422\u0413'),
            (U '\u043a\u0430\u0440\u0434\u0438\u043e\u0442\u043e\u043a\u043e\u0433\u0440\u0430\u0444')
        )
    },
    [ordered]@{
        id = 'cholesterol'
        title = U '\u0425\u043e\u043b\u0435\u0441\u0442\u0435\u0440\u0438\u043d \u0438 \u0441\u0435\u0440\u0434\u0435\u0447\u043d\u043e-\u0441\u043e\u0441\u0443\u0434\u0438\u0441\u0442\u044b\u0439 \u0440\u0438\u0441\u043a'
        people = @($artem)
        keywords = @(
            (U '\u0445\u043e\u043b\u0435\u0441\u0442\u0435\u0440\u0438\u043d'),
            (U '\u0433\u0438\u043f\u0435\u0440\u0445\u043e\u043b\u0435\u0441\u0442\u0435\u0440\u0438\u043d'),
            (U '\u043b\u0438\u043f\u043e\u043f\u0440\u043e\u0442\u0435\u0438\u043d'),
            (U '\u0441\u0435\u0440\u0434\u0435\u0447\u043d\u043e-\u0441\u043e\u0441\u0443\u0434\u0438\u0441\u0442'),
            (U '\u0433\u043e\u043c\u043e\u0446\u0438\u0441\u0442\u0435\u0438\u043d')
        )
    },
    [ordered]@{
        id = 'thyroid'
        title = U '\u0429\u0438\u0442\u043e\u0432\u0438\u0434\u043d\u0430\u044f \u0436\u0435\u043b\u0435\u0437\u0430'
        people = @($artem, $nika)
        keywords = @(
            (U '\u0449\u0438\u0442\u043e\u0432\u0438\u0434'),
            (U '\u0422\u0422\u0413'),
            (U '\u0441\u0432\u043e\u0431\u043e\u0434\u043d\u044b\u0439 \u04224'),
            (U '\u0433\u043e\u0440\u043c\u043e\u043d')
        )
    },
    [ordered]@{
        id = 'vision'
        title = U '\u0417\u0440\u0435\u043d\u0438\u0435'
        people = @($artem, $nika)
        keywords = @(
            (U '\u0437\u0440\u0435\u043d\u0438\u0435'),
            (U '\u043e\u0444\u0442\u0430\u043b\u044c\u043c'),
            (U '\u0440\u0435\u0444\u0440\u0430\u043a\u0446'),
            (U '\u0433\u043b\u0430\u0437'),
            (U '\u043d\u043e\u0441\u043e\u0441\u043b\u0451\u0437'),
            (U '\u0441\u043a\u043b\u0435\u0440')
        )
    },
    [ordered]@{
        id = 'allergies'
        title = U '\u0410\u043b\u043b\u0435\u0440\u0433\u0438\u0438'
        people = @($artem, $masha, $nika)
        keywords = @(
            (U '\u0430\u043b\u043b\u0435\u0440\u0433'),
            (U '\u0440\u0438\u043d\u0438\u0442'),
            (U '\u0410\u0421\u0418\u0422'),
            (U '\u0431\u0435\u0440\u0451\u0437'),
            (U '\u043f\u044b\u043b\u044c\u0446'),
            (U '\u044d\u043e\u0437\u0438\u043d\u043e\u0444\u0438\u043b')
        )
    },
    [ordered]@{
        id = 'nika_development'
        title = U '\u0414\u0435\u0442\u0441\u043a\u043e\u0435 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u0435 \u041d\u0438\u043a\u0438'
        people = @($nika)
        keywords = @(
            (U '\u0440\u0430\u0437\u0432\u0438\u0442\u0438'),
            (U '\u043f\u0440\u0438\u0431\u0430\u0432\u043a'),
            (U '\u0432\u0435\u0441'),
            (U '\u0433\u0440\u0443\u0434\u043d'),
            (U '\u0432\u0441\u043a\u0430\u0440\u043c\u043b\u0438\u0432'),
            (U '\u0436\u0435\u043b\u0442\u0443\u0445'),
            (U '1 \u043c\u0435\u0441\u044f\u0446'),
            (U '\u043f\u0435\u0434\u0438\u0430\u0442\u0440'),
            (U '\u0432\u0430\u043a\u0446\u0438\u043d\u0430\u0446')
        )
    }
)

$documents = [System.Collections.Generic.List[object]]::new()
$scanRoot = Join-Path $Root $MembersDirName
$memberPathPattern = '\\' + [regex]::Escape($MembersDirName) + '\\([^\\]+)\\'

if (Test-Path -LiteralPath $scanRoot) {
    Get-ChildItem -LiteralPath $scanRoot -Recurse -File -Filter '*.md' | ForEach-Object {
        $content = Read-Utf8File $_.FullName
        $meta = Parse-Frontmatter $content
        $type = if ($meta.Contains('type')) { $meta['type'] } else { 'unknown' }

        if ($type -notin @('medical_event', 'person_profile')) {
            return
        }

        $person = if ($meta.Contains('person') -and $meta['person']) {
            $meta['person']
        } elseif ($_.FullName -match $memberPathPattern) {
            $Matches[1]
        } else {
            'unknown'
        }

        $documents.Add([pscustomobject][ordered]@{
            path = Get-RelativePath $_.FullName
            title = Get-FirstHeading $content $_.BaseName
            type = $type
            person = $person
            date = if ($meta.Contains('date')) { $meta['date'] } else { $null }
            followUpDate = if ($meta.Contains('follow_up_date')) { $meta['follow_up_date'] } else { $null }
            specialty = if ($meta.Contains('specialty')) { $meta['specialty'] } else { $null }
            body = Get-BodyWithoutFrontmatter $content
        })
    }
}

$attentionZones = [System.Collections.Generic.List[object]]::new()
$records = [System.Collections.Generic.List[object]]::new()

foreach ($zone in $zones) {
    $sources = [System.Collections.Generic.List[object]]::new()
    $nextDates = [System.Collections.Generic.List[string]]::new()

    foreach ($doc in $documents) {
        if ($doc.person -notin $zone.people) {
            continue
        }

        $evidence = Get-MatchingEvidence $doc $zone
        if ($evidence.Count -eq 0) {
            continue
        }

        if ($doc.followUpDate -and $doc.followUpDate -ne 'null') {
            $nextDates.Add($doc.followUpDate)
        }

        $sources.Add([pscustomobject][ordered]@{
            title = $doc.title
            person = $doc.person
            date = $doc.date
            followUpDate = $doc.followUpDate
            specialty = $doc.specialty
            path = $doc.path
            evidence = [object[]]@($evidence)
        })
    }

    $sortedDates = @($nextDates | Where-Object { $_ } | Sort-Object)
    $nextDate = if ($sortedDates.Count -gt 0) { $sortedDates[0] } else { $null }

    $zoneObject = [pscustomobject][ordered]@{
        id = $zone.id
        title = $zone.title
        people = [string[]]@($zone.people)
        priority = Get-Priority $zone.id $sources.Count $nextDate
        nextDate = $nextDate
        sourceCount = $sources.Count
        sources = [object[]]@($sources | Sort-Object @{ Expression = { $_.date }; Descending = $true }, title)
    }
    $attentionZones.Add($zoneObject)

    $personIds = @(
        foreach ($personName in $zone.people) {
            if ($personIdsByName.ContainsKey($personName)) {
                $personIdsByName[$personName]
            }
        }
    )

    $relatedMetricIds = [System.Collections.Generic.List[string]]::new()
    if ($relatedMetricIdsByZone.ContainsKey($zone.id)) {
        foreach ($metricId in $relatedMetricIdsByZone[$zone.id]) {
            $relatedMetricIds.Add($metricId)
        }
    }

    $record = [ordered]@{
        id = $zone.id
        status = $zoneObject.priority
        topic = $zoneObject.title
        person_id = if ($personIds.Count -eq 1) { $personIds[0] } else { $null }
        person_ids = [string[]]@($personIds)
        created_at = (Get-Date).ToString('yyyy-MM-dd')
        next_date = $zoneObject.nextDate
        source_count = $zoneObject.sourceCount
        related_event_ids = [string[]]@()
        related_task_ids = [string[]]@()
        sources = $zoneObject.sources
    }
    if ($relatedMetricIds.Count -gt 0) {
        $record.related_metric_ids = [string[]]@($relatedMetricIds)
    }
    $records.Add([pscustomobject]$record)
}

$result = [ordered]@{
    schema_version = 1
    generated_at = (Get-Date).ToString('yyyy-MM-ddTHH:mm:sszzz')
    agent = [ordered]@{
        id = 'watchlist-agent'
        name = 'Watchlist Agent / ' + (U '\u0430\u0433\u0435\u043d\u0442 \u043d\u0430\u0431\u043b\u044e\u0434\u0435\u043d\u0438\u044f')
        role = U '\u0421\u043e\u0431\u0438\u0440\u0430\u0435\u0442 \u0434\u043e\u043b\u0433\u043e\u0441\u0440\u043e\u0447\u043d\u044b\u0435 \u0437\u043e\u043d\u044b \u0432\u043d\u0438\u043c\u0430\u043d\u0438\u044f \u0438\u0437 \u043f\u0440\u043e\u0444\u0438\u043b\u0435\u0439 \u0438 \u043c\u0435\u0434\u0438\u0446\u0438\u043d\u0441\u043a\u0438\u0445 \u0441\u043e\u0431\u044b\u0442\u0438\u0439 \u0431\u0435\u0437 \u043f\u043e\u0441\u0442\u0430\u043d\u043e\u0432\u043a\u0438 \u0434\u0438\u0430\u0433\u043d\u043e\u0437\u043e\u0432 \u0438 \u043d\u043e\u0432\u044b\u0445 \u0440\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0430\u0446\u0438\u0439.'
        output = '09 ' + (U '\u041d\u0430\u0431\u043b\u044e\u0434\u0435\u043d\u0438\u0435') + '/watchlist.json'
    }
    sourceScope = [string[]]@(
        ('01 ' + (U '\u0427\u043b\u0435\u043d\u044b \u0441\u0435\u043c\u044c\u0438') + '/**/*.md with type: person_profile'),
        ('01 ' + (U '\u0427\u043b\u0435\u043d\u044b \u0441\u0435\u043c\u044c\u0438') + '/**/*.md with type: medical_event')
    )
    records = [object[]]@($records)
    attention_zones = [object[]]@($attentionZones)
}

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$json = $result | ConvertTo-Json -Depth 12
Write-Utf8File $OutputPath ($json + "`r`n")

Write-Host "Updated $OutputPath"
