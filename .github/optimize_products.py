from pathlib import Path
import json
import urllib.request

SHEETS_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbzGGmCePitQSQPoNT4_Wpu6mHkXAjaYI6_F2sRvYy6LbaAPpRg1mpeojO_4hO1vcPCRog"
    "/exec?action=getProducts"
)

req = urllib.request.Request(
    SHEETS_URL,
    headers={
        "User-Agent": "Mozilla/5.0 ISR-Catalog-Snapshot/3.0",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    },
)

with urllib.request.urlopen(req, timeout=20) as response:
    data = json.loads(response.read().decode("utf-8"))

products = data.get("products") if isinstance(data, dict) else None
if not isinstance(data, dict) or not data.get("ok") or not isinstance(products, list):
    raise SystemExit("Apps Script did not return a valid catalog")

Path("products-cache.json").write_text(
    json.dumps(
        {"ok": True, "products": products},
        ensure_ascii=False,
        separators=(",", ":"),
    ),
    encoding="utf-8",
)

print(f"Fallback snapshot refreshed with {len(products)} products")
print("index.html is intentionally never modified by this job")
