from .database import seed_from_json

if __name__ == "__main__":
    feed = seed_from_json(force=True)
    print(f"Seeded {len(feed.get('listings', []))} listings into SQLite.")
