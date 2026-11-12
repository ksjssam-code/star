/**
 * 별 탐구실 — 구글 시트 연동 코드 (Google Apps Script)
 *
 * 처음 설치
 * 1. 구글 시트 → [확장 프로그램] → [Apps Script]
 * 2. 기본 코드를 모두 지우고 이 파일 내용을 붙여 넣은 뒤 저장
 * 3. [배포] → [새 배포] → 유형: 웹 앱 (실행: 나 / 액세스: 모든 사용자)
 * 4. 나오는 "웹 앱 URL"을 index.html 의 API_URL 에 붙여 넣기
 *
 * 코드를 바꾼 뒤 다시 배포 (주소 그대로 유지)
 *   [배포] → [배포 관리] → 연필(수정) → 버전: [새 버전] → [배포]
 *
 * 시트 (처음 사용할 때 자동 생성)
 *   - 학생 명부 : 반·번호·이름·닉네임·PIN(암호화)·점수 보정
 *       · 닉네임 바꾸기 → '닉네임' 칸 직접 수정
 *       · PIN 잊어버림 → 'PIN' 칸 지우기 (학생이 다음 로그인 때 새로 정함)
 *       · 점수 더하기/빼기 → '점수 보정' 칸에 숫자 (예: 5, -3)
 *   - 1차시 탐구 / 2차시 탐구 / 3차시 탐구 : 학생별 탐구 결과 (반·번호 순 자동 정렬)
 *   - 질문 / 답변 : 호기심 은하 게시판
 *       · 부적절한 글 → '숨김' 체크 (게시판에서 사라지고 점수도 빠짐)
 *       · 좋은 글 → '좋은 글' 체크 (+5점)
 *       · 선생님 답변 → '답변' 시트 새 줄에 질문 ID 복사, 반 칸에 "교사", 답변 칸에 내용
 *   - 시트 메뉴 [⭐ 별 탐구실] → 반·번호 순 정렬 / 학생 점수 새로 계산
 */

const CLASSES = ['2-1', '2-2', '2-3', '2-4'];
const MAXLEN = 2000;
const HEAD_BG = '#fff2cc';
const R_HEAD = ['반', '번호', '이름', '닉네임', 'PIN', '점수 보정', '등록 시각', '현재 점수', '등급'];
const Q_HEAD = ['ID', '작성 시각', '차시', '반', '번호', '이름', '내용', '숨김', '말머리', '익명', '좋은 글'];
const A_HEAD = ['ID', '질문 ID', '작성 시각', '반', '번호', '이름', '답변', '숨김', '좋은 글'];
const TAGS = ['질문', '궁금해', '해 보고 싶은 탐구', '생각한 점'];
const LEVELS = [[0, '성운', '☁️'], [5, '적색 별', '🔴'], [15, '주황색 별', '🟠'], [30, '황색 별', '🟡'], [50, '백색 별', '⚪'], [75, '청백색 별', '🔷'], [100, '청색 별', '💙'], [140, '초신성', '💥']];
const PTS = { submit: 5, pass: 5, perfect: 3, post: 2, answer: 3, good: 5, dailyBoardCap: 10, minLen: 10 };

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'list') return json_(listQuestions_(String(p.lesson || 'all')));
  return json_({ ok: true, msg: '별 탐구실 API 작동 중' });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: '잘못된 요청' }); }
  if (!isValidStudent_(d)) return json_({ ok: false, error: '반·번호·이름을 확인하기' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (d.action === 'login') return json_(login_(d));
    const me = auth_(d);
    if (!me.ok) return json_(me);
    let res;
    if (d.action === 'submit') res = submit_(d);
    else if (d.action === 'question') res = addQuestion_(d, me);
    else if (d.action === 'answer') res = addAnswer_(d);
    else if (d.action === 'me') res = { ok: true };
    else return json_({ ok: false, error: '알 수 없는 요청' });
    if (res.ok) { const p = pointsOf_(d.cls, d.num); res.points = p; res.level = level_(p); }
    return json_(res);
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- 시트 메뉴 ---------------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('⭐ 별 탐구실')
    .addItem('탐구 결과 반·번호 순으로 정렬', 'sortAllSheets')
    .addItem('학생 명부 점수·등급 새로 계산', 'refreshRoster')
    .addToUi();
}
function sortAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['1차시 탐구', '2차시 탐구', '3차시 탐구', '학생 명부'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s) sortByClassNum_(s, n === '학생 명부' ? 1 : 2);
  });
}
function refreshRoster() {
  const s = sheet_('학생 명부', R_HEAD);
  const last = s.getLastRow();
  if (last < 2) return;
  const all = allPoints_();
  const rows = s.getRange(2, 1, last - 1, 2).getValues();
  const out = rows.map(function (r) { const p = all[key_(r[0], r[1])] || 0; const lv = level_(p); return [p, lv.icon + ' ' + lv.name]; });
  s.getRange(2, 8, out.length, 2).setValues(out);
}

