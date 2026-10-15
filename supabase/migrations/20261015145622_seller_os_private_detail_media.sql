-- Additive Seller OS only. Do not change shared Auth, buckets or other apps.
CREATE TABLE public.seller_os_detail_sets (
 workspace_id uuid NOT NULL, source text NOT NULL DEFAULT '1688' CHECK(source='1688'), offer_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0), draft jsonb NOT NULL CHECK(jsonb_typeof(draft)='object'),
 actor_id uuid NOT NULL REFERENCES auth.users(id), updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,source,offer_id),
 FOREIGN KEY(workspace_id,source,offer_id) REFERENCES public.seller_os_candidates(workspace_id,source,offer_id),
 CHECK((draft->>'revision') IS NOT DISTINCT FROM revision::text)
);
CREATE TABLE public.seller_os_detail_assets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, source text NOT NULL DEFAULT '1688' CHECK(source='1688'), offer_id text NOT NULL,
 object_path text NOT NULL UNIQUE, meta jsonb NOT NULL CHECK(jsonb_typeof(meta)='object'),
 byte_length integer NOT NULL CHECK(byte_length BETWEEN 1 AND 4194304),
 status text NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','READY','FAILED')),
 request_id uuid NOT NULL, fingerprint text NOT NULL CHECK(fingerprint ~ '^[a-f0-9]{64}$'),
 actor_id uuid NOT NULL REFERENCES auth.users(id), created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,source,offer_id) REFERENCES public.seller_os_candidates(workspace_id,source,offer_id),
 UNIQUE(workspace_id,request_id)
);
CREATE INDEX seller_os_detail_assets_scope_idx ON public.seller_os_detail_assets(workspace_id,source,offer_id);
CREATE INDEX seller_os_detail_assets_actor_idx ON public.seller_os_detail_assets(actor_id);
CREATE TABLE public.seller_os_detail_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workspace_id uuid NOT NULL, source text NOT NULL DEFAULT '1688' CHECK(source='1688'), offer_id text NOT NULL,
 revision integer NOT NULL CHECK(revision>0), actor_id uuid NOT NULL REFERENCES auth.users(id), request_id uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN ('upload','save')), asset_ids uuid[] NOT NULL, changed_fields text[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(workspace_id,source,offer_id) REFERENCES public.seller_os_candidates(workspace_id,source,offer_id),
 UNIQUE(workspace_id,source,offer_id,revision), UNIQUE(workspace_id,request_id)
);
CREATE INDEX seller_os_detail_events_actor_idx ON public.seller_os_detail_events(actor_id);
CREATE TABLE seller_os_private.media_requests (
 workspace_id uuid NOT NULL REFERENCES public.seller_os_workspaces(id), request_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id), offer_id text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('upload','save')), fingerprint text NOT NULL,
 candidate_revision integer NOT NULL, detail_revision integer NOT NULL,
 asset_id uuid REFERENCES public.seller_os_detail_assets(id), result jsonb, created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(workspace_id,request_id)
);
CREATE TABLE seller_os_private.media_budget (
 workspace_id uuid PRIMARY KEY REFERENCES public.seller_os_workspaces(id),
 checked_at timestamptz NOT NULL, enabled_until timestamptz NOT NULL, checked_by text NOT NULL,
 storage_limit bigint NOT NULL DEFAULT 67108864 CHECK(storage_limit BETWEEN 0 AND 67108864),
 read_limit bigint NOT NULL DEFAULT 67108864 CHECK(read_limit BETWEEN 0 AND 67108864),
 read_used bigint NOT NULL DEFAULT 0 CHECK(read_used>=0),
 CHECK(enabled_until>checked_at AND enabled_until<=checked_at+interval '24 hours'), CHECK(length(checked_by) BETWEEN 1 AND 200)
);
ALTER TABLE public.seller_os_detail_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_os_detail_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_os_detail_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_os_private.media_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_os_private.media_budget ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_os_detail_sets,public.seller_os_detail_assets,public.seller_os_detail_events,seller_os_private.media_requests,seller_os_private.media_budget FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.seller_os_detail_sets,public.seller_os_detail_assets,public.seller_os_detail_events TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.seller_os_detail_sets,public.seller_os_detail_assets,seller_os_private.media_requests,seller_os_private.media_budget TO service_role;
GRANT SELECT,INSERT ON public.seller_os_detail_events TO service_role;
CREATE POLICY seller_os_media_sets_owner ON public.seller_os_detail_sets FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.seller_os_workspace_members m WHERE m.workspace_id=seller_os_detail_sets.workspace_id AND m.user_id=(SELECT auth.uid()) AND m.role='owner')
 AND coalesce((SELECT auth.jwt()->>'is_anonymous'),'false')='false');
