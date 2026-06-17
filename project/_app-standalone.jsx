/* ============================================================
 * Catalogue Produit Flatchr — Application principale
 * ============================================================ */
const { useState, useMemo, useEffect, useRef } = React;
const {
  EFFECTIF_TIERS, SOCLE_FEATURES, SOCLE_AI_FEATURES, CONSOM_ITEMS,
  PACKS, CSM_PHASES, CSM_SERVICES,
  INTERNAL_OPTIONS, EXTERNAL_OPTIONS, NEGO_RULES
} = window.CATALOG_DATA;

// ─── Helpers ─────────────────────────────────────────────────
const formatEUR = (n) => {
  if (n === null || n === undefined) return 'Sur devis';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
};
const fmtNum = (n) => new Intl.NumberFormat('fr-FR').format(n);

// ─── Quote engine (shared by config, summary & export) ───────
const computeQuote = (state) => {
  const {
    effectifId, accountType, selectedPack, multiAccountQty,
    internal, external, discountValue, discountType, monthsOffered,
    tierUpgrade, offeredPresta, assoc1901
  } = state;

  const effectif = EFFECTIF_TIERS.find((e) => e.id === effectifId);
  const pack = PACKS.find((p) => p.id === selectedPack);
  const isCustom = effectif?.custom;

  // Remise d'un cran : facturer le palier inférieur (moins cher)
  const tierIdx = EFFECTIF_TIERS.findIndex((t) => t.id === effectifId);
  const downgradeTier = tierIdx > 0 ? EFFECTIF_TIERS[tierIdx - 1] : null;
  const canUpgrade = !!effectif && !effectif.custom && downgradeTier && !downgradeTier.custom;
  const tierDiscountActive = tierUpgrade && canUpgrade;
  const downgradeSaving = canUpgrade ? effectif.price - downgradeTier.price : 0;
  const upgradePct = canUpgrade && effectif.price ? Math.round(downgradeSaving / effectif.price * 100) : 0;

  const fullSoclePrice = isCustom ? null : effectif?.price ?? 0;
  const soclePrice = isCustom ? null : tierDiscountActive ? downgradeTier.price : effectif?.price ?? 0;
  const packPrice = pack ? pack.id === 'multi' ? pack.price * (multiAccountQty || 1) : pack.price : 0;

  const internalItems = INTERNAL_OPTIONS.filter((o) => internal.includes(o.id));
  const externalItems = EXTERNAL_OPTIONS.filter((o) => external.includes(o.id) && o.price !== null);
  const oneShotTotal = internalItems.reduce((s, o) => s + o.price, 0);

  const offeredItems = INTERNAL_OPTIONS.filter((o) => (offeredPresta || []).includes(o.id));
  const offeredValue = offeredItems.reduce((s, o) => s + o.price, 0);

  // Abonnement récurrent (socle + pack). Partenaires = hors facturation.
  const recurringSubtotal = (soclePrice ?? 0) + packPrice;
  const pctDiscount = discountType === 'percent' ?
  Math.round(recurringSubtotal * ((discountValue || 0) / 100)) :
  discountValue || 0;
  const assoc1901Discount = assoc1901 ? Math.round(recurringSubtotal * 0.5) : 0;
  const discountAmount = pctDiscount + assoc1901Discount;
  const recurringYear2 = Math.max(0, recurringSubtotal - discountAmount);

  const monthsCount = Number(monthsOffered) || 0;
  const monthsOfferedAmount = monthsCount > 0 ? Math.round(recurringYear2 * monthsCount / 12) : 0;
  const firstYearRecurring = Math.max(0, recurringYear2 - monthsOfferedAmount);
  const firstYearTotal = firstYearRecurring + oneShotTotal;

  const gestureValue = offeredValue + (tierDiscountActive ? downgradeSaving : 0);
  const splitYears = monthsCount > 0 || oneShotTotal > 0;

  return {
    effectif, pack, isCustom, accountType, multiAccountQty,
    downgradeTier, canUpgrade, tierDiscountActive, downgradeSaving, upgradePct,
    fullSoclePrice, soclePrice, packPrice,
    internalItems, externalItems, oneShotTotal,
    offeredItems, offeredValue, gestureValue,
    recurringSubtotal, pctDiscount, assoc1901Discount, discountAmount,
    recurringYear2, monthsCount, monthsOfferedAmount, firstYearRecurring, firstYearTotal,
    splitYears, discountValue, discountType
  };
};

// ─── TopBar ──────────────────────────────────────────────────
const TopBar = ({ onExport }) =>
<header className="topbar" data-screen-label="01 Topbar">
    <div className="topbar-left">
      <img src={(window.__resources && window.__resources.logoFlatchr) || "assets/logo-flatchr.svg"} alt="Flatchr" />
      <div className="crumb">
        <div>
          <div className="crumb-title">Catalogue Produit</div>
          <div className="crumb-sub">Sales & CSM · Édition 2026</div>
        </div>
      </div>
    </div>
    <div className="topbar-right">
      <button className="btn btn-ghost btn-sm" onClick={onExport}>
        <span className="ico">file_download</span>Exporter en PDF
      </button>
      <a href="presentation.html" className="btn btn-primary" target="_blank" rel="noopener">
        <span className="ico">menu_book</span>Plaquette commerciale
      </a>
    </div>
  </header>;


