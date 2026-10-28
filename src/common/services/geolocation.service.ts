import { Injectable } from '@nestjs/common';
// @ts-ignore - no type declarations for geoip-lite
import * as geoip from 'geoip-lite';

/**
 * Service de géolocalisation pour déterminer le pays d'origine
 * d'un utilisateur à partir de son adresse IP
 */
@Injectable()
export class GeolocationService {
  /**
   * Extrait l'adresse IP réelle de la requête en tenant compte des proxies
   * @param request - L'objet Request de Express
   * @returns L'adresse IP de l'utilisateur
   */
  extractIpAddress(request: any): string {
    // Vérifier les en-têtes de proxy communs
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      // Prendre la première IP de la liste si plusieurs proxies
      const ips = forwarded.split(',');
      return ips[0].trim();
    }

    // Autres en-têtes possibles
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return realIp;
    }

    // IP de Cloudflare
    const cfConnectingIp = request.headers['cf-connecting-ip'];
    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    // Fallback sur l'IP de la connexion
    return request.ip || request.connection?.remoteAddress || '127.0.0.1';
  }

  /**
   * Détermine le pays à partir d'une adresse IP
   * @param ip - L'adresse IP
   * @returns Le nom du pays ou null si non trouvé
   */
  getCountryFromIp(ip: string): string | null {
    try {
      // Nettoyer l'IP (supprimer le préfixe IPv6 si présent)
      const cleanIp = ip.replace(/^::ffff:/, '');
      
      // Ignorer les IPs locales
      if (cleanIp === '127.0.0.1' || cleanIp === 'localhost' || cleanIp.startsWith('192.168.') || cleanIp.startsWith('10.')) {
        return null;
      }

      const geo = geoip.lookup(cleanIp);
      
      if (geo && geo.country) {
        // Mapper les codes de pays aux noms complets
        return this.getCountryName(geo.country);
      }

      return null;
    } catch (error) {
      console.error('[GeolocationService] Erreur lors de la géolocalisation:', error);
      return null;
    }
  }

  /**
   * Obtenir le nom complet du pays à partir de son code ISO
   * @param countryCode - Code ISO du pays (ex: 'CI', 'FR', 'US')
   * @returns Le nom complet du pays
   */
  private getCountryName(countryCode: string): string {
    const countryMap: Record<string, string> = {
      'CI': 'Côte d\'Ivoire',
      'FR': 'France',
      'US': 'États-Unis',
      'CA': 'Canada',
      'GB': 'Royaume-Uni',
      'DE': 'Allemagne',
      'IT': 'Italie',
      'ES': 'Espagne',
      'BE': 'Belgique',
      'CH': 'Suisse',
      'ML': 'Mali',
      'SN': 'Sénégal',
      'BF': 'Burkina Faso',
      'BJ': 'Bénin',
      'TG': 'Togo',
      'GH': 'Ghana',
      'NG': 'Nigeria',
      'CM': 'Cameroun',
      'GA': 'Gabon',
      'CG': 'Congo',
      'CD': 'République démocratique du Congo',
      'MA': 'Maroc',
      'DZ': 'Algérie',
      'TN': 'Tunisie',
      'EG': 'Égypte',
      // Ajoutez d'autres pays selon vos besoins
    };

    return countryMap[countryCode] || countryCode;
  }

  /**
   * Détermine le pays de création de la consultation
   * Utilise l'IP en priorité, puis les données du formulaire
   * @param request - L'objet Request
   * @param formData - Les données du formulaire (optionnel)
   * @returns Le pays détecté
   */
  determineCountry(request: any, formData?: any): string {
    // 1. Essayer d'abord avec l'IP
    if (request) {
      const ip = this.extractIpAddress(request);
      const countryFromIp = this.getCountryFromIp(ip);
      
      if (countryFromIp) {
        return countryFromIp;
      }
    }

    // 2. Fallback sur les données du formulaire
    if (formData) {
      if (formData.country) {
        return formData.country;
      }
      if (formData.countryOfBirth) {
        return formData.countryOfBirth;
      }
      if (formData.paysNaissance) {
        return formData.paysNaissance;
      }
    }

    // 3. Valeur par défaut
    return 'Côte d\'Ivoire';
  }
}
