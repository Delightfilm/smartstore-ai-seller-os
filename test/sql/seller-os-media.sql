-- Explicit technical fixtures only; always rolled back. Role simulation is not HTTP proof.
BEGIN;
INSERT INTO public.seller_os_workspaces(id,name) VALUES('11111111-2222-4333-8444-555555555555','TEST_ONLY_MEDIA');
-- Use a known existing owner solely as fixture actor; no Auth users are created.
INSERT INTO public.seller_os_workspace_members(workspace_id,user_id,role)
SELECT '11111111-2222-4333-8444-555555555555',user_id,'owner' FROM public.seller_os_workspace_members WHERE workspace_id='ccb5017e-7c70-414d-b103-38e17e48e799' LIMIT 1;
INSERT INTO public.seller_os_candidates(workspace_id,offer_id,revision,data) VALUES
('11111111-2222-4333-8444-555555555555','990000001',4,'{"id":"990000001","revision":4,"publication":{"status":"NOT_PUBLISHED"}}'),
('11111111-2222-4333-8444-555555555555','990000002',4,'{"id":"990000002","revision":4,"publication":{"status":"NOT_PUBLISHED"}}'),
('11111111-2222-4333-8444-555555555555','990000003',4,'{"id":"990000003","revision":4,"publication":{"status":"NOT_PUBLISHED"}}'),
('11111111-2222-4333-8444-555555555555','990000004',4,'{"id":"990000004","revision":4,"publication":{"status":"NOT_PUBLISHED"}}');
INSERT INTO seller_os_private.media_budget(workspace_id,checked_at,enabled_until,checked_by)
VALUES('11111111-2222-4333-8444-555555555555',clock_timestamp(),clock_timestamp()+interval '1 hour','TEST_ONLY_ROLLBACK');
SET LOCAL ROLE service_role;
DO $$
DECLARE w uuid:='11111111-2222-4333-8444-555555555555'; actor uuid; r jsonb; again jsonb; s jsonb; n integer;
 req uuid:='77777777-2222-4333-8444-555555555555';
 meta jsonb:='{"mime":"image/png","ext":"png","width":2,"height":3,"byteLength":1024,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","displayName":"TEST_ONLY.png"}';
 draft jsonb:='{"title":"TEST_ONLY","intro":"","panels":[],"review":{"status":"REVIEW_REQUIRED","checks":{"optionMatch":false,"copyFacts":false,"imageRights":false,"unknownsLabelled":false},"note":""}}';
