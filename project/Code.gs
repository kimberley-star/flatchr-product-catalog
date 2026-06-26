// ============================================================
// Catalogue Produit Flatchr — Google Apps Script
// Génération automatique de plaquette commerciale
//
// DÉPLOIEMENT :
// 1. Allez sur https://script.google.com et créez un nouveau projet
// 2. Collez ce code dans l'éditeur (remplacez le contenu par défaut)
// 3. Cliquez sur "Déployer" > "Nouveau déploiement"
// 4. Type : Application Web
//    - Exécuter en tant que : Moi (votre compte Google)
//    - Qui a accès : Tout le monde
// 5. Cliquez sur "Déployer" et autorisez les permissions demandées
// 6. Copiez l'URL de déploiement (finit par /exec)
// 7. Collez cette URL dans la constante APPS_SCRIPT_URL de index.html
// ============================================================

var TEMPLATE_ID = '1cfJ6niqBmTtSihNdNnKwIdweT3OZUaeCIStQ4eslFMY';

function doGet(e) {
  var fileId = null;
  var fileUrl = null;
  try {
    if (!e.parameter || !e.parameter.data) {
      throw new Error('Paramètre "data" manquant dans la requête.');
    }
    var data = JSON.parse(e.parameter.data);
    var result = generatePresentation(data);
    fileId = result.id;
    fileUrl = result.url;

    return HtmlService.createHtmlOutput(
      '<html><head>' +
      '<meta http-equiv="refresh" content="2;url=' + fileUrl + '">' +
      '<style>' +
      'body{font-family:sans-serif;background:#f0f4ff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}' +
      '.box{background:#fff;border-radius:12px;padding:40px 48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:480px}' +
      'h2{color:#0a2e5c;margin:0 0 12px}p{color:#666;margin:0 0 20px}' +
      'a.btn{display:inline-block;background:#0a2e5c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600}' +
      '</style>' +
      '</head><body><div class="box">' +
      '<h2>Plaquette prête !</h2>' +
      '<p>Redirection automatique dans 2 secondes...</p>' +
      '<a class="btn" href="' + fileUrl + '" target="_self">Ouvrir la présentation &rarr;</a>' +
      '</div></body></html>'
    );
  } catch (err) {
    var extra = fileUrl ? '<p><a href="' + fileUrl + '">Essayer d\'ouvrir quand même</a></p>' : '';
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif;padding:40px;max-width:600px">' +
      '<h2 style="color:#c00">Erreur</h2>' +
      '<pre style="background:#f5f5f5;padding:16px;border-radius:6px;white-space:pre-wrap">' + err.message + '</pre>' +
      (fileId ? '<p>ID fichier : <code>' + fileId + '</code></p>' : '') +
      extra +
      '</body></html>'
    );
  }
}

function generatePresentation(data) {
  var templateFile = DriveApp.getFileById(TEMPLATE_ID);
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var copyName = 'Plaquette Flatchr' +
    (data.effectifLabel && data.effectifLabel !== '—' ? ' · ' + data.effectifLabel : '') +
    ' · ' + dateStr;

  var copy = templateFile.makeCopy(copyName);
  var fileId = copy.getId();

  var presentation = SlidesApp.openById(fileId);
  try {
    addSummarySlide(presentation, data, dateStr);
  } catch (err) {
    Logger.log('Erreur slide : ' + err.message + '\n' + err.stack);
  }
  presentation.saveAndClose();

  try {
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    Logger.log('Partage : ' + shareErr.message);
  }

  return {
    id: fileId,
    url: 'https://docs.google.com/presentation/d/' + fileId + '/edit'
  };
}

