const { google } = require("googleapis");

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY;
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;
const calendarId = process.env.GOOGLE_CALENDAR_ID;
const timeZone = process.env.GOOGLE_CALENDAR_TIMEZONE || 'America/Mexico_City';

let calendar = null;
let oauth2Client = null;

if (clientId && clientSecret) {
  try {
    oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      "http://localhost:3001/auth/google/callback" // URL de Redirección del Backend
    );

    if (refreshToken) {
      oauth2Client.setCredentials({ refresh_token: refreshToken });
      calendar = google.calendar({ version: "v3", auth: oauth2Client });
      console.log("⚙️ Google Calendar API (OAuth2): Inicializado y listo para sincronizar.");
    } else {
      console.log("ℹ️ Google Calendar (OAuth2): Configurado pero falta el REFRESH_TOKEN. Visita http://localhost:3001/auth/google para autorizar.");
    }
  } catch (error) {
    console.error("❌ Google Calendar API (OAuth2): Error al inicializar:", error);
  }
} else if (clientEmail && privateKey) {
  try {
    const auth = new google.auth.JWT(
      clientEmail,
      null,
      privateKey.replace(/\\n/g, '\n'), // Corrige los saltos de línea de la llave privada en variables .env
      ["https://www.googleapis.com/auth/calendar"]
    );
    calendar = google.calendar({ version: "v3", auth });
    console.log("⚙️ Google Calendar API (Service Account): Inicializado y listo para sincronizar.");
  } catch (error) {
    console.error("❌ Google Calendar API (Service Account): Error al inicializar las credenciales:", error);
  }
} else {
  console.log("ℹ️ Google Calendar: Sincronización inactiva (Faltan credenciales OAuth2 o Service Account en .env).");
}

function getAuthUrl() {
  if (!oauth2Client) {
    throw new Error("GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET no están configuradas en el .env.");
  }
  return oauth2Client.generateAuthUrl({
    access_type: "offline", // Pide refresh_token para sesión offline persistente
    prompt: "consent",      // Fuerza la pantalla de consentimiento para obtener el refresh_token siempre
    scope: ["https://www.googleapis.com/auth/calendar"]
  });
}

