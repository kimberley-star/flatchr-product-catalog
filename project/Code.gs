// ============================================================
// Catalogue Produit Flatchr — Google Apps Script
// ============================================================

var TEMPLATE_ID = '1cfJ6niqBmTtSihNdNnKwIdweT3OZUaeCIStQ4eslFMY';

// Palette
var WHITE    = '#FFFFFF';
var DARK     = '#1C2E3E';
var BRAND    = '#2B435E';
var MUTED    = '#6B85A0';
var LIGHT    = '#AABBD4';
var LIGHT_BG = '#EEF2F7';
var SEP_C    = '#D8E2EE';
var TOTAL_BG = '#1C2E3E';
var SUCCESS  = '#1A7A4A';

// Layout constants
var SLIDE_W  = 720;
var SLIDE_H  = 405;
var COL_L    = 36;
var COL_R    = 416;
var COL_RW   = 268;
var HDR_H    = 92;   // y where content rows start

// Max content height for split decisions
// Single slide: 405 - 92 - 10(gap) - 77(min total box) = 226
var ONE_MAX    = 226;
// Slide 1 of 2: 405 - 92 - 25(continuation note) = 288
var SLIDE1_MAX = 288;

function doGet(e) {
  var fileId = null, fileUrl = null;
  try {
    if (!e.parameter || !e.parameter.data) throw new Error('Parametre data manquant.');
    var data = JSON.parse(e.parameter.data);
    var result = generatePresentation(data);
    fileId = result.id;
    fileUrl = result.url;
    return HtmlService.createHtmlOutput(
      '<html><head>' +
      '<style>body{font-family:sans-serif;background:#2b435e;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}' +
      '.box{background:#fff;border-radius:12px;padding:40px 48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.3)}' +
      'h2{color:#2b435e;margin:0 0 12px}p{color:#666;margin:0 0 20px}' +
      'a.btn{display:inline-block;background:#2b435e;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600}' +
      '</style></head><body><div class="box">' +
      '<h2>Plaquette prete !</h2><p>Cliquez pour ouvrir</p>' +
      '<a class="btn" href="' + fileUrl + '">Ouvrir la presentation</a>' +
      '</div></body></html>'
    );
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif;padding:40px">' +
      '<h2 style="color:red">Erreur: ' + err.message + '</h2>' +
      '<pre>' + (err.stack || '') + '</pre>' +
      (fileUrl ? '<p><a href="' + fileUrl + '">Ouvrir quand meme</a></p>' : '') +
      '</body></html>'
    );
  }
}

function generatePresentation(data) {
  var templateFile = DriveApp.getFileById(TEMPLATE_ID);
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');

  var copy = templateFile.makeCopy('Plaquette Flatchr - ' + dateStr);
  var fileId = copy.getId();
  var presentation = SlidesApp.openById(fileId);

  try {
    addSummarySlide(presentation, data, dateStr);
  } catch (err) {
    Logger.log('Erreur addSummarySlide: ' + err.message + '\n' + err.stack);
  }

  presentation.saveAndClose();

  try {
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
  } catch (e) {
    Logger.log('Partage impossible: ' + e.message);
  }

  return { id: fileId, url: 'https://docs.google.com/presentation/d/' + fileId + '/edit' };
}

// ── MAIN ENTRY POINT ────────────────────────────────────────

function addSummarySlide(presentation, data, dateStr) {
  var rows = buildRows(data);
  var totalH = calcH(rows);

  if (totalH <= ONE_MAX) {
    // All content fits on one slide
    var s = makeSlide(presentation, data, dateStr, null);
    var y = renderRows(s, rows, 0, rows.length, HDR_H);
    drawTotalBox(s, data, clampY(y + 10, 268, 328));
  } else {
    // Content needs two slides
    var split = findSplit(rows, SLIDE1_MAX);

    var s1 = makeSlide(presentation, data, dateStr, '1 / 2');
    var y1 = renderRows(s1, rows, 0, split, HDR_H);
    // Continuation note at bottom of slide 1
    var noteY = Math.max(y1 + 8, 375);
    tb(s1, 'Suite page 2  >', COL_L, noteY, 648, 10, 7, false, MUTED);

    var s2 = makeSlide(presentation, data, dateStr, '2 / 2');
    var y2 = renderRows(s2, rows, split, rows.length, HDR_H);
    drawTotalBox(s2, data, clampY(y2 + 10, 150, 328));
  }
}

// ── BUILD ROW DESCRIPTORS ────────────────────────────────────
// Returns an array of row objects:
// { type: 'D'|'S'|'SUB'|'SEP', label, detail, value, lc, rc }

