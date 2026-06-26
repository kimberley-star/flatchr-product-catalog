// ============================================================
// Catalogue Produit Flatchr — Google Apps Script  VERSION 4
// ============================================================

var TEMPLATE_ID = '1cfJ6niqBmTtSihNdNnKwIdweT3OZUaeCIStQ4eslFMY';

function doGet(e) {
  var log = ['=== VERSION 4 - API REST ==='];
  var fileId = null, fileUrl = null;
  try {
    if (!e.parameter || !e.parameter.data) throw new Error('Parametre data manquant.');
    var data = JSON.parse(e.parameter.data);
    log.push('Data OK: ' + data.effectifLabel + ' / ' + data.packLabel);

    var result = generatePresentation(data, log);
    fileId = result.id;
    fileUrl = result.url;

    return HtmlService.createHtmlOutput(
      '<html><head>' +
      '<style>body{font-family:sans-serif;background:#f0f4ff;padding:40px}' +
      'pre{background:#f8f8f8;padding:12px;border-radius:4px;font-size:12px;white-space:pre-wrap}' +
      '.v{display:inline-block;background:green;color:#fff;padding:4px 12px;border-radius:4px;font-weight:bold;margin-bottom:16px}' +
      'a.btn{display:inline-block;background:#0a2e5c;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px}' +
      '</style></head><body>' +
      '<span class="v">VERSION 4</span>' +
      '<h2 style="color:#0a2e5c">Plaquette prete !</h2>' +
      '<p><a class="btn" href="' + fileUrl + '">&#9654; Ouvrir la presentation</a></p>' +
      '<hr style="margin:24px 0"><p style="color:#666;font-size:13px"><b>Log :</b></p>' +
      '<pre>' + log.join('\n') + '</pre>' +
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
  var today = new Date();
  var dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), 'dd/MM/yyyy');

  var templateFile = DriveApp.getFileById(TEMPLATE_ID);
  var copy = templateFile.makeCopy('Plaquette Flatchr - ' + dateStr);
  var fileId = copy.getId();
  log.push('Copie creee: ' + fileId);

  // Ouvrir via SlidesApp pour s'assurer que le scope est present
  var pres = SlidesApp.openById(fileId);
  log.push('Slides actuelles: ' + pres.getSlides().length);

  // Ajouter la slide via API REST (controle total du style)
  addSummarySlideViaAPI(fileId, data, dateStr, log);

  try {
    copy.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    log.push('Partage OK');
  } catch (e) {
    log.push('Partage impossible: ' + e.message);
  }

  return { id: fileId, url: 'https://docs.google.com/presentation/d/' + fileId + '/edit' };
}

