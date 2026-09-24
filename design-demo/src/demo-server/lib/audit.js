import { db } from '../db.js';

/**
 * BR-12 — every state-changing action is written here.
 * R-6.20.1 — append only. There is deliberately no update() or delete()
 * exported from this module, and no route that reaches one.
 */
export function audit(req, action, { entityType = null, entityId = null, before = null, after = null } = {}) {
  db.prepare(
    `INSERT INTO audit_log
       (actor_id, actor_role, ip_address, user_agent, action, entity_type, entity_id, before_json, after_json)
     VALUES (?,?,?,?,?,?,?,?,?)`
  ).run(
    req?.user?.id ?? null,
    req?.user?.role ?? null,
    ipOf(req),
    (req?.get?.('user-agent') || '').slice(0, 300),
    action,
    entityType,
    entityId == null ? null : String(entityId),
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null
  );
}

/** For scheduler and seed activity, where there is no request. */
export function auditSystem(action, { entityType = null, entityId = null, before = null, after = null } = {}) {
  db.prepare(
    `INSERT INTO audit_log (actor_id, actor_role, action, entity_type, entity_id, before_json, after_json)
     VALUES (NULL,'system',?,?,?,?,?)`
  ).run(
    action,
    entityType,
    entityId == null ? null : String(entityId),
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null
  );
}

export function ipOf(req) {
  if (!req) return null;
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || null;
}
