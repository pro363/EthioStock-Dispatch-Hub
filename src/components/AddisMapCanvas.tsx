import React, { useEffect, useRef, useState } from 'react';
import { ExternalLink, MapPin, Navigation, Compass } from 'lucide-react';

interface MapPinItem {
  id: string;
  label: string;
  subLabel?: string;
  lat: number;
  lng: number;
  kind: 'warehouse' | 'office' | 'shop' | 'selected';
  offsetY?: number;
}

interface AddisMapCanvasProps {
  googleMapsApiKey: string;
  selectedLat: number;
  selectedLng: number;
  selectedLabel: string;
  onSelectCoordinates?: (lat: number, lng: number, landmark?: string) => void;
  showRouteFromKality?: boolean;
  heightClass?: string;
}

const ADDIS_LANDMARKS: MapPinItem[] = [
  {
    id: 'KALITY-WH',
    label: 'Kality Central Warehouse',
    subLabel: 'Dispatch Origin',
    lat: 8.9125,
    lng: 38.7692,
    kind: 'warehouse',
    offsetY: -14,
  },
  {
    id: 'BOLE-OFFICE',
    label: 'Bole Sales Office',
    subLabel: 'HQ & Order Desk',
    lat: 8.986,
    lng: 38.776,
    kind: 'office',
    offsetY: 16,
  },
  {
    id: 'SHOA-BOLE',
    label: 'Shoa Supermarket (Bole)',
    subLabel: 'Regular Trusted Shop',
    lat: 8.9982,
    lng: 38.7865,
    kind: 'shop',
    offsetY: -16,
  },
  {
    id: 'MERKATO-TANA',
    label: 'Merkato Tana Mini-Market',
    subLabel: 'New Shop (Addis Ketema)',
    lat: 9.0301,
    lng: 38.7369,
    kind: 'shop',
    offsetY: 14,
  },
  {
    id: 'BETEZATA-PIASSA',
    label: 'Betezata Pharmacy (Piassa)',
    subLabel: 'Credit Shop (Arada)',
    lat: 9.0358,
    lng: 38.7521,
    kind: 'shop',
    offsetY: -16,
  },
  {
    id: 'GERJI-WHOLESALE',
    label: 'Gerji Corner Wholesale',
    subLabel: 'Past Refusal (Gerji)',
    lat: 9.0019,
    lng: 38.8042,
    kind: 'shop',
    offsetY: 12,
  },
  {
    id: 'CMC-HUB',
    label: 'CMC Michael Corridor',
    subLabel: 'East Addis Delivery Zone',
    lat: 9.0195,
    lng: 38.831,
    kind: 'shop',
    offsetY: -14,
  },
];

// Convert Addis Ababa Lat/Lng bounds [8.89..9.06, 38.71..38.85] to SVG % coordinates
function latLngToPercent(lat: number, lng: number) {
  const minLat = 8.895;
  const maxLat = 9.055;
  const minLng = 38.715;
  const maxLng = 38.845;

  const x = ((lng - minLng) / (maxLng - minLng)) * 100;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100;

  return {
    x: Math.max(6, Math.min(94, x)),
    y: Math.max(8, Math.min(92, y)),
  };
}

