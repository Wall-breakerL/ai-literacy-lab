create table if not exists analytics_visits (
  id integer primary key autoincrement,
  visit_id text not null unique,
  visitor_hash text not null,
  path text not null,
  referrer_host text,
  occurred_at text not null,
  received_at text not null default (datetime('now'))
);

create index if not exists analytics_visits_visitor_time_idx
  on analytics_visits (visitor_hash, occurred_at desc);

create table if not exists analytics_visitors (
  visitor_hash text primary key,
  first_seen_at text not null,
  last_seen_at text not null,
  visit_count integer not null default 1,
  first_path text,
  last_path text,
  referrer_host text,
  updated_at text not null default (datetime('now'))
);

create table if not exists analytics_visit_days (
  metric_date text not null,
  visitor_hash text not null,
  visit_count integer not null default 1,
  first_seen_at text not null,
  last_seen_at text not null,
  primary key (metric_date, visitor_hash)
);

create table if not exists test_results (
  id integer primary key autoincrement,
  result_id text not null unique,
  visitor_hash text not null,
  session_id text not null unique,
  role text not null,
  tools text not null default '[]',
  personality_code text not null,
  personality_name text not null,
  dimension_scores text not null default '[]',
  fallback_batches text not null default '[]',
  completed_at text not null,
  created_at text not null default (datetime('now'))
);

create index if not exists test_results_personality_idx
  on test_results (personality_code, completed_at desc);

create index if not exists test_results_role_idx
  on test_results (role, completed_at desc);

create table if not exists questionnaire_samples (
  id integer primary key autoincrement,
  test_result_id integer not null references test_results(id) on delete cascade,
  session_id text not null,
  role text not null,
  tools text not null default '[]',
  batch_key text,
  question_index integer not null,
  dimension text not null,
  question text not null,
  scenario text,
  question_type text,
  reverse integer not null default 0,
  score integer,
  skipped integer not null default 0,
  created_at text not null default (datetime('now'))
);

create index if not exists questionnaire_samples_role_dimension_idx
  on questionnaire_samples (role, dimension, created_at desc);

create virtual table if not exists questionnaire_samples_fts
  using fts5(question, content='questionnaire_samples', content_rowid='id');

create trigger if not exists questionnaire_samples_ai after insert on questionnaire_samples begin
  insert into questionnaire_samples_fts(rowid, question) values (new.id, new.question);
end;

create trigger if not exists questionnaire_samples_ad after delete on questionnaire_samples begin
  insert into questionnaire_samples_fts(questionnaire_samples_fts, rowid, question)
  values ('delete', old.id, old.question);
end;

create trigger if not exists questionnaire_samples_au after update on questionnaire_samples begin
  insert into questionnaire_samples_fts(questionnaire_samples_fts, rowid, question)
  values ('delete', old.id, old.question);
  insert into questionnaire_samples_fts(rowid, question) values (new.id, new.question);
end;