// ─── Configuration Panel (left, hideable) ───────────────────
const ConfigPanel = ({ state, actions, collapsed }) => {
  const q = computeQuote(state);
  const { accountType, discountValue, discountType, monthsOffered, offeredPresta, tierUpgrade, assoc1901 } = state;
  const { effectif, canUpgrade, downgradeTier, tierDiscountActive, upgradePct, offeredItems, recurringSubtotal } = q;
  const [negoOpen, setNegoOpen] = useState(false);

  return (
    <aside className={'pricing-panel config-panel' + (collapsed ? ' collapsed' : '')}>
      <div className="pricing-header">
        <div className="eyebrow">Configuration</div>
        <h2>Composer l'offre</h2>
      </div>

      <div className="pricing-body">
        {/* Type de compte */}
        <div className="pricing-group">
          <div className="group-label"><span>Type de compte</span></div>
          <div className="seg" style={{ width: '100%' }}>
            <button className={accountType === 'standard' ? 'active' : ''} style={{ flex: 1 }} onClick={() => actions.setAccountType('standard')}>Entreprise</button>
            <button className={accountType === 'cabinet' ? 'active' : ''} style={{ flex: 1 }} onClick={() => actions.setAccountType('cabinet')}>Cabinet</button>
          </div>
        </div>

        {/* Effectif */}
        <div className="pricing-group">
          <div className="group-label"><span>{accountType === 'cabinet' ? 'Collaborateurs' : 'Effectif salariés'}</span></div>
          <div className="effectif-grid">
            {EFFECTIF_TIERS.map((t) =>
            <button key={t.id}
            className={'effectif-chip' + (t.id === state.effectifId ? ' selected' : '')}
            onClick={() => actions.setEffectif(t.id === state.effectifId ? null : t.id)}>
                <span className="effectif-range">{accountType === 'cabinet' ? t.cabinet.replace(' collab.', '') : t.range}</span>
                <span className="effectif-price">{t.custom ? 'Sur devis' : formatEUR(t.price) + ' / an'}</span>
              </button>
            )}
          </div>
          {!effectif &&
          <div className="effectif-hint">
              <span className="ico">info</span>
              Aucun socle sélectionné — utile si le client a déjà un abonnement Flatchr en cours.
            </div>
          }
        </div>

        {/* Remise commerciale */}
        <div className="pricing-group">
          <div className="group-label" data-comment-anchor="9bce4647d4-div-218-11">
            <span>Remise commerciale</span>
            <span className="badge-mini">{discountType === 'percent' ? 'Max ' + discountValue + '%' : formatEUR(discountValue)}</span>
          </div>
          <div className="discount-row">
            <div className="discount-input">
              <input type="number" value={discountValue} min={0}
              max={discountType === 'percent' ? 50 : recurringSubtotal}
              onChange={(e) => actions.setDiscountValue(Number(e.target.value))} />
              <span className="unit">{discountType === 'percent' ? '%' : '€'}</span>
            </div>
            <div className="seg">
              <button className={discountType === 'percent' ? 'active' : ''} onClick={() => {actions.setDiscountType('percent');actions.setDiscountValue(0);}}>%</button>
              <button className={discountType === 'euro' ? 'active' : ''} onClick={() => {actions.setDiscountType('euro');actions.setDiscountValue(0);}}>€</button>
            </div>
          </div>

          {/* Association loi 1901 */}
          <div className="toggle-row">
            <div className="toggle-label">
              <div>Association loi 1901</div>
              <div className="toggle-meta">−50 % sur l'abonnement annuel</div>
            </div>
            <div className={'switch' + (assoc1901 ? ' on' : '')} onClick={() => actions.setAssoc1901(!assoc1901)} role="switch" aria-checked={!!assoc1901} />
          </div>

          {/* Mois offerts */}
          <div className="months-block">
            <div className="months-head">
              <div>Premiers mois offerts</div>
              <div className="months-meta">{monthsOffered > 0 ? monthsOffered + ' mois offert' + (monthsOffered > 1 ? 's' : '') + ' sur la 1ère année' : 'Aucun mois offert'}</div>
            </div>
            <div className="months-chips">
              {[0, 1, 2, 3, 4, 5, 6].map((m) =>
              <button key={m} className={'months-chip' + (Number(monthsOffered) === m ? ' on' : '')} onClick={() => actions.setMonthsOffered(m)}>{m === 0 ? 'Aucun' : m}</button>
              )}
            </div>
          </div>

          {/* Remise d'un cran */}
          <div className="toggle-row" data-comment-anchor="2fe4ee6535-div-291-11">
            <div className="toggle-label">
              <div>Remise d'un cran d'effectif</div>
              <div className="toggle-meta" data-comment-anchor="b972bcd4f8-div-272-15">
                {canUpgrade ? 'Facturer le palier « ' + (accountType === 'cabinet' ? downgradeTier.cabinet : downgradeTier.range) + ' » : ' + formatEUR(downgradeTier.price) + ' au lieu de ' + formatEUR(effectif.price) + ' (−' + upgradePct + '%)' : 'Sélectionnez un effectif (au-dessus du 1er palier)'}
              </div>
            </div>
            <div className={'switch' + (tierDiscountActive ? ' on' : '')} onClick={() => canUpgrade && actions.setTierUpgrade(!tierUpgrade)} role="switch" aria-checked={tierDiscountActive} style={!canUpgrade ? { opacity: 0.35, pointerEvents: 'none' } : undefined} data-comment-anchor="cfe8e6e8d2-div-278-13" />
          </div>

          {/* Prestation offerte */}
          <div className="offered-block">
            <div className="offered-head">Prestation offerte</div>
            <div className="offered-meta">Offrez une prestation Flatchr dans le cadre de la négociation.</div>
            <div className="offered-chips">
              {INTERNAL_OPTIONS.filter((o) => ['atelier', 'site', 'imports'].includes(o.id)).map((o) =>
              <button key={o.id} className={'offered-chip' + ((offeredPresta || []).includes(o.id) ? ' on' : '')} onClick={() => actions.toggleOfferedPresta(o.id)}>
                  <span className="ico">{(offeredPresta || []).includes(o.id) ? 'check_circle' : 'add_circle_outline'}</span>
                  <span className="offered-chip-name">{o.name}</span>
                  <span className="offered-chip-price">{formatEUR(o.price)}</span>
                </button>
              )}
            </div>
            {offeredItems.length > 0 &&
            <div className="offered-summary">
                {offeredItems.map((o) =>
              <div key={o.id} className="offered-summary-row">
                    <div>
                      <div className="offered-summary-name">{o.name}</div>
                      <div className="offered-summary-desc">{o.desc}</div>
                    </div>
                    <div className="offered-summary-price">Offert <s>{formatEUR(o.price)}</s></div>
                  </div>
              )}
              </div>
            }
          </div>
        </div>

        {/* Négociation (collapsible) */}
        <div className="pricing-group nego-group">
          <button className={'nego-group-toggle' + (negoOpen ? ' open' : '')} onClick={() => setNegoOpen((v) => !v)} data-comment-anchor="34ac6d2422-h2-342-7">
            <span className="ico">gavel</span>
            <span className="nego-group-title">Règles de négociation 2026</span>
            <span className="ico nego-group-chevron">expand_more</span>
          </button>
          {negoOpen &&
          <div className="nego-rules">
              <div className="nego-rule-block">
                <h5><span className="ico">percent</span>Réduction prix</h5>
                {NEGO_RULES.reductions.map((r, i) => <div className="nego-rule-item" key={i}>{r}</div>)}
              </div>
              <div className="nego-rule-block">
                <h5><span className="ico">schedule</span>Aménagement temps</h5>
                {NEGO_RULES.temps.map((r, i) => <div className="nego-rule-item" key={i}>{r}</div>)}
              </div>
              <div className="nego-rule-block">
                <h5><span className="ico">card_giftcard</span>Prestations offertes</h5>
                {NEGO_RULES.prestations.map((r, i) => <div className="nego-rule-item" key={i}>{r}</div>)}
              </div>
              <div className="nego-rule-block">
                <h5><span className="ico">handshake</span>Justifications Sales</h5>
                <div className="nego-rule-hint">« On fait un prix parce que… » — leviers à mobiliser à la signature.</div>
                {NEGO_RULES.justifications_sales.map((r, i) => <div className="nego-rule-item" key={i}>{r}</div>)}
              </div>
              <div className="nego-rule-block">
                <h5><span className="ico">support_agent</span>Justifications CSM</h5>
                <div className="nego-rule-hint">Gestes possibles en cours de contrat, en contrepartie d'un engagement client.</div>
                {NEGO_RULES.justifications_csm.map((r, i) => <div className="nego-rule-item" key={i}>{r}</div>)}
              </div>
            </div>
          }
        </div>

        {/* Copie du total du devis */}
        <div className="pricing-group config-totals">
          <div className="group-label"><span>Total du devis</span></div>
          <QuoteTotals state={state} />
        </div>
      </div>
    </aside>);
};

// ─── Totals block (shared: summary footer + config panel) ───
const QuoteTotals = ({ state }) => {
  const {
    isCustom, oneShotTotal, recurringYear2, monthsCount,
    monthsOfferedAmount, firstYearTotal, splitYears
  } = computeQuote(state);
  return (
    <div className="total-block">
      <div>
        {isCustom ?
        <>
            <div className="total-label">Total annuel</div>
            <div className="total-value">Sur devis</div>
            <div className="total-period">Contactez votre AE</div>
          </> :
        <>
            <div className="total-line">
              <div><div className="line-label">Abonnement annuel</div><div className="line-meta">{monthsCount > 0 ? 'Dès la 2ème année · HT' : 'Récurrent · HT'}</div></div>
              <div className="line-value">{fmtNum(recurringYear2)}<span className="currency"> €</span></div>
            </div>
            {monthsCount > 0 &&
          <div className="total-line">
                <div><div className="line-label">{monthsCount} mois offert{monthsCount > 1 ? 's' : ''}</div><div className="line-meta">Sur la 1ère année</div></div>
                <div className="line-value" style={{ color: 'var(--color-success-600)' }}>−{fmtNum(monthsOfferedAmount)}<span className="currency"> €</span></div>
              </div>
          }
            {oneShotTotal > 0 &&
          <div className="total-line">
                <div><div className="line-label">Prestations supplémentaires</div><div className="line-meta">Non récurrent HT · 1ère année</div></div>
                <div className="line-value">{fmtNum(oneShotTotal)}<span className="currency"> €</span></div>
              </div>
          }
            <div className="total-divider" />
            <div className="total-label">{splitYears ? 'Total 1ère année' : 'Total annuel'}</div>
            <div className="total-value">{fmtNum(firstYearTotal)}<span className="currency"> €</span></div>
            <div className="total-period">{splitYears ? 'puis ' + fmtNum(recurringYear2) + ' € / an dès la 2ème année' : 'HT · Renouvelable annuellement'}</div>
          </>
        }
      </div>
    </div>);
};

