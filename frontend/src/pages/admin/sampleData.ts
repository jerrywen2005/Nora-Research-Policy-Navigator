// SAMPLE DATA for the admin Overview mockup. Nothing here is real, and the
// page shows a "Sample data" badge. Replace with /api/admin/* calls once those
// endpoints are defined in docs/api.md.

export interface WeeklyCount {
  week: string // axis label for the week's start, e.g. "Jul 20"
  questions: number
}

export interface TopicCount {
  topic: string
  questions: number
}

export const questionsByWeek: WeeklyCount[] = [
  { week: 'Jul 20', questions: 64 },
  { week: 'Jul 27', questions: 71 },
  { week: 'Aug 3', questions: 78 },
  { week: 'Aug 10', questions: 85 },
  { week: 'Aug 17', questions: 92 },
  { week: 'Aug 24', questions: 118 },
  { week: 'Aug 31', questions: 134 },
  { week: 'Sep 7', questions: 126 },
  { week: 'Sep 14', questions: 141 },
  { week: 'Sep 21', questions: 152 },
  { week: 'Sep 28', questions: 147 },
  { week: 'Oct 5', questions: 166 },
]

export const topTopics: TopicCount[] = [
  { topic: 'Human Subjects Research', questions: 312 },
  { topic: 'Sponsored Programs & Grants', questions: 241 },
  { topic: 'Conflict of Interest', questions: 158 },
  { topic: 'Research Data & Security', questions: 134 },
  { topic: 'Export Controls', questions: 97 },
  { topic: 'Animal Research', questions: 72 },
]

export const feedback = {
  helpful: 412,
  notHelpful: 61,
}

const questionsAsked = questionsByWeek.reduce((sum, week) => sum + week.questions, 0)
const answersDelivered = Math.round(questionsAsked * 0.81)
const rated = feedback.helpful + feedback.notHelpful

export interface Metric {
  label: string
  value: string
  note: string
}

export const metrics: Metric[] = [
  {
    label: 'Questions Asked',
    value: questionsAsked.toLocaleString('en-US'),
    note: 'Last 12 weeks',
  },
  {
    label: 'Answers Delivered',
    value: answersDelivered.toLocaleString('en-US'),
    note: `${Math.round((answersDelivered / questionsAsked) * 100)}% answered; the rest referred`,
  },
  { label: 'Active Users', value: '342', note: 'Signed in during the last 12 weeks' },
  { label: 'Policies Published', value: '156', note: 'Active documents in the library' },
  {
    label: 'Positive Feedback',
    value: `${Math.round((feedback.helpful / rated) * 100)}%`,
    note: `Of ${rated.toLocaleString('en-US')} rated answers`,
  },
]
