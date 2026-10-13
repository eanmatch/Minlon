// Minløn — calculator de salariu pentru daghold (un singur tip de tură, plată pe oră).
// Repo și proiect Cloudflare Pages separate de Vagtløn. NICIO sumă personală în cod: toate
// tarifele se introduc în Setări și rămân doar în localStorage-ul telefonului.
//
// Modelul de calcul e reconstruit dintr-un lønseddel real (perioadă de 14 zile) și îl
// reproduce la øre:
//   - „Normaltimer" pe lønseddel = ore normale + ore de overarbejde, toate × Grundtimeløn.
//     Overarbejde se plătește DOAR ca tillæg peste bază (1.-2. time / 3.-4. time).
//   - Tillæg efter 18 și Helligdagstillæg: ore × sats, peste bază (orele sunt deja în
//     normaltimer).
//   - Pensie proprie: % aplicat pe un grundlag = bruttoløn × factor (pe lønseddel
//     grundlag ÷ brut = 1,265 exact, adică brut + adaosuri tip feriepenge/SH).
//   - AM-indkomst = brut − pensie − ATP; AM-bidrag 8% și A-skat rotunjite în JOS la
//     coroane întregi, cum face lønsystemet.

const AM_RATE = 0.08;

const DEFAULT_SETTINGS = {
  base: 0,
  ot12: 0, // tillæg overarbejde 1. og 2. time (peste bază)
  ot34: 0, // tillæg overarbejde 3. og 4. time (și orele de după, în lipsa altei satse)
  efter18: 0,
  helligdag: 0,
  fradrag: 0, // fradrag pr. periodă (de pe lønseddel, la A-skat)
  traek: 0,
  pension: 0, // % egen pension
  pensionBase: 100, // grundlag pensie ca % din brut
  atp: 0, // ATP fix pr. periodă
  other: 0, // fradrag după impozit (personaleforening etc.)
};

const STORAGE = {
  settings: 'minlon_settings',
  state: 'minlon_state',
  lang: 'minlon_lang',
};

