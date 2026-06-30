export function emitChange(req, entity, action, extra = {}) {
  if (!req.io) return;
  const payload = { entity, action, ...extra, timestamp: Date.now() };
  req.io.emit('entity:changed', payload);
}
