'use strict';
// DEMOS12 S4: synthetic DSAR deadline/dispatch acceptance examples only.
// No mailbox, production data, or legal deadline engine is accessed.
const {test} = require('node:test');
const assert = require('node:assert/strict');

function calendarMonthsClamped(isoDate, months) {
  assert.match(isoDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Number.isInteger(months) && months >= 0 && months <= 3);
  const [year, month, day] = isoDate.split('-').map(Number);
  const input = new Date(Date.UTC(year, month - 1, day));
  assert.equal(input.toISOString().slice(0, 10), isoDate, 'valid calendar date');
  const first = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(day, lastDay));
  return first.toISOString().slice(0, 10);
}

function syntheticS4({received, extensionNotified, extensionReason, responseSent, delivered}) {
  const ordinary = calendarMonthsClamped(received, 1);
  // Reject impossible notification dates instead of silently accepting an ISO-like string.
  if (extensionNotified != null) calendarMonthsClamped(extensionNotified, 0);
  const hasReason = typeof extensionReason === 'string' && extensionReason.trim().length > 0;
  const extensionAccepted = Boolean(hasReason && extensionNotified && extensionNotified >= received && extensionNotified <= ordinary);
  return {
    ordinary,
    deadline: extensionAccepted ? calendarMonthsClamped(received, 3) : ordinary,
    extensionAccepted,
    // In this synthetic contract, untyped strings/numbers are not evidence of delivery.
    deliveryConfirmed: responseSent === true && delivered === true,
  };
}

test('S4 calendar-month examples: short February and leap year', () => {
  assert.equal(syntheticS4({received:'2027-01-31'}).ordinary, '2027-02-28');
  assert.equal(syntheticS4({received:'2028-01-31'}).ordinary, '2028-02-29');
  assert.equal(syntheticS4({received:'2028-02-29'}).ordinary, '2028-03-29');
});

test('S4 late or unreasoned extension is not treated as approved', () => {
  const timely = syntheticS4({received:'2027-01-31',extensionNotified:'2027-02-28',extensionReason:'synthetic complexity'});
  assert.equal(timely.extensionAccepted, true);
  assert.equal(timely.deadline, '2027-04-30');
  for (const invalid of [
    {extensionNotified:'2027-03-01',extensionReason:'synthetic complexity'},
    {extensionNotified:'2027-02-20',extensionReason:''},
    {extensionNotified:'2027-02-20',extensionReason:'   '},
    {extensionNotified:'2027-01-30',extensionReason:'synthetic complexity'},
  ]) {
    const result = syntheticS4({received:'2027-01-31',...invalid});
    assert.equal(result.extensionAccepted,false);
    assert.equal(result.deadline,'2027-02-28');
  }
});

test('S4 malformed extension dates cannot silently approve a deadline extension', () => {
  for (const extensionNotified of ['2027-02-00', '2027-02-30', '2027-2-1', 'not-a-date']) {
    assert.throws(() => syntheticS4({received:'2027-01-31',extensionNotified,extensionReason:'synthetic complexity'}));
  }
});

test('S4 sent but undelivered is never reported as delivered', () => {
  assert.equal(syntheticS4({received:'2027-01-31',responseSent:true,delivered:false}).deliveryConfirmed,false);
  assert.equal(syntheticS4({received:'2027-01-31',responseSent:true,delivered:true}).deliveryConfirmed,true);
});

test('S4 malformed dates are rejected before computing deadlines', () => {
  for (const received of ['2027/01/31', '2027-2-3', '2027-02-30', 'not-a-date']) {
    assert.throws(() => syntheticS4({received}), 'no deadline for malformed dates');
  }
});


test('S4 confirmation requires actual boolean sent and delivered flags', () => {
  const sample = {received:'2027-01-31'};
  assert.equal(syntheticS4({...sample,responseSent:false,delivered:true}).deliveryConfirmed,false);
  assert.equal(syntheticS4({...sample,responseSent:'false',delivered:true}).deliveryConfirmed,false);
  assert.equal(syntheticS4({...sample,responseSent:true,delivered:'false'}).deliveryConfirmed,false);
  assert.equal(syntheticS4({...sample,responseSent:true,delivered:1}).deliveryConfirmed,false);
  assert.equal(syntheticS4({...sample,responseSent:true,delivered:true}).deliveryConfirmed,true);
});
