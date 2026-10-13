import test from 'node:test';
import assert from 'node:assert/strict';
import { emailVerificationInput } from '../src/auth/emailSignIn.js';
test('email credential parsing pins project and rejects unrelated actions or destinations',()=>{
 const config={url:'https://abcdefghijabcdefghij.supabase.co',email:'owner@example.com'};
 assert.deepEqual(emailVerificationInput({...config,value:'123456'}),{email:'owner@example.com',token:'123456',type:'email'});
 assert.deepEqual(emailVerificationInput({...config,value:config.url+'/auth/v1/verify?token=opaque-hash&type=magiclink&redirect_to=http://localhost:3000'}),{token_hash:'opaque-hash',type:'magiclink'});
 for(const value of ['https://evil.example/auth/v1/verify?token=x&type=magiclink',config.url+'/auth/v1/verify?token=x&type=recovery',config.url+'/other?token=x&type=magiclink','bad'])assert.throws(()=>emailVerificationInput({...config,value}));
});
