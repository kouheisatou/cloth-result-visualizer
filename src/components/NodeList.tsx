import { useState, useMemo } from 'react';
import type { Node, Edge, Channel, Payment } from '../types';
import './EntityList.css';

interface NodeListProps {
  nodes: Node[];
  edges: Edge[];
  channels: Channel[];
  payments: Payment[];
  onNodeSelect: (nodeId: number) => void;
  selectedNodeId?: number;
}

interface NodeStats {
  nodeId: number;
  edgeCount: number;
  channelCount: number;
  totalCapacity: number;
  paymentsSent: number;
  paymentsReceived: number;
  successRate: number;
}

export function NodeList({ 
  nodes, 
  edges: _edges, 
  channels, 
  payments, 
  onNodeSelect, 
  selectedNodeId 
}: NodeListProps) {
  // _edges is used in the interface but stats are derived from node.openEdges
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'edges' | 'capacity' | 'payments'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Calculate stats for each node
  const nodeStats = useMemo((): NodeStats[] => {
    const stats: Map<number, NodeStats> = new Map();

    // Initialize all nodes
    for (const node of nodes) {
      stats.set(node.id, {
        nodeId: node.id,
        edgeCount: node.openEdges.length,
        channelCount: 0,
        totalCapacity: 0,
        paymentsSent: 0,
        paymentsReceived: 0,
        successRate: 0,
      });
    }

    // Count channels and capacity
    for (const channel of channels) {
      const stat1 = stats.get(channel.node1);
      const stat2 = stats.get(channel.node2);
      if (stat1) {
        stat1.channelCount++;
        stat1.totalCapacity += channel.capacity;
      }
      if (stat2) {
        stat2.channelCount++;
        stat2.totalCapacity += channel.capacity;
      }
    }

    // Count payments sent/received
    for (const payment of payments) {
      if (payment.isShard) continue; // Skip shards, count only root payments
      const senderStat = stats.get(payment.senderId);
      const receiverStat = stats.get(payment.receiverId);
      if (senderStat) {
        senderStat.paymentsSent++;
      }
      if (receiverStat) {
        receiverStat.paymentsReceived++;
      }
    }

    // Calculate success rate for each node as sender
    const successCounts = new Map<number, { success: number; total: number }>();
    for (const payment of payments) {
      if (payment.isShard) continue;
      const counts = successCounts.get(payment.senderId) || { success: 0, total: 0 };
      counts.total++;
      if (payment.isSuccess) counts.success++;
      successCounts.set(payment.senderId, counts);
    }

    for (const [nodeId, counts] of successCounts) {
      const stat = stats.get(nodeId);
      if (stat) {
        stat.successRate = counts.total > 0 ? (counts.success / counts.total) * 100 : 0;
      }
    }

    return Array.from(stats.values());
  }, [nodes, channels, payments]);

  // Filter and sort nodes
  const filteredAndSortedNodes = useMemo(() => {
    let result = nodeStats;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(stat => 
        stat.nodeId.toString().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'id':
          comparison = a.nodeId - b.nodeId;
          break;
        case 'edges':
          comparison = a.edgeCount - b.edgeCount;
          break;
        case 'capacity':
          comparison = a.totalCapacity - b.totalCapacity;
          break;
        case 'payments':
          comparison = (a.paymentsSent + a.paymentsReceived) - (b.paymentsSent + b.paymentsReceived);
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [nodeStats, searchTerm, sortBy, sortOrder]);

  const formatCapacity = (capacity: number) => {
    const sats = capacity / 1000;
    if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M`;
    if (sats >= 1_000) return `${(sats / 1_000).toFixed(1)}K`;
    return sats.toFixed(0);
  };

  return (
    <div className="entity-list">
      <div className="entity-list-header">
        <h3>ノード一覧</h3>
        <span className="entity-count">{filteredAndSortedNodes.length} / {nodes.length}</span>
      </div>

      <div className="entity-list-controls">
        <input
          type="text"
          placeholder="ノードIDで検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="sort-controls">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="id">ID順</option>
            <option value="edges">エッジ数</option>
            <option value="capacity">容量</option>
            <option value="payments">取引数</option>
          </select>
          <button 
            className="sort-order-btn"
            onClick={() => setSortOrder(o => o === 'asc' ? 'desc' : 'asc')}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      <div className="entity-list-content">
        {filteredAndSortedNodes.map(stat => (
          <div
            key={stat.nodeId}
            className={`entity-item node-item ${selectedNodeId === stat.nodeId ? 'selected' : ''}`}
            onClick={() => onNodeSelect(stat.nodeId)}
          >
            <div className="entity-item-header">
              <span className="entity-id">Node #{stat.nodeId}</span>
              {stat.successRate > 0 && (
                <span className={`success-badge ${stat.successRate >= 80 ? 'high' : stat.successRate >= 50 ? 'medium' : 'low'}`}>
                  {stat.successRate.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="entity-item-stats">
              <div className="stat">
                <span className="stat-label">エッジ</span>
                <span className="stat-value">{stat.edgeCount}</span>
              </div>
              <div className="stat">
                <span className="stat-label">チャネル</span>
                <span className="stat-value">{stat.channelCount}</span>
              </div>
              <div className="stat">
                <span className="stat-label">容量</span>
                <span className="stat-value capacity">{formatCapacity(stat.totalCapacity)} sats</span>
              </div>
              <div className="stat">
                <span className="stat-label">送信/受信</span>
                <span className="stat-value">{stat.paymentsSent}/{stat.paymentsReceived}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
