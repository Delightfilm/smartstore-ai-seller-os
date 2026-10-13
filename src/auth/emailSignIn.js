// Authentication always goes to the configured project, never to a supplied URL.
export function emailVerificationInput({url,email,value}){
 const trimmed=String(value||'').trim();
 if(/^\d{6,10}$/.test(trimmed))return {email,token:trimmed,type:'email'};
 let link;try{link=new URL(trimmed);}catch{throw new Error('메일의 인증번호 또는 로그인 링크 주소를 입력하세요.');}
 const project=new URL(url);
 if(link.protocol!=='https:'||link.origin!==project.origin||link.pathname!=='/auth/v1/verify'||link.username||link.password)throw new Error('이 프로젝트에서 보낸 로그인 링크만 사용할 수 있습니다.');
 const token_hash=link.searchParams.get('token_hash')||link.searchParams.get('token');
 const type=link.searchParams.get('type');
 if(!token_hash||token_hash.length>2048||!['magiclink','email'].includes(type))throw new Error('이메일 로그인 링크의 형식을 확인하세요.');
 return {token_hash,type};
}
