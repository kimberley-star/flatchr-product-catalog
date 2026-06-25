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
//    - Qui a accès : Tous (anonyme)
// 5. Cliquez sur "Déployer" et autorisez les permissions demandées
// 6. Copiez l'URL de déploiement (finit par /exec)
// 7. Collez cette URL dans la constante APPS_SCRIPT_URL de index.html
// ============================================================

const TEMPLATE_ID = '1cfJ6niqBmTtSihNdNnKwIdweT3OZUaeCIStQ4eslFMY';

function doGet(e) {
  try {
    const data = JSON.parse(e.parameter.data);
    const url = generatePresentation(data);
    return HtmlService.createHtmlOutput(
      '<html><head>' +
      '<meta http-equiv="refresh" content="1;url=' + url + '">' +
      '<style>body{font-family:sans-serif;background:#f0f4ff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}' +
      '.box{background:#fff;border-radius:12px;padding:40px 48px;text-align:center;box-shadow:0 4px 24px rgba(0,0,0,.1)}' +
      'h2{color:#0a2e5c;margin:0 0 12px}p{color:#666;margin:0 0 20px}a{color:#0a2e5c;font-weight:600}</style>' +
      '</head><body><div class="box">' +
      '<h2>Génération en cours...</h2>' +
      '<p>Votre plaquette est prête, redirection automatique dans 1 seconde.</p>' +
      '<a href="' + url + '" target="_self">Ouvrir la présentation &rarr;</a>' +
      '</div></body></html>'
    );
  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<html><body style="font-family:sans-serif;padding:40px">' +
      '<h2 style="color:red">Erreur</h2><pre>' + err.message + '</pre></body></html>'
    );
  }
}

function generatePresentation(data) {
  const templateFile = DriveApp.getFileById(TEMPLATE_ID);
  const today = new Date();
  const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  const copyName = 'Plaquette Flatchr · ' + (data.effectifLabel || '') + ' · ' + dateStr;

  const copy = templateFile.makeCopy(copyName);
  const presentation = SlidesApp.openById(copy.getId());

  addSummarySlide(presentation, data, dateStr);
  presentation.saveAndClose();

  copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return 'https://docs.google.com/presentation/d/' + copy.getId() + '/edit';
}

function addSummarySlide(presentation, data, dateStr) {
  const W = presentation.getPageWidth();
  const H = presentation.getPageHeight();

  // Append a blank slide at the end
  const slide = presentation.appendSlide(SlidesApp.PredefinedLayout.BLANK);
  slide.getBackground().setSolidFill('#FFFFFF');

  // ── Header bar ──────────────────────────────────────────────
  const header = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, 0, 0, W, 72);
  header.getFill().setSolidFill('#0A2E5C');
  header.getBorder().setTransparent();

  const logoBox = slide.insertTextBox('FLATCHR', 28, 16, 160, 40);
  styleText(logoBox, '#FFFFFF', 20, true, false);
  logoBox.getFill().setTransparent();
  logoBox.getBorder().setTransparent();

  const titleBox = slide.insertTextBox('Récapitulatif de devis', W / 2 - 180, 20, 360, 32);
  styleText(titleBox, '#B8C8E8', 14, false, true);
  titleBox.getFill().setTransparent();
  titleBox.getBorder().setTransparent();

  const dateBox = slide.insertTextBox(dateStr, W - 160, 25, 140, 24);
  styleText(dateBox, '#8899BB', 11, false, false);
  dateBox.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.RIGHT);
  dateBox.getFill().setTransparent();
  dateBox.getBorder().setTransparent();

  // ── Content layout ──────────────────────────────────────────
  var y = 90;
  var mx = 36;
  var colLabel = W * 0.60;
  var colValue = W - mx - colLabel - mx;
  var rowH = 30;
  var gap = 10;

  // Section: Configuration
  y = addSectionHeader(slide, 'Configuration', mx, y, W - mx * 2) + gap;

  var configRows = [
    ['Effectif', data.effectifLabel || '—'],
    ['Type de compte', data.accountTypeLabel || '—'],
    ['Pack sélectionné', data.packLabel || 'Socle seul'],
  ];
  if (data.optionsLabels && data.optionsLabels.length > 0) {
    configRows.push(['Options', data.optionsLabels.join(', ')]);
  }

  configRows.forEach(function(row) {
    addRow(slide, row[0], row[1], mx, y, colLabel, colValue, rowH, false);
    y += rowH + 4;
  });

  y += gap;
  addDivider(slide, mx, y, W - mx * 2);
  y += 14;

  // Section: Tarification
  y = addSectionHeader(slide, 'Tarification HT', mx, y, W - mx * 2) + gap;

  var pricingRows = [];

  if (data.splitYears) {
    pricingRows.push(['Abonnement annuel (dès la 2ème année)', fmtPrice(data.recurringYear2) + ' € / an']);
    if (data.tierYear1Saving > 0) {
      pricingRows.push(['Remise 1ère année (effectif)', '−' + fmtPrice(data.tierYear1Saving) + ' €']);
    }
    if (data.oneShotTotal > 0) {
      pricingRows.push(['Prestations one-shot', fmtPrice(data.oneShotTotal) + ' €']);
    }
    pricingRows.push(['TOTAL 1ère année', fmtPrice(data.firstYearTotal) + ' €']);
    pricingRows.push(['Puis dès la 2ème année', fmtPrice(data.recurringYear2) + ' € / an']);
  } else {
    pricingRows.push(['Abonnement annuel', fmtPrice(data.recurringYear2) + ' € / an']);
    if (data.oneShotTotal > 0) {
      pricingRows.push(['Prestations one-shot', fmtPrice(data.oneShotTotal) + ' €']);
    }
    pricingRows.push(['TOTAL', fmtPrice(data.firstYearTotal) + ' €']);
  }

  if (data.monthsCount > 0) {
    pricingRows.push(['Durée du contrat', data.extendedMonths + ' mois (' + data.monthsCount + ' offert' + (data.monthsCount > 1 ? 's' : '') + ')']);
  } else {
    pricingRows.push(['Durée du contrat', '12 mois · renouvelable annuellement']);
  }

  pricingRows.forEach(function(row) {
    var isTotal = row[0].indexOf('TOTAL') === 0;
    addRow(slide, row[0], row[1], mx, y, colLabel, colValue, rowH, isTotal);
    y += rowH + (isTotal ? 6 : 4);
  });

  // ── Footer ──────────────────────────────────────────────────
  var footerY = H - 36;
  var footer = slide.insertTextBox(
    'Flatchr · Tous prix HT · Devis valable 30 jours · ' + dateStr,
    mx, footerY, W - mx * 2, 22
  );
  styleText(footer, '#AAAAAA', 9, false, false);
  footer.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  footer.getFill().setTransparent();
  footer.getBorder().setTransparent();
}

