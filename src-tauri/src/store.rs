//! SQLite persistence via `rusqlite`, replacing rustyDLP's `turso`
//! (`0.8.0-pre.3`, no FOREIGN KEY support — the constraint that chose turso,
//! keeping tokio out of the process, no longer applies once Tauri itself
//! depends on tokio). Same 5 tables, same column shapes as the original
//! schema, now with real `ON DELETE CASCADE` doing what `save_job`/
//! `delete_job` used to do by hand.
//!
//! ponytail: `load_jobs` is still N+1 (one query per job for items, one per
//! item for files) — porting the query shape, not fixing it. Fine at library
//! sizes measured in hundreds; replace with joined flat SELECTs if the
//! Library view ever feels slow.

use crate::model::{File, FileKind, Item, Job, JobKind, JobState, Preset};
use anyhow::Result;
use rusqlite::{Connection, OptionalExtension, params};

const SCHEMA: &str = r#"
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS job (
    id         TEXT PRIMARY KEY,
    kind       TEXT NOT NULL DEFAULT 'download',
    url        TEXT NOT NULL,
    title      TEXT NOT NULL,
    preset     TEXT NOT NULL,
    state      TEXT NOT NULL,
    error      TEXT,
    created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS item (
    id          TEXT PRIMARY KEY,
    job_id      TEXT NOT NULL REFERENCES job(id) ON DELETE CASCADE,
    idx         INTEGER NOT NULL,
    title       TEXT NOT NULL,
    duration    REAL,
    thumb_path  TEXT,
    webpage_url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS file (
    id        TEXT PRIMARY KEY,
    item_id   TEXT NOT NULL REFERENCES item(id) ON DELETE CASCADE,
    path      TEXT NOT NULL,
    kind      TEXT NOT NULL,
    format_id TEXT,
    bytes     INTEGER
);
CREATE TABLE IF NOT EXISTS preset (
    name         TEXT PRIMARY KEY,
    is_default   INTEGER NOT NULL,
    options_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS app_setting (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
);
"#;

pub struct Store {
    conn: Connection,
}

impl Store {
    /// Opens (creating if absent) the library database and applies the
    /// schema. `PRAGMA foreign_keys` defaults to OFF per SQLite connection
    /// regardless of the schema, so it's set explicitly here every open.
    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn })
    }

    /// Writes a job and its full item/file subtree.
    ///
    /// Call this on state transitions only — never on progress ticks. Live
    /// progress belongs in memory, not the DB; a write per tick would mean
    /// ~10 disk writes/second per active download.
    pub fn save_job(&self, job: &Job) -> Result<()> {
        self.conn.execute(
            "INSERT INTO job (id, kind, url, title, preset, state, error, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
             ON CONFLICT(id) DO UPDATE SET
               kind=?2, url=?3, title=?4, preset=?5, state=?6, error=?7, created_at=?8",
            params![
                job.id,
                job.kind.as_str(),
                job.url,
                job.title,
                job.preset,
                job.state.as_str(),
                job.error,
                job.created_at,
            ],
        )?;

        // Children are rewritten wholesale so a shrinking item list can't
        // leave orphans behind. Deleting items is enough — ON DELETE CASCADE
        // takes their files with them; turso couldn't do this, hence the
        // separate file DELETE in the original.
        self.conn
            .execute("DELETE FROM item WHERE job_id = ?1", params![job.id])?;

        for item in &job.items {
            self.conn.execute(
                "INSERT INTO item (id, job_id, idx, title, duration, thumb_path, webpage_url)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
                params![item.id, job.id, item.index, item.title, item.duration, item.thumb_path, item.webpage_url],
            )?;

            for f in &item.files {
                self.conn.execute(
                    "INSERT INTO file (id, item_id, path, kind, format_id, bytes)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![f.id, item.id, f.path, f.kind.as_str(), f.format_id, f.bytes],
                )?;
            }
        }
        Ok(())
    }

    /// Deletes a job and its item/file subtree (cascades).
    pub fn delete_job(&self, job_id: &str) -> Result<()> {
        self.conn.execute("DELETE FROM job WHERE id = ?1", params![job_id])?;
        Ok(())
    }

    /// Loads every job, newest first, with items and files attached.
    pub fn load_jobs(&self) -> Result<Vec<Job>> {
        let mut jobs = {
            let mut stmt = self.conn.prepare(
                "SELECT id, kind, url, title, preset, state, error, created_at
                 FROM job ORDER BY created_at DESC, id DESC",
            )?;
            let rows = stmt.query_map([], |row| {
                Ok(Job {
                    id: row.get(0)?,
                    kind: JobKind::parse(&row.get::<_, String>(1)?),
                    url: row.get(2)?,
                    title: row.get(3)?,
                    preset: row.get(4)?,
                    state: JobState::parse(&row.get::<_, String>(5)?),
                    error: row.get(6)?,
                    created_at: row.get(7)?,
                    items: Vec::new(),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>();
            rows?
        };

        for job in &mut jobs {
            job.items = self.load_items(&job.id)?;
        }
        Ok(jobs)
    }

    fn load_items(&self, job_id: &str) -> Result<Vec<Item>> {
        let mut items = {
            let mut stmt = self.conn.prepare(
                "SELECT id, idx, title, duration, thumb_path, webpage_url
                 FROM item WHERE job_id = ?1 ORDER BY idx ASC",
            )?;
            let rows = stmt.query_map(params![job_id], |row| {
                Ok(Item {
                    id: row.get(0)?,
                    index: row.get(1)?,
                    title: row.get(2)?,
                    duration: row.get(3)?,
                    thumb_path: row.get(4)?,
                    webpage_url: row.get(5)?,
                    files: Vec::new(),
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>();
            rows?
        };

        for item in &mut items {
            item.files = self.load_files(&item.id)?;
        }
        Ok(items)
    }

    fn load_files(&self, item_id: &str) -> Result<Vec<File>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, path, kind, format_id, bytes
             FROM file WHERE item_id = ?1 ORDER BY id ASC",
        )?;
        let files = stmt
            .query_map(params![item_id], |row| {
                Ok(File {
                    id: row.get(0)?,
                    path: row.get(1)?,
                    kind: FileKind::parse(&row.get::<_, String>(2)?),
                    format_id: row.get(3)?,
                    bytes: row.get(4)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(files)
    }

    // -- presets -------------------------------------------------------

    /// Upserts a preset. Options are stored as JSON so adding a field later
    /// is a serde default, not a schema migration.
    pub fn save_preset(&self, preset: &Preset) -> Result<()> {
        let json = serde_json::to_string(&preset.options)?;
        self.conn.execute(
            "INSERT INTO preset (name, is_default, options_json) VALUES (?1, ?2, ?3)
             ON CONFLICT(name) DO UPDATE SET is_default=?2, options_json=?3",
            params![preset.name, preset.is_default as i64, json],
        )?;
        if preset.is_default {
            self.clear_other_defaults(&preset.name)?;
        }
        Ok(())
    }

    /// Exactly one preset may be the default.
    fn clear_other_defaults(&self, keep: &str) -> Result<()> {
        self.conn
            .execute("UPDATE preset SET is_default = 0 WHERE name <> ?1", params![keep])?;
        Ok(())
    }

    pub fn delete_preset(&self, name: &str) -> Result<()> {
        self.conn.execute("DELETE FROM preset WHERE name = ?1", params![name])?;
        Ok(())
    }

    pub fn load_presets(&self) -> Result<Vec<Preset>> {
        let mut stmt = self
            .conn
            .prepare("SELECT name, is_default, options_json FROM preset ORDER BY name ASC")?;
        let out = stmt
            .query_map([], |row| {
                let name: String = row.get(0)?;
                let is_default: i64 = row.get(1)?;
                let json: String = row.get(2)?;
                Ok((name, is_default != 0, json))
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?
            .into_iter()
            .map(|(name, is_default, json)| Preset {
                name,
                is_default,
                // A preset written by a newer version must not break
                // startup; fall back to defaults for anything unparseable.
                options: serde_json::from_str(&json).unwrap_or_default(),
            })
            .collect();
        Ok(out)
    }

    // -- settings --------------------------------------------------------

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO app_setting (k, v) VALUES (?1, ?2)
             ON CONFLICT(k) DO UPDATE SET v=?2",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        Ok(self
            .conn
            .query_row("SELECT v FROM app_setting WHERE k = ?1", params![key], |row| row.get(0))
            .optional()?)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::new_id;

    fn sample_job() -> Job {
        let mut job = Job::new("https://example.com/playlist?list=abc", "1080p archive");
        job.title = "Lo-fi beats — ąćęłń 日本語".into(); // non-ASCII round-trip
        job.state = JobState::Done;
        job.items = vec![
            Item {
                id: new_id("itm"),
                index: 0,
                title: "01 Intro".into(),
                duration: Some(212.5),
                thumb_path: Some(r"C:\dl\01.webp".into()),
                webpage_url: "https://example.com/watch?v=1".into(),
                files: vec![
                    File {
                        id: new_id("fil"),
                        path: r"C:\dl\01 Intro.mp4".into(),
                        kind: FileKind::Video,
                        format_id: Some("137+140".into()),
                        bytes: Some(412_000_000),
                    },
                    File {
                        id: new_id("fil"),
                        path: r"C:\dl\01 Intro.en.srt".into(),
                        kind: FileKind::Subtitle,
                        format_id: None,
                        bytes: None,
                    },
                ],
            },
            Item {
                id: new_id("itm"),
                index: 1,
                title: "02 Rain".into(),
                duration: None,
                thumb_path: None,
                webpage_url: "https://example.com/watch?v=2".into(),
                files: vec![],
            },
        ];
        job
    }

    fn temp_store() -> (Store, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(new_id("qdlp-test"));
        std::fs::create_dir_all(&dir).unwrap();
        let store = Store::open(dir.join("library.db").to_str().unwrap()).unwrap();
        (store, dir)
    }

    #[test]
    fn job_round_trips_through_sqlite() {
        let (store, dir) = temp_store();
        let job = sample_job();
        store.save_job(&job).unwrap();

        let loaded = store.load_jobs().unwrap();
        assert_eq!(loaded.len(), 1, "expected exactly one job");
        assert_eq!(loaded[0], job, "job did not survive the round trip");

        // Saving again must not duplicate rows or orphan children.
        store.save_job(&job).unwrap();
        let again = store.load_jobs().unwrap();
        assert_eq!(again.len(), 1, "re-saving duplicated the job");
        assert_eq!(again[0].items.len(), 2);
        assert_eq!(again[0].items[0].files.len(), 2);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn presets_round_trip_and_only_one_stays_default() {
        let (store, dir) = temp_store();

        for p in Preset::seeds("D:/Videos") {
            store.save_preset(&p).unwrap();
        }

        let loaded = store.load_presets().unwrap();
        assert_eq!(loaded.len(), 4);
        assert_eq!(loaded.iter().filter(|p| p.is_default).count(), 1, "exactly one preset may be default");

        let best = loaded.iter().find(|p| p.name == "Best (1080p mp4)").unwrap();
        assert_eq!(best.options.max_height, Some(1080));
        assert_eq!(best.options.container.as_deref(), Some("mp4"));
        assert!(best.is_default);

        // Promoting another preset must demote the previous default.
        let mut mp3 = loaded.iter().find(|p| p.name == "MP3 audio").unwrap().clone();
        mp3.is_default = true;
        store.save_preset(&mp3).unwrap();

        let after = store.load_presets().unwrap();
        assert_eq!(after.iter().filter(|p| p.is_default).count(), 1);
        assert!(after.iter().find(|p| p.name == "MP3 audio").unwrap().is_default);
        assert!(!after.iter().find(|p| p.name == "Best (1080p mp4)").unwrap().is_default);

        store.delete_preset("M4A audio").unwrap();
        assert_eq!(store.load_presets().unwrap().len(), 3);

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn settings_round_trip_and_overwrite() {
        let (store, dir) = temp_store();

        assert_eq!(store.get_setting("download_dir").unwrap(), None);
        store.set_setting("download_dir", "D:/Videos").unwrap();
        assert_eq!(store.get_setting("download_dir").unwrap().as_deref(), Some("D:/Videos"));
        store.set_setting("download_dir", "E:/Other").unwrap();
        assert_eq!(
            store.get_setting("download_dir").unwrap().as_deref(),
            Some("E:/Other"),
            "second write must overwrite, not duplicate"
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// A shrinking item list must not leave orphaned items/files behind.
    #[test]
    fn resaving_with_fewer_items_prunes_children() {
        let (store, dir) = temp_store();
        let mut job = sample_job();
        store.save_job(&job).unwrap();

        job.items.truncate(1);
        job.items[0].files.truncate(1);
        store.save_job(&job).unwrap();

        let loaded = store.load_jobs().unwrap();
        assert_eq!(loaded[0].items.len(), 1);
        assert_eq!(loaded[0].items[0].files.len(), 1);
        assert_eq!(loaded[0], job);

        let _ = std::fs::remove_dir_all(&dir);
    }

    /// The point of moving off turso: a file row cannot outlive its item.
    #[test]
    fn deleting_a_job_cascades_to_items_and_files_via_real_foreign_keys() {
        let (store, dir) = temp_store();
        let job = sample_job();
        store.save_job(&job).unwrap();

        let item_id = job.items[0].id.clone();
        let file_count_before: i64 = store
            .conn
            .query_row("SELECT COUNT(*) FROM file WHERE item_id = ?1", params![item_id], |r| r.get(0))
            .unwrap();
        assert_eq!(file_count_before, 2);

        store.delete_job(&job.id).unwrap();

        let items_left: i64 = store.conn.query_row("SELECT COUNT(*) FROM item", [], |r| r.get(0)).unwrap();
        let files_left: i64 = store.conn.query_row("SELECT COUNT(*) FROM file", [], |r| r.get(0)).unwrap();
        assert_eq!(items_left, 0, "ON DELETE CASCADE should have removed items");
        assert_eq!(files_left, 0, "ON DELETE CASCADE should have removed files");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
