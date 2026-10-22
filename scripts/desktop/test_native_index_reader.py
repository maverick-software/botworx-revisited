from pathlib import Path
import sqlite3,tempfile,unittest
from native_index_reader import frozen_native_index,digest

class FrozenIndexTests(unittest.TestCase):
    def test_committed_wal_is_read_without_changing_the_source(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/'state_5.sqlite';source=sqlite3.connect(file)
            try:
                source.execute('PRAGMA journal_mode=WAL');source.execute('PRAGMA wal_autocheckpoint=0')
                source.execute('CREATE TABLE threads(id TEXT,rollout_path TEXT)');source.execute("INSERT INTO threads VALUES('generated','fixture.jsonl')");source.commit()
                immutable=sqlite3.connect(file.as_uri()+'?immutable=1',uri=True)
                try:self.assertEqual(immutable.execute('SELECT name FROM sqlite_master').fetchall(),[])
                finally:immutable.close()
                before={p.name:digest(p) for p in Path(folder).iterdir()}
                with frozen_native_index(file) as connection:
                    self.assertEqual(connection.execute('PRAGMA integrity_check').fetchone(),('ok',))
                    self.assertEqual(connection.execute('SELECT * FROM threads').fetchall(),[('generated','fixture.jsonl')])
                self.assertEqual({p.name:digest(p) for p in Path(folder).iterdir()},before)
            finally:source.close()
    def test_checkpointed_index_remains_readable(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/'state_5.sqlite';source=sqlite3.connect(file);source.execute('CREATE TABLE threads(id TEXT)');source.commit();source.close()
            with frozen_native_index(file) as connection:self.assertEqual(connection.execute('SELECT * FROM threads').fetchall(),[])
    def test_linked_backup_entry_is_refused(self):
        with tempfile.TemporaryDirectory() as folder:
            file=Path(folder)/'real';file.write_bytes(b'generated');link=Path(folder)/'state_5.sqlite';link.symlink_to(file)
            with self.assertRaises(AssertionError):
                with frozen_native_index(link):pass

if __name__=='__main__':unittest.main()