function addSummarySlideViaAPI(fileId, data, dateStr, log) {
  var token = ScriptApp.getOAuthToken();
  var apiBase = 'https://slides.googleapis.com/v1/presentations/' + fileId;
  var authHeader = { 'Authorization': 'Bearer ' + token };

  // Recuperer la presentation pour connaitre le nombre de slides
  var getResp = UrlFetchApp.fetch(apiBase, { headers: authHeader, muteHttpExceptions: true });
  if (getResp.getResponseCode() !== 200) {
    throw new Error('Impossible de lire la presentation: HTTP ' + getResp.getResponseCode() + ' - ' + getResp.getContentText().substring(0, 200));
  }
  var presData = JSON.parse(getResp.getContentText());
  var numSlides = presData.slides ? presData.slides.length : 0;
  log.push('Slides existantes: ' + numSlides);

  var ts = new Date().getTime().toString();
  var slideId   = 'slide_' + ts;
  var hdrRectId = 'hdr_' + ts;
  var logoId    = 'logo_' + ts;
  var ttlId     = 'ttl_' + ts;
  var dateId    = 'dat_' + ts;

  var requests = [];

  // 1. Creer la slide BLANK
  requests.push({
    createSlide: {
      objectId: slideId,
      insertionIndex: numSlides,
      slideLayoutReference: { predefinedLayout: 'BLANK' }
    }
  });

  // 2. Fond blanc
  requests.push({
    updatePageProperties: {
      objectId: slideId,
      pageProperties: {
        pageBackgroundFill: {
          solidFill: { color: { rgbColor: { red: 1, green: 1, blue: 1 } } }
        }
      },
      fields: 'pageBackgroundFill'
    }
  });

  // 3. Rectangle header bleu
  requests.push({
    createShape: {
      objectId: hdrRectId,
      shapeType: 'RECTANGLE',
      elementProperties: {
        pageObjectId: slideId,
        size: { width: { magnitude: 720, unit: 'PT' }, height: { magnitude: 68, unit: 'PT' } },
        transform: { scaleX: 1, scaleY: 1, translateX: 0, translateY: 0, unit: 'PT' }
      }
    }
  });
  requests.push({
    updateShapeProperties: {
      objectId: hdrRectId,
      shapeProperties: {
        shapeBackgroundFill: {
          solidFill: { color: { rgbColor: { red: 0.039, green: 0.180, blue: 0.361 } } }
        },
        outline: { propertyState: 'NOT_RENDERED' }
      },
      fields: 'shapeBackgroundFill,outline'
    }
  });

  // 4. Logo FLATCHR
  requests.push({
    createShape: {
      objectId: logoId,
      shapeType: 'TEXT_BOX',
      elementProperties: {
        pageObjectId: slideId,
        size: { width: { magnitude: 180, unit: 'PT' }, height: { magnitude: 40, unit: 'PT' } },
        transform: { scaleX: 1, scaleY: 1, translateX: 28, translateY: 14, unit: 'PT' }
      }
    }
  });
  requests.push({ insertText: { objectId: logoId, insertionIndex: 0, text: 'FLATCHR' } });
  requests.push({
    updateTextStyle: {
      objectId: logoId,
      style: {
        bold: true,
        fontSize: { magnitude: 20, unit: 'PT' },
        foregroundColor: { opaqueColor: { rgbColor: { red: 1, green: 1, blue: 1 } } }
      },
      textRange: { type: 'ALL' },
      fields: 'bold,fontSize,foregroundColor'
    }
  });

  // 5. Titre
  requests.push({
    createShape: {
      objectId: ttlId,
      shapeType: 'TEXT_BOX',
      elementProperties: {
        pageObjectId: slideId,
        size: { width: { magnitude: 300, unit: 'PT' }, height: { magnitude: 30, unit: 'PT' } },
        transform: { scaleX: 1, scaleY: 1, translateX: 210, translateY: 19, unit: 'PT' }
      }
    }
  });
  requests.push({ insertText: { objectId: ttlId, insertionIndex: 0, text: 'Recapitulatif de devis' } });
  requests.push({
    updateTextStyle: {
      objectId: ttlId,
      style: {
        fontSize: { magnitude: 13, unit: 'PT' },
        foregroundColor: { opaqueColor: { rgbColor: { red: 0.667, green: 0.733, blue: 0.831 } } }
      },
      textRange: { type: 'ALL' },
      fields: 'fontSize,foregroundColor'
    }
  });

  // 6. Date
  requests.push({
    createShape: {
      objectId: dateId,
      shapeType: 'TEXT_BOX',
      elementProperties: {
        pageObjectId: slideId,
        size: { width: { magnitude: 120, unit: 'PT' }, height: { magnitude: 24, unit: 'PT' } },
        transform: { scaleX: 1, scaleY: 1, translateX: 570, translateY: 23, unit: 'PT' }
      }
    }
  });
  requests.push({ insertText: { objectId: dateId, insertionIndex: 0, text: dateStr } });
  requests.push({
    updateTextStyle: {
      objectId: dateId,
      style: {
        fontSize: { magnitude: 10, unit: 'PT' },
        foregroundColor: { opaqueColor: { rgbColor: { red: 0.467, green: 0.600, blue: 0.733 } } }
      },
      textRange: { type: 'ALL' },
      fields: 'fontSize,foregroundColor'
    }
  });

  // 7. Lignes de contenu
  var rows = buildRows(data);
  log.push('Lignes contenu: ' + rows.length);
  var yPos = 82;

  for (var r = 0; r < rows.length; r++) {
    var label = rows[r][0];
    var value = rows[r][1];

    if (!label && !value) {
      yPos += 10;
      continue;
    }

    var isTotal = label.indexOf('TOTAL') === 0;
    var fSize   = isTotal ? 12 : 11;
    var isBold  = isTotal;
    var rgb     = isTotal
      ? { red: 0.039, green: 0.180, blue: 0.361 }
      : { red: 0.15, green: 0.15, blue: 0.15 };

    var lId = 'l' + ts + '_' + r;
    var vId = 'v' + ts + '_' + r;

    // Colonne gauche (libelle)
    requests.push({
      createShape: {
        objectId: lId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 370, unit: 'PT' }, height: { magnitude: 24, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 36, translateY: yPos, unit: 'PT' }
        }
      }
    });
    requests.push({ insertText: { objectId: lId, insertionIndex: 0, text: label } });
    requests.push({
      updateTextStyle: {
        objectId: lId,
        style: { bold: isBold, fontSize: { magnitude: fSize, unit: 'PT' }, foregroundColor: { opaqueColor: { rgbColor: rgb } } },
        textRange: { type: 'ALL' },
        fields: 'bold,fontSize,foregroundColor'
      }
    });

    // Colonne droite (valeur)
    requests.push({
      createShape: {
        objectId: vId,
        shapeType: 'TEXT_BOX',
        elementProperties: {
          pageObjectId: slideId,
          size: { width: { magnitude: 270, unit: 'PT' }, height: { magnitude: 24, unit: 'PT' } },
          transform: { scaleX: 1, scaleY: 1, translateX: 414, translateY: yPos, unit: 'PT' }
        }
      }
    });
    requests.push({ insertText: { objectId: vId, insertionIndex: 0, text: value } });
    requests.push({
      updateTextStyle: {
        objectId: vId,
        style: { bold: isBold, fontSize: { magnitude: fSize, unit: 'PT' }, foregroundColor: { opaqueColor: { rgbColor: rgb } } },
        textRange: { type: 'ALL' },
        fields: 'bold,fontSize,foregroundColor'
      }
    });
    requests.push({
      updateParagraphStyle: {
        objectId: vId,
        style: { alignment: 'END' },
        textRange: { type: 'ALL' },
        fields: 'alignment'
      }
    });

    yPos += 26;
  }

  log.push('Requetes API: ' + requests.length);

  var resp = UrlFetchApp.fetch(apiBase + ':batchUpdate', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    payload: JSON.stringify({ requests: requests }),
    muteHttpExceptions: true
  });

  var code = resp.getResponseCode();
  log.push('batchUpdate HTTP: ' + code);

  if (code !== 200) {
    var body = resp.getContentText();
    log.push('Erreur API: ' + body.substring(0, 600));
    throw new Error('Slides API batchUpdate echoue: HTTP ' + code);
  }

  log.push('Slide ajoutee avec succes via REST API!');
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
    .replace(/‘/g, "'")
    .replace(/’/g, "'");
}

function fmtP(n) {
  if (!n) return '0';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
}
