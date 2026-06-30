import { useEffect, useRef, useCallback, useMemo } from 'react';

export function useDataSync(entity, onChange) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const handleEvent = useCallback((e) => {
    const { entity: changedEntity, action, data } = e.detail;
    if (changedEntity === entity && onChangeRef.current) {
      onChangeRef.current({ action, data });
    }
  }, [entity]);

  useEffect(() => {
    window.addEventListener('entity:changed', handleEvent);
    return () => window.removeEventListener('entity:changed', handleEvent);
  }, [handleEvent]);
}

export function useDataSyncMulti(entities, onChange) {
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; });

  const entitySet = useMemo(
    () => Array.isArray(entities) ? new Set(entities) : new Set([entities]),
    [entities]
  );

  const handleEvent = useCallback((e) => {
    const { entity, action, data } = e.detail;
    if (entitySet.has(entity) && onChangeRef.current) {
      onChangeRef.current({ entity, action, data });
    }
  }, [entitySet]);

  useEffect(() => {
    window.addEventListener('entity:changed', handleEvent);
    return () => window.removeEventListener('entity:changed', handleEvent);
  }, [handleEvent]);
}
