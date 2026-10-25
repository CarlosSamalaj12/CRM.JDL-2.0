import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = process.cwd();

test('Verificación de corrección de scroll, portal de checklist y layout de ConstructorInforme', async (t) => {
  await t.test('SettingsChecklist.jsx protege el portal y el ciclo de vida del scroll', () => {
    const filePath = path.join(projectRoot, 'src/modules/settings/SettingsChecklist.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. El portal de modalContent solo se monta si isOpen es true
    assert.match(
      content,
      /\{isOpen\s*&&\s*ReactDOM\.createPortal\(modalContent,\s*document\.body\)\}/,
      'SettingsChecklist debe montar modalContent en portal solo cuando isOpen es true'
    );

    // 2. El backdrop tiene atributo hidden={!isOpen}
    assert.match(
      content,
      /id="eventChecklistBackdrop"\s+hidden=\{!isOpen\}/,
      'SettingsChecklist debe tener hidden={!isOpen} en #eventChecklistBackdrop'
    );

    // 3. El hook useEffect limpia styleElRef en unmount y restaura overflow
    assert.match(
      content,
      /document\.body\.style\.overflow\s*=\s*'';\s*document\.documentElement\.style\.overflow\s*=\s*'';/,
      'SettingsChecklist debe resetear overflow del body y documentElement en cleanup'
    );

    // 4. No debe tener el timer arbitrario de 2000ms
    assert.doesNotMatch(
      content,
      /setTimeout\(\(\)\s*=>\s*\{\s*document\.body\.style\.overflow\s*=\s*'';\s*\},\s*2000\)/,
      'SettingsChecklist no debe contener setTimeout de 2000ms para resetear overflow'
    );
  });

  await t.test('global.css blinda los backdrops ocultos con display: none !important', () => {
    const filePath = path.join(projectRoot, 'src/styles/global.css');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.match(
      content,
      /#checklistTemplateBackdrop\[hidden\],\s*#eventChecklistBackdrop\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/,
      'global.css debe forzar display: none !important cuando el backdrop tiene [hidden]'
    );
  });

  await t.test('ReportsLayout.jsx erradica el reseteo periódico por timer y oculta el botón flotante en desktop', () => {
    const filePath = path.join(projectRoot, 'src/modules/informes/components/ReportsLayout.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Detección de vista POS
    assert.match(
      content,
      /const isPosView = location\.pathname\.startsWith\('\/informe\/pos'\) \|\| location\.pathname\.startsWith\('\/informe\/create'\);/,
      'ReportsLayout debe detectar rutas del constructor de informe POS'
    );

    // 2. Inclusión de is-pos-view en la clase del shell
    assert.match(
      content,
      /\$\{isPosView \? ' is-pos-view' : ''\}/,
      'ReportsLayout debe inyectar la clase is-pos-view al shell'
    );

    // 3. Eliminación del setInterval de 2000ms que saboteaba el scroll
    assert.doesNotMatch(
      content,
      /setInterval\(\(\)\s*=>\s*\{\s*document\.body\.style\.overflow\s*=\s*'';/,
      'ReportsLayout no debe contener el setInterval de 2000ms que mutaba el overflow del body'
    );

    // 4. Renderizado condicional del botón de hamburguesa flotante solo en mobile y fuera de la vista POS
    assert.match(
      content,
      /\{isMobile\s*&&\s*!isPosView\s*&&\s*\(\s*<button\s+className=\{`mobile-hamburger-btn/,
      'ReportsLayout solo debe montar el botón flotante en mobile cuando no está en vista POS para no obstruir el botón Guardar'
    );

    // 5. Estilo CSS para ocultar el botón flotante en desktop (>= 768px)
    assert.match(
      content,
      /@media \(min-width: 768px\)\s*\{\s*\.reports-root \.mobile-hamburger-btn,\s*\.informes-shell \.mobile-hamburger-btn\s*\{\s*display:\s*none\s*!important;\s*\}\s*\}/,
      'ReportsLayout debe ocultar con display: none !important el botón flotante en desktop'
    );
  });

  await t.test('ReportsLayout.jsx contiene CSS perfectamente balanceado y arquitectura de header 2-tier', () => {
    const filePath = path.join(projectRoot, 'src/modules/informes/components/ReportsLayout.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    // 1. Balance de llaves en el bloque <style>
    const styleMatch = content.match(/<style>\{`([\s\S]*?)`\}<\/style>/);
    assert.ok(styleMatch, 'ReportsLayout debe contener un bloque <style>');
    const css = styleMatch[1];
    let depth = 0;
    let minDepth = 0;
    for (let i = 0; i < css.length; i++) {
      if (css[i] === '{') depth++;
      else if (css[i] === '}') {
        depth--;
        if (depth < minDepth) minDepth = depth;
      }
    }
    assert.strictEqual(depth, 0, 'El bloque CSS de ReportsLayout debe tener balance de llaves perfecto (depth = 0)');
    assert.strictEqual(minDepth, 0, 'El bloque CSS de ReportsLayout nunca debe cerrar más llaves de las abiertas (minDepth = 0)');

    // 2. Arquitectura de cabecera de 2 niveles (2-tier)
    assert.match(
      css,
      /\.informes-shell\s+\.app-header\s*\{[^}]*flex-direction:\s*column\s*!important;/,
      'ReportsLayout debe forzar flex-direction: column en .app-header'
    );
  });

  await t.test('ConstructorInforme.jsx no contiene padding-left hardcodeado que distorsione los botones', () => {
    const filePath = path.join(projectRoot, 'src/modules/informes/pages/ConstructorInforme.jsx');
    const content = fs.readFileSync(filePath, 'utf8');

    assert.doesNotMatch(
      content,
      /className="pos-bottom-actions"\s+style=\{\{paddingLeft:\s*'5rem'\}\}/,
      'ConstructorInforme no debe tener el padding-left hardcodeado de 5rem en pos-bottom-actions'
    );
  });

  await t.test('styles.css y styles.scss calibran la vista POS a 100vh en desktop y desbloquean kanban-board', () => {
    const cssPath = path.join(projectRoot, 'src/modules/informes/styles.css');
    const scssPath = path.join(projectRoot, 'src/modules/informes/styles.scss');
    const cssContent = fs.readFileSync(cssPath, 'utf8');
    const scssContent = fs.readFileSync(scssPath, 'utf8');

    // 1. .pos-ticket-body permite scroll interno y no expande el viewport
    assert.match(
      cssContent,
      /\.pos-ticket-body\s*\{[^}]*overflow-y:\s*auto;/,
      'styles.css debe definir overflow-y: auto en pos-ticket-body'
    );
    assert.match(
      cssContent,
      /\.pos-ticket-body\s*\{[^}]*min-height:\s*0;/,
      'styles.css debe definir min-height: 0 en pos-ticket-body'
    );
    assert.match(
      scssContent,
      /\.pos-ticket-body\s*\{[^}]*overflow-y:\s*auto;/,
      'styles.scss debe definir overflow-y: auto en pos-ticket-body'
    );

    // 2. .kanban-board no debe tener overflow-y: hidden que atrape el scroll de la rueda
    assert.doesNotMatch(
      cssContent,
      /\.kanban-board\s*\{[^}]*overflow-y:\s*hidden;/,
      'styles.css no debe contener overflow-y: hidden en kanban-board'
    );

    // 3. .informes-shell.is-pos-view calibra el viewport desktop
    assert.match(
      cssContent,
      /\.informes-shell\.is-pos-view\s*\{[^}]*height:\s*100vh\s*!important;/,
      'styles.css debe fijar 100vh en desktop para is-pos-view'
    );
    assert.match(
      cssContent,
      /\.informes-shell\.is-pos-view\s*\{[^}]*overflow:\s*hidden\s*!important;/,
      'styles.css debe evitar scroll de ventana en desktop para is-pos-view'
    );
    assert.match(
      scssContent,
      /\.informes-shell\.is-pos-view\s*\{[^}]*height:\s*100vh\s*!important;/,
      'styles.scss debe fijar 100vh en desktop para is-pos-view'
    );

    // 4. Arquitectura 2-tier en styles.css y styles.scss
    assert.match(
      cssContent,
      /\.informes-shell\s+\.app-header\s*\{[^}]*flex-direction:\s*column\s*!important;/,
      'styles.css debe blindar flex-direction: column en .app-header'
    );
    assert.match(
      scssContent,
      /\.informes-shell\s+\.app-header\s*\{[^}]*flex-direction:\s*column\s*!important;/,
      'styles.scss debe blindar flex-direction: column en .app-header'
    );
  });
});
