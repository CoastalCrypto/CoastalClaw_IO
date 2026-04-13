import { RepairSystem } from '../system/repair.js';

async function main() {
  console.log('Running Coastal.AI Self-Repair...');
  const report = await RepairSystem.run();
  report.forEach(msg => console.log(msg));
  console.log('Repair complete.');
}

main().catch(err => {
  console.error('Repair failed:', err);
  process.exit(1);
});
