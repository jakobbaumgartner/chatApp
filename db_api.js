export const Routes = {
  questions: '/questions',
  answers: '/answers',
  comments: '/comments',
  keywords: '/keywords',
  chatrooms: '/chatrooms',
  publicChatroom: '/chatrooms/0',
  privateChatroom: (uida, uidb) => {
    if(uida < uidb) {
      a ^= b;
      b ^= a;
      a ^= b;
    }
    return '/chatrooms/'+uida+':'+uidb;
  }
};

const db = firebase.database();

export const Queries = {
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

function _transformToArray(object) {
  return Object.keys(object).map(key => {
    object[key]['id'] = key;
    return object[key];
  });
}

export async function getAllQuestions() {
  return _transformToArray((await Queries.allQuestions().once('value')).val());
}

export async function getUserQuestions(user_uid) {
  return _transformToArray(await Queries.userQuestions(user_uid).once('value').val());
}

async function getKeywordQuestionsIDs(keyword) {
  return (await Queries.keywordQuestions(keyword).once('value')).val();
}

export async function getKeywordsQuestions(...keywords) {
  let set = new Set();
  await Promise.all(keywords.map(async keyword => {
    let t = await getKeywordQuestionsIDs(keyword);
    if(t !== null) {
      console.log(t);
      t.forEach( a => set.add(a))
    } else {
      console.error('Keyword ' +keyword+ ' does not exist');
    }
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

  return Object.keys(comments).map(key => assignID('', key, comments[key]));
}

export async function addNewQuestion(obj) {
  var ref = db.ref(Routes.questions).push(obj);
  obj['id'] = ref.key;
  return obj;
}
