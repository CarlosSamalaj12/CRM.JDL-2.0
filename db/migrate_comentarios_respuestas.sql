-- Migración para agregar sistema de respuestas a comentarios
-- Agrega campo parent_id para soportar hilos de comentarios

ALTER TABLE informe_comentarios 
ADD COLUMN parent_id INT NULL AFTER dia_id,
ADD CONSTRAINT fk_comentario_parent 
FOREIGN KEY (parent_id) REFERENCES informe_comentarios(id) 
ON DELETE CASCADE;

-- Índice para optimizar consultas de respuestas
CREATE INDEX idx_comentarios_parent ON informe_comentarios(parent_id);
