import { EnergyType } from '@/types/energy';

export const ENERGY_TYPE_LABELS: Record<EnergyType, string> = {
  [EnergyType.SOLAR]: 'Solar',
  [EnergyType.WIND_ONSHORE]: 'Wind Onshore',
  [EnergyType.WIND_OFFSHORE]: 'Wind Offshore',
  [EnergyType.HYDRO]: 'Wasserkraft',
  [EnergyType.HYDRO_PUMPED]: 'Pumpspeicher',
  [EnergyType.NUCLEAR]: 'Kernkraft',
  [EnergyType.BIOMASS]: 'Biomasse',
  [EnergyType.LIGNITE]: 'Braunkohle',
  [EnergyType.HARD_COAL]: 'Steinkohle',
  [EnergyType.GAS]: 'Erdgas',
  [EnergyType.OIL]: 'Öl',
  [EnergyType.GEOTHERMAL]: 'Geothermie',
  [EnergyType.WASTE]: 'Abfall',
  [EnergyType.OTHER_RENEWABLE]: 'Sonstige Erneuerbare',
  [EnergyType.OTHER]: 'Sonstige Konventionelle',
};

export function translateEnergyType(type: string): string {
  return ENERGY_TYPE_LABELS[type as EnergyType] || type;
}
