import { Injectable } from '@angular/core';

export interface Coordonnees {
  lat: number;
  lon: number;
}

export interface TrajetAtelier {
  distanceM: number;
  durationSec: number;
}

/** Domicile / atelier : point de départ des trajets. */
export const ATELIER_ADRESSE = 'Rue des Wêdes 11, 4900 Spa, Belgique';

/**
 * Distance et temps de route depuis l'atelier (Spa) jusqu'à une adresse.
 * Géocodage Photon (komoot) puis itinéraire OSRM, avec cache en mémoire par adresse.
 */
@Injectable({ providedIn: 'root' })
export class TrajetAtelierService {
  private readonly geocodes = new Map<string, Promise<Coordonnees | null>>();
  private readonly trajets = new Map<string, Promise<TrajetAtelier | null>>();

  /** Trajet en voiture depuis l'atelier ; null si l'adresse ou l'itinéraire est introuvable. */
  trajetDepuisAtelier(adresse: string): Promise<TrajetAtelier | null> {
    const cle = this.cle(adresse);
    if (!cle) return Promise.resolve(null);
    if (!this.trajets.has(cle)) {
      const p = (async () => {
        const [atelier, dest] = await Promise.all([this.geocoder(ATELIER_ADRESSE), this.geocoder(adresse)]);
        if (!atelier || !dest) return null;
        return this.itineraire(atelier, dest);
      })();
      // En cas d'erreur réseau, on ne garde pas l'échec en cache.
      p.catch(() => this.trajets.delete(cle));
      this.trajets.set(cle, p);
    }
    return this.trajets.get(cle)!;
  }

  geocoder(adresse: string): Promise<Coordonnees | null> {
    const cle = this.cle(adresse);
    if (!cle) return Promise.resolve(null);
    if (!this.geocodes.has(cle)) {
      const p = this.geocoderReseau(adresse);
      p.then((r) => { if (!r) this.geocodes.delete(cle); }, () => this.geocodes.delete(cle));
      this.geocodes.set(cle, p);
    }
    return this.geocodes.get(cle)!;
  }

  async itineraire(from: Coordonnees, to: Coordonnees): Promise<TrajetAtelier | null> {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { code?: string; routes?: Array<{ distance?: number; duration?: number }> };
    if (data.code !== 'Ok' || !data.routes?.[0]) return null;
    const distanceM = Number(data.routes[0].distance);
    const durationSec = Number(data.routes[0].duration);
    if (!Number.isFinite(distanceM) || !Number.isFinite(durationSec)) return null;
    return { distanceM, durationSec };
  }

  private async geocoderReseau(adresse: string): Promise<Coordonnees | null> {
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(adresse)}&limit=1&lang=fr`;
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = (await response.json()) as { features?: Array<{ geometry?: { coordinates?: number[] } }> };
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) return null;
    const [lon, lat] = coords;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon };
  }

  private cle(adresse: string): string {
    return (adresse || '').trim().replace(/\s+/g, ' ').toLowerCase();
  }
}

export function formatDistance(distanceM: number): string {
  return `${(distanceM / 1000).toLocaleString('fr-BE', { maximumFractionDigits: 1, minimumFractionDigits: 0 })} km`;
}

export function formatDuree(durationSec: number): string {
  const totalMin = Math.max(1, Math.round(durationSec / 60));
  if (totalMin < 60) return `~${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `~${h} h ${m} min` : `~${h} h`;
}
