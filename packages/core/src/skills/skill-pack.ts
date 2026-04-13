import { Skill } from './store.js';

/**
 * SkillPack: A portable bundle of skills and (optionally) agents.
 * Designed for the "Coastal Marketplace" to allow users to share curated 
 * prompt libraries and AI personalities.
 */
export interface SkillPack {
  metadata: {
    id: string;            // unique identifier (e.g. "coastal-crypto-finance-pack")
    name: string;          // display name
    description: string;
    author: string;
    version: string;
    license?: string;
    tags?: string[];
    isCertified?: boolean; // Reserved for Coastal.AI official packs
  };
  skills: Array<Omit<Skill, 'id' | 'createdAt' | 'updatedAt' | 'enabled'>>;
  agents?: Array<{
    name: string;
    role: string;
    soul: string;
    model?: string;
    voice?: string;
  }>;
}

export class SkillPackManager {
  /**
   * Validates a JSON object against the SkillPack schema.
   */
  static validate(pack: any): pack is SkillPack {
    if (!pack.metadata || !pack.metadata.id || !pack.metadata.name) return false;
    if (!Array.isArray(pack.skills)) return false;
    return true;
  }

  /**
   * Generates a SkillPack from a list of skill IDs.
   */
  static export(
    metadata: SkillPack['metadata'],
    skills: Skill[],
    agents?: SkillPack['agents']
  ): SkillPack {
    return {
      metadata,
      skills: skills.map(s => ({
        name: s.name,
        description: s.description,
        prompt: s.prompt,
        agentId: s.agentId
      })),
      agents
    };
  }
}
