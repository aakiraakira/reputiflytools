const admin = require('firebase-admin');

// Use default credentials (from firebase login)
const app = admin.initializeApp({
  projectId: 'review-automation-dash',
  credential: admin.credential.applicationDefault()
});

async function reset() {
  // Reset admin password
  const adminUser = await admin.auth().getUserByEmail('realjuliantung@gmail.com');
  await admin.auth().updateUser(adminUser.uid, { password: 'Julian2026!' });
  console.log('Admin password reset to: Julian2026!');

  // Reset employee password
  const empUser = await admin.auth().getUserByEmail('farhan@reputifly.com');
  await admin.auth().updateUser(empUser.uid, { password: 'Farhan2026!' });
  console.log('Employee password reset to: Farhan2026!');

  process.exit(0);
}

reset().catch(e => { console.error(e.message); process.exit(1); });
