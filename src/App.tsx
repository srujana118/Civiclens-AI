import { BrowserRouter, Routes, Route } from 'react-router-dom';

import Layout from '@/components/Layout';

import Home from '@/pages/Home';
import ReportIssue from '@/pages/ReportIssue';
import Intelligence from '@/pages/Intelligence';
import MapPage from '@/pages/MapPage';
import Trends from '@/pages/Trends';
import Insights from '@/pages/Insights';
import PolicyDashboard from '@/pages/PolicyDashboard';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>

          <Route path="/" element={<Home />} />

          <Route
            path="/report"
            element={<ReportIssue />}
          />

          <Route
            path="/intelligence"
            element={<Intelligence />}
          />

          <Route
            path="/map"
            element={<MapPage />}
          />

          <Route
            path="/trends"
            element={<Trends />}
          />

          <Route
            path="/insights"
            element={<Insights />}
          />

          {/* GOVERNANCE / POLICY DASHBOARD */}
          <Route
            path="/policy"
            element={<PolicyDashboard />}
          />

        </Routes>
      </Layout>
    </BrowserRouter>
  );
}