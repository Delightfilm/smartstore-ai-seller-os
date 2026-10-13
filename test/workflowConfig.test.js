import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWorkflowConfig } from '../src/data/workflowConfig.js';

const cloud={MODE:'production',VITE_WORKFLOW_MODE:'cloud',VITE_SUPABASE_URL:'https://abcdefghijklmnopqrst.supabase.co',VITE_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test_fixture_only'};

test('local storage requires explicit development mode and cannot be enabled in production',()=>{
  assert.deepEqual(resolveWorkflowConfig({MODE:'development',VITE_WORKFLOW_MODE:'local'}),{mode:'local'});
  for(const env of [{},{MODE:'development'},{MODE:'production',VITE_WORKFLOW_MODE:'local'},{MODE:'development',PROD:true,VITE_WORKFLOW_MODE:'local'},{MODE:'staging',VITE_WORKFLOW_MODE:'local'},{MODE:'development',VITE_WORKFLOW_MODE:'typo'}]) {
    assert.throws(()=>resolveWorkflowConfig(env));
  }
});

test('cloud configuration returns only intended public values and never silently falls back',()=>{
  assert.deepEqual(resolveWorkflowConfig({...cloud,SUPABASE_SECRET_KEY:'server-only-fixture',UNRELATED:'ignored'}),{mode:'cloud',url:cloud.VITE_SUPABASE_URL,publishableKey:cloud.VITE_SUPABASE_PUBLISHABLE_KEY});
  for(const key of ['VITE_SUPABASE_URL','VITE_SUPABASE_PUBLISHABLE_KEY']) {
    assert.throws(()=>resolveWorkflowConfig({...cloud,[key]:''}));
  }
});

test('rejects credentials in client config without reflecting their values in errors',()=>{
  for(const key of ['VITE_SUPABASE_SECRET_KEY','VITE_SUPABASE_SERVICE_ROLE_KEY']) {
    assert.throws(()=>resolveWorkflowConfig({...cloud,[key]:'do-not-print-this'}),error=>!error.message.includes('do-not-print-this'));
  }
  for(const value of ['sb_secret_do-not-print-this','eyJhbGciOiJIUzI1NiJ9.payload.signature','not-a-key']) {
    assert.throws(()=>resolveWorkflowConfig({...cloud,VITE_SUPABASE_PUBLISHABLE_KEY:value}),error=>!error.message.includes(value));
  }
});

test('cloud endpoint cannot redirect credentials to arbitrary hosts or URL components',()=>{
  for(const url of ['http://abcdefghijklmnopqrst.supabase.co','https://evil.example','https://abcdefghijklmnopqrst.supabase.co.evil.example','https://user:password@abcdefghijklmnopqrst.supabase.co','https://abcdefghijklmnopqrst.supabase.co/path','https://abcdefghijklmnopqrst.supabase.co?key=secret','https://abcdefghijklmnopqrst.supabase.co#hash','https://abcdefghijklmnopqrst.supabase.co:444']) {
    assert.throws(()=>resolveWorkflowConfig({...cloud,VITE_SUPABASE_URL:url}));
  }
  assert.equal(resolveWorkflowConfig({...cloud,VITE_SUPABASE_URL:cloud.VITE_SUPABASE_URL+'/'}).url,cloud.VITE_SUPABASE_URL);
});
