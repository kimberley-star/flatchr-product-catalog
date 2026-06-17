/* ============================================================
 * Catalogue Produit Flatchr — Application principale
 * ============================================================ */
const { useState, useMemo, useEffect, useRef } = React;
const {
  EFFECTIF_TIERS, SOCLE_FEATURES, CONSOM_ITEMS,
  PACKS, CSM_PHASES, CSM_SERVICES,
  INTERNAL_OPTIONS, EXTERNAL_OPTIONS, NEGO_RULES
} = window.CATALOG_DATA;

// ─── Helpers ─────────────────────────────────────────────────
const formatEUR = (n) => {
  if (n === null || n === undefined) return 'Sur devis';
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
};

// ─── TopBar ──────────────────────────────────────────────────
const TopBar = () =>
<header className="topbar" data-screen-label="01 Topbar">
    <div className="topbar-left">
      <img src="assets/logo-flatchr.svg" alt="Flatchr" />
      <div className="crumb">
        <div>
          <div className="crumb-title">Catalogue Produit</div>
          <div className="crumb-sub">Sales & CSM · Édition 2026</div>
        </div>
      </div>
    </div>
    <div className="topbar-right">
      <button className="btn btn-ghost btn-sm">
        <span className="ico">file_download</span>Exporter en PDF
      </button>
      <a href="presentation.html" className="btn btn-primary">
        <span className="ico">slideshow</span>Présentation commerciale
      </a>
    </div>
  </header>;


