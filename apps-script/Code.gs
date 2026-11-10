/**
 * 별 탐구실 — 구글 시트 연동 코드 (Google Apps Script)
 *
 * 사용법
 * 1. 새 구글 시트 만들기 → [확장 프로그램] → [Apps Script]
 * 2. 기본 코드를 모두 지우고 이 파일 내용을 붙여 넣은 뒤 저장
 * 3. [배포] → [새 배포] → 유형: 웹 앱
 *      - 다음 사용자 인증 정보로 실행: 나
 *      - 액세스 권한이 있는 사용자: 모든 사용자
 * 4. 나오는 "웹 앱 URL"을 index.html 맨 아래쪽 API_URL 에 붙여 넣기
 *
 * 시트는 처음 사용할 때 자동으로 만들어짐
 *   - 1차시 탐구 / 2차시 탐구 / 3차시 탐구 : 학생별 탐구 결과 (반·번호 순 자동 정렬, 다시 제출하면 같은 줄이 최신 내용으로 바뀜)
 *   - 시트 상단 메뉴 [⭐ 별 탐구실] → [탐구 결과 반·번호 순으로 정렬]로 언제든 다시 정렬 가능
 *   - 질문 / 답변 : 질문 게시판 (부적절한 글은 '숨김' 칸 체크 → 게시판에서 사라짐)
 *   - 선생님 답변 달기: '답변' 시트 맨 아래 줄에 질문 ID를 복사하고, 반 칸에 "교사"라고 쓰면 게시판에 "선생님"으로 표시됨
 */

const CLASSES = ['2-1', '2-2', '2-3', '2-4'];
const MAXLEN = 2000;
const HEAD_BG = '#fff2cc';

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'list') return json_(listQuestions_(String(p.lesson || '1')));
  return json_({ ok: true, msg: '별 탐구실 API 작동 중' });
}

function doPost(e) {
  let d;
  try { d = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: '잘못된 요청' }); }
  if (!isValidStudent_(d)) return json_({ ok: false, error: '반·번호·이름 확인' });
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (d.action === 'submit') return json_(submit_(d));
    if (d.action === 'question') return json_(addQuestion_(d));
    if (d.action === 'answer') return json_(addAnswer_(d));
    return json_({ ok: false, error: '알 수 없는 요청' });
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- 시트 메뉴: 반·번호 순 정렬 ---------------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('⭐ 별 탐구실')
    .addItem('탐구 결과 반·번호 순으로 정렬', 'sortAllSheets')
    .addToUi();
}
function sortAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['1차시 탐구', '2차시 탐구', '3차시 탐구'].forEach(function (n) {
    const s = ss.getSheetByName(n);
    if (s) sortByClassNum_(s);
  });
}

/* ---------------- 탐구 결과 제출 ---------------- */
function submit_(d) {
  const L = String(d.lesson);
  if (['1', '2', '3'].indexOf(L) < 0) return { ok: false, error: '차시 오류' };
  const s = sheet_(L + '차시 탐구', ['최종 제출', '반', '번호', '이름', '제출 횟수']);
  const fields = (d.fields || []).slice(0, 40).map(function (f) { return [clip_(f[0], 60), clip_(f[1], MAXLEN)]; });

  // 새 항목이면 머리글(열) 추가
  let headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0].map(String);
  fields.forEach(function (f) {
    if (f[0] && headers.indexOf(f[0]) < 0) {
      headers.push(f[0]);
      s.getRange(1, headers.length).setValue(f[0]).setFontWeight('bold').setBackground(HEAD_BG);
    }
  });

  // 같은 반·번호의 기존 줄 찾기
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
  sortByClassNum_(s);
  return { ok: true };
}

function sortByClassNum_(s) {
  const last = s.getLastRow();
  if (last > 2) s.getRange(2, 1, last - 1, s.getLastColumn()).sort([{ column: 2, ascending: true }, { column: 3, ascending: true }]);
}

/* ---------------- 질문 게시판 ---------------- */
const Q_HEAD = ['ID', '작성 시각', '차시', '반', '번호', '이름', '질문', '숨김'];
const A_HEAD = ['ID', '질문 ID', '작성 시각', '반', '번호', '이름', '답변', '숨김'];

function addQuestion_(d) {
  const L = String(d.lesson);
  const text = clip_(d.text, 500).trim();
  if (['1', '2', '3'].indexOf(L) < 0 || !text) return { ok: false, error: '내용 확인' };
  const s = sheet_('질문', Q_HEAD);
  s.appendRow([safe_(newId_()), new Date(), L, safe_(d.cls), Number(d.num), safe_(clip_(d.name, 20)), safe_(text), false]);
  s.getRange(s.getLastRow(), 8).insertCheckboxes();
  return { ok: true };
}

function addAnswer_(d) {
  const text = clip_(d.text, 500).trim();
  const qid = clip_(d.qid, 20);
  if (!text || !qid) return { ok: false, error: '내용 확인' };
  const s = sheet_('답변', A_HEAD);
  s.appendRow([safe_(newId_()), safe_(qid), new Date(), safe_(d.cls), Number(d.num), safe_(clip_(d.name, 20)), safe_(text), false]);
  s.getRange(s.getLastRow(), 8).insertCheckboxes();
  return { ok: true };
}

function listQuestions_(lesson) {
  const qs = rows_(sheet_('질문', Q_HEAD)).filter(function (r) { return String(r[2]) === lesson && r[7] !== true && r[0]; });
  const as = rows_(sheet_('답변', A_HEAD)).filter(function (r) { return r[7] !== true && r[1]; });
  const out = qs.map(function (r) {
    return {
      id: String(r[0]), time: iso_(r[1]), who: who_(r[3]), text: String(r[6]),
      answers: as.filter(function (a) { return String(a[1]) === String(r[0]); })
        .map(function (a) { return { time: iso_(a[2]), who: who_(a[3]), text: String(a[6]) }; })
        .sort(function (x, y) { return x.time < y.time ? -1 : 1; })
    };
  }).sort(function (x, y) { return x.time < y.time ? 1 : -1; });
  return { ok: true, questions: out };
}

/* 게시판에는 실명 대신 반만 표시 */
function who_(cls) {
  cls = String(cls || '');
  if (cls === '교사' || cls === '선생님') return '선생님';
  return cls ? cls + '반 학생' : '학생';
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
function rows_(s) {
  const last = s.getLastRow();
  if (last < 2) return [];
  return s.getRange(2, 1, last - 1, 8).getValues();
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
