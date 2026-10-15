import { readFile } from 'node:fs/promises';
export async function mediaDatabase() {
 const { PGlite } = await import('../../.seller-os/sql-test/node_modules/@electric-sql/pglite/dist/index.js');
 const db = new PGlite();
 const file = path => readFile(new URL('../../' + path, import.meta.url), 'utf8');
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,is_anonymous boolean DEFAULT false); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb'; GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 await db.exec(await file('supabase/migrations/20261013050448_seller_os_isolated_area.sql'));
 await db.exec(`INSERT INTO auth.users(id) VALUES('88888888-8888-4888-8888-888888888888'); INSERT INTO public.seller_os_workspaces(id,name) VALUES('ccb5017e-7c70-414d-b103-38e17e48e799','LOCAL_TEST_ONLY'); INSERT INTO public.seller_os_workspace_members(workspace_id,user_id,role) VALUES('ccb5017e-7c70-414d-b103-38e17e48e799','88888888-8888-4888-8888-888888888888','owner');`);
 await db.exec(await file('supabase/migrations/20261015145622_seller_os_private_detail_media.sql'));
 return db;
}
