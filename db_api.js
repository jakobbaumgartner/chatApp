export const Routes = {
  questions: '/questions',
  answers: '/answers',
  comments: '/comments',
  keywords: '/keywords',
  chatrooms: '/chatrooms',
  publicChatroom: Routes.chatrooms+'/0',
  privateChatroom: (uida, uidb) => {
    if(uida < uidb) {
      a ^= b;
      b ^= a;
      a ^= b;
    }
    return Routes.chatrooms+'/'+uida+':'+uidb;
  }
};

const db = firebase.database();

const Queries = {
  allQuestions: () => db.ref(Routes.questions).orderByChild('createdAt'),
  userQuestions: uid => db.ref(Routes.questions).orderByChild('creator/uid').equalTo(uid),
  keywordQuestions: keyword => db.ref(Routes.keywords).child(keyword),
  questionComments: qid => db.ref(Routes.comments).child(qid),
}

function _processSnapshot(snapshot) {
  let res = snapshot.val();
  res['id'] = snapshot.ref.key;
  return res;
}

export async function getAllQuestions() {
  return (await Queries.allQuestions().once('value')).map(_processSnapshot);
}

export async function getUserQuestions(user_uid) {
  return (await Queries.userQuestions(user_uid).once('value')).map(_processSnapshot);
}

async function getKeywordQuestionsIDs(keyword) {
  return (await Queries.keywordQuestions(keyword).once('value')).val();
}

export async function getKeywordsQuestions(...keywords) {
  let set = new Set();
  await Promise.all(keywords.map(async keyword => {
    let t = await getKeywordQuestionsIDs(keyword);
    t.forEach( a => set.add(a))
  }));

  return await Promise.all(Array.from(set, async qid => {
    let snapshot = await db.ref(Routes.questions+'/'+qid).once('value');
    let value = snapshot.val();
    value['id'] = snapshot.ref.key;
    return value;
  }));
}

export async function getPublicChatroom() {
  return _processSnapshot(await Queries.publicChatroom().once('value'));
}

export async function getPrivateChatroom(uida, uidb) {
  return _processSnapshot(await Queries.privateChatroom(uida, uidb).once('value'));
}

export async function getComments(qid) {
  let comments = (await Queries.questionComments(qid).once('value')).map(_processSnapshot);
  const assignID = (base, yourid, object) => {
    const id = base+'/'+yourid;
    if(typeof(object.children) != typeof(undefined))
      object['children'] = object['children'].map(key => assignID(id, key, object['children']['id']));
    object['id'] = id;
    return object;
  }

  return comments.map(key => assignID('', key, comments[key]));
}