// ---------- i18n ----------
const I18N = {
  da: {
    title: 'Minløn — Lønberegner',
    brandSub: 'Daghold · beregner',
    readoutLabel: 'Netto denne periode',
    netSubEmpty: 'Udfyld timer for at beregne',
    netSubFilled: '{n} timer i alt',
    reminderSetup: 'Udfyld grundtimeløn og satser under Indstillinger (aflæs dem på lønsedlen) for at få et beløb.',
    reminderTax: 'Netto er kun et estimat: udfyld fradrag og trækprocent under Indstillinger for et retvisende tal.',
    btnGoSettings: 'Gå til indstillinger',
    cardHours: 'Timer i perioden',
    lblNormal: 'Normaltimer', hintNormal: '(uden overarbejde)',
    lblEfter18: 'Timer efter kl. 18', hintEfter18: '(får tillæg efter 18)',
    lblHelligdag: 'Helligdagstimer', hintHelligdag: '(får helligdagstillæg)',
    cardOvertime: 'Overarbejde',
    overtimeNote: 'Én linje pr. dag. De første 2 timer får 1.-2. times sats, resten 3.-4. times sats.',
    btnAddOvertime: '+ Tilføj dag med overarbejde',
    lblOtDay: 'Timer overarbejde',
    otSplit: '1.-2. time: {a} t · 3.-4. time: {b} t',
    ariaRemoveRow: 'Fjern',
    cardExtra: 'Ekstra udbetalinger',
    lblFeriepenge: 'Feriepenge udbetalt',
    lblFritvalg: 'Fritvalgskonto/helligdage udbetalt',
    btnCalc: 'Beregn løn',
    cardSpec: 'Specifikation',
    rowNormal: 'Normaltimer',
    rowOt12: 'Overarbejde 1. og 2. time',
    rowOt34: 'Overarbejde 3. og 4. time',
    rowEfter18: 'Tillæg efter 18',
    rowHelligdag: 'Helligdagstillæg',
    rowExtra: 'Ekstra udbetalinger',
    rowGross: 'Bruttoløn',
    rowAtp: 'ATP',
    rowPension: 'Egen pension',
    rowAmIndkomst: 'AM-indkomst',
    rowAm: 'AM-bidrag (8%)',
    rowAskat: 'A-skat',
    rowOther: 'Andre fradrag',
    rowNet: 'Til udbetaling',
    disclaimer: 'Estimat. Erstatter ikke den officielle lønseddel.',
    cardRates: 'Satser',
    ratesNote: 'Aflæs satserne i kolonnen „Sats" på din lønseddel. Gemmes kun på denne telefon.',
    lblBase: 'Grundtimeløn',
    lblOt12: 'Overarbejde 1. og 2. time',
    lblOt34: 'Overarbejde 3. og 4. time',
    lblEfter18Rate: 'Tillæg efter 18',
    lblHelligdagRate: 'Helligdagstillæg',
    cardTax: 'Skattekort',
    lblFradrag: 'Fradrag pr. periode', hintFradrag: '(står ved A-skat på lønsedlen)',
    lblTraek: 'Trækprocent %',
    cardPension: 'Pension, ATP & fradrag',
    lblPension: 'Egen pension %',
    lblPensionBase: 'Pensionsgrundlag % af bruttoløn',
    hintPensionBase: '(grundlag ÷ bruttoløn på lønsedlen, typisk 126,5)',
    lblAtp: 'ATP pr. periode', hintAtp: '(„ATP af løn" på lønsedlen)',
    lblOther: 'Andre fradrag', hintOther: '(f.eks. personaleforening, efter skat)',
    btnSave: 'Gem indstillinger',
    saveMsg: 'Gemt ✓',
    cardPrivacy: 'Privatliv',
    privacyText: 'Alt, hvad du skriver, gemmes kun i denne browser på din telefon (localStorage). Intet sendes til en server, og der bruges ingen cookies eller statistik.',
    tabCalc: 'Beregn',
    tabSettings: 'Indstillinger',
  },
  en: {
    title: 'Minløn — Pay calculator',
    brandSub: 'Day shift · calculator',
    readoutLabel: 'Net this period',
    netSubEmpty: 'Fill in hours to calculate',
    netSubFilled: '{n} hours total',
    reminderSetup: 'Fill in your base hourly wage and rates under Settings (read them off your payslip) to get an amount.',
    reminderTax: 'Net is only an estimate: fill in your tax deduction and withholding rate under Settings for an accurate figure.',
    btnGoSettings: 'Go to settings',
    cardHours: 'Hours this period',
    lblNormal: 'Normal hours', hintNormal: '(excluding overtime)',
    lblEfter18: 'Hours after 18:00', hintEfter18: '(get the after-18 supplement)',
    lblHelligdag: 'Public holiday hours', hintHelligdag: '(get the holiday supplement)',
    cardOvertime: 'Overtime',
    overtimeNote: 'One line per day. The first 2 hours get the 1st-2nd hour rate, the rest the 3rd-4th hour rate.',
    btnAddOvertime: '+ Add a day with overtime',
    lblOtDay: 'Overtime hours',
    otSplit: '1st-2nd hour: {a} h · 3rd-4th hour: {b} h',
    ariaRemoveRow: 'Remove',
    cardExtra: 'Extra payouts',
    lblFeriepenge: 'Holiday pay paid out',
    lblFritvalg: 'Free-choice account/holidays paid out',
    btnCalc: 'Calculate pay',
    cardSpec: 'Breakdown',
    rowNormal: 'Normal hours',
    rowOt12: 'Overtime 1st and 2nd hour',
    rowOt34: 'Overtime 3rd and 4th hour',
    rowEfter18: 'After-18 supplement',
    rowHelligdag: 'Public holiday supplement',
    rowExtra: 'Extra payouts',
    rowGross: 'Gross pay',
    rowAtp: 'ATP',
    rowPension: 'Own pension',
    rowAmIndkomst: 'AM income',
    rowAm: 'Labour market contribution (8%)',
    rowAskat: 'Income tax (A-skat)',
    rowOther: 'Other deductions',
    rowNet: 'Paid out',
    disclaimer: 'Estimate. Does not replace the official payslip.',
    cardRates: 'Rates',
    ratesNote: 'Read the rates from the "Sats" column on your payslip. Stored only on this phone.',
    lblBase: 'Base hourly wage',
    lblOt12: 'Overtime 1st and 2nd hour',
    lblOt34: 'Overtime 3rd and 4th hour',
    lblEfter18Rate: 'After-18 supplement',
    lblHelligdagRate: 'Public holiday supplement',
    cardTax: 'Tax card',
    lblFradrag: 'Deduction per period', hintFradrag: '(shown next to A-skat on the payslip)',
    lblTraek: 'Withholding rate %',
    cardPension: 'Pension, ATP & deductions',
    lblPension: 'Own pension %',
    lblPensionBase: 'Pension base % of gross pay',
    hintPensionBase: '(base ÷ gross pay on the payslip, typically 126.5)',
    lblAtp: 'ATP per period', hintAtp: '("ATP af løn" on the payslip)',
    lblOther: 'Other deductions', hintOther: '(e.g. staff association, after tax)',
    btnSave: 'Save settings',
    saveMsg: 'Saved ✓',
    cardPrivacy: 'Privacy',
    privacyText: 'Everything you type is stored only in this browser on your phone (localStorage). Nothing is sent to a server, and no cookies or analytics are used.',
    tabCalc: 'Calculate',
    tabSettings: 'Settings',
  },
  ro: {
    title: 'Minløn — Calculator salariu',
    brandSub: 'Tură de zi · calculator',
    readoutLabel: 'Net în această perioadă',
    netSubEmpty: 'Completează orele pentru calcul',
    netSubFilled: '{n} ore în total',
    reminderSetup: 'Completează salariul de bază pe oră și sporurile în Setări (le găsești pe fluturaș) ca să obții o sumă.',
    reminderTax: 'Netul e doar o estimare: completează deducerea și procentul de impozit în Setări pentru o cifră corectă.',
    btnGoSettings: 'Mergi la setări',
    cardHours: 'Ore în perioadă',
    lblNormal: 'Ore normale', hintNormal: '(fără ore suplimentare)',
    lblEfter18: 'Ore după 18:00', hintEfter18: '(primesc sporul după 18)',
    lblHelligdag: 'Ore de sărbătoare', hintHelligdag: '(primesc sporul de sărbătoare)',
    cardOvertime: 'Ore suplimentare',
    overtimeNote: 'Un rând pe zi. Primele 2 ore primesc tariful pt. ora 1-2, restul tariful pt. ora 3-4.',
    btnAddOvertime: '+ Adaugă o zi cu ore suplimentare',
    lblOtDay: 'Ore suplimentare',
    otSplit: 'ora 1-2: {a} h · ora 3-4: {b} h',
    ariaRemoveRow: 'Șterge',
    cardExtra: 'Plăți extra',
    lblFeriepenge: 'Bani de concediu (feriepenge) plătiți',
    lblFritvalg: 'Cont fritvalg/zile libere plătite',
    btnCalc: 'Calculează salariul',
    cardSpec: 'Detaliere',
    rowNormal: 'Ore normale',
    rowOt12: 'Ore suplimentare, ora 1 și 2',
    rowOt34: 'Ore suplimentare, ora 3 și 4',
    rowEfter18: 'Spor după 18',
    rowHelligdag: 'Spor de sărbătoare',
    rowExtra: 'Plăți extra',
    rowGross: 'Salariu brut',
    rowAtp: 'ATP',
    rowPension: 'Pensie proprie',
    rowAmIndkomst: 'Venit AM',
    rowAm: 'Contribuție AM (8%)',
    rowAskat: 'Impozit (A-skat)',
    rowOther: 'Alte deduceri',
    rowNet: 'De plată',
    disclaimer: 'Estimare. Nu înlocuiește fluturașul oficial.',
    cardRates: 'Tarife',
    ratesNote: 'Citește tarifele din coloana „Sats" de pe fluturaș. Se salvează doar pe acest telefon.',
    lblBase: 'Salariu de bază pe oră',
    lblOt12: 'Ore suplimentare, ora 1 și 2',
    lblOt34: 'Ore suplimentare, ora 3 și 4',
    lblEfter18Rate: 'Spor după 18',
    lblHelligdagRate: 'Spor de sărbătoare',
    cardTax: 'Card fiscal',
    lblFradrag: 'Deducere pe perioadă', hintFradrag: '(scrisă la A-skat pe fluturaș)',
    lblTraek: 'Procent impozit %',
    cardPension: 'Pensie, ATP și deduceri',
    lblPension: 'Pensie proprie %',
    lblPensionBase: 'Bază pensie % din brut',
    hintPensionBase: '(grundlag ÷ brut pe fluturaș, de obicei 126,5)',
    lblAtp: 'ATP pe perioadă', hintAtp: '(„ATP af løn" pe fluturaș)',
    lblOther: 'Alte deduceri', hintOther: '(ex. personaleforening, după impozit)',
    btnSave: 'Salvează setările',
    saveMsg: 'Salvat ✓',
    cardPrivacy: 'Confidențialitate',
    privacyText: 'Tot ce scrii se salvează doar în acest browser, pe telefonul tău (localStorage). Nimic nu e trimis la vreun server și nu se folosesc cookies sau statistici.',
    tabCalc: 'Calcul',
    tabSettings: 'Setări',
  },
};

