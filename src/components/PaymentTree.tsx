import { useState, useMemo, useCallback, type ReactElement } from 'react';
import type { Payment } from '../types';
import { formatSatoshi, formatTime } from '../utils/dataParser';
import './PaymentTree.css';

interface PaymentTreeProps {
  payments: Payment[];
  onPaymentSelect: (payment: Payment | null) => void;
  selectedPaymentId?: number;
}

type SortField = 'id' | 'amount' | 'startTime' | 'endTime' | 'duration' | 'attempts' | 'fee';
type SortOrder = 'asc' | 'desc';
type StatusFilter = 'all' | 'success' | 'failed';
type TypeFilter = 'all' | 'mpp' | 'single' | 'shard';

// Build a map of parent payments with their tree structure
interface TreeNode {
  payment: Payment;
  children: TreeNode[];
  depth: number;
  totalLeafAmount: number;
  leafCount: number;
}

export function PaymentTree({ payments, onPaymentSelect, selectedPaymentId }: PaymentTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<number>>(new Set());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortField, setSortField] = useState<SortField>('id');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [searchQuery, setSearchQuery] = useState('');
  const [amountMin, setAmountMin] = useState('');
  const [amountMax, setAmountMax] = useState('');

  // Pre-process all data on initial load (memoized by payments reference)
  const preprocessedData = useMemo(() => {
    // Create payment map for quick lookup
    const paymentMap = new Map<number, Payment>();
    for (const payment of payments) {
      paymentMap.set(payment.id, payment);
    }

    // Build tree structure recursively
    const buildTree = (payment: Payment, depth: number, cache: Map<number, TreeNode>): TreeNode => {
      // Check cache first
      if (cache.has(payment.id)) {
        return cache.get(payment.id)!;
      }

      const children: TreeNode[] = [];
      let totalLeafAmount = 0;
      let leafCount = 0;

      if (payment.shard1Id >= 0) {
        const shard1 = paymentMap.get(payment.shard1Id);
        if (shard1) {
          const childTree = buildTree(shard1, depth + 1, cache);
          children.push(childTree);
          totalLeafAmount += childTree.totalLeafAmount;
          leafCount += childTree.leafCount;
        }
      }

      if (payment.shard2Id >= 0) {
        const shard2 = paymentMap.get(payment.shard2Id);
        if (shard2) {
          const childTree = buildTree(shard2, depth + 1, cache);
          children.push(childTree);
          totalLeafAmount += childTree.totalLeafAmount;
          leafCount += childTree.leafCount;
        }
      }

      // If no children, this is a leaf node
      if (children.length === 0) {
        totalLeafAmount = payment.amount;
        leafCount = 1;
      }

      const node: TreeNode = {
        payment,
        children,
        depth,
        totalLeafAmount,
        leafCount,
      };

      cache.set(payment.id, node);
      return node;
    };

    // Build tree cache for all payments
    const treeCache = new Map<number, TreeNode>();
    const rootPayments = payments.filter(p => !p.isShard);

    // Pre-build all trees
    for (const payment of rootPayments) {
      buildTree(payment, 0, treeCache);
    }

    // Calculate stats
    const total = rootPayments.length;
    const successful = rootPayments.filter(p => p.isSuccess).length;
    const failed = total - successful;
    const mppPayments = rootPayments.filter(p => p.shard1Id >= 0 || p.shard2Id >= 0).length;
    const singlePayments = total - mppPayments;
    const totalAmount = rootPayments.reduce((sum, p) => sum + p.amount, 0);
    const avgAmount = total > 0 ? totalAmount / total : 0;

    return {
      paymentMap,
      treeCache,
      rootPayments,
      stats: { total, successful, failed, mppPayments, singlePayments, totalAmount, avgAmount }
    };
  }, [payments]);

  // Apply filters (using preprocessed data)
  const filteredPayments = useMemo(() => {
    const { rootPayments } = preprocessedData;
    
    return rootPayments.filter(payment => {
      // Status filter
      if (statusFilter === 'success' && !payment.isSuccess) return false;
      if (statusFilter === 'failed' && payment.isSuccess) return false;

      // Type filter
      const hasMpp = payment.shard1Id >= 0 || payment.shard2Id >= 0;
      if (typeFilter === 'mpp' && !hasMpp) return false;
      if (typeFilter === 'single' && hasMpp) return false;
      if (typeFilter === 'shard' && !payment.isShard) return false;

      // Search query (ID, sender, receiver)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const idMatch = payment.id.toString().includes(query);
        const senderMatch = payment.senderId.toString().includes(query);
        const receiverMatch = payment.receiverId.toString().includes(query);
        if (!idMatch && !senderMatch && !receiverMatch) return false;
      }

      // Amount range filter
      if (amountMin) {
        const min = parseInt(amountMin);
        if (!isNaN(min) && payment.amount < min) return false;
      }
      if (amountMax) {
        const max = parseInt(amountMax);
        if (!isNaN(max) && payment.amount > max) return false;
      }

      return true;
    });
  }, [preprocessedData, statusFilter, typeFilter, searchQuery, amountMin, amountMax]);

  // Sort payments
  const sortedPayments = useMemo(() => {
    const sorted = [...filteredPayments];
    
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'id':
          comparison = a.id - b.id;
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        case 'startTime':
          comparison = a.startTime - b.startTime;
          break;
        case 'endTime':
          comparison = a.endTime - b.endTime;
          break;
        case 'duration':
          comparison = (a.endTime - a.startTime) - (b.endTime - b.startTime);
          break;
        case 'attempts':
          comparison = a.attempts - b.attempts;
          break;
        case 'fee':
          comparison = a.totalFee - b.totalFee;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return sorted;
  }, [filteredPayments, sortField, sortOrder]);

  // Use pre-calculated stats
  const stats = preprocessedData.stats;

  const toggleExpand = useCallback((paymentId: number) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(paymentId)) {
        next.delete(paymentId);
      } else {
        next.add(paymentId);
      }
      return next;
    });
  }, []);

  const handleSortClick = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  }, [sortField]);

  const resetFilters = useCallback(() => {
    setStatusFilter('all');
    setTypeFilter('all');
    setSearchQuery('');
    setAmountMin('');
    setAmountMax('');
  }, []);

  // Count success/fail in tree for MPP payments
  const countTreeStatus = useCallback((node: TreeNode): { success: number; fail: number } => {
    if (node.children.length === 0) {
      return {
        success: node.payment.isSuccess ? 1 : 0,
        fail: node.payment.isSuccess ? 0 : 1,
      };
    }
    const totals = { success: 0, fail: 0 };
    for (const child of node.children) {
      const childStatus = countTreeStatus(child);
      totals.success += childStatus.success;
      totals.fail += childStatus.fail;
    }
    return totals;
  }, []);

  // Render tree node (for expanded MPP)
  const renderTreeNode = (node: TreeNode, isLast: boolean): ReactElement => {
    const { payment, children, depth } = node;
    const isExpanded = expandedNodes.has(payment.id);
    const hasChildren = children.length > 0;
    const isSelected = selectedPaymentId === payment.id;

    return (
      <div key={payment.id} className="tree-child-container">
        <div 
          className={`tree-child-node ${isSelected ? 'selected' : ''}`}
          onClick={() => onPaymentSelect(payment)}
        >
          <span className="tree-indent">
            {depth > 1 && Array(depth - 1).fill('│   ').join('')}
            {isLast ? '└── ' : '├── '}
          </span>
          
          {hasChildren && (
            <button 
              className={`expand-btn small ${isExpanded ? 'expanded' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                toggleExpand(payment.id);
              }}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}

          <span className="child-id">#{payment.id}</span>
          <span className="child-amount">{formatSatoshi(payment.amount)}</span>
          
          {hasChildren ? (
            <span className="child-split">→{children.length}分割</span>
          ) : (
            <span className={`child-status ${payment.isSuccess ? 'success' : 'failed'}`}>
              {payment.isSuccess ? '成功' : '失敗'}
            </span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-grandchildren">
            {children.map((child, index) => 
              renderTreeNode(child, index === children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  // Render payment row (using cached tree data)
  const renderPaymentRow = (payment: Payment) => {
    const hasMpp = payment.shard1Id >= 0 || payment.shard2Id >= 0;
    const isExpanded = expandedNodes.has(payment.id);
    const isSelected = selectedPaymentId === payment.id;
    const duration = payment.endTime - payment.startTime;

    let treeNode: TreeNode | null = null;
    let treeStatus: { success: number; fail: number } | null = null;
    
    if (hasMpp) {
      // Use cached tree node instead of rebuilding
      treeNode = preprocessedData.treeCache.get(payment.id) || null;
      if (treeNode) {
        treeStatus = countTreeStatus(treeNode);
      }
    }

    return (
      <div key={payment.id} className="payment-row-container">
        <div 
          className={`payment-row ${isSelected ? 'selected' : ''} ${hasMpp ? 'has-mpp' : ''}`}
          onClick={() => onPaymentSelect(payment)}
        >
          {/* Expand button for MPP */}
          <div className="row-expand">
            {hasMpp && (
              <button 
                className={`expand-btn ${isExpanded ? 'expanded' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand(payment.id);
                }}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
          </div>

          {/* ID */}
          <div className="row-id">#{payment.id}</div>

          {/* Type indicator */}
          <div className="row-type">
            {hasMpp ? (
              <span className="type-badge mpp" title={`${treeNode?.leafCount}分割`}>
                MPP
              </span>
            ) : (
              <span className="type-badge single">単一</span>
            )}
          </div>

          {/* Status */}
          <div className="row-status">
            {hasMpp && treeStatus ? (
              <span className={`status-badge ${treeStatus.fail === 0 ? 'success' : treeStatus.success === 0 ? 'failed' : 'partial'}`}>
                {treeStatus.fail === 0 ? '成功' : treeStatus.success === 0 ? '失敗' : '部分'}
                <span className="status-detail">({treeStatus.success}/{treeStatus.success + treeStatus.fail})</span>
              </span>
            ) : (
              <span className={`status-badge ${payment.isSuccess ? 'success' : 'failed'}`}>
                {payment.isSuccess ? '成功' : '失敗'}
              </span>
            )}
          </div>

          {/* Amount */}
          <div className="row-amount">{formatSatoshi(payment.amount)}</div>

          {/* Route */}
          <div className="row-route">
            <span className="route-node sender">{payment.senderId}</span>
            <span className="route-arrow">→</span>
            <span className="route-node receiver">{payment.receiverId}</span>
          </div>

          {/* Attempts */}
          <div className="row-attempts">
            {hasMpp && treeNode ? (
              <span title="総分割数">{treeNode.leafCount}</span>
            ) : (
              <span>{payment.attempts}</span>
            )}
          </div>

          {/* Fee */}
          <div className="row-fee">
            {payment.totalFee > 0 ? formatSatoshi(payment.totalFee) : '-'}
          </div>

          {/* Duration */}
          <div className="row-duration">{formatTime(duration)}</div>
        </div>

        {/* Expanded MPP tree */}
        {hasMpp && isExpanded && treeNode && (
          <div className="mpp-tree-expanded">
            {treeNode.children.map((child, index) => 
              renderTreeNode(child, index === treeNode!.children.length - 1)
            )}
          </div>
        )}
      </div>
    );
  };

  const SortHeader = ({ field, label }: { field: SortField; label: string }) => (
    <div 
      className={`sort-header ${sortField === field ? 'active' : ''}`}
      onClick={() => handleSortClick(field)}
    >
      {label}
      {sortField === field && (
        <span className="sort-indicator">{sortOrder === 'asc' ? '↑' : '↓'}</span>
      )}
    </div>
  );

  return (
    <div className="payment-list">
      <div className="list-header">
        <h3>ペイメント一覧</h3>
        <div className="header-stats">
          <span className="stat">全{stats.total}件</span>
          <span className="stat success">成功: {stats.successful}</span>
          <span className="stat failed">失敗: {stats.failed}</span>
          <span className="stat mpp">MPP: {stats.mppPayments}</span>
        </div>
      </div>

      <div className="list-filters">
        <div className="filter-row">
          <div className="filter-group">
            <label>検索:</label>
            <input 
              type="text" 
              placeholder="ID / 送信者 / 受信者"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
          </div>

          <div className="filter-group">
            <label>ステータス:</label>
            <select 
              value={statusFilter} 
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">すべて</option>
              <option value="success">成功のみ</option>
              <option value="failed">失敗のみ</option>
            </select>
          </div>

          <div className="filter-group">
            <label>タイプ:</label>
            <select 
              value={typeFilter} 
              onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
            >
              <option value="all">すべて</option>
              <option value="mpp">MPPのみ</option>
              <option value="single">単一のみ</option>
            </select>
          </div>
        </div>

        <div className="filter-row">
          <div className="filter-group">
            <label>金額範囲:</label>
            <input 
              type="number" 
              placeholder="最小"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              className="amount-input"
            />
            <span className="range-separator">〜</span>
            <input 
              type="number" 
              placeholder="最大"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              className="amount-input"
            />
          </div>

          <button onClick={resetFilters} className="reset-btn">
            フィルタをリセット
          </button>
        </div>
      </div>

      <div className="list-info">
        <span>表示: {sortedPayments.length}件</span>
      </div>

      <div className="list-table">
        <div className="table-header">
          <div className="row-expand"></div>
          <SortHeader field="id" label="ID" />
          <div className="header-cell">タイプ</div>
          <div className="header-cell">ステータス</div>
          <SortHeader field="amount" label="金額" />
          <div className="header-cell">ルート</div>
          <SortHeader field="attempts" label="試行" />
          <SortHeader field="fee" label="手数料" />
          <SortHeader field="duration" label="所要時間" />
        </div>

        <div className="table-body">
          {sortedPayments.length === 0 ? (
            <div className="empty-list">
              <p>条件に一致するペイメントがありません</p>
            </div>
          ) : (
            sortedPayments.map(payment => renderPaymentRow(payment))
          )}
        </div>
      </div>
    </div>
  );
}
