"""Restore a database dump (produced from the Emergent environment) into the
target MongoDB. Reads MONGO_URL and DB_NAME from backend/.env or the
environment — point those at the production cluster before running.

Usage:
    python restore_dump.py ../emergent_data_dump.json           # fails if DB not empty
    python restore_dump.py ../emergent_data_dump.json --force   # drops existing collections first
"""
import sys
from pathlib import Path

from bson import json_util
from dotenv import load_dotenv
from pymongo import MongoClient
import os

load_dotenv(Path(__file__).parent / ".env")


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    force = "--force" in sys.argv
    if not args:
        sys.exit(__doc__)
    dump_path = Path(args[0])
    if not dump_path.exists():
        sys.exit(f"Dump file not found: {dump_path}")

    data = json_util.loads(dump_path.read_text(encoding="utf-8"))
    client = MongoClient(os.environ["MONGO_URL"])
    db = client[os.environ["DB_NAME"]]

    existing = set(db.list_collection_names())
    if existing and not force:
        sys.exit(
            f"Target DB '{db.name}' already has collections: {sorted(existing)}.\n"
            "Re-run with --force to drop and replace them."
        )

    for name, docs in data.items():
        if name in existing:
            db[name].drop()
        # strip _id so Mongo assigns fresh ones; app code never uses _id
        docs = [{k: v for k, v in d.items() if k != "_id"} for d in docs]
        if docs:
            db[name].insert_many(docs)
        print(f"  {name}: {len(docs)} docs")

    print(f"Restored {len(data)} collections into '{db.name}'.")


if __name__ == "__main__":
    main()