/* ---------------- 로그인 / 학생 명부 ---------------- */
function login_(d) {
  const s = sheet_('학생 명부', R_HEAD);
  const pin = String(d.pin || '');
  if (!/^\d{4}$/.test(pin)) return { ok: false, error: 'PIN은 숫자 4자리' };
  const found = findRoster_(s, d.cls, d.num);
  if (!found) {
    const nick = String(d.nick || '').trim();
    if (!nick) return { ok: false, need: 'register' };
    const bad = checkNick_(nick, s);
    if (bad) return { ok: false, need: 'register', error: bad };
    s.appendRow([safe_(d.cls), Number(d.num), safe_(clip_(d.name, 20).trim()), safe_(nick), safe_(hash_(d, pin)), '', new Date(), 0, '☁️ 성운']);
    sortByClassNum_(s, 1);
    return withPoints_({ ok: true, nick: nick, created: true }, d);
  }
  const r = found.row;
  if (String(r[2]).trim() !== String(d.name).trim()) return { ok: false, error: '이 반·번호로 등록된 이름과 다름 (선생님께 문의)' };
  if (!String(r[4])) { // 선생님이 PIN을 지운 경우 → 새로 등록
    s.getRange(found.idx, 5).setValue(safe_(hash_(d, pin)));
  } else if (String(r[4]) !== hash_(d, pin)) {
    return { ok: false, error: 'PIN이 맞지 않음 (잊었으면 선생님께 말하기)' };
  }
  return withPoints_({ ok: true, nick: String(r[3]) }, d);
}
function auth_(d) {
  const s = sheet_('학생 명부', R_HEAD);
  const f = findRoster_(s, d.cls, d.num);
  if (!f) return { ok: false, error: '먼저 로그인하기', relogin: true };
  if (String(f.row[2]).trim() !== String(d.name).trim() || String(f.row[4]) !== hash_(d, String(d.pin || ''))) return { ok: false, error: '로그인 정보가 맞지 않음. 다시 로그인하기', relogin: true };
  return { ok: true, nick: String(f.row[3]) };
}
function withPoints_(o, d) { const p = pointsOf_(d.cls, d.num); o.points = p; o.level = level_(p); return o; }
function findRoster_(s, cls, num) {
  const last = s.getLastRow();
  if (last < 2) return null;
  const rows = s.getRange(2, 1, last - 1, R_HEAD.length).getValues();
  for (let i = 0; i < rows.length; i++) if (String(rows[i][0]) === cls && Number(rows[i][1]) === Number(num)) return { row: rows[i], idx: i + 2 };
  return null;
}
function checkNick_(nick, s) {
  if (nick.length < 2 || nick.length > 8) return '닉네임은 2~8자';
  if (/[<>"'&\s]/.test(nick)) return '닉네임에 띄어쓰기·특수 기호는 쓸 수 없음';
  if (['선생님', '교사', '익명', '관리자'].indexOf(nick) >= 0) return '쓸 수 없는 닉네임';
  const last = s.getLastRow();
  if (last >= 2) {
    const nicks = s.getRange(2, 4, last - 1, 1).getValues().map(function (r) { return String(r[0]).toLowerCase(); });
    if (nicks.indexOf(nick.toLowerCase()) >= 0) return '이미 다른 친구가 쓰는 닉네임';
  }
  return '';
}
function nickMap_() {
  const s = sheet_('학생 명부', R_HEAD);
  const last = s.getLastRow(), m = {};
  if (last < 2) return m;
  s.getRange(2, 1, last - 1, 4).getValues().forEach(function (r) { m[key_(r[0], r[1])] = String(r[3]); });
  return m;
}
function hash_(d, pin) {
  const b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'starlab|' + d.cls + '|' + Number(d.num) + '|' + pin, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('').slice(0, 24);
}
function key_(cls, num) { return String(cls) + '#' + Number(num); }

/* ---------------- 점수 · 등급 ---------------- */
function level_(p) {
  let i = 0;
  for (let k = 0; k < LEVELS.length; k++) if (p >= LEVELS[k][0]) i = k;
  const next = LEVELS[i + 1];
  return { name: LEVELS[i][1], icon: LEVELS[i][2], idx: i, next: next ? next[0] : null, nextName: next ? next[1] : null };
}
function pointsOf_(cls, num) { return allPoints_()[key_(cls, num)] || 0; }
function allPoints_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet(), pts = {};
  const add = function (k, v) { pts[k] = (pts[k] || 0) + v; };
  // 탐구 제출 · 형성평가
  ['1', '2', '3'].forEach(function (L) {
    const s = ss.getSheetByName(L + '차시 탐구');
    if (!s || s.getLastRow() < 2) return;
    const v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues();
    const h = v[0].map(String), iPass = h.indexOf('형성평가 통과'), iFirst = h.indexOf('형성평가 첫 채점(자동 4문항)');
    for (let i = 1; i < v.length; i++) {
      const k = key_(v[i][1], v[i][2]);
      add(k, PTS.submit);
      if (iPass >= 0 && String(v[i][iPass]) === '통과') add(k, PTS.pass);
      if (iFirst >= 0 && String(v[i][iFirst]).replace(/\s/g, '') === '4/4') add(k, PTS.perfect);
    }
  });
  // 게시판 (하루 상한)
  const daily = {};
  const board = function (rows, iCls, iNum, iTime, iText, iHide, iGood, base) {
    rows.forEach(function (r) {
      if (!r[0] || r[iHide] === true || String(r[iCls]) === '교사') return;
      const k = key_(r[iCls], r[iNum]);
      if (String(r[iText]).replace(/\s/g, '').length >= PTS.minLen) {
        const day = k + '|' + Utilities.formatDate(new Date(r[iTime]), 'Asia/Seoul', 'yyyyMMdd');
        const got = daily[day] || 0, gain = Math.max(0, Math.min(base, PTS.dailyBoardCap - got));
        daily[day] = got + gain; add(k, gain);
      }
      if (r[iGood] === true) add(k, PTS.good);
    });
  };
  board(rows_(sheet_('질문', Q_HEAD), Q_HEAD.length), 3, 4, 1, 6, 7, 10, PTS.post);
  board(rows_(sheet_('답변', A_HEAD), A_HEAD.length), 3, 4, 2, 6, 7, 8, PTS.answer);
  // 선생님 보정
  const rs = sheet_('학생 명부', R_HEAD);
  if (rs.getLastRow() >= 2) rs.getRange(2, 1, rs.getLastRow() - 1, 6).getValues().forEach(function (r) { const b = Number(r[5]); if (b) add(key_(r[0], r[1]), b); });
  Object.keys(pts).forEach(function (k) { if (pts[k] < 0) pts[k] = 0; });
  return pts;
}

/* ---------------- 탐구 결과 제출 ---------------- */
function submit_(d) {
  const L = String(d.lesson);
  if (['1', '2', '3'].indexOf(L) < 0) return { ok: false, error: '차시 오류' };
  const s = sheet_(L + '차시 탐구', ['최종 제출', '반', '번호', '이름', '제출 횟수']);
  const fields = (d.fields || []).slice(0, 40).map(function (f) { return [clip_(f[0], 60), clip_(f[1], MAXLEN)]; });
  let headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String);
  fields.forEach(function (f) {
    if (f[0] && headers.indexOf(f[0]) < 0) {
      headers.push(f[0]);
      s.getRange(1, headers.length).setValue(f[0]).setFontWeight('bold').setBackground(HEAD_BG);
    }
  });
  const last = s.getLastRow();
  let row = -1;
  if (last > 1) {
    const ids = s.getRange(2, 2, last - 1, 2).getValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === d.cls && Number(ids[i][1]) === Number(d.num)) { row = i + 2; break; }
    }
  }
  const vals = new Array(headers.length).fill('');
  let count = 0;
  if (row > 0) {
    const old = s.getRange(row, 1, 1, headers.length).getValues()[0];
    for (let i = 0; i < old.length; i++) vals[i] = typeof old[i] === 'string' ? safe_(old[i]) : old[i];
    count = Number(old[4]) || 0;
  } else {
    row = last + 1;
  }
  vals[0] = new Date();
  vals[1] = safe_(d.cls);
  vals[2] = Number(d.num);
  vals[3] = safe_(clip_(d.name, 20));
  vals[4] = count + 1;
  fields.forEach(function (f) { const i = headers.indexOf(f[0]); if (i >= 0) vals[i] = safe_(f[1]); });
  s.getRange(row, 1, 1, vals.length).setValues([vals]).setVerticalAlignment('top');
  s.getRange(row, 6, 1, Math.max(1, vals.length - 5)).setWrap(true);
  sortByClassNum_(s, 2);
  return { ok: true };
}

