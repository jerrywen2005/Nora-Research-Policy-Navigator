import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { ApiError } from '../../api/client'
import type { Analytics, DailyActivity } from '../../api/types'
import { useLoad } from '../researcher/useLoad'
import { analyticsExportUrl, getAnalytics } from './adminApi'
import BarChart, { type Bar } from './charts/BarChart'
import DataTable from './charts/DataTable'
import DonutChart from './charts/DonutChart'
import LineChart from './charts/LineChart'
import { matchingPreset, PRESETS, presetRange, rangeLabel, shortDate } from './dateRange'
import './admin.css'
import './AdminOverview.css'
import './charts/charts.css'

type Outcome = keyof Analytics['questions_by_outcome']

// In the order a reader scans them: answered first, then each way Nora didn't answer.
const OUTCOME_LABELS: Record<Outcome, string> = {
  answered: 'Answered',
  referred: 'Referred to RCS (research, not covered)',
  out_of_scope: 'Not about research (Policy Office)',
  no_answer: 'No answer in the matching policies',
  error: 'AI service failed',
}

type DailyMeasure = Exclude<keyof DailyActivity, 'date'>

const DAILY_MEASURES: { key: DailyMeasure; label: string; unit: string }[] = [
  { key: 'questions', label: 'Questions', unit: 'questions' },
  { key: 'searches', label: 'Searches', unit: 'searches' },
  { key: 'topic_views', label: 'Topic views', unit: 'topic views' },
  { key: 'document_views', label: 'Policy views', unit: 'policy views' },
  { key: 'logins', label: 'Sign-ins', unit: 'sign-ins' },
]

const NO_TOPIC = 'Asked without a topic'

function count(value: number): string {
  return value.toLocaleString('en-US')
}

function percent(share: number): string {
  return `${Math.round(share * 100)}%`
}

// The admin Overview dashboard (F11): every measure in docs/product.md for a date range, from
// GET /api/admin/analytics. Aggregates only (NF6). Route: /admin?from=YYYY-MM-DD&to=YYYY-MM-DD;
// without a range, the API's default (the last 30 days).
export default function AdminOverview() {
  const [params, setParams] = useSearchParams()
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const query = from && to ? { from, to } : {}
  const analytics = useLoad(`${from}|${to}`, () => getAnalytics(query))

  const setRange = (range: { from: string; to: string }) => setParams(range)
  // The range on screen: what the API used, so the default shows its real dates.
  const shown = analytics.status === 'ready' ? analytics.data : null

  return (
    <div className="admin-overview">
      <div className="admin-overview__heading">
        <h1>Overview</h1>
        {shown && <span className="admin-overview__range">{rangeLabel(shown.from, shown.to)}</span>}
      </div>
      <p className="admin-overview__intro">
        How researchers use Nora&apos;s Browse, Search and Ask. Aggregates only: no individual
        researcher is ever shown.
      </p>

      <RangeFilter
        // Reset the custom date inputs whenever the range changes.
        key={shown ? `${shown.from}|${shown.to}` : 'loading'}
        from={shown?.from ?? from}
        to={shown?.to ?? to}
        onChange={setRange}
      />

      <div aria-live="polite">
        {analytics.status === 'loading' && <p className="admin-status">Loading analytics…</p>}
        {analytics.status === 'error' && (
          <p className="admin-status admin-status--error">
            {analytics.error instanceof ApiError && analytics.error.status === 422
              ? 'That date range isn’t valid. The end must be on or after the start, and a range can be at most 366 days.'
              : 'Analytics couldn’t be loaded. Please try again.'}
          </p>
        )}
      </div>
      {shown && <Dashboard data={shown} />}
    </div>
  )
}

function RangeFilter({
  from,
  to,
  onChange,
}: {
  from: string
  to: string
  onChange: (range: { from: string; to: string }) => void
}) {
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)
  const fromId = useId()
  const toId = useId()
  const preset = from && to ? matchingPreset(from, to) : null

  function applyCustom(event: FormEvent) {
    event.preventDefault()
    if (customFrom && customTo) {
      onChange({ from: customFrom, to: customTo })
    }
  }

  return (
    <div className="range-filter">
      <div className="range-filter__presets" role="group" aria-label="Date range">
        {PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            className="range-filter__preset"
            aria-pressed={preset === days}
            onClick={() => onChange(presetRange(days))}
          >
            Last {days} days
          </button>
        ))}
      </div>
      <form className="range-filter__custom" onSubmit={applyCustom}>
        <label htmlFor={fromId}>From</label>
        <input
          id={fromId}
          type="date"
          value={customFrom}
          max={customTo || undefined}
          onChange={(event) => setCustomFrom(event.target.value)}
        />
        <label htmlFor={toId}>To</label>
        <input
          id={toId}
          type="date"
          value={customTo}
          min={customFrom || undefined}
          onChange={(event) => setCustomTo(event.target.value)}
        />
        <button type="submit" className="button button--secondary">
          Apply
        </button>
      </form>
      {from && to && (
        <a className="button range-filter__export" href={analyticsExportUrl({ from, to })} download>
          Download CSV
        </a>
      )}
    </div>
  )
}

