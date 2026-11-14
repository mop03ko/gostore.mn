// Live hosting runs SQLite 3.7.17 (DEPLOYMENT.md), while local tests use a current SQLite, so newer SQL passes every
// suite here and fails only in production. On 2026-11-13/14 customer-state-save failed 15 times with
// 'near "ON": syntax error' from an UPSERT. This check rejects SQL the live version cannot parse.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
// SQL keywords are written in upper case in this codebase; matching case-sensitively keeps PHP code and comments out.
const rules=[
 ['UPSERT (ON CONFLICT … DO, 3.24); use INSERT OR REPLACE with every column, or UPDATE then INSERT',/ON CONFLICT\s*(\([^)]*\))?\s*DO\s+(UPDATE|NOTHING)\b/],
 ['RETURNING (3.35)',/\bRETURNING\b/],
 ['window functions (3.25)',/\bOVER\s*\(/],
 ['NULLS FIRST/LAST (3.30)',/\bNULLS\s+(FIRST|LAST)\b/],
 ['IS [NOT] DISTINCT FROM (3.39)',/\bIS\s+(NOT\s+)?DISTINCT\s+FROM\b/],
 ['aggregate FILTER (3.30)',/\bFILTER\s*\(\s*WHERE\b/],
 ['common table expressions (3.8.3)',/['"]\s*WITH\s+(RECURSIVE\s+)?\w+(\s*\([^)]*\))?\s+AS\s*\(/],
 ['partial indexes (3.8.0)',/CREATE\s+(UNIQUE\s+)?INDEX\b[^'";]*\bWHERE\b/],
 ['WITHOUT ROWID (3.8.2)',/\bWITHOUT\s+ROWID\b/],
 ['ALTER TABLE RENAME/DROP COLUMN (3.25/3.35)',/\b(RENAME|DROP)\s+COLUMN\b/],
 ['generated columns (3.31)',/\bGENERATED\s+ALWAYS\b/],
 // Parenthesised subqueries are removed first, so only a top-level FROM after SET counts.
 ['UPDATE … FROM (3.33)',{test:s=>{let x=s,y;while((y=x.replace(/\([^()]*\)/g,''))!==x)x=y;return /UPDATE\s+\w+\s+SET\b[^'";]*\bFROM\b/.test(x);}}],
 ['JSON operators/functions (JSON1 is not in 3.7.17)',/->>|\bjson_(extract|each|tree|object|array|group_array|group_object|set|insert|replace|remove|patch|valid|type)\s*\(/i],
 ['iif()/unixepoch() (3.32/3.38)',/\b(iif|unixepoch)\s*\(/i],
];
// The rules must catch what they describe and leave the forms this codebase relies on alone.
const caught=sql=>rules.filter(([,re])=>re.test(sql)).map(([name])=>name);
assert.equal(caught("'INSERT INTO t (a,b) VALUES (?,?) ON CONFLICT(a) DO UPDATE SET b=excluded.b'").length,1);
assert.equal(caught("'INSERT INTO t VALUES (?) ON CONFLICT DO NOTHING'").length,1);
assert.equal(caught("'WITH x AS (SELECT 1) SELECT * FROM x'").length,1);
assert.equal(caught("'CREATE INDEX IF NOT EXISTS i ON t(a) WHERE b IS NULL'").length,1);
assert.equal(caught("'SELECT json_extract(data,\"$.a\") FROM t'").length,1);
assert.equal(caught("'UPDATE t SET a=u.a FROM u WHERE u.id=t.id'").length,1);
for(const ok of ["'INSERT OR REPLACE INTO meta VALUES (?,?)'","'CREATE TABLE t (a TEXT UNIQUE ON CONFLICT REPLACE)'","'UPDATE t SET a=1 WHERE id IN (SELECT id FROM u)'","json_encode($x)","// keeps returning Mongolian"])assert.deepEqual(caught(ok),[],ok);
const files=[];(function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.php'))files.push(p);}})(path.join(root,'server'));
(function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(e.name.endsWith('.php'))files.push(p);}})(path.join(root,'api'));
const found=[];
for(const file of files)fs.readFileSync(file,'utf8').split('\n').forEach((line,i)=>{for(const name of caught(line))found.push(path.relative(root,file).replace(/\\/g,'/')+':'+(i+1)+' '+name);});
assert.deepEqual(found,[],'SQL that live SQLite 3.7.17 cannot run:\n'+found.join('\n'));
console.log('PASS SQLite 3.7.17 compatibility: '+files.length+' server/API PHP files use no UPSERT, RETURNING, window functions, CTEs, partial indexes, JSON1 or other post-3.7.17 SQL.');