// ─── Summary Card (sticky top-right) ─────────────────────────
const SummaryCard = ({ state, actions }) => {
  const q = computeQuote(state);
  const {
    effectif, pack, isCustom, accountType, multiAccountQty,
    tierDiscountActive, downgradeTier, fullSoclePrice, soclePrice, packPrice,
    internalItems, externalItems, oneShotTotal,
    recurringYear2, monthsCount, monthsOfferedAmount, firstYearTotal, splitYears
  } = q;

  return (
    <aside className="summary-card">
      <div className="summary-header">
        <div className="eyebrow">Récapitulatif</div>
        <h2>Votre proposition tarifaire</h2>
      </div>

      <div className="summary-body">
        <div className="price-rows">
          <div className="price-row">
            <div className="label">
              <span className="ico" style={{ fontSize: 18, color: 'var(--color-primary-400)' }}>foundation</span>
              <div>
                <div className="key">Socle fonctionnel</div>
                <div className="meta">{!effectif ? 'Non sélectionné' : tierDiscountActive ? 'Facturé « ' + (accountType === 'cabinet' ? downgradeTier.cabinet : downgradeTier.range) + ' » (cran inférieur)' : accountType === 'cabinet' ? effectif.cabinet : effectif.range}</div>
              </div>
            </div>
            <div className="value">
              {!effectif ? <span style={{ color: 'var(--color-neutral-700)' }}>—</span> :
              isCustom ? 'Sur devis' :
              tierDiscountActive ?
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                   <s style={{ fontSize: 11, color: 'var(--color-neutral-700)', fontWeight: 500 }}>{formatEUR(fullSoclePrice)}</s>
                   <span style={{ color: 'var(--color-success-600)' }}>{formatEUR(soclePrice)}</span>
                 </span> :
              formatEUR(soclePrice)}
            </div>
          </div>

          <div className="price-row muted">
            <div className="label">
              <span className="ico" style={{ fontSize: 18, color: 'var(--color-success-500)' }}>verified</span>
              <div><div className="key">Accompagnement CSM</div><div className="meta">Inclus dans le socle</div></div>
            </div>
            <div className="value" style={{ color: 'var(--color-success-500)' }}>Inclus</div>
          </div>

          {pack &&
          <div className="price-row">
              <div className="label">
                <span className="ico" style={{ fontSize: 18, color: 'var(--color-primary-400)' }}>{pack.icon}</span>
                <div><div className="key">Pack {pack.name}</div><div className="meta">{pack.id === 'multi' ? multiAccountQty + ' compte' + (multiAccountQty > 1 ? 's' : '') + ' × ' + formatEUR(pack.price) : 'Pack stratégique'}</div></div>
              </div>
              <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {formatEUR(packPrice)}
                <button className="remove-btn" onClick={() => actions.setPack(null)} aria-label="Retirer"><span className="ico">close</span></button>
              </div>
            </div>
          }

          {internalItems.length === 0 && externalItems.length === 0 && !pack && !effectif &&
          <div className="empty-state">Sélectionnez l'effectif, des packs et options pour composer le devis.</div>
          }

          {internalItems.map((o) =>
          <div key={o.id} className="price-row">
              <div className="label">
                <span className="ico" style={{ fontSize: 18, color: 'var(--color-secondary-300)' }}>{o.icon}</span>
                <div><div className="key">{o.name}</div><div className="meta">Achat ponctuel · 1ère année</div></div>
              </div>
              <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {formatEUR(o.price)}
                <button className="remove-btn" onClick={() => actions.toggleInternal(o.id)} aria-label="Retirer"><span className="ico">close</span></button>
              </div>
            </div>
          )}

          {externalItems.map((o) =>
          <div key={o.id} className="price-row">
              <div className="label">
                <span className="ico" style={{ fontSize: 18, color: 'var(--color-blue-400)' }}>{o.icon}</span>
                <div><div className="key">{o.name}</div><div className="meta">{o.partner} · mise en relation</div></div>
              </div>
              <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ color: 'var(--color-neutral-800)', fontSize: 12, fontWeight: 600 }}>Hors abonnement</span>
                <button className="remove-btn" onClick={() => actions.toggleExternal(o.id)} aria-label="Retirer"><span className="ico">close</span></button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="summary-footer">
        <QuoteTotals state={state} />
        <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }} data-comment-anchor="e7d965fb99-button-297-9" onClick={actions.openExport}>
          <span className="ico">description</span>Générer le récapitulatif
        </button>
      </div>
    </aside>);
};


// ─── Section Nav ─────────────────────────────────────────────
const SECTIONS = [
{ id: 'socle', label: 'Socle', icon: 'foundation' },
{ id: 'csm', label: 'CSM', icon: 'support_agent' },
{ id: 'packs', label: 'Packs', icon: 'inventory_2' },
{ id: 'interne', label: 'Options Flatchr', icon: 'extension' },
{ id: 'consom', label: 'Usage', icon: 'speed' },
{ id: 'externe', label: 'Partenaires', icon: 'hub' }];


const SectionNav = ({ active, onJump }) =>
<nav className="section-nav">
    {SECTIONS.filter((s) => s.id !== 'nego').map((s) =>
  <button
    key={s.id}
    className={'section-nav-item' + (active === s.id ? ' active' : '')}
    onClick={() => onJump(s.id)}>
    
        <span className="ico">{s.icon}</span>{s.label}
      </button>
  )}
  </nav>;


// ─── Section header helper ───────────────────────────────────
const SectionHead = ({ label, title, sub, action }) =>
<div className="section-head">
    <div>
      <div className="label">{label}</div>
      <h2>{title}</h2>
      {sub && <div className="sub">{sub}</div>}
    </div>
    {action}
  </div>;


// ─── Socle Section ───────────────────────────────────────────
const SocleSection = ({ effectif, accountType, onOpen }) => {
  const price = effectif?.custom ? 'Sur devis' : formatEUR(effectif?.price);
  return (
    <section className="section" id="socle" data-screen-label="02 Socle">
      <SectionHead
        label="Inclus pour tous les clients"
        title="Le socle fonctionnel Flatchr"
        sub="Identique pour tous, non négociable. Toutes les briques essentielles pour gérer vos recrutements de A à Z, avec l'IA Flatchr intégrée." />
      
      <div className="hero-card" onClick={onOpen}>
        <div className="hero-card-content" data-comment-anchor="c8e3d67159-div-360-9">
          <div className="hero-included-sticker" style={{ justifyContent: "center" }}>
            <span className="ico">verified</span>
            <div>
              <strong>Tout est inclus</strong>
              <span>Socle, IA, CSM, support</span>
            </div>
          </div>
          <div>
            <div className="eyebrow">SOCLE FONCTIONNEL 2026</div>
            <h3>Tout le nécessaire<br />pour recruter sereinement</h3>
            <p className="desc">Offres d'emploi publié illimités, Kanban, multidiffusion, Site Carrière, IA intégrée, statistiques, viviers… Un seul socle pour tous, conçu pour scaler de 1 à 1000 collaborateurs.

            </p>
            <div className="feature-chips">
              {SOCLE_FEATURES.slice(0, 6).map((f, i) =>
              <span className="chip" key={i}>
                  <span className="ico">{f.ico}</span>{f.label}
                </span>
              )}
              <span className="chip" style={{ background: 'hsla(188, 99%, 39%, 0.18)', borderColor: 'transparent' }}>
                + {SOCLE_FEATURES.length - 6} autres
              </span>
            </div>
            <div className="discover">
              Découvrir le détail du socle <span className="ico">arrow_forward</span>
            </div>
          </div>
          <div className="price-block">
            <div className="price-label">À partir de</div>
            <div className="price" data-comment-anchor="7f627041dd-div-376-13">
              {effectif?.custom ?
              'Sur devis' :
              effectif ?
              <>{new Intl.NumberFormat('fr-FR').format(effectif.price)} €<span className="price-unit"> / an</span></> :
              <>—</>}
            </div>
            <div className="price-sub">
              {effectif?.custom ?
              '+ 1000 salariés' :
              effectif ?
              `Pour ${accountType === 'cabinet' ? effectif.cabinet : effectif.range} ${accountType === 'cabinet' ? '' : 'salariés'}` :
              'Sélectionnez un effectif'}
              <br />
              {effectif?.custom ?
              'HT · Annuel' :
              effectif ?
              `HT · soit ${new Intl.NumberFormat('fr-FR').format(Math.round(effectif.price / 12))} € / mois` :
              ''}
            </div>
          </div>
        </div>
      </div>
    </section>);

};

