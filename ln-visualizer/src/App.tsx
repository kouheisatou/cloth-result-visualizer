import { useState, useMemo, useCallback } from 'react';
import { DataLoader } from './components/DataLoader';
import { NetworkGraph } from './components/NetworkGraph';
import { TimelineControl } from './components/TimelineControl';
import { PaymentDetails } from './components/PaymentDetails';
import { StatsPanel } from './components/StatsPanel';
import { 
  parseNodes, 
  parseChannels, 
  parseEdges, 
  parsePayments, 
  parseConfig,
  generateTimelineEvents 
} from './utils/dataParser';
import type { Node, Channel, Edge, Payment, SimulationConfig, TimelineEvent } from './types';
import './App.css';

interface SimulationData {
  nodes: Node[];
  channels: Channel[];
  edges: Edge[];
  payments: Payment[];
  config: SimulationConfig;
  events: TimelineEvent[];
}

function App() {
  const [data, setData] = useState<SimulationData | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [selectedAttemptIndex, setSelectedAttemptIndex] = useState<number | undefined>();
  const [showStats, setShowStats] = useState(true);

  const handleDataLoaded = useCallback((rawData: {
    nodesContent: string;
    channelsContent: string;
    edgesContent: string;
    paymentsContent: string;
    configContent: string;
  }) => {
    try {
      const nodes = parseNodes(rawData.nodesContent);
      const channels = parseChannels(rawData.channelsContent);
      const edges = parseEdges(rawData.edgesContent);
      const payments = parsePayments(rawData.paymentsContent);
      const config = parseConfig(rawData.configContent);
      const events = generateTimelineEvents(payments);

      setData({ nodes, channels, edges, payments, config, events });
      setCurrentStepIndex(0);
      setSelectedPayment(null);
    } catch (error) {
      console.error('Failed to parse data:', error);
      alert('データの解析に失敗しました。ファイル形式を確認してください。');
    }
  }, []);

  // Get current events at the current step
  const currentEvents = useMemo(() => {
    if (!data) return [];
    const currentTime = data.events[currentStepIndex]?.time ?? 0;
    // Return events at the current time
    return data.events.filter(e => e.time === currentTime);
  }, [data, currentStepIndex]);

  const handlePaymentSelect = useCallback((payment: Payment | null) => {
    setSelectedPayment(payment);
    setSelectedAttemptIndex(undefined);
  }, []);

  const handleAttemptSelect = useCallback((attemptIndex: number) => {
    setSelectedAttemptIndex(attemptIndex);
  }, []);

  const handleReset = useCallback(() => {
    setData(null);
    setCurrentStepIndex(0);
    setSelectedPayment(null);
    setSelectedAttemptIndex(undefined);
  }, []);

  if (!data) {
    return <DataLoader onDataLoaded={handleDataLoaded} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚡ Lightning Network Visualizer</h1>
        <div className="header-actions">
          <button onClick={() => setShowStats(!showStats)} className="toggle-stats">
            {showStats ? '統計を隠す' : '統計を表示'}
          </button>
          <button onClick={handleReset} className="reset-btn">
            別のデータを読み込む
          </button>
        </div>
      </header>

      <main className="app-main">
        <div className="left-panel">
          {showStats && (
            <StatsPanel payments={data.payments} config={data.config} />
          )}
          <TimelineControl
            events={data.events}
            payments={data.payments}
            currentStepIndex={currentStepIndex}
            onStepChange={setCurrentStepIndex}
            onPaymentSelect={handlePaymentSelect}
          />
        </div>

        <div className="center-panel">
          <NetworkGraph
            channels={data.channels}
            edges={data.edges}
            payments={data.payments}
            currentEvents={currentEvents}
            selectedPayment={selectedPayment}
          />
        </div>

        <div className="right-panel">
          <PaymentDetails
            payment={selectedPayment}
            edges={data.edges}
            onAttemptSelect={handleAttemptSelect}
            selectedAttemptIndex={selectedAttemptIndex}
          />
        </div>
      </main>
    </div>
  );
}

export default App;
