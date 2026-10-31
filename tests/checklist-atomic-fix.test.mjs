import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

test('Optimización y Carga Atómica de Checklists de Eventos', async (t) => {
  const checklistPath = path.join(projectRoot, 'src/modules/settings/SettingsChecklist.jsx');
  const checklistContent = fs.readFileSync(checklistPath, 'utf8');

  const appEventsPath = path.join(projectRoot, 'src/utils/appEvents.js');
  const appEventsContent = fs.readFileSync(appEventsPath, 'utf8');

  const eventCardPath = path.join(projectRoot, 'src/modules/informes/components/EventCard.jsx');
  const eventCardContent = fs.readFileSync(eventCardPath, 'utf8');

  await t.test('loadEventData no invalida la caché global ni fuerza cacheBust de 45 MB', () => {
    assert.doesNotMatch(
      checklistContent,
      /invalidateStateCache\(\);\s*const state = await loadCrmState\(\{ cacheBust: true \}\);/,
      'loadEventData no debe invalidar la caché ni descargar todo el estado global'
    );
    assert.match(
      checklistContent,
      /\/api\/events\/' \+ encodeURIComponent\(id\) \+ '\/checklist/,
      'loadEventData debe consultar el endpoint atómico /api/events/:id/checklist'
    );
  });

  await t.test('SettingsChecklist implementa apertura inmediata con indicador sutil de sincronización', () => {
    assert.match(
      checklistContent,
      /const \[isLoadingChecklist, setIsLoadingChecklist\] = useState\(false\);/,
      'Debe existir el estado isLoadingChecklist'
    );
    assert.match(
      checklistContent,
      /checklist-spin/,
      'Debe incluir la animación de rotación checklist-spin'
    );
    assert.match(
      checklistContent,
      /Sincronizando checklist del evento\.\.\./,
      'Debe renderizar el mensaje ejecutivo de sincronización atómica'
    );
    assert.match(
      checklistContent,
      /disabled=\{savingOp \|\| isLoadingChecklist\}/,
      'El botón de Guardar Operativa debe deshabilitarse durante la carga'
    );
    assert.match(
      checklistContent,
      /disabled=\{savingEv \|\| isLoadingChecklist\}/,
      'El botón de Guardar Evaluación debe deshabilitarse durante la carga'
    );
  });

  await t.test('handleSave guarda de forma atómica y directa sin trashing de caché', () => {
    assert.match(
      checklistContent,
      /await api\.put\('\/api\/events\/' \+ encodeURIComponent\(evtId\) \+ '\/checklist', \{\s*checklist: fullChecklist\s*\}\);/,
      'handleSave debe llamar a api.put(/api/events/:id/checklist)'
    );
    assert.doesNotMatch(
      checklistContent,
      /await saveCrmState\(\{\s*\.\.\.state,\s*eventChecklists:/,
      'handleSave no debe sobreescribir app_state_kv serializando todos los checklists'
    );
  });

  await t.test('emitOpenEventChecklist propaga eventData para rendering instantáneo del título y fecha', () => {
    assert.match(
      appEventsContent,
      /export function emitOpenEventChecklist\(eventId, eventData = null\)/,
      'emitOpenEventChecklist debe aceptar eventData'
    );
    assert.match(
      eventCardContent,
      /emitOpenEventChecklist\(event\.Idocupacion, event\)/,
      'EventCard debe pasar event a emitOpenEventChecklist'
    );
  });

  await t.test('getEventTitle y getEventDateFormatted resuelven Institucion, FechaEvento y Salon de tarjetas Kanban', () => {
    assert.match(
      checklistContent,
      /evtData\.Institucion/,
      'getEventTitle debe resolver Institucion del evento de Kanban'
    );
    assert.match(
      checklistContent,
      /evtData\.FechaEvento/,
      'getEventDateFormatted debe resolver FechaEvento del evento de Kanban'
    );
    assert.match(
      checklistContent,
      /getEventSalon/,
      'SettingsChecklist debe definir getEventSalon'
    );
  });
});
