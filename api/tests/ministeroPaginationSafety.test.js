'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { inspectMinisteroPage, MAX_OFFICIAL_PAGES } =
  require('../services/ministeroPaginationSafety');

const item = n => ({ id: n, titolo: 'Official test ' + n });
const inspect = (payload, currentPage=0, priorItems=0, expectedTotal=null, pageSize=2) =>
  inspectMinisteroPage(payload, { currentPage, priorItems, expectedTotal, pageSize });

test('complete pagination with zero-based first page and official totals', () => {
  const a = inspect({ content:[item(1), item(2)],
    infoPaginazione:{ number:0, totalElements:3, totalPages:2, last:false } });
  assert.equal(a.hasMore,true);
  assert.equal(a.expectedTotal,3);
  const b = inspect({ content:[item(3)],
    infoPaginazione:{ number:1, totalElements:3, totalPages:2, last:true } },1,2,a.expectedTotal);
  assert.equal(b.hasMore,false);
  assert.equal(b.items.length,1);
});

test('reject empty or malformed official feed before any write', () => {
  for (const payload of [null,{}, {content:null}, {content:{}},
      {content:[]}, {data:[]}, {content:[null]}, {content:[1]},
      {content:[item(1),item(2),item(3)]}]) {
    assert.throws(() => inspect(payload), /MINISTERO_PAGINATION/);
  }
});

test('reject truncation even when API incorrectly marks page as final', () => {
  assert.throws(() => inspect({ content:[item(1)],
    infoPaginazione:{ totalElements:3,totalPages:1,last:true } }),
    /MINISTERO_PAGINATION_TRUNCATED/);
  assert.throws(() => inspect({ content:[item(1)],
    infoPaginazione:{ totalElements:3,totalPages:2,last:true } }),
    /MINISTERO_PAGINATION_EARLY_END/);
});

test('reject missing middle page and changing totals across requests', () => {
  assert.throws(() => inspect({content:[],
    infoPaginazione:{ totalElements:4,totalPages:3,last:false }},1,2,4),
    /MINISTERO_PAGINATION_EARLY_EMPTY_PAGE/);
  assert.throws(() => inspect({content:[item(3)],
    infoPaginazione:{ totalElements:9,totalPages:2,last:true }},1,2,4),
    /MINISTERO_PAGINATION_TOTAL_CHANGED/);
});

test('reject excessive pages instead of silently accepting partial data', () => {
  assert.equal(MAX_OFFICIAL_PAGES,100);
  assert.throws(() => inspect({ content:[item(1),item(2)],
    infoPaginazione:{ totalElements:201, totalPages:101, last:false }},99,198,201),
    /MINISTERO_PAGINATION_LIMIT_REACHED/);
});

test('validate metadata flag and prevent over-reported number of records', () => {
  assert.throws(() => inspect({ content:[item(1),item(2)],
    infoPaginazione:{ totalElements:1,totalPages:1,last:true } }),
    /MINISTERO_PAGINATION_TOO_MANY_ITEMS/);
  assert.throws(() => inspect({ content:[item(1)],
    infoPaginazione:{totalPages:1,last:false} }),
    /MINISTERO_PAGINATION_LAST_CONFLICT/);
  assert.throws(() => inspect({ content:[item(1)],
    infoPaginazione:{ totalPages:'not a number' } }),
    /MINISTERO_PAGINATION_PAGES_INVALID/);
});

test('unpaginated exact page size requests another page, short page terminates', () => {
  assert.equal(inspect([item(1),item(2)]).hasMore,true);
  assert.equal(inspect([item(3)],1,2).hasMore,false);
});

test('Ministero sync actually uses safety validator before accepting data', () => {
  const src=fs.readFileSync(path.join(__dirname,'../services/ministeroSync.js'),'utf8');
  const job=fs.readFileSync(path.join(__dirname,'../jobs/ministeroSyncJob.js'),'utf8');
  assert.match(src, /inspectMinisteroPage\(payload,/);
  assert.match(src, /if \(!inspected\.hasMore\) break/);
  assert.match(job, /if \(errors === 0\)/);
});
