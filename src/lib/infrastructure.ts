export type InfrastructureType = {
  type: string;
  category: string;
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

export function getInfrastructureType(category: string): string {
  return CATEGORY_TO_INFRASTRUCTURE[category] ?? 'General Civic Infrastructure';
}

export function getAffectedInfrastructureTypes(categories: string[]): InfrastructureType[] {
  const seen = new Map<string, string>();
  for (const cat of categories) {
    const infraType = getInfrastructureType(cat);
    if (!seen.has(infraType)) {
      seen.set(infraType, cat);
    }
  }
  return [...seen.entries()].map(([type, category]) => ({ type, category }));
}
