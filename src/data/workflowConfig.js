// Return only the public configuration. Never include supplied values in errors.
export function resolveWorkflowConfig(env={}) {
  if(!env || typeof env!=='object' || Array.isArray(env))throw new Error('설정 객체가 필요합니다.');
  if(Object.keys(env).some(key=>/^VITE_/i.test(key)&&/SECRET|SERVICE_ROLE/i.test(key))) {
    throw new Error('비밀키는 VITE_ 환경변수에 넣을 수 없습니다. 노출된 키가 있다면 교체하세요.');
  }
  const mode=env.VITE_WORKFLOW_MODE;
  if(mode==='local') {
    if(env.MODE!=='development' || env.PROD===true || env.PROD==='true')throw new Error('로컬 저장은 개발 환경에서만 사용할 수 있습니다.');
    return {mode};
  }
  if(mode!=='cloud')throw new Error('저장 모드를 local 또는 cloud로 명시하세요.');
  let url;
  try {url=new URL(env.VITE_SUPABASE_URL);} catch {throw new Error('Supabase 프로젝트 HTTPS 주소가 필요합니다.');}
  if(url.protocol!=='https:' || !/^[a-z0-9]{20}\.supabase\.co$/.test(url.hostname) || url.username || url.password || url.port || url.pathname!=='/' || url.search || url.hash) {
    throw new Error('Supabase 프로젝트의 기본 HTTPS 주소만 사용할 수 있습니다.');
  }
  const publishableKey=env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if(typeof publishableKey!=='string' || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    throw new Error('클라이언트에는 Supabase publishable 키만 사용할 수 있습니다.');
  }
  return {mode,url:url.origin,publishableKey};
}
