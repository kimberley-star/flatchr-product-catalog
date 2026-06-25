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
//    - Qui a accès : Tout le monde (y compris anonyme)
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
      throw new Error('Aucune donnée reçue. Paramètre "data" manquant.');
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
      '<h2 style="color:#c00">Erreur lors de la génération</h2>' +
      '<pre style="background:#f5f5f5;padding:16px;border-radius:6px;white-space:pre-wrap">' + err.message + '</pre>' +
      (fileId ? '<p>ID du fichier créé : <code>' + fileId + '</code></p>' : '') +
      extra +
      '</body></html>'
    );
  }
}

function generatePresentation(data) {
  // 1. Récupérer le template
  var templateFile = DriveApp.getFileById(TEMPLATE_ID);

  // 2. Créer une copie
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  var copyName = 'Plaquette Flatchr' +
    (data.effectifLabel ? ' · ' + data.effectifLabel : '') +
    ' · ' + dateStr;
  var copy = templateFile.makeCopy(copyName);
  var fileId = copy.getId();
  var fileUrl = 'https://docs.google.com/presentation/d/' + fileId + '/edit';

  // 3. Ouvrir la présentation et ajouter la slide récapitulatif
  var presentation = SlidesApp.openById(fileId);
  try {
    addSummarySlide(presentation, data, dateStr);
    presentation.saveAndClose();
  } catch (slideErr) {
    // Si la slide échoue, on sauvegarde quand même et on ouvre le fichier tel quel
    Logger.log('Erreur addSummarySlide : ' + slideErr.message);
    try { presentation.saveAndClose(); } catch(e2) {}
  }

  // 4. Tenter de partager (peut échouer selon la politique Workspace — non bloquant)
  try {
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (shareErr) {
    Logger.log('Partage impossible : ' + shareErr.message);
  }

  return { id: fileId, url: fileUrl };
}

function addSummarySlide(presentation, data, dateStr) {
  var W = presentation.getPageWidth();
  var H = presentation.getPageHeight();

  var slide = presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  slide.getBackground().setSolidFill('#FFFFFF');

  // ── Header ────────────────────────────────────────────────────
  var header = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, W, 72);
  header.getFill().setSolidFill('#0A2E5C');
  header.getBorder().setTransparent();

  var logoBox = slide.insertTextBox('FLATCHR', 28, 16, 160, 40);
  applyTextStyle(logoBox, '#FFFFFF', 20, true, false);

  var titleBox = slide.insertTextBox('Récapitulatif de devis', W / 2 - 180, 20, 360, 32);
  applyTextStyle(titleBox, '#B8C8E8', 14, false, true);

  var dateBox = slide.insertTextBox(dateStr, W - 160, 24, 140, 24);
  applyTextStyle(dateBox, '#8899BB', 11, false, false);
  dateBox.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.RIGHT);

  // ── Layout ────────────────────────────────────────────────────
  var y = 90;
  var mx = 36;
  var colL = W * 0.60;
  var colV = W - mx * 2 - colL;
  var rh = 30;

  // Section configuration
  y = addSectionTitle(slide, 'Configuration', mx, y, W - mx * 2) + 8;

  var configRows = [
    ['Effectif', data.effectifLabel || '—'],
    ['Type de compte', data.accountTypeLabel || '—'],
    ['Pack', data.packLabel || 'Socle seul'],
  ];
  if (data.optionsLabels && data.optionsLabels.length > 0) {
    configRows.push(['Options', data.optionsLabels.join(', ')]);
  }
  configRows.forEach(function(r) { addRow(slide, r[0], r[1], mx, y, colL, colV, rh, false); y += rh + 4; });

  y += 10;

  // Séparateur (rectangle fin au lieu d'une ligne pour éviter les bugs API)
  var sep = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, mx, y, W - mx * 2, 1);
  sep.getFill().setSolidFill('#DDEEFF');
  sep.getBorder().setTransparent();
  y += 12;

  // Section tarification
  y = addSectionTitle(slide, 'Tarification HT', mx, y, W - mx * 2) + 8;

  var rows = [];
  if (data.splitYears) {
    rows.push(['Abonnement annuel (dès la 2ème année)', fmtP(data.recurringYear2) + ' € / an']);
    if (data.tierYear1Saving > 0) {
      rows.push(['Remise 1ère année (effectif)', '−' + fmtP(data.tierYear1Saving) + ' €']);
    }
    if (data.oneShotTotal > 0) {
      rows.push(['Prestations one-shot', fmtP(data.oneShotTotal) + ' €']);
    }
    rows.push(['TOTAL 1ère année', fmtP(data.firstYearTotal) + ' €']);
    rows.push(['Puis dès la 2ème année', fmtP(data.recurringYear2) + ' € / an']);
  } else {
    rows.push(['Abonnement annuel', fmtP(data.recurringYear2) + ' € / an']);
    if (data.oneShotTotal > 0) {
      rows.push(['Prestations one-shot', fmtP(data.oneShotTotal) + ' €']);
    }
    rows.push(['TOTAL', fmtP(data.firstYearTotal) + ' €']);
  }
  rows.push([
    'Durée du contrat',
    data.monthsCount > 0
      ? data.extendedMonths + ' mois (' + data.monthsCount + ' offert' + (data.monthsCount > 1 ? 's' : '') + ')'
      : '12 mois · renouvelable annuellement'
  ]);

  rows.forEach(function(r) {
    var isTotal = r[0].indexOf('TOTAL') === 0;
    addRow(slide, r[0], r[1], mx, y, colL, colV, rh, isTotal);
    y += rh + (isTotal ? 6 : 4);
  });

  // Footer
  var foot = slide.insertTextBox(
    'Flatchr · Tous prix HT · Devis valable 30 jours · ' + dateStr,
    mx, H - 30, W - mx * 2, 22
  );
  applyTextStyle(foot, '#AAAAAA', 9, false, true);
}

// ── Helpers ────────────────────────────────────────────────────

function fmtP(n) {
  if (!n) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function applyTextStyle(box, color, size, bold, center) {
  box.getFill().setTransparent();
  box.getBorder().setTransparent();
  var t = box.getText();
  t.getTextStyle().setForegroundColor(color).setFontSize(size).setBold(!!bold);
  if (center) t.getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
}

function addSectionTitle(slide, label, x, y, w) {
  var box = slide.insertTextBox(label.toUpperCase(), x, y, w, 22);
  box.getFill().setTransparent();
  box.getBorder().setTransparent();
  box.getText().getTextStyle().setBold(true).setFontSize(9).setForegroundColor('#6688BB');
  return y + 22;
}

function addRow(slide, label, value, x, y, colL, colV, h, isTotal) {
  if (isTotal) {
    var bg = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x - 8, y - 3, colL + colV + 16, h + 6);
    bg.getFill().setSolidFill('#EEF3FF');
    bg.getBorder().setTransparent();
  }

  var lb = slide.insertTextBox(label, x, y, colL, h);
  lb.getFill().setTransparent();
  lb.getBorder().setTransparent();
  lb.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  lb.getText().getTextStyle()
    .setFontSize(isTotal ? 12 : 11).setBold(!!isTotal)
    .setForegroundColor(isTotal ? '#0A2E5C' : '#444444');

  var vb = slide.insertTextBox(value, x + colL, y, colV, h);
  vb.getFill().setTransparent();
  vb.getBorder().setTransparent();
  vb.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  vb.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.RIGHT);
  vb.getText().getTextStyle()
    .setFontSize(isTotal ? 13 : 11).setBold(!!isTotal)
    .setForegroundColor(isTotal ? '#0A2E5C' : '#222222');
}