async function handleAuthCallback(code) {
  if (!oauth2Client) {
    throw new Error("OAuth2 no está configurado.");
  }
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

/**
 * Convierte el ID del CRM a un ID de evento seguro compatible con Google Calendar.
 * (Solo letras a-v, números 0-9 y sin guiones bajos).
 */
function getGoogleEventId(crmId) {
  return `evt${String(crmId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
}

/**
 * Mapea el estado del evento del CRM a los colores de Google Calendar (ID 1-11).
 */
function getStatusColorId(status) {
  switch (status) {
    case 'Confirmado':
      return "10"; // Verde fuerte (Basil)
    case 'Reserva sin Cotizacion':
      return "9"; // Azul (Blueberry)
    case '1er Cotizacion':
      return "2"; // Verde claro (Sage)
    case 'Seguimiento':
      return "6"; // Naranja (Tangerine)
    case 'Pre reserva':
      return "3"; // Púrpura (Grape)
    case 'Lista de Espera':
      return "5"; // Amarillo (Banana)
    case 'Cancelado':
    case 'Perdido':
      return "11"; // Rojo (Tomato)
    case 'Mantenimiento':
      return "8"; // Gris (Graphite)
    default:
      return "7"; // Turquesa (Peacock)
  }
}

/**
 * Retorna las fechas y horas formateadas garantizando que el rango no sea nulo, vacío o negativo.
 */
function getEventStartAndEnd(event) {
  const startStr = `${event.date}T${event.startTime || '10:00'}:00`;
  let endStr = `${event.endDate || event.date}T${event.endTime || '12:00'}:00`;

  const startTimeMs = new Date(startStr).getTime();
  const endTimeMs = new Date(endStr).getTime();

  if (isNaN(startTimeMs) || isNaN(endTimeMs) || endTimeMs <= startTimeMs) {
    // Si no es válido o fin <= inicio, forzamos un fin de 1 hora después del inicio
    const d = new Date(startStr);
    d.setHours(d.getHours() + 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    endStr = `${yyyy}-${mm}-${dd}T${hh}:${min}:00`;
  }

  return { startStr, endStr };
}

/**
 * Inserta un nuevo evento en Google Calendar
 */
async function createGoogleEvent(event, isFallback = false) {
  if (!calendar) return;
  const eventId = getGoogleEventId(event.id);
  const colorId = getStatusColorId(event.status);
  const { startStr, endStr } = getEventStartAndEnd(event);

  const resource = {
    id: eventId,
    summary: `${event.name} [${event.salon}]`,
    description: `Estado: ${event.status}\nCliente: ${event.clientName || 'No registrado'}\nTeléfono: ${event.clientPhone || 'No registrado'}\nPAX: ${event.pax || 'N/A'}\n\nNotas:\n${event.notes || 'Ninguna'}`,
    start: {
      dateTime: startStr,
      timeZone: timeZone,
    },
    end: {
      dateTime: endStr,
      timeZone: timeZone,
    },
    colorId: colorId
  };

  try {
    await calendar.events.insert({
      calendarId,
      requestBody: resource,
    });
    console.log(`✅ Google Calendar: Evento creado exitosamente -> "${event.name}" [${event.salon}]`);
  } catch (error) {
    if (error.code === 409 && !isFallback) {
      // 409 Conflict: El evento ya existe. Lo actualizamos en su lugar de forma transparente.
      console.log(`ℹ️ Google Calendar: El evento "${event.name}" ya existe (ID: ${eventId}). Intentando actualizar...`);
      await updateGoogleEvent(event, true);
    } else {
      console.error(`❌ Google Calendar: Error al crear evento "${event.name}":`, error.message);
    }
  }
}

/**
 * Actualiza un evento existente en Google Calendar
 */
async function updateGoogleEvent(event, isFallback = false) {
  if (!calendar) return;
  const eventId = getGoogleEventId(event.id);
  const colorId = getStatusColorId(event.status);
  const { startStr, endStr } = getEventStartAndEnd(event);

  const resource = {
    summary: `${event.name} [${event.salon}]`,
    description: `Estado: ${event.status}\nCliente: ${event.clientName || 'No registrado'}\nTeléfono: ${event.clientPhone || 'No registrado'}\nPAX: ${event.pax || 'N/A'}\n\nNotas:\n${event.notes || 'Ninguna'}`,
    start: {
      dateTime: startStr,
      timeZone: timeZone,
    },
    end: {
      dateTime: endStr,
      timeZone: timeZone,
    },
    colorId: colorId
  };

  try {
    await calendar.events.update({
      calendarId,
      eventId,
      requestBody: resource,
    });
    console.log(`✅ Google Calendar: Evento actualizado exitosamente -> "${event.name}" [${event.salon}]`);
  } catch (error) {
    if (error.code === 404 && !isFallback) {
      // Si por alguna razón el evento no existe en Google, lo creamos
      console.log(`ℹ️ Google Calendar: El evento "${event.name}" no existe en Google (ID: ${eventId}). Intentando crear...`);
      await createGoogleEvent(event, true);
    } else {
      console.error(`❌ Google Calendar: Error al actualizar evento "${event.name}":`, error.message);
    }
  }
}

/**
 * Elimina un evento de Google Calendar
 */
async function deleteGoogleEvent(crmId) {
  if (!calendar) return;
  const eventId = getGoogleEventId(crmId);

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
    });
    console.log(`🗑️ Google Calendar: Evento eliminado exitosamente -> ID: ${crmId}`);
  } catch (error) {
    if (error.code !== 404) {
      console.error(`❌ Google Calendar: Error al eliminar evento ID ${crmId}:`, error.message);
    }
  }
}

/**
 * Compara los eventos anteriores con los nuevos y sincroniza de forma inteligente
 * para evitar sobrecargar los límites de la API de Google.
 */
async function syncEventsToGoogle(oldEvents, newEvents) {
  if (!calendar) return;

  const oldMap = new Map(oldEvents.map(e => [e.id, e]));
  const newMap = new Map(newEvents.map(e => [e.id, e]));

  // 1. Crear o actualizar eventos
  for (const newEv of newEvents) {
    const oldEv = oldMap.get(newEv.id);
    if (!oldEv) {
      // El evento es totalmente nuevo
      await createGoogleEvent(newEv);
    } else {
      // Verificar si hubo cambios reales en los campos clave
      const hasChanged =
        oldEv.name !== newEv.name ||
        oldEv.salon !== newEv.salon ||
        oldEv.date !== newEv.date ||
        oldEv.endDate !== newEv.endDate ||
        oldEv.startTime !== newEv.startTime ||
        oldEv.endTime !== newEv.endTime ||
        oldEv.status !== newEv.status ||
        oldEv.notes !== newEv.notes ||
        oldEv.clientName !== newEv.clientName ||
        oldEv.clientPhone !== newEv.clientPhone ||
        oldEv.pax !== newEv.pax;

      if (hasChanged) {
        await updateGoogleEvent(newEv);
      }
    }
  }

  // 2. Eliminar eventos retirados
  for (const oldEv of oldEvents) {
    if (!newMap.has(oldEv.id)) {
      await deleteGoogleEvent(oldEv.id);
    }
  }
}

module.exports = {
  syncEventsToGoogle,
  getAuthUrl,
  handleAuthCallback
};