function buildRows(data) {
  var rows = [];

  // Socle fonctionnel
  if (data.soclePrice > 0) {
    rows.push({ type: 'D', label: 'Socle fonctionnel', detail: clean(data.effectifLabel),
                value: fmtP(data.soclePrice) + ' EUR/an', lc: DARK, rc: DARK });
  }

  // Accompagnement CSM
  rows.push({ type: 'D', label: 'Accompagnement CSM', detail: 'Inclus dans le socle',
              value: 'Inclus', lc: DARK, rc: SUCCESS });

  // Packs
  if (data.packsItems && data.packsItems.length > 0) {
    for (var p = 0; p < data.packsItems.length; p++) {
      var pi = data.packsItems[p];
      if (pi.price > 0) {
        rows.push({ type: 'D', label: 'Pack ' + clean(pi.name),
                    detail: pi.detail ? clean(pi.detail) : '',
                    value: fmtP(pi.price) + ' EUR/an', lc: DARK, rc: DARK });
      }
    }
  }

  // Options recurrentes internes
  if (data.recurringInternalItems) {
    for (var i = 0; i < data.recurringInternalItems.length; i++) {
      var ri = data.recurringInternalItems[i];
      if (ri.price > 0) {
        rows.push({ type: 'D', label: clean(ri.name),
                    detail: ri.detail ? clean(ri.detail) : '',
                    value: fmtP(ri.price) + ' EUR/an', lc: DARK, rc: DARK });
      }
    }
  }

  // Options externes
  if (data.externalItems) {
    for (var j = 0; j < data.externalItems.length; j++) {
      var ei = data.externalItems[j];
      if (ei.price > 0) {
        rows.push({ type: 'S', label: clean(ei.name),
                    value: fmtP(ei.price) + ' EUR/an', lc: DARK, rc: DARK });
      }
    }
  }

  // Remise commerciale
  if (data.pctDiscount > 0) {
    var dLbl = 'Remise commerciale';
    if (data.discountType === 'percent' && data.discountValue) dLbl += ' (' + data.discountValue + ' %)';
    rows.push({ type: 'S', label: dLbl,
                value: '- ' + fmtP(data.pctDiscount) + ' EUR', lc: DARK, rc: SUCCESS });
  }

  // Reduction asso loi 1901
  if (data.assoc1901Discount > 0) {
    rows.push({ type: 'S', label: 'Reduction asso loi 1901 (-50 %)',
                value: '- ' + fmtP(data.assoc1901Discount) + ' EUR', lc: DARK, rc: SUCCESS });
  }

  // Section separator before subtotals
  rows.push({ type: 'SEP' });

  // Abonnement annuel (des la 2eme annee)
  rows.push({ type: 'SUB', label: 'Abonnement annuel  (des la 2eme annee)',
              value: fmtP(data.recurringYear2) + ' EUR/an' });

  // Remise effectif an 1
  if (data.tierYear1Saving > 0) {
    var tLbl = 'Remise effectif (-1 cran' + (data.upgradePct ? ', -' + data.upgradePct + ' %' : '') + ')  /  1ere annee';
    rows.push({ type: 'SUB', label: tLbl, value: '- ' + fmtP(data.tierYear1Saving) + ' EUR' });
  }

  // Mois offerts
  if (data.monthsCount > 0) {
    rows.push({ type: 'SUB',
                label: data.monthsCount + ' mois offert' + (data.monthsCount > 1 ? 's' : '') + '  /  contrat ' + data.extendedMonths + ' mois',
                value: 'Offert' });
  }

  // Prestations one-shot
  if (data.oneShotItems && data.oneShotItems.length > 0) {
    var hasShot = false;
    for (var k = 0; k < data.oneShotItems.length; k++) {
      if (data.oneShotItems[k].price > 0) { hasShot = true; break; }
    }
    if (hasShot) {
      rows.push({ type: 'SEP' });
      for (var m = 0; m < data.oneShotItems.length; m++) {
        var si = data.oneShotItems[m];
        if (si.price > 0) {
          if (si.detail) {
            rows.push({ type: 'D', label: clean(si.name), detail: clean(si.detail),
                        value: fmtP(si.price) + ' EUR', lc: DARK, rc: DARK });
          } else {
            rows.push({ type: 'S', label: clean(si.name),
                        value: fmtP(si.price) + ' EUR', lc: DARK, rc: DARK });
          }
        }
      }
      if (data.oneShotTotal > 0) {
        rows.push({ type: 'SUB', label: 'Prestations 1ere annee (non recurrent)',
                    value: fmtP(data.oneShotTotal) + ' EUR' });
      }
    }
  }

  return rows;
}

