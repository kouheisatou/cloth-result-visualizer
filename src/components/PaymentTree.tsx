import { useState, useMemo, useCallback } from 'react';
import type { Payment } from '../types';
import { formatSatoshi, formatTime } from '../utils/dataParser';
import './PaymentTree.css';

interface PaymentTreeProps {
  payments: Payment[];
  onPaymentSelect: (payment: Payment | null) => void;
  selectedPaymentId?: number;
}

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'failed' | 'partial'>('all');
  const [searchId, setSearchId] = useState('');

  // Create payment map for quick lookup
  const paymentMap = useMemo(() => {
    const map = new Map<number, Payment>();
    for (const payment of payments) {
      map.set(payment.id, payment);
    }
    return map;
  }, [payments]);

  // Build tree structure recursively
  const buildTree = useCallback((payment: Payment, depth: number): TreeNode => {
    const children: TreeNode[] = [];
    let totalLeafAmount = 0;
    let leafCount = 0;

    if (payment.shard1Id >= 0) {
      const shard1 = paymentMap.get(payment.shard1Id);
      if (shard1) {
        const childTree = buildTree(shard1, depth + 1);
        children.push(childTree);
        totalLeafAmount += childTree.totalLeafAmount;
        leafCount += childTree.leafCount;
      }
    }

    if (payment.shard2Id >= 0) {
      const shard2 = paymentMap.get(payment.shard2Id);
      if (shard2) {
        const childTree = buildTree(shard2, depth + 1);
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

    return {
      payment,
      children,
      depth,
      totalLeafAmount,
      leafCount,
    };
  }, [paymentMap]);

  // Get root payments (payments that are split into shards)
  const rootTrees = useMemo(() => {
    const roots: TreeNode[] = [];
    
    for (const payment of payments) {
      // Only include payments that have shards (parent payments)
      if ((payment.shard1Id >= 0 || payment.shard2Id >= 0) && !payment.isShard) {
        roots.push(buildTree(payment, 0));
      }
    }

    // Sort by start time
    roots.sort((a, b) => a.payment.startTime - b.payment.startTime);

    return roots;
  }, [payments, buildTree]);

  // Filter trees based on status and search
  const filteredTrees = useMemo(() => {
    return rootTrees.filter(tree => {
      // Search filter
      if (searchId) {
        const id = parseInt(searchId);
        if (!isNaN(id) && tree.payment.id !== id) {
          // Check if any child has this ID
          const hasChildWithId = (node: TreeNode): boolean => {
            if (node.payment.id === id) return true;
            return node.children.some(hasChildWithId);
          };
          if (!hasChildWithId(tree)) return false;
        }
      }

      // Status filter
      if (filterStatus === 'all') return true;
      
      // Count success/fail in tree
      const countStatus = (node: TreeNode): { success: number; fail: number } => {
        if (node.children.length === 0) {
          return {
            success: node.payment.isSuccess ? 1 : 0,
            fail: node.payment.isSuccess ? 0 : 1,
          };
        }
        const totals = { success: 0, fail: 0 };
        for (const child of node.children) {
          const childStatus = countStatus(child);
          totals.success += childStatus.success;
          totals.fail += childStatus.fail;
        }
        return totals;
      };

      const status = countStatus(tree);
      
      if (filterStatus === 'success') return status.fail === 0 && status.success > 0;
      if (filterStatus === 'failed') return status.success === 0 && status.fail > 0;
      if (filterStatus === 'partial') return status.success > 0 && status.fail > 0;
      
      return true;
    });
  }, [rootTrees, filterStatus, searchId]);

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

  const expandAll = useCallback(() => {
    const allIds = new Set<number>();
    const collectIds = (node: TreeNode) => {
      if (node.children.length > 0) {
        allIds.add(node.payment.id);
        node.children.forEach(collectIds);
      }
    };
    filteredTrees.forEach(collectIds);
    setExpandedNodes(allIds);
  }, [filteredTrees]);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set());
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    let totalRoots = rootTrees.length;
    let successfulTrees = 0;
    let failedTrees = 0;
    let partialTrees = 0;

    for (const tree of rootTrees) {
      const countStatus = (node: TreeNode): { success: number; fail: number } => {
        if (node.children.length === 0) {
          return {
            success: node.payment.isSuccess ? 1 : 0,
            fail: node.payment.isSuccess ? 0 : 1,
          };
        }
        const totals = { success: 0, fail: 0 };
        for (const child of node.children) {
          const childStatus = countStatus(child);
          totals.success += childStatus.success;
          totals.fail += childStatus.fail;
        }
        return totals;
      };

      const status = countStatus(tree);
      if (status.fail === 0 && status.success > 0) successfulTrees++;
      else if (status.success === 0 && status.fail > 0) failedTrees++;
      else if (status.success > 0 && status.fail > 0) partialTrees++;
    }

    return { totalRoots, successfulTrees, failedTrees, partialTrees };
  }, [rootTrees]);

  // Render a tree node
  const renderTreeNode = (node: TreeNode, isLast: boolean, parentPrefix: string = ''): React.ReactElement => {
    const { payment, children, depth } = node;
    const isExpanded = expandedNodes.has(payment.id);
    const hasChildren = children.length > 0;
    const isSelected = selectedPaymentId === payment.id;

    // Calculate success/fail counts for this subtree
    const countStatus = (n: TreeNode): { success: number; fail: number } => {
      if (n.children.length === 0) {
        return {
          success: n.payment.isSuccess ? 1 : 0,
          fail: n.payment.isSuccess ? 0 : 1,
        };
      }
      const totals = { success: 0, fail: 0 };
      for (const child of n.children) {
        const childStatus = countStatus(child);
        totals.success += childStatus.success;
        totals.fail += childStatus.fail;
      }
      return totals;
    };

    const subtreeStatus = countStatus(node);

    // Build prefix for tree lines
    const prefix = depth === 0 ? '' : parentPrefix + (isLast ? '└── ' : '├── ');
    const childPrefix = depth === 0 ? '' : parentPrefix + (isLast ? '    ' : '│   ');

    return (
      <div key={payment.id} className="tree-node-container">
        <div 
          className={`tree-node ${isSelected ? 'selected' : ''} ${hasChildren ? 'has-children' : 'leaf'}`}
          onClick={() => onPaymentSelect(payment)}
        >
          {depth > 0 && (
            <span className="tree-prefix">{prefix}</span>
          )}
          
          {hasChildren && (
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

          <div className="node-content">
            <span className="node-id">#{payment.id}</span>
            <span className="node-amount">{formatSatoshi(payment.amount)}</span>
            
            {hasChildren ? (
              <span className="node-split-info">
                → {children.length}分割 ({node.leafCount}末端)
              </span>
            ) : (
              <span className={`node-status ${payment.isSuccess ? 'success' : 'failed'}`}>
                {payment.isSuccess ? '成功' : '失敗'}
              </span>
            )}

            {hasChildren && (
              <span className="subtree-status">
                <span className="success-count">{subtreeStatus.success}</span>
                /
                <span className="fail-count">{subtreeStatus.fail}</span>
              </span>
            )}

            <span className="node-time">{formatTime(payment.endTime - payment.startTime)}</span>
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-children">
            {children.map((child, index) => 
              renderTreeNode(child, index === children.length - 1, childPrefix)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="payment-tree">
      <div className="tree-header">
        <h3>MPP分割ツリー</h3>
        <div className="tree-controls">
          <button onClick={expandAll} className="control-btn">
            すべて展開
          </button>
          <button onClick={collapseAll} className="control-btn">
            すべて折りたたむ
          </button>
        </div>
      </div>

      <div className="tree-filters">
        <div className="filter-group">
          <label>ステータス:</label>
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
          >
            <option value="all">すべて ({stats.totalRoots})</option>
            <option value="success">完全成功 ({stats.successfulTrees})</option>
            <option value="failed">完全失敗 ({stats.failedTrees})</option>
            <option value="partial">部分成功 ({stats.partialTrees})</option>
          </select>
        </div>
        <div className="search-group">
          <label>ID検索:</label>
          <input 
            type="text" 
            placeholder="Payment ID"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
        </div>
      </div>

      <div className="tree-stats">
        <span>表示中: <strong>{filteredTrees.length}</strong> 件のMPPペイメント</span>
      </div>

      <div className="tree-container">
        {filteredTrees.length === 0 ? (
          <div className="empty-tree">
            <p>MPPで分割されたペイメントがありません</p>
          </div>
        ) : (
          filteredTrees.map((tree, index) => (
            <div key={tree.payment.id} className="root-tree">
              <div className="root-header">
                <span className="root-index">#{index + 1}</span>
                <span className="root-path">
                  Node {tree.payment.senderId} → Node {tree.payment.receiverId}
                </span>
              </div>
              {renderTreeNode(tree, true)}
            </div>
          ))
        )}
      </div>

      <div className="tree-legend">
        <div className="legend-item">
          <span className="legend-icon success">●</span>
          <span>成功</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon failed">●</span>
          <span>失敗</span>
        </div>
        <div className="legend-item">
          <span className="legend-icon split">▶</span>
          <span>分割あり（クリックで展開）</span>
        </div>
      </div>
    </div>
  );
}
