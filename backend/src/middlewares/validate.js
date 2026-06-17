/**
 * Middleware de validación con Zod.
 * Uso: router.post('/ruta', validate(schema), controller)
 *
 * El schema puede validar:
 *  - req.body  (por defecto)
 *  - req.query (pasar { query: schema })
 *  - req.params (pasar { params: schema })
 */
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
      return res.status(400).json({
        message: 'Error de validación',
        errors,
      });
    }

    // Reemplazar con los datos ya parseados/tipados
    req[source] = result.data;
    next();
  };
}
