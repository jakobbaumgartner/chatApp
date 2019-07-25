/*
  Contains routes to different collections in database, relative to '/'
*/
// TODO: make it consistant - either transform each value to function or extract functions
export const Routes = {
  questions: '/questions',
  answers: '/answers',
  keywords: '/keywords',
  chatrooms: '/chatrooms',
  publicChatroom: '/chatrooms/0', // public chatroom has a constant id of 0
  privateChatroom: (uida, uidb) => { // private chatrooms' id is determined from uids of participants
    if(uida < uidb) {
      // XOR swap
      uida ^= uidb;
      uidb ^= uida;
      uida ^= uidb;
    }
    return '/chatrooms/'+uida+':'+uidb;
  }
};

const db = firebase.database();

const Queries = {
   // query to all of the questions
  allQuestions: () => db.ref(Routes.questions).orderByChild('createdAt'),

  // query to all questions created by user
  userQuestions: uid => db.ref(Routes.questions).orderByChild('creator/uid').equalTo(uid),

  // query to all questions associated with given keyword
  keywordQuestionIDs: keyword => db.ref(Routes.keywords).child(keyword),

  // query to answers associated to given question
  questionAnswers: qid => db.ref(Routes.answers).child(qid),
}

/*
  Extracts values from DatabaseSnapshot and inserts them with id,
*/
function _processSnapshot(snapshot) {
  let res = snapshot.val();
  res['id'] = snapshot.ref.key;
  return res;
}

/*
  Transforms array-like objects into actuals arrays ignoring ids.
  Usually used for objects that have been defined as arrays in example database
*/
function _transformToArray(object) {
  return Object.keys(object).map(key => {
    return object[key];
  });
}

/*
  Transforms array-like objects into actuals arrays and inserts them with their original id.
  Usually used for objects that have been defined as arrays in example database
*/
function _transformToArrayAndInsertID(object) {
  return Object.keys(object).map(key => {
    object[key]['id'] = key;
    return object[key];
  });
}

// status: tested - working
export async function getAllQuestions() {
  return _transformToArrayAndInsertID((await Queries.allQuestions().once('value')).val());
}

// status: tested - working
export async function getUserQuestions(user_uid) {
  return _transformToArrayAndInsertID(await Queries.userQuestions(user_uid).once('value').val());
}

/*
  Returns array of questions' ids associated with the given keyword
*/
async function getKeywordQuestionsIDs(keyword) {
  return _transformToArray((await Queries.keywordQuestionIDs(keyword).once('value')).val());
}

/*
  Return an array of unique question objects associated with at least one of the given keywords
*/
// status: tested - working
export async function getKeywordsQuestions(...keywords) {
  // Determine unique ids
  let set = new Set();
  await Promise.all(keywords.map(async keyword => {
    let t = await getKeywordQuestionsIDs(keyword);
    if(t !== null) {
      t.forEach(a => set.add(a));
    } else {
      console.error('Keyword ' +keyword+ ' does not exist');
    }
  }));

  // Fetch actuall objects
  return await Promise.all(Array.from(set, async qid => {
    let snapshot = await db.ref(Routes.questions+'/'+qid).once('value');
    let value = snapshot.val();
    value['id'] = snapshot.ref.key;
    return value;
  }));
}

/*
  Returns JSON containing the entire public chatroom
*/
// status: tested - working
export async function getPublicChatroom() {
  return _processSnapshot(await db.ref(Routes.publicChatroom).once('value'));
}

/*
  Returns JSON containing the entire private channel for participants. Uids' order doesn't matter
*/
// status: same as getPublicChatroom
export async function getPrivateChatroom(uida, uidb) {
  return _processSnapshot(await Queries.privateChatroom(uida, uidb).once('value'));
}
// TODO: getPublicChatroom and getPrivateChatroom look simmilar. Extract getChatroom(id) function from them

/*
  Return JSON with entire answer tree associated to questions
*/
// status: tested - working
export async function getQuestionAnswers(qid) {
  let answers = _transformToArrayAndInsertID((await Queries.questionAnswers(qid).once('value')).val());
  const assignID = (base, yourid, object) => {
    const id = base+'/'+yourid;
    if(typeof object.children !== 'undefined'){
      object['children'] = Object.keys(object['children']).map(key => assignID(id+'/children', key, object.children[key]));
    }
    object['id'] = id;
    return object;
  }

  return answers.map(answer => assignID('', answer.id, answer));
}

/*
  Inserts what into where, after inserting the timestamp.
  Return what inserted with id.
*/
// status: tested - working
async function addToDatabase(where, what) {
  what['timestamp'] = firebase.database.ServerValue.TIMESTAMP;

  // we will be adding id anyway, so there is no need to store it
  delete what.id;

  var ref = where.push(what);
  what['id'] = ref.key;
  return what;
}

/*
  Inserts new object into question collection.
  Required fields: creator: {name, uid}, keywords: array
  Automatically inserts id and current timestamp
*/
// status: tested - working
export async function addNewQuestion(obj) {
  obj = await addToDatabase(db.ref(Routes.questions), obj);
  obj.keywords.forEach(keyword => db.ref(Queries.keywordQuestionIDs(keyword)).push(obj.id));

  return obj
}

/*
  Inserts new object into question collection.
  Required fields: creator: {name, uid}
*/
// status: tested - working
export function addNewAnswer(to, answer_obj) {
  return addToDatabase(Queries.questionAnswers(to), answer_obj)
}

/*
  Increments the rating of pointed item. If not present, sets it to 1.
  Might upvote things that are not supposed to be upvoted.
*/
// status: tested - working
async function upvote(what) {
  const query = db.ref(what).child('rating');
  const objectExists = (await db.ref(what).once('value')).exists()
  if(!objectExists) {
    console.error('Object does not exist');
  } else {
    query.set((await query.once('value')).val()+1);
  }
  // TODO: Check if current user votes for the first time. Multiple votes are not allowed
}

/*
  Upvotes question with id of qid
*/
export function upvoteQuestion(qid) {
  return upvote(Routes.questions + '/' + qid);
}

/*
  Upvotes question with id of aid
*/
export function upvoteAnswer(aid) {
  return upvote(Routes.answers + aid);
}