BEGIN
 SELECT user_id INTO STRICT actor FROM public.seller_os_workspace_members WHERE workspace_id=w;
 r:=public.seller_os_media_reserve(w,actor,req,'990000001',4,0,repeat('a',64),meta);
 again:=public.seller_os_media_reserve(w,actor,req,'990000001',4,0,repeat('a',64),meta);
 IF r->>'assetId' IS DISTINCT FROM again->>'assetId' THEN RAISE EXCEPTION 'REPLAY_ASSET_CHANGED'; END IF;
 IF (SELECT count(*) FROM public.seller_os_detail_assets WHERE workspace_id=w)<>1 THEN RAISE EXCEPTION 'DUPLICATE_RESERVATION'; END IF;
 BEGIN PERFORM public.seller_os_media_reserve(w,actor,req,'990000001',4,0,repeat('b',64),meta); RAISE EXCEPTION 'REUSED_NOT_DENIED'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 s:=public.seller_os_media_finish(w,actor,req,meta);
 IF s#>>'{draft,revision}'<>'1' OR jsonb_array_length(s#>'{draft,panels}')<>1 OR s::text LIKE '%/1688/%' THEN RAISE EXCEPTION 'BAD_FINISH_DTO'; END IF;
 -- Committed replay must win over now-stale expected detail revision; no new reads.
 SELECT read_used INTO n FROM seller_os_private.media_budget WHERE workspace_id=w;
 again:=public.seller_os_media_reserve(w,actor,req,'990000001',4,0,repeat('a',64),meta);
 IF again->>'committed'<>'true' OR (SELECT read_used FROM seller_os_private.media_budget WHERE workspace_id=w)<>n THEN RAISE EXCEPTION 'REPLAY_CHARGED'; END IF;
 BEGIN PERFORM public.seller_os_media_save(w,actor,gen_random_uuid(),'990000001',4,0,repeat('b',64),draft); RAISE EXCEPTION 'CAS_NOT_DENIED'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 BEGIN PERFORM public.seller_os_media_read_permit(w,actor,'990000002',(r->>'assetId')::uuid); RAISE EXCEPTION 'CROSS_OFFER_NOT_DENIED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MEDIA_ASSET_NOT_FOUND' THEN RAISE; END IF; END;
 s:=public.seller_os_media_save(w,actor,gen_random_uuid(),'990000001',4,1,repeat('b',64),draft);
 IF s#>>'{draft,revision}'<>'2' OR jsonb_array_length(s#>'{draft,panels}')<>0 OR (SELECT sum(byte_length) FROM public.seller_os_detail_assets WHERE workspace_id=w)<>1024 THEN RAISE EXCEPTION 'EXCLUSION_FREED_RETAINED_BYTES'; END IF;
 -- 19 new reservations plus one retained object reach the 20-file cap.
 FOR n IN 1..19 LOOP PERFORM public.seller_os_media_reserve(w,actor,gen_random_uuid(),'990000001',4,2,repeat('c',64),meta); END LOOP;
 BEGIN PERFORM public.seller_os_media_reserve(w,actor,gen_random_uuid(),'990000001',4,2,repeat('d',64),meta); RAISE EXCEPTION 'COUNT_CAP_NOT_DENIED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MEDIA_QUOTA_EXCEEDED' THEN RAISE; END IF; END;
 -- Revoke fixture lease while pending; finalization is denied and retained charge stays.
 UPDATE seller_os_private.media_budget SET checked_at=clock_timestamp()-interval '2 hours',enabled_until=clock_timestamp()-interval '1 hour' WHERE workspace_id=w;
 BEGIN PERFORM public.seller_os_media_read_permit(w,actor,'990000001',(r->>'assetId')::uuid); RAISE EXCEPTION 'EXPIRED_READ_NOT_DENIED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MEDIA_BUDGET_DISABLED' THEN RAISE; END IF; END;
 IF (SELECT sum(byte_length) FROM public.seller_os_detail_assets WHERE workspace_id=w)<>20480 THEN RAISE EXCEPTION 'PENDING_BYTES_LOST'; END IF;
 RAISE NOTICE 'MEDIA_CAS_REPLAY_SCOPE_QUOTA_RETAINED_LEASE_PASS';
END $$;
RESET ROLE;
-- Explicit malformed metadata/status checks, lease, parent changes and byte caps.
SET LOCAL ROLE service_role;
DO $$
DECLARE w uuid:='11111111-2222-4333-8444-555555555555'; actor uuid; r jsonb; req uuid; old_used bigint; n integer; offer text;
 meta jsonb:='{"mime":"image/png","ext":"png","width":2,"height":3,"byteLength":4194304,"sha256":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","displayName":"TEST_ONLY.png"}';
 draft jsonb:='{"title":"TEST_ONLY","intro":"","panels":[],"review":{"status":null,"checks":{"optionMatch":false,"copyFacts":false,"imageRights":false,"unknownsLabelled":false},"note":""}}';
