// ============================================================
// Catalogue Produit Flatchr — Google Apps Script
// ============================================================

var TEMPLATE_ID = '1cfJ6niqBmTtSihNdNnKwIdweT3OZUaeCIStQ4eslFMY';

var WHITE    = '#FFFFFF';
var MUTED    = '#AABBD4';
var DIM      = '#7799BB';
var SEP_C    = '#3D5A7A';
var TOTAL_BG = '#1C2E3E';

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
  slide.getBackground().setSolidFill('#2B435E');

  // ── HEADER ──────────────────────────────────────────────────
  tb(slide, 'FLATCHR', 36, 16, 200, 36, 22, true, WHITE);

  var ttl = slide.insertTextBox('Recapitulatif de devis', 244, 20, 276, 28);
  ttl.getFill().setTransparent(); ttl.getBorder().setTransparent();
  ttl.getText().getTextStyle().setFontSize(12);
  ttl.getText().getTextStyle().setItalic(true);
  ttl.getText().getTextStyle().setForegroundColor(MUTED);

  var dbox = slide.insertTextBox(dateStr, 572, 24, 118, 20);
  dbox.getFill().setTransparent(); dbox.getBorder().setTransparent();
  dbox.getText().getTextStyle().setFontSize(10);
  dbox.getText().getTextStyle().setForegroundColor(MUTED);
  dbox.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);

  sep(slide, 64);

  // ── LIGNE CONFIGURATION ─────────────────────────────────────
  var parts = [clean(data.effectifLabel), clean(data.accountTypeLabel)];
  if (data.packsItems && data.packsItems.length > 0) {
    for (var pi = 0; pi < data.packsItems.length; pi++) {
      parts.push('Pack ' + clean(data.packsItems[pi].name));
    }
  }
  tb(slide, parts.join('  /  '), 36, 74, 648, 18, 10, false, MUTED);

  sep(slide, 93);

  var y = 101;

  // ── TARIFICATION ────────────────────────────────────────────
  tb(slide, 'TARIFICATION', 36, y, 370, 14, 8, true, DIM);
  tb(slide, 'HT', 690, y, 24, 14, 7, false, MUTED);
  y += 18;

  // Socle fonctionnel
  if (data.soclePrice > 0) {
    y = lr(slide, y, 'Socle fonctionnel', fmtP(data.soclePrice) + ' euros/an', 11, WHITE, WHITE);
  }

  // Accompagnement CSM
  y = lr(slide, y, 'Accompagnement CSM', 'Inclus', 11, WHITE, MUTED);

  // Packs
  if (data.packsItems && data.packsItems.length > 0) {
    for (var qi = 0; qi < data.packsItems.length; qi++) {
      var pi = data.packsItems[qi];
      if (pi.price > 0) {
        var pl = 'Pack ' + clean(pi.name);
        if (pi.detail) pl += '  ' + clean(pi.detail);
        y = lr(slide, y, pl, fmtP(pi.price) + ' euros/an', 11, WHITE, WHITE);
      }
    }
  }

  // Options recurrentes internes
  if (data.recurringInternalItems) {
    for (var i = 0; i < data.recurringInternalItems.length; i++) {
      var ri = data.recurringInternalItems[i];
      if (ri.price > 0) y = lr(slide, y, clean(ri.name), fmtP(ri.price) + ' euros/an', 11, WHITE, WHITE);
    }
  }

  // Options recurrentes externes
  if (data.externalItems) {
    for (var j = 0; j < data.externalItems.length; j++) {
      var ei = data.externalItems[j];
      if (ei.price > 0) y = lr(slide, y, clean(ei.name), fmtP(ei.price) + ' euros/an', 11, WHITE, WHITE);
    }
  }

  // Remise commerciale (% ou euro)
  if (data.pctDiscount > 0) {
    var dLbl = 'Remise commerciale';
    if (data.discountType === 'percent' && data.discountValue) dLbl += ' (' + data.discountValue + '%)';
    y = lr(slide, y, dLbl, '- ' + fmtP(data.pctDiscount) + ' euros', 11, WHITE, WHITE);
  }

  // Reduction association loi 1901
  if (data.assoc1901Discount > 0) {
    y = lr(slide, y, 'Reduction asso loi 1901 (-50%)', '- ' + fmtP(data.assoc1901Discount) + ' euros', 11, WHITE, WHITE);
  }

  // Abonnement annuel (separateur + ligne resumee)
  sep(slide, y); y += 7;
  y = lr(slide, y, 'Abonnement annuel (des la 2eme annee)', fmtP(data.recurringYear2) + ' euros/an', 10, MUTED, MUTED);

  // Remise effectif -1 cran (1ere annee uniquement)
  if (data.tierYear1Saving > 0) {
    var tierLbl = 'Remise effectif -1 cran';
    if (data.upgradePct) tierLbl += ' (-' + data.upgradePct + '%)';
    y = lr(slide, y, tierLbl + '  ·  1ere annee seult', '- ' + fmtP(data.tierYear1Saving) + ' euros', 10, MUTED, MUTED);
  }

  // Mois offerts
  if (data.monthsCount > 0) {
    y = lr(slide, y, data.monthsCount + ' mois offert' + (data.monthsCount > 1 ? 's' : '') + '  ·  contrat ' + data.extendedMonths + ' mois', 'Offert', 10, MUTED, MUTED);
  }

  // Prestations one-shot
  if (data.oneShotItems && data.oneShotItems.length > 0) {
    sep(slide, y); y += 7;
    for (var k = 0; k < data.oneShotItems.length; k++) {
      var si = data.oneShotItems[k];
      if (si.price > 0) y = lr(slide, y, clean(si.name), fmtP(si.price) + ' euros', 11, WHITE, WHITE);
    }
    if (data.oneShotTotal > 0) {
      y = lr(slide, y, 'Prestations 1ere annee', fmtP(data.oneShotTotal) + ' euros', 10, MUTED, MUTED);
    }
  }

  // ── TOTAL BOX ───────────────────────────────────────────────
  y += 8;
  var boxH = 405 - y;
  var tBox = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, y, 720, boxH);
  tBox.getFill().setSolidFill(TOTAL_BG);
  tBox.getBorder().setTransparent();

  var ty = y + 10;
  tb(slide, 'TOTAL 1ere annee', 36, ty, 370, 26, 14, true, WHITE);
  tbR(slide, fmtP(data.firstYearTotal) + ' euros', 416, ty, 268, 26, 14, true, WHITE);
  ty += 30;

  tb(slide, 'puis des la 2eme annee', 36, ty, 370, 18, 10, false, MUTED);
  tbR(slide, fmtP(data.recurringYear2) + ' euros/an', 416, ty, 268, 18, 10, false, MUTED);
  ty += 20;

  var engagementMonths = data.commitment || 12;
  var durStr = data.extendedMonths > 12
    ? 'Contrat ' + data.extendedMonths + ' mois  ·  Engagement ' + engagementMonths + ' mois'
    : 'Engagement ' + engagementMonths + ' mois';
  if (data.offeredValue > 0) durStr += '  ·  Prestations offertes : valeur ' + fmtP(data.offeredValue) + ' euros';
  tb(slide, 'Duree : ' + durStr, 36, ty, 648, 16, 9, false, DIM);
  ty += 16;

  // Paiement amenage
  if (data.paymentSchedule && data.paymentSchedule !== 'annual' && data.recurringYear2 > 0) {
    var periods = data.paymentSchedule === 'quarterly' ? 4 : 2;
    var periodName = data.paymentSchedule === 'quarterly' ? 'trimestre' : 'semestre';
    var periodAmt = Math.round(data.recurringYear2 / periods);
    tb(slide, 'Paiement : ' + (data.paymentSchedule === 'quarterly' ? 'Trimestriel' : 'Semestriel') + '  ·  ' + fmtP(periodAmt) + ' euros / ' + periodName, 36, ty, 648, 16, 9, false, WHITE);
  }
}

