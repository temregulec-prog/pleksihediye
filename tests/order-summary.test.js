import test from'node:test';
import assert from'node:assert/strict';
import{orderSummary}from'../src/orderSummary.js';
test('profit comes from order snapshots, excludes cancellation, and separates completed orders',()=>{
 const line={price:240,retailPrice:300,quantity:3};
 assert.deepEqual(orderSummary([{status:'İncelemede',items:[line]},{status:'Tamamlandı',items:[{price:84.99,retailPrice:99.99,quantity:2}]},{status:'İptal edildi',items:[line]}]),{orders:3,pendingProfit:180,realizedProfit:30});
 assert.deepEqual(orderSummary([]),{orders:0,pendingProfit:0,realizedProfit:0});
});
