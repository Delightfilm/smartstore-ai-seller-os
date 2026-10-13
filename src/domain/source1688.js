export function supportedOfferUrl(input) {
  const invalid=()=>Object.assign(new Error('INVALID_1688_URL'),{code:'INVALID_1688_URL'});
  let url;
  try { url = new URL(String(input || '').trim()); } catch { throw invalid(); }
  const match = url.pathname.match(/^\/offer\/(\d{1,32})\.html$/);
  if (url.protocol !== 'https:' || url.hostname !== 'detail.1688.com' || url.port || url.username || url.password || !match) throw invalid();
  return { offerId: match[1], canonicalUrl: `https://detail.1688.com/offer/${match[1]}.html` };
}
