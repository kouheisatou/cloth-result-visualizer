import { useState, useMemo } from 'react';
import type { Channel, Edge, Payment } from '../types';
import './EntityList.css';

interface ChannelListProps {
  channels: Channel[];
  edges: Edge[];
  payments: Payment[];
  onChannelSelect: (channelId: number) => void;
  selectedChannelId?: number;
}

interface ChannelStats {
  channel: Channel;
  edge1: Edge | undefined;
  edge2: Edge | undefined;
  usageCount: number;
  failureCount: number;
}

export function ChannelList({ 
  channels, 
  edges, 
  payments, 
  onChannelSelect, 
  selectedChannelId 
}: ChannelListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'capacity' | 'usage' | 'failures'>('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'closed'>('all');

  // Build edge map
  const edgeMap = useMemo(() => {
    const map = new Map<number, Edge>();
    for (const edge of edges) {
      map.set(edge.id, edge);
    }
    return map;
  }, [edges]);

  // Calculate stats for each channel
  const channelStats = useMemo((): ChannelStats[] => {
    const usageCounts = new Map<number, number>();
    const failureCounts = new Map<number, number>();

    // Count usage and failures from payment attempts
    for (const payment of payments) {
      for (const attempt of payment.attemptsHistory) {
        for (const hop of attempt.route || []) {
          const edge = edgeMap.get(hop.edge_id);
          if (edge) {
            usageCounts.set(edge.channelId, (usageCounts.get(edge.channelId) || 0) + 1);
          }
        }
        if (attempt.error_edge && attempt.error_edge > 0) {
          const errorEdge = edgeMap.get(attempt.error_edge);
          if (errorEdge) {
            failureCounts.set(errorEdge.channelId, (failureCounts.get(errorEdge.channelId) || 0) + 1);
          }
        }
      }
    }

    return channels.map(channel => ({
      channel,
      edge1: edgeMap.get(channel.edge1),
      edge2: edgeMap.get(channel.edge2),
      usageCount: usageCounts.get(channel.id) || 0,
      failureCount: failureCounts.get(channel.id) || 0,
    }));
  }, [channels, edgeMap, payments]);

  // Filter and sort channels
  const filteredAndSortedChannels = useMemo(() => {
    let result = channelStats;

    // Filter by status
    if (filterStatus === 'open') {
      result = result.filter(stat => !stat.channel.isClosed);
    } else if (filterStatus === 'closed') {
      result = result.filter(stat => stat.channel.isClosed);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(stat => 
        stat.channel.id.toString().includes(term) ||
        stat.channel.node1.toString().includes(term) ||
        stat.channel.node2.toString().includes(term)
      );
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'id':
          comparison = a.channel.id - b.channel.id;
          break;
        case 'capacity':
          comparison = a.channel.capacity - b.channel.capacity;
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
  }, [channelStats, searchTerm, sortBy, sortOrder, filterStatus]);

  const formatCapacity = (capacity: number) => {
    const sats = capacity / 1000;
    if (sats >= 1_000_000) return `${(sats / 1_000_000).toFixed(2)}M`;
    if (sats >= 1_000) return `${(sats / 1_000).toFixed(1)}K`;
    return sats.toFixed(0);
  };

  return (
    <div className="entity-list">
      <div className="entity-list-header">
        <h3>チャネル一覧</h3>
        <span className="entity-count">{filteredAndSortedChannels.length} / {channels.length}</span>
      </div>

      <div className="entity-list-controls">
        <input
          type="text"
          placeholder="ID / ノードで検索..."
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
            <option value="capacity">容量順</option>
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
        {filteredAndSortedChannels.map(stat => (
          <div
            key={stat.channel.id}
            className={`entity-item channel-item ${selectedChannelId === stat.channel.id ? 'selected' : ''} ${stat.channel.isClosed ? 'closed' : ''}`}
            onClick={() => onChannelSelect(stat.channel.id)}
          >
            <div className="entity-item-header">
              <span className="entity-id">Channel #{stat.channel.id}</span>
              <span className={`status-badge ${stat.channel.isClosed ? 'closed' : 'open'}`}>
                {stat.channel.isClosed ? 'クローズ' : 'オープン'}
              </span>
            </div>
            <div className="channel-nodes">
              <span className="node-link">Node #{stat.channel.node1}</span>
              <span className="arrow">↔</span>
              <span className="node-link">Node #{stat.channel.node2}</span>
            </div>
            <div className="entity-item-stats">
              <div className="stat">
                <span className="stat-label">容量</span>
                <span className="stat-value capacity">{formatCapacity(stat.channel.capacity)} sats</span>
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
                <span className="stat-label">エッジ</span>
                <span className="stat-value">{stat.channel.edge1} / {stat.channel.edge2}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
