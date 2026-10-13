-- Only the Seller OS area is extended; no shared Auth or other app changes.
CREATE TABLE public.seller_os_research_jobs (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.seller_os_workspaces(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('search','refresh')),
 input jsonb NOT NULL,
 status text NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','WAITING_HUMAN','WAITING_WORKER','FAILED','SUCCEEDED')),
 worker_id uuid, lease_id uuid, lease_until timestamptz,
 result jsonb, completion_input jsonb, attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(workspace_id,request_id)
);
CREATE INDEX seller_os_job_workspace_idx ON public.seller_os_research_jobs(workspace_id,created_at DESC);
CREATE INDEX seller_os_job_actor_idx ON public.seller_os_research_jobs(actor_id);
CREATE TABLE seller_os_private.research_workers (
 workspace_id uuid PRIMARY KEY REFERENCES public.seller_os_workspaces(id),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 worker_id uuid NOT NULL, heartbeat_at timestamptz NOT NULL, enabled boolean NOT NULL
);
CREATE INDEX seller_os_worker_actor_idx ON seller_os_private.research_workers(actor_id);
ALTER TABLE public.seller_os_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_os_private.research_workers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_os_research_jobs,seller_os_private.research_workers FROM PUBLIC,anon,authenticated,service_role;
GRANT SELECT ON public.seller_os_research_jobs TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.seller_os_research_jobs,seller_os_private.research_workers TO service_role;
CREATE POLICY seller_os_member_jobs ON public.seller_os_research_jobs FOR SELECT TO authenticated USING (EXISTS (
 SELECT 1 FROM public.seller_os_workspace_members m WHERE m.workspace_id=seller_os_research_jobs.workspace_id AND m.user_id=(SELECT auth.uid())
));
CREATE POLICY seller_os_server_workers ON seller_os_private.research_workers TO service_role USING (true) WITH CHECK (true);

