// Run with --env-file=<server env file>. Never prints secrets, IP hashes or per-file data.
import { createClient } from '@supabase/supabase-js';
const since = process.argv[2] ?? new Date(Date.now() - 86400000).toISOString();
if (!Number.isFinite(Date.parse(since))) throw new Error('Pass an ISO start timestamp');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const events = [];
for (let offset = 0; offset < 50000; offset += 1000) {
  const { data, error } = await db.from('conversion_analytics').select('*').gte('created_at', since).order('id').range(offset, offset + 999);
  if (error) throw new Error(error.message);
  events.push(...data);
  if (data.length < 1000) break;
}
const tally = (rows, key) => Object.fromEntries([...new Set(rows.map(key))].map(k => [k, rows.filter(r => key(r) === k).length]));
const started = events.filter(r => r.event === 'started');
const finished = events.filter(r => ['succeeded', 'check_failed', 'failed', 'cancelled'].includes(r.event));
const timings = finished.filter(r => Number.isFinite(r.elapsed_ms)).map(r => r.elapsed_ms).sort((a,b) => a-b);
console.log(JSON.stringify({ since, asOf: new Date().toISOString(), events: events.length, truncated: events.length === 50000,
  note: 'Reports are best effort. Network hashes are not unique people. Downloaded means the download link was clicked. Started runs without a finish may indicate a closed tab or missing report.',
  starts: started.length, distinctNetworks: new Set(started.map(r => r.ip_hash)).size,
  outcomes: tally(finished, r => r.event), presets: tally(started, r => r.preset),
  methods: tally(started, r => r.settings.method), reencode: tally(started, r => String((r.settings.shared_encode ?? r.settings.encode).reencode)),
  formats: tally(started, r => r.source.container), browsers: tally(started, r => r.browser), operatingSystems: tally(started, r => r.os),
  countries: tally(started, r => r.country ?? 'unknown'), failureCategories: tally(finished.filter(r=>r.failure_category),r=>r.failure_category),
  campaignSources: tally(started, r => r.settings.attribution?.source ?? 'untagged'),
  campaignSuccesses: tally(finished.filter(r => r.event === 'succeeded'), r => r.settings.attribution?.source ?? 'untagged'),
  campaignContent: tally(started, r => r.settings.attribution?.content ?? 'untagged'),
  downloadClicks: events.filter(r => r.event === 'downloaded').length,
  medianMs: timings.length ? timings[Math.floor(timings.length/2)] : null, p95Ms: timings.length ? timings[Math.min(timings.length-1, Math.ceil(timings.length*.95)-1)] : null,
}, null, 2));
