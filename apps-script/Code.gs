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
 *   - 1~6차시 탐구 : 학생별 탐구 결과 (반·번호 순 자동 정렬)
 *       · 1~3차시 = Ⅷ-1 별 / 4차시 = 우리은하 / 5차시 = 팽창하는 우주 / 6차시 = 우주 탐사
 *   - 질문 / 답변 : 호기심 은하 게시판
 *       · 부적절한 글 → '숨김' 체크 (게시판에서 사라지고 점수도 빠짐)
 *       · 좋은 글 → '좋은 글' 체크 (+5점)
 *       · 선생님 답변 → '답변' 시트 새 줄에 질문 ID 복사, 반 칸에 "교사", 답변 칸에 내용
 *   - 학생 화면에 보일 차시: 교사 화면 하단 [🔒 차시 공개]에서 켜고 끔 (처음엔 1~3차시만 공개)
 *   - 패널티 : 기간 동안 로그인 막기 (반·번호·이름·시작일·종료일·사유) → 학생 명부 '패널티' 칸에도 기간 표시
 *   - 이탈 기록 : 교사 화면 [👀 이탈 감지]를 켠 동안, 학생이 이 화면을 벗어난 시각·시간 기록
 *   - 시트 메뉴 [⭐ 별 탐구실] → 반·번호 순 정렬 / 학생 점수 새로 계산 / 교사용 그래프 보기 비밀번호 설정
 */

