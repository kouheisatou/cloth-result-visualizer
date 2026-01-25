import { useMemo } from 'react';
import type { Channel, Edge, Payment } from '../types';
import './EntityDetail.css';

interface ChannelDetailProps {
  channelId: number | null;
  channels: Channel[];
  edges: Edge[];
  payments: Payment[];
  onNodeClick?: (nodeId: number) => void;
  onEdgeClick?: (edgeId: number) => void;
}

export function ChannelDetail({ 
  channelId, 
  channels, 
  edges, 
  payments,
  onNodeClick,
  onEdgeClick,
}: ChannelDetailProps) {
  const channel = useMemo(() => {
    if (channelId === null) return null;
    return channels.find(ch => ch.id === channelId) || null;
  }, [channelId, channels]);

  // Get channel's edges
  const channelEdges = useMemo(() => {
    if (!channel) return { edge1: null, edge2: null };
    return {
      edge1: edges.find(e => e.id === channel.edge1) || null,
      edge2: edges.find(e => e.id === channel.edge2) || null,
    };
  }, [channel, edges]);

  // Calculate usage stats
  const usageStats = useMemo(() => {
    if (!channel) return { usageCount: 0, failureCount: 0, payments: [] as number[] };
    
    const edgeIds = new Set([channel.edge1, channel.edge2]);
    let usageCount = 0;
    let failureCount = 0;
    const paymentIds = new Set<number>();

    for (const payment of payments) {
      for (const attempt of payment.attemptsHistory) {
        let usedInAttempt = false;
        for (const hop of attempt.route || []) {
          if (edgeIds.has(hop.edge_id)) {
            usedInAttempt = true;
            break;
          }
        }
        if (usedInAttempt) {
          usageCount++;
          paymentIds.add(payment.id);
        }
        if (attempt.error_edge > 0 && edgeIds.has(attempt.error_edge)) {
          failureCount++;
        }
      }
    }

    return { 
      usageCount, 
      failureCount, 
      payments: Array.from(paymentIds).slice(0, 20) 
    };
  }, [channel, payments]);

  const formatCapacity = (msats: number) => {
    const sats = msats / 1000;
    if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M sats`;
    if (sats >= 1_000) return `${(sats / 1_000).toFixed(2)}K sats`;
    return `${sats.toFixed(0)} sats`;
  };

  if (!channel) {
    return (
      <div className="entity-detail empty">
        <p>チャネルを選択してください</p>
        <p className="hint">左のリストからチャネルをクリック、またはネットワークグラフのリンクをクリックしてください</p>
      </div>
    );
  }

  const balanceRatio = channelEdges.edge1 && channelEdges.edge2
    ? (channelEdges.edge1.balance / (channelEdges.edge1.balance + channelEdges.edge2.balance)) * 100
    : 50;

  return (
    <div className="entity-detail">
      <div className="detail-header">
        <h3>Channel #{channel.id}</h3>
        <span className={`status-badge ${channel.isClosed ? 'closed' : 'open'}`}>
          {channel.isClosed ? 'クローズ' : 'オープン'}
        </span>
      </div>

      <div className="detail-section">
        <h4>接続ノード</h4>
        <div className="channel-connection">
          <div 
            className="connection-node clickable"
            onClick={() => onNodeClick?.(channel.node1)}
          >
            <span className="node-label">Node #{channel.node1}</span>
            {channelEdges.edge1 && (
              <span className="node-balance">{formatCapacity(channelEdges.edge1.balance)}</span>
            )}
          </div>
          <div className="connection-arrow">↔</div>
          <div 
            className="connection-node clickable"
            onClick={() => onNodeClick?.(channel.node2)}
          >
            <span className="node-label">Node #{channel.node2}</span>
            {channelEdges.edge2 && (
              <span className="node-balance">{formatCapacity(channelEdges.edge2.balance)}</span>
            )}
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h4>残高分布</h4>
        <div className="balance-bar">
          <div 
            className="balance-fill node1" 
            style={{ width: `${balanceRatio}%` }}
          />
          <div 
            className="balance-fill node2" 
            style={{ width: `${100 - balanceRatio}%` }}
          />
        </div>
        <div className="balance-labels">
          <span>Node #{channel.node1}: {balanceRatio.toFixed(1)}%</span>
          <span>Node #{channel.node2}: {(100 - balanceRatio).toFixed(1)}%</span>
        </div>
      </div>

      <div className="detail-section">
        <h4>チャネル情報</h4>
        <div className="info-grid">
          <div className="info-item">
            <span className="info-label">総容量</span>
            <span className="info-value">{formatCapacity(channel.capacity)}</span>
          </div>
          <div className="info-item">
            <span className="info-label">使用回数</span>
            <span className="info-value">{usageStats.usageCount}</span>
          </div>
          <div className="info-item">
            <span className="info-label">失敗回数</span>
            <span className={`info-value ${usageStats.failureCount > 0 ? 'error' : ''}`}>
              {usageStats.failureCount}
            </span>
          </div>
          <div className="info-item">
            <span className="info-label">利用ペイメント数</span>
            <span className="info-value">{usageStats.payments.length}</span>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h4>エッジ情報</h4>
        <div className="edges-info">
          {channelEdges.edge1 && (
            <div 
              className="edge-info clickable"
              onClick={() => onEdgeClick?.(channelEdges.edge1!.id)}
            >
              <div className="edge-header">
                <span className="edge-id">Edge #{channelEdges.edge1.id}</span>
                <span className="edge-direction">Node #{channel.node1} → Node #{channel.node2}</span>
              </div>
              <div className="edge-details">
                <div className="detail-row">
                  <span>残高:</span>
                  <span className="value">{formatCapacity(channelEdges.edge1.balance)}</span>
                </div>
                <div className="detail-row">
                  <span>基本手数料:</span>
                  <span className="value">{channelEdges.edge1.feeBase} msat</span>
                </div>
                <div className="detail-row">
                  <span>比例手数料:</span>
                  <span className="value">{channelEdges.edge1.feeProportional} ppm</span>
                </div>
                <div className="detail-row">
                  <span>更新回数:</span>
                  <span className="value">{channelEdges.edge1.channelUpdates}</span>
                </div>
              </div>
            </div>
          )}
          {channelEdges.edge2 && (
            <div 
              className="edge-info clickable"
              onClick={() => onEdgeClick?.(channelEdges.edge2!.id)}
            >
              <div className="edge-header">
                <span className="edge-id">Edge #{channelEdges.edge2.id}</span>
                <span className="edge-direction">Node #{channel.node2} → Node #{channel.node1}</span>
              </div>
              <div className="edge-details">
                <div className="detail-row">
                  <span>残高:</span>
                  <span className="value">{formatCapacity(channelEdges.edge2.balance)}</span>
                </div>
                <div className="detail-row">
                  <span>基本手数料:</span>
                  <span className="value">{channelEdges.edge2.feeBase} msat</span>
                </div>
                <div className="detail-row">
                  <span>比例手数料:</span>
                  <span className="value">{channelEdges.edge2.feeProportional} ppm</span>
                </div>
                <div className="detail-row">
                  <span>更新回数:</span>
                  <span className="value">{channelEdges.edge2.channelUpdates}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
