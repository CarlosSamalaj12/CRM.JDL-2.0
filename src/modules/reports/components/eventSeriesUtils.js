export const getEventSeries = (ev, allEvents) => {
  if (!ev) return [];
  const groupId = ev.groupId || ev.id_grupo || ev.idGroup;
  if (!groupId) return [ev];
  return allEvents.filter(x => String(x.groupId || x.id_grupo || x.idGroup || '') === String(groupId));
};

export const getEventSeriesFinancialMeta = (ev, allEvents) => {
  const series = getEventSeries(ev, allEvents)
    .slice()
    .sort((a, b) => {
      const byDate = String(a?.date || "").localeCompare(String(b?.date || ""));
      if (byDate !== 0) return byDate;
      const byStart = String(a?.startTime || "").localeCompare(String(b?.startTime || ""));
      if (byStart !== 0) return byStart;
      return String(a?.salon || "").localeCompare(String(b?.salon || ""));
    });

  const salonesList = [];
  for (const item of series) {
    const eventSalones = Array.isArray(item?.salones) ? item.salones : [];
    for (const salon of [...eventSalones, item?.salon]) {
      const label = String(salon || "").trim();
      if (label) salonesList.push(label);
    }
  }
  const uniqueSalones = Array.from(new Set(salonesList));
  const explicitMainSalon = series.map((item) => String(item?.mainSalon || "").trim()).find(Boolean) || "";
  const mainSalon = explicitMainSalon || uniqueSalones[0] || String(ev?.salon || "").trim();

  const primaryEvent = series.find((item) => String(item?.salon || "").trim() === mainSalon)
    || series.find((item) => String(item?.id || "").trim() === String(ev?.id || "").trim())
    || series[0]
    || ev
    || null;

  const firstEvent = series[0] || ev || null;
  const lastEvent = series[series.length - 1] || ev || null;

  return {
    series,
    salones: uniqueSalones,
    mainSalon,
    primaryEvent,
    startDate: String(firstEvent?.date || "").trim(),
    endDate: String(lastEvent?.date || "").trim(),
    startTime: String(primaryEvent?.startTime || firstEvent?.startTime || "").trim(),
    endTime: String(primaryEvent?.endTime || firstEvent?.endTime || "").trim(),
  };
};

export const getQuoteFinancialAmounts = (quote, fallbackExchangeRate = 7.75) => {
  if (!quote || typeof quote !== 'object') {
    return { totalGtq: 0, subtotalGtq: 0, discountGtq: 0, isUsd: false, exchangeRate: 1, rawTotal: 0, rawSubtotal: 0 };
  }
  const isUsd = String(quote.currency || '').trim().toUpperCase() === 'USD';
  let rawTotal = Math.max(0, Number(quote.total || 0));
  let rawSubtotal = Math.max(0, Number(quote.subtotal || 0));
  const rawDiscount = Math.max(0, Number(quote.discountAmount ?? quote.discountValue ?? 0));
  const rate = Number(quote.exchangeRate) > 0 ? Number(quote.exchangeRate) : Number(fallbackExchangeRate || 7.75);

  // Fallback 1: Si rawTotal es 0 pero existen versiones históricas con total
  if (rawTotal <= 0 && Array.isArray(quote.versions) && quote.versions.length > 0) {
    const latestVersion = quote.versions[quote.versions.length - 1];
    rawTotal = Math.max(0, Number(latestVersion?.total || 0));
    rawSubtotal = Math.max(0, Number(latestVersion?.subtotal || rawTotal));
  }

  // Fallback 2: Si rawTotal sigue siendo 0 pero la cotización tiene ítems agregados
  if (rawTotal <= 0 && Array.isArray(quote.items) && quote.items.length > 0) {
    rawSubtotal = quote.items.reduce((acc, it) => {
      const qty = Number(it.qty || it.quantity || (it.quantityMode === 'PAX' ? (quote.people || 1) : 1));
      const price = Number(it.price || it.unitPrice || 0);
      return acc + (it.total ? Number(it.total) : (qty * price));
    }, 0);
    rawTotal = Math.max(0, rawSubtotal - rawDiscount);
  }

  let totalGtq;
  if (quote.totalGtq !== undefined && quote.totalGtq !== null && !Number.isNaN(Number(quote.totalGtq)) && Number(quote.totalGtq) > 0) {
    totalGtq = Number(quote.totalGtq);
  } else if (isUsd) {
    totalGtq = Math.round(rawTotal * rate * 100) / 100;
  } else {
    totalGtq = rawTotal;
  }

  let subtotalGtq;
  if (quote.subtotalGtq !== undefined && quote.subtotalGtq !== null && !Number.isNaN(Number(quote.subtotalGtq)) && Number(quote.subtotalGtq) > 0) {
    subtotalGtq = Number(quote.subtotalGtq);
  } else if (isUsd) {
    subtotalGtq = Math.round(rawSubtotal * rate * 100) / 100;
  } else {
    subtotalGtq = rawSubtotal;
  }

  let discountGtq;
  if (quote.discountAmountGtq !== undefined && quote.discountAmountGtq !== null && !Number.isNaN(Number(quote.discountAmountGtq))) {
    discountGtq = Number(quote.discountAmountGtq);
  } else if (isUsd) {
    discountGtq = Math.round(rawDiscount * rate * 100) / 100;
  } else {
    discountGtq = rawDiscount;
  }

  return {
    totalGtq: Math.max(0, totalGtq),
    subtotalGtq: Math.max(0, subtotalGtq),
    discountGtq: Math.max(0, discountGtq),
    isUsd,
    exchangeRate: isUsd ? rate : 1,
    exchangeRateDate: quote.exchangeRateDate || null,
    rawTotal,
    rawSubtotal,
  };
};

export const getQuoteTotalGtq = (quote, fallbackExchangeRate = 7.75) => {
  return getQuoteFinancialAmounts(quote, fallbackExchangeRate).totalGtq;
};
