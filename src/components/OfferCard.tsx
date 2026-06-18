import { useRef } from 'react';
import { Carousel, CarouselItem, ContentType, CONTENT_TYPE_LABELS, DetailRow } from '../types';

interface Props {
  carousel: Carousel;
  customPhotos: Record<string, string>;
  onCustomPhoto: (itemIdx: number, file: File) => void;
  onChange: (updated: Carousel) => void;
}

function field(label: string, value: string, onChange: (v: string) => void, type = 'text') {
  return (
    <div className="field-row" key={label}>
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PhotoUpload({ itemIdx, customPhotos, onCustomPhoto }: {
  itemIdx: number;
  customPhotos: Record<string, string>;
  onCustomPhoto: (i: number, f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const key = String(itemIdx);
  const hasPhoto = !!customPhotos[key];
  return (
    <div className="field-row" style={{ alignItems: 'center' }}>
      <label>Eigenes Foto</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {hasPhoto && (
          <img src={customPhotos[key]} alt="custom"
            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #D4AF37' }} />
        )}
        <button className="btn-outline" style={{ fontSize: '0.8em', padding: '4px 10px' }}
          onClick={() => ref.current?.click()}>
          {hasPhoto ? '🔄 Ersetzen' : '📷 Foto hochladen'}
        </button>
        <input ref={ref} type="file" accept="image/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onCustomPhoto(itemIdx, f); e.target.value = ''; }} />
      </div>
    </div>
  );
}

function RowEditor({ row, onChange, onRemove }: { row: DetailRow; onChange: (r: DetailRow) => void; onRemove: () => void; }) {
  return (
    <div className="field-row" style={{ gap: 6 }}>
      <input style={{ width: 44 }} value={row.icon} onChange={(e) => onChange({ ...row, icon: e.target.value })} placeholder="🔖" />
      <input style={{ flex: '0 0 120px' }} value={row.label} onChange={(e) => onChange({ ...row, label: e.target.value })} placeholder="Label" />
      <input style={{ flex: 1 }} value={row.value} onChange={(e) => onChange({ ...row, value: e.target.value })} placeholder="Wert" />
      <button className="btn-outline" style={{ fontSize: '0.8em', padding: '2px 8px' }} onClick={onRemove}>✕</button>
    </div>
  );
}

function ItemEditor({ item, itemIdx, customPhotos, onCustomPhoto, onChange }: {
  item: CarouselItem;
  itemIdx: number;
  customPhotos: Record<string, string>;
  onCustomPhoto: (i: number, f: File) => void;
  onChange: (it: CarouselItem) => void;
}) {
  const setRow = (i: number, r: DetailRow) => {
    const rows = [...item.rows]; rows[i] = r; onChange({ ...item, rows });
  };
  return (
    <div className="hotel-row">
      {field('Name', item.name, (v) => onChange({ ...item, name: v }))}
      {field('Untertitel (Ort / Route)', item.subtitle, (v) => onChange({ ...item, subtitle: v }))}
      {field('Sterne (0 = aus)', String(item.stars), (v) => onChange({ ...item, stars: Number(v) }), 'number')}
      {field('Preis (nur Zahl, leer = aus)', item.price, (v) => onChange({ ...item, price: v }))}
      {field('Bewertung % (0 = aus)', String(item.rating), (v) => onChange({ ...item, rating: Number(v) }), 'number')}
      <div style={{ marginTop: 8, marginBottom: 4, color: '#D4AF37', fontSize: '0.85em' }}>Detailzeilen</div>
      {item.rows.map((r, i) => (
        <RowEditor key={i} row={r} onChange={(nr) => setRow(i, nr)}
          onRemove={() => onChange({ ...item, rows: item.rows.filter((_, j) => j !== i) })} />
      ))}
      <button className="btn-outline" style={{ fontSize: '0.8em', padding: '4px 10px', marginTop: 4 }}
        onClick={() => onChange({ ...item, rows: [...item.rows, { icon: '•', label: '', value: '' }] })}>
        ➕ Zeile hinzufügen
      </button>
      <PhotoUpload itemIdx={itemIdx} customPhotos={customPhotos} onCustomPhoto={onCustomPhoto} />
    </div>
  );
}

export function OfferCard({ carousel, customPhotos, onCustomPhoto, onChange }: Props) {
  const isPost = carousel.type === 'post';
  return (
    <div className="offer-card">
      <div className="field-row">
        <label>Inhaltstyp</label>
        <select value={carousel.type}
          onChange={(e) => onChange({ ...carousel, type: e.target.value as ContentType })}
          style={{ padding: 6, background: '#001F3F', color: '#fff', border: '1px solid #D4AF37', borderRadius: 4 }}>
          {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((t) => (
            <option key={t} value={t}>{CONTENT_TYPE_LABELS[t]}</option>
          ))}
        </select>
      </div>
      {field('Destination / Thema', carousel.destination, (v) => onChange({ ...carousel, destination: v }))}
      {field('Headline', carousel.hookHeadline, (v) => onChange({ ...carousel, hookHeadline: v }))}
      {field('Tagline', carousel.hookTagline, (v) => onChange({ ...carousel, hookTagline: v }))}

      {isPost && (
        <div className="field-row">
          <label>Text (Post-Inhalt)</label>
          <textarea value={carousel.body ?? ''} rows={4}
            onChange={(e) => onChange({ ...carousel, body: e.target.value })}
            style={{ width: '100%', padding: 8, background: '#001F3F', color: '#fff', border: '1px solid #D4AF37', borderRadius: 4 }} />
        </div>
      )}

      {!isPost && (
        <>
          <h4 style={{ color: '#D4AF37', marginTop: 16 }}>Einträge ({carousel.items.length})</h4>
          {carousel.items.map((item, i) => (
            <ItemEditor key={i} item={item} itemIdx={i} customPhotos={customPhotos} onCustomPhoto={onCustomPhoto}
              onChange={(it) => { const items = [...carousel.items]; items[i] = it; onChange({ ...carousel, items }); }} />
          ))}
        </>
      )}
    </div>
  );
}
