ALTER TABLE seller_os_private.write_requests ADD COLUMN client_input jsonb;
GRANT UPDATE (client_input) ON seller_os_private.write_requests TO service_role;

CREATE FUNCTION public.seller_os_replay_request(p_workspace uuid,p_actor uuid,p_request uuid,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE saved seller_os_private.write_requests%ROWTYPE;
BEGIN
 IF p_input IS NULL OR jsonb_typeof(p_input)<>'object' OR octet_length(p_input::text)>65536 THEN
  RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.seller_os_workspace_members WHERE workspace_id=p_workspace AND user_id=p_actor AND role='owner') THEN
  RAISE EXCEPTION 'WORKSPACE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT * INTO saved FROM seller_os_private.write_requests WHERE workspace_id=p_workspace AND request_id=p_request;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF saved.actor_id<>p_actor OR saved.client_input IS DISTINCT FROM p_input THEN
  RAISE EXCEPTION 'REQUEST_REUSED' USING ERRCODE='22023'; END IF;
 RETURN saved.result;
END $$;
REVOKE ALL ON FUNCTION public.seller_os_replay_request(uuid,uuid,uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seller_os_replay_request(uuid,uuid,uuid,jsonb) TO service_role;

CREATE FUNCTION public.seller_os_commit_candidate(p_workspace uuid,p_actor uuid,p_request uuid,p_offer text,p_expected integer,p_patch jsonb,p_input jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result jsonb;
BEGIN
 IF p_workspace IS NULL OR p_actor IS NULL OR p_request IS NULL THEN
  RAISE EXCEPTION 'INVALID_REQUEST' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':request:'||p_request::text,0));
 result:=public.seller_os_replay_request(p_workspace,p_actor,p_request,p_input);
 IF result IS NOT NULL THEN RETURN result; END IF;
 result:=public.seller_os_save_candidate(p_workspace,p_actor,p_request,p_offer,p_expected,p_patch);
 UPDATE seller_os_private.write_requests SET client_input=p_input WHERE workspace_id=p_workspace AND request_id=p_request;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.seller_os_commit_candidate(uuid,uuid,uuid,text,integer,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seller_os_commit_candidate(uuid,uuid,uuid,text,integer,jsonb,jsonb) TO service_role;
