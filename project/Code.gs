// ============================================================
// Catalogue Produit Flatchr — Google Apps Script
// ============================================================

var TEMPLATE_ID = '1cfJ6niqBmTtSihNdNnKwIdweT3OZUaeCIStQ4eslFMY';

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
      '<style>body{font-family:sans-serif;background:#0a2e5c;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}' +
      '.box{background:#fff;border-radius:12px;padding:40px 48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.3)}' +
      'h2{color:#0a2e5c;margin:0 0 12px}p{color:#666;margin:0 0 20px}' +
      'a.btn{display:inline-block;background:#0a2e5c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600}' +
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

  // Fond bleu marine — le texte blanc du theme sera visible sans forcer la couleur
  slide.getBackground().setSolidFill('#0A2E5C');

  // Logo
  var logo = slide.insertTextBox('FLATCHR', 36, 18, 200, 38);
  logo.getFill().setTransparent();
  logo.getBorder().setTransparent();
  logo.getText().getTextStyle().setBold(true);
  logo.getText().getTextStyle().setFontSize(22);

  // Titre
  var ttl = slide.insertTextBox('Recapitulatif de devis', 244, 22, 280, 30);
  ttl.getFill().setTransparent();
  ttl.getBorder().setTransparent();
  ttl.getText().getTextStyle().setFontSize(12);
  ttl.getText().getTextStyle().setItalic(true);

  // Date
  var dbox = slide.insertTextBox(dateStr, 572, 26, 118, 20);
  dbox.getFill().setTransparent();
  dbox.getBorder().setTransparent();
  dbox.getText().getTextStyle().setFontSize(10);
  dbox.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);

  // Ligne separatrice
  var sep = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 36, 66, 648, 1);
  sep.getFill().setSolidFill('#1E4A8A');
  sep.getBorder().setTransparent();

  // Lignes de contenu
  var rows = buildRows(data);
  var yPos = 78;

  for (var r = 0; r < rows.length; r++) {
    var label = rows[r][0];
    var value = rows[r][1];

    if (!label && !value) {
      yPos += 8;
      continue;
    }

    var isTotal = label.indexOf('TOTAL') === 0;
    var fSize = isTotal ? 13 : 11;

    var lbl = slide.insertTextBox(label, 36, yPos, 380, 24);
    lbl.getFill().setTransparent();
    lbl.getBorder().setTransparent();
    lbl.getText().getTextStyle().setFontSize(fSize);
    if (isTotal) lbl.getText().getTextStyle().setBold(true);

    var val = slide.insertTextBox(value, 424, yPos, 260, 24);
    val.getFill().setTransparent();
    val.getBorder().setTransparent();
    val.getText().getTextStyle().setFontSize(fSize);
    if (isTotal) val.getText().getTextStyle().setBold(true);
    val.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);

    yPos += isTotal ? 30 : 24;
  }
}

function buildRows(data) {
  var rows = [];
  rows.push(['Effectif', clean(data.effectifLabel)]);
  rows.push(['Compte', clean(data.accountTypeLabel)]);
  rows.push(['Pack', clean(data.packLabel)]);
  if (data.optionsLabels && data.optionsLabels.length > 0) {
    rows.push(['Options', data.optionsLabels.map(clean).join(', ')]);
  }
  rows.push(['', '']);

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

  return rows;
}

function clean(s) {
  if (!s) return '-';
  return String(s)
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/·/g, '.')
    .replace(/'/g, "'")
    .replace(/'/g, "'");
}

function fmtP(n) {
  if (!n) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
