-- Additive Seller OS area. Do not reset or push this shared project's whole schema.
CREATE SCHEMA seller_os_private;
REVOKE ALL ON SCHEMA seller_os_private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA seller_os_private TO service_role;

CREATE TABLE public.seller_os_workspaces (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.seller_os_workspace_members (
 workspace_id uuid NOT NULL REFERENCES public.seller_os_workspaces(id),
 user_id uuid NOT NULL REFERENCES auth.users(id),
 role text NOT NULL CHECK (role = 'owner'),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (workspace_id,user_id)
);
CREATE INDEX seller_os_member_user_idx ON public.seller_os_workspace_members(user_id,workspace_id);
CREATE TABLE public.seller_os_candidates (
 workspace_id uuid NOT NULL REFERENCES public.seller_os_workspaces(id),
 source text NOT NULL DEFAULT '1688' CHECK (source='1688'),
 offer_id text NOT NULL CHECK (offer_id ~ '^[0-9]{1,32}$'),
 revision integer NOT NULL CHECK (revision>0),
 data jsonb NOT NULL CHECK (jsonb_typeof(data)='object'),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (workspace_id,source,offer_id),
 CHECK ((data->>'id') IS NOT DISTINCT FROM offer_id),
 CHECK ((data->>'revision') IS NOT DISTINCT FROM revision::text),
 CHECK ((data#>>'{publication,status}') IS NOT DISTINCT FROM 'NOT_PUBLISHED')
);
CREATE TABLE public.seller_os_candidate_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL,
 source text NOT NULL DEFAULT '1688' CHECK (source='1688'),
 offer_id text NOT NULL,
 revision integer NOT NULL CHECK (revision>0),
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 request_id uuid NOT NULL,
 kind text NOT NULL CHECK (kind IN ('created','updated')),
 changed_fields text[] NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (workspace_id,source,offer_id) REFERENCES public.seller_os_candidates(workspace_id,source,offer_id),
 UNIQUE (workspace_id,source,offer_id,revision),
 UNIQUE (workspace_id,request_id)
);
CREATE INDEX seller_os_event_actor_idx ON public.seller_os_candidate_events(actor_id);
CREATE TABLE seller_os_private.write_requests (
 workspace_id uuid NOT NULL REFERENCES public.seller_os_workspaces(id),
 request_id uuid NOT NULL,
 actor_id uuid NOT NULL REFERENCES auth.users(id),
 input jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY (workspace_id,request_id)
);
CREATE INDEX seller_os_request_actor_idx ON seller_os_private.write_requests(actor_id);

ALTER TABLE public.seller_os_workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_os_workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_os_candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_os_candidate_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_os_private.write_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.seller_os_workspaces, public.seller_os_workspace_members,
 public.seller_os_candidates, public.seller_os_candidate_events, seller_os_private.write_requests
 FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.seller_os_workspaces, public.seller_os_workspace_members,
 public.seller_os_candidates, public.seller_os_candidate_events TO authenticated;
GRANT SELECT,INSERT ON public.seller_os_workspaces,public.seller_os_workspace_members,
 public.seller_os_candidate_events,seller_os_private.write_requests TO service_role;
GRANT SELECT,INSERT,UPDATE ON public.seller_os_candidates TO service_role;

CREATE POLICY seller_os_own_membership ON public.seller_os_workspace_members
 FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY seller_os_member_workspaces ON public.seller_os_workspaces
 FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.seller_os_workspace_members m WHERE m.workspace_id=id AND m.user_id=(SELECT auth.uid())
 ));
CREATE POLICY seller_os_member_candidates ON public.seller_os_candidates
 FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.seller_os_workspace_members m WHERE m.workspace_id=seller_os_candidates.workspace_id AND m.user_id=(SELECT auth.uid())
 ));
CREATE POLICY seller_os_member_events ON public.seller_os_candidate_events
 FOR SELECT TO authenticated USING (EXISTS (
  SELECT 1 FROM public.seller_os_workspace_members m WHERE m.workspace_id=seller_os_candidate_events.workspace_id AND m.user_id=(SELECT auth.uid())
 ));
-- No end-user policy on private replay records; only the server role may access them.
CREATE POLICY seller_os_server_requests ON seller_os_private.write_requests
 TO service_role USING (true) WITH CHECK (true);