const CLASSES = ['2-1', '2-2', '2-3', '2-4'];
const LESSONS = ['1', '2', '3', '4', '5', '6', '7']; // 1~3: Ⅷ-1 별 · 4: 우리은하 · 5: 팽창하는 우주 · 6: 우주 탐사 · 7: 총괄평가
function sheetName_(L) { return L === '7' ? '총괄평가' : L + '차시 탐구'; }
const MAXLEN = 2000;
const HEAD_BG = '#fff2cc';
const R_HEAD = ['반', '번호', '이름', '닉네임', 'PIN', '점수 보정', '등록 시각', '현재 점수', '등급'];
const Q_HEAD = ['ID', '작성 시각', '차시', '반', '번호', '이름', '내용', '숨김', '말머리', '익명', '좋은 글'];
const A_HEAD = ['ID', '질문 ID', '작성 시각', '반', '번호', '이름', '답변', '숨김', '좋은 글'];
const TAGS = ['궁금해요', '해 보고 싶은 탐구', '오늘의 발견'];
const TAG_OLD = { '질문': '궁금해요', '궁금해': '궁금해요', '생각한 점': '오늘의 발견', '새로 알게 된 점': '오늘의 발견' };
function tagOf_(t) { t = String(t || ''); t = TAG_OLD[t] || t; return TAGS.indexOf(t) >= 0 ? t : '궁금해요'; }
const LEVELS = [[0, '성운', '☁️'], [5, '적색 별', '🔴'], [12, '주황색 별', '🟠'], [22, '황색 별', '🟡'], [35, '백색 별', '⚪'], [50, '청백색 별', '🔷'], [70, '청색 별', '💙'], [100, '초신성', '💥']];
const TEACHER_PAGE_HASH = 'f5fc84951e21513f2385c806857b4194ef4c526ceb8ec77430a2185b760f8cd3';
const PTS = { post: 2, answer: 3, good: 5, dailyBoardCap: 10, minLen: 10 };

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'list') return json_(listQuestions_(String(p.lesson || 'all')));
  if (p.action === 'track') { const t = trackState_(); return json_({ ok: true, track: t.on ? { on: true, cls: t.cls, until: t.until } : { on: false } }); }
  if (p.action === 'settrack') return json_(setTrack_(String(p.key || ''), String(p.on || ''), String(p.cls || ''), String(p.min || '')));
  if (p.action === 'away') return json_(awayList_(String(p.key || ''), String(p.cls || '')));
  if (p.action === 'graphs') return json_(teacherGraphs_(String(p.key || '')));
  if (p.action === 'open') return json_({ ok: true, open: openLessons_() });
  if (p.action === 'setopen') return json_(setOpen_(String(p.key || ''), String(p.open || '')));
  return json_({ ok: true, msg: '별 탐구실 API 작동 중' });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: '잘못된 요청' }); }
  if (!isValidStudent_(d)) return json_({ ok: false, error: '반·번호·이름을 확인하기' });
  if (d.action === 'ping' || d.action === 'leave' || d.action === 'back') return json_(trackEvent_(d));
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const pen = penaltyIn_(penaltySheet_(), d);
    if (pen) return json_({ ok: false, penalty: true, relogin: d.action !== 'login', error: penaltyMsg_(pen) });
    if (d.action === 'login') { const lr = login_(d); if (lr.ok) lr.penHist = penaltyHistory_(d); return json_(lr); }
    const me = auth_(d);
    if (!me.ok) return json_(me);
    let res;
    if (d.action === 'submit') res = submit_(d);
    else if (d.action === 'question') res = addQuestion_(d, me);
    else if (d.action === 'answer') res = addAnswer_(d);
    else if (d.action === 'me') res = { ok: true };
    else if (d.action === 'mine') res = mine_(d);
    else return json_({ ok: false, error: '알 수 없는 요청' });
    if (res.ok) { const p = pointsOf_(d.cls, d.num); res.points = p; res.level = level_(p); }
    if (res.ok && (d.action === 'mine' || d.action === 'me')) res.penHist = penaltyHistory_(d);
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
    .addItem('패널티 시트 정리 (상태·학생 명부 표시)', 'refreshPenalties')
    .addItem('교사용 그래프 보기 비밀번호 설정', 'setTeacherKey')
    .addToUi();
}
function sortAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  LESSONS.map(sheetName_).concat(['학생 명부']).forEach(function (n) {
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

function setTeacherKey() {
  const ui = SpreadsheetApp.getUi();
  const r = ui.prompt('교사용 그래프 보기 비밀번호', '교사 화면의 [📊 학생 그래프]에서 입력할 비밀번호 (4자 이상)', ui.ButtonSet.OK_CANCEL);
  if (r.getSelectedButton() !== ui.Button.OK) return;
  const v = r.getResponseText().trim();
  if (v.length < 4) { ui.alert('4자 이상으로 정하기'); return; }
  PropertiesService.getScriptProperties().setProperty('TEACHER_KEY', v);
  ui.alert('설정 완료! 교사 화면에서 이 비밀번호로 학생 그래프를 볼 수 있음');
}

/* ---------------- 교사용: 비밀번호 확인 · 차시 공개(잠금) ---------------- */
// 교사용 페이지 비밀번호로 열림 (시트 메뉴에서 따로 비밀번호를 정했다면 그것도 가능)
function teacherOk_(key) {
  if (!key) return false;
  const real = PropertiesService.getScriptProperties().getProperty('TEACHER_KEY');
  const dg = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'starlab-teacher|' + key, Utilities.Charset.UTF_8)
    .map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
  return key === real || dg === TEACHER_PAGE_HASH;
}
// 학생 화면에 보이는 차시 (처음에는 1~3차시만 공개). 교사 화면 [🔒 차시 공개]에서 바꿈
function openLessons_() {
  const v = PropertiesService.getScriptProperties().getProperty('OPEN_LESSONS');
  if (v === null) return ['1', '2', '3'];
  return v.split(',').filter(function (L) { return LESSONS.indexOf(L) >= 0; });
}
function setOpen_(key, open) {
  if (!teacherOk_(key)) return { ok: false, error: '비밀번호가 맞지 않음', badKey: true };
  const list = open.split(',').filter(function (L) { return LESSONS.indexOf(L) >= 0; });
  PropertiesService.getScriptProperties().setProperty('OPEN_LESSONS', list.join(','));
  return { ok: true, open: list };
}

/* ---------------- 교사용: 학생 실험 데이터 ---------------- */
function teacherGraphs_(key) {
  if (!teacherOk_(key)) return { ok: false, error: '비밀번호가 맞지 않음', badKey: true };
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('2차시 탐구');
  if (!s || s.getLastRow() < 2) return { ok: true, students: [] };
  const v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues();
  const h = v[0].map(String);
  const find = function (pre) { for (let i = h.length - 1; i >= 0; i--) if (h[i].indexOf(pre) === 0) return i; return -1; };
  const i1 = find('실험1'), i2 = find('실험2'), nicks = nickMap_();
  const out = [];
  for (let r = 1; r < v.length; r++) {
    out.push({ cls: String(v[r][1]), num: Number(v[r][2]), name: String(v[r][3]), nick: nicks[key_(v[r][1], v[r][2])] || '', time: iso_(v[r][0]),
      lux: i1 >= 0 ? String(v[r][i1]) : '', sp: i2 >= 0 ? String(v[r][i2]) : '' });
  }
  return { ok: true, students: out };
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
  // 등급 점수는 호기심 은하 활동 + 선생님 보정만 반영 (탐구 제출·형성평가는 제외)
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
/* 학생 본인의 제출 결과 (다른 기기에서 로그인해도 불러오기) */
function mine_(d) {
  const out = {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  LESSONS.forEach(function (L) {
    const s = ss.getSheetByName(sheetName_(L));
    if (!s || s.getLastRow() < 2) return;
    const v = s.getRange(1, 1, s.getLastRow(), s.getLastColumn()).getValues();
    const h = v[0].map(String);
    for (let i = 1; i < v.length; i++) {
      if (String(v[i][1]).replace(/^'/, '') === d.cls && Number(v[i][2]) === Number(d.num)) {
        const o = {};
        for (let j = 5; j < h.length; j++) {
          let x = v[i][j];
          if (x === '' || x === null) continue;
          x = String(x).replace(/^'/, '');
          if (x) o[h[j]] = x;
        }
        out[L] = o;
        break;
      }
    }
  });
  return { ok: true, data: out };
}

function submit_(d) {
  const L = String(d.lesson);
  if (LESSONS.indexOf(L) < 0) return { ok: false, error: '차시 오류' };
  const s = sheet_(sheetName_(L), ['최종 제출', '반', '번호', '이름', '제출 횟수']);
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
  const tag = tagOf_(d.tag);
  if (LESSONS.indexOf(L) < 0 || !text) return { ok: false, error: '내용 확인' };
  const s = sheet_('질문', Q_HEAD);
  ensureHead_(s, Q_HEAD);
  s.appendRow([safe_(newId_()), new Date(), L, safe_(d.cls), Number(d.num), safe_(clip_(d.name, 20)), safe_(text), false, safe_(tag), (tag === '궁금해요' && d.anon === true), false]);
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
      tag: tagOf_(r[8]), good: r[10] === true, text: String(r[6]),
      answers: as.filter(function (a) { return String(a[1]) === String(r[0]); })
        .map(function (a) { const aw = who(a[3], a[4], false); return { time: iso_(a[2]), who: aw.who, icon: aw.icon, good: a[8] === true, text: String(a[6]) }; })
        .sort(function (x, y) { return x.time < y.time ? -1 : 1; })
    };
  }).sort(function (x, y) { return x.time < y.time ? 1 : -1; });
  return { ok: true, questions: out };
}

/* ---------------- 패널티 (기간 동안 로그인 막기) ----------------
 * '패널티' 시트에 한 줄 = 한 명
 *   반 · 번호(비워도 됨) · 이름 · 시작일 · 종료일 · 사유 · 상태(자동)
 *   → 시작일~종료일(종료일 포함) 동안 로그인·제출·게시 모두 막힘, 종료일 다음 날 자동으로 풀림
 *   → 일찍 풀어 주려면 그 줄을 지우거나 종료일을 어제 날짜로 바꾸기
 */
const P_HEAD = ['반', '번호', '이름', '시작일', '종료일', '사유', '상태'];
const P_SEED = [
  ['2-1', '', '백송이', '2026-11-24', '2026-11-30', '수업 시간에 태블릿으로 다른 활동'],
  ['2-1', '', '박규배', '2026-11-24', '2026-11-30', '수업 시간에 태블릿으로 다른 활동']
];
function penaltySheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let s = ss.getSheetByName('패널티');
  const props = PropertiesService.getScriptProperties();
  if (!s) s = sheet_('패널티', P_HEAD);
  if (props.getProperty('PENALTY_SEED_1') !== 'done') {
    P_SEED.forEach(function (p) {
      s.appendRow([safe_(p[0]), p[1], safe_(p[2]), dateOf_(p[3]), dateOf_(p[4]), safe_(p[5]), '']);
    });
    props.setProperty('PENALTY_SEED_1', 'done');
    penaltyFormat_(s);
    markRosterPenalties_();
  }
  return s;
}
function penaltyFormat_(s) {
  const last = s.getLastRow();
  if (last < 2) return;
  s.getRange(2, 4, last - 1, 2).setNumberFormat('yyyy-mm-dd');
  const f = [];
  for (let r = 2; r <= last; r++) f.push(['=IF(OR(D' + r + '="",E' + r + '=""),"",IF(TODAY()<D' + r + ',"예정",IF(TODAY()<=E' + r + ',"🚫 패널티 중","종료")))']);
  s.getRange(2, 7, last - 1, 1).setFormulas(f);
}
function dateOf_(v) {
  const m = String(v).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : '';
}
function ymd_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone() || 'Asia/Seoul', 'yyyy-MM-dd');
  const m = String(v || '').match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function mdKo_(ymd) { const p = ymd.split('-'); return Number(p[1]) + '월 ' + Number(p[2]) + '일'; }
