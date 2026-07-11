// Firestore security rules test suite — run against the local emulator only,
// never a real project (see .firebaserc: "demo-courtconnect", the "demo-"
// prefix means the emulator never touches real Google Cloud resources or
// needs real credentials).
//
// Run: node tests/firestore-rules.test.mjs   (with the emulator already
// running on 127.0.0.1:8080 — see scripts.test:rules in package.json for the
// one-shot start+test+stop wrapper).
import { readFileSync } from 'fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, updateDoc, deleteDoc, collection, deleteField, getDocs } from 'firebase/firestore';

const PROJECT_ID = 'demo-courtconnect';

let failures = 0;
async function check(label, promise, shouldSucceed) {
  try {
    if (shouldSucceed) await assertSucceeds(promise);
    else await assertFails(promise);
    console.log(`  ok  ${label}`);
  } catch (e) {
    failures++;
    console.error(`FAIL  ${label}`);
    console.error(`      ${e.message.split('\n')[0]}`);
  }
}

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: '127.0.0.1',
    port: 8080,
  },
});

const alice = testEnv.authenticatedContext('alice').firestore();
const bob   = testEnv.authenticatedContext('bob').firestore();
const carol = testEnv.authenticatedContext('carol').firestore(); // uninvolved third party
const anon  = testEnv.unauthenticatedContext().firestore();

const seed = async fn => testEnv.withSecurityRulesDisabled(async ctx => fn(ctx.firestore()));

// ── Challenges ──────────────────────────────────────────────────────────────
console.log('--- challenges ---');
{
  await check('anonymous cannot create a challenge',
    setDoc(doc(anon, 'challenges', 'anon1'), { fromUid: 'x', toUid: 'bob', status: 'pending' }), false);

  await check('Alice can create a challenge from herself to Bob',
    setDoc(doc(alice, 'challenges', 'ch1'), {
      fromUid: 'alice', fromName: 'Alice', fromUsername: 'alice',
      toUid: 'bob', toName: 'Bob', toUsername: 'bob',
      format: 'MS', venue: 'court', date: '2026-01-01', status: 'pending', createdAt: '2026-01-01',
    }), true);

  await check("Alice cannot create a challenge claiming fromUid=bob (impersonation)",
    setDoc(doc(alice, 'challenges', 'ch2'), { fromUid: 'bob', toUid: 'carol', status: 'pending' }), false);

  await seed(db => setDoc(doc(db, 'challenges', 'ch3'), {
    fromUid: 'alice', toUid: 'bob', status: 'pending', fromName: 'Alice', toName: 'Bob',
  }));
  await check('Bob (the recipient) can accept the challenge',
    updateDoc(doc(bob, 'challenges', 'ch3'), { status: 'accepted' }), true);

  await seed(db => setDoc(doc(db, 'challenges', 'ch4'), { fromUid: 'alice', toUid: 'bob', status: 'pending' }));
  await check('Alice (the sender) can cancel her own outgoing challenge',
    updateDoc(doc(alice, 'challenges', 'ch4'), { status: 'cancelled' }), true);

  await seed(db => setDoc(doc(db, 'challenges', 'ch5'), { fromUid: 'alice', toUid: 'bob', status: 'pending' }));
  await check('Carol (unrelated third party) cannot touch Alice/Bob\'s challenge',
    updateDoc(doc(carol, 'challenges', 'ch5'), { status: 'accepted' }), false);

  await seed(db => setDoc(doc(db, 'challenges', 'ch6'), { fromUid: 'alice', toUid: 'bob', status: 'pending' }));
  await check('nobody can delete a challenge',
    deleteDoc(doc(alice, 'challenges', 'ch6')), false);
}

