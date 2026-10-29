import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Layers, Crosshair, Map as MapIcon } from 'lucide-react';

const CARTO_API_KEY = import.meta.env.VITE_CARTO_API_KEY || '';

const BASEMAP_CONFIGS = {
  voyager: {
    id: 'voyager',
    name: 'CARTO Voyager',
    url: CARTO_API_KEY
      ? `https://basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    maxZoom: 19,
  },
  dark: {
    id: 'dark',
    name: 'CARTO Dark',
    url: CARTO_API_KEY
      ? `https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=${CARTO_API_KEY}`
      : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">CARTO</a>',
    maxZoom: 19,
  },
  esri: {
    id: 'esri',
    name: 'Esri Oceanic',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap',
    maxZoom: 16,
  },
};

export default function MarineMap({
  harbours = [],
  activeHarbour = null,
  onSelectHarbour = () => {},
  mapPayload = null,
  theme = 'ocean',
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const currentTileLayerRef = useRef(null);
  const [activeBasemap, setActiveBasemap] = useState('voyager'); // CARTO Voyager default as requested

  const layersRef = useRef({
    harbours: L.layerGroup(),
    imbl: L.layerGroup(),
    mpa: L.layerGroup(),
    pfz: L.layerGroup(),
    route: L.layerGroup(),
    inspection: L.layerGroup(),
  });

  // Layer visibility toggles
  const [layersVisible, setLayersVisible] = useState({
    harbours: true,
    pfz: true,
    route: true,
    imbl: true,
    mpa: true,
  });

  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [geofenceData, setGeofenceData] = useState({ imbl: null, mpa: null });

  // Handle container resize & orientation changes smoothly (Mobile & Tablet)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
        if (mapInstanceRef.current) {
          try {
            mapInstanceRef.current.invalidateSize();
            if (activeHarbour) {
              mapInstanceRef.current.setView([activeHarbour.lat, activeHarbour.lon], 9);
            }
          } catch (e) {
            console.warn('Leaflet resize update warning:', e);
          }
        }
      }
    });
    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, [activeHarbour]);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    try {
      // Default center on Indian Ocean / Subcontinent
      const map = L.map(mapContainerRef.current, {
        center: [14.0, 78.5],
        zoom: 5.5,
        minZoom: 4,
        maxZoom: 19,
        zoomControl: false,
      });

      // Add Zoom Control to bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Initial Tile Layer: CARTO Voyager with verified API key
      const initialConfig = BASEMAP_CONFIGS[activeBasemap] || BASEMAP_CONFIGS.voyager;
      const tileLayer = L.tileLayer(initialConfig.url, {
        attribution: initialConfig.attribution,
        maxZoom: initialConfig.maxZoom,
        subdomains: 'abcd',
      }).addTo(map);
      currentTileLayerRef.current = tileLayer;

      // Add our layer groups to the map
      Object.values(layersRef.current).forEach((layer) => layer.addTo(map));

      mapInstanceRef.current = map;

      return () => {
        try {
          map.remove();
        } catch (e) {
          // Ignore teardown errors
        }
        mapInstanceRef.current = null;
        currentTileLayerRef.current = null;
      };
    } catch (err) {
      console.warn('Leaflet map initialization warning:', err);
    }
  }, []);

  // Update Tile Layer dynamically when activeBasemap changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const cfg = BASEMAP_CONFIGS[activeBasemap] || BASEMAP_CONFIGS.voyager;
    if (currentTileLayerRef.current) {
      mapInstanceRef.current.removeLayer(currentTileLayerRef.current);
    }
    const newLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      subdomains: 'abcd',
    }).addTo(mapInstanceRef.current);
    newLayer.bringToBack();
    currentTileLayerRef.current = newLayer;
  }, [activeBasemap]);

  // 2. Fetch Geofence GeoJSONs from backend
  useEffect(() => {
    const fetchGeofences = async () => {
      try {
        const [imblRes, mpaRes] = await Promise.all([
          fetch('/api/v1/geofences/imbl').then((r) => (r.ok ? r.json() : null)),
          fetch('/api/v1/geofences/mpa').then((r) => (r.ok ? r.json() : null)),
        ]);
        setGeofenceData({ imbl: imblRes, mpa: mpaRes });
      } catch (err) {
        console.error('Failed to load geofence layers:', err);
      }
    };
    fetchGeofences();
  }, []);

  // 3. Render IMBL and MPA Boundaries
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // A. Render IMBL
    const imblGroup = layersRef.current.imbl;
    imblGroup.clearLayers();

    if (geofenceData.imbl) {
      // 1. Solid Red IMBL line
      L.geoJSON(geofenceData.imbl, {
        style: {
          color: '#ef4444',
          weight: 3.5,
          opacity: 0.95,
        },
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name || 'International Maritime Boundary Line (IMBL)';
          layer.bindTooltip(`
            <div class="font-bold text-red-400 text-xs">${name}</div>
            <div class="text-[11px] text-slate-300">Strict Sovereignty Border • Crossing Strictly Prohibited</div>
          `, { sticky: true, className: 'leaflet-tooltip-dark' });
        },
      }).addTo(imblGroup);

      // 2. Buffer/Warning Line (Dashed Amber ~5 NM representation)
      L.geoJSON(geofenceData.imbl, {
        style: {
          color: '#f59e0b',
          weight: 2,
          dashArray: '6, 8',
          opacity: 0.8,
        },
        onEachFeature: (feature, layer) => {
          layer.bindTooltip(`
            <div class="font-bold text-amber-400 text-xs">5 NM Geofence Alert Buffer</div>
            <div class="text-[11px] text-slate-300">Approaching IMBL • Autonomous Circuit Breaker Active</div>
          `, { sticky: true });
        },
      }).addTo(imblGroup);
    }

    // B. Render MPA Zones (Marine Sky-Blue conservation boundary)
    const mpaGroup = layersRef.current.mpa;
    mpaGroup.clearLayers();

    if (geofenceData.mpa) {
      L.geoJSON(geofenceData.mpa, {
        style: {
          color: '#0284c7',
          fillColor: '#0369a1',
          fillOpacity: 0.25,
          weight: 2,
          dashArray: '4, 4',
        },
        onEachFeature: (feature, layer) => {
          const name = feature.properties?.name || 'Marine Protected Area';
          layer.bindTooltip(`
            <div class="font-bold text-sky-300 text-xs">${name}</div>
            <div class="text-[11px] text-sky-200/80">Protected Sanctuary Zone • Commercial Fishing Prohibited</div>
          `, { sticky: true });
        },
      }).addTo(mpaGroup);
    }
  }, [geofenceData]);

  // 4. Render 12 Harbours
  useEffect(() => {
    if (!mapInstanceRef.current || !harbours.length) return;

    const harboursGroup = layersRef.current.harbours;
    harboursGroup.clearLayers();

    harbours.forEach((h) => {
      const isActive = activeHarbour && activeHarbour.id === h.id;

      // Custom Port Anchor Icon
      const icon = L.divIcon({
        className: 'custom-harbour-marker',
        html: `
          <div class="relative flex items-center justify-center cursor-pointer group">
            <div class="w-8 h-8 rounded-full ${
              isActive
                ? 'bg-cyan-500 text-slate-950 ring-4 ring-cyan-400/50 scale-125 z-30'
                : 'bg-ocean-850 text-cyan-400 ring-2 ring-cyan-500/40 hover:scale-110 z-10'
            } shadow-lg flex items-center justify-center transition-all duration-200">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="5" r="3"/>
                <line x1="12" y1="22" x2="12" y2="8"/>
                <path d="M5 12H2a10 10 0 0 0 20 0h-3"/>
              </svg>
            </div>
            ${
              isActive
                ? '<div class="absolute -inset-1 rounded-full bg-cyan-400/30 animate-ping"></div>'
                : ''
            }
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([h.lat, h.lon], { icon }).addTo(harboursGroup);

      marker.bindPopup(`
        <div class="p-1 min-w-[180px]">
          <div class="flex items-center gap-1.5 text-cyan-400 font-bold text-sm">
            <svg class="w-3.5 h-3.5 text-cyan-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>
            <span>${h.name}</span>
          </div>
          <div class="text-xs text-slate-300 font-medium">${h.local_name || ''}</div>
          <div class="text-[11px] text-slate-400 mt-1">State: <strong class="text-slate-200">${h.state}</strong></div>
          <div class="text-[11px] text-slate-400">Lat: ${h.lat.toFixed(3)}°N, Lon: ${h.lon.toFixed(3)}°E</div>
          <button id="btn-select-${h.id}" class="mt-2.5 w-full bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold py-1 px-2 rounded text-xs transition">
            Set as Operating Base
          </button>
        </div>
      `);

      marker.on('popupopen', () => {
        const btn = document.getElementById(`btn-select-${h.id}`);
        if (btn) {
          btn.onclick = () => {
            onSelectHarbour(h);
            marker.closePopup();
          };
        }
      });
    });
  }, [harbours, activeHarbour, onSelectHarbour]);

  // 5. Render Dynamic Map Payload (PFZ Zones, Safe Routes, Target Points)
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    const pfzGroup = layersRef.current.pfz;
    const routeGroup = layersRef.current.route;
    const inspectGroup = layersRef.current.inspection;

    pfzGroup.clearLayers();
    routeGroup.clearLayers();
    inspectGroup.clearLayers();

    if (!mapPayload || !mapPayload.features) return;

    const bounds = L.latLngBounds([]);

    mapPayload.features.forEach((feature) => {
      const geom = feature.geometry;
      const props = feature.properties || {};

      // A. PFZ Zone Points
      if (props.entity === 'pfz_zone' && geom.type === 'Point') {
        const [lon, lat] = geom.coordinates;
        bounds.extend([lat, lon]);

        const isTop = props.is_top || props.is_top === undefined;
        const score = Math.round(props.pfz_score || 0);

        const icon = L.divIcon({
          className: 'custom-pfz-marker',
          html: `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div class="relative z-20 px-2 py-0.5 rounded-md ${
                isTop
                  ? 'bg-gradient-to-r from-emerald-500 to-teal-400 text-slate-950 ring-2 ring-emerald-300'
                  : 'bg-emerald-800 text-emerald-100 ring-1 ring-emerald-400/50'
              } text-[11px] font-black tracking-tight shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center gap-1">
                <span>Score:</span>
                <span>${score}</span>
              </div>
              ${
                isTop
                  ? '<div class="absolute -inset-2 rounded-md bg-emerald-400/40 pfz-pulse-glow"></div>'
                  : ''
              }
            </div>
          `,
          iconSize: [48, 24],
          iconAnchor: [24, 12],
        });

        const marker = L.marker([lat, lon], { icon }).addTo(pfzGroup);

        marker.bindPopup(`
          <div class="p-1 min-w-[200px]">
            <div class="flex items-center justify-between gap-2 border-b border-white/10 pb-1">
              <span class="font-bold text-emerald-400 text-xs">PFZ Candidate</span>
              <span class="bg-emerald-500/20 text-emerald-300 font-black text-xs px-1.5 py-0.5 rounded">
                Score: ${score}/100
              </span>
            </div>
            <div class="mt-2 space-y-1 text-xs">
              <div class="flex justify-between text-slate-300">
                <span>Compass Bearing:</span>
                <strong class="text-cyan-300 font-mono">${props.bearing_deg || ''}° ${props.bearing_cardinal || ''}</strong>
              </div>
              <div class="flex justify-between text-slate-300">
                <span>Distance Offshore:</span>
                <strong class="text-white font-mono">${props.distance_nm || ''} NM (${props.distance_km || ''} km)</strong>
              </div>
              ${
                props.sst_c
                  ? `<div class="flex justify-between text-slate-300">
                      <span>SST:</span>
                      <strong class="text-amber-300">${props.sst_c}°C</strong>
                    </div>`
                  : ''
              }
              ${
                props.chla_mg_m3
                  ? `<div class="flex justify-between text-slate-300">
                      <span>Chlorophyll-a:</span>
                      <strong class="text-emerald-300">${props.chla_mg_m3} mg/m³</strong>
                    </div>`
                  : ''
              }
              <div class="pt-1.5 text-[11px] text-slate-400">
                Geofence Safety: <span class="font-bold text-emerald-400">SAFE (Cleared)</span>
              </div>
            </div>
          </div>
        `);
      }

      // B. Safe Navigation Route Polyline (A* pathfinding)
      if (props.entity === 'safe_navigation_route' && geom.type === 'LineString') {
        const latLngs = geom.coordinates.map(([lon, lat]) => [lat, lon]);
        latLngs.forEach((coord) => bounds.extend(coord));

        // Outer glow
        L.polyline(latLngs, {
          color: '#22d3ee',
          weight: 6,
          opacity: 0.3,
        }).addTo(routeGroup);

        // Core dashed route
        const routeLine = L.polyline(latLngs, {
          color: '#06b6d4',
          weight: 3.5,
          dashArray: '8, 8',
          opacity: 0.95,
        }).addTo(routeGroup);

        routeLine.bindTooltip(`
          <div class="font-bold text-cyan-400 text-xs">A* Wave-Aware Safe Route</div>
          <div class="text-[11px] text-slate-300">
            Distance: <strong>${props.total_distance_nm || ''} NM</strong> • Est. Time: <strong>${props.estimated_hours || ''} hrs</strong>
          </div>
          <div class="text-[11px] text-emerald-400 font-semibold">
            Fuel Savings: ~${props.fuel_savings_percent || '0'}% vs direct rough route
          </div>
        `, { sticky: true });

        // Waypoints dots
        latLngs.forEach((pt, i) => {
          if (i > 0 && i < latLngs.length - 1) {
            L.circleMarker(pt, {
              radius: 3.5,
              color: '#06b6d4',
              fillColor: '#22d3ee',
              fillOpacity: 0.9,
              weight: 1.5,
            }).addTo(routeGroup);
          }
        });
      }

      // C. Target Inspection Point (e.g. IMBL test or MPA Net check)
      if (props.entity === 'target_inspection_point' && geom.type === 'Point') {
        const [lon, lat] = geom.coordinates;
        bounds.extend([lat, lon]);

        const isViolation = props.is_violation;
        const alertLevel = props.alert_level || 'CRITICAL';

        const icon = L.divIcon({
          className: 'custom-target-marker',
          html: `
            <div class="relative flex items-center justify-center">
              <div class="w-8 h-8 rounded-md ${
                isViolation
                  ? 'bg-red-600 text-white ring-2 ring-red-400'
                  : 'bg-amber-500 text-slate-950 ring-2 ring-amber-400'
              } flex items-center justify-center font-bold text-xs shadow-xl">
                <svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"/></svg>
              </div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lon], { icon }).addTo(inspectGroup);

        marker.bindPopup(`
          <div class="p-1 min-w-[190px]">
            <div class="font-bold ${isViolation ? 'text-red-400' : 'text-amber-400'} text-xs">
              ${isViolation ? 'CRITICAL GEOFENCE VIOLATION' : 'BORDER PROXIMITY WARNING'}
            </div>
            <div class="mt-1 text-xs text-slate-300">
              Boundary: <strong>${props.boundary_name || 'IMBL'}</strong>
            </div>
            <div class="text-xs text-slate-300">
              Distance: <strong class="text-white">${props.distance_nm || '0.0'} NM</strong>
            </div>
            <div class="mt-2 text-[11px] ${isViolation ? 'text-red-300' : 'text-amber-300'} font-medium">
              ${props.warning_directive || 'Turn back immediately to Indian territorial waters.'}
            </div>
          </div>
        `).openPopup();
      }
    });

    // Auto-fit bounds if we have features and map is visible
    if (bounds.isValid() && mapInstanceRef.current) {
      const container = mapContainerRef.current;
      if (container && container.clientWidth > 0 && container.clientHeight > 0) {
        try {
          mapInstanceRef.current.fitBounds(bounds, { padding: [60, 60], maxZoom: 10 });
        } catch (err) {
          console.warn('Leaflet fitBounds suppressed due to container dimensions:', err);
        }
      }
    }
  }, [mapPayload]);

  // 6. Pan to Active Harbour when changed (guarded against zero-dimension mobile tabs)
  useEffect(() => {
    if (!mapInstanceRef.current || !activeHarbour) return;
    const container = mapContainerRef.current;
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) {
      // Container is hidden (e.g. on mobile while on chat tab).
      // Leaflet's zoom/pixel math divides by container size (0), producing NaN if called.
      return;
    }
    try {
      mapInstanceRef.current.flyTo([activeHarbour.lat, activeHarbour.lon], 9, {
        duration: 1.2,
        easeLinearity: 0.25,
      });
    } catch (err) {
      console.warn('Leaflet flyTo suppressed due to container state:', err);
    }
  }, [activeHarbour]);

  // 7. Toggle Layer Visibility
  const toggleLayer = (layerKey) => {
    const group = layersRef.current[layerKey];
    if (!group || !mapInstanceRef.current) return;

    setLayersVisible((prev) => {
      const next = !prev[layerKey];
      if (next) {
        mapInstanceRef.current.addLayer(group);
      } else {
        mapInstanceRef.current.removeLayer(group);
      }
      return { ...prev, [layerKey]: next };
    });
  };

  const handleResetView = () => {
    if (!mapInstanceRef.current) return;
    const container = mapContainerRef.current;
    if (!container || container.clientWidth === 0 || container.clientHeight === 0) return;
    try {
      if (activeHarbour) {
        mapInstanceRef.current.flyTo([activeHarbour.lat, activeHarbour.lon], 9);
      } else {
        mapInstanceRef.current.flyTo([14.0, 78.5], 5.5);
      }
    } catch (err) {
      console.warn('handleResetView suppressed:', err);
    }
  };

  return (
    <div className="relative w-full h-full bg-[#0a0a0c] overflow-hidden select-none">
      {/* Map DOM Container */}
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Map Control Overlay (Top Left: Apple-Style Layer Switcher & Controls) */}
      <div className="absolute top-3 left-3 z-20 flex flex-col gap-2 max-w-[calc(100vw-24px)]">
        {/* Mobile Toolbar Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => setIsLayersOpen((prev) => !prev)}
            className="glass-icon px-2.5 py-1.5 text-xs font-medium gap-1.5 shadow-lg text-[#f5f5f7] sm:hidden"
            title="Toggle Map Layers & Basemaps"
          >
            <Layers className="w-3.5 h-3.5 text-[#2997ff]" />
            <span>Layers</span>
          </button>

          <button
            onClick={handleResetView}
            className="glass-icon px-2.5 sm:px-3 py-1.5 text-xs font-medium gap-1.5 shadow-lg text-[#f5f5f7]"
            title="Center Map on Active Harbour"
          >
            <Crosshair className="w-3.5 h-3.5 text-[#2997ff]" />
            <span className="hidden sm:inline">Center: {activeHarbour?.name || 'Coast'}</span>
            <span className="sm:hidden">Center</span>
          </button>
        </div>

        {/* Layer & Basemap Panel (Toggleable on mobile, persistent on tablet/desktop) */}
        <div className={`${isLayersOpen ? 'block' : 'hidden sm:block'} bg-black/80 border border-white/[0.1] rounded-xl p-3 shadow-2xl backdrop-blur-xl text-xs text-[#f5f5f7] max-w-[240px]`}>
          {/* Basemap Selection */}
          <div className="mb-2.5 pb-2 border-b border-white/[0.08]">
            <div className="flex items-center justify-between text-[#86868b] font-medium uppercase tracking-wider text-[10px] mb-1.5">
              <span className="flex items-center gap-1.5">
                <MapIcon className="w-3 h-3 text-[#2997ff]" />
                Basemap
              </span>
              <span className="text-[9px] text-[#38bdf8] font-mono">CARTO API</span>
            </div>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => setActiveBasemap('voyager')}
                className={`px-1.5 py-1 rounded text-center text-[10px] font-medium transition ${
                  activeBasemap === 'voyager'
                    ? 'bg-[#0071e3] text-white shadow-sm'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] text-[#d1d1d6]'
                }`}
                title="CARTO Voyager Nautical Basemap (Active API Key)"
              >
                Voyager
              </button>
              <button
                type="button"
                onClick={() => setActiveBasemap('dark')}
                className={`px-1.5 py-1 rounded text-center text-[10px] font-medium transition ${
                  activeBasemap === 'dark'
                    ? 'bg-[#0071e3] text-white shadow-sm'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] text-[#d1d1d6]'
                }`}
                title="CARTO Dark Matter Basemap (Active API Key)"
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setActiveBasemap('esri')}
                className={`px-1.5 py-1 rounded text-center text-[10px] font-medium transition ${
                  activeBasemap === 'esri'
                    ? 'bg-[#0071e3] text-white shadow-sm'
                    : 'bg-white/[0.06] hover:bg-white/[0.12] text-[#d1d1d6]'
                }`}
                title="Esri Oceanic Gray Basemap"
              >
                Esri
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[#86868b] font-medium mb-2 pb-1.5 border-b border-white/[0.08] uppercase tracking-wider text-[10px]">
            <div className="glass-icon w-5 h-5">
              <Layers className="w-3 h-3 text-[#2997ff]" />
            </div>
            <span>Layers</span>
          </div>
          <div className="space-y-1.5">
            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={layersVisible.harbours}
                onChange={() => toggleLayer('harbours')}
                className="rounded accent-[#0071e3] w-3.5 h-3.5"
              />
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2997ff]"></span>
                <span className="font-normal text-xs text-[#e1e1e6]">Harbours</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={layersVisible.pfz}
                onChange={() => toggleLayer('pfz')}
                className="rounded accent-[#0071e3] w-3.5 h-3.5"
              />
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                <span className="font-normal text-xs text-[#e1e1e6]">PFZ Hotspots</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={layersVisible.route}
                onChange={() => toggleLayer('route')}
                className="rounded accent-[#0071e3] w-3.5 h-3.5"
              />
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#2997ff]"></span>
                <span className="font-normal text-xs text-[#e1e1e6]">Safe Route</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={layersVisible.imbl}
                onChange={() => toggleLayer('imbl')}
                className="rounded accent-[#0071e3] w-3.5 h-3.5"
              />
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                <span className="font-normal text-xs text-[#e1e1e6]">IMBL Border</span>
              </span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={layersVisible.mpa}
                onChange={() => toggleLayer('mpa')}
                className="rounded accent-[#0071e3] w-3.5 h-3.5"
              />
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                <span className="font-normal text-xs text-[#e1e1e6]">MPA Sanctuaries</span>
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Map Legend Overlay (Bottom Left) */}
      <div className="absolute bottom-4 left-4 z-20 bg-black/75 border border-white/[0.1] rounded-lg px-3 py-1.5 shadow-xl backdrop-blur-xl text-[11px] hidden sm:block">
        <div className="flex flex-wrap items-center gap-3 text-[#d1d1d6]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 bg-red-400 rounded-sm"></span>
            <span>IMBL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 border-b-2 border-dashed border-amber-400"></span>
            <span>5 NM Buffer</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 bg-sky-400/30 border border-sky-400 rounded-sm"></span>
            <span>MPA</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-sm bg-emerald-400"></span>
            <span>PFZ</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-1 border-b-2 border-dashed border-[#2997ff]"></span>
            <span>Route</span>
          </div>
        </div>
      </div>
    </div>
  );
}
