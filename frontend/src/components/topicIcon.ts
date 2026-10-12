import type { IconName } from './Icon'

// Topic has no icon field in the API, so icons are chosen here by slug.
const topicIcons: Record<string, IconName> = {
  'human-subjects-research': 'people',
  'clinical-research': 'clipboard',
  'conflict-of-interest': 'scale',
  'research-integrity': 'shield',
  'sponsored-programs': 'funding',
  'research-operations': 'database',
  'animal-care-and-use': 'paw',
  'international-research-and-security': 'globe',
  'postdoctoral-affairs': 'graduation',
}

export function topicIcon(slug: string): IconName {
  return topicIcons[slug] ?? 'folder'
}
