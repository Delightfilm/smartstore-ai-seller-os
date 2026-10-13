export function createRecordUpdater(setRecords){
 let epoch=0;
 const publish=records=>{epoch++;setRecords(records);};
 return {publish,async load(fetchRecords){const started=++epoch;const rows=await fetchRecords();if(epoch!==started)return false;publish(rows);return true;}};
}
