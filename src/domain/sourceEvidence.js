import { supportedOfferUrl } from './source1688.js';
export const sourceNumber = value => {
  if (value === '' || value == null || typeof value === 'boolean' || !['number','string'].includes(typeof value)) return null;
  const n=Number(value);return Number.isFinite(n)&&n>=0?n:null;
};
export function normalizeEvidence(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  let sourceUrl=null;try { sourceUrl=supportedOfferUrl(raw.sourceUrl).canonicalUrl; } catch {}
  return {value:raw.value,unit:typeof raw.unit==='string'?raw.unit:null,originalValue:raw.value,originalUnit:raw.unit,
    sourceUrl,observedAt:raw.observedAt,kind:raw.kind,confirmed:raw.confirmed===true,semantic:raw.semantic,
    scope:raw.scope && typeof raw.scope==='object'?{skuId:raw.scope.skuId,quantity:raw.scope.quantity,level:raw.scope.level}:null};
}
export function evidenceMatches(evidence,{offerId,skuId,now,offerAllowed=false}) {
  if (!evidence || !evidence.confirmed || !['observed','quoted'].includes(evidence.kind)) return false;
  let source;try { source=supportedOfferUrl(evidence.sourceUrl); } catch { return false; }
  const age=now-Date.parse(evidence.observedAt);
  const scope=evidence.scope;
  return source.offerId===offerId && Number.isFinite(age)&&age>=-60000&&age<=7*86400000&&scope?.quantity===1&&
    ((scope.level==='sku'&&typeof skuId==='string'&&scope.skuId===skuId)||(offerAllowed&&scope.level==='offer'));
}
