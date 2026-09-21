import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

export const digest = value => createHash('sha256').update(value).digest('hex');
export function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  return `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
}
export function passwordMatches(password, hash) {
  const candidate = passwordHash(password, hash.split(':')[0]);
  return candidate.length === hash.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(hash));
}
export function openStore(path) {
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS patients(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),name TEXT NOT NULL,birth_date TEXT NOT NULL,treatment TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
    CREATE TABLE IF NOT EXISTS records(id INTEGER PRIMARY KEY AUTOINCREMENT,patient_id TEXT NOT NULL REFERENCES patients(id),kind TEXT NOT NULL,occurred TEXT NOT NULL,body TEXT NOT NULL,request_key TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(patient_id,request_key));
    CREATE INDEX IF NOT EXISTS records_patient ON records(patient_id,id);
    CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY AUTOINCREMENT,patient_id TEXT NOT NULL REFERENCES patients(id),role TEXT NOT NULL,body TEXT NOT NULL,created TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS messages_patient ON messages(patient_id,id);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT,event TEXT NOT NULL,target TEXT,created TEXT NOT NULL);
  `);
  return {
    db,
    audit(user, event, target = '') { db.prepare('INSERT INTO audit(user_id,event,target,created) VALUES(?,?,?,?)').run(user,event,target,new Date().toISOString()); },
    patient(user, id) { return db.prepare('SELECT id,name,birth_date,treatment,version FROM patients WHERE id=? AND user_id=?').get(id,user); },
    context(user, id) {
      const patient = this.patient(user,id);
      if (!patient) return null;
      const records = db.prepare('SELECT id,kind,occurred,body FROM records WHERE patient_id=? ORDER BY id DESC LIMIT 100').all(id);
      const total = db.prepare('SELECT COUNT(*) AS count FROM records WHERE patient_id=?').get(id).count;
      const summary = db.prepare('SELECT kind,COUNT(*) AS count,MIN(occurred) AS first,MAX(occurred) AS last FROM records WHERE patient_id=? GROUP BY kind').all(id);
      const messages = db.prepare('SELECT role,body FROM messages WHERE patient_id=? ORDER BY id DESC LIMIT 8').all(id).reverse();
      // Do not transmit account names, emails or identifiers to the model.
      return { patient: { birthDate:patient.birth_date, prescribedTreatment:patient.treatment },records,totalRecords:total,summary,historyIsPartial:total>records.length,messages };
    },
    session(user) {
      const token = randomBytes(32).toString('base64url');
      db.prepare('DELETE FROM sessions WHERE expires < ?').run(Date.now());
      db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(token),user,Date.now()+7*86400000);
      return token;
    },
    userFor(token) { return db.prepare('SELECT u.id,u.name,u.email FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.hash=? AND s.expires>?').get(digest(token),Date.now()); },
    newId: randomUUID,
  };
}
