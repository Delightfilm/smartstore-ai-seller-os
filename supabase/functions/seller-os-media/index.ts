import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import { authenticateRequest } from '../../../server/cloud/auth.js';
import { createMediaStore } from '../../../server/media/store.js';
import { createMediaHandler } from '../../../server/media/handler.js';
import { validateUploadedImage } from '../../../server/media/imageValidation.js';
import { createJsquashDecoder } from '../../../server/media/jsquashDecoder.js';
import { wasmBytes } from './codecBytes.js';
const url = Deno.env.get('SUPABASE_URL')!;
const publicKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const writer = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
const decoder = createJsquashDecoder({ wasmBytes });
const objects = writer.storage.from('seller-os-detail-media');
const fail = (code: string, status = 503) => Object.assign(new Error(code), { code, status });
Deno.serve(createMediaHandler({
  allowedOrigins: ['http://127.0.0.1:5173', 'http://localhost:5173', 'https://seller-os-delightfilm.pages.dev'],
  authenticate: ({ authorization, workspaceId }: { authorization: string; workspaceId: string }) => authenticateRequest({ authorization, workspaceId }, {
    getUser: async (token: string) => { const { data, error } = await writer.auth.getUser(token); return error ? null : data.user; },
    getMembership: async (workspace: string, actor: string) => {
      const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
      const { data, error } = await client.from('seller_os_workspace_members').select('role').eq('workspace_id', workspace).eq('user_id', actor).maybeSingle(); return error ? null : data;
    },
  }),
  storeFor: ({ userId, workspaceId }: { userId: string; workspaceId: string }) => createMediaStore({ writer, workspaceId, actorId: userId }),
  validateImage: (bytes: Uint8Array, mime: string) => validateUploadedImage(bytes, mime, decoder),
  storage: {
    upload: async (path: string, bytes: Uint8Array, options: { upsert: boolean; contentType: string }) => { const { error } = await objects.upload(path, bytes, options); if (error) throw fail('MEDIA_STORAGE_UNCERTAIN'); },
    read: async (path: string) => { const { data, error } = await objects.download(path); if (error) throw fail(String(error.statusCode) === '404' ? 'MEDIA_OBJECT_MISSING' : 'MEDIA_STORAGE_UNCERTAIN'); if (!data || data.size > 4194304) throw fail('MEDIA_STORAGE_UNCERTAIN'); return new Uint8Array(await data.arrayBuffer()); },
  },
}));