// ── HELPERS ─────────────────────────────────────────────────

function tb(slide, text, x, y, w, h, size, bold, color) {
  var box = slide.insertTextBox(text, x, y, w, h);
  box.getFill().setTransparent();
  box.getBorder().setTransparent();
  box.getText().getTextStyle().setFontSize(size || 11);
  box.getText().getTextStyle().setForegroundColor(color || WHITE);
  if (bold) box.getText().getTextStyle().setBold(true);
  return box;
}

function tbR(slide, text, x, y, w, h, size, bold, color) {
  var box = tb(slide, text, x, y, w, h, size, bold, color);
  box.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
  return box;
}

function sep(slide, y) {
  var s = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 36, y, 648, 1);
  s.getFill().setSolidFill(SEP_C);
  s.getBorder().setTransparent();
}

function lr(slide, y, label, value, size, lColor, rColor) {
  tb(slide, label, 36, y, 370, 20, size, false, lColor);
  tbR(slide, value, 416, y, 268, 20, size, false, rColor);
  return y + 20;
}

function clean(s) {
  if (!s) return '-';
  return String(s)
    .replace(/[—–]/g, '-')
    .replace(/[·⋅]/g, '.')
    .replace(/×/g, 'x')
    .replace(/[‘’]/g, "'");
}

function fmtP(n) {
  if (n == null || isNaN(n)) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