CREATE FUNCTION public.seller_os_save_candidate(
 p_workspace uuid, p_actor uuid, p_request uuid, p_offer text, p_expected integer, p_patch jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE previous public.seller_os_candidates%ROWTYPE;
 request_input jsonb;
 saved seller_os_private.write_requests%ROWTYPE;
 next_data jsonb;
 next_revision integer;
 stamp timestamptz := clock_timestamp();
 fields text[];
BEGIN
 IF p_workspace IS NULL OR p_actor IS NULL OR p_request IS NULL OR p_offer IS NULL
 OR p_offer !~ '^[0-9]{1,32}$' OR p_expected IS NULL OR p_expected<0
 OR p_patch IS NULL OR jsonb_typeof(p_patch)<>'object' OR octet_length(p_patch::text)>65536 THEN
  RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE='22023'; END IF;
 IF NOT EXISTS (SELECT 1 FROM public.seller_os_workspace_members WHERE workspace_id=p_workspace AND user_id=p_actor AND role='owner') THEN
  RAISE EXCEPTION 'WORKSPACE_FORBIDDEN' USING ERRCODE='42501'; END IF;
 SELECT array_agg(k ORDER BY k) INTO fields FROM jsonb_object_keys(p_patch) k;
 IF EXISTS (SELECT 1 FROM jsonb_object_keys(p_patch) k WHERE k NOT IN ('product','terms','market','research','review','listing'))
 OR (p_patch ? 'product' AND (jsonb_typeof(p_patch->'product')<>'object' OR (p_patch#>>'{product,offerId}') IS DISTINCT FROM p_offer))
 OR (p_patch ? 'terms' AND jsonb_typeof(p_patch->'terms')<>'object')
 OR (p_patch ? 'listing' AND jsonb_typeof(p_patch->'listing')<>'object')
 OR (p_patch ? 'review' AND p_patch->'review'<>'null'::jsonb AND (jsonb_typeof(p_patch->'review')<>'object' OR COALESCE(p_patch#>>'{review,status}','') NOT IN ('HOLD','REVIEW_REQUIRED')))
 THEN RAISE EXCEPTION 'INVALID_PATCH' USING ERRCODE='22023'; END IF;
 request_input:=jsonb_build_object('actor',p_actor,'offer',p_offer,'expected',p_expected,'patch',p_patch);
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':request:'||p_request::text,0));
 SELECT * INTO saved FROM seller_os_private.write_requests WHERE workspace_id=p_workspace AND request_id=p_request;
 IF FOUND THEN
  IF saved.input IS DISTINCT FROM request_input THEN RAISE EXCEPTION 'REQUEST_REUSED' USING ERRCODE='22023'; END IF;
  RETURN saved.result;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(p_workspace::text||':offer:'||p_offer,0));
 SELECT * INTO previous FROM public.seller_os_candidates WHERE workspace_id=p_workspace AND source='1688' AND offer_id=p_offer FOR UPDATE;
 IF (FOUND AND previous.revision<>p_expected) OR (NOT FOUND AND p_expected<>0) THEN
  RAISE EXCEPTION 'REVISION_CONFLICT' USING ERRCODE='40001'; END IF;
 next_revision:=COALESCE(previous.revision,0)+1;
 IF previous.revision IS NULL THEN
  IF NOT (p_patch ? 'product') THEN RAISE EXCEPTION 'PRODUCT_REQUIRED' USING ERRCODE='22023'; END IF;
  next_data:=jsonb_build_object('terms','{}'::jsonb,'listing','{}'::jsonb,'research',NULL,'review',NULL,'market',NULL,'createdAt',stamp);
 ELSE next_data:=previous.data; END IF;
 next_data:=next_data||p_patch||jsonb_build_object('id',p_offer,'revision',next_revision,'updatedAt',stamp,'publication',jsonb_build_object('status','NOT_PUBLISHED'));
 INSERT INTO public.seller_os_candidates(workspace_id,source,offer_id,revision,data,created_at,updated_at)
 VALUES (p_workspace,'1688',p_offer,next_revision,next_data,COALESCE(previous.created_at,stamp),stamp)
 ON CONFLICT (workspace_id,source,offer_id) DO UPDATE SET revision=EXCLUDED.revision,data=EXCLUDED.data,updated_at=EXCLUDED.updated_at;
 INSERT INTO public.seller_os_candidate_events(workspace_id,source,offer_id,revision,actor_id,request_id,kind,changed_fields,created_at)
 VALUES (p_workspace,'1688',p_offer,next_revision,p_actor,p_request,CASE WHEN next_revision=1 THEN 'created' ELSE 'updated' END,COALESCE(fields,'{}'),stamp);
 INSERT INTO seller_os_private.write_requests(workspace_id,request_id,actor_id,input,result,created_at)
 VALUES (p_workspace,p_request,p_actor,request_input,next_data,stamp);
 RETURN next_data;
END $$;
REVOKE ALL ON FUNCTION public.seller_os_save_candidate(uuid,uuid,uuid,text,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.seller_os_save_candidate(uuid,uuid,uuid,text,integer,jsonb) TO service_role;
