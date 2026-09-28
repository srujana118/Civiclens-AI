export type InfrastructureType = {
  type: string;
  category: string;
  condition: 'Good' | 'Fair' | 'Poor';
  index: number;
  investmentStatus: string;
  investmentNote: string;
};

const CATEGORY_TO_INFRASTRUCTURE: Record<string, string> = {
  Potholes: 'Road Infrastructure',
  'Street Lighting': 'Street Lighting Network',
  Sanitation: 'Waste Management Infrastructure',
  Graffiti: 'Public Property & Surfaces',
  Noise: 'Urban Zoning & Sound Barriers',
  'Public Safety': 'Public Safety Infrastructure',
  Water: 'Water Supply & Drainage',
  Parks: 'Parks & Recreational Facilities',
  Traffic: 'Traffic Control Infrastructure',
  Other: 'General Civic Infrastructure',
};

const INFRASTRUCTURE_DATA: Record<
  string,
  {
    condition: 'Good' | 'Fair' | 'Poor';
    index: number;
    investmentStatus: string;
    investmentNote: string;
  }
> = {
  'Road Infrastructure': {
    condition: 'Poor',
    index: 38,
    investmentStatus: 'Priority maintenance',
    investmentNote:
      'Repeated road-related reports indicate that maintenance attention may be required in the affected area.',
  },

  'Street Lighting Network': {
    condition: 'Fair',
    index: 55,
    investmentStatus: 'Improvement recommended',
    investmentNote:
      'Repeated street-lighting reports indicate a potential need for inspection and service improvement.',
  },

  'Waste Management Infrastructure': {
    condition: 'Fair',
    index: 52,
    investmentStatus: 'Service improvement',
    investmentNote:
      'Sanitation-related reports indicate that waste collection and cleanliness services may need attention.',
  },

  'Public Property & Surfaces': {
    condition: 'Fair',
    index: 60,
    investmentStatus: 'Monitoring required',
    investmentNote:
      'Repeated public-surface complaints may require inspection and maintenance.',
  },

  'Urban Zoning & Sound Barriers': {
    condition: 'Fair',
    index: 58,
    investmentStatus: 'Assessment recommended',
    investmentNote:
      'Noise-related reports may require local assessment and appropriate mitigation measures.',
  },

  'Public Safety Infrastructure': {
    condition: 'Fair',
    index: 50,
    investmentStatus: 'Priority assessment',
    investmentNote:
      'Public-safety reports indicate that affected infrastructure may require inspection.',
  },

  'Water Supply & Drainage': {
    condition: 'Poor',
    index: 40,
    investmentStatus: 'Priority maintenance',
    investmentNote:
      'Water and drainage complaints may indicate a need for infrastructure inspection and maintenance.',
  },

  'Parks & Recreational Facilities': {
    condition: 'Fair',
    index: 62,
    investmentStatus: 'Improvement recommended',
    investmentNote:
      'Repeated park-related reports may indicate a need for maintenance or facility improvements.',
  },

  'Traffic Control Infrastructure': {
    condition: 'Poor',
    index: 42,
    investmentStatus: 'Priority assessment',
    investmentNote:
      'Traffic-related reports may indicate a need to review traffic-control infrastructure in the affected area.',
  },

  'General Civic Infrastructure': {
    condition: 'Fair',
    index: 55,
    investmentStatus: 'Monitoring required',
    investmentNote:
      'General civic reports should be reviewed alongside other infrastructure indicators.',
  },
};

export function getInfrastructureType(category: string): string {
  return (
    CATEGORY_TO_INFRASTRUCTURE[category] ??
    'General Civic Infrastructure'
  );
}

export function getAffectedInfrastructureTypes(
  categories: string[],
): InfrastructureType[] {
  const seen = new Map<string, string>();

  for (const category of categories) {
    const infrastructureType = getInfrastructureType(category);

    if (!seen.has(infrastructureType)) {
      seen.set(infrastructureType, category);
    }
  }

  return [...seen.entries()].map(([type, category]) => {
    const data =
      INFRASTRUCTURE_DATA[type] ??
      INFRASTRUCTURE_DATA['General Civic Infrastructure'];

    return {
      type,
      category,
      condition: data.condition,
      index: data.index,
      investmentStatus: data.investmentStatus,
      investmentNote: data.investmentNote,
    };
  });
}