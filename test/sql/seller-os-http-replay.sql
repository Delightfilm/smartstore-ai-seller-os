BEGIN;
SELECT set_config('seller_os_test.actor',(SELECT user_id::text FROM public.seller_os_workspace_members ORDER BY user_id LIMIT 1),true);
INSERT INTO public.seller_os_workspaces(id,name) VALUES ('00000000-0000-4000-8000-000000000031','HTTP rollback fixture');
INSERT INTO public.seller_os_workspace_members(workspace_id,user_id,role) VALUES ('00000000-0000-4000-8000-000000000031',current_setting('seller_os_test.actor')::uuid,'owner');
SET LOCAL ROLE service_role;
DO $$ DECLARE first jsonb; replay jsonb; actor uuid:=current_setting('seller_os_test.actor')::uuid;
BEGIN
 first:=public.seller_os_commit_candidate('00000000-0000-4000-8000-000000000031',actor,'00000000-0000-4000-8000-000000000032','999999990031',0,'{"product":{"offerId":"999999990031"}}','{"action":"import","id":"999999990031"}');
 replay:=public.seller_os_replay_request('00000000-0000-4000-8000-000000000031',actor,'00000000-0000-4000-8000-000000000032','{"action":"import","id":"999999990031"}');
 IF first<>replay THEN RAISE EXCEPTION 'HTTP response replay mismatch'; END IF;
 -- Server revalidation may generate a different reviewedAt timestamp; raw request identity wins.
 replay:=public.seller_os_commit_candidate('00000000-0000-4000-8000-000000000031',actor,'00000000-0000-4000-8000-000000000032','999999990031',0,'{"terms":{"different_revalidation":true}}','{"action":"import","id":"999999990031"}');
 IF first<>replay THEN RAISE EXCEPTION 'Revalidation changed replay'; END IF;
 BEGIN
  PERFORM public.seller_os_replay_request('00000000-0000-4000-8000-000000000031',actor,'00000000-0000-4000-8000-000000000032','{"action":"import","id":"other"}');
  RAISE EXCEPTION 'Mismatched raw request accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM public.seller_os_commit_candidate('00000000-0000-4000-8000-000000000031',actor,'00000000-0000-4000-8000-000000000033','999999990031',0,'{"terms":{}}','{"action":"update"}');
  RAISE EXCEPTION 'Competing stale revision accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 IF (SELECT count(*) FROM public.seller_os_candidate_events WHERE workspace_id='00000000-0000-4000-8000-000000000031')<>1 THEN RAISE EXCEPTION 'duplicate event'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM public.seller_os_replay_request('00000000-0000-4000-8000-000000000031',auth.uid(),'00000000-0000-4000-8000-000000000032','{}');
  RAISE EXCEPTION 'Direct client replay allowed';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: raw HTTP replay, mismatch, stale revision, direct client denial' AS result;
