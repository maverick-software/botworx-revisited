"""Stream COPY rows into bounded-memory, order-independent table fingerprints."""
import hashlib
import re
import sqlite3

IDENTIFIER = re.compile(r'^[a-z_][a-z_0-9]*$')
COPY = re.compile(rb'^COPY ([a-z_][a-z_0-9]*)\."?([a-z_][a-z_0-9]*)"? \(([^\n]+)\) FROM stdin;\n$')
MAX_COPY_ROW = 64 * 1024 * 1024


def lines(stream):
    while True:
        line = stream.readline(MAX_COPY_ROW + 1)
        if not line:
            return
        if len(line) > MAX_COPY_ROW:
            raise ValueError('A COPY row exceeds the bounded audit limit.')
        if not line.endswith(b'\n'):
            raise ValueError('The COPY stream ends with an incomplete line.')
        yield line


def selected(schema, table):
    return schema == 'public' or (schema, table) in [('auth', 'users'), ('vault', 'secrets')]


class Fingerprints:
    def __init__(self, file):
        self.db = sqlite3.connect(file)
        self.db.execute('PRAGMA cache_size=-2048')
        self.db.execute('CREATE TABLE rows(scope TEXT, name TEXT, digest BLOB)')
        self.db.execute('CREATE INDEX ordered_rows ON rows(scope,name,digest)')
        self.tables = {}
        self.accounts = {}
        self.maximum_row_bytes = 0

    def begin(self, scope, name, columns):
        assert scope in ('archive', 'live') and name.count('.') == 1
        assert all(IDENTIFIER.fullmatch(part) for part in name.split('.'))
        assert columns and len(set(columns)) == len(columns)
        assert all(IDENTIFIER.fullmatch(column) for column in columns)
        key = (scope, name)
        assert key not in self.tables, 'Duplicate COPY section: ' + name
        self.tables[key] = {'columns': columns, 'rows': 0}
        if name == 'auth.users':
            assert 'id' in columns
            self.accounts[scope] = []

    def row(self, scope, name, line):
        assert line.endswith(b'\n') and len(line) <= MAX_COPY_ROW
        record = self.tables[(scope, name)]
        fields = line[:-1].split(b'\t')
        assert len(fields) == len(record['columns']), 'Invalid COPY field count: ' + name
        if name == 'auth.users':
            self.accounts[scope].append(fields[record['columns'].index('id')].decode('ascii'))
            keep = [index for index, column in enumerate(record['columns']) if column not in ('last_sign_in_at', 'updated_at')]
            content = b'\t'.join(fields[index] for index in keep)
        else:
            content = line[:-1]
        digest = hashlib.sha256(content).digest()
        self.db.execute('INSERT INTO rows VALUES(?,?,?)', (scope, name, digest))
        record['rows'] += 1
        self.maximum_row_bytes = max(self.maximum_row_bytes, len(line))

    def archive(self, stream, schema):
        active = None
        for line in lines(stream):
            if active is not None:
                if line == b'\\.\n':
                    active = None
                elif active:
                    self.row('archive', active, line)
                continue
            match = COPY.fullmatch(line)
            if match:
                found, table = (part.decode('ascii') for part in match.group(1, 2))
                columns = [part.strip().strip('"') for part in match[3].decode('ascii').split(',')]
                active = ''
                if found == schema and selected(found, table):
                    active = found + '.' + table
                    self.begin('archive', active, columns)
        if active is not None:
            raise ValueError('An archive COPY section is incomplete.')

    def result(self, scope):
        self.db.commit()
        result = {}
        for (found, name), record in self.tables.items():
            if found != scope:
                continue
            digest = hashlib.sha256(b'agentopia-copy-row-sha256-v1\0')
            for row, in self.db.execute('SELECT digest FROM rows WHERE scope=? AND name=? ORDER BY digest', (scope, name)):
                digest.update(row)
            result[name] = {**record, 'sha256': digest.hexdigest()}
        return result

    def close(self):
        self.db.close()
