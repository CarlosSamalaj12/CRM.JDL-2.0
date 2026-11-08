import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('[auth] JWT_SECRET no está definido en las variables de entorno. Agrega JWT_SECRET a tu archivo .env');
}

export function generateToken(payload) {
  const verInfo = typeof global.__readAppVersion === 'function' ? global.__readAppVersion() : null;
  const appVersion = verInfo?.version || payload?.appVersion;
  return jwt.sign({ ...payload, ...(appVersion ? { appVersion } : {}) }, JWT_SECRET, { expiresIn: '7d' });
}

export function authenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = (header && header.startsWith('Bearer '))
    ? header.split(' ')[1]
    : (req.query?.token || null);

  if (!token) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof global.__readAppVersion === 'function') {
      const verInfo = global.__readAppVersion();
      if (verInfo && verInfo.version && verInfo.version !== '0.0.0-dev' && verInfo.forceLogout !== false) {
        if (!decoded.appVersion || decoded.appVersion !== verInfo.version) {
          return res.status(401).json({
            ok: false,
            code: 'VERSION_MISMATCH',
            version: verInfo.version,
            message: verInfo.message || 'Se ha desplegado una nueva versión del sistema. Inicie sesión nuevamente.'
          });
        }
      }
    }
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

export function authorizeRoles(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(r => String(r).toLowerCase());
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'No autenticado' });
    }
    const userRole = String(req.user.rol || req.user.role || '').toLowerCase();
    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({ message: 'No tienes permiso para realizar esta acción' });
    }
    next();
  };
}

export function optionalAuthenticate(req, res, next) {
  const header = req.headers.authorization;
  const token = (header && header.startsWith('Bearer '))
    ? header.split(' ')[1]
    : (req.query?.token || null);

  if (!token) {
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (typeof global.__readAppVersion === 'function') {
      const verInfo = global.__readAppVersion();
      if (verInfo && verInfo.version && verInfo.version !== '0.0.0-dev' && verInfo.forceLogout !== false) {
        if (!decoded.appVersion || decoded.appVersion !== verInfo.version) {
          return next();
        }
      }
    }
    req.user = decoded;
  } catch {
    // Si el token es inválido o expiró, continuamos como no autenticado
  }
  return next();
}