function addSummarySlide(presentation, data, dateStr) {
  var W = presentation.getPageWidth();
  var H = presentation.getPageHeight();

  var slide = presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  slide.getBackground().setSolidFill('#FFFFFF');

  // ── Header ─────────────────────────────────────────────────
  var hdr = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, W, 68);
  hdr.getFill().setSolidFill('#0A2E5C');
  hdr.getBorder().setTransparent();

  var logo = slide.insertTextBox('FLATCHR', 28, 14, 180, 40);
  logo.getFill().setTransparent();
  logo.getBorder().setTransparent();
  logo.getText().getTextStyle().setBold(true);
  logo.getText().getTextStyle().setFontSize(20);
  logo.getText().getTextStyle().setForegroundColor('#FFFFFF');

  var ttl = slide.insertTextBox('Récapitulatif de devis', W / 2 - 150, 18, 300, 30);
  ttl.getFill().setTransparent();
  ttl.getBorder().setTransparent();
  ttl.getText().getTextStyle().setFontSize(13);
  ttl.getText().getTextStyle().setForegroundColor('#AABBD4');
  ttl.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);

  var dt = slide.insertTextBox(dateStr, W - 150, 22, 130, 24);
  dt.getFill().setTransparent();
  dt.getBorder().setTransparent();
  dt.getText().getTextStyle().setFontSize(10);
  dt.getText().getTextStyle().setForegroundColor('#7799BB');
  dt.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.RIGHT);

  // ── Layout variables ────────────────────────────────────────
  var mx = 36;
  var y = 80;
  var colL = Math.round(W * 0.62);
  var colV = W - mx * 2 - colL;
  var rh = 28;

  // ── Section : Configuration ─────────────────────────────────
  y = insertLabel(slide, 'CONFIGURATION', mx, y, W - mx * 2);
  y += 6;

  var cfgRows = [
    ['Effectif', data.effectifLabel || '—'],
    ['Type de compte', data.accountTypeLabel || '—'],
    ['Pack', data.packLabel || 'Socle seul']
  ];
  if (data.optionsLabels && data.optionsLabels.length > 0) {
    cfgRows.push(['Options', data.optionsLabels.join(', ')]);
  }
  for (var i = 0; i < cfgRows.length; i++) {
    insertRow(slide, cfgRows[i][0], cfgRows[i][1], mx, y, colL, colV, rh, false);
    y += rh + 3;
  }

  y += 8;

  // Séparateur
  var sep = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, mx, y, W - mx * 2, 1);
  sep.getFill().setSolidFill('#D0DDEE');
  sep.getBorder().setTransparent();
  y += 10;

  // ── Section : Tarification ─────────────────────────────────
  y = insertLabel(slide, 'TARIFICATION HT', mx, y, W - mx * 2);
  y += 6;

  var rows = [];
  if (data.splitYears) {
    rows.push(['Abonnement annuel (dès la 2ème année)', fmtP(data.recurringYear2) + ' € / an', false]);
    if (data.tierYear1Saving > 0) {
      rows.push(['Remise 1ère année (effectif)', '−' + fmtP(data.tierYear1Saving) + ' €', false]);
    }
    if (data.oneShotTotal > 0) {
      rows.push(['Prestations one-shot', fmtP(data.oneShotTotal) + ' €', false]);
    }
    rows.push(['TOTAL 1ère année', fmtP(data.firstYearTotal) + ' €', true]);
    rows.push(['Puis dès la 2ème année', fmtP(data.recurringYear2) + ' € / an', false]);
  } else {
    rows.push(['Abonnement annuel', fmtP(data.recurringYear2) + ' € / an', false]);
    if (data.oneShotTotal > 0) {
      rows.push(['Prestations one-shot', fmtP(data.oneShotTotal) + ' €', false]);
    }
    rows.push(['TOTAL', fmtP(data.firstYearTotal) + ' €', true]);
  }
  var dureeLabel = data.monthsCount > 0
    ? data.extendedMonths + ' mois (' + data.monthsCount + ' offert' + (data.monthsCount > 1 ? 's' : '') + ')'
    : '12 mois · renouvelable annuellement';
  rows.push(['Durée du contrat', dureeLabel, false]);

  for (var j = 0; j < rows.length; j++) {
    insertRow(slide, rows[j][0], rows[j][1], mx, y, colL, colV, rh, rows[j][2]);
    y += rh + (rows[j][2] ? 5 : 3);
  }

  // ── Footer ──────────────────────────────────────────────────
  var foot = slide.insertTextBox(
    'Flatchr · Tous prix HT · Devis valable 30 jours · ' + dateStr,
    mx, H - 26, W - mx * 2, 20
  );
  foot.getFill().setTransparent();
  foot.getBorder().setTransparent();
  foot.getText().getTextStyle().setFontSize(8);
  foot.getText().getTextStyle().setForegroundColor('#AAAAAA');
  foot.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
}

// ── Helper : section label ─────────────────────────────────────
function insertLabel(slide, text, x, y, w) {
  var box = slide.insertTextBox(text, x, y, w, 20);
  box.getFill().setTransparent();
  box.getBorder().setTransparent();
  box.getText().getTextStyle().setBold(true);
  box.getText().getTextStyle().setFontSize(8);
  box.getText().getTextStyle().setForegroundColor('#7799BB');
  return y + 20;
}

// ── Helper : data row (label left + value right) ───────────────
function insertRow(slide, label, value, x, y, colL, colV, h, isTotal) {
  if (isTotal) {
    var bg = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x - 6, y - 2, colL + colV + 12, h + 4);
    bg.getFill().setSolidFill('#EEF3FF');
    bg.getBorder().setTransparent();
  }

  var lb = slide.insertTextBox(label, x, y, colL, h);
  lb.getFill().setTransparent();
  lb.getBorder().setTransparent();
  lb.getText().getTextStyle().setFontSize(isTotal ? 11 : 10);
  lb.getText().getTextStyle().setBold(isTotal ? true : false);
  lb.getText().getTextStyle().setForegroundColor(isTotal ? '#0A2E5C' : '#444444');

  var vb = slide.insertTextBox(value, x + colL, y, colV, h);
  vb.getFill().setTransparent();
  vb.getBorder().setTransparent();
  vb.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.RIGHT);
  vb.getText().getTextStyle().setFontSize(isTotal ? 12 : 10);
  vb.getText().getTextStyle().setBold(isTotal ? true : false);
  vb.getText().getTextStyle().setForegroundColor(isTotal ? '#0A2E5C' : '#222222');
}

// ── Helper : format price ──────────────────────────────────────
function fmtP(n) {
  if (!n) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