// ─── CSM Section ─────────────────────────────────────────────
const CSMSection = ({ onOpen }) =>
<section className="section" id="csm" data-screen-label="03 CSM">
    <SectionHead
    label="Inclus dans le socle"
    title="Votre accompagnement CSM"
    sub="Un Customer Success Manager dédié à vos côtés toute l'année : kick-off, points de pilotage, ateliers, bilan annuel." />
  
    <div className="csm-card">
      <div className="csm-card-top">
        <div className="header-block">
          <div className="label" data-comment-anchor="b07a3145f1-div-521-11" style={{ color: "rgb(255, 255, 255)" }}>Suivi annuel personnalisé</div>
          <h3>3 phases pour maximiser votre ROI</h3>
          <p className="desc">
            Votre CSM vous accompagne sur l'année complète : structuration de votre setup, optimisation continue, puis bilan stratégique. Toujours inclus, jamais en option.
          </p>
        </div>
        <div className="badge-included">
          <span className="ico" style={{ fontSize: 14 }}>verified</span>Inclus
        </div>
      </div>

      <div className="csm-timeline">
        {CSM_PHASES.map((p) =>
      <div className="csm-phase" key={p.id}>
            <div className="csm-phase-num">{p.label}</div>
            <div className="csm-phase-period">{p.period}</div>
            <h4>{p.title}{p.titleMeta && <span className="csm-phase-meta"> ({p.titleMeta})</span>}</h4>
            <div className="desc">{p.desc}</div>
            <div className="actions">
              {p.actions.map((a, i) => <span className="pill" key={i}>{a}</span>)}
            </div>
          </div>
      )}
      </div>

      <button className="discover-link" onClick={onOpen} style={{ border: 0, background: 'transparent', padding: 0 }}>
        Découvrir tous les services CSM inclus <span className="ico">arrow_forward</span>
      </button>
    </div>
  </section>;


// ─── Packs Section ───────────────────────────────────────────
const PacksSection = ({ selectedPack, onSelect, onOpen }) =>
<section className="section" id="packs" data-screen-label="04 Packs">
    <SectionHead
    label="Modules optionnels"
    title="Packs stratégiques"
    sub="Trois directions pour accélérer : l'IA pour scaler, l'entreprise pour sécuriser, le multi-entités pour piloter." />
  
    <div className="packs-grid">
      {PACKS.map((pack) =>
    <div
      key={pack.id}
      className={`pack-card ${pack.color}${selectedPack === pack.id ? ' selected' : ''}`}
      onClick={() => onOpen(pack)} style={{ backgroundColor: "rgb(255, 255, 255)" }}>
      
          <div className="pack-icon" style={{ color: "rgb(255, 255, 255)", backgroundColor: "rgb(1, 155, 178)" }}><span className="ico">{pack.icon}</span></div>
          <h4>Pack {pack.name}</h4>
          <div className="pack-tagline">{pack.tagline}</div>
          <ul className="pack-features">
            {pack.features.slice(0, 4).map((f, i) =>
        <li key={i}><span className="ico">check_circle</span>{f.label}</li>
        )}
          </ul>
          <div className="pack-price">
            <div className="price">{formatEUR(pack.price)}</div>
            <div className="unit">{pack.priceUnit || '/ an'}</div>
          </div>
          <div className="pack-cta" onClick={(e) => {e.stopPropagation();onSelect(pack.id);}}>
            {selectedPack === pack.id ? '✓ Sélectionné' : 'Ajouter au devis'}
          </div>
        </div>
    )}
    </div>
  </section>;


// ─── Internal options Section ────────────────────────────────
const InternalSection = ({ selected, onToggle, onOpen }) =>
<section className="section" id="interne" data-screen-label="05 Catalogue interne">
    <SectionHead
    label="Catalogue Produit Interne"
    title="Prestations Flatchr"
    sub="Configurations sur-mesure, formations et services techniques réalisés par nos équipes pour accélérer votre mise en route et votre ROI." />
  
    <div className="options-grid">
      {INTERNAL_OPTIONS.map((o) =>
    <div
      key={o.id}
      className={'option-card' + (selected.includes(o.id) ? ' selected' : '')}
      onClick={() => onOpen(o, 'internal')}>
      
          <div className="check-mark"><span className="ico">check</span></div>
          <div className="icon-wrap"><span className="ico">{o.icon}</span></div>
          <h4>{o.name}</h4>
          <p className="desc">{o.desc}</p>
          <div className="option-footer">
            <div className="option-price" style={{ fontSize: "12px" }}>
              {formatEUR(o.price)} <span className="small" style={{ fontSize: "10px" }}>{o.priceUnit}</span>
            </div>
            <button
          className="option-toggle"
          onClick={(e) => {e.stopPropagation();onToggle(o.id);}}
          style={{ cursor: 'pointer' }}>
          
              {selected.includes(o.id) ? 'Retirer' : 'Ajouter'}
              <span className="ico">{selected.includes(o.id) ? 'remove_circle_outline' : 'add_circle_outline'}</span>
            </button>
          </div>
        </div>
    )}
    </div>
  </section>;


// ─── External options Section ────────────────────────────────
const ExternalSection = ({ selected, onToggle, onOpen }) =>
<section className="section" id="externe" data-screen-label="06 Catalogue externe">
    <SectionHead
    label="Catalogue Produit Externe"
    title="Partenaires intégrés"
    sub="Notre écosystème de partenaires triés sur le volet, directement branchés à Flatchr. Tarifs négociés, intégration native." />
  
    <div className="options-grid">
      {EXTERNAL_OPTIONS.map((o) => {
      const isComing = o.status === 'coming';
      return (
        <div
          key={o.id}
          className={'option-card partner' + (isComing ? ' coming' : '') + (selected.includes(o.id) ? ' selected' : '')}
          onClick={() => onOpen(o, 'external')}>
          
          {!isComing && <div className="check-mark"><span className="ico">check</span></div>}
          {o.status === 'new' && <div className="badge-corner"><span className="tag pink">Nouveau</span></div>}
          {isComing && <div className="badge-corner"><span className="tag neutral">À venir</span></div>}
          <PartnerLogo option={o} />
          <h4>{o.name}</h4>
          <p className="desc">{o.desc}</p>
          <div className="option-footer">
            <div className="option-price partner-cta">
              <span style={{ color: 'var(--color-neutral-800)', fontSize: 12, fontWeight: 600 }}>
                {o.price === null ? o.priceUnit : 'Mise en relation'}
              </span>
            </div>
            {!isComing &&
            <button
              className="option-toggle"
              onClick={(e) => {e.stopPropagation();if (o.price !== null) onToggle(o.id);}}
              style={{ cursor: 'pointer' }}>
              
                {o.price === null ? 'En savoir +' : selected.includes(o.id) ? 'Retirer' : 'Ajouter'}
                {o.price !== null && <span className="ico">{selected.includes(o.id) ? 'remove_circle_outline' : 'add_circle_outline'}</span>}
              </button>
            }
          </div>
        </div>);
    })}
    </div>
  </section>;


