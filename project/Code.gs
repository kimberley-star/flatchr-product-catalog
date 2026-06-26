// ============================================================
// Catalogue Produit Flatchr — Google Apps Script
// ============================================================

var TEMPLATE_ID = '1cfJ6niqBmTtSihNdNnKwIdweT3OZUaeCIStQ4eslFMY';

function doGet(e) {
  var log = [];
  var fileId = null, fileUrl = null;
  try {
    if (!e.parameter || !e.parameter.data) throw new Error('Parametre data manquant.');
    var data = JSON.parse(e.parameter.data);
    log.push('Data parsed OK');
    var result = generatePresentation(data, log);
    fileId = result.id;
    fileUrl = result.url;
    return HtmlService.createHtmlOutput(
      '<html><head><meta http-equiv="refresh" content="3;url=' + fileUrl + '">' +
      '<style>body{font-family:sans-serif;background:#f0f4ff;padding:40px} pre{background:#f8f8f8;padding:12px;border-radius:4px;font-size:12px}</style>' +
      '</head><body>' +
      '<h2 style="color:#0a2e5c">Plaquette prete !</h2>' +
      '<p>Redirection dans 3 secondes...</p>' +
      '<p><a href="' + fileUrl + '" style="color:#0a2e5c;font-weight:bold">Ouvrir la presentation</a></p>' +
      '<details><summary style="cursor:pointer;color:#666">Debug log</summary><pre>' + log.join('\n') + '</pre></details>' +
      '</body></html>'
    );
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif;padding:40px">' +
      '<h2 style="color:red">Erreur: ' + err.message + '</h2>' +
      '<pre>' + (err.stack || '') + '</pre>' +
      '<pre>' + log.join('\n') + '</pre>' +
      (fileUrl ? '<p><a href="' + fileUrl + '">Ouvrir quand meme</a></p>' : '') +
      '</body></html>'
    );
  }
}

function generatePresentation(data, log) {
  var templateFile = DriveApp.getFileById(TEMPLATE_ID);
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  log.push('Template found');

  var copy = templateFile.makeCopy('Plaquette Flatchr - ' + dateStr);
  var fileId = copy.getId();
  log.push('Copy created: ' + fileId);

  var presentation = SlidesApp.openById(fileId);
  log.push('Presentation opened, slides: ' + presentation.getSlides().length);

  try {
    addSummarySlide(presentation, data, dateStr, log);
    log.push('addSummarySlide completed OK');
  } catch (err) {
    log.push('ERROR in addSummarySlide: ' + err.message);
    log.push(err.stack || '');
  }

  presentation.saveAndClose();
  log.push('Saved and closed');

  try {
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    log.push('Sharing set');
  } catch (e) {
    log.push('Sharing failed: ' + e.message);
  }

  return { id: fileId, url: 'https://docs.google.com/presentation/d/' + fileId + '/edit' };
}

function addSummarySlide(presentation, data, dateStr, log) {
  log.push('Appending slide...');
  var slide = presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  log.push('Slide appended');

  slide.getBackground().setSolidFill('#FFFFFF');
  log.push('Background white set');

  // Header bar
  var hdr = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, 720, 68);
  hdr.getFill().setSolidFill('#0A2E5C');
  hdr.getBorder().setTransparent();
  log.push('Header rect done');

  var logo = slide.insertTextBox('FLATCHR', 28, 14, 180, 40);
  logo.getFill().setTransparent();
  logo.getBorder().setTransparent();
  logo.getText().getTextStyle().setBold(true);
  logo.getText().getTextStyle().setFontSize(20);
  logo.getText().getTextStyle().setForegroundColor('#FFFFFF');
  log.push('Logo done');

  var ttl = slide.insertTextBox('Recapitulatif de devis', 210, 18, 300, 30);
  ttl.getFill().setTransparent();
  ttl.getBorder().setTransparent();
  ttl.getText().getTextStyle().setFontSize(13);
  ttl.getText().getTextStyle().setForegroundColor('#AABBD4');
  log.push('Title done');

  var dbox = slide.insertTextBox(dateStr, 570, 22, 120, 24);
  dbox.getFill().setTransparent();
  dbox.getBorder().setTransparent();
  dbox.getText().getTextStyle().setFontSize(10);
  dbox.getText().getTextStyle().setForegroundColor('#7799BB');
  log.push('Date done');

  // Build rows
  log.push('Building rows...');
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

  log.push('Rows built: ' + rows.length);

  var numRows = rows.length;
  var rowH = 28;
  var tableH = numRows * rowH;
  log.push('Table dims: ' + numRows + ' rows x 2 cols, left=36 top=82 w=648 h=' + tableH);

  var table = slide.insertTable(numRows, 2, 36, 82, 648, tableH);
  log.push('Table object created');

  for (var r = 0; r < numRows; r++) {
    try {
      var cellL = table.getCell(r, 0);
      var cellR = table.getCell(r, 1);

      cellL.getText().setText(rows[r][0]);
      if (rows[r][0]) {
        cellL.getText().getTextStyle().setForegroundColor('#111111');
        cellL.getText().getTextStyle().setFontSize(11);
      }

      cellR.getText().setText(rows[r][1]);
      if (rows[r][1]) {
        cellR.getText().getTextStyle().setForegroundColor('#111111');
        cellR.getText().getTextStyle().setFontSize(11);
        cellR.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.END);
      }

      log.push('Row ' + r + ' OK: [' + rows[r][0] + '] | [' + rows[r][1] + ']');
    } catch (rowErr) {
      log.push('Row ' + r + ' FAILED: ' + rowErr.message);
    }
  }

  log.push('All rows done');
}

function clean(s) {
  if (!s) return '-';
  return String(s)
    .replace(/—/g, '-')
    .replace(/–/g, '-')
    .replace(/·/g, '.')
    .replace(/‘/g, "'")
    .replace(/’/g, "'");
}

function fmtP(n) {
  if (!n) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
