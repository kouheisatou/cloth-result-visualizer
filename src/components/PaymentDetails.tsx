import type { Payment, Edge, AttemptHistory } from '../types';
import { formatSatoshi, formatTime } from '../utils/dataParser';

interface PaymentDetailsProps {
  payment: Payment | null;
  edges: Edge[];
  onAttemptSelect?: (attemptIndex: number) => void;
  selectedAttemptIndex?: number;
}

export function PaymentDetails({ 
  payment, 
  edges,
  onAttemptSelect,
  selectedAttemptIndex 
}: PaymentDetailsProps) {
  if (!payment) {
    return (
      <div className="payment-details empty">
        <p>ペイメントを選択してください</p>
        <p className="hint">タイムラインから選択するか、ステップを進めてください</p>
      </div>
    );
  }

  const edgeMap = new Map(edges.map(e => [e.id, e]));

  const getRouteDescription = (attempt: AttemptHistory) => {
    if (!attempt.route || attempt.route.length === 0) {
      return <span className="no-route">ルートなし</span>;
    }

    return (
      <div className="route-path">
        {attempt.route.map((hop, idx) => (
          <div key={idx} className="route-hop">
            <div className="hop-nodes">
              <span className="node-id">{hop.from_node_id}</span>
              <span className="arrow">→</span>
              <span className="node-id">{hop.to_node_id}</span>
            </div>
            <div className="hop-details">
              <span className="edge-id">Edge #{hop.edge_id}</span>
              <span className="amount">{formatSatoshi(hop.sent_amt)}</span>
              <span className="capacity">
                (Cap: {formatSatoshi(hop.edge_cap)} / {formatSatoshi(hop.channel_cap)})
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const getErrorDescription = (attempt: AttemptHistory) => {
    if (attempt.is_succeeded) return null;
    
    const errorEdge = edgeMap.get(attempt.error_edge);
    const errorTypes: Record<number, string> = {
      0: 'ルートなし',
      1: '残高不足',
      2: 'ノードオフライン',
      3: 'タイムアウト',
    };

    return (
      <div className="error-info">
        <span className="error-type">
          {errorTypes[attempt.error_type] || `エラー: ${attempt.error_type}`}
        </span>
        {errorEdge && (
          <span className="error-edge">
            @ Edge #{attempt.error_edge} ({errorEdge.fromNodeId} → {errorEdge.toNodeId})
          </span>
        )}
      </div>
    );
  };

  const duration = payment.endTime - payment.startTime;

  return (
    <div className="payment-details">
      <div className="payment-header">
        <h3>
          Payment #{payment.id}
          <span className={`status ${payment.isSuccess ? 'success' : 'failed'}`}>
            {payment.isSuccess ? '✓ 成功' : '✗ 失敗'}
          </span>
        </h3>
      </div>

      <div className="payment-summary">
        <div className="summary-row">
          <span className="label">送金者:</span>
          <span className="value sender">Node #{payment.senderId}</span>
        </div>
        <div className="summary-row">
          <span className="label">受取者:</span>
          <span className="value receiver">Node #{payment.receiverId}</span>
        </div>
        <div className="summary-row">
          <span className="label">金額:</span>
          <span className="value amount">{formatSatoshi(payment.amount)}</span>
        </div>
        <div className="summary-row">
          <span className="label">手数料:</span>
          <span className="value fee">{formatSatoshi(payment.totalFee)}</span>
        </div>
        <div className="summary-row">
          <span className="label">開始時刻:</span>
          <span className="value">{formatTime(payment.startTime)}</span>
        </div>
        <div className="summary-row">
          <span className="label">終了時刻:</span>
          <span className="value">{formatTime(payment.endTime)}</span>
        </div>
        <div className="summary-row">
          <span className="label">所要時間:</span>
          <span className="value">{formatTime(duration)}</span>
        </div>
        <div className="summary-row">
          <span className="label">試行回数:</span>
          <span className="value">{payment.attempts}</span>
        </div>
        <div className="summary-row">
          <span className="label">残高不足:</span>
          <span className="value">{payment.noBalanceCount}回</span>
        </div>
        {payment.isShard && payment.parentPaymentId >= 0 && (
          <div className="summary-row">
            <span className="label">親ペイメント:</span>
            <span className="value shard">#{payment.parentPaymentId}</span>
          </div>
        )}
        {payment.mpp === 1 && (
          <div className="summary-row">
            <span className="label">MPP:</span>
            <span className="value">有効</span>
          </div>
        )}
      </div>

      {/* Child Shards for Multipath Payments */}
      {payment.childShards && payment.childShards.length > 0 && (
        <div className="child-shards-section">
          <h4>子シャード ({payment.childShards.length}件)</h4>
          <div className="shards-list">
            {payment.childShards.map((shard) => (
              <div key={shard.id} className={`shard-item ${shard.isSuccess ? 'success' : 'failed'}`}>
                <div className="shard-header">
                  <span className="shard-id">Shard #{shard.id}</span>
                  <span className={`shard-status ${shard.isSuccess ? 'success' : 'failed'}`}>
                    {shard.isSuccess ? '成功' : '失敗'}
                  </span>
                </div>
                <div className="shard-details">
                  <span className="shard-amount">{formatSatoshi(shard.amount)}</span>
                  <span className="shard-attempts">{shard.attempts}回試行</span>
                  {shard.route.length > 0 && (
                    <span className="shard-route">
                      {shard.route.map((edgeId) => {
                        const edge = edgeMap.get(edgeId);
                        return edge ? `${edge.fromNodeId}→${edge.toNodeId}` : `E#${edgeId}`;
                      }).join(' → ')}
                    </span>
                  )}
                </div>
                {/* Nested shards */}
                {shard.childShards && shard.childShards.length > 0 && (
                  <div className="nested-shards">
                    <span className="nested-label">さらに分割: </span>
                    {shard.childShards.map(nested => (
                      <span key={nested.id} className={`nested-shard ${nested.isSuccess ? 'success' : 'failed'}`}>
                        #{nested.id} ({formatSatoshi(nested.amount)})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Final Route */}
      {payment.isSuccess && payment.route.length > 0 && (
        <div className="final-route">
          <h4>最終ルート</h4>
          <div className="route-edges">
            {payment.route.map((edgeId, idx) => {
              const edge = edgeMap.get(edgeId);
              return (
                <span key={idx} className="edge-chip">
                  {edge ? `${edge.fromNodeId}→${edge.toNodeId}` : `E#${edgeId}`}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Attempt History */}
      <div className="attempts-section">
        <h4>試行履歴 ({payment.attemptsHistory.length}回)</h4>
        <div className="attempts-list">
          {payment.attemptsHistory.map((attempt, idx) => (
            <div 
              key={idx} 
              className={`attempt-item ${attempt.is_succeeded ? 'success' : 'failed'} ${
                selectedAttemptIndex === idx ? 'selected' : ''
              }`}
              onClick={() => onAttemptSelect?.(idx)}
            >
              <div className="attempt-header">
                <span className="attempt-number">試行 #{attempt.attempts}</span>
                <span className={`attempt-status ${attempt.is_succeeded ? 'success' : 'failed'}`}>
                  {attempt.is_succeeded ? '成功' : '失敗'}
                </span>
                <span className="attempt-time">@ {formatTime(attempt.end_time)}</span>
              </div>
              
              {getErrorDescription(attempt)}
              
              <div className="attempt-route">
                {getRouteDescription(attempt)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

