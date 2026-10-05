import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pitHistory, formatMetric } from '../../frontend/src/services/metric-display.js';

test('PIT history keeps calendar gaps and sheltered-only years, independent of newer SPM data', () => {
  const history = pitHistory([
    { metric_type: 'pit_count', year: 2020, value: 10 },
    { metric_type: 'pit_sheltered', year: 2021, value: 0 },
    { metric_type: 'pit_count', year: 2023, value: 20 },
    { metric_type: 'spm_hmis_count', year: 2024, value: 1000 },
  ]);
  assert.deepEqual(history.map(m => m.year), [2020, 2021, 2022, 2023]);
  assert.deepEqual(history.map(m => m.homeless), [10, null, null, 20]);
  assert.equal(history[1].sheltered, 0);
  assert.equal(history[1].unsheltered, null);
  assert.deepEqual(pitHistory([]), []);
});

test('metric display distinguishes missing, reported zero, percentages, and durations', () => {
  assert.equal(formatMetric(undefined), 'Not available');
  assert.equal(formatMetric({ value: 0, unit: 'count' }), '0');
  assert.equal(formatMetric({ value: 12.5, unit: 'percent' }), '12.5%');
  assert.equal(formatMetric({ value: 62.2, unit: 'days' }), '62.2 days');
});
