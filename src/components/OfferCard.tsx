import { Offer, Hotel } from '../types';

interface Props {
  offer: Offer;
  onChange: (updated: Offer) => void;
}

function HotelRow({ hotel, onChange }: { hotel: Hotel; onChange: (h: Hotel) => void }) {
  const field = (key: keyof Hotel) => (
    <div className="field-row" key={key}>
      <label>{key}</label>
      <input
        value={String(hotel[key])}
        onChange={(e) => onChange({ ...hotel, [key]: key === 'stars' || key === 'rating' ? Number(e.target.value) : e.target.value })}
      />
    </div>
  );

  return (
    <div className="hotel-row">
      {(['name','stars','price','dateFrom','dateTo','airportDeparture','airportReturn','mealPlan','transfer','rating'] as (keyof Hotel)[]).map(field)}
    </div>
  );
}

export function OfferCard({ offer, onChange }: Props) {
  return (
    <div className="offer-card">
      <div className="field-row">
        <label>Destination</label>
        <input value={offer.destination} onChange={(e) => onChange({ ...offer, destination: e.target.value })} />
      </div>
      <div className="field-row">
        <label>Headline</label>
        <input value={offer.hookHeadline} onChange={(e) => onChange({ ...offer, hookHeadline: e.target.value })} />
      </div>
      <h4 style={{ color: '#D4AF37', marginTop: 12 }}>Hotels</h4>
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
