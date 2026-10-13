import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('[auth] JWT_SECRET no está definido en las variables de entorno. Agrega JWT_SECRET a tu archivo .env');
}

export function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
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
