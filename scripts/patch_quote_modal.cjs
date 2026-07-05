const fs = require("fs");
const file = "src/modules/calendar/components/QuoteModal.jsx";
let c = fs.readFileSync(file, "utf8");

// Pattern 1: addServiceItem
const p1 = "      quantityMode: serviceObj.quantityMode || 'MANUAL',\r\n      serviceDate: selectedServiceDate || availableServiceDates[0]\r\n    };";

const r1 = "      quantityMode: serviceObj.quantityMode || 'MANUAL',\r\n      category: serviceObj.category || 'General',\r\n      serviceDate: selectedServiceDate || availableServiceDates[0]\r\n    };";

if (c.includes(p1)) {
  c = c.replace(p1, r1);
  console.log("OK addServiceItem");
} else {
  console.log("FAIL addServiceItem - pattern not found");
  // Debug: find the closest match
  const idx = c.indexOf("quantityMode: serviceObj.quantityMode || 'MANUAL'");
  if (idx >= 0) {
    console.log("  Found at index:", idx);
    console.log("  Context: >>>" + c.substring(idx, idx + 120).replace(/\r/g, "\\r").replace(/\n/g, "\\n") + "<<<");
  }
}

// Pattern 2: handleApplyTemplate
const p2 = "      quantityMode: item.quantityMode || 'MANUAL',\r\n      serviceDate: item.serviceDate || availableServiceDates[0]\r\n    }));";

const r2 = "      quantityMode: item.quantityMode || 'MANUAL',\r\n      category: item.category || '',\r\n      serviceDate: item.serviceDate || availableServiceDates[0]\r\n    }));";

if (c.includes(p2)) {
  c = c.replace(p2, r2);
  console.log("OK handleApplyTemplate");
} else {
  console.log("FAIL handleApplyTemplate - pattern not found");
  const idx = c.indexOf("quantityMode: item.quantityMode || 'MANUAL'");
  if (idx >= 0) {
    console.log("  Found at index:", idx);
    console.log("  Context: >>>" + c.substring(idx, idx + 120).replace(/\r/g, "\\r").replace(/\n/g, "\\n") + "<<<");
  }
}

fs.writeFileSync(file, c, "utf8");
console.log("Saved");
