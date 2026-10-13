-- Real shared-project check: all fixture jobs/candidates/workers are rolled back.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE wp uuid; actor uuid; worker uuid:=gen_random_uuid(); request uuid:=gen_random_uuid();
 j jsonb; claimed jsonb; input jsonb; result jsonb; again jsonb; obs jsonb; sku jsonb; e jsonb;
 target text:='99999900001'; url text:='https://detail.1688.com/offer/99999900001.html'; field text; n integer;
BEGIN
 SELECT workspace_id,user_id INTO wp,actor FROM public.seller_os_workspace_members ORDER BY created_at DESC LIMIT 1;
 -- Release a previously active worker only inside this rolled-back test transaction.
 UPDATE seller_os_private.research_workers SET enabled=false WHERE workspace_id=wp;
 PERFORM public.seller_os_research_operation(wp,actor,'connect',jsonb_build_object('workerId',worker));
 input:=jsonb_build_object('requestId',request,'kind','refresh','url',url);
 j:=public.seller_os_research_operation(wp,actor,'enqueue',input);
 again:=public.seller_os_research_operation(wp,actor,'enqueue',input);
 IF j->>'id' IS DISTINCT FROM again->>'id' THEN RAISE EXCEPTION 'enqueue not idempotent'; END IF;
 BEGIN
 PERFORM public.seller_os_research_operation(wp,actor,'enqueue',input||jsonb_build_object('url','https://detail.1688.com/offer/22.html'));
 RAISE EXCEPTION 'reused request accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 -- Ensure only fixture jobs can be claimed within this transaction.
 UPDATE public.seller_os_research_jobs SET status='FAILED' WHERE workspace_id=wp AND id<>(j->>'id')::uuid AND status IN ('QUEUED','WAITING_WORKER','RUNNING');
 claimed:=public.seller_os_research_operation(wp,actor,'claim',jsonb_build_object('workerId',worker));
 IF claimed->>'id' IS DISTINCT FROM j->>'id' THEN RAISE EXCEPTION 'wrong claim'; END IF;
 IF public.seller_os_research_operation(wp,actor,'claim',jsonb_build_object('workerId',worker))<>'null'::jsonb THEN RAISE EXCEPTION 'concurrent job accepted'; END IF;
 sku:=jsonb_build_object('skuId','vendor-fixture','label','fixture','priceCny',16.5,'stock',13,'moq',1,'package',jsonb_build_object('grossWeightG',446,'dimensionsCm',jsonb_build_array(18.5,14,4.5)),'evidence','{}'::jsonb);
 FOR field IN SELECT unnest(ARRAY['price','stock','moq','grossWeight','dimensions']) LOOP
 e:=jsonb_build_object('value',1,'unit','piece','confirmed',true,'kind','observed','sourceUrl',url,'observedAt',clock_timestamp(),'scope',jsonb_build_object('skuId','vendor-fixture','quantity',1,'level','sku'));
 IF field='price' THEN e:=e||jsonb_build_object('value',16.5,'unit','CNY'); END IF;
 IF field='stock' THEN e:=e||jsonb_build_object('value',13); END IF;
 IF field='grossWeight' THEN e:=e||jsonb_build_object('value',446,'unit','g','semantic','packed_gross'); END IF;
 IF field='dimensions' THEN e:=e||jsonb_build_object('value',jsonb_build_array(18.5,14,4.5),'unit','cm','semantic','packed_dimensions'); END IF;
 sku:=jsonb_set(sku,ARRAY['evidence',field],e); END LOOP;
 obs:=jsonb_build_object('offerId',target,'sourceUrl',url,'title','FIXTURE -- ROLLBACK ONLY','observedAt',clock_timestamp(),'images','[]'::jsonb,'supplier',NULL,'skuObservations',jsonb_build_array(sku));
 input:=jsonb_build_object('workerId',worker,'jobId',claimed->'id','leaseId',claimed->'lease_id','result',jsonb_build_object('kind','refresh','status','ELIGIBLE','observation',obs));
 BEGIN
 PERFORM public.seller_os_research_operation(wp,actor,'complete',jsonb_set(input,'{result,observation,skuObservations,0,evidence,grossWeight,semantic}','"net"'));
 RAISE EXCEPTION 'net weight accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM public.seller_os_research_operation(wp,actor,'complete',jsonb_set(input,'{result,observation,skuObservations,0,evidence,grossWeight,scope,quantity}','12'));
 RAISE EXCEPTION 'carton weight accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 result:=public.seller_os_research_operation(wp,actor,'complete',input);
 again:=public.seller_os_research_operation(wp,actor,'complete',input);
 IF result IS DISTINCT FROM again THEN RAISE EXCEPTION 'completion not idempotent'; END IF;
 SELECT count(*) INTO n FROM public.seller_os_candidate_events WHERE workspace_id=wp AND request_id=(j->>'id')::uuid;
 IF n<>1 THEN RAISE EXCEPTION 'duplicate event'; END IF;
 SELECT count(*) INTO n FROM public.seller_os_candidates WHERE workspace_id=wp AND offer_id=target;
 IF n<>1 THEN RAISE EXCEPTION 'candidate missing'; END IF;
 BEGIN
 PERFORM public.seller_os_research_operation(wp,actor,'complete',jsonb_set(input,'{result,status}','"HOLD"'));
 RAISE EXCEPTION 'changed completion accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 -- A fresh job refreshes the same candidate and clears confirmations.
 UPDATE public.seller_os_candidates SET data=jsonb_set(data,'{terms,costsConfirmed}','true') WHERE workspace_id=wp AND offer_id=target;
 UPDATE public.seller_os_candidates SET data=jsonb_set(data,'{review,reasons}','["user hold reason"]') WHERE workspace_id=wp AND offer_id=target;
 j:=public.seller_os_research_operation(wp,actor,'enqueue',jsonb_build_object('requestId',gen_random_uuid(),'kind','refresh','url',url));
 claimed:=public.seller_os_research_operation(wp,actor,'claim',jsonb_build_object('workerId',worker));
 input:=input||jsonb_build_object('jobId',claimed->'id','leaseId',claimed->'lease_id');
 result:=public.seller_os_research_operation(wp,actor,'complete',input);
 IF result->>'revision'<>'2' OR (SELECT data#>>'{terms,costsConfirmed}' FROM public.seller_os_candidates WHERE workspace_id=wp AND offer_id=target)<>'false' THEN RAISE EXCEPTION 'refresh did not invalidate review'; END IF;
 IF NOT (SELECT data#>'{review,reasons}' @> '["user hold reason"]' FROM public.seller_os_candidates WHERE workspace_id=wp AND offer_id=target) THEN RAISE EXCEPTION 'user hold reason erased'; END IF;
 -- Incomplete *new* offer is job-only, not a candidate.
 url:='https://detail.1688.com/offer/99999900002.html';
 j:=public.seller_os_research_operation(wp,actor,'enqueue',jsonb_build_object('requestId',gen_random_uuid(),'kind','refresh','url',url));
 claimed:=public.seller_os_research_operation(wp,actor,'claim',jsonb_build_object('workerId',worker));
 input:=jsonb_build_object('workerId',worker,'jobId',claimed->'id','leaseId',claimed->'lease_id','result',jsonb_build_object('kind','refresh','status','HOLD','reasons',jsonb_build_array('missing packed weight'),'observation',obs||jsonb_build_object('offerId','99999900002','sourceUrl',url)));
 PERFORM public.seller_os_research_operation(wp,actor,'complete',input);
 IF EXISTS(SELECT 1 FROM public.seller_os_candidates WHERE workspace_id=wp AND offer_id='99999900002') THEN RAISE EXCEPTION 'incomplete new offer stored'; END IF;
 -- Expired lease is recoverable, but the old lease cannot finish.
 j:=public.seller_os_research_operation(wp,actor,'enqueue',jsonb_build_object('requestId',gen_random_uuid(),'kind','refresh','url',url));
 claimed:=public.seller_os_research_operation(wp,actor,'claim',jsonb_build_object('workerId',worker));
 input:=input||jsonb_build_object('jobId',claimed->'id','leaseId',claimed->'lease_id');
 UPDATE public.seller_os_research_jobs SET lease_until=clock_timestamp()-interval '1 second' WHERE id=(claimed->>'id')::uuid;
 again:=public.seller_os_research_operation(wp,actor,'claim',jsonb_build_object('workerId',worker));
 IF again->>'lease_id'=claimed->>'lease_id' THEN RAISE EXCEPTION 'lease not replaced'; END IF;
 BEGIN PERFORM public.seller_os_research_operation(wp,actor,'complete',input);RAISE EXCEPTION 'stale lease accepted';EXCEPTION WHEN serialization_failure THEN NULL;END;
 BEGIN PERFORM public.seller_os_research_operation(wp,gen_random_uuid(),'list','{}');RAISE EXCEPTION 'nonmember accepted';EXCEPTION WHEN insufficient_privilege THEN NULL;END;
 IF has_function_privilege('authenticated','public.seller_os_research_operation(uuid,uuid,text,jsonb)','execute') OR has_function_privilege('anon','public.seller_os_research_operation(uuid,uuid,text,jsonb)','execute') THEN RAISE EXCEPTION 'client RPC privilege leak'; END IF;
END $$;
ROLLBACK;
SELECT 'PASS: queue replay, serial claim, atomic candidate/event/result, refresh invalidation, incomplete rejection, lease recovery, membership and RPC ACL; fixtures rolled back' AS result;
