import { useMemo } from 'react';
import type { Node, Edge, Channel, Payment } from '../types';
import './EntityDetail.css';

interface NodeDetailProps {
  nodeId: number | null;
  nodes: Node[];
  edges: Edge[];
  channels: Channel[];
  payments: Payment[];
  onEdgeClick?: (edgeId: number) => void;
  onChannelClick?: (channelId: number) => void;
}

export function NodeDetail({ 
  nodeId, 
  nodes, 
  edges, 
  channels, 
  payments,
  onEdgeClick,
  onChannelClick,
}: NodeDetailProps) {
  const node = useMemo(() => {
    if (nodeId === null) return null;
    return nodes.find(n => n.id === nodeId) || null;
  }, [nodeId, nodes]);

  // Get node's edges and channels
  const nodeEdges = useMemo(() => {
    if (!node) return [];
    return edges.filter(e => e.fromNodeId === node.id || e.toNodeId === node.id);
  }, [node, edges]);

  const nodeChannels = useMemo(() => {
    if (!node) return [];
    return channels.filter(ch => ch.node1 === node.id || ch.node2 === node.id);
  }, [node, channels]);

  // Get payments involving this node
  const nodePayments = useMemo(() => {
    if (!node) return { sent: [] as Payment[], received: [] as Payment[] };
    const sent = payments.filter(p => !p.isShard && p.senderId === node.id);
    const received = payments.filter(p => !p.isShard && p.receiverId === node.id);
    return { sent, received };
  }, [node, payments]);

  // Calculate stats
  const stats = useMemo(() => {
    const totalCapacity = nodeChannels.reduce((sum, ch) => sum + ch.capacity, 0);
    const totalOutbound = nodeEdges
      .filter(e => e.fromNodeId === node?.id)
      .reduce((sum, e) => sum + e.balance, 0);
    const totalInbound = nodeEdges
      .filter(e => e.toNodeId === node?.id)
      .reduce((sum, e) => sum + e.balance, 0);
    
    const sentSuccess = nodePayments.sent.filter(p => p.isSuccess).length;
    const sentTotal = nodePayments.sent.length;
    const receivedSuccess = nodePayments.received.filter(p => p.isSuccess).length;
    const receivedTotal = nodePayments.received.length;

    return {
      totalCapacity,
      totalOutbound,
      totalInbound,
      sentSuccess,
      sentTotal,
      receivedSuccess,
      receivedTotal,
      sendSuccessRate: sentTotal > 0 ? (sentSuccess / sentTotal * 100) : 0,
      receiveSuccessRate: receivedTotal > 0 ? (receivedSuccess / receivedTotal * 100) : 0,
    };
  }, [node, nodeChannels, nodeEdges, nodePayments]);

  const formatCapacity = (msats: number) => {
    const sats = msats / 1000;
    if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M sats`;
    if (sats >= 1_000) return `${(sats / 1_000).toFixed(2)}K sats`;
    return `${sats.toFixed(0)} sats`;
  };

  if (!node) {
    return (
      <div className="entity-detail empty">
        <p>ノードを選択してください</p>
        <p className="hint">左のリストからノードをクリック、またはネットワークグラフのノードをクリックしてください</p>
      </div>
    );
  }

  return (
    <div className="entity-detail">
      <div className="detail-header">
        <h3>Node #{node.id}</h3>
      </div>

      <div className="detail-section">
        <h4>統計情報</h4>
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">総容量</span>
            <span className="stat-value">{formatCapacity(stats.totalCapacity)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">出金可能残高</span>
            <span className="stat-value outbound">{formatCapacity(stats.totalOutbound)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">入金可能残高</span>
            <span className="stat-value inbound">{formatCapacity(stats.totalInbound)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">チャネル数</span>
            <span className="stat-value">{nodeChannels.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">エッジ数</span>
            <span className="stat-value">{nodeEdges.length}</span>
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h4>送金統計</h4>
        <div className="payment-stats">
          <div className="payment-stat">
            <span className="label">送信</span>
            <span className="value">{stats.sentSuccess} / {stats.sentTotal}</span>
            {stats.sentTotal > 0 && (
              <span className={`rate ${stats.sendSuccessRate >= 80 ? 'high' : stats.sendSuccessRate >= 50 ? 'medium' : 'low'}`}>
                ({stats.sendSuccessRate.toFixed(1)}%)
              </span>
            )}
          </div>
          <div className="payment-stat">
            <span className="label">受信</span>
            <span className="value">{stats.receivedSuccess} / {stats.receivedTotal}</span>
            {stats.receivedTotal > 0 && (
              <span className={`rate ${stats.receiveSuccessRate >= 80 ? 'high' : stats.receiveSuccessRate >= 50 ? 'medium' : 'low'}`}>
                ({stats.receiveSuccessRate.toFixed(1)}%)
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="detail-section">
        <h4>チャネル一覧 ({nodeChannels.length})</h4>
        <div className="related-list">
          {nodeChannels.slice(0, 10).map(ch => (
            <div 
              key={ch.id} 
              className="related-item clickable"
              onClick={() => onChannelClick?.(ch.id)}
            >
              <span className="item-id">Ch #{ch.id}</span>
              <span className="item-detail">
                ↔ Node #{ch.node1 === node.id ? ch.node2 : ch.node1}
              </span>
              <span className="item-value">{formatCapacity(ch.capacity)}</span>
            </div>
          ))}
          {nodeChannels.length > 10 && (
            <div className="more-items">...他 {nodeChannels.length - 10} 件</div>
          )}
        </div>
      </div>

      <div className="detail-section">
        <h4>エッジ一覧 ({nodeEdges.length})</h4>
        <div className="related-list">
          {nodeEdges.slice(0, 10).map(edge => (
            <div 
              key={edge.id} 
              className="related-item clickable"
              onClick={() => onEdgeClick?.(edge.id)}
            >
              <span className="item-id">Edge #{edge.id}</span>
              <span className="item-detail">
                {edge.fromNodeId === node.id ? '→' : '←'} Node #{edge.fromNodeId === node.id ? edge.toNodeId : edge.fromNodeId}
              </span>
              <span className="item-value">{formatCapacity(edge.balance)}</span>
            </div>
          ))}
          {nodeEdges.length > 10 && (
            <div className="more-items">...他 {nodeEdges.length - 10} 件</div>
          )}
        </div>
      </div>
    </div>
  );
}