// ── ROW HEIGHT CALCULATOR ────────────────────────────────────

function rowH(row) {
  if (row.type === 'SEP') return 6;
  if (row.type === 'SUB') return 12;
  if (row.type === 'S')   return 17;
  if (row.type === 'D') {
    var hasDetail = row.detail && row.detail.trim() !== '' && row.detail !== '-';
    return hasDetail ? 23 : 18;
  }
  return 0;
}

function calcH(rows) {
  var h = 0;
  for (var i = 0; i < rows.length; i++) h += rowH(rows[i]);
  return h;
}

// ── FIND SPLIT POINT ─────────────────────────────────────────
// Returns index of first row to go on slide 2.
// Avoids splitting at a SEP row.

function findSplit(rows, maxH) {
  var h = 0;
  var split = rows.length;
  for (var i = 0; i < rows.length; i++) {
    h += rowH(rows[i]);
    if (h > maxH) {
      split = i;
      break;
    }
  }
  // Back up past any trailing SEP rows at the split point
  while (split > 0 && rows[split - 1].type === 'SEP') split--;
  // Ensure we don't put everything on slide 2
  if (split === 0) split = 1;
  return split;
}

// ── RENDER ROWS ──────────────────────────────────────────────
// Renders rows[from..to-1] on slide starting at startY.
// Returns the y value after the last row.

function renderRows(slide, rows, from, to, startY) {
  var y = startY;
  for (var i = from; i < to; i++) {
    var row = rows[i];
    if (row.type === 'SEP') {
      y += 6;
    } else if (row.type === 'SUB') {
      y = rowSub(slide, y, row.label, row.value);
    } else if (row.type === 'S') {
      y = rowS(slide, y, row.label, row.value, row.lc, row.rc);
    } else if (row.type === 'D') {
      y = rowD(slide, y, row.label, row.detail || '', row.value, row.lc, row.rc);
    }
  }
  return y;
}

// ── MAKE SLIDE (with header) ─────────────────────────────────
// pageLabel: null for single slide, '1 / 2' or '2 / 2' for multi

function makeSlide(presentation, data, dateStr, pageLabel) {
  var slide = presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  slide.getBackground().setSolidFill(WHITE);

  // Header bar
  rect(slide, 0, 0, 720, 48, BRAND);
  tb(slide, 'FLATCHR', 36, 12, 120, 26, 15, true, WHITE);

  var ttl = slide.insertTextBox('Recapitulatif commercial', 162, 17, 300, 16);
  ttl.getFill().setTransparent(); ttl.getBorder().setTransparent();
  ttl.getText().getTextStyle().setFontSize(9);
  ttl.getText().getTextStyle().setItalic(true);
  ttl.getText().getTextStyle().setForegroundColor(LIGHT);

  // Date + optional page label on right
  var headerRight = dateStr + (pageLabel ? '   |   ' + pageLabel : '');
  var dbox = slide.insertTextBox(headerRight, 480, 17, 204, 14);
  dbox.getFill().setTransparent(); dbox.getBorder().setTransparent();
  dbox.getText().getTextStyle().setFontSize(9);
  dbox.getText().getTextStyle().setForegroundColor(LIGHT);
  dbox.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);

  // Config strip
  rect(slide, 0, 48, 720, 20, LIGHT_BG);
  var parts = [clean(data.effectifLabel), clean(data.accountTypeLabel)];
  if (data.packsItems && data.packsItems.length > 0) {
    for (var p = 0; p < data.packsItems.length; p++) {
      parts.push('Pack ' + clean(data.packsItems[p].name));
    }
  }
  tb(slide, parts.join('   /   '), 36, 53, 648, 13, 8, false, MUTED);

  // Full separator + column headers
  fullSep(slide, 68);
  var y = 74;
  tb(slide, 'TARIFICATION', 36, y, 370, 11, 7, true, MUTED);
  tbR(slide, 'MONTANT HT', 416, y, 268, 11, 7, false, LIGHT);
  y += 11;
  fullSep(slide, y);

  return slide;
}

// ── DRAW TOTAL BOX ───────────────────────────────────────────