// ---------- Storage (try/catch: modul privat / stocare blocată nu trebuie să strice aplicația) ----------
function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* ignorăm */ }
}

function loadLang() {
  try {
    const l = localStorage.getItem(STORAGE.lang);
    return I18N[l] ? l : 'da';
  } catch (e) {
    return 'da';
  }
}

function saveLang(l) {
  try { localStorage.setItem(STORAGE.lang, l); } catch (e) { /* ignorăm */ }
}

// ---------- Numere ----------
// Câmpuri type="text" inputmode="decimal" (nu type="number"): tastatura daneză/română
// de pe iOS dă virgulă, pe care type="number" o refuză — aceeași lecție ca în Vagtløn.
function parseNum(raw) {
  const n = parseFloat(String(raw == null ? '' : raw).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function numVal(id) {
  return parseNum(document.getElementById(id).value);
}

function sanitizeDecimal(el) {
  const before = el.value;
  let v = before.replace(/[^0-9.,]/g, '');
  const sep = v.search(/[.,]/);
  if (sep !== -1) v = v.slice(0, sep + 1) + v.slice(sep + 1).replace(/[.,]/g, '');
  if (v === before) return;
  const pos = Math.max(0, (el.selectionStart || v.length) - (before.length - v.length));
  el.value = v;
  try { el.setSelectionRange(pos, pos); } catch (e) { /* ignorăm */ }
}

document.addEventListener('input', (e) => {
  const el = e.target;
  if (el && el.matches && el.matches('input[inputmode="decimal"]')) sanitizeDecimal(el);
}, true);

const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) =>
  (isFinite(n) ? n : 0).toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' kr';
const fmtHours = (n) => n.toLocaleString('da-DK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtField = (n) => String(n).replace('.', ',');

// ---------- Calcul ----------
// O zi de overarbejde: primele 2 ore la sats 1.-2. time, restul la 3.-4. time (inclusiv
// eventualele ore peste a 4-a — nu avem o sats separată pentru ele).
function splitOvertime(hours) {
  const first = Math.min(hours, 2);
  return { first, rest: Math.max(0, hours - first) };
}

function calculatePay(input, s) {
  let ot12h = 0;
  let ot34h = 0;
  for (const h of input.overtimeDays) {
    const sp = splitOvertime(h);
    ot12h += sp.first;
    ot34h += sp.rest;
  }

  const baseHours = input.normal + ot12h + ot34h;
  const normalPay = round2(baseHours * s.base);
  const ot12Pay = round2(ot12h * s.ot12);
  const ot34Pay = round2(ot34h * s.ot34);
  const efter18Pay = round2(input.efter18 * s.efter18);
  const helligdagPay = round2(input.helligdag * s.helligdag);
  const extra = input.feriepenge + input.fritvalg;

  const earned = normalPay + ot12Pay + ot34Pay + efter18Pay + helligdagPay;
  const gross = earned + extra;

  // Feriepenge/fritvalg plătite nu intră în baza de pensie (sunt deja adaosuri).
  const pension = round2(earned * (s.pensionBase / 100) * (s.pension / 100));
  const atp = baseHours > 0 ? s.atp : 0;
  const amIndkomst = Math.max(0, gross - pension - atp);
  const am = Math.floor(amIndkomst * AM_RATE);
  const skattepligtig = Math.max(0, amIndkomst - am - s.fradrag);
  const askat = Math.floor(skattepligtig * (s.traek / 100));
  const other = s.other;
  const net = amIndkomst - am - askat - other;

  return {
    baseHours, ot12h, ot34h,
    normalPay, ot12Pay, ot34Pay, efter18Pay, helligdagPay, extra,
    gross, pension, atp, amIndkomst, am, askat, other, net,
  };
}

// ---------- UI ----------
let settings = { ...DEFAULT_SETTINGS, ...(readJson(STORAGE.settings) || {}) };
let lang = loadLang();

const SETTINGS_FIELDS = [
  ['sBase', 'base'], ['sOt12', 'ot12'], ['sOt34', 'ot34'],
  ['sEfter18', 'efter18'], ['sHelligdag', 'helligdag'],
  ['sFradrag', 'fradrag'], ['sTraek', 'traek'],
  ['sPension', 'pension'], ['sPensionBase', 'pensionBase'],
  ['sAtp', 'atp'], ['sOther', 'other'],
];

function populateSettingsForm() {
  SETTINGS_FIELDS.forEach(([id, key]) => {
    document.getElementById(id).value = fmtField(settings[key]);
  });
}

function readSettingsForm() {
  const out = {};
  SETTINGS_FIELDS.forEach(([id, key]) => { out[key] = numVal(id); });
  return out;
}

let rowIdSeq = 0;

function updateOtSplit(row) {
  const sp = splitOvertime(parseNum(row.querySelector('.otHours').value));
  row.querySelector('.ot-split').textContent = I18N[lang].otSplit
    .replace('{a}', fmtHours(sp.first)).replace('{b}', fmtHours(sp.rest));
}

function createOtRow(hours) {
  const row = document.createElement('div');
  row.className = 'ot-row';
  const dict = I18N[lang];
  const uid = `ot${rowIdSeq++}`;
  row.innerHTML = `
    <div class="field-row">
      <label class="otLabel" for="${uid}">${dict.lblOtDay}</label>
      <input type="text" class="otHours" id="${uid}" inputmode="decimal" autocomplete="off" placeholder="0">
      <button type="button" class="remove-row-btn" aria-label="${dict.ariaRemoveRow}">✕</button>
    </div>
    <div class="ot-split"></div>
  `;
  const input = row.querySelector('.otHours');
  input.value = hours || '';
  input.addEventListener('input', () => updateOtSplit(row));
  row.querySelector('.remove-row-btn').addEventListener('click', () => {
    row.remove();
    saveState();
  });
  updateOtSplit(row);
  return row;
}

function otRows() {
  return Array.from(document.querySelectorAll('#otList .ot-row'));
}

function readInputs() {
  return {
    normal: numVal('hNormal'),
    efter18: numVal('hEfter18'),
    helligdag: numVal('hHelligdag'),
    overtimeDays: otRows().map((row) => parseNum(row.querySelector('.otHours').value)),
    feriepenge: numVal('feriepenge'),
    fritvalg: numVal('fritvalg'),
  };
}

const STATE_FIELDS = ['hNormal', 'hEfter18', 'hHelligdag', 'feriepenge', 'fritvalg'];

function saveState() {
  const state = { overtime: otRows().map((row) => row.querySelector('.otHours').value) };
  STATE_FIELDS.forEach((id) => { state[id] = document.getElementById(id).value; });
  writeJson(STORAGE.state, state);
}

function restoreState(state) {
  STATE_FIELDS.forEach((id) => { document.getElementById(id).value = state[id] || ''; });
  (state.overtime || []).forEach((h) => document.getElementById('otList').appendChild(createOtRow(h)));
}

function setRow(rowId, valueId, value) {
  document.getElementById(valueId).textContent = fmt(value);
  document.getElementById(rowId).style.display = value > 0 ? 'flex' : 'none';
}

function runCalculation() {
  saveState();
  const r = calculatePay(readInputs(), settings);
  const dict = I18N[lang];

  document.getElementById('netOut').textContent = fmt(r.net);
  const netSub = document.getElementById('netSub');
  netSub.textContent = r.baseHours > 0
    ? dict.netSubFilled.replace('{n}', fmtHours(r.baseHours))
    : dict.netSubEmpty;

  document.getElementById('bNormal').textContent = fmt(r.normalPay);
  setRow('rowOt12', 'bOt12', r.ot12Pay);
  setRow('rowOt34', 'bOt34', r.ot34Pay);
  setRow('rowEfter18', 'bEfter18', r.efter18Pay);
  setRow('rowHelligdag', 'bHelligdag', r.helligdagPay);
  setRow('rowExtra', 'bExtra', r.extra);
  document.getElementById('bGross').textContent = fmt(r.gross);
  document.getElementById('bAtp').textContent = '-' + fmt(r.atp);
  document.getElementById('bPension').textContent = '-' + fmt(r.pension);
  document.getElementById('bAmIndkomst').textContent = fmt(r.amIndkomst);
  document.getElementById('bAm').textContent = '-' + fmt(r.am);
  document.getElementById('bAskat').textContent = '-' + fmt(r.askat);
  document.getElementById('bOther').textContent = '-' + fmt(r.other);
  document.getElementById('rowOther').style.display = r.other > 0 ? 'flex' : 'none';
  document.getElementById('bNet').textContent = fmt(r.net);

  document.getElementById('breakdown').hidden = false;
  updateReminder();
}

// Reminder ne-blocant: fără grundtimeløn calculul e 0; fără card fiscal netul e prea mare.
function updateReminder() {
  const box = document.getElementById('setupReminder');
  const resultVisible = !document.getElementById('breakdown').hidden;
  let key = null;
  if (!(settings.base > 0)) key = 'reminderSetup';
  else if (!(settings.fradrag > 0) || !(settings.traek > 0)) key = 'reminderTax';
  box.hidden = !(resultVisible && key);
  if (key) box.dataset.msg = key;
  document.getElementById('setupReminderText').textContent = key ? I18N[lang][key] : '';
}

function applyI18n(l) {
  const dict = I18N[l];
  document.documentElement.lang = l;
  document.title = dict.title;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = dict[el.dataset.i18n];
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === l);
  });
  otRows().forEach((row) => {
    row.querySelector('.otLabel').textContent = dict.lblOtDay;
    row.querySelector('.remove-row-btn').setAttribute('aria-label', dict.ariaRemoveRow);
    updateOtSplit(row);
  });
  if (!document.getElementById('breakdown').hidden) runCalculation();
}

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.view).classList.add('active');
    if (tab.dataset.view === 'view-calc') updateReminder();
  });
});

