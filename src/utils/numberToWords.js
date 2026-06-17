/**
 * Convierte un número a su representación en letras en español.
 * Ejemplo: 1523.50 → "Mil quinientos veintitrés con 50/100"
 */
export function numberToWords(num) {
  const units = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  const convertChunk = (n) => {
    if (n === 0) return '';
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 30 && n >= 20) {
      if (n === 20) return 'VEINTE';
      return `VEINTI${units[n - 20]}`;
    }
    if (n < 100) {
      const t = Math.floor(n / 10);
      const u = n % 10;
      return u === 0 ? tens[t] : `${tens[t]} Y ${units[u]}`;
    }
    if (n < 1000) {
      const h = Math.floor(n / 100);
      const rest = n % 100;
      if (n === 100) return 'CIEN';
      const restStr = rest > 0 ? ` ${convertChunk(rest)}` : '';
      return `${hundreds[h]}${restStr}`;
    }
    if (n < 1000000) {
      const thousands = Math.floor(n / 1000);
      const rest = n % 1000;
      const prefix = thousands === 1 ? 'MIL' : `${convertChunk(thousands)} MIL`;
      const restStr = rest > 0 ? ` ${convertChunk(rest)}` : '';
      return `${prefix}${restStr}`;
    }
    if (n < 1000000000) {
      const millions = Math.floor(n / 1000000);
      const rest = n % 1000000;
      const prefix = millions === 1 ? 'UN MILLÓN' : `${convertChunk(millions)} MILLONES`;
      const restStr = rest > 0 ? ` ${convertChunk(rest)}` : '';
      return `${prefix}${restStr}`;
    }
    // For billions and above
    const billions = Math.floor(n / 1000000000);
    const rest = n % 1000000000;
    const prefix = billions === 1 ? 'MIL MILLONES' : `${convertChunk(billions)} MIL MILLONES`;
    const restStr = rest > 0 ? ` ${convertChunk(rest)}` : '';
    return `${prefix}${restStr}`;
  };

  const amount = Number(num || 0);
  if (amount === 0) return 'CERO';

  const integerPart = Math.floor(Math.abs(amount));
  const decimalPart = Math.round((Math.abs(amount) - integerPart) * 100);

  const intStr = convertChunk(integerPart);
  const decStr = String(decimalPart).padStart(2, '0');

  return `${intStr} CON ${decStr}/100`;
}

/**
 * Formatea un monto con símbolo de moneda.
 * @param {number} amount - El monto a formatear
 * @param {string} currency - 'GTQ' o 'USD'
 * @returns {string} Ej: "Q 1,523.50" o "$ 1,523.50"
 */
export function formatMoney(amount, currency = 'GTQ') {
  const val = Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return currency === 'USD' ? `$ ${val}` : `Q ${val}`;
}
