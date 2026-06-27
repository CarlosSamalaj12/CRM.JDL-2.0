let cache = {
  events: null,
  salones: null,
  users: null,
  reminders: null,
  occupancyWeeklyOps: null,
};

export function getCachedState() {
  return cache;
}

export function setCachedState(data) {
  cache = { ...cache, ...data };
}

export function clearCache() {
  cache = {
    events: null,
    salones: null,
    users: null,
    reminders: null,
    occupancyWeeklyOps: null,
  };
}

export function hasCache() {
  return cache.events !== null;
}