function drawTotalBox(slide, data, y) {
  var boxH = SLIDE_H - y;
  rect(slide, 0, y, 720, boxH, TOTAL_BG);
  rect(slide, 36, y + 1, 648, 1, '#2D4A65');

  var ty = y + 12;
  tb(slide, 'TOTAL 1ere annee', 36, ty, 340, 22, 13, true, WHITE);
  tbR(slide, fmtP(data.firstYearTotal) + ' EUR', 380, ty, 304, 22, 13, true, WHITE);
  ty += 25;

  tb(slide, 'puis des la 2eme annee', 36, ty, 340, 14, 8, false, LIGHT);
  tbR(slide, fmtP(data.recurringYear2) + ' EUR/an', 380, ty, 304, 14, 8, false, LIGHT);
  ty += 17;

  // Conditions
  var engagementMonths = data.commitment || 12;
  var condParts = ['Engagement ' + engagementMonths + ' mois'];
  if (data.extendedMonths > 12) condParts.push('Contrat ' + data.extendedMonths + ' mois');
  if (data.paymentSchedule && data.paymentSchedule !== 'annual' && data.recurringYear2 > 0) {
    var periods = data.paymentSchedule === 'quarterly' ? 4 : 2;
    var periodName = data.paymentSchedule === 'quarterly' ? 'trimestre' : 'semestre';
    var periodAmt = Math.round(data.recurringYear2 / periods);
    condParts.push((data.paymentSchedule === 'quarterly' ? 'Trimestriel' : 'Semestriel') + ' ' + fmtP(periodAmt) + ' EUR/' + periodName);
  }
  if (data.offeredValue > 0) condParts.push('Geste commercial ' + fmtP(data.offeredValue) + ' EUR');
  tb(slide, condParts.join('   |   '), 36, ty, 648, 12, 8, false, MUTED);
}

// ── HELPERS ──────────────────────────────────────────────────

function clampY(y, minY, maxY) {
  if (y < minY) return minY;
  if (y > maxY) return maxY;
  return y;
}

function rect(slide, x, y, w, h, color) {
  var s = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x, y, w, h);
  s.getFill().setSolidFill(color);
  s.getBorder().setTransparent();
  return s;
}

function fullSep(slide, y) { rect(slide, 0, y, 720, 1, SEP_C); }
function thinSep(slide, y) { rect(slide, 36, y, 648, 1, SEP_C); }

function tb(slide, text, x, y, w, h, size, bold, color) {
  var box = slide.insertTextBox(text, x, y, w, h);
  box.getFill().setTransparent();
  box.getBorder().setTransparent();
  box.getText().getTextStyle().setFontSize(size || 10);
  box.getText().getTextStyle().setForegroundColor(color || DARK);
  if (bold) box.getText().getTextStyle().setBold(true);
  return box;
}

function tbR(slide, text, x, y, w, h, size, bold, color) {
  var box = tb(slide, text, x, y, w, h, size, bold, color);
  box.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
  return box;
}

// Ligne avec label gras + detail mute optionnel en dessous (22px avec detail, 17px sans)
function rowD(slide, y, label, detail, value, lColor, rColor) {
  var hasDetail = detail && detail.trim() !== '' && detail !== '-';
  var rowH = hasDetail ? 21 : 16;
  tb(slide, label, COL_L, y + 2, 370, 12, 9, true, lColor || DARK);
  if (hasDetail) {
    var det = slide.insertTextBox(detail, COL_L, y + 13, 370, 9);
    det.getFill().setTransparent();
    det.getBorder().setTransparent();
    det.getText().getTextStyle().setFontSize(7);
    det.getText().getTextStyle().setForegroundColor(MUTED);
  }
  tbR(slide, value, COL_R, y + Math.round((rowH - 12) / 2), COL_RW, 12, 9, false, rColor || DARK);
  return y + rowH + 2;
}

// Ligne simple sans detail (17px)
function rowS(slide, y, label, value, lColor, rColor) {
  tb(slide, label, COL_L, y + 2, 370, 12, 9, false, lColor || DARK);
  tbR(slide, value, COL_R, y + 2, COL_RW, 12, 9, false, rColor || DARK);
  return y + 17;
}

// Ligne sous-total : italique, mute (12px)
function rowSub(slide, y, label, value) {
  var lBox = tb(slide, label, COL_L, y + 1, 370, 10, 8, false, MUTED);
  lBox.getText().getTextStyle().setItalic(true);
  var rBox = tbR(slide, value, COL_R, y + 1, COL_RW, 10, 8, false, MUTED);
  rBox.getText().getTextStyle().setItalic(true);
  return y + 12;
}

function clean(s) {
  if (!s) return '-';
  return String(s)
    .replace(/[—–]/g, '-')
    .replace(/[·⋅]/g, '.')
    .replace(/×/g, 'x')
    .replace(/['']/g, "'")
    .replace(/[àâä]/g, 'a')
    .replace(/[éèêë]/g, 'e')
    .replace(/[îï]/g, 'i')
    .replace(/[ôö]/g, 'o')
    .replace(/[ùûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[œ]/g, 'oe');
}

function fmtP(n) {
  if (n == null || isNaN(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
