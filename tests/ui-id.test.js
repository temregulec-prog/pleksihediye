import test from'node:test';
import assert from'node:assert/strict';
import{uiId}from'../src/uiId.js';
function replaceCrypto(t,value){const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto');Object.defineProperty(globalThis,'crypto',{configurable:true,value});t.after(()=>{if(descriptor)Object.defineProperty(globalThis,'crypto',descriptor);else delete globalThis.crypto})}
test('HTTP UI keys work when randomUUID is unavailable and time is unchanged',t=>{
 replaceCrypto(t,{});t.mock.method(Date,'now',()=>123456789);const keys=Array.from({length:2000},uiId);assert.equal(new Set(keys).size,2000);assert.ok(keys.every(key=>typeof key==='string'&&key.length>0));
});
test('UI keys also work without a crypto object',t=>{replaceCrypto(t,undefined);assert.notEqual(uiId(),uiId())});
test('secure context uses native randomUUID when available',t=>{replaceCrypto(t,{randomUUID:()=> 'native-id'});assert.equal(uiId(),'native-id')});
