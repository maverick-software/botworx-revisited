"""Read one generated invoice batch and print integer-cent results. No writes."""
import csv
import json
import sys
from pathlib import Path

if len(sys.argv) != 4:
    raise SystemExit("Use stage, shipping_cents, discount_cents")
stage, shipping, discount = map(int, sys.argv[1:])
if not 1 <= stage <= 99 or not 0 <= shipping <= 9999 or not 0 <= discount <= 9999:
    raise SystemExit("Arguments exceed this generated task")
root = Path(__file__).resolve().parent
source = root / f"batch-{stage:02}.csv"
if source.is_symlink() or source.resolve().parent != root:
    raise SystemExit("Source is outside this task")
with source.open(encoding="utf-8", newline="") as handle:
    rows = list(csv.DictReader(handle))
if any(row["status"] not in ("approved", "held") for row in rows):
    raise SystemExit("Unknown invoice status")
approved = [row for row in rows if row["status"] == "approved"]
subtotal = sum(int(row["quantity"]) * int(row["unit_cents"]) - int(row["credit_cents"]) for row in approved)
print(json.dumps({"row_count": len(rows), "approved_rows": len(approved), "held_rows": len(rows) - len(approved), "approved_cents": subtotal, "shipping_cents": shipping, "discount_cents": discount, "total_cents": subtotal + shipping - discount}))
