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
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) {
    Logger.log('Partage impossible: ' + e.message);
  }

  return { id: fileId, url: 'https://docs.google.com/presentation/d/' + fileId + '/edit' };
}

function addSummarySlide(presentation, data, dateStr) {
  var slide = presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  slide.getBackground().setSolidFill(WHITE);

  // ── HEADER BAR ──────────────────────────────────────────────
  rect(slide, 0, 0, 720, 48, BRAND);
  tb(slide, 'FLATCHR', 36, 12, 120, 26, 15, true, WHITE);

  var ttl = slide.insertTextBox('Recapitulatif commercial', 162, 17, 300, 16);
  ttl.getFill().setTransparent(); ttl.getBorder().setTransparent();
  ttl.getText().getTextStyle().setFontSize(9);
  ttl.getText().getTextStyle().setItalic(true);
  ttl.getText().getTextStyle().setForegroundColor(LIGHT);

  var dbox = slide.insertTextBox(dateStr, 560, 17, 124, 14);
  dbox.getFill().setTransparent(); dbox.getBorder().setTransparent();
  dbox.getText().getTextStyle().setFontSize(9);
  dbox.getText().getTextStyle().setForegroundColor(LIGHT);
  dbox.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);

  // ── CONFIG STRIP ────────────────────────────────────────────
  rect(slide, 0, 48, 720, 20, LIGHT_BG);
  var parts = [clean(data.effectifLabel), clean(data.accountTypeLabel)];
  if (data.packsItems && data.packsItems.length > 0) {
    for (var p0 = 0; p0 < data.packsItems.length; p0++) {
      parts.push('Pack ' + clean(data.packsItems[p0].name));
    }
  }
  tb(slide, parts.join('   /   '), 36, 53, 648, 13, 8, false, MUTED);

  // ── SEPARATEUR PLEINE LARGEUR ────────────────────────────────
  fullSep(slide, 68);

  var y = 74;

  // ── EN-TETE COLONNE ─────────────────────────────────────────
  tb(slide, 'TARIFICATION', 36, y, 370, 11, 7, true, MUTED);
  tbR(slide, 'MONTANT HT', 416, y, 268, 11, 7, false, LIGHT);
  y += 11;
  fullSep(slide, y);
  y += 7;

  // ── LIGNES DE PRIX ──────────────────────────────────────────

  // Socle fonctionnel
  if (data.soclePrice > 0) {
    y = rowD(slide, y, 'Socle fonctionnel', clean(data.effectifLabel), fmtP(data.soclePrice) + ' EUR/an', DARK, DARK);
  }

  // Accompagnement CSM
  y = rowD(slide, y, 'Accompagnement CSM', 'Inclus dans le socle', 'Inclus', DARK, SUCCESS);

  // Packs
  if (data.packsItems && data.packsItems.length > 0) {
    for (var qi = 0; qi < data.packsItems.length; qi++) {
      var pi = data.packsItems[qi];
      if (pi.price > 0) {
        y = rowD(slide, y, 'Pack ' + clean(pi.name), pi.detail ? clean(pi.detail) : '', fmtP(pi.price) + ' EUR/an', DARK, DARK);
      }
    }
  }

  // Options recurrentes internes
  if (data.recurringInternalItems) {
    for (var i = 0; i < data.recurringInternalItems.length; i++) {
      var ri = data.recurringInternalItems[i];
      if (ri.price > 0) {
        y = rowD(slide, y, clean(ri.name), ri.detail ? clean(ri.detail) : '', fmtP(ri.price) + ' EUR/an', DARK, DARK);
      }
    }
  }

  // Options externes
  if (data.externalItems) {
    for (var j = 0; j < data.externalItems.length; j++) {
      var ei = data.externalItems[j];
      if (ei.price > 0) y = rowS(slide, y, clean(ei.name), fmtP(ei.price) + ' EUR/an', DARK, DARK);
    }
  }

  // Remise commerciale
  if (data.pctDiscount > 0) {
    var dLbl = 'Remise commerciale';
    if (data.discountType === 'percent' && data.discountValue) dLbl += ' (' + data.discountValue + ' %)';
    y = rowS(slide, y, dLbl, '- ' + fmtP(data.pctDiscount) + ' EUR', DARK, SUCCESS);
  }

  // Reduction asso loi 1901
  if (data.assoc1901Discount > 0) {
    y = rowS(slide, y, 'Reduction asso loi 1901 (-50 %)', '- ' + fmtP(data.assoc1901Discount) + ' EUR', DARK, SUCCESS);
  }

  // ── SOUS-TOTAUX ──────────────────────────────────────────────
  thinSep(slide, y + 1);
  y += 6;
  y = rowSub(slide, y, 'Abonnement annuel  (des la 2eme annee)', fmtP(data.recurringYear2) + ' EUR/an');

  // Remise effectif an 1
  if (data.tierYear1Saving > 0) {
    var tLbl = 'Remise effectif (-1 cran' + (data.upgradePct ? ', -' + data.upgradePct + ' %' : '') + ')  /  1ere annee';
    y = rowSub(slide, y, tLbl, '- ' + fmtP(data.tierYear1Saving) + ' EUR');
  }

  // Mois offerts
  if (data.monthsCount > 0) {
    y = rowSub(slide, y, data.monthsCount + ' mois offert' + (data.monthsCount > 1 ? 's' : '') + '  /  contrat ' + data.extendedMonths + ' mois', 'Offert');
  }

  // Prestations one-shot
  if (data.oneShotItems && data.oneShotItems.length > 0) {
    thinSep(slide, y + 1);
    y += 6;
    for (var k = 0; k < data.oneShotItems.length; k++) {
      var si = data.oneShotItems[k];
      if (si.price > 0) {
        y = si.detail
          ? rowD(slide, y, clean(si.name), clean(si.detail), fmtP(si.price) + ' EUR', DARK, DARK)
          : rowS(slide, y, clean(si.name), fmtP(si.price) + ' EUR', DARK, DARK);
      }
    }
    if (data.oneShotTotal > 0) {
      y = rowSub(slide, y, 'Prestations 1ere annee (non recurrent)', fmtP(data.oneShotTotal) + ' EUR');
    }
  }

  // ── TOTAL BOX ───────────────────────────────────────────────
  y += 10;
  if (y < 268) y = 268; // hauteur min du box : ~137px
  if (y > 328) y = 328; // hauteur max garantie : ~77px
  var boxH = 405 - y;
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

