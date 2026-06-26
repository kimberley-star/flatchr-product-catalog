// ============================================================
// Catalogue Produit Flatchr — Google Apps Script
// ============================================================

var TEMPLATE_ID = '1cfJ6niqBmTtSihNdNnKwIdweT3OZUaeCIStQ4eslFMY';

function doGet(e) {
  var fileId = null;
  var fileUrl = null;
  try {
    if (!e.parameter || !e.parameter.data) {
      throw new Error('Parametre data manquant.');
    }
    var data = JSON.parse(e.parameter.data);
    var result = generatePresentation(data);
    fileId = result.id;
    fileUrl = result.url;

    return HtmlService.createHtmlOutput(
      '<html><head><meta http-equiv="refresh" content="2;url=' + fileUrl + '">' +
      '<style>body{font-family:sans-serif;background:#f0f4ff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}' +
      '.box{background:#fff;border-radius:12px;padding:40px 48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1)}' +
      'h2{color:#0a2e5c;margin:0 0 12px}p{color:#666;margin:0 0 20px}' +
      'a.btn{display:inline-block;background:#0a2e5c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600}' +
      '</style></head><body><div class="box">' +
      '<h2>Plaquette prete !</h2><p>Redirection dans 2 secondes...</p>' +
      '<a class="btn" href="' + fileUrl + '">Ouvrir la presentation</a>' +
      '</div></body></html>'
    );
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif;padding:40px">' +
      '<h2 style="color:red">Erreur</h2><pre>' + err.message + '</pre>' +
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
  slide.getBackground().setSolidFill('#FFFFFF');

  // ── Header (fonctionne) ────────────────────────────────────
  var hdr = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, 720, 68);
  hdr.getFill().setSolidFill('#0A2E5C');
  hdr.getBorder().setTransparent();

  var logo = slide.insertTextBox('FLATCHR', 28, 14, 180, 40);
  logo.getFill().setTransparent();
  logo.getBorder().setTransparent();
  logo.getText().getTextStyle().setBold(true);
  logo.getText().getTextStyle().setFontSize(20);
  logo.getText().getTextStyle().setForegroundColor('#FFFFFF');

  var ttl = slide.insertTextBox('Recapitulatif de devis', 210, 18, 300, 30);
  ttl.getFill().setTransparent();
  ttl.getBorder().setTransparent();
  ttl.getText().getTextStyle().setFontSize(13);
  ttl.getText().getTextStyle().setForegroundColor('#AABBD4');

  var dbox = slide.insertTextBox(dateStr, 570, 22, 120, 24);
  dbox.getFill().setTransparent();
  dbox.getBorder().setTransparent();
  dbox.getText().getTextStyle().setFontSize(10);
  dbox.getText().getTextStyle().setForegroundColor('#7799BB');

  // ── Contenu via TABLE (texte toujours visible) ─────────────
  // Construire les lignes
  var rows = [];

  // Section Configuration
  rows.push(['Effectif', clean(data.effectifLabel)]);
  rows.push(['Compte', clean(data.accountTypeLabel)]);
  rows.push(['Pack', clean(data.packLabel)]);
  if (data.optionsLabels && data.optionsLabels.length > 0) {
    rows.push(['Options', data.optionsLabels.map(clean).join(', ')]);
  }

  // Ligne séparatrice vide
  rows.push(['', '']);

  // Section Tarification
  if (data.splitYears) {
    rows.push(['Abonnement annuel (annee 2+)', fmtP(data.recurringYear2) + ' euros/an']);
    if (data.tierYear1Saving > 0) {
      rows.push(['Remise 1ere annee', '- ' + fmtP(data.tierYear1Saving) + ' euros']);
    }
    if (data.oneShotTotal > 0) {
      rows.push(['Prestations one-shot', fmtP(data.oneShotTotal) + ' euros']);
    }
    rows.push(['TOTAL 1ere annee', fmtP(data.firstYearTotal) + ' euros']);
    rows.push(['Abonnement annuel (annee 2+)', fmtP(data.recurringYear2) + ' euros/an']);
  } else {
    rows.push(['Abonnement annuel', fmtP(data.recurringYear2) + ' euros/an']);
    if (data.oneShotTotal > 0) {
      rows.push(['Prestations', fmtP(data.oneShotTotal) + ' euros']);
    }
    rows.push(['TOTAL', fmtP(data.firstYearTotal) + ' euros']);
  }

  rows.push(['Duree', data.monthsCount > 0
    ? data.extendedMonths + ' mois (' + data.monthsCount + ' offert' + (data.monthsCount > 1 ? 's' : '') + ')'
    : '12 mois renouvelable']);

  var numRows = rows.length;
  var rowH = Math.min(28, Math.floor(300 / numRows));
  var tableH = numRows * rowH;

  // Insérer le tableau
  var table = slide.insertTable(numRows, 2, 36, 82, 648, tableH);

  for (var r = 0; r < numRows; r++) {
    var cellL = table.getCell(r, 0);
    var cellR = table.getCell(r, 1);

    cellL.getText().setText(rows[r][0]);
    cellR.getText().setText(rows[r][1]);

    // Alignement droite pour la colonne valeur
    cellR.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
  }
}

function clean(s) {
  if (!s) return '-';
  return String(s)
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/·/g, '.')
    .replace(/’/g, "'")
    .replace(/‘/g, "'");
}

function fmtP(n) {
  if (!n) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
