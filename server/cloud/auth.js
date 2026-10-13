import { failure, uuid } from './errors.js';

export async function authenticateRequest({authorization,workspaceId},{getUser,getMembership}) {
 if(!uuid(workspaceId))throw failure('WORKSPACE_REQUIRED');
 if(typeof authorization!=='string'||!/^Bearer [^\s]+$/i.test(authorization))throw failure('SIGN_IN_REQUIRED',401);
 const user=await getUser(authorization.slice(7));
 if(!user?.id||user.is_anonymous===true)throw failure('SESSION_INVALID',401);
 const member=await getMembership(workspaceId,user.id);
 if(member?.role!=='owner')throw failure('WORKSPACE_FORBIDDEN',403);
 return {userId:user.id,workspaceId};
}