// 시트 하나에서 이 학생의 패널티 줄 모두 찾기
function penaltyRows_(s, d) {
  const out = [];
  if (!s || s.getLastRow() < 2) return out;
  s.getRange(2, 1, s.getLastRow() - 1, 6).getValues().forEach(function (r) {
    const cls = String(r[0]).replace(/^'/, '').trim(), num = String(r[1]).trim(), name = String(r[2]).replace(/^'/, '').trim();
    if (cls !== d.cls || (!num && !name)) return;
    if (num && Number(num) !== Number(d.num)) return;
    if (name && name !== String(d.name).trim()) return;
    const a = ymd_(r[3]), b = ymd_(r[4]);
    if (a && b) out.push({ start: a, end: b, reason: String(r[5]).replace(/^'/, '').trim() });
  });
  return out;
}
function todayKst_() { return Utilities.formatDate(new Date(), 'Asia/Seoul', 'yyyy-MM-dd'); }
// 지금 패널티 중인지
function penaltyIn_(s, d) {
  const today = todayKst_();
  const hit = penaltyRows_(s, d).filter(function (p) { return p.start <= today && today <= p.end; });
  return hit.length ? hit[0] : null;
}
// 이미 받은 패널티 기록 (학생 화면에 계속 표시 → 앞으로 조심하도록)
function penaltyHistory_(d) {
  const today = todayKst_(), seen = {}, out = [];
  PEN_SHEETS_().forEach(function (s) {
    penaltyRows_(s, d).forEach(function (p) {
      const k = p.start + '|' + p.end;
      if (p.start > today || seen[k]) return;
      seen[k] = 1; out.push(p);
    });
  });
  return out.sort(function (x, y) { return x.start < y.start ? -1 : 1; });
}
function penaltyMsg_(p) {
  const n = new Date(Number(p.end.slice(0, 4)), Number(p.end.slice(5, 7)) - 1, Number(p.end.slice(8, 10)) + 1);
  return '🚫 패널티 기간 (' + mdKo_(p.start) + ' ~ ' + mdKo_(p.end) + ')' + (p.reason ? ' · 사유: ' + p.reason : '') +
    '\n이 기간에는 로그인할 수 없음. ' + (n.getMonth() + 1) + '월 ' + n.getDate() + '일부터 다시 들어올 수 있음';
}
// 학생 명부 '패널티' 칸(10열)에 기간 표시
function markRosterPenalties_() {
  const ps = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('패널티');
  const rs = sheet_('학생 명부', R_HEAD);
  if (!ps || rs.getLastRow() < 2) { rs.getRange(1, 10).setValue('패널티').setFontWeight('bold').setBackground(HEAD_BG); return; }
  rs.getRange(1, 10).setValue('패널티').setFontWeight('bold').setBackground(HEAD_BG);
  const plist = ps.getLastRow() < 2 ? [] : ps.getRange(2, 1, ps.getLastRow() - 1, 6).getValues();
  const rows = rs.getRange(2, 1, rs.getLastRow() - 1, 3).getValues();
  const out = rows.map(function (r) {
    const cls = String(r[0]).replace(/^'/, ''), num = Number(r[1]), name = String(r[2]).replace(/^'/, '').trim();
    const hit = [];
    plist.forEach(function (p) {
      const pc = String(p[0]).replace(/^'/, '').trim(), pn = String(p[1]).trim(), pm = String(p[2]).replace(/^'/, '').trim();
      if (pc !== cls || (!pn && !pm) || (pn && Number(pn) !== num) || (pm && pm !== name)) return;
      const a = ymd_(p[3]), b = ymd_(p[4]);
      if (a && b) hit.push('패널티 ' + a + ' ~ ' + b);
    });
    return [hit.join(' / ')];
  });
  rs.getRange(2, 10, out.length, 1).setValues(out);
}
function PEN_SHEETS_() { return [SpreadsheetApp.getActiveSpreadsheet().getSheetByName('패널티')]; }
function refreshPenalties() { const s = penaltySheet_(); penaltyFormat_(s); markRosterPenalties_(); }

/* ---------------- 👀 이탈 감지 (수업 중 다른 앱·탭으로 나간 학생 기록) ----------------
 * 교사 화면 [👀 이탈 감지](watch.html)에서 반·시간을 정해 켜면 그 시간 동안만 기록함
 *   - 학생 화면 위쪽에 "수업 중 이탈 기록 중" 안내가 보임
 *   - '이탈 기록' 시트: 나간 시각 · 반 · 번호 · 이름 · 돌아온 시각 · 이탈 시간(초) · 보던 화면
 *   - 무엇을 했는지는 알 수 없고, 이 화면을 벗어났다는 것(다른 앱·탭·홈 화면·화면 꺼짐)만 기록됨
 */
const AW_HEAD = ['나간 시각', '반', '번호', '이름', '돌아온 시각', '이탈 시간(초)', '보던 화면', 'ID'];
function teacherHash_(key) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'starlab-teacher|' + key, Utilities.Charset.UTF_8)
    .map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}
function trackState_() {
  let t = null;
  try { t = JSON.parse(PropertiesService.getScriptProperties().getProperty('TRACK') || 'null'); } catch (e) { t = null; }
  if (!t || !t.on || Date.now() > Number(t.until)) return { on: false };
  return t;
}
function trackFor_(cls) { const t = trackState_(); return t.on && (t.cls === 'all' || t.cls === cls) ? t : null; }
function setTrack_(key, on, cls, min) {
  if (!awTeacherOk_(key)) return { ok: false, error: '비밀번호가 맞지 않음', badKey: true };
  const props = PropertiesService.getScriptProperties();
  if (on !== '1') { props.setProperty('TRACK', JSON.stringify({ on: false })); return { ok: true, track: { on: false } }; }
  if (cls !== 'all' && CLASSES.indexOf(cls) < 0) return { ok: false, error: '반 확인' };
  const m = Math.max(5, Math.min(180, Number(min) || 50));
  const t = { on: true, cls: cls, since: Date.now(), until: Date.now() + m * 60000 };
  props.setProperty('TRACK', JSON.stringify(t));
  return { ok: true, track: t };
}
function awCache_() { return CacheService.getScriptCache(); }
function awKey_(cls, num) { return 'aw|' + cls + '#' + Number(num); }
function awGet_(cls, num) { try { return JSON.parse(awCache_().get(awKey_(cls, num)) || 'null'); } catch (e) { return null; } }
function awPut_(cls, num, o) { awCache_().put(awKey_(cls, num), JSON.stringify(o), 21600); }
// 학생 화면에서 오는 신호: ping(보는 중) · leave(나감) · back(돌아옴)
function trackEvent_(d) {
  const t = trackFor_(d.cls);
  if (!t) return { ok: true, track: { on: false } };
  const now = Date.now(), name = clip_(d.name, 20).trim(), view = clip_(d.view, 30);
  const st = awGet_(d.cls, d.num) || {};
  st.name = name; st.seen = now; st.view = view;
  if (d.action === 'leave') {
    st.away = now; st.id = clip_(d.id, 20);
    awPut_(d.cls, d.num, st);
    awWrite_(function (s) { s.appendRow([new Date(st.away), safe_(d.cls), Number(d.num), safe_(name), '', '', safe_(view), safe_(st.id)]); });
  } else if (d.action === 'back') {
    const id = clip_(d.id, 20), sec = Math.max(0, Math.min(6 * 3600, Math.round(Number(d.sec) || 0))), at = now - sec * 1000;
    st.away = 0; st.lastAway = sec; awPut_(d.cls, d.num, st);
    awWrite_(function (s) {
      const last = s.getLastRow(), from = Math.max(2, last - 300);
      if (last >= 2) {
        const ids = s.getRange(from, 8, last - from + 1, 1).getValues();
        for (let i = ids.length - 1; i >= 0; i--) if (String(ids[i][0]).replace(/^'/, '') === id) { s.getRange(from + i, 5, 1, 2).setValues([[new Date(now), sec]]); return; }
      }
      s.appendRow([new Date(at), safe_(d.cls), Number(d.num), safe_(name), new Date(now), sec, safe_(view), safe_(id)]); // 나간 신호를 놓친 경우
    });
  } else {
    if (st.away && d.visible === true) st.away = 0;
    awPut_(d.cls, d.num, st);
  }
  return { ok: true, track: { on: true, cls: t.cls, until: t.until } };
}
function awWrite_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const s = sheet_('이탈 기록', AW_HEAD);
    fn(s);
  } finally { lock.releaseLock(); }
}
// 교사용: 한 반 학생들의 지금 상태 + 이번 감지 시간 동안의 이탈 횟수·시간
function awayList_(key, cls) {
  if (!awTeacherOk_(key)) return { ok: false, error: '비밀번호가 맞지 않음', badKey: true };
  if (CLASSES.indexOf(cls) < 0) return { ok: false, error: '반 확인' };
  const t = trackState_(), now = Date.now();
  const since = t.on ? Number(t.since) : now - 60 * 60000;
  const people = {};
  const rs = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('학생 명부');
  if (rs && rs.getLastRow() >= 2) rs.getRange(2, 1, rs.getLastRow() - 1, 3).getValues().forEach(function (r) {
    if (String(r[0]).replace(/^'/, '') === cls) people[Number(r[1])] = { num: Number(r[1]), name: String(r[2]).replace(/^'/, ''), count: 0, total: 0 };
  });
  const s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('이탈 기록');
  if (s && s.getLastRow() >= 2) {
    const last = s.getLastRow(), from = Math.max(2, last - 1500);
    s.getRange(from, 1, last - from + 1, 6).getValues().forEach(function (r) {
      const at = new Date(r[0]).getTime();
      if (!(at >= since) || String(r[1]).replace(/^'/, '') !== cls) return;
      const n = Number(r[2]);
      const p = people[n] || (people[n] = { num: n, name: String(r[3]).replace(/^'/, ''), count: 0, total: 0 });
      const sec = r[5] === '' ? Math.round((now - at) / 1000) : Number(r[5]);
      if (sec >= 3) { p.count++; p.total += sec; }
    });
  }
  const keys = []; for (let n = 1; n <= 40; n++) keys.push(awKey_(cls, n));
  const cached = awCache_().getAll(keys);
  const out = [];
  for (let n = 1; n <= 40; n++) {
    let st = null; try { st = JSON.parse(cached[awKey_(cls, n)] || 'null'); } catch (e) { st = null; }
    const p = people[n];
    if (!p && !st) continue;
    const o = p || { num: n, name: st.name, count: 0, total: 0 };
    if (st && st.away && now - st.away < 3 * 3600000) { o.state = 'away'; o.awaySec = Math.round((now - st.away) / 1000); }
    else if (st && now - st.seen < 100000) o.state = 'here';
    else o.state = 'off';
    o.view = st ? st.view || '' : '';
    out.push(o);
  }
  return { ok: true, track: t, now: now, students: out };
}
function awTeacherOk_(key) { return teacherOk_(key); }

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