// ─── Pricing Panel (sticky left) ─────────────────────────────
const PricingPanel = ({ state, actions }) => {
  const {
    effectifId, accountType, selectedPack, multiAccountQty,
    internal, external, discountValue, discountType, monthsOffered
  } = state;

  const effectif = EFFECTIF_TIERS.find((e) => e.id === effectifId);
  const pack = PACKS.find((p) => p.id === selectedPack);

  const soclePrice = effectif?.custom ? null : effectif?.price ?? 0;
  const packPrice = pack ?
  pack.id === 'multi' ? pack.price * (multiAccountQty || 1) : pack.price :
  0;
  const internalItems = INTERNAL_OPTIONS.filter((o) => internal.includes(o.id));
  const externalItems = EXTERNAL_OPTIONS.filter((o) => external.includes(o.id) && o.price !== null);
  const internalTotal = internalItems.reduce((sum, o) => sum + o.price, 0);
  const externalTotal = externalItems.reduce((sum, o) => sum + o.price, 0);

  const subtotal = (soclePrice ?? 0) + packPrice + internalTotal + externalTotal;
  const discountAmount = discountType === 'percent' ?
  Math.round(subtotal * (discountValue / 100)) :
  discountValue || 0;
  const monthsOfferedAmount = monthsOffered ? Math.round(subtotal / 2) : 0;
  const finalTotal = Math.max(0, subtotal - discountAmount - monthsOfferedAmount);

  const isCustom = effectif?.custom;

  return (
    <aside className="pricing-panel">
      <div className="pricing-header">
        <div className="eyebrow">Récapitulatif</div>
        <h2>Votre devis</h2>
      </div>

      <div className="pricing-body">
        {/* ─── Effectif ─── */}
        <div className="pricing-group">
          <div className="group-label">
            <span>Type de compte</span>
          </div>
          <div className="seg" style={{ width: '100%' }}>
            <button
              className={accountType === 'standard' ? 'active' : ''}
              style={{ flex: 1 }}
              onClick={() => actions.setAccountType('standard')}>
              Entreprise</button>
            <button
              className={accountType === 'cabinet' ? 'active' : ''}
              style={{ flex: 1 }}
              onClick={() => actions.setAccountType('cabinet')}>
              Cabinet</button>
          </div>
        </div>

        <div className="pricing-group">
          <div className="group-label">
            <span>{accountType === 'cabinet' ? 'Collaborateurs' : 'Effectif salariés'}</span>
          </div>
          <div className="effectif-grid">
            {EFFECTIF_TIERS.map((t) =>
            <button
              key={t.id}
              className={'effectif-chip' + (t.id === effectifId ? ' selected' : '')}
              onClick={() => actions.setEffectif(t.id)}>
              
                <span className="effectif-range">{accountType === 'cabinet' ? t.cabinet.replace(' collab.', '') : t.range}</span>
                <span className="effectif-price">{t.custom ? 'Sur devis' : formatEUR(t.price) + ' / an'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ─── Devis breakdown ─── */}
        <div className="pricing-group">
          <div className="group-label">
            <span>Détail du devis</span>
          </div>
          <div className="price-rows">
            <div className="price-row">
              <div className="label">
                <span className="ico" style={{ fontSize: 18, color: 'var(--color-primary-400)' }}>foundation</span>
                <div>
                  <div className="key">Socle fonctionnel</div>
                  <div className="meta">{effectif ? accountType === 'cabinet' ? effectif.cabinet : effectif.range : '—'}</div>
                </div>
              </div>
              <div className="value">{isCustom ? 'Sur devis' : formatEUR(soclePrice)}</div>
            </div>

            <div className="price-row muted">
              <div className="label">
                <span className="ico" style={{ fontSize: 18, color: 'var(--color-success-500)' }}>verified</span>
                <div>
                  <div className="key">Accompagnement CSM</div>
                  <div className="meta">Inclus dans le socle</div>
                </div>
              </div>
              <div className="value" style={{ color: 'var(--color-success-500)' }}>Inclus</div>
            </div>

            {pack &&
            <div className="price-row">
                <div className="label">
                  <span className="ico" style={{ fontSize: 18, color: 'var(--color-primary-400)' }}>{pack.icon}</span>
                  <div>
                    <div className="key">Pack {pack.name}</div>
                    <div className="meta">
                      {pack.id === 'multi' ?
                    `${multiAccountQty} compte${multiAccountQty > 1 ? 's' : ''} × ${formatEUR(pack.price)}` :
                    'Pack stratégique'}
                    </div>
                  </div>
                </div>
                <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {formatEUR(packPrice)}
                  <button className="remove-btn" onClick={() => actions.setPack(null)} aria-label="Retirer">
                    <span className="ico">close</span>
                  </button>
                </div>
              </div>
            }

            {internalItems.length === 0 && externalItems.length === 0 && !pack &&
            <div className="empty-state">
                Sélectionnez des packs et options dans le catalogue pour les ajouter au devis.
              </div>
            }

            {internalItems.map((o) =>
            <div key={o.id} className="price-row">
                <div className="label">
                  <span className="ico" style={{ fontSize: 18, color: 'var(--color-secondary-300)' }}>{o.icon}</span>
                  <div>
                    <div className="key">{o.name}</div>
                    <div className="meta">Catalogue interne</div>
                  </div>
                </div>
                <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {formatEUR(o.price)}
                  <button className="remove-btn" onClick={() => actions.toggleInternal(o.id)} aria-label="Retirer">
                    <span className="ico">close</span>
                  </button>
                </div>
              </div>
            )}

            {externalItems.map((o) =>
            <div key={o.id} className="price-row">
                <div className="label">
                  <span className="ico" style={{ fontSize: 18, color: 'var(--color-blue-400)' }}>{o.icon}</span>
                  <div>
                    <div className="key">{o.name}</div>
                    <div className="meta">{o.partner}</div>
                  </div>
                </div>
                <div className="value" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {formatEUR(o.price)}
                  <button className="remove-btn" onClick={() => actions.toggleExternal(o.id)} aria-label="Retirer">
                    <span className="ico">close</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Remise commerciale ─── */}
        <div className="pricing-group">
          <div className="group-label">
            <span>Remise commerciale</span>
            <span className="badge-mini">{discountType === 'percent' ? `Max ${discountValue}%` : formatEUR(discountValue)}</span>
          </div>
          <div className="discount-row">
            <div className="discount-input">
              <input
                type="number"
                value={discountValue}
                min={0}
                max={discountType === 'percent' ? 50 : subtotal}
                onChange={(e) => actions.setDiscountValue(Number(e.target.value))} />
              
              <span className="unit">{discountType === 'percent' ? '%' : '€'}</span>
            </div>
            <div className="seg">
              <button
                className={discountType === 'percent' ? 'active' : ''}
                onClick={() => {actions.setDiscountType('percent');actions.setDiscountValue(0);}}>
                %</button>
              <button
                className={discountType === 'euro' ? 'active' : ''}
                onClick={() => {actions.setDiscountType('euro');actions.setDiscountValue(0);}}>
                €</button>
            </div>
          </div>
          <div className="toggle-row">
            <div className="toggle-label">
              <div>6 premiers mois offerts</div>
              <div className="toggle-meta">−50 % de remise sur la 1ère année</div>
            </div>
            <div
              className={'switch' + (monthsOffered ? ' on' : '')}
              onClick={() => actions.setMonthsOffered(!monthsOffered)}
              role="switch"
              aria-checked={monthsOffered} />
            
          </div>
        </div>
      </div>

      <div className="pricing-footer">
        <div className="total-block">
          <div>
            <div className="total-label">Total annuel</div>
            <div className="total-value">
              {isCustom ?
              <>Sur devis</> :

              <>{new Intl.NumberFormat('fr-FR').format(finalTotal)}<span className="currency"> €</span></>
              }
            </div>
            <div className="total-period">{isCustom ? 'Contactez votre AE' : 'HT · Renouvelable annuellement'}</div>
          </div>
        </div>
        <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}>
          <span className="ico">description</span>Générer le devis
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
{ id: 'externe', label: 'Partenaires', icon: 'hub' },
{ id: 'consom', label: 'Usage', icon: 'speed' },
{ id: 'nego', label: 'Négociation', icon: 'gavel' }];


const SectionNav = ({ active, onJump }) =>
<nav className="section-nav">
    {SECTIONS.map((s) =>
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
        <div className="hero-card-content">
          <div>
            <div className="eyebrow">SOCLE FONCTIONNEL 2026</div>
            <h3>Tout le nécessaire<br />pour recruter sereinement</h3>
            <p className="desc">
              Emplacements illimités, Kanban, multidiffusion, Site Carrière Premium, IA intégrée, statistiques, viviers… Un seul socle pour tous, conçu pour scaler de 1 à 1000 collaborateurs.
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
            <div className="price">{effectif?.custom ? 'Sur devis' : new Intl.NumberFormat('fr-FR').format(effectif?.price) + ' €'}</div>
            <div className="price-sub">
              {effectif?.custom ?
              '+ 1000 salariés' :
              `Pour ${accountType === 'cabinet' ? effectif?.cabinet : effectif?.range} ${accountType === 'cabinet' ? '' : 'salariés'}`}
              <br />HT · Annuel
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
          <div className="label">Suivi annuel personnalisé</div>
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
            <h4>{p.title}</h4>
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
      onClick={() => onOpen(pack)}>
      
          <div className="pack-icon"><span className="ico">{pack.icon}</span></div>
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
            <div className="option-price">
              {formatEUR(o.price)} <span className="small">{o.priceUnit}</span>
            </div>
            <button
          className="option-toggle"
          onClick={(e) => {e.stopPropagation();onToggle(o.id);}}
          style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}>
          
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
          <div className={`partner-logo ${o.color}`} style={{
            background: `var(--color-${o.color === 'primary' ? 'primary-200' : o.color + '-200'})`,
            color: `var(--color-${o.color === 'primary' ? 'primary-500' : o.color + '-600'})`,
            marginBottom: 14
          }}>{o.initials}</div>
          <h4>{o.name}</h4>
          <p className="desc">{o.desc}</p>
          <div className="option-footer">
            <div className="option-price">
              {o.price === null ? <span style={{ color: 'var(--color-neutral-800)' }}>{o.priceUnit}</span> : <>{formatEUR(o.price)} <span className="small">{o.priceUnit}</span></>}
            </div>
            {!isComing &&
            <button
              className="option-toggle"
              onClick={(e) => {e.stopPropagation();if (o.price !== null) onToggle(o.id);}}
              style={{ border: 0, background: 'transparent', cursor: 'pointer', padding: 0 }}>
              
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
    sub="Certaines fonctionnalités avancées sont limitées par l'usage. Chaque client reçoit des crédits inclus, et peut acheter des crédits supplémentaires en cas de dépassement." />
  
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
            <span className="value" style={{ color: c.price === 'Inclus' ? 'var(--color-success-500)' : undefined }}>{c.price}</span>
          </div>
        </div>
    )}
    </div>
  </section>;


// ─── Négociation Section ─────────────────────────────────────
const NegoSection = () =>
<section className="section" id="nego" data-screen-label="08 Négociation">
    <SectionHead
    label="Cadre commercial"
    title="Règles de négociation 2026"
    sub="Les marges de manœuvre commerciales autorisées pour cadrer les exceptions et maintenir la lisibilité de l'offre." />
  
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
      <div className="nego-card">
        <h4><span className="ico">percent</span>Réduction prix</h4>
        {NEGO_RULES.reductions.map((r, i) => <div className="nego-item" key={i}>{r}</div>)}
      </div>
      <div className="nego-card">
        <h4><span className="ico">schedule</span>Aménagement temps</h4>
        {NEGO_RULES.temps.map((r, i) => <div className="nego-item" key={i}>{r}</div>)}
      </div>
      <div className="nego-card">
        <h4><span className="ico">card_giftcard</span>Prestations offertes</h4>
        {NEGO_RULES.prestations.map((r, i) => <div className="nego-item" key={i}>{r}</div>)}
      </div>
    </div>
  </section>;


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

        <div className="drawer-body">
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
                <li key={i}><span className="ico">{f.ico}</span>{f.label}</li>
                )}
                </ul>
              </div>
              <div className="section-block">
                <h4>IA intégrée de base</h4>
                <ul className="benefits-list">
                  <li><span className="ico">auto_awesome</span>Analyse Flatchr FIT — Scoring IA des candidatures</li>
                  <li><span className="ico">document_scanner</span>Parsing automatique des CV</li>
                  <li><span className="ico">sell</span>Remplissage automatique des tags</li>
                  <li><span className="ico">search</span>Recherche booléenne via prompt en langage naturel</li>
                </ul>
              </div>
            </>
          }

          {/* ─── CSM ─── */}
          {isCSM &&
          <>
              <div className="mockup" style={{
              background: 'linear-gradient(135deg, var(--color-primary-200) 0%, var(--color-primary-300) 100%)'
            }}>
                <span className="ico" style={{ color: 'var(--color-primary-600)' }}>support_agent</span>
                <div className="mockup-label">Votre CSM dédié</div>
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
                      <h4 style={{ margin: 0, marginBottom: 6, textTransform: 'none', letterSpacing: 0, fontSize: 16 }}>{p.title}</h4>
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
              <div className="mockup">
                <span className="ico">{data.icon}</span>
                <div className="mockup-label">Pack {data.name}</div>
              </div>
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
                <ul className="benefits-list">
                  {data.features.map((f, i) =>
                <li key={i}><span className="ico">{f.ico}</span>{f.label}</li>
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
              <div className="mockup" style={content.type === 'external' ? {
              background: `linear-gradient(135deg, var(--color-${data.color === 'primary' ? 'primary-200' : data.color + '-200'}) 0%, var(--color-${data.color === 'primary' ? 'primary-300' : data.color + '-400'}) 100%)`
            } : undefined}>
                <span className="ico" style={content.type === 'external' ? {
                color: `var(--color-${data.color === 'primary' ? 'primary-600' : data.color + '-600'})`,
                fontSize: 64
              } : undefined}>{data.icon}</span>
                <div className="mockup-label">Mockup · {data.name}</div>
              </div>

              <div className="drawer-tabs">
                <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}>Aperçu</button>
                <button className={tab === 'benefits' ? 'active' : ''} onClick={() => setTab('benefits')}>Bénéfices</button>
                <button className={tab === 'video' ? 'active' : ''} onClick={() => setTab('video')}>Vidéo</button>
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
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-neutral-800)' }}>Tarif</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-secondary-500)' }}>
                          {formatEUR(data.price)} <span style={{ fontSize: 13, color: 'var(--color-neutral-800)', fontWeight: 500 }}>{data.priceUnit}</span>
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-neutral-800)', lineHeight: 1.5 }}>{data.conditions}</p>
                    </div>
                  </div>
                </>
            }

              {tab === 'benefits' &&
            <div className="section-block">
                  <h4>Ce que cette option vous apporte</h4>
                  <ul className="benefits-list">
                    {data.benefits.map((b, i) =>
                <li key={i}><span className="ico">check_circle</span>{b}</li>
                )}
                  </ul>
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
              <div style={{ fontSize: 11, color: 'var(--color-neutral-800)', fontWeight: 600, letterSpacing: 0.04, textTransform: 'uppercase' }}>Tarif</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--color-secondary-500)' }}>
                {data.price === null ? 'Sur devis' : <>{formatEUR(data.price)} <span style={{ fontSize: 13, color: 'var(--color-neutral-800)', fontWeight: 500 }}>{data.priceUnit}</span></>}
              </div>
            </div>
            {data.price !== null &&
          <button
            className={'btn ' + (isSelected ? 'btn-tertiary' : 'btn-primary')}
            onClick={() => onToggleSelection()}>
            
                <span className="ico">{isSelected ? 'remove_circle_outline' : 'add_circle'}</span>
                {isSelected ? 'Retirer du devis' : 'Ajouter au devis'}
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

// ─── Main App ────────────────────────────────────────────────
const App = () => {
  // ─── State ─────────────────────────────────────────────────
  const [effectifId, setEffectifId] = useState('e2'); // 51-100 (most common)
  const [accountType, setAccountType] = useState('standard');
  const [selectedPack, setSelectedPack] = useState(null);
  const [multiAccountQty, setMultiAccountQty] = useState(5);
  const [internal, setInternal] = useState([]);
  const [external, setExternal] = useState([]);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState('percent');
  const [monthsOffered, setMonthsOffered] = useState(false);
  const [drawerContent, setDrawerContent] = useState(null);
  const [activeSection, setActiveSection] = useState('socle');

  // ─── Actions ───────────────────────────────────────────────
  const actions = {
    setEffectif: setEffectifId,
    setAccountType,
    setPack: setSelectedPack,
    toggleInternal: (id) => setInternal((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
    toggleExternal: (id) => setExternal((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]),
    setDiscountValue,
    setDiscountType,
    setMonthsOffered
  };

  const state = {
    effectifId, accountType, selectedPack, multiAccountQty,
    internal, external, discountValue, discountType, monthsOffered
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
      <TopBar />
      <div className="app-shell">
        <PricingPanel state={state} actions={actions} />
        <main className="content">
          <SectionNav active={activeSection} onJump={jumpToSection} />
          <SocleSection effectif={effectif} accountType={accountType} onOpen={openSocle} />
          <CSMSection onOpen={openCSM} />
          <PacksSection selectedPack={selectedPack} onSelect={setSelectedPack} onOpen={openPack} />
          <InternalSection selected={internal} onToggle={actions.toggleInternal} onOpen={openOption} />
          <ExternalSection selected={external} onToggle={actions.toggleExternal} onOpen={openOption} />
          <ConsomSection />
          <NegoSection />
        </main>
      </div>
      <Drawer
        content={drawerContent}
        onClose={closeDrawer}
        onToggleSelection={handleDrawerToggleSelection}
        isSelected={isDrawerSelected} />
      
    </>);

};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);