function sortByClassNum_(s, startCol) {
  const last = s.getLastRow();
  if (last > 2) s.getRange(2, 1, last - 1, s.getLastColumn()).sort([{ column: startCol, ascending: true }, { column: startCol + 1, ascending: true }]);
}

/* ---------------- 호기심 은하 게시판 ---------------- */
function addQuestion_(d, me) {
  const L = String(d.lesson);
  const text = clip_(d.text, 500).trim();
  const tag = TAGS.indexOf(d.tag) >= 0 ? d.tag : '질문';
  if (['1', '2', '3'].indexOf(L) < 0 || !text) return { ok: false, error: '내용 확인' };
  const s = sheet_('질문', Q_HEAD);
  ensureHead_(s, Q_HEAD);
  s.appendRow([safe_(newId_()), new Date(), L, safe_(d.cls), Number(d.num), safe_(clip_(d.name, 20)), safe_(text), false, safe_(tag), (tag === '질문' && d.anon === true), false]);
  const r = s.getLastRow();
  s.getRange(r, 8).insertCheckboxes(); s.getRange(r, 10).insertCheckboxes(); s.getRange(r, 11).insertCheckboxes();
  return { ok: true };
}

function addAnswer_(d) {
  const text = clip_(d.text, 500).trim();
  const qid = clip_(d.qid, 20);
  if (!text || !qid) return { ok: false, error: '내용 확인' };
  const s = sheet_('답변', A_HEAD);
  ensureHead_(s, A_HEAD);
  s.appendRow([safe_(newId_()), safe_(qid), new Date(), safe_(d.cls), Number(d.num), safe_(clip_(d.name, 20)), safe_(text), false, false]);
  const r = s.getLastRow();
  s.getRange(r, 8).insertCheckboxes(); s.getRange(r, 9).insertCheckboxes();
  return { ok: true };
}