document.getElementById('calcBtn').addEventListener('click', runCalculation);

document.getElementById('goSettingsBtn').addEventListener('click', () => {
  document.querySelector('.tab[data-view="view-settings"]').click();
  const field = document.getElementById(
    document.getElementById('setupReminder').dataset.msg === 'reminderSetup' ? 'sBase' : 'sFradrag'
  );
  field.scrollIntoView({ behavior: 'smooth', block: 'center' });
  field.focus();
});

document.getElementById('saveBtn').addEventListener('click', () => {
  settings = readSettingsForm();
  writeJson(STORAGE.settings, settings);
  const msg = document.getElementById('saveMsg');
  msg.textContent = I18N[lang].saveMsg;
  setTimeout(() => (msg.textContent = ''), 2000);
  if (!document.getElementById('breakdown').hidden) runCalculation();
});

document.getElementById('addOtBtn').addEventListener('click', () => {
  const row = createOtRow();
  document.getElementById('otList').appendChild(row);
  row.querySelector('.otHours').focus();
  saveState();
});

document.querySelectorAll('.lang-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    lang = btn.dataset.lang;
    saveLang(lang);
    applyI18n(lang);
  });
});

const viewCalc = document.getElementById('view-calc');
viewCalc.addEventListener('input', saveState);
viewCalc.addEventListener('change', saveState);

const cachedState = readJson(STORAGE.state);
if (cachedState) restoreState(cachedState);

populateSettingsForm();
applyI18n(lang);
if (cachedState) runCalculation();

// Service worker: offline + update automat (reload la controllerchange), ca în Vagtløn.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });

  // Doar dacă pagina era deja controlată de un SW vechi: la prima vizită clients.claim()
  // declanșează și el controllerchange, iar un reload atunci ar șterge ce s-a tastat deja.
  const hadController = !!navigator.serviceWorker.controller;
  let reloadedAfterUpdate = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloadedAfterUpdate) return;
    reloadedAfterUpdate = true;
    window.location.reload();
  });
}
