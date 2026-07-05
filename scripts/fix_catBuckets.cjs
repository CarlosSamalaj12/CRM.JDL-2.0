const fs = require('fs');

// ─── 1. Patch QuoteModal.jsx ───
let content = fs.readFileSync('src/modules/calendar/components/QuoteModal.jsx', 'utf8');

// Pattern 1: addServiceItem - add category field
const addSvcMatch = content.match(
  /rowId: uid\(\), serviceId: serviceObj\.id, name: serviceObj\.name,\n\s+qty: serviceObj\.quantityMode === 'PAX' \? paxVal : \(Number\(serviceQty\) \|\| 1\),\n\s+price: serviceObj\.quantityMode === 'PAX' \? Math\.max\(0, Number\(serviceObj\.price \|\| 0\) \* paxVal\) : Number\(serviceObj\.price \|\| 0\),\n\s+quantityMode: serviceObj\.quantityMode \|\| 'MANUAL',/
);

if (addSvcMatch) {
  const replacement = addSvcMatch[0] + "\n      category: serviceObj.category || 'General',";
  content = content.replace(addSvcMatch[0], replacement);
  console.log('✅ addServiceItem - category added');
} else {
  console.log('❌ Could not find addServiceItem pattern');
}

// Pattern 2: handleApplyTemplate - add category field
const tmplMatch = content.match(
  /rowId: uid\(\),\n\s+serviceId: item\.serviceId \|\| item\.id \|\| 'manual',\n\s+name: item\.name \|\| 'Item de plantilla',\n\s+qty: Number\(item\.qty\) \|\| 1,\n\s+price: Number\(item\.price\) \|\| 0,\n\s+quantityMode: item\.quantityMode \|\| 'MANUAL',/
);

if (tmplMatch) {
  const replacement = tmplMatch[0] + "\n      category: item.category || '',";
  content = content.replace(tmplMatch[0], replacement);
  console.log('✅ handleApplyTemplate - category added');
} else {
  console.log('❌ Could not find handleApplyTemplate pattern');
}

fs.writeFileSync('src/modules/calendar/components/QuoteModal.jsx', content, 'utf8');
console.log('✅ QuoteModal.jsx saved');

// ─── 2. Patch ReportsIngresosCategorias.jsx ───
let report = fs.readFileSync('src/modules/reports/ReportsIngresosCategorias.jsx', 'utf8');

// Replace the pickCatAmount + chartData logic with direct computation from items
const oldChartData = report.match(
  /const pickCatAmount = \(catBuckets, key\) => \{[\s\S]*?\};\n\n  const chartData = useMemo\(\(\) => \{[\s\S]*?const from = monthList\[0\]\.key \+ '-01';/
);

if (oldChartData) {
  const newChartData = `const CAT_ITEM_MAP = [
  { key: 'alimentosBebidas', patterns: ['alimentos', 'bebidas', 'comida', 'catering', 'menu', 'bar', 'coctel'] },
  { key: 'hospedajeJdl',     patterns: ['hospedaje jdl', 'hospedaje propio'] },
  { key: 'hospedajeTerceros', patterns: ['hospedaje de terceros', 'hospedaje terceros', 'hospedaje 3ros'] },
];

const mapCategoryToBucket = (cat) => {
  if (!cat) return 'miscelaneos';
  const c = cat.toLowerCase().trim();
  for (const entry of CAT_ITEM_MAP) {
    if (entry.patterns.some(p => c.includes(p))) return entry.key;
  }
  return 'miscelaneos';
};

const chartData = useMemo(() => {
    if (!events || !monthList.length) return { categoryData: [], monthlyData: [], grandTotal: 0 };

    const from = monthList[0].key + '-01';`;

  report = report.replace(oldChartData[0], newChartData);
  console.log('✅ chartData header replaced');
} else {
  console.log('❌ Could not find chartData header pattern');
}

// Replace the catBuckets computation inside the loop
const oldCatCompute = report.match(
  /const catBuckets = ev\.quote\?\.catBuckets \|\| \{\};[\s\S]*?if \(!monthlyCatTotals\[monthKey\]\) \{[\s\S]*?for \(const cat of CATEGORIES\) \{[\s\S]*?const amount = pickCatAmount\(catBuckets, cat\.key\);[\s\S]*?if \(amount > 0\) \{[\s\S]*?catTotals\[cat\.key\] \+= amount;[\s\S]*?grandTotal \+= amount;[\s\S]*?monthlyCatTotals\[monthKey\]\[cat\.key\] \+= amount;[\s\S]*?\}[\s\S]*?\}[\s\S]*?\}/
);

if (oldCatCompute) {
  const newCatCompute = `const quoteItems = ev.quote?.items || [];
      if (!monthlyCatTotals[monthKey]) {
        monthlyCatTotals[monthKey] = { alimentosBebidas: 0, hospedajeJdl: 0, hospedajeTerceros: 0, miscelaneos: 0 };
      }
      for (const item of quoteItems) {
        const itemTotal = Number(item.qty || 0) * Number(item.price || 0);
        if (itemTotal <= 0) continue;
        const bucketKey = mapCategoryToBucket(item.category || '');
        catTotals[bucketKey] += itemTotal;
        grandTotal += itemTotal;
        monthlyCatTotals[monthKey][bucketKey] += itemTotal;
      }`;

  report = report.replace(oldCatCompute[0], newCatCompute);
  console.log('✅ category computation loop replaced');
} else {
  console.log('❌ Could not find category computation pattern');
}

// Remove the pickCatAmount function entirely (it's no longer needed)
// The function was part of the first match, so it should be gone already

fs.writeFileSync('src/modules/reports/ReportsIngresosCategorias.jsx', report, 'utf8');
console.log('✅ ReportsIngresosCategorias.jsx saved');
