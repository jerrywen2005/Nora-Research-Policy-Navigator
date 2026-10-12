// Placeholder content for the researcher pages until GET /api/topics, GET /api/documents and
// POST /api/ask exist (see docs/api.md). Topic names follow the client mockup; slugs, offices,
// contact details and document text are stand-ins, not approved Research Policy Repository content.
import type { DocumentDetail, Office, TopicDetail } from '../../api/types'

const ohre: Office = {
  id: 1,
  name: 'Office of Human Research Ethics',
  email: 'irb@example.unc.edu',
  phone: '919-000-0001',
  url: 'https://research.unc.edu/human-research-ethics/',
}
const clinical: Office = {
  id: 2,
  name: 'Office of Clinical Trials',
  email: 'clinicaltrials@example.unc.edu',
  phone: '919-000-0002',
  url: null,
}
const coi: Office = {
  id: 3,
  name: 'Conflict of Interest Program',
  email: 'coi@example.unc.edu',
  phone: '919-000-0003',
  url: null,
}
const integrity: Office = {
  id: 4,
  name: 'Office of Research Integrity',
  email: 'integrity@example.unc.edu',
  phone: null,
  url: null,
}
const osp: Office = {
  id: 5,
  name: 'Office of Sponsored Programs',
  email: 'osp@example.unc.edu',
  phone: '919-000-0005',
  url: null,
}
const ovcr: Office = {
  id: 6,
  name: 'Office of the Vice Chancellor for Research',
  email: 'research@example.unc.edu',
  phone: '919-000-0006',
  url: 'https://research.unc.edu/',
}
const iacuc: Office = {
  id: 7,
  name: 'Office of Animal Care and Use',
  email: 'iacuc@example.unc.edu',
  phone: null,
  url: null,
}
const security: Office = {
  id: 8,
  name: 'Research Security and Export Controls',
  email: 'exportcontrols@example.unc.edu',
  phone: null,
  url: null,
}
const postdoc: Office = {
  id: 9,
  name: 'Office of Postdoctoral Affairs',
  email: 'postdoc@example.unc.edu',
  phone: null,
  url: null,
}

// The general office referred to when no topic office fits.
export const fallbackOffice = ovcr

export const fakeTopics: TopicDetail[] = [
  {
    id: 1,
    slug: 'human-subjects-research',
    name: 'Human Research & IRB',
    description: 'IRB review, consent, and protections for research participants.',
    document_count: 0,
    office: ohre,
  },
  {
    id: 2,
    slug: 'clinical-research',
    name: 'Clinical Research',
    description: 'Clinical trial registration, reporting, and study conduct.',
    document_count: 0,
    office: clinical,
  },
  {
    id: 3,
    slug: 'conflict-of-interest',
    name: 'Conflict of Interest',
    description: 'Disclosing outside interests and managing conflicts.',
    document_count: 0,
    office: coi,
  },
  {
    id: 4,
    slug: 'research-integrity',
    name: 'Research Integrity',
    description: 'Responsible conduct of research and research misconduct.',
    document_count: 0,
    office: integrity,
  },
  {
    id: 5,
    slug: 'sponsored-programs',
    name: 'Sponsored Programs',
    description: 'Proposals, awards, and managing externally funded projects.',
    document_count: 0,
    office: osp,
  },
  {
    id: 6,
    slug: 'research-operations',
    name: 'Research Operations',
    description: 'Data agreements, research data, and day-to-day research administration.',
    document_count: 0,
    office: ovcr,
  },
  {
    id: 7,
    slug: 'animal-care-and-use',
    name: 'Animal Care & Use',
    description: 'IACUC protocols and the humane use of animals in research.',
    document_count: 0,
    office: iacuc,
  },
  {
    id: 8,
    slug: 'international-research-and-security',
    name: 'International Research & Security',
    description: 'Export controls, foreign collaboration, and research security.',
    document_count: 0,
    office: security,
  },
  {
    id: 9,
    slug: 'postdoctoral-affairs',
    name: 'Postdoctoral Affairs',
    description: 'Appointments, policies, and resources for postdoctoral scholars.',
    document_count: 0,
    office: postdoc,
  },
]