// ── Conversations ───────────────────────────────────────────────────────────
console.log('--- conversations ---');
{
  await check('Alice can create a conversation she\'s a participant in',
    setDoc(doc(alice, 'conversations', 'alice_bob'), {
      id: 'alice_bob', participantUids: ['alice', 'bob'], participants: {}, messages: [], lastMessage: '', lastAt: '2026-01-01',
    }), true);

  await check('Alice cannot create a conversation she is NOT listed in',
    setDoc(doc(alice, 'conversations', 'bob_carol'), {
      id: 'bob_carol', participantUids: ['bob', 'carol'], messages: [],
    }), false);

  await seed(db => setDoc(doc(db, 'conversations', 'alice_bob2'), {
    participantUids: ['alice', 'bob'], messages: [], lastMessage: '', lastAt: '2026-01-01',
  }));
  await check('Carol (uninvolved) cannot write into Alice+Bob\'s conversation',
    updateDoc(doc(carol, 'conversations', 'alice_bob2'), { lastMessage: 'hacked' }), false);

  await check('nobody can delete a conversation',
    deleteDoc(doc(alice, 'conversations', 'alice_bob')), false);
}

// ── Clubs ────────────────────────────────────────────────────────────────────
console.log('--- clubs ---');
{
  await check('Alice can create a club with herself as sole admin/member',
    setDoc(doc(alice, 'clubs', 'club1'), {
      id: 'club1', name: 'Alice Club', adminId: 'alice', memberIds: ['alice'], pendingIds: [],
      moderatorIds: [], maxMembers: 30, isPrivate: false,
    }), true);

  await check('Alice cannot create a club claiming someone else as admin',
    setDoc(doc(alice, 'clubs', 'club2'), {
      id: 'club2', name: 'Fake', adminId: 'bob', memberIds: ['alice'], pendingIds: [],
    }), false);

  await seed(db => setDoc(doc(db, 'clubs', 'pubclub'), {
    id: 'pubclub', name: 'Public', adminId: 'alice', memberIds: ['alice'], pendingIds: [],
    moderatorIds: [], isPrivate: false, maxMembers: 30,
  }));
  await check('Bob can join a public club by adding only his own uid',
    updateDoc(doc(bob, 'clubs', 'pubclub'), { memberIds: ['alice', 'bob'] }), true);

  await seed(db => setDoc(doc(db, 'clubs', 'pubclub2'), {
    id: 'pubclub2', name: 'Public2', adminId: 'alice', memberIds: ['alice'], pendingIds: [],
    moderatorIds: [], isPrivate: false, maxMembers: 30,
  }));
  await check("Bob cannot add a DIFFERENT uid (mallory) to memberIds",
    updateDoc(doc(bob, 'clubs', 'pubclub2'), { memberIds: ['alice', 'mallory'] }), false);

  await seed(db => setDoc(doc(db, 'clubs', 'pubclub3'), {
    id: 'pubclub3', name: 'Public3', adminId: 'alice', memberIds: ['alice', 'bob'], pendingIds: [],
    moderatorIds: [], isPrivate: false, maxMembers: 30,
  }));
  await check('a non-admin/mod member cannot rename the club',
    updateDoc(doc(bob, 'clubs', 'pubclub3'), { name: 'Bob Hijacked This' }), false);

  await seed(db => setDoc(doc(db, 'clubs', 'reqclub'), {
    id: 'reqclub', name: 'Req', adminId: 'alice', memberIds: ['alice'], pendingIds: ['bob'],
    moderatorIds: [], isPrivate: true, maxMembers: 30,
  }));
  await check('the admin can accept a pending member (management action)',
    updateDoc(doc(alice, 'clubs', 'reqclub'), { memberIds: ['alice', 'bob'], pendingIds: [] }), true);

  await seed(db => setDoc(doc(db, 'clubs', 'annclub'), {
    id: 'annclub', name: 'Ann', adminId: 'alice', memberIds: ['alice'], pendingIds: [],
    moderatorIds: [], isPrivate: false, maxMembers: 30,
  }));
  await check('the admin can update club settings (announcement)',
    updateDoc(doc(alice, 'clubs', 'annclub'), { announcement: 'hello' }), true);

  await seed(db => setDoc(doc(db, 'clubs', 'delclub'), {
    id: 'delclub', name: 'Del', adminId: 'alice', memberIds: ['alice', 'bob'], pendingIds: [],
    moderatorIds: [], isPrivate: false, maxMembers: 30,
  }));
  await check('a non-admin member cannot disband the club', deleteDoc(doc(bob, 'clubs', 'delclub')), false);
  await check('the admin can disband the club', deleteDoc(doc(alice, 'clubs', 'delclub')), true);

  // Legacy clubMessages cleanup path (migrateLegacyClubMessages)
  await seed(db => setDoc(doc(db, 'clubs', 'legacyclub'), {
    id: 'legacyclub', name: 'Legacy', adminId: 'alice', memberIds: ['alice', 'bob'], pendingIds: [],
    moderatorIds: [], isPrivate: false, maxMembers: 30,
    clubMessages: [{ id: 'cm1', senderId: 'alice', senderName: 'Alice', text: 'hi', sentAt: '2026-01-01' }],
  }));
  await check('a member can clear the legacy clubMessages field (migration cleanup)',
    updateDoc(doc(bob, 'clubs', 'legacyclub'), { clubMessages: deleteField() }), true);

  await seed(db => setDoc(doc(db, 'clubs', 'legacyclub2'), {
    id: 'legacyclub2', name: 'Legacy2', adminId: 'alice', memberIds: ['alice', 'bob'], pendingIds: [],
    moderatorIds: [], isPrivate: false, maxMembers: 30,
    clubMessages: [{ id: 'cm1', senderId: 'alice', senderName: 'Alice', text: 'hi', sentAt: '2026-01-01' }],
  }));
  await check('a member cannot REWRITE clubMessages to new content (only clear it)',
    updateDoc(doc(bob, 'clubs', 'legacyclub2'), { clubMessages: [{ id: 'fake', senderId: 'bob', senderName: 'Bob', text: 'injected', sentAt: 'x' }] }), false);
}