CREATE FUNCTION public.seller_os_research_operation(p_workspace uuid,p_actor uuid,p_action text,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
#variable_conflict use_variable
DECLARE j public.seller_os_research_jobs%ROWTYPE; w seller_os_private.research_workers%ROWTYPE;
 worker uuid; job uuid; lease uuid; request uuid; stamp timestamptz:=clock_timestamp();
 obs jsonb; sku jsonb; e jsonb; field text; offer text; old public.seller_os_candidates%ROWTYPE;
 patch jsonb; product jsonb; saved jsonb; variants jsonb; result jsonb; link text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.seller_os_workspace_members WHERE workspace_id=p_workspace AND user_id=p_actor AND role='owner') THEN
 RAISE EXCEPTION 'WORKSPACE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR octet_length(p_input::text)>65536 THEN RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':research',0));
 SELECT * INTO w FROM seller_os_private.research_workers WHERE workspace_id=p_workspace;
 IF p_action='list' THEN
 RETURN jsonb_build_object('workerOnline',COALESCE(w.enabled AND w.heartbeat_at>stamp-interval '90 seconds',false),'jobs',COALESCE((
 SELECT jsonb_agg(to_jsonb(r)-'completion_input' ORDER BY r.created_at DESC) FROM (
 SELECT * FROM public.seller_os_research_jobs WHERE workspace_id=p_workspace ORDER BY created_at DESC LIMIT 50) r),'[]'::jsonb)); END IF;
 IF p_action='enqueue' THEN
 request:=(p_input->>'requestId')::uuid;
 IF request IS NULL OR COALESCE(p_input->>'kind','') NOT IN ('search','refresh') OR
 (p_input->>'kind'='search' AND (length(btrim(COALESCE(p_input->>'query',''))) NOT BETWEEN 1 AND 100)) OR
 (p_input->>'kind'='refresh' AND COALESCE(p_input->>'url','') !~ '^https://detail[.]1688[.]com/offer/[0-9]{1,32}[.]html$') THEN
 RAISE EXCEPTION 'INVALID_JOB' USING ERRCODE='22023'; END IF;
 SELECT * INTO j FROM public.seller_os_research_jobs WHERE workspace_id=p_workspace AND request_id=request;
 IF FOUND THEN IF j.input IS DISTINCT FROM p_input OR j.actor_id<>p_actor THEN RAISE EXCEPTION 'REQUEST_REUSED' USING ERRCODE='22023'; END IF; RETURN to_jsonb(j)-'completion_input'; END IF;
 INSERT INTO public.seller_os_research_jobs(workspace_id,actor_id,request_id,kind,input) VALUES(p_workspace,p_actor,request,p_input->>'kind',p_input) RETURNING * INTO j;
 RETURN to_jsonb(j)-'completion_input'; END IF;
 IF p_action IN ('connect','heartbeat','claim','stop') THEN
 worker:=(p_input->>'workerId')::uuid;
 IF worker IS NULL THEN RAISE EXCEPTION 'WORKER_REQUIRED' USING ERRCODE='22023'; END IF;
 IF w.enabled AND w.heartbeat_at>stamp-interval '90 seconds' AND w.worker_id<>worker THEN RAISE EXCEPTION 'WORKER_BUSY' USING ERRCODE='40001'; END IF;
 IF p_action='connect' THEN
 INSERT INTO seller_os_private.research_workers VALUES(p_workspace,p_actor,worker,stamp,true)
 ON CONFLICT(workspace_id) DO UPDATE SET actor_id=p_actor,worker_id=worker,heartbeat_at=stamp,enabled=true;
 RETURN jsonb_build_object('connected',true); END IF;
 IF w.worker_id IS DISTINCT FROM worker OR w.actor_id IS DISTINCT FROM p_actor OR NOT w.enabled THEN RAISE EXCEPTION 'WORKER_NOT_CONNECTED' USING ERRCODE='42501'; END IF;
 IF p_action='stop' THEN
 UPDATE seller_os_private.research_workers SET enabled=false WHERE workspace_id=p_workspace;
 UPDATE public.seller_os_research_jobs SET status='WAITING_WORKER',lease_until=NULL,updated_at=stamp WHERE workspace_id=p_workspace AND status='RUNNING' AND worker_id=worker;
 RETURN jsonb_build_object('stopped',true); END IF;
 UPDATE seller_os_private.research_workers SET heartbeat_at=stamp WHERE workspace_id=p_workspace;
 IF p_action='heartbeat' THEN
 UPDATE public.seller_os_research_jobs SET lease_until=stamp+interval '5 minutes',updated_at=stamp WHERE workspace_id=p_workspace AND status='RUNNING' AND worker_id=worker AND lease_id=(p_input->>'leaseId')::uuid AND lease_until>stamp;
 RETURN jsonb_build_object('online',true); END IF;
 IF EXISTS(SELECT 1 FROM public.seller_os_research_jobs WHERE workspace_id=p_workspace AND status='RUNNING' AND lease_until>stamp) THEN RETURN 'null'::jsonb; END IF;
 SELECT * INTO j FROM public.seller_os_research_jobs WHERE workspace_id=p_workspace AND (status IN ('QUEUED','WAITING_WORKER') OR (status='RUNNING' AND lease_until<=stamp)) ORDER BY created_at LIMIT 1 FOR UPDATE;
 IF NOT FOUND THEN RETURN 'null'::jsonb; END IF;
 UPDATE public.seller_os_research_jobs SET status='RUNNING',worker_id=worker,lease_id=gen_random_uuid(),lease_until=stamp+interval '5 minutes',attempts=attempts+1,completion_input=NULL,result=NULL,updated_at=stamp WHERE id=j.id RETURNING * INTO j;
 RETURN to_jsonb(j)-'completion_input'; END IF;
 job:=(p_input->>'jobId')::uuid;
 SELECT * INTO j FROM public.seller_os_research_jobs WHERE id=job AND workspace_id=p_workspace FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'JOB_NOT_FOUND' USING ERRCODE='22023'; END IF;
 IF p_action='retry' THEN
 IF j.status NOT IN ('WAITING_HUMAN','FAILED') THEN RAISE EXCEPTION 'JOB_NOT_RETRYABLE' USING ERRCODE='22023'; END IF;
 UPDATE public.seller_os_research_jobs SET status='QUEUED',lease_until=NULL,result=NULL,completion_input=NULL,updated_at=stamp WHERE id=job;
 RETURN jsonb_build_object('queued',true); END IF;
 IF p_action NOT IN ('complete','fail') THEN RAISE EXCEPTION 'INVALID_ACTION' USING ERRCODE='22023'; END IF;
 worker:=(p_input->>'workerId')::uuid; lease:=(p_input->>'leaseId')::uuid;
 IF j.worker_id IS DISTINCT FROM worker OR j.lease_id IS DISTINCT FROM lease THEN RAISE EXCEPTION 'LEASE_LOST' USING ERRCODE='40001'; END IF;
 IF j.completion_input IS NOT NULL THEN IF j.completion_input IS DISTINCT FROM p_input THEN RAISE EXCEPTION 'REQUEST_REUSED' USING ERRCODE='22023'; END IF; RETURN j.result; END IF;
 IF j.status<>'RUNNING' OR j.lease_until<=stamp OR w.worker_id IS DISTINCT FROM worker OR NOT w.enabled THEN RAISE EXCEPTION 'LEASE_LOST' USING ERRCODE='40001'; END IF;
 IF p_action='fail' THEN
 result:=p_input->'result';
 UPDATE public.seller_os_research_jobs SET status=CASE WHEN result->>'code' IN ('BROWSER_VERIFY_REQUIRED','HUMAN_REQUIRED','SIGN_IN_REQUIRED') THEN 'WAITING_HUMAN' WHEN result->>'code'='BROWSER_NOT_READY' THEN 'WAITING_WORKER' ELSE 'FAILED' END,result=result,completion_input=p_input,updated_at=stamp WHERE id=job;
 RETURN result; END IF;
 result:=p_input->'result';
 IF result->>'kind' IS DISTINCT FROM j.kind THEN RAISE EXCEPTION 'JOB_KIND_MISMATCH' USING ERRCODE='22023'; END IF;
 IF j.kind='search' THEN
 IF jsonb_typeof(result->'urls') IS DISTINCT FROM 'array' OR jsonb_array_length(result->'urls')>3 THEN RAISE EXCEPTION 'INVALID_SEARCH_RESULT' USING ERRCODE='22023'; END IF;
 FOR link IN SELECT jsonb_array_elements_text(result->'urls') LOOP
 IF link !~ '^https://detail[.]1688[.]com/offer/[0-9]{1,32}[.]html$' THEN RAISE EXCEPTION 'INVALID_URL' USING ERRCODE='22023'; END IF;
 INSERT INTO public.seller_os_research_jobs(workspace_id,actor_id,request_id,kind,input) VALUES(p_workspace,p_actor,gen_random_uuid(),'refresh',jsonb_build_object('kind','refresh','url',link,'parentJobId',job)); END LOOP;
 ELSE
 obs:=result->'observation'; offer:=obs->>'offerId';
 IF result->>'status'='ELIGIBLE' THEN
 IF offer IS NULL OR j.input->>'url' IS DISTINCT FROM obs->>'sourceUrl' OR jsonb_array_length(obs->'skuObservations') NOT BETWEEN 1 AND 36 THEN RAISE EXCEPTION 'INVALID_OBSERVATION' USING ERRCODE='22023'; END IF;
 FOR sku IN SELECT jsonb_array_elements(obs->'skuObservations') LOOP
 IF COALESCE(sku->>'skuId','')='' OR (sku->>'moq')::numeric IS DISTINCT FROM 1::numeric OR NOT COALESCE((sku->>'priceCny')::numeric>0,false) OR NOT COALESCE((sku->>'stock')::numeric>=1,false) OR NOT COALESCE((sku#>>'{package,grossWeightG}')::numeric>0,false) OR jsonb_array_length(sku#>'{package,dimensionsCm}') IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'INCOMPLETE_SKU' USING ERRCODE='22023'; END IF;
 FOR field IN SELECT unnest(ARRAY['price','moq','stock','grossWeight','dimensions']) LOOP
 e:=sku->'evidence'->field;
 IF e->>'confirmed' IS DISTINCT FROM 'true' OR e->>'sourceUrl' IS DISTINCT FROM obs->>'sourceUrl' OR COALESCE(e->>'kind','') NOT IN ('observed','quoted') OR e#>>'{scope,quantity}' IS DISTINCT FROM '1' OR (e#>>'{scope,skuId}' IS DISTINCT FROM sku->>'skuId' AND NOT(field='moq' AND e#>>'{scope,level}'='offer')) THEN RAISE EXCEPTION 'INVALID_EVIDENCE' USING ERRCODE='22023'; END IF;
 END LOOP; END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':offer:'||offer,0));
 SELECT * INTO old FROM public.seller_os_candidates WHERE workspace_id=p_workspace AND source='1688' AND offer_id=offer FOR UPDATE;
 SELECT jsonb_agg(jsonb_build_object('id',s->>'skuId','name',s->>'label','priceCny',s->'priceCny','stock',s->'stock','package',s->'package')) INTO variants FROM jsonb_array_elements(obs->'skuObservations') s;
 product:=jsonb_build_object('source','1688','offerId',offer,'canonicalUrl',obs->>'sourceUrl','title',obs->>'title','supplier',obs->'supplier','images',obs->'images','minOrderQty',1,'variants',variants,'collectedAt',obs->>'observedAt','sourcingObservation',obs);
 patch:=jsonb_build_object('product',product,'terms',COALESCE(old.data->'terms','{}'::jsonb)||jsonb_build_object('supplierQuoteConfirmed',false,'costsConfirmed',false,'saleEligibilityConfirmed',false,'imageRightsConfirmed',false,'comparisonConfirmed',false,'demandConfirmed',false),'review',jsonb_build_object('status','REVIEW_REQUIRED','stale',true,'reasons',jsonb_build_array('상품 정보 갱신: 수요·비용·판매 적합성·이미지 권리 재검토 필요'),'note',COALESCE(old.data#>>'{review,note}','')));
 saved:=public.seller_os_save_candidate(p_workspace,p_actor,j.id,offer,COALESCE(old.revision,0),patch);
 result:=(result-'observation')||jsonb_build_object('candidateId',offer,'revision',saved->'revision');
 ELSE
 -- Reject new incomplete products, and invalidate previously reviewed existing ones.
 IF offer IS NOT NULL AND j.input->>'url'=obs->>'sourceUrl' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':offer:'||offer,0));
 SELECT * INTO old FROM public.seller_os_candidates WHERE workspace_id=p_workspace AND source='1688' AND offer_id=offer FOR UPDATE;
 IF FOUND THEN
 patch:=jsonb_build_object('product',old.data->'product'||jsonb_build_object('latestSourcingCheck',jsonb_build_object('status','HOLD','observedAt',obs->>'observedAt','reasons',result->'reasons')),'terms',old.data->'terms'||jsonb_build_object('supplierQuoteConfirmed',false,'costsConfirmed',false,'saleEligibilityConfirmed',false,'imageRightsConfirmed',false,'comparisonConfirmed',false,'demandConfirmed',false),'review',jsonb_build_object('status','HOLD','stale',true,'reasons',result->'reasons','note',COALESCE(old.data#>>'{review,note}','')));
 saved:=public.seller_os_save_candidate(p_workspace,p_actor,j.id,offer,old.revision,patch);
 result:=(result-'observation')||jsonb_build_object('candidateId',offer,'revision',saved->'revision','existingCandidateHeld',true);
 END IF; END IF;
 END IF; END IF;
 UPDATE public.seller_os_research_jobs SET status='SUCCEEDED',result=result,completion_input=p_input,updated_at=stamp WHERE id=job;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.seller_os_research_operation(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seller_os_research_operation(uuid,uuid,text,jsonb) TO service_role;
