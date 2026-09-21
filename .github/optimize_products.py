from pathlib import Path
import json
import urllib.request

# This job is ONLY a fallback snapshot.
# The storefront itself always reads the live Apps Script catalog first.
SHEETS_URL = (
    "https://script.google.com/macros/s/"
    "AKfycbzGGmCePitQSQPoNT4_Wpu6mHkXAjaYI6_F2sRvYy6LbaAPpRg1mpeojO_4hO1vcPCRog"
    "/exec?action=getProducts"
)

req = urllib.request.Request(
    SHEETS_URL,
    headers={
        "User-Agent": "Mozilla/5.0 ISR-Catalog-Snapshot/2.0",
        "Cache-Control": "no-cache",
        "Pragma": "no-cache",
    },
)

with urllib.request.urlopen(req, timeout=20) as response:
    data = json.loads(response.read().decode("utf-8"))

products = data.get("products") if isinstance(data, dict) else None
if not isinstance(data, dict) or not data.get("ok") or not isinstance(products, list):
    raise SystemExit("Apps Script did not return a valid catalog")

catalog_json = json.dumps(products, ensure_ascii=False, separators=(",", ":"))

Path("products-cache.json").write_text(
    json.dumps(
        {"ok": True, "products": products},
        ensure_ascii=False,
        separators=(",", ":"),
    ),
    encoding="utf-8",
)

# Keep the instant first-paint catalog in index.html synchronized too.
# Only this delimited block is replaced; the rest of the page is never rewritten.
index_path = Path("index.html")
index_text = index_path.read_text(encoding="utf-8")
start_marker = "/* ISR_EMBEDDED_CATALOG_START */"
end_marker = "/* ISR_EMBEDDED_CATALOG_END */"

start = index_text.find(start_marker)
end = index_text.find(end_marker, start)

if start == -1 or end == -1:
    raise SystemExit("Embedded catalog markers not found in index.html")

end += len(end_marker)
embedded = (
    start_marker
    + "\nconst INITIAL_PRODUCTS = "
    + catalog_json
    + ";\n"
    + end_marker
)

index_text = index_text[:start] + embedded + index_text[end:]
index_path.write_text(index_text, encoding="utf-8")

print(f"Published catalog refreshed with {len(products)} products")
print("Embedded instant catalog synchronized")
