import re

path = r'C:\Users\samal\Desktop\CRM\CRM.JDL-2.0\src\modules\reports\ReportsSatisfaccion.jsx'
with open(path, 'rb') as f:
    data = f.read()

# Try utf-8 first, fallback to utf-8-sig
text = data.decode('utf-8', errors='replace')

# Find the old eventSearchResults block
old_block = '''  eventSearchResults = useMemo(() => {
    if (!showEventSearch) return [];
    if (!Array.isArray(events)) return [];
    const q = searchText.trim().toLowerCase();
    return events.filter(ev => {
      const date = ev.date || ev.eventDate || '';
      if (searchFromDate && date < searchFromDate) return false;
      if (searchToDate && date > searchToDate) return false;
      if (searchCompany) {
        const c = ev.companyName || ev.company || ev.institucion || ev.client || '';
        if (String(c) !== searchCompany) return false;
      }
      if (q) {
        const haystack = [ev.eventName, ev.client, ev.name, ev.salon, ev.institucion]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.date || b.eventDate || '').localeCompare(a.date || a.eventDate || ''));
  }, [events, showEventSearch, searchFromDate, searchToDate, searchCompany, searchText]);'''

new_block = '''  eventSearchResults = useMemo(() => {
    if (!showEventSearch) return [];
    if (!Array.isArray(searchableEvents)) return [];
    const q = searchText.trim().toLowerCase();
    return searchableEvents.filter(ev => {
      const date = ev.date || ev.eventDate || '';
      if (searchFromDate && date < searchFromDate) return false;
      if (searchToDate && date > searchToDate) return false;
      if (searchCompany) {
        const c = ev.client || ev.companyName || ev.company || ev.institucion || '';
        if (String(c) !== searchCompany) return false;
      }
      if (q) {
        // Busca en: nombre del evento, cliente, salón, empresa y texto de items del checklist.
        const haystack = [ev.eventName, ev.client, ev.salon, ev.itemText]
          .filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    }).sort((a, b) => (b.date || b.eventDate || '').localeCompare(a.date || a.eventDate || ''));
  }, [searchableEvents, showEventSearch, searchFromDate, searchToDate, searchCompany, searchText]);'''

if old_block not in text:
    print('OLD BLOCK NOT FOUND')
    # Try to find a substring
    idx = text.find('eventSearchResults = useMemo')
    if idx >= 0:
        print(f'Found at offset {idx}')
        print(text[idx:idx+1500])
else:
    new_text = text.replace(old_block, new_block, 1)
    # Write as UTF-8 without BOM
    with open(path, 'wb') as f:
        f.write(new_text.encode('utf-8'))
    print('OK - replaced')

# Verify
with open(path, 'rb') as f:
    data2 = f.read()
print(f'File size: {len(data2)} bytes')
print(f'BOM: {data2[:3] == b"\\xef\\xbb\\xbf"}')
