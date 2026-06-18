import { useRef } from 'react';
import { Offer, Hotel } from '../types';

interface Props {
  offer: Offer;
  offerIdx: number;
  customPhotos: Record<string, string>;
  onCustomPhoto: (offerIdx: number, hotelIdx: number, file: File) => void;
  onChange: (updated: Offer) => void;
}

function field(label: string, value: string, onChange: (v: string) => void, type = 'text') {
  return (
    <div className="field-row" key={label}>
      <label>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function PhotoUpload({ offerIdx, hotelIdx, customPhotos, onCustomPhoto }: {
  offerIdx: number;
  hotelIdx: number;
  customPhotos: Record<string, string>;
  onCustomPhoto: (o: number, h: number, f: File) => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const key = `${offerIdx}_${hotelIdx}`;
  const hasPhoto = !!customPhotos[key];

  return (
    <div className="field-row" style={{ alignItems: 'center' }}>
      <label>Eigenes Foto</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {hasPhoto && (
          <img
            src={customPhotos[key]}
            alt="custom"
            style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 4, border: '1px solid #D4AF37' }}
          />
        )}
        <button
          className="btn-outline"
          style={{ fontSize: '0.8em', padding: '4px 10px' }}
          onClick={() => ref.current?.click()}
        >
          {hasPhoto ? '🔄 Ersetzen' : '📷 Foto hochladen'}
        </button>
        <input
          ref={ref}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onCustomPhoto(offerIdx, hotelIdx, file);
            e.target.value = '';
          }}
        />
      </div>
    </div>
  );
}

function HotelRow({ hotel, offerIdx, hotelIdx, customPhotos, onCustomPhoto, onChange }: {
  hotel: Hotel;
  offerIdx: number;
  hotelIdx: number;
  customPhotos: Record<string, string>;
  onCustomPhoto: (o: number, h: number, f: File) => void;
  onChange: (h: Hotel) => void;
}) {
  return (
    <div className="hotel-row">
      {field('Name', hotel.name, (v) => onChange({ ...hotel, name: v }))}
      {field('Ort (Stadt - Gebiet)', hotel.location, (v) => onChange({ ...hotel, location: v }))}
      {field('Sterne', String(hotel.stars), (v) => onChange({ ...hotel, stars: Number(v) }), 'number')}
      {field('Preis (nur Zahl)', hotel.price, (v) => onChange({ ...hotel, price: v }))}
      {field('Reisedatum von', hotel.dateFrom, (v) => onChange({ ...hotel, dateFrom: v }))}
      {field('Reisedatum bis', hotel.dateTo, (v) => onChange({ ...hotel, dateTo: v }))}
      {field('Hinflug (Abflugort)', hotel.airportDeparture, (v) => onChange({ ...hotel, airportDeparture: v }))}
      {field('Rückflug (Flughafen)', hotel.airportReturn, (v) => onChange({ ...hotel, airportReturn: v }))}
      {field('Verpflegung', hotel.mealPlan, (v) => onChange({ ...hotel, mealPlan: v }))}
      {field('Transfer', hotel.transfer, (v) => onChange({ ...hotel, transfer: v }))}
      {field('Bewertung (%)', String(hotel.rating), (v) => onChange({ ...hotel, rating: Number(v) }), 'number')}
      <PhotoUpload
        offerIdx={offerIdx}
        hotelIdx={hotelIdx}
        customPhotos={customPhotos}
        onCustomPhoto={onCustomPhoto}
      />
    </div>
  );
}

export function OfferCard({ offer, offerIdx, customPhotos, onCustomPhoto, onChange }: Props) {
  return (
    <div className="offer-card">
      {field('Destination', offer.destination, (v) => onChange({ ...offer, destination: v }))}
      {field('Headline (Sommer Angebote…)', offer.hookHeadline, (v) => onChange({ ...offer, hookHeadline: v }))}
      {field('Tagline (Luxus am Meer…)', offer.hookTagline, (v) => onChange({ ...offer, hookTagline: v }))}
      <h4 style={{ color: '#D4AF37', marginTop: 16 }}>Hotels ({offer.hotels.length})</h4>
      {offer.hotels.map((hotel, i) => (
        <HotelRow
          key={i}
          hotel={hotel}
          offerIdx={offerIdx}
          hotelIdx={i}
          customPhotos={customPhotos}
          onCustomPhoto={onCustomPhoto}
          onChange={(h) => {
            const hotels = [...offer.hotels];
            hotels[i] = h;
            onChange({ ...offer, hotels });
          }}
        />
      ))}
    </div>
  );
}
