import { useState, useMemo } from 'react';
import type { Edge, Channel, Payment } from '../types';
import './EntityList.css';

interface EdgeListProps {
  edges: Edge[];
  channels: Channel[];
  payments: Payment[];
  onEdgeSelect: (edgeId: number) => void;
  selectedEdgeId?: number;
}

interface EdgeStats {
  edge: Edge;
  channel: Channel | undefined;
  usageCount: number;
  failureCount: number;
  capacityHistory: CapacityPoint[];
}

interface CapacityPoint {
  time: number;
  capacity: number;
  paymentId: number;
}

export function EdgeList({ 
  edges, 
  channels, 
  payments, 
  onEdgeSelect, 
  selectedEdgeId 
}: EdgeListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'balance' | 'usage' | 'failures'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');

  // Build channel map
  const channelMap = useMemo(() => {
    const map = new Map<number, Channel>();
    for (const channel of channels) {
      map.set(channel.id, channel);
    }
    return map;
  }, [channels]);

  // Calculate stats for each edge including capacity history
  const edgeStats = useMemo((): EdgeStats[] => {
    const usageCounts = new Map<number, number>();
    const failureCounts = new Map<number, number>();
    const capacityHistories = new Map<number, CapacityPoint[]>();

    // Collect usage, failures, and capacity history from payment attempts
    for (const payment of payments) {
      for (const attempt of payment.attemptsHistory) {
        for (const hop of attempt.route || []) {
          // Count usage
          usageCounts.set(hop.edge_id, (usageCounts.get(hop.edge_id) || 0) + 1);
          
          // Record capacity history
          const history = capacityHistories.get(hop.edge_id) || [];
          history.push({
            time: attempt.end_time,
            capacity: hop.edge_cap,
            paymentId: payment.id,
          });
          capacityHistories.set(hop.edge_id, history);
        }
        
        // Count failures
        if (attempt.error_edge && attempt.error_edge > 0) {
          failureCounts.set(attempt.error_edge, (failureCounts.get(attempt.error_edge) || 0) + 1);
        }
      }
    }

    // Sort capacity histories by time
    for (const [edgeId, history] of capacityHistories) {
      history.sort((a, b) => a.time - b.time);
      capacityHistories.set(edgeId, history);
    }

    return edges.map(edge => ({
      edge,
      channel: channelMap.get(edge.channelId),
      usageCount: usageCounts.get(edge.id) || 0,
      failureCount: failureCounts.get(edge.id) || 0,
      capacityHistory: capacityHistories.get(edge.id) || [],
    }));
  }, [edges, channelMap, payments]);

  // Filter and sort edges
  const filteredAndSortedEdges = useMemo(() => {
    let result = edgeStats;

    // Filter by status
    if (filterStatus === 'open') {
      result = result.filter(stat => !stat.edge.isClosed);
    } else if (filterStatus === 'closed') {
      result = result.filter(stat => stat.edge.isClosed);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(stat => 
        stat.edge.id.toString().includes(term) ||
        stat.edge.fromNodeId.toString().includes(term) ||
        stat.edge.toNodeId.toString().includes(term) ||
        stat.edge.channelId.toString().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'id':
          comparison = a.edge.id - b.edge.id;
          break;
        case 'balance':
          comparison = a.edge.balance - b.edge.balance;
          break;
        case 'usage':
          comparison = a.usageCount - b.usageCount;
          break;
        case 'failures':
          comparison = a.failureCount - b.failureCount;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [edgeStats, searchTerm, sortBy, sortOrder, filterStatus]);

  const formatBalance = (balance: number) => {
    const sats = balance / 1000;
    if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M`;
    if (sats >= 1_000) return `${(sats / 1_000).toFixed(1)}K`;
    return sats.toFixed(0);
  };

  return (
    <div className="entity-list">
      <div className="entity-list-header">
        <h3>エッジ一覧</h3>
        <span className="entity-count">{filteredAndSortedEdges.length} / {edges.length}</span>
      </div>

      <div className="entity-list-controls">
        <input
          type="text"
          placeholder="ID / ノード / チャネルで検索..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        <div className="filter-controls">
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          >
            <option value="all">すべて</option>
            <option value="open">オープン</option>
            <option value="closed">クローズ</option>
          </select>
        </div>
        <div className="sort-controls">
          <select 
            value={sortBy} 
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="id">ID順</option>
            <option value="balance">残高順</option>
            <option value="usage">使用回数</option>
            <option value="failures">失敗回数</option>
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
        {filteredAndSortedEdges.map(stat => (
          <div
            key={stat.edge.id}
            className={`entity-item edge-item ${selectedEdgeId === stat.edge.id ? 'selected' : ''} ${stat.edge.isClosed ? 'closed' : ''}`}
            onClick={() => onEdgeSelect(stat.edge.id)}
          >
            <div className="entity-item-header">
              <span className="entity-id">Edge #{stat.edge.id}</span>
              <span className={`status-badge ${stat.edge.isClosed ? 'closed' : 'open'}`}>
                {stat.edge.isClosed ? 'クローズ' : 'オープン'}
              </span>
            </div>
            <div className="edge-direction">
              <span className="node-link">Node #{stat.edge.fromNodeId}</span>
              <span className="arrow">→</span>
              <span className="node-link">Node #{stat.edge.toNodeId}</span>
            </div>
            <div className="entity-item-stats">
              <div className="stat">
                <span className="stat-label">残高</span>
                <span className="stat-value balance">{formatBalance(stat.edge.balance)} sats</span>
              </div>
              <div className="stat">
                <span className="stat-label">使用回数</span>
                <span className="stat-value">{stat.usageCount}</span>
              </div>
              <div className="stat">
                <span className="stat-label">失敗回数</span>
                <span className={`stat-value ${stat.failureCount > 0 ? 'error' : ''}`}>
                  {stat.failureCount}
                </span>
              </div>
              <div className="stat">
                <span className="stat-label">チャネル</span>
                <span className="stat-value">#{stat.edge.channelId}</span>
              </div>
            </div>
            {stat.capacityHistory.length > 0 && (
              <div className="capacity-indicator">
                <span className="indicator-label">容量変化履歴あり</span>
                <span className="indicator-count">{stat.capacityHistory.length}件</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
