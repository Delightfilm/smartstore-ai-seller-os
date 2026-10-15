// Optional local real-Postgres-WASM check. No network, hosted DB or credentials.
// Install the pinned test tool in ignored scratch, NOT application dependencies:
// npm install --prefix .seller-os/sql-test --no-save --ignore-scripts @electric-sql/pglite@0.5.10
import { readFile } from 'node:fs/promises';
import { PGlite } from '../.seller-os/sql-test/node_modules/@electric-sql/pglite/dist/index.js';
const db = new PGlite();
const file = path => readFile(new URL('../' + path, import.meta.url), 'utf8');
try {
 await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY,is_anonymous boolean DEFAULT false); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS 'SELECT nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid'; CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql AS 'SELECT coalesce(nullif(current_setting(''request.jwt.claims'',true),''''),''{}'')::jsonb'; GRANT USAGE ON SCHEMA public,auth TO authenticated,service_role; GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);`);
 await db.exec(await file('supabase/migrations/20261013050448_seller_os_isolated_area.sql'));
 await db.exec(`INSERT INTO auth.users(id) VALUES('88888888-8888-4888-8888-888888888888'); INSERT INTO public.seller_os_workspaces(id,name) VALUES('ccb5017e-7c70-414d-b103-38e17e48e799','LOCAL_TEST_ONLY'); INSERT INTO public.seller_os_workspace_members(workspace_id,user_id,role) VALUES('ccb5017e-7c70-414d-b103-38e17e48e799','88888888-8888-4888-8888-888888888888','owner');`);
 await db.exec(await file('supabase/migrations/20261015145622_seller_os_private_detail_media.sql'));
 await db.exec(await file('test/sql/seller-os-media.sql'));
 const { rows } = await db.query('select count(*)::int AS count from public.seller_os_detail_assets');
 if (rows[0].count !== 0) throw new Error('Fixture rollback failed');
 console.log('PASS local Postgres-WASM migration + transactional CAS/replay/scope/count/retained/lease/privileges; fixture rollback 0 assets. NOT hosted/HTTP proof.');
} catch (e) { console.error('FAIL', e.message, e.code ?? ''); process.exitCode = 1; }
finally { await db.close(); }
