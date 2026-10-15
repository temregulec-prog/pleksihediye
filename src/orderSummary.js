// Order snapshots contain the purchase and retail prices used by the server.
export function orderSummary(orders){
 const result={orders:orders.length,pendingProfit:0,realizedProfit:0};
 for(const order of orders){
  if(order.status==='İptal edildi')continue;
  const profit=Math.round(order.items.reduce((sum,item)=>sum+((item.retailPrice??item.price)-item.price)*item.quantity,0)*100)/100;
  result[order.status==='Tamamlandı'?'realizedProfit':'pendingProfit']+=profit;
 }
 for(const key of ['pendingProfit','realizedProfit'])result[key]=Math.round(result[key]*100)/100;
 return result;
}
