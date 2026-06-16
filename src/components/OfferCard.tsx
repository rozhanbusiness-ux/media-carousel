import { Offer, Hotel } from '../types';

interface Props {
  offer: Offer;
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

function HotelRow({ hotel, onChange }: { hotel: Hotel; onChange: (h: Hotel) => void }) {
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
    </div>
  );
}

export function OfferCard({ offer, onChange }: Props) {
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