function Panel({
  title,
  subtitle,
  wide = false,
  children,
}: {
  title: string
  subtitle: string
  wide?: boolean
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className={wide ? 'panel panel--wide' : 'panel'} aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      <p className="panel__subtitle">{subtitle}</p>
      {children}
    </section>
  )
}

function Empty({ children = 'Nothing in this range yet.' }: { children?: ReactNode }) {
  return <p className="panel__empty">{children}</p>
}

// A ranked list as bars, with its numbers in a table, or an empty note.
function Ranking({
  bars,
  unit,
  caption,
  columns,
  empty,
}: {
  bars: Bar[]
  unit: string
  caption: string
  columns: [string, string]
  empty?: ReactNode
}) {
  if (bars.length === 0) {
    return <Empty>{empty}</Empty>
  }
  return (
    <>
      <BarChart data={bars} unit={unit} />
      <DataTable caption={caption} columns={columns} rows={bars.map((bar) => [bar.label, bar.value])} />
    </>
  )
}

// Questions per topic over the range, split into its first and second half so a topic that's
// generating more questions stands out (measure 9).
function questionsByTopic(data: Analytics) {
  const middle = data.daily[Math.floor(data.daily.length / 2)]?.date ?? data.to
  const totals = new Map<string, { total: number; early: number; late: number }>()
  for (const entry of data.daily_questions_by_topic) {
    const name = entry.topic?.name ?? NO_TOPIC
    const row = totals.get(name) ?? { total: 0, early: 0, late: 0 }
    row.total += entry.count
    if (entry.date < middle) {
      row.early += entry.count
    } else {
      row.late += entry.count
    }
    totals.set(name, row)
  }
  return [...totals.entries()]
    .map(([name, row]) => ({ name, ...row }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

function Dashboard({ data }: { data: Analytics }) {
  const [measure, setMeasure] = useState<DailyMeasure>('questions')
  const daily = DAILY_MEASURES.find((m) => m.key === measure) ?? DAILY_MEASURES[0]
  const outcomes = data.questions_by_outcome
  const questions = data.interactions.questions
  const unanswered = questions - outcomes.answered
  const notHelpful = data.feedback.rated - data.feedback.helpful
  const topics = questionsByTopic(data)
  const longRange = data.daily.length > 120
  const textEmpty = `Nothing used by at least ${data.min_distinct_users} different people in this range yet.`

  return (
    <>
      <ul className="metric-tiles">
        <Tile label="Active users" value={count(data.activity.active_users)}>
          {count(data.activity.logins)} sign-ins
        </Tile>
        <Tile label="Questions asked" value={count(questions)}>
          {questions > 0 ? `${percent(outcomes.answered / questions)} answered` : 'None yet'}
        </Tile>
        <Tile label="Searches" value={count(data.interactions.searches)}>
          {count(data.zero_result_searches.total)} with no results
        </Tile>
        <Tile
          label="Topic & policy views"
          value={count(data.interactions.topic_views + data.interactions.document_views)}
        >
          {count(data.interactions.topic_views)} topics, {count(data.interactions.document_views)}{' '}
          policies
        </Tile>
        <Tile label="Couldn't answer" value={count(unanswered)}>
          {count(outcomes.referred)} to RCS, {count(outcomes.out_of_scope)} not research
        </Tile>
        <Tile
          label="Rated helpful"
          value={data.feedback.helpful_share === null ? '–' : percent(data.feedback.helpful_share)}
        >
          {data.feedback.rated > 0 ? `Of ${count(data.feedback.rated)} rated answers` : 'No ratings yet'}
        </Tile>
      </ul>

      <div className="admin-overview__charts">
        <Panel title="Activity Over Time" subtitle="Per day, across the range" wide>
          <div className="range-filter__presets" role="group" aria-label="Measure">
            {DAILY_MEASURES.map((m) => (
              <button
                key={m.key}
                type="button"
                className="range-filter__preset"
                aria-pressed={measure === m.key}
                onClick={() => setMeasure(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <LineChart
            data={data.daily.map((day) => ({
              label: shortDate(day.date, longRange),
              value: day[measure],
            }))}
            title={(point) => point.label}
            unit={daily.unit}
          />
          <DataTable
            caption={`${daily.label} per day`}
            columns={['Date', daily.label]}
            rows={data.daily.map((day) => [shortDate(day.date, true), day[measure]])}
          />
        </Panel>

        <Panel title="Questions by Topic" subtitle="Which topics generate questions">
          {topics.length === 0 ? (
            <Empty />
          ) : (
            <>
              <BarChart data={topics.map((t) => ({ label: t.name, value: t.total }))} unit="questions" />
              <DataTable
                caption="Questions by topic, first and second half of the range"
                columns={['Topic', 'Questions', 'First half', 'Second half']}
                rows={topics.map((t) => [t.name, t.total, t.early, t.late])}
              />
            </>
          )}
        </Panel>

        <Panel title="Answer Outcomes" subtitle="What Nora did with each question">
          {questions === 0 ? (
            <Empty />
          ) : (
            <Ranking
              bars={(Object.keys(OUTCOME_LABELS) as Outcome[]).map((key) => ({
                label: OUTCOME_LABELS[key],
                value: outcomes[key],
              }))}
              unit="questions"
              caption="Questions by outcome"
              columns={['Outcome', 'Questions']}
            />
          )}
        </Panel>

        <Panel title="Referrals by Office" subtitle="Offices Nora sent researchers to">
          <Ranking
            bars={data.referrals_by_office.map((r) => ({ label: r.office.name, value: r.count }))}
            unit="referrals"
            caption="Referrals by office"
            columns={['Office', 'Referrals']}
          />
        </Panel>

        <Panel title="Feedback Overview" subtitle="Ratings on answers asked in the range">
          {data.feedback.rated === 0 || data.feedback.helpful_share === null ? (
            <Empty>No answers have been rated in this range yet.</Empty>
          ) : (
            <>
              <DonutChart
                data={[
                  { label: 'Helpful', value: data.feedback.helpful, color: 'var(--chart-series-1)' },
                  { label: 'Not helpful', value: notHelpful, color: 'var(--chart-series-2)' },
                ]}
                centerValue={percent(data.feedback.helpful_share)}
                centerLabel="helpful"
                unit="ratings"
              />
              <DataTable
                caption="Answer ratings"
                columns={['Rating', 'Count']}
                rows={[
                  ['Helpful', data.feedback.helpful],
                  ['Not helpful', notHelpful],
                ]}
              />
            </>
          )}
        </Panel>

        <Panel title="Most Viewed Topics" subtitle="Topic pages opened">
          <Ranking
            bars={data.top_topics.map((t) => ({ label: t.topic.name, value: t.count }))}
            unit="views"
            caption="Most viewed topics"
            columns={['Topic', 'Views']}
          />
        </Panel>

        <Panel title="Most Viewed Policies" subtitle="Policy pages opened">
          <Ranking
            bars={data.top_documents.map((d) => ({ label: d.title, value: d.count }))}
            unit="views"
            caption="Most viewed policies"
            columns={['Policy', 'Views']}
          />
        </Panel>

        <Panel title="Most Cited Policies" subtitle="Policies Nora's answers cited">
          <Ranking
            bars={data.most_cited_documents.map((d) => ({ label: d.title, value: d.count }))}
            unit="citations"
            caption="Most cited policies"
            columns={['Policy', 'Citations']}
          />
        </Panel>

        <Panel title="Top Search Terms" subtitle="What researchers search for">
          <Ranking
            bars={data.top_search_terms.map((t) => ({ label: t.text, value: t.count }))}
            unit="searches"
            caption="Top search terms"
            columns={['Search term', 'Searches']}
            empty={textEmpty}
          />
        </Panel>

        <Panel
          title="Searches With No Results"
          subtitle={`${count(data.zero_result_searches.total)} searches found nothing. Candidates for new content or tags.`}
        >
          <Ranking
            bars={data.zero_result_searches.top_terms.map((t) => ({ label: t.text, value: t.count }))}
            unit="searches"
            caption="Search terms with no results"
            columns={['Search term', 'Searches']}
            empty={textEmpty}
          />
        </Panel>

        <Panel title="Most Asked Questions" subtitle="Candidates for FAQs" wide>
          <Ranking
            bars={data.top_questions.map((q) => ({ label: q.text, value: q.count }))}
            unit="times asked"
            caption="Most asked questions"
            columns={['Question', 'Times asked']}
            empty={textEmpty}
          />
        </Panel>
      </div>

      <p className="admin-overview__footnote">
        Search terms and questions are listed only when at least {data.min_distinct_users}{' '}
        different people used the same text, so no one&apos;s individual question appears; rarer
        ones still count in the totals.
      </p>
    </>
  )
}

function Tile({ label, value, children }: { label: string; value: string; children: ReactNode }) {
  return (
    <li className="metric-tile">
      <span className="metric-tile__label">{label}</span>
      <span className="metric-tile__value">{value}</span>
      <span className="metric-tile__note">{children}</span>
    </li>
  )
}