CREATE POLICY seller_os_media_assets_owner ON public.seller_os_detail_assets FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.seller_os_workspace_members m WHERE m.workspace_id=seller_os_detail_assets.workspace_id AND m.user_id=(SELECT auth.uid()) AND m.role='owner')
 AND coalesce((SELECT auth.jwt()->>'is_anonymous'),'false')='false');
CREATE POLICY seller_os_media_events_owner ON public.seller_os_detail_events FOR SELECT TO authenticated USING (
 EXISTS(SELECT 1 FROM public.seller_os_workspace_members m WHERE m.workspace_id=seller_os_detail_events.workspace_id AND m.user_id=(SELECT auth.uid()) AND m.role='owner')
 AND coalesce((SELECT auth.jwt()->>'is_anonymous'),'false')='false');
CREATE POLICY seller_os_media_requests_server ON seller_os_private.media_requests TO service_role USING(true) WITH CHECK(true);
CREATE POLICY seller_os_media_budget_server ON seller_os_private.media_budget TO service_role USING(true) WITH CHECK(true);

CREATE FUNCTION seller_os_private.media_guard(p_workspace uuid,p_actor uuid,p_offer text,p_candidate integer DEFAULT NULL,p_detail integer DEFAULT NULL)
RETURNS public.seller_os_candidates LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.seller_os_candidates; current_detail integer;
BEGIN
 IF p_workspace IS NULL OR p_actor IS NULL OR p_offer IS NULL OR p_offer !~ '^[0-9]{1,32}$' THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 -- The Edge getUser gate rejects anonymous users. Do not broaden shared Auth
 -- table grants for a server-only RPC; actor comes only from that verified gate.
 IF NOT EXISTS(SELECT 1 FROM public.seller_os_workspace_members WHERE workspace_id=p_workspace AND user_id=p_actor AND role='owner') THEN RAISE EXCEPTION 'MEDIA_FORBIDDEN' USING ERRCODE='42501'; END IF;
 -- Same workspace media lock for quota and same offer lock as existing candidate writes.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace::text||':media',0));
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace::text||':offer:'||p_offer,0));
 SELECT * INTO c FROM public.seller_os_candidates WHERE workspace_id=p_workspace AND source='1688' AND offer_id=p_offer;
 IF c.offer_id IS NULL THEN RAISE EXCEPTION 'MEDIA_ASSET_NOT_FOUND'; END IF;
 IF p_candidate IS NOT NULL AND (c.revision<>p_candidate OR c.data#>>'{publication,status}' IS DISTINCT FROM 'NOT_PUBLISHED') THEN RAISE EXCEPTION 'REVISION_CONFLICT' USING ERRCODE='40001'; END IF;
 SELECT revision INTO current_detail FROM public.seller_os_detail_sets WHERE workspace_id=p_workspace AND source='1688' AND offer_id=p_offer;
 IF p_detail IS NOT NULL AND coalesce(current_detail,0)<>p_detail THEN RAISE EXCEPTION 'REVISION_CONFLICT' USING ERRCODE='40001'; END IF;
 RETURN c;
END $$;

CREATE FUNCTION seller_os_private.media_charge_read(p_workspace uuid,p_bytes bigint) RETURNS void
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE b seller_os_private.media_budget;
BEGIN
 SELECT * INTO b FROM seller_os_private.media_budget WHERE workspace_id=p_workspace FOR UPDATE;
 IF b.workspace_id IS NULL OR b.checked_at>clock_timestamp() OR b.enabled_until<=clock_timestamp() THEN RAISE EXCEPTION 'MEDIA_BUDGET_DISABLED'; END IF;
 IF p_bytes<0 OR b.read_used+p_bytes>b.read_limit THEN RAISE EXCEPTION 'MEDIA_READ_LIMIT'; END IF;
 UPDATE seller_os_private.media_budget SET read_used=read_used+p_bytes WHERE workspace_id=p_workspace;
END $$;

CREATE FUNCTION public.seller_os_media_snapshot(p_workspace uuid,p_actor uuid,p_offer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE c public.seller_os_candidates; d jsonb; b seller_os_private.media_budget; stale boolean; total bigint;
BEGIN
 c:=seller_os_private.media_guard(p_workspace,p_actor,p_offer);
 SELECT draft INTO d FROM public.seller_os_detail_sets WHERE workspace_id=p_workspace AND source='1688' AND offer_id=p_offer;
 IF d IS NULL THEN d:=jsonb_build_object('revision',0,'sourceCandidateRevision',c.revision,'title','','intro','','panels','[]'::jsonb,'review',jsonb_build_object('status','REVIEW_REQUIRED','checks',jsonb_build_object('optionMatch',false,'copyFacts',false,'imageRights',false,'unknownsLabelled',false),'note','')); END IF;
 stale:=(d->>'sourceCandidateRevision')::integer<>c.revision;
 IF stale THEN d:=jsonb_set(jsonb_set(d,'{review,status}','"REVIEW_REQUIRED"'),'{review,checks}','{"optionMatch":false,"copyFacts":false,"imageRights":false,"unknownsLabelled":false}'); END IF;
 SELECT * INTO b FROM seller_os_private.media_budget WHERE workspace_id=p_workspace;
 SELECT coalesce(sum(byte_length),0) INTO total FROM public.seller_os_detail_assets WHERE workspace_id=p_workspace;
 RETURN jsonb_build_object('draft',d,'candidateRevision',c.revision,'stale',stale,'assets',coalesce((SELECT jsonb_agg(meta||jsonb_build_object('id',id,'status',status) ORDER BY created_at,id) FROM public.seller_os_detail_assets WHERE workspace_id=p_workspace AND source='1688' AND offer_id=p_offer),'[]'::jsonb),
 'budget',jsonb_build_object('enabled',coalesce(b.checked_at<=clock_timestamp() AND b.enabled_until>clock_timestamp(),false),'enabledUntil',b.enabled_until,'storageUsed',total,'storageLimit',coalesce(b.storage_limit,0),'readRemaining',greatest(0,coalesce(b.read_limit-b.read_used,0))));
END $$;

CREATE FUNCTION public.seller_os_media_reserve(p_workspace uuid,p_actor uuid,p_request uuid,p_offer text,p_candidate_revision integer,p_detail_revision integer,p_fingerprint text,p_meta jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE old seller_os_private.media_requests; a public.seller_os_detail_assets; b seller_os_private.media_budget; n integer; bytes bigint; all_bytes bigint; asset_uuid uuid:=gen_random_uuid(); extension text;
BEGIN
 PERFORM seller_os_private.media_guard(p_workspace,p_actor,p_offer);
 IF p_request IS NULL OR p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_candidate_revision IS NULL OR p_candidate_revision<1 OR p_detail_revision IS NULL OR p_detail_revision<0 THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 SELECT * INTO old FROM seller_os_private.media_requests WHERE workspace_id=p_workspace AND request_id=p_request;
 IF FOUND THEN
  IF old.actor_id<>p_actor OR old.offer_id<>p_offer OR old.kind<>'upload' OR old.fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'REQUEST_REUSED' USING ERRCODE='22023'; END IF;
  IF old.result IS NOT NULL THEN RETURN jsonb_build_object('committed',true,'snapshot',old.result); END IF;
  SELECT * INTO a FROM public.seller_os_detail_assets WHERE id=old.asset_id;
  PERFORM seller_os_private.media_charge_read(p_workspace,a.byte_length::bigint*2);
  RETURN jsonb_build_object('committed',false,'existing',true,'assetId',a.id,'path',a.object_path,'meta',a.meta);
 END IF;
 PERFORM seller_os_private.media_guard(p_workspace,p_actor,p_offer,p_candidate_revision,p_detail_revision);
 IF jsonb_typeof(p_meta) IS DISTINCT FROM 'object' OR NOT p_meta ?& ARRAY['mime','ext','width','height','byteLength','sha256','displayName'] OR (p_meta-ARRAY['mime','ext','width','height','byteLength','sha256','displayName'])<>'{}'::jsonb THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 IF jsonb_typeof(p_meta->'mime') IS DISTINCT FROM 'string' OR jsonb_typeof(p_meta->'ext') IS DISTINCT FROM 'string' OR jsonb_typeof(p_meta->'sha256') IS DISTINCT FROM 'string' OR jsonb_typeof(p_meta->'displayName') IS DISTINCT FROM 'string'
 OR jsonb_typeof(p_meta->'width') IS DISTINCT FROM 'number' OR jsonb_typeof(p_meta->'height') IS DISTINCT FROM 'number' OR jsonb_typeof(p_meta->'byteLength') IS DISTINCT FROM 'number'
 OR p_meta->>'mime' NOT IN ('image/png','image/jpeg','image/webp') OR p_meta->>'sha256' !~ '^[a-f0-9]{64}$' OR length(p_meta->>'displayName')>120
 OR (p_meta->>'width')::integer NOT BETWEEN 1 AND 16384 OR (p_meta->>'height')::integer NOT BETWEEN 1 AND 16384
 OR (p_meta->>'width')::bigint*(p_meta->>'height')::bigint>8000000 OR (p_meta->>'byteLength')::integer NOT BETWEEN 1 AND 4194304 THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 extension:=CASE p_meta->>'mime' WHEN 'image/png' THEN 'png' WHEN 'image/jpeg' THEN 'jpg' ELSE 'webp' END;
 IF p_meta->>'ext' IS DISTINCT FROM extension THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 SELECT count(*),coalesce(sum(byte_length),0) INTO n,bytes FROM public.seller_os_detail_assets WHERE workspace_id=p_workspace AND source='1688' AND offer_id=p_offer;
 SELECT coalesce(sum(byte_length),0) INTO all_bytes FROM public.seller_os_detail_assets WHERE workspace_id=p_workspace;
 SELECT * INTO b FROM seller_os_private.media_budget WHERE workspace_id=p_workspace;
 IF n>=20 OR bytes+(p_meta->>'byteLength')::bigint>25165824 OR all_bytes+(p_meta->>'byteLength')::bigint>coalesce(b.storage_limit,0) THEN RAISE EXCEPTION 'MEDIA_QUOTA_EXCEEDED'; END IF;
 PERFORM seller_os_private.media_charge_read(p_workspace,(p_meta->>'byteLength')::bigint*2);
 INSERT INTO public.seller_os_detail_assets(id,workspace_id,offer_id,object_path,meta,byte_length,request_id,fingerprint,actor_id)
 VALUES(asset_uuid,p_workspace,p_offer,p_workspace::text||'/1688/'||p_offer||'/'||asset_uuid::text||'.'||extension,p_meta,(p_meta->>'byteLength')::integer,p_request,p_fingerprint,p_actor) RETURNING * INTO a;
 INSERT INTO seller_os_private.media_requests(workspace_id,request_id,actor_id,offer_id,kind,fingerprint,candidate_revision,detail_revision,asset_id)
 VALUES(p_workspace,p_request,p_actor,p_offer,'upload',p_fingerprint,p_candidate_revision,p_detail_revision,a.id);
 RETURN jsonb_build_object('committed',false,'existing',false,'assetId',a.id,'path',a.object_path,'meta',a.meta);
END $$;

CREATE FUNCTION public.seller_os_media_finish(p_workspace uuid,p_actor uuid,p_request uuid,p_object_meta jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r seller_os_private.media_requests; a public.seller_os_detail_assets; s jsonb; d jsonb; rev integer;
BEGIN
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace::text||':media',0));
 SELECT * INTO r FROM seller_os_private.media_requests WHERE workspace_id=p_workspace AND request_id=p_request;
 IF r.request_id IS NULL OR r.actor_id IS DISTINCT FROM p_actor OR r.kind<>'upload' THEN RAISE EXCEPTION 'MEDIA_FORBIDDEN' USING ERRCODE='42501'; END IF;
 PERFORM seller_os_private.media_guard(p_workspace,p_actor,r.offer_id);
 IF r.result IS NOT NULL THEN RETURN r.result; END IF;
 PERFORM seller_os_private.media_guard(p_workspace,p_actor,r.offer_id,r.candidate_revision,r.detail_revision);
 -- Recheck lease, even if the upload began before expiry. No double read charge.
 PERFORM seller_os_private.media_charge_read(p_workspace,0);
 SELECT * INTO a FROM public.seller_os_detail_assets WHERE id=r.asset_id AND workspace_id=p_workspace AND offer_id=r.offer_id;
 IF a.id IS NULL OR p_object_meta IS DISTINCT FROM a.meta THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 UPDATE public.seller_os_detail_assets SET status='READY' WHERE id=a.id;
 s:=public.seller_os_media_snapshot(p_workspace,p_actor,r.offer_id); d:=s->'draft'; rev:=r.detail_revision+1;
 d:=d||jsonb_build_object('revision',rev,'sourceCandidateRevision',r.candidate_revision,'panels',(d->'panels')||jsonb_build_array(jsonb_build_object('assetId',a.id,'copy','','alt','')),'review',jsonb_build_object('status','REVIEW_REQUIRED','checks',jsonb_build_object('optionMatch',false,'copyFacts',false,'imageRights',false,'unknownsLabelled',false),'note',''));
 INSERT INTO public.seller_os_detail_sets(workspace_id,offer_id,revision,draft,actor_id) VALUES(p_workspace,r.offer_id,rev,d,p_actor)
 ON CONFLICT(workspace_id,source,offer_id) DO UPDATE SET revision=excluded.revision,draft=excluded.draft,actor_id=excluded.actor_id,updated_at=clock_timestamp();
 INSERT INTO public.seller_os_detail_events(workspace_id,offer_id,revision,actor_id,request_id,kind,asset_ids,changed_fields) VALUES(p_workspace,r.offer_id,rev,p_actor,p_request,'upload',ARRAY[a.id],ARRAY['panels','review']);
 s:=public.seller_os_media_snapshot(p_workspace,p_actor,r.offer_id);
 UPDATE seller_os_private.media_requests SET result=s WHERE workspace_id=p_workspace AND request_id=p_request;
 RETURN s;
END $$;

CREATE FUNCTION public.seller_os_media_save(p_workspace uuid,p_actor uuid,p_request uuid,p_offer text,p_candidate_revision integer,p_detail_revision integer,p_fingerprint text,p_draft jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE r seller_os_private.media_requests; s jsonb; d jsonb; old jsonb; p jsonb; ids uuid[]:='{}'; k text; rev integer;
BEGIN
 PERFORM seller_os_private.media_guard(p_workspace,p_actor,p_offer);
 IF p_request IS NULL OR p_fingerprint IS NULL OR p_fingerprint !~ '^[a-f0-9]{64}$' OR p_candidate_revision IS NULL OR p_candidate_revision<1 OR p_detail_revision IS NULL OR p_detail_revision<0 THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 SELECT * INTO r FROM seller_os_private.media_requests WHERE workspace_id=p_workspace AND request_id=p_request;
 IF FOUND THEN
  IF r.actor_id<>p_actor OR r.offer_id<>p_offer OR r.kind<>'save' OR r.fingerprint<>p_fingerprint THEN RAISE EXCEPTION 'REQUEST_REUSED' USING ERRCODE='22023'; END IF;
  RETURN r.result;
 END IF;
 PERFORM seller_os_private.media_guard(p_workspace,p_actor,p_offer,p_candidate_revision,p_detail_revision);
 IF jsonb_typeof(p_draft) IS DISTINCT FROM 'object' OR NOT p_draft ?& ARRAY['title','intro','panels','review'] OR (p_draft-ARRAY['title','intro','panels','review'])<>'{}'::jsonb OR octet_length(p_draft::text)>65536
 OR jsonb_typeof(p_draft->'title') IS DISTINCT FROM 'string' OR length(p_draft->>'title')>200 OR jsonb_typeof(p_draft->'intro') IS DISTINCT FROM 'string' OR length(p_draft->>'intro')>4000
 OR jsonb_typeof(p_draft->'panels') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 IF jsonb_array_length(p_draft->'panels')>20 OR jsonb_typeof(p_draft->'review') IS DISTINCT FROM 'object' OR NOT (p_draft->'review') ?& ARRAY['status','checks','note'] OR ((p_draft->'review')-ARRAY['status','checks','note'])<>'{}'::jsonb
 OR jsonb_typeof(p_draft#>'{review,status}') IS DISTINCT FROM 'string' OR p_draft#>>'{review,status}' NOT IN ('DRAFT','REVIEW_REQUIRED','REVIEWED_INTERNAL') OR jsonb_typeof(p_draft#>'{review,note}') IS DISTINCT FROM 'string' OR length(p_draft#>>'{review,note}')>2000
 OR jsonb_typeof(p_draft#>'{review,checks}') IS DISTINCT FROM 'object' OR NOT (p_draft#>'{review,checks}') ?& ARRAY['optionMatch','copyFacts','imageRights','unknownsLabelled'] OR ((p_draft#>'{review,checks}')-ARRAY['optionMatch','copyFacts','imageRights','unknownsLabelled'])<>'{}'::jsonb THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_draft#>'{review,checks}') LOOP IF jsonb_typeof(p_draft#>ARRAY['review','checks',k]) IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF; END LOOP;
 FOR p IN SELECT value FROM jsonb_array_elements(p_draft->'panels') LOOP
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR NOT p ?& ARRAY['assetId','copy','alt'] OR (p-ARRAY['assetId','copy','alt'])<>'{}'::jsonb OR jsonb_typeof(p->'copy') IS DISTINCT FROM 'string' OR length(p->>'copy')>2000 OR jsonb_typeof(p->'alt') IS DISTINCT FROM 'string' OR length(p->>'alt')>300 THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
  IF (p->>'assetId')::uuid=ANY(ids) OR NOT EXISTS(SELECT 1 FROM public.seller_os_detail_assets WHERE id=(p->>'assetId')::uuid AND workspace_id=p_workspace AND source='1688' AND offer_id=p_offer AND status='READY') THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
  ids:=array_append(ids,(p->>'assetId')::uuid);
 END LOOP;
 IF p_draft#>>'{review,status}'='REVIEWED_INTERNAL' AND (cardinality(ids)=0 OR EXISTS(SELECT 1 FROM jsonb_each(p_draft#>'{review,checks}') WHERE value<>'true'::jsonb)) THEN RAISE EXCEPTION 'MEDIA_INPUT_INVALID'; END IF;
 SELECT draft INTO old FROM public.seller_os_detail_sets WHERE workspace_id=p_workspace AND source='1688' AND offer_id=p_offer;
 rev:=p_detail_revision+1; d:=p_draft||jsonb_build_object('revision',rev,'sourceCandidateRevision',p_candidate_revision);
 IF old IS NOT NULL AND ((old->>'sourceCandidateRevision')::integer<>p_candidate_revision OR old->'title' IS DISTINCT FROM d->'title' OR old->'intro' IS DISTINCT FROM d->'intro' OR old->'panels' IS DISTINCT FROM d->'panels') THEN d:=jsonb_set(jsonb_set(d,'{review,status}','"REVIEW_REQUIRED"'),'{review,checks}','{"optionMatch":false,"copyFacts":false,"imageRights":false,"unknownsLabelled":false}'); END IF;
 INSERT INTO public.seller_os_detail_sets(workspace_id,offer_id,revision,draft,actor_id) VALUES(p_workspace,p_offer,rev,d,p_actor)
 ON CONFLICT(workspace_id,source,offer_id) DO UPDATE SET revision=excluded.revision,draft=excluded.draft,actor_id=excluded.actor_id,updated_at=clock_timestamp();
 INSERT INTO public.seller_os_detail_events(workspace_id,offer_id,revision,actor_id,request_id,kind,asset_ids,changed_fields) VALUES(p_workspace,p_offer,rev,p_actor,p_request,'save',ids,ARRAY['title','intro','panels','review']);
 s:=public.seller_os_media_snapshot(p_workspace,p_actor,p_offer);
 INSERT INTO seller_os_private.media_requests(workspace_id,request_id,actor_id,offer_id,kind,fingerprint,candidate_revision,detail_revision,result) VALUES(p_workspace,p_request,p_actor,p_offer,'save',p_fingerprint,p_candidate_revision,p_detail_revision,s);
 RETURN s;
END $$;

CREATE FUNCTION public.seller_os_media_read_permit(p_workspace uuid,p_actor uuid,p_offer text,p_asset uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE a public.seller_os_detail_assets;
BEGIN
 PERFORM seller_os_private.media_guard(p_workspace,p_actor,p_offer);
 SELECT * INTO a FROM public.seller_os_detail_assets WHERE id=p_asset AND workspace_id=p_workspace AND source='1688' AND offer_id=p_offer AND status='READY';
 IF a.id IS NULL THEN RAISE EXCEPTION 'MEDIA_ASSET_NOT_FOUND'; END IF;
 PERFORM seller_os_private.media_charge_read(p_workspace,a.byte_length::bigint*2);
 RETURN jsonb_build_object('path',a.object_path,'meta',a.meta);
END $$;
REVOKE ALL ON FUNCTION seller_os_private.media_guard(uuid,uuid,text,integer,integer),seller_os_private.media_charge_read(uuid,bigint),public.seller_os_media_snapshot(uuid,uuid,text),public.seller_os_media_reserve(uuid,uuid,uuid,text,integer,integer,text,jsonb),public.seller_os_media_finish(uuid,uuid,uuid,jsonb),public.seller_os_media_save(uuid,uuid,uuid,text,integer,integer,text,jsonb),public.seller_os_media_read_permit(uuid,uuid,text,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION seller_os_private.media_guard(uuid,uuid,text,integer,integer),seller_os_private.media_charge_read(uuid,bigint),public.seller_os_media_snapshot(uuid,uuid,text),public.seller_os_media_reserve(uuid,uuid,uuid,text,integer,integer,text,jsonb),public.seller_os_media_finish(uuid,uuid,uuid,jsonb),public.seller_os_media_save(uuid,uuid,uuid,text,integer,integer,text,jsonb),public.seller_os_media_read_permit(uuid,uuid,text,uuid) TO service_role;
-- No direct Storage grants/policies. Fresh bucket only: conflict must fail closed.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types) VALUES('seller-os-detail-media','seller-os-detail-media',false,4194304,ARRAY['image/png','image/jpeg','image/webp']);
