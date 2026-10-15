import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
// Assessment only. Never changes billing, policy, DB or enables a budget itself.
export function assessMediaPreflight(evidence, now = Date.now()) {
 const reasons = [], e = evidence ?? {}, checked = Date.parse(e.checkedAt), end = Date.parse(e.periodEnd);
 if (e.projectRef !== 'dzgczkwwezzsfqnjdqen' || e.organizationId !== 'ayericfklynxhwgqjutn' || e.plan !== 'Free') reasons.push('대상 프로젝트·조직의 실제 Free 플랜 미확인');
 if (!Number.isFinite(checked) || checked > now || now - checked > 86400000 || !(Date.parse(e.periodStart) <= now && end > now)) reasons.push('현재 사용량 기간·확인 시각 미확인 또는 만료');
 if (e.policiesSafe !== true) reasons.push('현재 Storage 정책·직접 접근 차단 미검증');
 if (e.hostedDecoderPass !== true) reasons.push('실제 hosted 디코더 자원 검증 미통과');
 const required = { storageBytes: 128 * 1048576, egressBytes: 128 * 1048576, databaseBytes: 16 * 1048576, edgeInvocations: 1000 };
 for (const [key, reserve] of Object.entries(required)) { const u = e.usage?.[key]; if (!u || !Number.isFinite(u.used) || !Number.isFinite(u.limit) || u.used < 0 || u.limit <= 0 || u.limit - u.used < reserve) reasons.push(`${key}: 현재 무료 여유 미확인 또는 부족`); }
 return { enabled: reasons.length === 0, reasons, ...(reasons.length ? {} : { enabledUntil: new Date(Math.min(checked + 86400000, end)).toISOString(), storageLimit: 67108864, readLimit: 67108864 }) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
 let evidence = null;
 if (process.argv[2]) evidence = JSON.parse(await readFile(process.argv[2], 'utf8'));
 const result = assessMediaPreflight(evidence); console.log(JSON.stringify(result, null, 2)); if (!result.enabled) process.exitCode = 1;
}