BEGIN
 SELECT user_id INTO STRICT actor FROM public.seller_os_workspace_members WHERE workspace_id=w;
 UPDATE seller_os_private.media_budget SET checked_at=clock_timestamp(),enabled_until=clock_timestamp()+interval '1 hour',read_used=0 WHERE workspace_id=w;
 BEGIN PERFORM public.seller_os_media_save(w,actor,gen_random_uuid(),'990000002',4,0,repeat('f',64),draft); RAISE EXCEPTION 'NULL_REVIEW_NOT_DENIED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MEDIA_INPUT_INVALID' THEN RAISE; END IF; END;
 BEGIN PERFORM public.seller_os_media_reserve(w,actor,gen_random_uuid(),'990000002',4,0,repeat('f',64),meta||'{"mime":null,"ext":"webp"}'); RAISE EXCEPTION 'NULL_MIME_NOT_DENIED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MEDIA_INPUT_INVALID' THEN RAISE; END IF; END;
 -- Fill two products to 24MiB; resetting only the fixture read allowance isolates storage assertions.
 FOREACH offer IN ARRAY ARRAY['990000002','990000003'] LOOP
  FOR n IN 1..6 LOOP UPDATE seller_os_private.media_budget SET read_used=0 WHERE workspace_id=w; PERFORM public.seller_os_media_reserve(w,actor,gen_random_uuid(),offer,4,0,repeat('f',64),meta); END LOOP;
  BEGIN PERFORM public.seller_os_media_reserve(w,actor,gen_random_uuid(),offer,4,0,repeat('f',64),meta); RAISE EXCEPTION 'PRODUCT_BYTES_NOT_DENIED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MEDIA_QUOTA_EXCEEDED' THEN RAISE; END IF; END;
 END LOOP;
 FOR n IN 1..3 LOOP UPDATE seller_os_private.media_budget SET read_used=0 WHERE workspace_id=w; PERFORM public.seller_os_media_reserve(w,actor,gen_random_uuid(),'990000004',4,0,repeat('f',64),meta); END LOOP;
 BEGIN PERFORM public.seller_os_media_reserve(w,actor,gen_random_uuid(),'990000004',4,0,repeat('f',64),meta); RAISE EXCEPTION 'WORKSPACE_BYTES_NOT_DENIED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MEDIA_QUOTA_EXCEEDED' THEN RAISE; END IF; END;
 -- A previously reserved asset cannot finalize after parent revision changed.
 SELECT request_id INTO req FROM seller_os_private.media_requests WHERE workspace_id=w AND offer_id='990000002' LIMIT 1;
 UPDATE public.seller_os_candidates SET revision=5,data=jsonb_set(data,'{revision}','5') WHERE workspace_id=w AND offer_id='990000002';
 BEGIN PERFORM public.seller_os_media_finish(w,actor,req,meta); RAISE EXCEPTION 'STALE_FINISH_NOT_DENIED'; EXCEPTION WHEN serialization_failure THEN NULL; END;
 UPDATE seller_os_private.media_budget SET read_used=read_limit-2047 WHERE workspace_id=w;
 SELECT asset_id INTO req FROM seller_os_private.media_requests WHERE workspace_id=w AND result IS NOT NULL AND kind='upload' LIMIT 1;
 BEGIN PERFORM public.seller_os_media_read_permit(w,actor,'990000001',req); RAISE EXCEPTION 'READ_BYTES_NOT_DENIED'; EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'MEDIA_READ_LIMIT' THEN RAISE; END IF; END;
 BEGIN PERFORM public.seller_os_media_snapshot(w,'99999999-2222-4333-8444-555555555555','990000001'); RAISE EXCEPTION 'NONOWNER_NOT_DENIED'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.seller_os_workspace_members WHERE workspace_id='11111111-2222-4333-8444-555555555555'),true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.seller_os_detail_sets WHERE workspace_id='11111111-2222-4333-8444-555555555555')<>1 THEN RAISE EXCEPTION 'OWNER_SELECT_DENIED'; END IF; END $$;
SELECT set_config('request.jwt.claim.sub','99999999-2222-4333-8444-555555555555',true);
DO $$ BEGIN IF (SELECT count(*) FROM public.seller_os_detail_sets WHERE workspace_id='11111111-2222-4333-8444-555555555555')<>0 THEN RAISE EXCEPTION 'FOREIGN_SELECT_LEAK'; END IF; END $$;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub',(SELECT user_id::text FROM public.seller_os_workspace_members WHERE workspace_id='11111111-2222-4333-8444-555555555555'),true);
SELECT set_config('request.jwt.claims','{"is_anonymous":true}',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN IF (SELECT count(*) FROM public.seller_os_detail_sets WHERE workspace_id='11111111-2222-4333-8444-555555555555')<>0 THEN RAISE EXCEPTION 'ANONYMOUS_SELECT_LEAK'; END IF; END $$;
RESET ROLE;
-- No public write/RPC execute; private schema remains unreachable.
DO $$ BEGIN
 IF has_table_privilege('authenticated','public.seller_os_detail_sets','INSERT') OR has_table_privilege('anon','public.seller_os_detail_assets','SELECT') OR has_function_privilege('authenticated','public.seller_os_media_read_permit(uuid,uuid,text,uuid)','EXECUTE') OR has_schema_privilege('authenticated','seller_os_private','USAGE') THEN RAISE EXCEPTION 'PRIVILEGE_LEAK'; END IF;
 IF (SELECT public FROM storage.buckets WHERE id='seller-os-detail-media') IS DISTINCT FROM false THEN RAISE EXCEPTION 'PUBLIC_BUCKET'; END IF;
END $$;
ROLLBACK;