// ─── Consommation Section ─────────────────────────────────────
const ConsomSection = () =>
<section className="section" id="consom" data-screen-label="07 Usage">
    <SectionHead
    label="Consommation à l'usage"
    title="Crédits inclus & dépassement"
    sub="Certaines fonctionnalités avancées sont limitées par l'usage. Chaque client reçoit des crédits inclus, et peut acheter des crédits supplémentaires en cas de dépassement." data-comment-anchor="868b3c1de5-h2-335-7" />
  
    <div className="consom-grid">
      {CONSOM_ITEMS.map((c) =>
    <div className="consom-card" key={c.id}>
          <h4><span className="ico">{c.icon}</span>{c.label}</h4>
          <div className="consom-row included">
            <span className="label">Inclus socle</span>
            <span className="value">{c.included}</span>
          </div>
          <div className="consom-row">
            <span className="label">Dépassement</span>
            <span className="value">{c.extra}</span>
          </div>
          <div className="consom-row">
            <span className="label">Tarif crédit</span>
            <span className="value" style={{ ...{ color: c.price === 'Inclus' ? 'var(--color-success-500)' : undefined }, color: "rgb(43, 69, 94)" }}>{c.price}</span>
          </div>
        </div>
    )}
    </div>
  </section>;


// ─── Partner logo with fallback to initials ─────────────────
const PartnerLogo = ({ option, size }) => {
  const [errored, setErrored] = useState(false);
  if (option.noLogo) return null;
  const showImg = option.logoUrl && !errored;
  const dim = size || 48;
  return (
    <div className={`partner-logo ${option.color}`} style={{
      background: showImg ? '#fff' : `var(--color-${option.color === 'primary' ? 'primary-200' : option.color + '-200'})`,
      color: `var(--color-${option.color === 'primary' ? 'primary-500' : option.color + '-600'})`,
      width: dim,
      height: dim,
      marginBottom: 14
    }}>
      {showImg ?
      <img src={option.logoUrl} alt={option.partner} className="partner-logo-img" onError={() => setErrored(true)} /> :
      option.initials}
    </div>);

};

// ─── Pack feature expandable item ──────────────────────
const PackFeatureItem = ({ feature }) => {
  const [open, setOpen] = useState(false);
  const hasDetails = !!feature.details;
  return (
    <li className={'pack-feature-item' + (open ? ' open' : '') + (hasDetails ? ' expandable' : '')}>
      <button
        type="button"
        className="pack-feature-trigger"
        onClick={() => hasDetails && setOpen((v) => !v)}
        disabled={!hasDetails}>
        <span className="ico">{feature.ico}</span>
        <span className="pack-feature-label">{feature.label}</span>
        {hasDetails && <span className="ico pack-feature-chevron">expand_more</span>}
      </button>
      {hasDetails && open &&
      <div className="pack-feature-details">{feature.details}</div>
      }
    </li>);
};