// ── Club chat messages subcollection ────────────────────────────────────────
console.log('--- club chat messages ---');
{
  await seed(db => setDoc(doc(db, 'clubs', 'chatclub'), {
    id: 'chatclub', name: 'Chat', adminId: 'alice', memberIds: ['alice', 'bob'], pendingIds: [],
    moderatorIds: [], isPrivate: false, maxMembers: 30,
  }));

  await check('a member can send a club chat message',
    setDoc(doc(alice, 'clubs', 'chatclub', 'messages', 'm1'), {
      id: 'm1', senderId: 'alice', senderName: 'Alice', text: 'hey', sentAt: '2026-01-01',
    }), true);

  await check('a non-member (Carol) cannot send a club chat message',
    setDoc(doc(carol, 'clubs', 'chatclub', 'messages', 'm2'), {
      id: 'm2', senderId: 'carol', senderName: 'Carol', text: 'hi', sentAt: '2026-01-01',
    }), false);

  await seed(db => setDoc(doc(db, 'clubs', 'chatclub', 'messages', 'm3'), {
    id: 'm3', senderId: 'alice', senderName: 'Alice', text: 'hey', sentAt: '2026-01-01',
  }));
  await check('messages are immutable — even a member cannot edit one',
    updateDoc(doc(bob, 'clubs', 'chatclub', 'messages', 'm3'), { text: 'edited' }), false);
  await check('messages cannot be deleted',
    deleteDoc(doc(alice, 'clubs', 'chatclub', 'messages', 'm3')), false);

  await seed(db => setDoc(doc(db, 'clubs', 'privclub'), {
    id: 'privclub', name: 'Priv', adminId: 'alice', memberIds: ['alice'], pendingIds: [],
    moderatorIds: [], isPrivate: true, maxMembers: 30,
  }));
  await check("a non-member cannot even READ a club's chat messages",
    getDocs(collection(bob, 'clubs', 'privclub', 'messages')), false);
}

await testEnv.cleanup();

console.log('\n' + (failures === 0 ? 'ALL RULE CHECKS PASSED (0 failures)' : `${failures} FAILURE(S)`));
process.exit(failures === 0 ? 0 : 1);