// ── Helpers ────────────────────────────────────────────────────

function fmtPrice(n) {
  if (!n) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}

function styleText(box, color, size, bold, center) {
  var style = box.getText().getTextStyle();
  style.setForegroundColor(color).setFontSize(size).setBold(bold || false);
  if (center) {
    box.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.CENTER);
  }
}

function addSectionHeader(slide, text, x, y, w) {
  var box = slide.insertTextBox(text.toUpperCase(), x, y, w, 24);
  var style = box.getText().getTextStyle();
  style.setBold(true).setFontSize(9).setForegroundColor('#6688BB');
  box.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.LEFT);
  box.getFill().setTransparent();
  box.getBorder().setTransparent();
  return y + 24;
}

function addDivider(slide, x, y, w) {
  var line = slide.insertLine(
    SlidesApp.LineCategory.STRAIGHT,
    {left: x, top: y}, {left: x + w, top: y}
  );
  line.getLineFill().setSolidFill('#E0E8F0');
}

function addRow(slide, label, value, x, y, colLabel, colValue, h, isTotal) {
  if (isTotal) {
    var bg = slide.insertShape(SlidesApp.ShapeType.RECTANGLE, x - 8, y - 3, colLabel + colValue + 16, h + 6);
    bg.getFill().setSolidFill('#EEF3FF');
    bg.getBorder().setTransparent();
  }

  var lBox = slide.insertTextBox(label, x, y, colLabel, h);
  lBox.getFill().setTransparent();
  lBox.getBorder().setTransparent();
  lBox.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  var lStyle = lBox.getText().getTextStyle();
  lStyle.setFontSize(isTotal ? 12 : 11).setBold(isTotal).setForegroundColor(isTotal ? '#0A2E5C' : '#444444');

  var vBox = slide.insertTextBox(value, x + colLabel, y, colValue, h);
  vBox.getFill().setTransparent();
  vBox.getBorder().setTransparent();
  vBox.setContentAlignment(SlidesApp.ContentAlignment.MIDDLE);
  vBox.getText().getParagraphStyle().setParagraphAlignment(SlidesApp.ParagraphAlignment.RIGHT);
  var vStyle = vBox.getText().getTextStyle();
  vStyle.setFontSize(isTotal ? 13 : 11).setBold(isTotal).setForegroundColor(isTotal ? '#0A2E5C' : '#222222');
}
