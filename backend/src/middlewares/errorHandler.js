export function notFound(req, res) {
  res.status(404).json({ message: 'Recurso no encontrado' });
}

export function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ message: 'Error interno del servidor' });
}
