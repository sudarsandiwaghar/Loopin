import { dbManager } from '../server/db.ts';

console.log('[Seed] Initializing Loopin reference database...');
const db = dbManager.resetToSeed();
console.log(`[Seed] Seeded ${db.institutions.length} institutions:`);
db.institutions.forEach(i => console.log(`  - ${i.name} (${i.id})`));

console.log(`[Seed] Seeded ${db.users.length} users:`);
db.users.forEach(u => console.log(`  - [${u.role.toUpperCase()}] ${u.email} (${u.name})`));

console.log(`[Seed] Seeded ${db.templates.length} workflow templates:`);
db.templates.forEach(t => console.log(`  - ${t.title} (${t.code})`));

console.log(`[Seed] Seeded ${db.requests.length} reference requests.`);
console.log('[Seed] Database initialization complete. Ready for operation!');
