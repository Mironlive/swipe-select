import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findEntryAt, upsertEntry, type LayoutEntry } from '../internal/hitTest.ts';

const row = (index: number, top: number, height: number): LayoutEntry => ({
  index,
  key: `k${index}`,
  mainStart: top,
  mainEnd: top + height,
  crossStart: 0,
  crossEnd: 400,
});

// Список: разная высота строк.
const list = [row(0, 0, 80), row(1, 80, 120), row(2, 200, 60), row(3, 260, 200)];

test('список: попадание по главной оси', () => {
  assert.equal(findEntryAt(list, 10, 50)?.index, 0);
  assert.equal(findEntryAt(list, 150, 50)?.index, 1);
  assert.equal(findEntryAt(list, 230, 50)?.index, 2);
  assert.equal(findEntryAt(list, 459, 50)?.index, 3);
});

test('список: за пределами — ближайший край', () => {
  assert.equal(findEntryAt(list, -30, 50)?.index, 0);
  assert.equal(findEntryAt(list, 900, 50)?.index, 3);
});

test('пустой реестр', () => {
  assert.equal(findEntryAt([], 10, 10), null);
});

// Сетка 3x3, ячейки 100x100 с зазором 10.
const grid: LayoutEntry[] = [];
for (let i = 0; i < 9; i += 1) {
  const r = Math.floor(i / 3);
  const c = i % 3;
  grid.push({
    index: i,
    key: `g${i}`,
    mainStart: r * 110,
    mainEnd: r * 110 + 100,
    crossStart: c * 110,
    crossEnd: c * 110 + 100,
  });
}

test('сетка: попадание в ячейку', () => {
  assert.equal(findEntryAt(grid, 50, 50)?.index, 0);
  assert.equal(findEntryAt(grid, 50, 250)?.index, 2);
  assert.equal(findEntryAt(grid, 160, 160)?.index, 4);
  assert.equal(findEntryAt(grid, 270, 50)?.index, 6);
});

test('сетка: зазор между колонками — ближайшая ячейка строки', () => {
  const hit = findEntryAt(grid, 50, 104);
  assert.ok(hit && (hit.index === 0 || hit.index === 1));
});

test('сетка: зазор между строками — соседняя строка, та же колонка', () => {
  const hit = findEntryAt(grid, 105, 150);
  assert.ok(hit && (hit.index === 1 || hit.index === 4), `got ${hit?.index}`);
});

test('реестр с дырами (виртуализация)', () => {
  const sparse = [row(0, 0, 80), row(1, 80, 120), row(40, 4000, 80), row(41, 4080, 80)];
  assert.equal(findEntryAt(sparse, 4100, 10)?.index, 41);
  assert.equal(findEntryAt(sparse, 100, 10)?.index, 1);
});

test('upsertEntry держит сортировку и не копирует без изменений', () => {
  let entries: LayoutEntry[] = [];
  entries = upsertEntry(entries, row(2, 200, 60));
  entries = upsertEntry(entries, row(0, 0, 80));
  entries = upsertEntry(entries, row(1, 80, 120));
  assert.deepEqual(
    entries.map((e) => e.index),
    [0, 1, 2],
  );
  const same = upsertEntry(entries, row(1, 80, 120));
  assert.equal(same, entries);
  const moved = upsertEntry(entries, row(1, 80, 130));
  assert.notEqual(moved, entries);
  assert.equal(moved[1]!.mainEnd, 210);
});
