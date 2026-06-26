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
      (fileId ? '<p>ID: ' + fileId + '</p>' : '') +
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
    Logger.log('Erreur addSummarySlide: ' + err.message);
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

  // Header
  var hdr = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, 720, 68);
  hdr.getFill().setSolidFill('#0A2E5C');
  hdr.getBorder().setTransparent();

  var logo = slide.insertTextBox('FLATCHR', 28, 14, 180, 40);
  logo.getFill().setTransparent();
  logo.getBorder().setTransparent();
  var ls = logo.getText().getTextStyle();
  ls.setBold(true);
  ls.setFontSize(20);
  ls.setForegroundColor('#FFFFFF');

  var ttl = slide.insertTextBox('Recapitulatif de devis', 210, 18, 300, 30);
  ttl.getFill().setTransparent();
  ttl.getBorder().setTransparent();
  var ts = ttl.getText().getTextStyle();
  ts.setFontSize(13);
  ts.setForegroundColor('#AABBD4');

  var dbox = slide.insertTextBox(dateStr, 570, 22, 120, 24);
  dbox.getFill().setTransparent();
  dbox.getBorder().setTransparent();
  var ds = dbox.getText().getTextStyle();
  ds.setFontSize(10);
  ds.setForegroundColor('#7799BB');

  // ── Contenu : une seule grande zone de texte ──────────────────
  var lines = [];

  // Configuration
  lines.push('CONFIGURATION');
  lines.push('Effectif : ' + clean(data.effectifLabel) );
  lines.push('Compte : '   + clean(data.accountTypeLabel));
  lines.push('Pack : '     + clean(data.packLabel));
  if (data.optionsLabels && data.optionsLabels.length > 0) {
    lines.push('Options : ' + data.optionsLabels.map(clean).join(', '));
  }

  lines.push('');

  // Tarification
  lines.push('TARIFICATION HT');
  if (data.splitYears) {
    lines.push('Abonnement annuel (annee 2+) :  ' + fmtP(data.recurringYear2) + ' euros/an');
    if (data.tierYear1Saving > 0) {
      lines.push('Remise 1ere annee :  -' + fmtP(data.tierYear1Saving) + ' euros');
    }
    if (data.oneShotTotal > 0) {
      lines.push('Prestations one-shot :  ' + fmtP(data.oneShotTotal) + ' euros');
    }
    lines.push('TOTAL 1ere annee :  ' + fmtP(data.firstYearTotal) + ' euros');
    lines.push('Abonnement annuel (annee 2+) :  ' + fmtP(data.recurringYear2) + ' euros/an');
  } else {
    lines.push('Abonnement annuel :  ' + fmtP(data.recurringYear2) + ' euros/an');
    if (data.oneShotTotal > 0) {
      lines.push('Prestations :  ' + fmtP(data.oneShotTotal) + ' euros');
    }
    lines.push('TOTAL :  ' + fmtP(data.firstYearTotal) + ' euros');
  }
  lines.push('Duree :  ' + (data.monthsCount > 0
    ? data.extendedMonths + ' mois (' + data.monthsCount + ' offert' + (data.monthsCount > 1 ? 's' : '') + ')'
    : '12 mois renouvelable'));

  var content = slide.insertTextBox(lines.join('\n'), 36, 85, 648, 295);
  content.getFill().setTransparent();
  content.getBorder().setTransparent();
  var cs = content.getText().getTextStyle();
  cs.setFontSize(13);
  cs.setForegroundColor('#222222');

  // Footer
  var foot = slide.insertTextBox('Flatchr - Tous prix HT - Devis valable 30 jours - ' + dateStr, 36, 390, 648, 18);
  foot.getFill().setTransparent();
  foot.getBorder().setTransparent();
  var fs = foot.getText().getTextStyle();
  fs.setFontSize(8);
  fs.setForegroundColor('#AAAAAA');
}

function clean(s) {
  if (!s) return '-';
  // Remplace les caracteres speciaux typographiques par des equivalents ASCII
  return String(s)
    .replace(/—/g, '-')   // em dash
    .replace(/–/g, '-')   // en dash
    .replace(/·/g, '.')   // middle dot
    .replace(/’/g, "'")   // right single quote
    .replace(/‘/g, "'");  // left single quote
}

function fmtP(n) {
  if (!n) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
