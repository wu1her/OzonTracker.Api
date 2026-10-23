import test from 'node:test';
import assert from 'node:assert/strict';
import {periodBuckets,metricValue,precedingPeriod,valueSummary,addDays} from '../ClientApp/src/chartData.ts';
const point=(id,day,price=100,soldUnits=10,stocks=5)=>({id,capturedAt:`${day}T12:00:00Z`,price,ozonCardPrice:price*.94,stocks,soldUnits,rating:4.5,reviewCount:20});
test('daily grouping uses the last observed snapshot and leaves missing days null',()=>{
 const rows=periodBuckets([point(1,'2026-10-20',100),point(3,'2026-10-20',80),point(2,'2026-10-20',90),point(4,'2026-10-22',70)],'2026-10-20','2026-10-22',false);
 assert.deepEqual(rows.map(b=>metricValue(b,'price')),[80,null,70]);
});
test('weekly stock is the closing balance, not a sum of daily balances',()=>{
 const rows=periodBuckets([point(1,'2026-10-19',100,10,40),point(2,'2026-10-20',100,13,37),point(3,'2026-10-25',100,20,30)],'2026-10-19','2026-10-25',true);
 assert.equal(rows.length,1);assert.equal(metricValue(rows[0],'stocks'),30);
});
test('sales use differences of cumulative counters, not cumulative totals',()=>{
 const rows=periodBuckets([point(1,'2026-10-18',100,100),point(2,'2026-10-19',100,103),point(3,'2026-10-25',100,125)],'2026-10-19','2026-10-25',true);
 assert.equal(metricValue(rows[0],'sales'),25);
});
test('sales without an opening baseline or after a reset are unknown',()=>{
 assert.equal(metricValue(periodBuckets([point(1,'2026-10-20',100,100)],'2026-10-20','2026-10-20',false)[0],'sales'),null);
 const rows=periodBuckets([point(1,'2026-10-19',100,100),point(2,'2026-10-20',100,10)],'2026-10-20','2026-10-20',false);
 assert.equal(metricValue(rows[0],'sales'),null);
});
test('zero stock remains zero; missing data is not converted to zero',()=>{
 const rows=periodBuckets([point(1,'2026-10-20',100,10,0)],'2026-10-20','2026-10-21',false);
 assert.equal(metricValue(rows[0],'stocks'),0);assert.equal(metricValue(rows[1],'stocks'),null);
});
test('comparison selects a preceding window of equal length across year and leap day',()=>{
 assert.deepEqual(precedingPeriod('2026-01-01','2026-01-07'),{from:'2025-12-25',to:'2025-12-31'});
 assert.equal(addDays('2024-03-01',-1),'2024-02-29');
});
test('invalid or excessive custom ranges do not throw or allocate a huge chart',()=>{
 assert.deepEqual(periodBuckets([],'','2026-10-23',false),[]);
 assert.deepEqual(periodBuckets([],'2026-10-23','2026-10-01',false),[]);
 assert.deepEqual(periodBuckets([],'2020-01-01','2026-10-23',false),[]);
 assert.doesNotThrow(()=>precedingPeriod('','2026-10-23'));
});
test('summary excludes gaps and does not invent a percentage from zero or one sample',()=>{
 assert.deepEqual(valueSummary([100,null,80]),{min:80,max:100,change:-20});
 assert.equal(valueSummary([0,30]).change,null);assert.equal(valueSummary([50]).change,null);
});