// ─── Drawer ─────────────────────────────────────────────────
const Drawer = ({ content, onClose, onToggleSelection, isSelected }) => {
  const [tab, setTab] = useState('overview');
  useEffect(() => {setTab('overview');}, [content?.id]);

  const open = !!content;
  if (!content) return null;

  const isSocle = content.type === 'socle';
  const isCSM = content.type === 'csm';
  const isPack = content.type === 'pack';
  const isOption = content.type === 'internal' || content.type === 'external';

  const data = content.data;

  return (
    <>
      <div className={'drawer-backdrop' + (open ? ' open' : '')} onClick={onClose} />
      <div className={'drawer' + (open ? ' open' : '')} role="dialog" aria-modal="true">
        <div className="drawer-head">
          <div className="title-block">
            <div className="eyebrow">
              {isSocle && <><span className="ico" style={{ fontSize: 14 }}>foundation</span>Socle fonctionnel</>}
              {isCSM && <><span className="ico" style={{ fontSize: 14 }}>support_agent</span>Accompagnement CSM</>}
              {isPack && <><span className="ico" style={{ fontSize: 14 }}>{data.icon}</span>Pack stratégique</>}
              {content.type === 'internal' && <><span className="ico" style={{ fontSize: 14 }}>{data.icon}</span>Catalogue interne</>}
              {content.type === 'external' && <><span className="ico" style={{ fontSize: 14 }}>hub</span>{data.partner}</>}
            </div>
            <h3>
              {isSocle && 'Socle fonctionnel Flatchr'}
              {isCSM && 'Accompagnement CSM'}
              {(isPack || isOption) && data.name}
            </h3>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Fermer">
            <span className="ico">close</span>
          </button>
        </div>

        <div className="drawer-body" data-comment-anchor="61a4c0b05f-div-725-9">
          {/* ─── SOCLE ─── */}
          {isSocle &&
          <>
              <div className="mockup">
                <span className="ico">dashboard</span>
                <div className="mockup-label">Aperçu plateforme Flatchr</div>
              </div>
              <div className="section-block">
                <h4>Description</h4>
                <p className="desc-text">
                  Le socle fonctionnel est <strong>identique pour tous les clients</strong>, quel que soit leur secteur ou leur taille. Il contient toutes les briques essentielles pour gérer vos recrutements de A à Z, avec l'IA Flatchr intégrée nativement.
                </p>
                <p className="desc-text" style={{ marginTop: 8 }}>
                  Non négociable, non modifiable. C'est notre engagement de stabilité et de cohérence pour tous nos clients.
                </p>
              </div>
              <div className="section-block">
                <h4>Toutes les fonctionnalités incluses</h4>
                <ul className="benefits-list">
                  {SOCLE_FEATURES.map((f, i) =>
                <li key={i}>
                      <span className="ico">{f.ico}</span>
                      <span>{f.label}{f.roadmap && <span className="roadmap-pill"><span className="ico">schedule</span>En cours de dév.</span>}</span>
                    </li>
                )}
                </ul>
              </div>
              <div className="section-block">
                <h4>IA intégrée de base</h4>
                <ul className="benefits-list">
                  {SOCLE_AI_FEATURES.map((f, i) =>
                <li key={i}>
                      <span className="ico">{f.ico}</span>
                      <span>{f.label}{f.roadmap && <span className="roadmap-pill"><span className="ico">schedule</span>En cours de dév.{typeof f.roadmap === 'string' ? ' · ' + f.roadmap : ''}</span>}</span>
                    </li>
                )}
                </ul>
              </div>
            </>
          }

          {/* ─── CSM ─── */}
          {isCSM &&
          <>
              <div className="mockup mockup-photo">
                <img src={(window.__resources && window.__resources.csmPhoto) || "https://cdn-images.welcometothejungle.com/9U0xTGe1F1Z-ETfRV4KWmyaJcCbe3-p_0EyChPP10rk/rs:auto:1500::/q:85/czM6Ly93dHRqLXByb2R1Y3Rpb24vdXBsb2Fkcy9pbWFnZS9maWxlLzg1NTUvMTc2NTM1LzY2ZGRkNmE2LWZkZDEtNDA2Mi1hM2ZlLWE1ODZkMmY0NDg1ZS5qcGc"} alt="Équipes Flatchr" />
                <div className="mockup-label">Vos équipes CSM Flatchr</div>
              </div>
              <div className="section-block">
                <h4>Pourquoi un CSM dédié</h4>
                <p className="desc-text">
                  Votre CSM est votre interlocuteur unique chez Flatchr. Il connaît votre setup, vos enjeux, vos équipes. Il vous accompagne dans la durée pour faire de Flatchr un véritable levier de performance recrutement.
                </p>
              </div>
              <div className="section-block">
                <h4>Les 3 phases de l'année</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {CSM_PHASES.map((p) =>
                <div key={p.id} style={{
                  padding: 16,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--r-8)',
                  background: 'var(--color-neutral-50)'
                }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <strong style={{ fontSize: 14, color: 'var(--color-primary-500)' }}>{p.label} · {p.period}</strong>
                      </div>
                      <h4 style={{ margin: 0, marginBottom: 6, textTransform: 'none', letterSpacing: 0, fontSize: 16 }}>{p.title}{p.titleMeta && <span style={{ fontSize: 13, color: 'var(--color-neutral-800)', fontWeight: 500 }}> — {p.titleMeta}</span>}</h4>
                      <p style={{ margin: 0, fontSize: 13, color: 'var(--color-neutral-800)', lineHeight: 1.5 }}>{p.desc}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 10 }}>
                        {p.actions.map((a, i) => <span className="pill" key={i} style={{
                      fontSize: 11, fontWeight: 600, background: '#fff',
                      color: 'var(--color-secondary-500)', padding: '3px 8px',
                      borderRadius: 'var(--r-pill)', border: '1px solid var(--border-subtle)'
                    }}>{a}</span>)}
                      </div>
                    </div>
                )}
                </div>
              </div>
              <div className="section-block">
                <h4>Services inclus</h4>
                <ul className="benefits-list">
                  {CSM_SERVICES.map((s, i) =>
                <li key={i}><span className="ico">{s.ico}</span>{s.label}</li>
                )}
                </ul>
              </div>
            </>
          }

          {/* ─── PACK ─── */}
          {isPack &&
          <>
              <div className="section-block">
                <h4>Pour qui</h4>
                <ul className="benefits-list">
                  {data.target.map((t, i) =>
                <li key={i}><span className="ico">check_circle</span>{t}</li>
                )}
                </ul>
              </div>
              <div className="section-block">
                <h4>Ce qu'il contient</h4>
                <ul className="benefits-list pack-feature-list">
                  {data.features.map((f, i) =>
                <PackFeatureItem key={i} feature={f} />
                )}
                </ul>
              </div>
              <div className="section-block">
                <h4>Ce qu'il ne fait pas</h4>
                <ul className="benefits-list">
                  {data.limitations.map((l, i) =>
                <li key={i} style={{ color: 'var(--color-neutral-800)' }}>
                      <span className="ico" style={{ color: 'var(--color-neutral-700)' }}>info</span>{l}
                    </li>
                )}
                </ul>
              </div>
            </>
          }

          {/* ─── OPTION (internal or external) ─── */}
          {isOption &&
          <>

              <div className="drawer-tabs">
                <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Aperçu</button>
                <button className={tab === 'benefits' ? 'active' : ''} onClick={() => setTab('benefits')}>Bénéfices</button>
                {content.type !== 'external' && <button className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')}>Vidéo</button>}
              </div>

              {tab === 'overview' &&
            <>
                  <div className="section-block">
                    <h4>Description</h4>
                    <p className="desc-text">{data.longDesc}</p>
                  </div>
                  <div className="section-block">
                    <h4>Tarif & conditions</h4>
                    <div style={{
                  padding: 16,
                  background: 'var(--color-neutral-50)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--r-8)'
                }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-800)' }}>{content.type === 'external' ? 'Modalité' : 'Tarif'}</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: content.type === 'external' ? 16 : 22, fontWeight: 700, color: 'var(--color-secondary-500)' }}>
                          {content.type === 'external' ?
                      data.price === null ? data.priceUnit : 'Mise en relation partenaire' :
                      <>{formatEUR(data.price)} <span style={{ fontSize: 13, color: 'var(--color-neutral-800)', fontWeight: 500 }}>{data.priceUnit}</span></>}
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-800)', lineHeight: 1.5 }}>
                        {content.type === 'external' && data.price !== null ?
                    `Tarif négocié directement avec ${data.partner}. Flatchr facilite la mise en relation et l'intégration native, sans facturation supplémentaire.` :
                    data.conditions}
                      </p>
                    </div>
                  </div>
                </>
            }

              {tab === 'benefits' &&
            <div className="section-block">
                  <h4 data-comment-anchor="0dcbf00b5c-h4-836-19">Ce que cette option vous apporte</h4>
                  <ul className="benefits-list">
                    {data.benefits.map((b, i) =>
                <li key={i}><span className="ico">check_circle</span>{b}</li>
                )}
                  </ul>
                  {data.agencies &&
              <div className="agency-list">
                    <h4 style={{ marginTop: 4 }}>Notre réseau d'agences RH</h4>
                    <div className="agency-grid">
                      {data.agencies.map((a, i) =>
                  <a key={i} href={a.url} target="_blank" rel="noopener" className="agency-chip">
                          <span>{a.name}</span>
                          <span className="ico">open_in_new</span>
                        </a>
                  )}
                    </div>
                  </div>
              }
                </div>
            }

              {tab === 'video' &&
            <div className="section-block">
                  <div style={{
                background: 'var(--color-secondary-600)',
                borderRadius: 'var(--r-8)',
                aspectRatio: '16 / 9',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer'
              }}>
                    <div style={{
                  width: 72, height: 72, borderRadius: '50%',
                  background: 'rgba(255,255,255,0.95)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
                }}>
                      <span className="ico" style={{ fontSize: 36, color: 'var(--color-secondary-500)', marginLeft: 4 }}>play_arrow</span>
                    </div>
                    <div style={{ position: 'absolute', bottom: 16, left: 16, color: '#fff' }}>
                      <div style={{ fontSize: 11, opacity: 0.7, letterSpacing: 0.04, textTransform: 'uppercase', fontWeight: 600 }}>Démo produit</div>
                      <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{data.name} en 90 secondes</div>
                    </div>
                  </div>
                  <p className="desc-text" style={{ marginTop: 16 }}>
                    Vidéo de présentation de la fonctionnalité avec cas d'usage concret. À partager directement avec votre client en visio ou par lien.
                  </p>
                </div>
            }
            </>
          }
        </div>

        {/* ─── Drawer footer with action ─── */}
        {(isPack || isOption) &&
        <div className="drawer-foot">
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-neutral-800)', fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase' }}>{content.type === 'external' ? 'Modalité' : 'Tarif'}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-secondary-500)' }} data-comment-anchor="40d6dc4bad-div-883-15">
                {content.type === 'external' ?
              data.price === null ? 'Sur devis' : <span style={{ fontSize: 16 }}>Mise en relation</span> :
              data.price === null ? 'Sur devis' : <>{formatEUR(data.price)} <span style={{ fontSize: 13, color: 'var(--color-neutral-800)', fontWeight: 500 }}>{data.priceUnit}</span></>}
              </div>
            </div>
            {data.price !== null &&
          <button
            className={'btn ' + (isSelected ? 'btn-tertiary' : 'btn-primary')}
            onClick={() => onToggleSelection()}>
            
                <span className="ico">{isSelected ? 'remove_circle_outline' : 'add_circle'}</span>
                {isSelected ? 'Retirer du devis' : content.type === 'external' ? 'Ajouter à mon devis' : 'Ajouter au devis'}
              </button>
          }
          </div>
        }
        {(isSocle || isCSM) &&
        <div className="drawer-foot">
            <div>
              <div style={{ fontSize: 11, color: 'var(--color-success-600)', fontWeight: 700, letterSpacing: 0.04, textTransform: 'uppercase' }}>Inclus dans le socle</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 600, color: 'var(--color-secondary-500)' }}>
                Toujours, pour tous les clients
              </div>
            </div>
            <button className="btn btn-tertiary" onClick={onClose}>
              <span className="ico">close</span>Fermer
            </button>
          </div>
        }
      </div>
    </>);

};

