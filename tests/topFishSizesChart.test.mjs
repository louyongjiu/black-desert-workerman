import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import test from 'node:test'
import { translate } from '../src/i18n/index.mjs'

const source = readFileSync(new URL('../src/components/TopFishSizesChart.vue', import.meta.url), 'utf8')
  .split('<script>')[1].split('</script>')[0]
  .replace(/^import .*$/gm, '')
  .replace('export default', 'module.exports =')
const context = {
  module: { exports: {} }, VChart: {}, use() {}, DataZoomInsideComponent: {},
  unref: value => value,
}
vm.runInNewContext(source, context)
const options = context.module.exports
const chart = options.computed.chartOption.call({
  survivalData: [[130, 42]], personalSurvivalData: [[130, 7]],
  theoreticalSurvivalData: [[130, 5.25]], fullYMax: 42,
  zoomedYMax: null, logarithmicYAxis: true, chartTheme: null,
  $t: source => translate(source, 'en'),
})

test('each leaderboard tooltip uses its selected point count', () => {
  for (const [seriesIndex, series] of chart.series.entries()) {
    const point = series.data[0]
    const label = chart.tooltip.formatter([{
      axisValue: point[0], seriesIndex, seriesName: series.name, data: point, marker: '',
    }])
    const unit = series.name === 'model' ? 'expected updates' : 'updates'
    assert.equal(label, `size ≥ 130.000<br> ${series.name}: ${point[1].toLocaleString(undefined, { maximumFractionDigits: 2 })} ${unit}`)
  }
})

test('renaming model does not change tooltip count or expected-count units', () => {
  const label = chart.tooltip.formatter([{
    axisValue: 130, seriesIndex: chart.series.findIndex(series => series.name === 'model'),
    seriesName: 'renamed model', data: [130, 5.25], marker: '',
  }])
  assert.ok(label.endsWith(`renamed model: ${(5.25).toLocaleString()} expected updates`))
})

test('only observed series use steps', () => {
  for (const series of chart.series)
    assert.equal(series.step, series.name === 'model' ? false : 'start')
})

test('localized legend, axis and tooltip preserve each series count and role', () => {
  for (const language of ['tw', 'ru', 'ko', 'jp']) {
    const localized = options.computed.chartOption.call({
      survivalData: [[130, 42]], personalSurvivalData: [[130, 7]],
      theoreticalSurvivalData: [[130, 5.25]], fullYMax: 42,
      zoomedYMax: null, logarithmicYAxis: true, chartTheme: null,
      $t: source => translate(source, language),
    })
    assert.equal(localized.yAxis.name, translate('updates', language))
    assert.deepEqual(Array.from(localized.legend.data), Array.from(localized.series, s => s.name))
    for (const [seriesIndex, series] of localized.series.entries()) {
      const unit = translate(seriesIndex === 0 ? 'expected updates' : 'updates', language)
      const tooltip = localized.tooltip.formatter([{
        axisValue: 130, seriesIndex, seriesName: series.name, data: series.data[0], marker: '',
      }])
      assert.ok(tooltip.endsWith(unit))
      assert.ok(tooltip.includes(series.data[0][1].toLocaleString(undefined, { maximumFractionDigits: 2 })))
      assert.equal(series.step, seriesIndex === 0 ? false : 'start')
    }
  }
})
