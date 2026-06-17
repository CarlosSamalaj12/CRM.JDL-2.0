import { z } from 'zod';

export const createIngredienteSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(150),
  tipo: z.enum(['carne', 'guarnición', 'salsa', 'postre', 'bebida', 'otros'], {
    errorMap: () => ({ message: 'Tipo inválido: debe ser carne, guarnición, salsa, postre, bebida u otros' }),
  }),
});

export const createOpcionIngredienteSchema = z.object({
  ingrediente_id: z.number().int().positive('El ingrediente_id debe ser un entero positivo'),
  nombre_opcion: z.string().min(1, 'El nombre de la opción es obligatorio').max(150),
});

export const createMenuSchema = z.object({
  nombre_menu: z.string().min(1, 'El nombre del menú es obligatorio').max(150),
  descripcion: z.string().max(500).optional().default(''),
});

export const createMenuItemSchema = z.object({
  menu_id: z.number().int().positive('El menu_id debe ser un entero positivo'),
  ingrediente_id: z.number().int().positive('El ingrediente_id debe ser un entero positivo'),
  opcion_id: z.number().int().positive().nullable().optional().default(null),
  cantidad: z.number().positive('La cantidad debe ser un número positivo').default(1),
});
