import { useState, useMemo, useCallback, useTransition } from 'react';
import { DataLoader } from './components/DataLoader';
import { NetworkGraph } from './components/NetworkGraph';
import { TimelineControl } from './components/TimelineControl';
import { PaymentDetails } from './components/PaymentDetails';
import { GanttChart } from './components/GanttChart';
import { PaymentTree } from './components/PaymentTree';
import { SimulationOverview } from './components/SimulationOverview';
import { NodeList } from './components/NodeList';
import { ChannelList } from './components/ChannelList';
import { EdgeList } from './components/EdgeList';
import { NodeDetail } from './components/NodeDetail';
import { ChannelDetail } from './components/ChannelDetail';
import { EdgeDetail } from './components/EdgeDetail';
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

type ViewMode = 'overview' | 'network' | 'gantt' | 'tree' | 'nodes' | 'channels' | 'edges';

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
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedNodeId, setSelectedNodeId] = useState<number | null>(null);
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  
  // Handler for view mode changes with transition
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    startTransition(() => {
      setViewMode(mode);
    });
  }, []);

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
    setSelectedNodeId(null);
    setSelectedChannelId(null);
    setSelectedEdgeId(null);
  }, []);

  // Handler for node selection (from list or network graph)
  const handleNodeSelect = useCallback((nodeId: number) => {
    setSelectedNodeId(nodeId);
    // If in network view, stay there; otherwise switch to nodes view
    if (viewMode !== 'network') {
      handleViewModeChange('nodes');
    }
  }, [viewMode, handleViewModeChange]);

  // Handler for channel selection (from list or network graph)
  const handleChannelSelect = useCallback((channelId: number) => {
    setSelectedChannelId(channelId);
    if (viewMode !== 'network') {
      handleViewModeChange('channels');
    }
  }, [viewMode, handleViewModeChange]);

  // Handler for edge selection (from list or network graph)
  const handleEdgeSelect = useCallback((edgeId: number) => {
    setSelectedEdgeId(edgeId);
    if (viewMode !== 'network') {
      handleViewModeChange('edges');
    }
  }, [viewMode, handleViewModeChange]);

  // Handler for network graph node click
  const handleNetworkNodeClick = useCallback((nodeId: number) => {
    setSelectedNodeId(nodeId);
    setSelectedChannelId(null);
    setSelectedEdgeId(null);
  }, []);

  // Handler for network graph edge click - converts edge to channel
  const handleNetworkEdgeClick = useCallback((edgeId: number) => {
    if (!data) return;
    const edge = data.edges.find(e => e.id === edgeId);
    if (edge) {
      setSelectedChannelId(edge.channelId);
      setSelectedEdgeId(edgeId);
      setSelectedNodeId(null);
    }
  }, [data]);

  if (!data) {
    return <DataLoader onDataLoaded={handleDataLoaded} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>⚡ Lightning Network Visualizer</h1>
        <div className="header-actions">
          <div className="view-toggle">
            <button 
              className={`view-btn ${viewMode === 'overview' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('overview')}
              disabled={isPending}
            >
              概要
            </button>
            <button 
              className={`view-btn ${viewMode === 'network' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('network')}
              disabled={isPending}
            >
              ネットワーク {isPending && viewMode !== 'network' && '...'}
            </button>
            <button 
              className={`view-btn ${viewMode === 'nodes' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('nodes')}
              disabled={isPending}
            >
              ノード
            </button>
            <button 
              className={`view-btn ${viewMode === 'channels' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('channels')}
              disabled={isPending}
            >
              チャネル
            </button>
            <button 
              className={`view-btn ${viewMode === 'edges' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('edges')}
              disabled={isPending}
            >
              エッジ
            </button>
            <button 
              className={`view-btn ${viewMode === 'gantt' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('gantt')}
              disabled={isPending}
            >
              ガントチャート
            </button>
            <button 
              className={`view-btn ${viewMode === 'tree' ? 'active' : ''}`}
              onClick={() => handleViewModeChange('tree')}
              disabled={isPending}
            >
              ペイメント一覧
            </button>
          </div>
          <button onClick={handleReset} className="reset-btn">
            別のデータを読み込む
          </button>
        </div>
      </header>

      {viewMode === 'overview' ? (
        <main className="app-main overview-view">
          <div className="overview-main-panel">
            <SimulationOverview
              payments={data.payments}
              config={data.config}
              nodes={data.nodes}
              channels={data.channels}
              edges={data.edges}
            />
          </div>
        </main>
      ) : viewMode === 'network' ? (
        <main className="app-main">
          <div className="left-panel">
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
              onNodeClick={handleNetworkNodeClick}
              onEdgeClick={handleNetworkEdgeClick}
            />
          </div>

          <div className="right-panel">
            {selectedNodeId !== null ? (
              <NodeDetail
                nodeId={selectedNodeId}
                nodes={data.nodes}
                edges={data.edges}
                channels={data.channels}
                payments={data.payments}
                onEdgeClick={(edgeId) => {
                  setSelectedEdgeId(edgeId);
                  setSelectedNodeId(null);
                  setSelectedChannelId(null);
                }}
                onChannelClick={(channelId) => {
                  setSelectedChannelId(channelId);
                  setSelectedNodeId(null);
                  setSelectedEdgeId(null);
                }}
              />
            ) : selectedChannelId !== null ? (
              <ChannelDetail
                channelId={selectedChannelId}
                channels={data.channels}
                edges={data.edges}
                payments={data.payments}
                onNodeClick={(nodeId) => {
                  setSelectedNodeId(nodeId);
                  setSelectedChannelId(null);
                  setSelectedEdgeId(null);
                }}
                onEdgeClick={(edgeId) => {
                  setSelectedEdgeId(edgeId);
                  setSelectedChannelId(null);
                  setSelectedNodeId(null);
                }}
              />
            ) : selectedEdgeId !== null ? (
              <EdgeDetail
                edgeId={selectedEdgeId}
                edges={data.edges}
                channels={data.channels}
                payments={data.payments}
                onNodeClick={(nodeId) => {
                  setSelectedNodeId(nodeId);
                  setSelectedEdgeId(null);
                  setSelectedChannelId(null);
                }}
                onChannelClick={(channelId) => {
                  setSelectedChannelId(channelId);
                  setSelectedEdgeId(null);
                  setSelectedNodeId(null);
                }}
              />
            ) : (
              <PaymentDetails
                payment={selectedPayment}
                edges={data.edges}
                onAttemptSelect={handleAttemptSelect}
                selectedAttemptIndex={selectedAttemptIndex}
              />
            )}
          </div>
        </main>
      ) : viewMode === 'nodes' ? (
        <main className="app-main entity-view">
          <div className="entity-list-panel">
            <NodeList
              nodes={data.nodes}
              edges={data.edges}
              channels={data.channels}
              payments={data.payments}
              onNodeSelect={handleNodeSelect}
              selectedNodeId={selectedNodeId ?? undefined}
            />
          </div>
          <div className="entity-detail-panel">
            <NodeDetail
              nodeId={selectedNodeId}
              nodes={data.nodes}
              edges={data.edges}
              channels={data.channels}
              payments={data.payments}
              onEdgeClick={handleEdgeSelect}
              onChannelClick={handleChannelSelect}
            />
          </div>
        </main>
      ) : viewMode === 'channels' ? (
        <main className="app-main entity-view">
          <div className="entity-list-panel">
            <ChannelList
              channels={data.channels}
              edges={data.edges}
              payments={data.payments}
              onChannelSelect={handleChannelSelect}
              selectedChannelId={selectedChannelId ?? undefined}
            />
          </div>
          <div className="entity-detail-panel">
            <ChannelDetail
              channelId={selectedChannelId}
              channels={data.channels}
              edges={data.edges}
              payments={data.payments}
              onNodeClick={handleNodeSelect}
              onEdgeClick={handleEdgeSelect}
            />
          </div>
        </main>
      ) : viewMode === 'edges' ? (
        <main className="app-main entity-view">
          <div className="entity-list-panel">
            <EdgeList
              edges={data.edges}
              channels={data.channels}
              payments={data.payments}
              onEdgeSelect={handleEdgeSelect}
              selectedEdgeId={selectedEdgeId ?? undefined}
            />
          </div>
          <div className="entity-detail-panel">
            <EdgeDetail
              edgeId={selectedEdgeId}
              edges={data.edges}
              channels={data.channels}
              payments={data.payments}
              onNodeClick={handleNodeSelect}
              onChannelClick={handleChannelSelect}
            />
          </div>
        </main>
      ) : viewMode === 'gantt' ? (
        <main className="app-main gantt-view">
          <div className="gantt-main-panel">
            <GanttChart 
              payments={data.payments}
              onPaymentSelect={handlePaymentSelect}
              selectedPaymentId={selectedPayment?.id}
            />
          </div>
          <div className="gantt-side-panel">
            <PaymentDetails
              payment={selectedPayment}
              edges={data.edges}
              onAttemptSelect={handleAttemptSelect}
              selectedAttemptIndex={selectedAttemptIndex}
            />
          </div>
        </main>
      ) : (
        <main className="app-main tree-view">
          <div className="tree-main-panel">
            <PaymentTree 
              payments={data.payments}
              onPaymentSelect={handlePaymentSelect}
              selectedPaymentId={selectedPayment?.id}
            />
          </div>
          <div className="tree-side-panel">
            <PaymentDetails
              payment={selectedPayment}
              edges={data.edges}
              onAttemptSelect={handleAttemptSelect}
              selectedAttemptIndex={selectedAttemptIndex}
            />
          </div>
        </main>
      )}
    </div>
  );
}

export default App;