// ─── Export Modal (récapitulatif imprimable) ─────────────────
const ExportModal = ({ open, onClose, state, effectif }) => {
  if (!open) return null;

  const { accountType, multiAccountQty, discountValue, discountType, monthsOffered } = state;
  const q = computeQuote(state);
  const {
    pack, isCustom, downgradeTier, tierDiscountActive, downgradeSaving, upgradePct,
    fullSoclePrice, soclePrice, packPrice, internalItems, externalItems, oneShotTotal,
    offeredItems, offeredValue, pctDiscount, assoc1901Discount, discountAmount,
    recurringYear2, monthsCount, monthsOfferedAmount, firstYearTotal, splitYears
  } = q;

  const today = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="export-overlay" role="dialog" aria-modal="true">
      <div className="export-toolbar no-print">
        <div className="export-toolbar-left">
          <span className="ico">description</span>
          <strong>Récapitulatif commercial</strong>
          <span className="export-toolbar-meta">Aperçu avant impression / export PDF</span>
        </div>
        <div className="export-toolbar-right">
          <button className="btn btn-tertiary btn-sm" onClick={onClose}>
            <span className="ico">close</span>Fermer
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => window.print()}>
            <span className="ico">picture_as_pdf</span>Enregistrer en PDF
          </button>
        </div>
      </div>

      <div className="export-scroll">
        <article className="export-doc" style={{ height: "2000px" }}>
          {/* ─── Header ─── */}
          <header className="exd-head">
            <div>
              <img src={(window.__resources && window.__resources.logoFlatchr) || "assets/logo-flatchr.svg"} alt="Flatchr" className="exd-logo" />
              <div className="exd-title">Récapitulatif commercial</div>
              <div className="exd-sub">Édition {new Date().getFullYear()} · Document non contractuel</div>
            </div>
            <div className="exd-meta">
              <div><span>Date</span><strong>{today}</strong></div>
              <div><span>Type de compte</span><strong>{accountType === 'cabinet' ? 'Cabinet' : 'Entreprise'}</strong></div>
              <div><span>{accountType === 'cabinet' ? 'Collaborateurs' : 'Effectif salariés'}</span>
                <strong>{accountType === 'cabinet' ? effectif?.cabinet : effectif?.range}</strong></div>
            </div>
          </header>

          {/* ─── Section : Socle ─── */}
          <section className="exd-section exd-included-section">
            <div className="exd-section-head">
              <h2>Socle fonctionnel Flatchr</h2>
              <div className="exd-tag">Inclus</div>
            </div>
            <p className="exd-lead">Toutes les briques essentielles pour gérer vos recrutements de A à Z, avec l'IA Flatchr intégrée.</p>
            <ul className="exd-feature-grid">
              {SOCLE_FEATURES.map((f, i) =>
              <li key={i}>
                  <span className="ico">{f.ico}</span>
                  <span>{f.label}{f.roadmap && <em> · en cours de dév.</em>}</span>
                </li>
              )}
            </ul>
          </section>

          {/* ─── Section : CSM ─── */}
          <section className="exd-section exd-included-section">
            <div className="exd-section-head">
              <h2>Accompagnement CSM</h2>
              <div className="exd-tag">Inclus</div>
            </div>
            <p className="exd-lead">Un Customer Success Manager dédié à vos côtés sur l’année complète : structuration, suivi régulier, bilan stratégique.</p>
          </section>

          {/* ─── Section : Pack ─── */}
          {pack &&
          <section className="exd-section">
              <div className="exd-section-head">
                <h2>Pack {pack.name}</h2>
                <div className="exd-tag exd-tag-primary">Sélectionné</div>
              </div>
              <p className="exd-lead">{pack.tagline}</p>
              <ul className="exd-feature-grid">
                {pack.features.map((f, i) =>
              <li key={i}><span className="ico">{f.ico}</span>{f.label}</li>
              )}
              </ul>
            </section>
          }

          {/* ─── Section : Prestations Flatchr ─── */}
          {internalItems.length > 0 &&
          <section className="exd-section">
              <div className="exd-section-head">
                <h2>Prestations Flatchr</h2>
                <div className="exd-tag exd-tag-primary">Achat ponctuel · 1ère année</div>
              </div>
              <div className="exd-list">
                {internalItems.map((o) =>
              <div className="exd-row" key={o.id} data-comment-anchor="3c43edf75b-div-1069-15">
                    <div className="exd-row-main">
                      <div className="exd-row-title">{o.name}</div>
                      <div className="exd-row-desc">{o.desc}</div>
                      <ul className="exd-row-benefits">
                        {o.benefits.map((b, i) =>
                    <li key={i}><span className="ico">check_circle</span>{b}</li>
                    )}
                      </ul>
                    </div>
                    <div className="exd-row-price">
                      {formatEUR(o.price)} <span>{o.priceUnit}</span>
                    </div>
                  </div>
              )}
              </div>
            </section>
          }

          {/* ─── Section : Partenaires ─── */}
          {externalItems.length > 0 &&
          <section className="exd-section">
              <div className="exd-section-head">
                <h2>Partenaires intégrés</h2>
                <div className="exd-tag exd-tag-primary">Mise en relation · hors facturation Flatchr</div>
              </div>
              <div className="exd-list">
                {externalItems.map((o) =>
              <div className="exd-row" key={o.id}>
                    <div>
                      <div className="exd-row-title">{o.name} <span className="exd-row-partner">· {o.partner}</span></div>
                      <div className="exd-row-desc">{o.desc}</div>
                    </div>
                    <div className="exd-row-price">
                      <span>Contrat partenaire</span>
                    </div>
                  </div>
              )}
              </div>
            </section>
          }

          {/* ─── Section : Récapitulatif tarifaire ─── */}
          <section className="exd-section exd-pricing">
            <div className="exd-section-head">
              <h2>Récapitulatif tarifaire</h2>
              <div className="exd-tag">HT</div>
            </div>

            {isCustom ?
            <div className="exd-custom">Sur devis — contactez votre Account Executive Flatchr.</div> :

            <>
                <table className="exd-table">
                  <tbody>
                    <tr>
                      <td>Socle fonctionnel</td>
                      <td className="exd-meta-cell">
                        {!effectif ? 'Non sélectionné · abonnement existant' :
                      tierDiscountActive ? `Facturé « ${accountType === 'cabinet' ? downgradeTier.cabinet : downgradeTier.range} » (cran inférieur)` :
                      accountType === 'cabinet' ? effectif?.cabinet : effectif?.range}
                      </td>
                      <td className="exd-amount">
                        {!effectif ? <span className="exd-included">—</span> :
                      tierDiscountActive ?
                      <><s style={{ color: 'var(--color-neutral-700)', fontWeight: 500, marginRight: 6 }}>{formatEUR(fullSoclePrice)}</s>{formatEUR(soclePrice)} <span>/ an</span></> :
                      <>{formatEUR(soclePrice)} <span>/ an</span></>}
                      </td>
                    </tr>
                    {tierDiscountActive &&
                  <tr className="exd-discount-row">
                        <td>Remise d'un cran d'effectif</td>
                        <td className="exd-meta-cell">Palier inférieur facturé (−{upgradePct}%)</td>
                        <td className="exd-amount exd-negative">− {formatEUR(downgradeSaving)}</td>
                      </tr>
                  }
                    <tr>
                      <td>Accompagnement CSM</td>
                      <td className="exd-meta-cell">Inclus dans le socle</td>
                      <td className="exd-amount exd-included">Inclus</td>
                    </tr>
                    {pack &&
                  <tr>
                        <td>Pack {pack.name}</td>
                        <td className="exd-meta-cell">
                          {pack.id === 'multi' ? `${multiAccountQty} × ${formatEUR(pack.price)}` : 'Pack stratégique'}
                        </td>
                        <td className="exd-amount">{formatEUR(packPrice)} <span>/ an</span></td>
                      </tr>
                  }
                    {externalItems.map((o) =>
                  <tr key={'r-' + o.id}>
                        <td>{o.name}</td>
                        <td className="exd-meta-cell">{o.partner} · mise en relation</td>
                        <td className="exd-amount exd-included">Hors abonnement</td>
                      </tr>
                  )}
                    {pctDiscount > 0 &&
                  <tr className="exd-discount-row">
                        <td>Remise commerciale</td>
                        <td className="exd-meta-cell">{discountType === 'percent' ? `${discountValue} %` : formatEUR(discountValue)}</td>
                        <td className="exd-amount exd-negative">− {formatEUR(pctDiscount)}</td>
                      </tr>
                  }
                    {assoc1901Discount > 0 &&
                  <tr className="exd-discount-row">
                        <td>Réduction association loi 1901</td>
                        <td className="exd-meta-cell">−50 % sur l'abonnement</td>
                        <td className="exd-amount exd-negative">− {formatEUR(assoc1901Discount)}</td>
                      </tr>
                  }
                    <tr className="exd-subtotal">
                      <td colSpan={2}>Abonnement annuel{splitYears ? ' · dès la 2ème année' : ''}</td>
                      <td className="exd-amount">{formatEUR(recurringYear2)} <span>/ an</span></td>
                    </tr>
                    {monthsCount > 0 &&
                  <tr className="exd-discount-row">
                        <td>{monthsCount} premier{monthsCount > 1 ? 's' : ''} mois offert{monthsCount > 1 ? 's' : ''}</td>
                        <td className="exd-meta-cell">Sur la 1ère année</td>
                        <td className="exd-amount exd-negative">− {formatEUR(monthsOfferedAmount)}</td>
                      </tr>
                  }
                    {internalItems.map((o) =>
                  <tr key={'o-' + o.id}>
                        <td>{o.name}</td>
                        <td className="exd-meta-cell">Achat ponctuel · {o.priceUnit}</td>
                        <td className="exd-amount">{formatEUR(o.price)}</td>
                      </tr>
                  )}
                    {oneShotTotal > 0 &&
                  <tr className="exd-subtotal">
                        <td colSpan={2}>Prestations 1ère année (non récurrent)</td>
                        <td className="exd-amount">{formatEUR(oneShotTotal)}</td>
                      </tr>
                  }
                  </tbody>
                </table>

                <div className="exd-totals">
                  <div className="exd-total-line">
                    <span>{splitYears ? 'Total 1ère année' : 'Total'}</span>
                    <strong>{formatEUR(firstYearTotal)}</strong>
                  </div>
                  {splitYears &&
                <div className="exd-total-line muted">
                      <span>puis dès la 2ème année</span>
                      <strong>{formatEUR(recurringYear2)} / an</strong>
                    </div>
                }
                </div>
              </>
            }
          </section>

          {/* ─── Section : Gestes commerciaux (prestations offertes) ─── */}
          {offeredItems.length > 0 &&
          <section className="exd-section">
              <div className="exd-section-head">
                <h2>Prestations offertes</h2>
                <div className="exd-tag exd-tag-primary">Valeur offerte · {formatEUR(offeredValue)}</div>
              </div>
              <div className="exd-list">
                {offeredItems.map((o) =>
              <div className="exd-row" key={'gift-' + o.id}>
                    <div className="exd-row-main">
                      <div className="exd-row-title">{o.name}</div>
                      <div className="exd-row-desc">{o.desc}</div>
                    </div>
                    <div className="exd-row-price">Offert <span>valeur {formatEUR(o.price)}</span></div>
                  </div>
              )}
              </div>
            </section>
          }

          {/* ─── Footer ─── */}
          <footer className="exd-footer">
            <div>
              Tarifs HT · Document non contractuel · Valable 30 jours à compter de la date d'édition.
            </div>
            <div>Flatchr · Catalogue Produit 2026</div>
          </footer>
        </article>
      </div>
    </div>);

};