function topicRefs(...slugs: string[]) {
  return fakeTopics
    .filter((topic) => slugs.includes(topic.slug))
    .map(({ id, slug, name }) => ({ id, slug, name }))
}

export const fakeDocuments: DocumentDetail[] = [
  {
    id: 1,
    title: 'Determining If Research Requires IRB Review',
    doc_type: 'guidance',
    citation: 'OHRE Guidance 101',
    source_url: 'https://research.unc.edu/human-research-ethics/',
    summary: 'How to tell whether a project is human subjects research that needs IRB review.',
    office: ohre,
    topics: topicRefs('human-subjects-research'),
    is_authoritative: true,
    last_reviewed_at: '2026-08-01',
    content_text:
      'Research involving living individuals or identifiable private information typically ' +
      'requires IRB review if it meets the federal definition of human subjects research, ' +
      'including data collected through interaction or intervention with individuals.',
  },
  {
    id: 2,
    title: 'Use of Existing Data and Specimens in Research',
    doc_type: 'sop',
    citation: 'OHRE SOP 1301',
    source_url: 'https://research.unc.edu/human-research-ethics/',
    summary: 'When research using existing data needs IRB review.',
    office: ohre,
    topics: topicRefs('human-subjects-research', 'research-operations'),
    is_authoritative: true,
    last_reviewed_at: '2026-08-01',
    content_text:
      'If a study uses existing data that are de-identified and the investigator cannot link ' +
      'the data to individuals, IRB review may not be required. Identifiable data generally ' +
      'require review.',
  },
  {
    id: 3,
    title: '45 CFR 46.102: Definitions (Human Subject)',
    doc_type: 'webpage',
    citation: '45 CFR 46.102',
    source_url:
      'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-46/subpart-A/section-46.102',
    summary: 'The federal definitions of research and human subject used for IRB decisions.',
    office: ohre,
    topics: topicRefs('human-subjects-research'),
    is_authoritative: true,
    last_reviewed_at: '2026-06-15',
    content_text:
      'Human subject means a living individual about whom an investigator conducting research ' +
      'obtains information through intervention or interaction, or obtains identifiable ' +
      'private information.',
  },
  {
    id: 4,
    title: 'Informed Consent Requirements',
    doc_type: 'guidance',
    citation: 'OHRE Guidance 210',
    source_url: 'https://research.unc.edu/human-research-ethics/',
    summary: 'The elements of informed consent and when consent can be waived.',
    office: ohre,
    topics: topicRefs('human-subjects-research', 'clinical-research'),
    is_authoritative: true,
    last_reviewed_at: '2026-07-20',
    content_text:
      'Consent documents must describe the purpose, risks, benefits, and voluntary nature of ' +
      'participation. The IRB may approve a waiver of consent under limited conditions.',
  },
  {
    id: 5,
    title: 'Exempt Research Categories',
    doc_type: 'faq',
    citation: 'OHRE FAQ 14',
    source_url: 'https://research.unc.edu/human-research-ethics/',
    summary: 'Which kinds of low-risk research may qualify for an exemption.',
    office: ohre,
    topics: topicRefs('human-subjects-research'),
    is_authoritative: false,
    last_reviewed_at: '2026-05-02',
    content_text:
      'Some low-risk research, such as anonymous surveys, may qualify as exempt. The IRB, not ' +
      'the investigator, makes the exemption determination.',
  },
  {
    id: 6,
    title: 'Registering Clinical Trials',
    doc_type: 'guidance',
    citation: 'OCT Guidance 3',
    source_url: null,
    summary: 'Which clinical trials must be registered and results reported.',
    office: clinical,
    topics: topicRefs('clinical-research'),
    is_authoritative: true,
    last_reviewed_at: '2026-04-11',
    content_text:
      'Applicable clinical trials must be registered before enrolling the first participant ' +
      'and must report results within the required timeframe.',
  },
  {
    id: 7,
    title: 'Disclosing Conflicts of Interest',
    doc_type: 'policy',
    citation: 'COI Policy 1',
    source_url: null,
    summary: 'When and how researchers disclose outside financial interests.',
    office: coi,
    topics: topicRefs('conflict-of-interest'),
    is_authoritative: true,
    last_reviewed_at: '2026-03-30',
    content_text:
      'Investigators disclose significant financial interests related to their institutional ' +
      'responsibilities annually and whenever a new interest arises.',
  },
  {
    id: 8,
    title: 'Responding to Allegations of Research Misconduct',
    doc_type: 'policy',
    citation: 'RI Policy 2',
    source_url: null,
    summary: 'How allegations of fabrication, falsification, or plagiarism are handled.',
    office: integrity,
    topics: topicRefs('research-integrity'),
    is_authoritative: true,
    last_reviewed_at: '2026-02-14',
    content_text:
      'Allegations of research misconduct are reviewed through inquiry and investigation ' +
      'phases, with protections for complainants and respondents.',
  },
  {
    id: 9,
    title: 'Proposal Submission Deadlines',
    doc_type: 'guidance',
    citation: 'OSP Guidance 5',
    source_url: null,
    summary: 'Internal deadlines for routing proposals before the sponsor deadline.',
    office: osp,
    topics: topicRefs('sponsored-programs'),
    is_authoritative: true,
    last_reviewed_at: '2026-09-01',
    content_text:
      'Complete proposals should be routed to the sponsored programs office several business ' +
      'days before the sponsor deadline to allow for review.',
  },
  {
    id: 10,
    title: 'Data Use Agreements',
    doc_type: 'job_aid',
    citation: 'OVCR Job Aid 8',
    source_url: null,
    summary: 'When a data use agreement is needed to share or receive research data.',
    office: ovcr,
    topics: topicRefs('research-operations', 'human-subjects-research'),
    is_authoritative: false,
    last_reviewed_at: '2026-06-03',
    content_text:
      'A data use agreement is typically needed before receiving or sharing data that are not ' +
      'publicly available, including limited data sets.',
  },
  {
    id: 11,
    title: 'IACUC Protocol Approval',
    doc_type: 'guidance',
    citation: 'IACUC Guidance 1',
    source_url: null,
    summary: 'Animal use protocols must be approved before work begins.',
    office: iacuc,
    topics: topicRefs('animal-care-and-use'),
    is_authoritative: true,
    last_reviewed_at: '2026-01-20',
    content_text:
      'All research, teaching, or testing involving live vertebrate animals requires an ' +
      'approved IACUC protocol before animals are acquired or used.',
  },
  {
    id: 12,
    title: 'Export Controls and International Collaboration',
    doc_type: 'guidance',
    citation: 'RSEC Guidance 4',
    source_url: null,
    summary: 'When sharing technology or data abroad may need an export review.',
    office: security,
    topics: topicRefs('international-research-and-security'),
    is_authoritative: true,
    last_reviewed_at: '2026-05-18',
    content_text:
      'Shipping items, traveling with equipment, or sharing controlled technical data with ' +
      'foreign persons may require an export control review.',
  },
  {
    id: 13,
    title: 'Postdoctoral Appointment Guidelines',
    doc_type: 'policy',
    citation: 'OPA Policy 1',
    source_url: null,
    summary: 'Appointment terms, benefits, and mentoring expectations for postdocs.',
    office: postdoc,
    topics: topicRefs('postdoctoral-affairs'),
    is_authoritative: true,
    last_reviewed_at: '2026-07-07',
    content_text:
      'Postdoctoral appointments are made for a fixed term with an individual mentoring plan ' +
      'reviewed each year.',
  },
]

for (const topic of fakeTopics) {
  topic.document_count = fakeDocuments.filter((doc) =>
    doc.topics.some((ref) => ref.slug === topic.slug),
  ).length
}

export const fakeDisclaimer =
  'Nora provides general information, not an official determination. Contact the responsible ' +
  'office for a formal review.'