export const AddisMapCanvas: React.FC<AddisMapCanvasProps> = ({
  googleMapsApiKey,
  selectedLat,
  selectedLng,
  selectedLabel,
  onSelectCoordinates,
  showRouteFromKality = true,
  heightClass = 'h-64',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [liveMapLoaded, setLiveMapLoaded] = useState(false);
  const [liveMapError, setLiveMapError] = useState(false);

  // Attempt to load live Google Maps JS API if key is configured
  useEffect(() => {
    const trimmedKey = googleMapsApiKey.trim();
    if (!trimmedKey) {
      setLiveMapLoaded(false);
      setLiveMapError(false);
      return;
    }

    const w = window as any;
    if (w.google && w.google.maps) {
      setLiveMapLoaded(true);
      return;
    }

    const existingScript = document.getElementById('ethio-gmaps-script');
    if (existingScript) {
      existingScript.remove();
    }

    const script = document.createElement('script');
    script.id = 'ethio-gmaps-script';
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(trimmedKey)}`;
    script.async = true;
    script.onload = () => {
      if ((window as any).google?.maps) {
        setLiveMapLoaded(true);
        setLiveMapError(false);
      }
    };
    script.onerror = () => {
      setLiveMapError(true);
      setLiveMapLoaded(false);
    };
    document.head.appendChild(script);
  }, [googleMapsApiKey]);

  useEffect(() => {
    if (!liveMapLoaded || !mapContainerRef.current) return;
    try {
      const gmaps = (window as any).google.maps;
      const map = new gmaps.Map(mapContainerRef.current, {
        center: { lat: selectedLat || 9.0054, lng: selectedLng || 38.7636 },
        zoom: 12,
        mapTypeControl: false,
        streetViewControl: false,
      });

      // Marker for Kality Warehouse
      new gmaps.Marker({
        position: { lat: 8.9125, lng: 38.7692 },
        map,
        title: 'Kality Central Warehouse',
      });

      // Selected Shop Marker
      const shopMarker = new gmaps.Marker({
        position: { lat: selectedLat, lng: selectedLng },
        map,
        title: selectedLabel,
        draggable: Boolean(onSelectCoordinates),
      });

      if (onSelectCoordinates) {
        map.addListener('click', (e: any) => {
          const lat = Number(e.latLng.lat().toFixed(4));
          const lng = Number(e.latLng.lng().toFixed(4));
          shopMarker.setPosition({ lat, lng });
          onSelectCoordinates(lat, lng, 'Custom Dropped Pin (Addis Ababa)');
        });
      }
    } catch {
      setLiveMapError(true);
      setLiveMapLoaded(false);
    }
  }, [liveMapLoaded, selectedLat, selectedLng, selectedLabel, onSelectCoordinates]);

  const kalityPos = latLngToPercent(8.9125, 38.7692);
  const targetPos = latLngToPercent(selectedLat, selectedLng);
  const googleDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=8.9125,38.7692&destination=${selectedLat},${selectedLng}&travelmode=driving`;

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!onSelectCoordinates) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = (e.clientX - rect.left) / rect.width;
    const clickY = (e.clientY - rect.top) / rect.height;

    const minLat = 8.895;
    const maxLat = 9.055;
    const minLng = 38.715;
    const maxLng = 38.845;

    const lng = Number((minLng + clickX * (maxLng - minLng)).toFixed(4));
    const lat = Number((maxLat - clickY * (maxLat - minLat)).toFixed(4));
    onSelectCoordinates(lat, lng, 'Selected Addis Ababa Map Pin');
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
      {/* Top Map Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 bg-slate-900 text-white text-xs">
        <div className="flex items-center gap-2">
          <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span className="font-medium">
            {liveMapLoaded && !liveMapError
              ? 'Google Maps Live SDK (Addis Ababa)'
              : 'Addis Ababa Dispatch & Coordinate Map'}
          </span>
          <span className="text-slate-400" aria-hidden="true">
            ·
          </span>
          <span className="font-mono tabular-nums text-emerald-300">
            {selectedLat.toFixed(4)}° N, {selectedLng.toFixed(4)}° E
          </span>
        </div>

        <a
          href={googleDirectionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-medium transition-colors whitespace-nowrap shrink-0"
        >
          <Navigation className="w-3 h-3" />
          <span>Open in Live Google Maps Directions</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {/* Live Google Maps Div when API key is provided */}
      {liveMapLoaded && !liveMapError ? (
        <div ref={mapContainerRef} className={`w-full ${heightClass}`} />
      ) : (
        /* Interactive Addis Ababa Coordinate & Route Canvas */
        <div className={`relative w-full ${heightClass} bg-[#F1F5F9] select-none`}>
          <svg
            viewBox="0 0 800 400"
            className={`w-full h-full ${onSelectCoordinates ? 'cursor-crosshair' : ''}`}
            onClick={handleSvgClick}
            role="img"
            aria-label="Interactive Addis Ababa Coordinate and Dispatch Route Map"
          >
            {/* Subtle Coordinate Grid */}
            <defs>
              <pattern id="addisGrid" width="80" height="80" patternUnits="userSpaceOnUse">
                <path
                  d="M 80 0 L 0 0 0 80"
                  fill="none"
                  stroke="#CBD5E1"
                  strokeWidth="0.75"
                  strokeDasharray="3,3"
                />
              </pattern>
            </defs>
            <rect width="800" height="400" fill="url(#addisGrid)" />

            {/* Major Addis Ababa Arterial Roads (Ring Road, Churchill Ave, Bole Rd, Debre Zeit Rd) */}
            <path
              d="M 380 390 L 400 220 L 320 90"
              stroke="#94A3B8"
              strokeWidth="4"
              fill="none"
              opacity="0.55"
            />
            <path
              d="M 140 130 L 420 180 L 720 150"
              stroke="#94A3B8"
              strokeWidth="4"
              fill="none"
              opacity="0.55"
            />
            <ellipse
              cx="410"
              cy="195"
              rx="230"
              ry="125"
              stroke="#CBD5E1"
              strokeWidth="3"
              fill="none"
            />

            {/* Sub-City Labels */}
            <text x="150" y="65" fill="#64748B" fontSize="11" fontWeight="600">
              ADDIS KETEMA (MERKATO)
            </text>
            <text x="345" y="45" fill="#64748B" fontSize="11" fontWeight="600">
              ARADA (PIASSA)
            </text>
            <text x="530" y="185" fill="#64748B" fontSize="11" fontWeight="600">
              BOLE / GERJI
            </text>
            <text x="640" y="95" fill="#64748B" fontSize="11" fontWeight="600">
              YEKA / CMC
            </text>
            <text x="395" y="378" fill="#065F46" fontSize="11" fontWeight="700">
              AKAKI KALITY (WAREHOUSE ZONE)
            </text>

            {/* Active Delivery Route Line from Kality Warehouse to Selected Shop */}
            {showRouteFromKality && (
              <line
                x1={(kalityPos.x / 100) * 800}
                y1={(kalityPos.y / 100) * 400}
                x2={(targetPos.x / 100) * 800}
                y2={(targetPos.y / 100) * 400}
                stroke="#065F46"
                strokeWidth="3"
                strokeDasharray="7,5"
              />
            )}

            {/* Landmark Pins */}
            {ADDIS_LANDMARKS.map((lm) => {
              const pos = latLngToPercent(lm.lat, lm.lng);
              const cx = (pos.x / 100) * 800;
              const cy = (pos.y / 100) * 400;
              const isSelected =
                Math.abs(lm.lat - selectedLat) < 0.002 &&
                Math.abs(lm.lng - selectedLng) < 0.002;

              const fill =
                lm.kind === 'warehouse'
                  ? '#065F46'
                  : lm.kind === 'office'
                  ? '#1E293B'
                  : isSelected
                  ? '#D97706'
                  : '#2563EB';

              return (
                <g
                  key={lm.id}
                  className="cursor-pointer"
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (onSelectCoordinates) {
                      onSelectCoordinates(lm.lat, lm.lng, lm.label);
                    }
                  }}
                >
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected || lm.kind === 'warehouse' ? 8 : 6}
                    fill={fill}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                  />
                  <rect
                    x={cx + 10}
                    y={cy - 11 + (lm.offsetY || 0)}
                    width={lm.label.length * 6.2 + 12}
                    height="20"
                    rx="4"
                    fill="#FFFFFF"
                    stroke="#CBD5E1"
                    strokeWidth="1"
                  />
                  <text
                    x={cx + 16}
                    y={cy + 3 + (lm.offsetY || 0)}
                    fill="#0F172A"
                    fontSize="10.5"
                    fontWeight={isSelected || lm.kind === 'warehouse' ? '700' : '600'}
                  >
                    {lm.label}
                  </text>
                </g>
              );
            })}

            {/* Highlight Selected Pin if custom coordinates */}
            <g>
              <circle
                cx={(targetPos.x / 100) * 800}
                cy={(targetPos.y / 100) * 400}
                r="13"
                fill="none"
                stroke="#D97706"
                strokeWidth="2.5"
              />
              <circle
                cx={(targetPos.x / 100) * 800}
                cy={(targetPos.y / 100) * 400}
                r="5"
                fill="#D97706"
              />
            </g>
          </svg>

          {/* Bottom Quick-Pin Selector Bar */}
          <div className="absolute bottom-2 left-2 right-2 flex flex-wrap items-center justify-between gap-2 bg-white/95 backdrop-blur px-3 py-1.5 rounded border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5 text-slate-700 font-medium truncate">
              <MapPin className="w-3.5 h-3.5 text-amber-600 shrink-0" />
              <span className="truncate">{selectedLabel}</span>
            </div>
            {onSelectCoordinates && (
              <div className="flex items-center gap-1 overflow-x-auto">
                <span className="text-[11px] text-slate-500 mr-1">Quick Pin:</span>
                {ADDIS_LANDMARKS.filter((l) => l.kind === 'shop').map((lm) => (
                  <button
                    key={lm.id}
                    type="button"
                    onClick={() => onSelectCoordinates(lm.lat, lm.lng, lm.label)}
                    className="px-2 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-700 font-medium text-[11px] transition-colors whitespace-nowrap shrink-0"
                  >
                    {lm.label.split(' ')[0]}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
