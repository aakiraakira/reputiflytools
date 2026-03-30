const admin = require('firebase-admin');
const serviceAccount = require('./functions/node_modules/firebase-admin/lib/default-namespace.js');

// Initialize with project defaults
admin.initializeApp({ projectId: 'review-automation-dash' });
const db = admin.firestore();

const orders = [
  { companyName: 'APAX Medical Kovan', dailyTarget: 5, completedCount: 6, quantity: 20, startingCount: 88, comments: 'PLEASE START' },
  { companyName: 'APAX Medical Bukit Panjang', dailyTarget: 5, completedCount: 4, quantity: 20, startingCount: 121, comments: 'PLEASE START' },
  { companyName: 'Hairloft Singapore', dailyTarget: 6, completedCount: 22, quantity: 50, startingCount: 200, comments: 'Start doing, will outsource to Malaysian soon' },
  { companyName: 'MB Karaoke', dailyTarget: 5, completedCount: 7, quantity: 35, startingCount: 2634, comments: 'Recurring Client MAKE SURE TO DO' },
  { companyName: 'Bavarian Capital Pte Ltd', dailyTarget: 5, completedCount: 9, quantity: 46, startingCount: 91, comments: '' },
  { companyName: 'Aqua Luxe', dailyTarget: 5, completedCount: 4, quantity: 50, startingCount: 8, comments: 'New Client START TODAY' },
  { companyName: 'Spark Tutor', dailyTarget: 5, completedCount: 6, quantity: 100, startingCount: 0, comments: 'Please start' },
  { companyName: 'Yaowarat Seafood', dailyTarget: 5, completedCount: 0, quantity: 50, startingCount: 529, comments: '' },
];

async function seed() {
  const batch = db.batch();
  for (const o of orders) {
    const ref = db.collection('orders').doc();
    batch.set(ref, {
      ...o,
      status: 'active',
      assignedEmployees: [],
      tncSigned: false,
      tncSignatureId: null,
      clientTrackingToken: ref.id,
      reviewLink: '',
      placeId: '',
      profileUrl: '',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();
  console.log(`Seeded ${orders.length} orders`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
