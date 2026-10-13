-- Run through a privileged SQL connection; all fixture writes roll back.
-- Catches missing RLS, cross-workspace reads, self-enrolment and client writes.
BEGIN;
DO $$
BEGIN
  IF to_regclass('public.seller_os_workspaces') IS NULL THEN
    RAISE EXCEPTION 'Seller OS workspace table missing';
  END IF;
END $$;
SELECT set_config('seller_os_test.actor', (SELECT id::text FROM auth.users ORDER BY id LIMIT 1), true);
INSERT INTO public.seller_os_workspaces(id,name) VALUES
 ('00000000-0000-4000-8000-000000000001','rollback fixture A'),
 ('00000000-0000-4000-8000-000000000002','rollback fixture B');
INSERT INTO public.seller_os_workspace_members(workspace_id,user_id,role)
VALUES ('00000000-0000-4000-8000-000000000001',current_setting('seller_os_test.actor')::uuid,'owner');
SET LOCAL ROLE service_role;
DO $$
DECLARE result jsonb; again jsonb; actor uuid := current_setting('seller_os_test.actor')::uuid;
BEGIN
 result := public.seller_os_save_candidate('00000000-0000-4000-8000-000000000001',actor,
  '00000000-0000-4000-8000-000000000003','999999990001',0,
  '{"product":{"offerId":"999999990001"},"review":{"status":"HOLD"},"terms":{},"listing":{}}');
 IF result->>'revision' <> '1' OR result#>>'{publication,status}' <> 'NOT_PUBLISHED' THEN
  RAISE EXCEPTION 'create contract failed'; END IF;
 again := public.seller_os_save_candidate('00000000-0000-4000-8000-000000000001',actor,
  '00000000-0000-4000-8000-000000000003','999999990001',0,
  '{"product":{"offerId":"999999990001"},"review":{"status":"HOLD"},"terms":{},"listing":{}}');
 IF result <> again THEN RAISE EXCEPTION 'idempotent retry changed result'; END IF;
 BEGIN
  PERFORM public.seller_os_save_candidate('00000000-0000-4000-8000-000000000001',actor,
   '00000000-0000-4000-8000-000000000003','999999990001',0,'{"product":{"offerId":"999999990001"},"terms":{"changed":true}}');
  RAISE EXCEPTION 'request reuse accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM public.seller_os_save_candidate('00000000-0000-4000-8000-000000000002',actor,
   '00000000-0000-4000-8000-000000000004','999999990001',0,'{"product":{"offerId":"999999990001"}}');
  RAISE EXCEPTION 'nonmember write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.seller_os_save_candidate('00000000-0000-4000-8000-000000000001',actor,
   '00000000-0000-4000-8000-000000000005','999999990001',9,'{"terms":{}}');
  RAISE EXCEPTION 'stale revision accepted';
 EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN
  PERFORM public.seller_os_save_candidate('00000000-0000-4000-8000-000000000001',actor,
   '00000000-0000-4000-8000-000000000006','999999990001',1,'{"publication":{"status":"PUBLISHED"}}');
  RAISE EXCEPTION 'publication accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 BEGIN
  PERFORM public.seller_os_save_candidate('00000000-0000-4000-8000-000000000001',actor,
   '00000000-0000-4000-8000-000000000007','999999990001',1,'{"review":{"status":"READY"}}');
  RAISE EXCEPTION 'unsupported review accepted';
 EXCEPTION WHEN SQLSTATE '22023' THEN NULL; END;
 result := public.seller_os_save_candidate('00000000-0000-4000-8000-000000000001',actor,
  '00000000-0000-4000-8000-000000000008','999999990001',1,'{"terms":{"salePriceKrw":14900}}');
 IF result->>'revision' <> '2' THEN RAISE EXCEPTION 'update revision failed'; END IF;
 IF (SELECT count(*) FROM public.seller_os_candidate_events WHERE workspace_id='00000000-0000-4000-8000-000000000001') <> 2
  THEN RAISE EXCEPTION 'event not atomic or duplicate retry event'; END IF;
 IF (SELECT count(*) FROM seller_os_private.write_requests WHERE workspace_id='00000000-0000-4000-8000-000000000001') <> 2
  THEN RAISE EXCEPTION 'failed request left data'; END IF;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('seller_os_test.actor'),'role','authenticated')::text,true);
-- Seed the other workspace directly as DBA, never through an end-user role.
INSERT INTO public.seller_os_candidates(workspace_id,offer_id,revision,data)
VALUES ('00000000-0000-4000-8000-000000000002','999999990002',1,
 '{"id":"999999990002","revision":1,"publication":{"status":"NOT_PUBLISHED"}}');
INSERT INTO public.seller_os_candidate_events(workspace_id,offer_id,revision,actor_id,request_id,kind,changed_fields)
VALUES ('00000000-0000-4000-8000-000000000002','999999990002',1,
 current_setting('seller_os_test.actor')::uuid,'00000000-0000-4000-8000-000000000020','created','{product}');
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF (SELECT count(*) FROM public.seller_os_workspaces WHERE id IN ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002')) <> 1
  THEN RAISE EXCEPTION 'workspace read isolation failed'; END IF;
 IF (SELECT count(*) FROM public.seller_os_candidates WHERE offer_id='999999990001') <> 1
  THEN RAISE EXCEPTION 'member candidate read failed'; END IF;
 IF EXISTS (SELECT 1 FROM public.seller_os_candidates WHERE offer_id='999999990002')
 OR EXISTS (SELECT 1 FROM public.seller_os_candidate_events WHERE offer_id='999999990002')
 THEN RAISE EXCEPTION 'cross-workspace candidate/event read accepted'; END IF;
 IF (SELECT count(*) FROM public.seller_os_candidate_events WHERE offer_id='999999990001') <> 2
 THEN RAISE EXCEPTION 'member event read failed'; END IF;
 BEGIN
  UPDATE public.seller_os_candidates SET revision=999 WHERE offer_id='999999990001';
  RAISE EXCEPTION 'client write accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  INSERT INTO public.seller_os_workspace_members(workspace_id,user_id,role)
  VALUES ('00000000-0000-4000-8000-000000000002',auth.uid(),'owner');
  RAISE EXCEPTION 'self enrolment accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 BEGIN
  PERFORM public.seller_os_save_candidate('00000000-0000-4000-8000-000000000001',auth.uid(),
   '00000000-0000-4000-8000-000000000009','999999990001',2,'{"terms":{}}');
  RAISE EXCEPTION 'client RPC accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000099","role":"authenticated","user_metadata":{"role":"owner"}}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM public.seller_os_candidates WHERE offer_id='999999990001')
 OR EXISTS(SELECT 1 FROM public.seller_os_candidate_events WHERE offer_id='999999990001')
 OR EXISTS(SELECT 1 FROM public.seller_os_workspace_members)
 THEN RAISE EXCEPTION 'nonmember/forged metadata read accepted'; END IF;
END $$;
RESET ROLE;
SET LOCAL ROLE anon;
DO $$ BEGIN
 BEGIN PERFORM 1 FROM public.seller_os_workspaces; RAISE EXCEPTION 'anonymous read accepted';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
ROLLBACK;
SELECT 'PASS: rollback-only member/nonmember/anon, writes, revision, replay, audit checks' AS result;
