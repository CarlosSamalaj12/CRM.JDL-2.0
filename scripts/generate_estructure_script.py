#!/usr/bin/env python3
"""
Script to generate a SQL file with:
- All table structures (CREATE TABLE) without data
- ONLY the usuarios table preserves its INSERT data
"""

import re
import os

backup_path = os.path.join(os.path.dirname(__file__), '..', 'db', 'backup_completo.sql')
output_path = os.path.join(os.path.dirname(__file__), '..', 'db', 'estructura_completa_con_usuarios.sql')

with open(backup_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Split the content into sections
# Each section starts with "--\n-- Table:" 
sections = re.split(r'(?=^\s*--\s*\n\s*--\s*Table:)', content, flags=re.MULTILINE)

output_lines = [
    '-- ============================================================',
    '-- ESTRUCTURA COMPLETA: crm_jdl',
    '-- Este script contiene:',
    '--   - CREATE TABLE de todas las tablas (sin datos)',
    '--   - INSERT de la tabla usuarios (con datos conservados)',
    '-- ============================================================',
    '',
    'SET FOREIGN_KEY_CHECKS = 0;',
    'SET UNIQUE_CHECKS = 0;',
    '',
]

usuarios_found = False

for section in sections:
    section = section.strip()
    if not section:
        continue
    
    # Extract table name
    table_match = re.search(r'--\s*Table:\s*(\S+)', section)
    if not table_match:
        # Maybe it's the header/beginning
        output_lines.append(section)
        continue
    
    table_name = table_match.group(1)
    
    # Extract CREATE TABLE statement
    create_match = re.search(r'(CREATE TABLE\s+`' + re.escape(table_name) + r'`\s*\(.*?\)\s*ENGINE=InnoDB[^;]*;)', section, re.DOTALL)
    
    if not create_match:
        output_lines.append(f'\n-- [WARNING: Could not extract CREATE TABLE for {table_name}]\n')
        continue
    
    create_stmt = create_match.group(1)
    
    # Add the CREATE TABLE
    output_lines.append(f'\n--\n-- Table: {table_name}\n--\n')
    output_lines.append(f'DROP TABLE IF EXISTS `{table_name}`;')
    output_lines.append(create_stmt)
    output_lines.append('')
    
    # If this is usuarios table, extract and keep the INSERT data
    if table_name.lower() == 'usuarios':
        usuarios_found = True
        # Extract INSERT INTO usuarios
        insert_match = re.search(rf'(INSERT INTO `usuarios`[^;]*;)', section, re.DOTALL)
        if insert_match:
            output_lines.append(insert_match.group(1))
            output_lines.append('')
        else:
            output_lines.append('-- [WARNING: No INSERT data found for usuarios table]\n')

output_lines.append('')
output_lines.append('SET UNIQUE_CHECKS = 1;')
output_lines.append('SET FOREIGN_KEY_CHECKS = 1;')
output_lines.append('')
output_lines.append('-- ============================================================')
output_lines.append('-- FIN DEL SCRIPT')
output_lines.append('-- ============================================================')

# Write output
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(output_lines))

print(f"✅ Script generado exitosamente en: {output_path}")
print(f"   - Tablas incluidas: estructura (CREATE TABLE) de todas las tablas")
print(f"   - Datos de usuarios {'✓ conservados' if usuarios_found else '✗ NO encontrados'}")
