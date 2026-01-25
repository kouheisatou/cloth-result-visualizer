import type { Payment, SimulationConfig } from '../types';
import { formatSatoshi, formatTime } from '../utils/dataParser';

interface StatsPanelProps {
  payments: Payment[];
  config: SimulationConfig | null;
}

export function StatsPanel({ payments, config }: StatsPanelProps) {
  const successfulPayments = payments.filter(p => p.isSuccess);
  const failedPayments = payments.filter(p => !p.isSuccess);
  
  const successRate = payments.length > 0 
    ? (successfulPayments.length / payments.length * 100).toFixed(1)
    : '0';

  const totalAmount = successfulPayments.reduce((sum, p) => sum + p.amount, 0);
  const totalFees = successfulPayments.reduce((sum, p) => sum + p.totalFee, 0);
  const avgAttempts = payments.length > 0
    ? (payments.reduce((sum, p) => sum + p.attempts, 0) / payments.length).toFixed(2)
    : '0';

  const avgDuration = successfulPayments.length > 0
    ? successfulPayments.reduce((sum, p) => sum + (p.endTime - p.startTime), 0) / successfulPayments.length
    : 0;

  const noBalanceErrors = payments.reduce((sum, p) => sum + p.noBalanceCount, 0);
  const offlineErrors = payments.reduce((sum, p) => sum + p.offlineNodeCount, 0);

  return (
    <div className="stats-panel">
      <h3>シミュレーション統計</h3>
      
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-label">総ペイメント数</span>
          <span className="stat-value">{payments.length}</span>
        </div>
        
        <div className="stat-item success">
          <span className="stat-label">成功</span>
          <span className="stat-value">{successfulPayments.length}</span>
        </div>
        
        <div className="stat-item failed">
          <span className="stat-label">失敗</span>
          <span className="stat-value">{failedPayments.length}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">成功率</span>
          <span className="stat-value">{successRate}%</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">送金総額</span>
          <span className="stat-value">{formatSatoshi(totalAmount)}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">手数料総額</span>
          <span className="stat-value">{formatSatoshi(totalFees)}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">平均試行回数</span>
          <span className="stat-value">{avgAttempts}</span>
        </div>
        
        <div className="stat-item">
          <span className="stat-label">平均所要時間</span>
          <span className="stat-value">{formatTime(avgDuration)}</span>
        </div>
        
        <div className="stat-item error">
          <span className="stat-label">残高不足エラー</span>
          <span className="stat-value">{noBalanceErrors}</span>
        </div>
        
        <div className="stat-item error">
          <span className="stat-label">オフラインエラー</span>
          <span className="stat-value">{offlineErrors}</span>
        </div>
      </div>

      {config && (
        <div className="config-info">
          <h4>設定</h4>
          <div className="config-grid">
            <div className="config-item">
              <span className="config-label">ルーティング方式</span>
              <span className="config-value">{config.routingMethod}</span>
            </div>
            <div className="config-item">
              <span className="config-label">MPP</span>
              <span className="config-value">{config.mpp === 1 ? '有効' : '無効'}</span>
            </div>
            <div className="config-item">
              <span className="config-label">グループサイズ</span>
              <span className="config-value">{config.groupSize}</span>
            </div>
            <div className="config-item">
              <span className="config-label">タイムアウト</span>
              <span className="config-value">{formatTime(config.paymentTimeout)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

