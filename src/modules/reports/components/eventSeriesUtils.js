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
