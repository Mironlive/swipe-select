import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyRangeTransition, sameKeys } from '../internal/range.ts';

const keys = Array.from({ length: 20 }, (_, i) => `k${i}`);
const getKeyByIndex = (i: number) => keys[i] ?? null;
const sorted = (s: Set<string>) => [...s].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));

/** Прогоняет жест: старт на anchor, затем палец проходит по индексам path. */
const drag = (initial: string[], anchor: number, path: number[], isSelectableIndex?: (i: number) => boolean) => {
  const start = new Set(initial);
  const shouldSelect = !start.has(keys[anchor]!);
  let current: Set<string> = start;
  let previousRange: { start: number; end: number } | null = null;
  for (const index of [anchor, ...path]) {
    const nextRange = { start: Math.min(anchor, index), end: Math.max(anchor, index) };
    current = applyRangeTransition({
      initial: start,
      current,
      previousRange,
      nextRange,
      shouldSelect,
      getKeyByIndex,
      isSelectableIndex,
    }).next;
    previousRange = nextRange;
  }
  return sorted(current);
};

test('выделяет диапазон вниз', () => {
  assert.deepEqual(drag([], 2, [3, 4, 5]), ['k2', 'k3', 'k4', 'k5']);
});

test('выделяет диапазон вверх', () => {
  assert.deepEqual(drag([], 5, [4, 3]), ['k3', 'k4', 'k5']);
});

test('движение назад возвращает исходное состояние', () => {
  assert.deepEqual(drag(['k4'], 1, [2, 3, 4, 5, 6, 3]), ['k1', 'k2', 'k3', 'k4']);
  assert.deepEqual(drag(['k4'], 1, [6, 1]), ['k1', 'k4']);
});

test('переход через якорь в другую сторону', () => {
  assert.deepEqual(drag([], 5, [7, 3]), ['k3', 'k4', 'k5']);
});

test('старт на выбранном — снимает выбор', () => {
  assert.deepEqual(drag(['k1', 'k2', 'k3', 'k9'], 2, [3, 4]), ['k1', 'k9']);
});

test('снятие выбора с возвратом восстанавливает исходное', () => {
  assert.deepEqual(drag(['k1', 'k2', 'k3', 'k4'], 1, [4, 2]), ['k3', 'k4']);
});

test('прыжок пальца через несколько элементов', () => {
  assert.deepEqual(drag([], 0, [10]), keys.slice(0, 11).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))));
});

test('невыбираемые элементы пропускаются', () => {
  assert.deepEqual(
    drag([], 0, [5], (i) => i !== 3),
    ['k0', 'k1', 'k2', 'k4', 'k5'],
  );
});

test('выбор вне диапазона не трогается', () => {
  assert.deepEqual(drag(['k15', 'k16'], 2, [4]), ['k2', 'k3', 'k4', 'k15', 'k16']);
});

test('changed=false, если ничего не поменялось', () => {
  const r = applyRangeTransition({
    initial: new Set(['k1']),
    current: new Set(['k1']),
    previousRange: null,
    nextRange: { start: 1, end: 1 },
    shouldSelect: true,
    getKeyByIndex,
  });
  assert.equal(r.changed, false);
});

test('sameKeys', () => {
  assert.equal(sameKeys(new Set(['a', 'b']), ['b', 'a']), true);
  assert.equal(sameKeys(new Set(['a', 'b']), ['a']), false);
  assert.equal(sameKeys(new Set(['a']), ['a', 'c']), false);
});
