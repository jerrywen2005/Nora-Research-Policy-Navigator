import BarChart from './charts/BarChart'
import DataTable from './charts/DataTable'
import DonutChart from './charts/DonutChart'
import LineChart from './charts/LineChart'
import { feedback, metrics, questionsByWeek, topTopics } from './sampleData'
import './AdminOverview.css'
import './charts/charts.css'

// Admin dashboard mockup for the Oct 14 demo. Every number comes from
// sampleData.ts; the badge makes that clear on screen.
export default function AdminOverview() {
  const rated = feedback.helpful + feedback.notHelpful

  return (
    <div className="admin-overview">
      <div className="admin-overview__heading">
        <h1>Overview</h1>
        <span className="badge badge--sample">Sample data</span>
      </div>
      <p className="admin-overview__intro">
        Analytics aren't connected yet. These numbers are made up to show the layout.
      </p>

      <ul className="metric-tiles">
        {metrics.map((metric) => (
          <li key={metric.label} className="metric-tile">
            <span className="metric-tile__label">{metric.label}</span>
            <span className="metric-tile__value">{metric.value}</span>
            <span className="metric-tile__note">{metric.note}</span>
          </li>
        ))}
      </ul>

      <div className="admin-overview__charts">
        <section className="panel panel--wide">
          <h2>Questions Over Time</h2>
          <p className="panel__subtitle">Questions asked per week, last 12 weeks</p>
          <LineChart
            data={questionsByWeek.map((week) => ({ label: week.week, value: week.questions }))}
            title={(point) => `Week of ${point.label}`}
            unit="questions"
          />
          <DataTable
            caption="Questions asked per week"
            columns={['Week of', 'Questions']}
            rows={questionsByWeek.map((week) => [week.week, week.questions])}
          />
        </section>

        <section className="panel">
          <h2>Top Topics</h2>
          <p className="panel__subtitle">Questions by topic, last 12 weeks</p>
          <BarChart
            data={topTopics.map((topic) => ({ label: topic.topic, value: topic.questions }))}
            unit="questions"
          />
          <DataTable
            caption="Questions by topic"
            columns={['Topic', 'Questions']}
            rows={topTopics.map((topic) => [topic.topic, topic.questions])}
          />
        </section>

        <section className="panel">
          <h2>Feedback Overview</h2>
          <p className="panel__subtitle">Ratings on answers, last 12 weeks</p>
          <DonutChart
            data={[
              { label: 'Helpful', value: feedback.helpful, color: 'var(--chart-series-1)' },
              { label: 'Not helpful', value: feedback.notHelpful, color: 'var(--chart-series-2)' },
            ]}
            centerValue={`${Math.round((feedback.helpful / rated) * 100)}%`}
            centerLabel="helpful"
            unit="ratings"
          />
          <DataTable
            caption="Answer ratings"
            columns={['Rating', 'Count']}
            rows={[
              ['Helpful', feedback.helpful],
              ['Not helpful', feedback.notHelpful],
            ]}
          />
        </section>
      </div>
    </div>
  )
}
