import { writeFileSync } from 'node:fs'

import { Resvg } from '@resvg/resvg-js'

import benchmarks from './benchmarks.json' with { type: 'json' }

const width = 1800
const height = 1000
const left = 370
const top = 385
const cellWidth = 150
const rowHeight = 68
const scenarios = [
  ['firstInstall', 'First', 'install', 'Install from scratch with no lockfile, node_modules, or cache.'],
  ['withWarmModules', 'Warm', 'modules', 'Keep node_modules; remove the lockfile and package cache.'],
  ['withLockfile', 'With', 'lockfile', 'Keep the lockfile; remove node_modules and package cache.'],
  ['withWarmCacheAndModules', 'Warm cache', '+ modules', 'Keep node_modules and package cache; remove the lockfile.'],
  ['withWarmCache', 'Warm', 'cache', 'Keep package cache; remove node_modules and lockfile.'],
  ['withWarmCacheAndLockfile', 'Warm cache', '+ lockfile', 'Keep lockfile and package cache; remove node_modules.'],
  ['withWarmModulesAndLockfile', 'Warm modules', '+ lockfile', 'Keep node_modules and lockfile; remove package cache.'],
  ['repeatInstall', 'Repeat', 'install', 'Run again after first install, keeping its modules, lockfile, and cache.'],
  ['updatedDependencies', 'Updated', 'dependencies', 'Add extra dependencies; retain modules and rewarm the package cache.'],
]
const managers = [
  ['npm', 'npm'],
  ['pnpm12', 'pnpm 12'],
]
const stops = [
  [0, [24, 126, 117]],
  [0.35, [137, 177, 147]],
  [0.68, [229, 199, 116]],
  [1, [199, 99, 79]],
]

function colorFor (value, minimum, maximum) {
  const scale = (Math.log(value) - Math.log(minimum)) / (Math.log(maximum) - Math.log(minimum))
  const index = stops.findIndex(([position]) => position >= scale)
  const [startPosition, startColor] = stops[Math.max(0, index - 1)]
  const [endPosition, endColor] = stops[Math.max(1, index)]
  const ratio = (scale - startPosition) / (endPosition - startPosition)
  const color = startColor.map((channel, i) => Math.round(channel + ratio * (endColor[i] - channel)))
  return `rgb(${color.join(',')})`
}

function textColorFor (value, minimum, maximum) {
  const scale = (Math.log(value) - Math.log(minimum)) / (Math.log(maximum) - Math.log(minimum))
  return scale < 0.25 || scale > 0.84 ? '#ffffff' : '#202c33'
}