// ── HELPERS ─────────────────────────────────────────────────

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

// Ligne avec label gras + detail mute optionnel en dessous (21px avec detail, 16px sans)
function rowD(slide, y, label, detail, value, lColor, rColor) {
  var hasDetail = detail && detail.trim() !== '' && detail !== '-';
  var rowH = hasDetail ? 21 : 16;
  tb(slide, label, 36, y + 2, 370, 12, 9, true, lColor || DARK);
  if (hasDetail) {
    var det = slide.insertTextBox(detail, 36, y + 13, 370, 9);
    det.getFill().setTransparent();
    det.getBorder().setTransparent();
    det.getText().getTextStyle().setFontSize(7);
    det.getText().getTextStyle().setForegroundColor(MUTED);
  }
  tbR(slide, value, 416, y + Math.round((rowH - 12) / 2), 268, 12, 9, false, rColor || DARK);
  thinSep(slide, y + rowH);
  return y + rowH + 1;
}

// Ligne simple sans detail (16px)
function rowS(slide, y, label, value, lColor, rColor) {
  tb(slide, label, 36, y + 2, 370, 12, 9, false, lColor || DARK);
  tbR(slide, value, 416, y + 2, 268, 12, 9, false, rColor || DARK);
  thinSep(slide, y + 16);
  return y + 17;
}

// Ligne sous-total : italique, mute (12px)
function rowSub(slide, y, label, value) {
  var lBox = tb(slide, label, 36, y + 1, 370, 10, 8, false, MUTED);
  lBox.getText().getTextStyle().setItalic(true);
  var rBox = tbR(slide, value, 416, y + 1, 268, 10, 8, false, MUTED);
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
