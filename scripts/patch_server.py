"""
Patch server.cjs to add contractTemplates support.
Edits file in-place based on line content matching.
"""
import re
import sys

filepath = sys.argv[1] if len(sys.argv) > 1 else 'server.cjs'

with open(filepath, 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

changes = 0

# Find the line with quoteServiceTemplates const (after quickTemplates)
for i, line in enumerate(lines):
    if 'const quoteServiceTemplates = Array.isArray(state.quoteServiceTemplates)' in line:
        indent = line[:len(line) - len(line.lstrip())]
        new_line = f'{indent}const contractTemplates = Array.isArray(state.contractTemplates) ? state.contractTemplates : [];\n'
        lines.insert(i + 1, new_line)
        changes += 1
        print(f'Added contractTemplates const at line {i+2}')
        break

# Find the INSERT for quoteServiceTemplates and add contractTemplates after it
for i, line in enumerate(lines):
    if "VALUES ('quoteServiceTemplates', ?)" in line:
        # Find the closing of this INSERT block (the next `await conn.query(` or `INSERT INTO`)
        # We need to add after the `[JSON.stringify(quoteServiceTemplates)]` line
        for j in range(i, min(i + 10, len(lines))):
            if 'JSON.stringify(quoteServiceTemplates)' in lines[j]:
                indent = lines[j][:len(lines[j]) - len(lines[j].lstrip())]
                insert_code = (
                    f'{indent});\n'
                    f'{indent}await conn.query(\n'
                    f'{indent}  `\n'
                    f'{indent}    INSERT INTO app_state_kv (clave, valor_json)\n'
                    f'{indent}    VALUES (\'contractTemplates\', ?)\n'
                    f'{indent}    ON DUPLICATE KEY UPDATE valor_json = VALUES(valor_json)\n'
                    f'{indent}  `,\n'
                    f'{indent}  [JSON.stringify(contractTemplates)]\n'
                )
                # Insert after this line (after the closing )
                # This line is `[JSON.stringify(quoteServiceTemplates)]`
                # After it there should be `    );`
                if j + 1 < len(lines) and ');' in lines[j + 1]:
                    lines.insert(j + 2, insert_code)
                else:
                    lines.insert(j + 1, insert_code)
                changes += 1
                print(f'Added contractTemplates INSERT after line {j+1}')
                break
        break

# Find the quickTemplatesRow and add contractTemplatesRow before it
for i, line in enumerate(lines):
    if 'const quickTemplatesRow = appStateRows.find((r) => str(r.clave) === "quickTemplates")' in line:
        indent = line[:len(line) - len(line.lstrip())]
        new_line = f'{indent}const contractTemplatesRow = appStateRows.find((r) => str(r.clave) === "contractTemplates");\n'
        lines.insert(i, new_line)
        changes += 1
        print(f'Added contractTemplatesRow finder at line {i+1}')
        break

# Find the end of quoteServiceTemplates parsing and add contractTemplates parsing after it
for i, line in enumerate(lines):
    if 'if (quoteServiceTemplatesRow?.valor_json)' in line:
        # Find the closing } of this block
        brace_count = 0
        for j in range(i, min(i + 15, len(lines))):
            stripped = lines[j].strip()
            if stripped.startswith('if '):
                # Find the opening brace
                for k in range(j, min(j + 3, len(lines))):
                    if '{' in lines[k]:
                        brace_count = 1
                        break
                continue
            if '{' in stripped:
                brace_count += stripped.count('{') - stripped.count('}')
            elif '}' in stripped:
                brace_count -= stripped.count('}')
                if brace_count <= 0:
                    indent = lines[j][:len(lines[j]) - len(lines[j].lstrip())]
                    parsing_block = (
                        f'{indent}if (contractTemplatesRow?.valor_json) {{\n'
                        f'{indent}  try {{\n'
                        f'{indent}    const parsed = JSON.parse(contractTemplatesRow.valor_json);\n'
                        f'{indent}    state.contractTemplates = Array.isArray(parsed) ? parsed : [];\n'
                        f'{indent}  }} catch (_) {{\n'
                        f'{indent}    state.contractTemplates = [];\n'
                        f'{indent}  }}\n'
                        f'{indent}}}\n'
                    )
                    lines.insert(j + 1, parsing_block)
                    changes += 1
                    print(f'Added contractTemplates parsing after line {j+1}')
                    break
        break

# Write back
with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(lines)

print(f'\n✅ Applied {changes} changes to server.cjs')