function listQuestions_(lesson) {
  const nicks = nickMap_(), pts = allPoints_();
  const who = function (cls, num, anon) {
    if (String(cls) === '교사' || String(cls) === '선생님') return { who: '선생님', icon: '👩‍🏫' };
    if (anon) return { who: '익명', icon: '🌑' };
    const k = key_(cls, num);
    return { who: nicks[k] || '별탐험가', icon: level_(pts[k] || 0).icon };
  };
  const qs = rows_(sheet_('질문', Q_HEAD), Q_HEAD.length).filter(function (r) { return r[0] && r[7] !== true && (lesson === 'all' || String(r[2]) === lesson); });
  const as = rows_(sheet_('답변', A_HEAD), A_HEAD.length).filter(function (r) { return r[1] && r[7] !== true; });
  const out = qs.map(function (r) {
    const w = who(r[3], r[4], r[9] === true);
    return {
      id: String(r[0]), time: iso_(r[1]), lesson: String(r[2]), cls: String(r[3]), who: w.who, icon: w.icon,
      tag: TAGS.indexOf(String(r[8])) >= 0 ? String(r[8]) : '질문', good: r[10] === true, text: String(r[6]),
      answers: as.filter(function (a) { return String(a[1]) === String(r[0]); })
        .map(function (a) { const aw = who(a[3], a[4], false); return { time: iso_(a[2]), who: aw.who, icon: aw.icon, good: a[8] === true, text: String(a[6]) }; })
        .sort(function (x, y) { return x.time < y.time ? -1 : 1; })
    };
  }).sort(function (x, y) { return x.time < y.time ? 1 : -1; });
  return { ok: true, questions: out };
}

/* ---------------- 도우미 ---------------- */
function sheet_(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground(HEAD_BG);
    s.setFrozenRows(1);
  }
  return s;
}
function ensureHead_(s, headers) {
  const n = s.getLastColumn();
  if (n < headers.length) s.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold').setBackground(HEAD_BG);
}
function rows_(s, n) {
  const last = s.getLastRow();
  if (last < 2) return [];
  return s.getRange(2, 1, last - 1, n).getValues();
}
function isValidStudent_(d) {
  return d && CLASSES.indexOf(d.cls) >= 0 && Number(d.num) >= 1 && Number(d.num) <= 40 && String(d.name || '').trim().length > 0;
}
function clip_(v, n) { return String(v == null ? '' : v).slice(0, n); }
/* 글자 그대로 저장 (수식·날짜로 바뀌지 않도록: "2-1" → 2월 1일 방지) */
function safe_(v) { v = String(v); return v === '' ? '' : "'" + v; }
function newId_() { return Utilities.getUuid().slice(0, 8); }
function iso_(t) { try { return new Date(t).toISOString(); } catch (e) { return ''; } }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