function formatMainTime (milliseconds) {
  return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(1)} s`
}

function escapeXml (value) {
  return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
}

function appendScenarioHeaders (parts) {
  scenarios.forEach((scenario, index) => {
    const lines = scenario.slice(1, 3)
    const columnCenter = left + index * cellWidth + cellWidth / 2
    parts.push(`<text x="${columnCenter}" y="337" text-anchor="middle" font-size="15" font-weight="600">${lines.map((line, lineIndex) => `<tspan x="${columnCenter}" dy="${lineIndex === 0 ? 0 : 20}">${escapeXml(line)}</tspan>`).join('')}</text>`)
  })
}

function appendManagerCell (parts, rowTop, columnIndex, value, minimum, maximum) {
  const cellLeft = left + columnIndex * cellWidth
  const hasValue = Number.isFinite(value) && value > 0
  const fill = hasValue ? colorFor(value, minimum, maximum) : '#e5e9e3'
  const text = hasValue ? formatMainTime(value) : 'n/a'
  const textColor = hasValue ? textColorFor(value, minimum, maximum) : '#536168'
  parts.push(`<rect x="${cellLeft + 3}" y="${rowTop + 3}" width="${cellWidth - 6}" height="${rowHeight - 6}" rx="9" fill="${fill}"/>`)
  parts.push(`<text x="${cellLeft + cellWidth / 2}" y="${rowTop + 41}" text-anchor="middle" font-size="16" font-weight="600" fill="${textColor}">${text}</text>`)
}

function appendManagerRows (parts, fixture, fixtureManagers, minimum, maximum) {
  fixtureManagers.forEach(([key, label], rowIndex) => {
    const rowTop = top + rowIndex * rowHeight
    const manager = fixture.packageManagers[key]
    parts.push(`<text x="74" y="${rowTop + 28}" font-size="18" font-weight="600">${escapeXml(label)}</text>`)
    parts.push(`<text x="74" y="${rowTop + 49}" font-size="13" fill="#647178">${escapeXml(manager.version)}</text>`)
    scenarios.forEach(([resultKey], columnIndex) => {
      appendManagerCell(parts, rowTop, columnIndex, manager.results[resultKey], minimum, maximum)
    })
  })
}

function appendScenarioDescriptions (parts) {
  parts.push('<text x="74" y="595" font-size="24" font-weight="700">Test scenarios</text>')
  parts.push(`<text x="74" y="619" font-family="Menlo, Monaco, monospace" font-size="12" fill="#536168">${escapeXml('npm install --no-fund --no-audit --ignore-scripts --cache=cache --legacy-peer-deps --registry=<benchmark-registry>')}</text>`)
  parts.push(`<text x="74" y="638" font-family="Menlo, Monaco, monospace" font-size="12" fill="#536168">${escapeXml('pnpm install --ignore-scripts --registry=<benchmark-registry>')}</text>`)
  parts.push('<text x="74" y="657" font-size="12" fill="#536168">The registry placeholder resolves to the benchmark registry; updated-dependencies adds --no-frozen-lockfile to pnpm.</text>')
  scenarios.forEach(([, firstLabel, secondLabel, description], index) => {
    const column = index % 3
    const row = Math.floor(index / 3)
    const scenarioLeft = 74 + column * 575
    const scenarioTop = 688 + row * 80
    const title = `${firstLabel} ${secondLabel}`
    parts.push(`<text x="${scenarioLeft}" y="${scenarioTop}" font-size="14" font-weight="700">${escapeXml(title)}</text>`)
    parts.push(`<text x="${scenarioLeft}" y="${scenarioTop + 22}" font-size="14" fill="#536168">${escapeXml(description)}</text>`)
  })
}

function appendCacheNote (parts) {
  parts.push('<rect x="74" y="916" width="1650" height="58" rx="8" fill="#e5e9e3"/>')
  parts.push('<rect x="74" y="916" width="4" height="58" rx="2" fill="#187e75"/>')
  parts.push('<text x="96" y="940" font-size="12" font-weight="700" letter-spacing="1" fill="#536168">CACHE NOTE</text>')
  parts.push(`<text x="96" y="960" font-size="14" fill="#202c33">${escapeXml('Warm-cache cases test reusing downloaded packages, as when CI restores a package-manager cache. The temporary cache lives at TMP/<manager-scenario>/<fixture>/cache and is cleared between scenarios.')}</text>`)
}

function createChartSvg (fixture, fixtureManagers, minimum, maximum) {
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title description">`,
    '<title id="title">JavaScript package manager benchmarks</title>',
    '<desc id="description">Benchmark timings for package manager installation scenarios. Each x-axis scenario is explained below the heatmap, followed by a note on where the temporary package cache is kept. Cell colors use a logarithmic scale and each cell shows its exact time.</desc>',
    `<defs><linearGradient id="time-scale">${stops.map(([position, color]) => `<stop offset="${position * 100}%" stop-color="rgb(${color.join(',')})"/>`).join('')}</linearGradient></defs>`,
    '<rect width="100%" height="100%" fill="#f4f3ee"/>',
    '<g font-family="Avenir Next, Helvetica Neue, sans-serif" fill="#202c33">',
    '<text x="72" y="94" font-size="44" font-weight="700">JavaScript package manager benchmarks</text>',
    `<text x="74" y="145" font-size="21" fill="#536168">${escapeXml(fixture.name)} · install time · lower is faster</text>`,
    `<text x="74" y="184" font-size="16" fill="#647178">${escapeXml(`Measured ${benchmarks.measuredAt.slice(0, 10)} · Node ${benchmarks.node} · pnpr ${benchmarks.pnpr} · ${benchmarks.network.roundTripMs} ms RTT · ${benchmarks.network.bandwidthMbps} Mbps`)}</text>`,
    '<text x="74" y="247" font-size="14" font-weight="700" letter-spacing="1.2" fill="#647178">ELAPSED TIME</text>',
    '<rect x="74" y="263" width="230" height="16" rx="4" fill="url(#time-scale)"/>',
    '<text x="74" y="301" font-size="14" fill="#536168">Faster</text>',
    '<text x="304" y="301" text-anchor="end" font-size="14" fill="#536168">Slower</text>',
  ]

  parts.push('<text x="74" y="324" font-size="14" fill="#647178">Color scale is logarithmic; values are shown in each cell.</text>')
  appendScenarioHeaders(parts)
  appendManagerRows(parts, fixture, fixtureManagers, minimum, maximum)
  appendScenarioDescriptions(parts)
  appendCacheNote(parts)
  parts.push('</g></svg>')
  return `${parts.join('\n')}\n`
}

function writeChartFiles (fixture, fixtureIndex, svg) {
  const png = new Resvg(svg, { background: '#f4f3ee' }).render().asPng()
  const fixtureSlug = fixture.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const outputName = `benchmarks-chart-${fixtureSlug}`
  writeFileSync(new URL(`./${outputName}.svg`, import.meta.url), svg)
  writeFileSync(new URL(`./${outputName}.png`, import.meta.url), png)

  if (fixtureIndex === 0) {
    writeFileSync(new URL('./benchmarks-chart.svg', import.meta.url), svg)
    writeFileSync(new URL('./benchmarks-chart.png', import.meta.url), png)
  }
}

function generateFixtureChart (fixture, fixtureIndex) {
  const fixtureManagers = managers.filter(([key]) => fixture.packageManagers?.[key]?.results)
  const mainValues = fixtureManagers.flatMap(([key]) => scenarios.map(([resultKey]) => fixture.packageManagers[key].results[resultKey]).filter((value) => Number.isFinite(value) && value > 0))
  if (!mainValues.length) {
    console.warn(`Skipping ${fixture.name}: no npm or pnpm 12 benchmark results`)
    return
  }

  const mainMinimum = Math.min(...mainValues)
  const mainMaximum = Math.max(...mainValues)
  const svg = createChartSvg(fixture, fixtureManagers, mainMinimum, mainMaximum)
  writeChartFiles(fixture, fixtureIndex, svg)
}

benchmarks.fixtures.forEach(generateFixtureChart)