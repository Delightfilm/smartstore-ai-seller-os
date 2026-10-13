CREATE OR REPLACE FUNCTION seller_os_private.valid_research_sku(s jsonb,url text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE field text; e jsonb; v jsonb; factor numeric; i integer;
BEGIN
 IF COALESCE(s->>'skuId','') !~ '^[A-Za-z0-9:_-]{1,128}$' OR length(btrim(COALESCE(s->>'label','')))=0 THEN RETURN false; END IF;
 FOR field IN SELECT unnest(ARRAY['price','moq','stock','grossWeight','dimensions']) LOOP
 e:=s->'evidence'->field;
 IF e IS NULL OR e->>'confirmed' IS DISTINCT FROM 'true' OR e->>'sourceUrl' IS DISTINCT FROM url
 OR COALESCE(e->>'kind','') NOT IN ('observed','quoted') OR e#>>'{scope,quantity}' IS DISTINCT FROM '1'
 OR NOT COALESCE(((e#>>'{scope,level}'='sku' AND e#>>'{scope,skuId}'=s->>'skuId') OR (field='moq' AND e#>>'{scope,level}'='offer')),false)
 OR e->>'observedAt' IS NULL OR (e->>'observedAt')::timestamptz<clock_timestamp()-interval '7 days'
 OR (e->>'observedAt')::timestamptz>clock_timestamp()+interval '60 seconds' THEN RETURN false; END IF;
 IF field='price' AND (e->>'unit' IS DISTINCT FROM 'CNY' OR NOT COALESCE((e->>'value')::numeric>0,false) OR (e->>'value')::numeric IS DISTINCT FROM (s->>'priceCny')::numeric) THEN RETURN false; END IF;
 IF field IN ('moq','stock') AND (e->>'unit' IS DISTINCT FROM 'piece' OR (e->>'value')::numeric IS DISTINCT FROM (s->>field)::numeric) THEN RETURN false; END IF;
 IF field='stock' AND (e->>'value')::numeric<>trunc((e->>'value')::numeric) THEN RETURN false; END IF;
 IF field='grossWeight' THEN
 factor:=CASE e->>'unit' WHEN 'g' THEN 1 WHEN 'kg' THEN 1000 ELSE NULL END;
 IF factor IS NULL OR e->>'semantic' IS DISTINCT FROM 'packed_gross' OR NOT COALESCE((e->>'value')::numeric>0,false) OR (e->>'value')::numeric*factor IS DISTINCT FROM (s#>>'{package,grossWeightG}')::numeric THEN RETURN false; END IF;
 END IF;
 IF field='dimensions' THEN
 factor:=CASE e->>'unit' WHEN 'cm' THEN 1 WHEN 'mm' THEN 0.1 WHEN 'm' THEN 100 ELSE NULL END;
 v:=e->'value';
 IF factor IS NULL OR e->>'semantic' IS DISTINCT FROM 'packed_dimensions' OR jsonb_typeof(v) IS DISTINCT FROM 'array' OR jsonb_array_length(v)<>3 THEN RETURN false; END IF;
 FOR i IN 0..2 LOOP
 IF NOT COALESCE((v->>i)::numeric>0,false) OR abs((v->>i)::numeric*factor-(s#>'{package,dimensionsCm}'->>i)::numeric)>0.000001 THEN RETURN false; END IF;
 END LOOP;
 END IF;
 END LOOP;
 RETURN true;
EXCEPTION WHEN invalid_text_representation OR invalid_datetime_format OR datetime_field_overflow THEN RETURN false;
END $$;
REVOKE ALL ON FUNCTION seller_os_private.valid_research_sku(jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION seller_os_private.valid_research_sku(jsonb,text) TO service_role;
CREATE OR REPLACE FUNCTION public.seller_os_research_operation(p_workspace uuid,p_actor uuid,p_action text,p_input jsonb)
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
 INSERT INTO public.seller_os_research_jobs(workspace_id,actor_id,request_id,kind,input) VALUES(p_workspace,p_actor,gen_random_uuid(),'refresh',jsonb_build_object('kind','refresh','url',link,'parentJobId',job,'cardMoq',result->'cardMoQs'->link,'cardObservedAt',result->'observedAt')); END LOOP;
 ELSE
 obs:=result->'observation'; offer:=obs->>'offerId';
 IF result->>'status'='ELIGIBLE' THEN
 IF offer IS NULL OR j.input->>'url' IS DISTINCT FROM obs->>'sourceUrl' OR jsonb_array_length(obs->'skuObservations') NOT BETWEEN 1 AND 36 THEN RAISE EXCEPTION 'INVALID_OBSERVATION' USING ERRCODE='22023'; END IF;
 IF length(btrim(COALESCE(obs->>'title','')))=0 OR (SELECT count(DISTINCT s->>'skuId') FROM jsonb_array_elements(obs->'skuObservations') s)<>jsonb_array_length(obs->'skuObservations') THEN RAISE EXCEPTION 'INCOMPLETE_SKU_SET' USING ERRCODE='22023'; END IF;
 FOR sku IN SELECT jsonb_array_elements(obs->'skuObservations') LOOP
 IF NOT seller_os_private.valid_research_sku(sku,obs->>'sourceUrl') THEN RAISE EXCEPTION 'INVALID_SKU_EVIDENCE' USING ERRCODE='22023'; END IF;
 IF COALESCE(sku->>'skuId','')='' OR (sku->>'moq')::numeric IS DISTINCT FROM 1::numeric OR NOT COALESCE((sku->>'priceCny')::numeric>0,false) OR NOT COALESCE((sku->>'stock')::numeric>=1,false) OR NOT COALESCE((sku#>>'{package,grossWeightG}')::numeric>0,false) OR jsonb_array_length(sku#>'{package,dimensionsCm}') IS DISTINCT FROM 3 THEN RAISE EXCEPTION 'INCOMPLETE_SKU' USING ERRCODE='22023'; END IF;
 FOR field IN SELECT unnest(ARRAY['price','moq','stock','grossWeight','dimensions']) LOOP
 e:=sku->'evidence'->field;
 IF e->>'confirmed' IS DISTINCT FROM 'true' OR e->>'sourceUrl' IS DISTINCT FROM obs->>'sourceUrl' OR COALESCE(e->>'kind','') NOT IN ('observed','quoted') OR e#>>'{scope,quantity}' IS DISTINCT FROM '1' OR (e#>>'{scope,skuId}' IS DISTINCT FROM sku->>'skuId' AND NOT(field='moq' AND e#>>'{scope,level}'='offer')) THEN RAISE EXCEPTION 'INVALID_EVIDENCE' USING ERRCODE='22023'; END IF;
 END LOOP; END LOOP;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':offer:'||offer,0));
 SELECT * INTO old FROM public.seller_os_candidates WHERE workspace_id=p_workspace AND source='1688' AND offer_id=offer FOR UPDATE;
 SELECT jsonb_agg(jsonb_build_object('id',s->>'skuId','name',s->>'label','priceCny',s->'priceCny','stock',s->'stock','package',s->'package')) INTO variants FROM jsonb_array_elements(obs->'skuObservations') s;
 product:=jsonb_build_object('source','1688','offerId',offer,'canonicalUrl',obs->>'sourceUrl','title',obs->>'title','supplier',obs->'supplier','images',obs->'images','minOrderQty',1,'variants',variants,'collectedAt',obs->>'observedAt','sourcingObservation',obs);
 patch:=jsonb_build_object('product',product,'terms',COALESCE(old.data->'terms','{}'::jsonb)||jsonb_build_object('supplierQuoteConfirmed',false,'costsConfirmed',false,'saleEligibilityConfirmed',false,'imageRightsConfirmed',false,'comparisonConfirmed',false,'demandConfirmed',false),'review',jsonb_build_object('status','REVIEW_REQUIRED','stale',true,'reasons',(SELECT jsonb_agg(value) FROM (SELECT value FROM jsonb_array_elements(COALESCE(old.data#>'{review,reasons}','[]'::jsonb)||jsonb_build_array('상품 정보 갱신: 수요·비용·판매 적합성·이미지 권리 재검토 필요')) WITH ORDINALITY x(value,n) GROUP BY value ORDER BY min(n) LIMIT 20) reasons),'note',COALESCE(old.data#>>'{review,note}','')));
 saved:=public.seller_os_save_candidate(p_workspace,p_actor,j.id,offer,COALESCE(old.revision,0),patch);
 result:=(result-'observation')||jsonb_build_object('candidateId',offer,'revision',saved->'revision');
 ELSE
 -- Reject new incomplete products, and invalidate previously reviewed existing ones.
 IF offer IS NOT NULL AND j.input->>'url'=obs->>'sourceUrl' THEN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':offer:'||offer,0));
 SELECT * INTO old FROM public.seller_os_candidates WHERE workspace_id=p_workspace AND source='1688' AND offer_id=offer FOR UPDATE;
 IF FOUND THEN
 patch:=jsonb_build_object('product',old.data->'product'||jsonb_build_object('latestSourcingCheck',jsonb_build_object('status','HOLD','observedAt',obs->>'observedAt','reasons',result->'reasons')),'terms',old.data->'terms'||jsonb_build_object('supplierQuoteConfirmed',false,'costsConfirmed',false,'saleEligibilityConfirmed',false,'imageRightsConfirmed',false,'comparisonConfirmed',false,'demandConfirmed',false),'review',jsonb_build_object('status','HOLD','stale',true,'reasons',(SELECT jsonb_agg(value) FROM (SELECT value FROM jsonb_array_elements(COALESCE(old.data#>'{review,reasons}','[]'::jsonb)||COALESCE(result->'reasons','[]'::jsonb)) WITH ORDINALITY x(value,n) GROUP BY value ORDER BY min(n) LIMIT 20) reasons),'note',COALESCE(old.data#>>'{review,note}','')));
 saved:=public.seller_os_save_candidate(p_workspace,p_actor,j.id,offer,old.revision,patch);
 result:=(result-'observation')||jsonb_build_object('candidateId',offer,'revision',saved->'revision','existingCandidateHeld',true);
 END IF; END IF;
 END IF; END IF;
 UPDATE public.seller_os_research_jobs SET status='SUCCEEDED',result=result,completion_input=p_input,updated_at=stamp WHERE id=job;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.seller_os_research_operation(uuid,uuid,text,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seller_os_research_operation(uuid,uuid,text,jsonb) TO service_role;