const App = () => {
  // ─── State ─────────────────────────────────────────────────
  const [effectifId, setEffectifId] = useState(null); // Aucun socle par défaut
  const [accountType, setAccountType] = useState('standard');
  const [selectedPack, setSelectedPack] = useState(null);
  const [multiAccountQty, setMultiAccountQty] = useState(5);
  const [internal, setInternal] = useState([]);
  const [external, setExternal] = useState([]);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState('percent');
  const [monthsOffered, setMonthsOffered] = useState(0);
  const [drawerContent, setDrawerContent] = useState(null);
  const [activeSection, setActiveSection] = useState('socle');
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [exportOpen, setExportOpen] = useState(false);
  const [tierUpgrade, setTierUpgrade] = useState(false);
  const [offeredPresta, setOfferedPresta] = useState([]);
  const [assoc1901, setAssoc1901] = useState(false);

  // ─── Actions ───────────────────────────────────────────────
  const actions = {
    setEffectif: setEffectifId,
    setAccountType,
    setPack: setSelectedPack,
    toggleInternal: (id) => setInternal((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
    toggleExternal: (id) => setExternal((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
    setDiscountValue,
    setDiscountType,
    setMonthsOffered,
    setTierUpgrade,
    setAssoc1901,
    toggleOfferedPresta: (id) => setOfferedPresta((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
    openExport: () => setExportOpen(true)
  };

  const state = {
    effectifId, accountType, selectedPack, multiAccountQty,
    internal, external, discountValue, discountType, monthsOffered,
    tierUpgrade, offeredPresta, assoc1901
  };

  const effectif = EFFECTIF_TIERS.find((e) => e.id === effectifId);

  // ─── Section scroll spy ───────────────────────────────────
  useEffect(() => {
    const handler = () => {
      const scrollTop = window.scrollY;
      for (let i = SECTIONS.length - 1; i >= 0; i--) {
        const el = document.getElementById(SECTIONS[i].id);
        if (el && el.getBoundingClientRect().top < 200) {
          setActiveSection(SECTIONS[i].id);
          return;
        }
      }
    };
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const jumpToSection = (id) => {
    const el = document.getElementById(id);
    if (el) window.scrollTo({ top: el.offsetTop - 100, behavior: 'smooth' });
  };

  // ─── Drawer handlers ──────────────────────────────────────
  const openSocle = () => setDrawerContent({ type: 'socle', id: 'socle' });
  const openCSM = () => setDrawerContent({ type: 'csm', id: 'csm' });
  const openPack = (pack) => setDrawerContent({ type: 'pack', id: pack.id, data: pack });
  const openOption = (option, type) => setDrawerContent({ type, id: option.id, data: option });
  const closeDrawer = () => setDrawerContent(null);

  const handleDrawerToggleSelection = () => {
    if (!drawerContent) return;
    if (drawerContent.type === 'pack') {
      setSelectedPack(selectedPack === drawerContent.id ? null : drawerContent.id);
    } else if (drawerContent.type === 'internal') {
      actions.toggleInternal(drawerContent.id);
    } else if (drawerContent.type === 'external') {
      actions.toggleExternal(drawerContent.id);
    }
  };

  const isDrawerSelected = drawerContent ?
  drawerContent.type === 'pack' ? selectedPack === drawerContent.id :
  drawerContent.type === 'internal' ? internal.includes(drawerContent.id) :
  drawerContent.type === 'external' ? external.includes(drawerContent.id) : false :
  false;

  return (
    <>
      <TopBar onExport={() => setExportOpen(true)} />
      <ConfigPanel state={state} actions={actions} collapsed={panelCollapsed} />
      <div className={'app-shell' + (panelCollapsed ? ' panel-collapsed' : '')}>
        <main className="content">
          <SectionNav active={activeSection} onJump={jumpToSection} />
          <SocleSection effectif={effectif} accountType={accountType} onOpen={openSocle} />
          <CSMSection onOpen={openCSM} />
          <PacksSection selectedPack={selectedPack} onSelect={setSelectedPack} onOpen={openPack} />
          <InternalSection selected={internal} onToggle={actions.toggleInternal} onOpen={openOption} />
          <ConsomSection />
          <ExternalSection selected={external} onToggle={actions.toggleExternal} onOpen={openOption} />
        </main>
        <SummaryCard state={state} actions={actions} />
      </div>
      <button
        className="panel-toggle"
        onClick={() => setPanelCollapsed((v) => !v)}
        aria-label={panelCollapsed ? 'Afficher la configuration' : 'Masquer la configuration'}
        title={panelCollapsed ? "Configurer l'offre" : 'Masquer la configuration'} style={{ textAlign: "center", width: "35px", height: "77px" }}>
        <span className="ico panel-toggle-chevron">chevron_right</span>
      </button>
      <Drawer
        content={drawerContent}
        onClose={closeDrawer}
        onToggleSelection={handleDrawerToggleSelection}
        isSelected={isDrawerSelected} />
      
      <ExportModal
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        state={state}
        effectif={effectif} />
    </>);

};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);