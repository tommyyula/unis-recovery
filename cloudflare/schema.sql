PRAGMA foreign_keys=ON;
CREATE TABLE workspace(id INTEGER PRIMARY KEY CHECK(id=1),title TEXT NOT NULL,tagline TEXT NOT NULL);
CREATE TABLE members(email TEXT PRIMARY KEY CHECK(email=lower(email) AND email LIKE '%@item.com'),enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN(0,1)));
CREATE TABLE people(name TEXT PRIMARY KEY);
CREATE TABLE categories(id TEXT PRIMARY KEY,title TEXT NOT NULL,owners TEXT NOT NULL CHECK(json_valid(owners)),position INTEGER NOT NULL);
CREATE TABLE tasks(id INTEGER PRIMARY KEY AUTOINCREMENT,category_id TEXT NOT NULL REFERENCES categories(id),title TEXT NOT NULL,acceptance TEXT NOT NULL,assignees TEXT NOT NULL DEFAULT '[]' CHECK(json_valid(assignees)),status TEXT NOT NULL DEFAULT 'Not Started' CHECK(status IN('Not Started','In Progress','Blocked','Completed')),priority TEXT NOT NULL DEFAULT 'High' CHECK(priority IN('Critical','High','Normal','Low')),due_date TEXT,notes TEXT NOT NULL DEFAULT '' CHECK(length(notes)<=4000),position INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1,updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),updated_by TEXT);
CREATE TABLE audit(id INTEGER PRIMARY KEY AUTOINCREMENT,task_id INTEGER NOT NULL REFERENCES tasks(id),actor TEXT NOT NULL,changed_at TEXT NOT NULL,before_value TEXT NOT NULL,after_value TEXT NOT NULL);
CREATE TRIGGER task_audit AFTER UPDATE ON tasks BEGIN
 INSERT INTO audit(task_id,actor,changed_at,before_value,after_value) VALUES(NEW.id,NEW.updated_by,NEW.updated_at,json_object('assignees',json(OLD.assignees),'status',OLD.status,'priority',OLD.priority,'due_date',OLD.due_date,'notes',OLD.notes,'version',OLD.version),json_object('assignees',json(NEW.assignees),'status',NEW.status,'priority',NEW.priority,'due_date',NEW.due_date,'notes',NEW.notes,'version',NEW.version));
END;
