-- All synthetic rows and worker changes are rolled back. Fixed Seller OS workspace only.
BEGIN;
SET LOCAL ROLE service_role;
DO $$
DECLARE wp uuid:='ccb5017e-7c70-414d-b103-38e17e48e799'; actor uuid; worker uuid:=gen_random_uuid(); j jsonb; claimed jsonb; r jsonb; input jsonb; obs jsonb; s jsonb; e jsonb; field text; saved jsonb; n integer;
 p jsonb:='{"salePriceKrw":9900,"fxKrwPerCny":211,"chinaShippingCny":5,"shippingLowKrw":3000,"shippingBaseKrw":5000,"shippingHighKrw":8000,"otherCostKrw":500,"feePercent":6,"returnPercent":3,"minProfitKrw":1000,"minMarginPercent":10,"basis":"Rollback-only operator scenario, not confirmed."}';
 url text:='https://detail.1688.com/offer/99999800001.html';
BEGIN
 SELECT user_id INTO actor FROM public.seller_os_workspace_members WHERE workspace_id=wp AND role='owner';
 UPDATE seller_os_private.research_workers SET enabled=false WHERE workspace_id=wp;
 UPDATE public.seller_os_research_jobs SET status='FAILED' WHERE workspace_id=wp AND status IN ('QUEUED','WAITING_WORKER','RUNNING');
 PERFORM public.seller_os_research_operation(wp,actor,'connect',jsonb_build_object('workerId',worker));
 j:=public.seller_os_research_operation(wp,actor,'enqueue',jsonb_build_object('requestId',gen_random_uuid(),'kind','refresh','url',url,'estimateProfile',p));
 claimed:=public.seller_os_research_operation(wp,actor,'claim',jsonb_build_object('workerId',worker));
 s:=jsonb_build_object('skuId','real-format-fixture','label','fixture','priceCny',3.5,'moq',1,'stock',10,'package',jsonb_build_object('grossWeightG',null,'dimensionsCm',null),'evidence','{}'::jsonb);
 FOR field IN SELECT unnest(ARRAY['price','moq','stock']) LOOP
 e:=jsonb_build_object('unit','piece','value',1,'kind','observed','confirmed',true,'sourceUrl',url,'observedAt',clock_timestamp(),'scope',jsonb_build_object('quantity',1,'level','sku','skuId','real-format-fixture'));
 IF field='price' THEN e:=e||jsonb_build_object('unit','CNY','value',3.5); END IF;
 IF field='stock' THEN e:=e||jsonb_build_object('value',10); END IF;
 s:=jsonb_set(s,ARRAY['evidence',field],e); END LOOP;
 obs:=jsonb_build_object('offerId','99999800001','sourceUrl',url,'title','ROLLBACK ONLY','observedAt',clock_timestamp(),'skuSetComplete',true,'skuLimitExceeded',false,'skuObservations',jsonb_build_array(s),'images','[]'::jsonb);
 -- Derive the estimate independently on the database, then test transactional save/replay.
 r:=jsonb_build_object('kind','refresh','status','PROVISIONAL','reasons',jsonb_build_array('수익성 확정 보류'),'observation',obs,'estimate',seller_os_private.discovery_estimate(obs,p));
 input:=jsonb_build_object('workerId',worker,'jobId',claimed->'id','leaseId',claimed->'lease_id','result',r);
 BEGIN
 PERFORM public.seller_os_research_operation(wp,actor,'complete',jsonb_set(input,'{result,estimate,options,0,scenarios,1,profitKrw}','999999'));
 RAISE EXCEPTION 'forged margin accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM public.seller_os_research_operation(wp,actor,'complete',jsonb_set(input,'{result,observation,skuSetComplete}','false'));
 RAISE EXCEPTION 'partial SKU set accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 BEGIN
 PERFORM public.seller_os_research_operation(wp,actor,'complete',jsonb_set(input,'{result,observation,skuObservations,0,moq}','2'));
 RAISE EXCEPTION 'MOQ2 accepted'; EXCEPTION WHEN invalid_parameter_value THEN NULL; END;
 saved:=public.seller_os_research_operation(wp,actor,'complete',input);
 IF saved->>'candidateId' IS DISTINCT FROM '99999800001' THEN RAISE EXCEPTION 'provisional candidate not saved'; END IF;
 IF public.seller_os_research_operation(wp,actor,'complete',input) IS DISTINCT FROM saved THEN RAISE EXCEPTION 'replay changed'; END IF;
 SELECT data INTO saved FROM public.seller_os_candidates WHERE workspace_id=wp AND offer_id='99999800001';
 IF saved#>>'{review,status}' IS DISTINCT FROM 'HOLD' OR saved#>>'{publication,status}' IS DISTINCT FROM 'NOT_PUBLISHED' OR saved#>>'{product,discoveryEstimate,status}' IS DISTINCT FROM 'PROFITABILITY_PENDING' OR saved#>>'{product,discoveryEstimate,options,0,scenarios,1,profitKrw}' IS DISTINCT FROM '1715' THEN RAISE EXCEPTION 'stored estimate or hold mismatch'; END IF;
 IF saved#>'{product,variants,0,package,grossWeightG}' IS DISTINCT FROM 'null'::jsonb THEN RAISE EXCEPTION 'gross weight invented'; END IF;
 SELECT count(*) INTO n FROM public.seller_os_candidate_events WHERE workspace_id=wp AND offer_id='99999800001';
 IF n<>1 THEN RAISE EXCEPTION 'duplicate event'; END IF;
END $$;
ROLLBACK;
