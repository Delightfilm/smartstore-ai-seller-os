-- Add only Seller OS connection metadata. No Naver secrets or account payloads.
CREATE TABLE public.seller_os_commerce_connections (
 workspace_id uuid PRIMARY KEY REFERENCES public.seller_os_workspaces(id),
 provider text NOT NULL DEFAULT 'NAVER_COMMERCE' CHECK (provider='NAVER_COMMERCE'),
 source text NOT NULL DEFAULT 'LOCAL_WORKER_REPORTED' CHECK (source='LOCAL_WORKER_REPORTED'),
 channel jsonb,
 status text NOT NULL CHECK (status IN ('VERIFIED','FAILED')),
 error_code text CHECK (error_code IN ('IP_REJECTED','AUTH_FAILED','FORBIDDEN','RATE_LIMITED','TIMEOUT','UPSTREAM_INVALID','CHANNEL_MISMATCH')),
 attempted_at timestamptz NOT NULL,
 succeeded_at timestamptz,
 received_at timestamptz NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 revision integer NOT NULL CHECK (revision>0),
 CHECK ((status='VERIFIED' AND error_code IS NULL AND channel IS NOT NULL AND succeeded_at IS NOT NULL) OR (status='FAILED' AND error_code IS NOT NULL)),
 CHECK (channel IS NULL OR (
  jsonb_typeof(channel)='object' AND channel ?& ARRAY['channelNo','name','url']
  AND (channel - ARRAY['channelNo','name','url'])='{}'::jsonb
  AND jsonb_typeof(channel->'channelNo')='string' AND channel->>'channelNo' ~ '^[0-9]{1,32}$' AND channel->>'channelNo' !~ '^0+$'
  AND jsonb_typeof(channel->'name')='string' AND length(btrim(channel->>'name')) BETWEEN 1 AND 200 AND channel->>'name' !~ '[[:cntrl:]<>]'
  AND jsonb_typeof(channel->'url')='string' AND length(channel->>'url')<=500
  AND channel->>'url' ~ '^https://(smartstore|brand)\.naver\.com/[^?#[:space:]]+$'
 ))
);
CREATE INDEX seller_os_commerce_actor_idx ON public.seller_os_commerce_connections(actor_id);
ALTER TABLE public.seller_os_commerce_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.seller_os_commerce_connections FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.seller_os_commerce_connections TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.seller_os_commerce_connections TO service_role;
CREATE POLICY seller_os_commerce_owner_read ON public.seller_os_commerce_connections
 FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.seller_os_workspace_members m
  WHERE m.workspace_id=seller_os_commerce_connections.workspace_id AND m.user_id=(SELECT auth.uid()) AND m.role='owner'
  AND coalesce((SELECT auth.jwt()->>'is_anonymous'),'false')='false'
 ));

CREATE FUNCTION public.seller_os_publish_commerce_connection(p_workspace_id uuid,p_actor_id uuid,p_expected_revision bigint,p_report jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous public.seller_os_commerce_connections; saved public.seller_os_commerce_connections; stamp timestamptz=clock_timestamp();
BEGIN
 IF p_expected_revision IS NULL OR p_expected_revision<0 OR p_expected_revision>2147483646
 OR jsonb_typeof(p_report) IS DISTINCT FROM 'object'
 OR NOT p_report ?& ARRAY['status','channel','errorCode']
 OR (p_report - ARRAY['status','channel','errorCode'])<>'{}'::jsonb THEN
  RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='COMMERCE_REPORT_INVALID';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.seller_os_workspace_members WHERE workspace_id=p_workspace_id AND user_id=p_actor_id AND role='owner') THEN
  RAISE EXCEPTION USING ERRCODE='42501',MESSAGE='WORKSPACE_FORBIDDEN';
 END IF;
 -- Transaction advisory lock also serializes two first inserts, without giving
 -- service_role UPDATE privileges on the existing workspace table.
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_workspace_id::text,0));
 SELECT * INTO previous FROM public.seller_os_commerce_connections WHERE workspace_id=p_workspace_id;
 IF coalesce(previous.revision,0)<>p_expected_revision THEN
  RAISE EXCEPTION USING ERRCODE='40001',MESSAGE='COMMERCE_REVISION_CONFLICT';
 END IF;
 IF p_report->>'status'='VERIFIED' AND p_report->'errorCode'='null'::jsonb AND jsonb_typeof(p_report->'channel')='object' THEN
  IF previous.channel IS NOT NULL AND previous.channel->>'channelNo' IS DISTINCT FROM p_report#>>'{channel,channelNo}' THEN
   RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='CHANNEL_MISMATCH';
  END IF;
 ELSIF p_report->>'status'='FAILED' AND p_report->'channel'='null'::jsonb
 AND p_report->>'errorCode' IN ('IP_REJECTED','AUTH_FAILED','FORBIDDEN','RATE_LIMITED','TIMEOUT','UPSTREAM_INVALID','CHANNEL_MISMATCH') THEN
  NULL;
 ELSE RAISE EXCEPTION USING ERRCODE='22023',MESSAGE='COMMERCE_REPORT_INVALID'; END IF;
 INSERT INTO public.seller_os_commerce_connections(workspace_id,channel,status,error_code,attempted_at,succeeded_at,received_at,actor_id,revision)
 VALUES(p_workspace_id,CASE WHEN p_report->>'status'='VERIFIED' THEN p_report->'channel' ELSE previous.channel END,
 p_report->>'status',p_report->>'errorCode',stamp,CASE WHEN p_report->>'status'='VERIFIED' THEN stamp ELSE previous.succeeded_at END,stamp,p_actor_id,coalesce(previous.revision,0)+1)
 ON CONFLICT(workspace_id) DO UPDATE SET channel=excluded.channel,status=excluded.status,error_code=excluded.error_code,
 attempted_at=excluded.attempted_at,succeeded_at=excluded.succeeded_at,received_at=excluded.received_at,actor_id=excluded.actor_id,revision=excluded.revision
 RETURNING * INTO saved;
 RETURN jsonb_build_object('workspaceId',saved.workspace_id,'provider',saved.provider,'source',saved.source,'channel',saved.channel,'status',saved.status,'errorCode',saved.error_code,
 'attemptedAt',saved.attempted_at,'succeededAt',saved.succeeded_at,'receivedAt',saved.received_at,'actorId',saved.actor_id,'revision',saved.revision);
END;
$$;
REVOKE ALL ON FUNCTION public.seller_os_publish_commerce_connection(uuid,uuid,bigint,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seller_os_publish_commerce_connection(uuid,uuid,bigint,jsonb) TO service_role;
