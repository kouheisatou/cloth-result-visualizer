import { useCallback, useState } from 'react';

interface DataLoaderProps {
  onDataLoaded: (data: {
    nodesContent: string;
    channelsContent: string;
    edgesContent: string;
    paymentsContent: string;
    configContent: string;
  }) => void;
}

export function DataLoader({ onDataLoaded }: DataLoaderProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<{
    nodes?: File;
    channels?: File;
    edges?: File;
    payments?: File;
    config?: File;
  }>({});

  const handleFileChange = useCallback((type: keyof typeof files) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFiles(prev => ({ ...prev, [type]: file }));
      setError(null);
    }
  }, []);

  const loadFiles = useCallback(async () => {
    if (!files.nodes || !files.channels || !files.edges || !files.payments || !files.config) {
      setError('すべてのファイルを選択してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const readFile = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
          reader.readAsText(file);
        });
      };

      const [nodesContent, channelsContent, edgesContent, paymentsContent, configContent] = await Promise.all([
        readFile(files.nodes),
        readFile(files.channels),
        readFile(files.edges),
        readFile(files.payments),
        readFile(files.config),
      ]);

      onDataLoaded({
        nodesContent,
        channelsContent,
        edgesContent,
        paymentsContent,
        configContent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ファイルの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [files, onDataLoaded]);

  const loadSampleData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // With <base> tag set, relative paths will resolve correctly
      // e.g., 'data/nodes_output.csv' -> https://kouheisatou.github.io/cloth-result-visualizer/data/nodes_output.csv
      const [nodesRes, channelsRes, edgesRes, paymentsRes, configRes] = await Promise.all([
        fetch('data/nodes_output.csv'),
        fetch('data/channels_output.csv'),
        fetch('data/edges_output.csv'),
        fetch('data/payments_output.csv'),
        fetch('data/cloth_input.txt'),
      ]);

      if (!nodesRes.ok || !channelsRes.ok || !edgesRes.ok || !paymentsRes.ok || !configRes.ok) {
        throw new Error('サンプルデータが見つかりません。ファイルを直接選択してください。');
      }

      const [nodesContent, channelsContent, edgesContent, paymentsContent, configContent] = await Promise.all([
        nodesRes.text(),
        channelsRes.text(),
        edgesRes.text(),
        paymentsRes.text(),
        configRes.text(),
      ]);

      onDataLoaded({
        nodesContent,
        channelsContent,
        edgesContent,
        paymentsContent,
        configContent,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'サンプルデータの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [onDataLoaded]);

  const isReady = files.nodes && files.channels && files.edges && files.payments && files.config;

  return (
    <div className="data-loader">
      <div className="loader-header">
        <h2>Lightning Network シミュレーション可視化ツール</h2>
        <p>シミュレーション結果のCSVファイルを読み込んでください</p>
      </div>

      <div className="file-inputs">
        <div className="file-input-group">
          <label>
            <span className="file-type">Nodes</span>
            <span className="file-name">{files.nodes?.name || 'nodes_output.csv'}</span>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange('nodes')}
            />
          </label>
          {files.nodes && <span className="check">✓</span>}
        </div>

        <div className="file-input-group">
          <label>
            <span className="file-type">Channels</span>
            <span className="file-name">{files.channels?.name || 'channels_output.csv'}</span>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange('channels')}
            />
          </label>
          {files.channels && <span className="check">✓</span>}
        </div>

        <div className="file-input-group">
          <label>
            <span className="file-type">Edges</span>
            <span className="file-name">{files.edges?.name || 'edges_output.csv'}</span>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange('edges')}
            />
          </label>
          {files.edges && <span className="check">✓</span>}
        </div>

        <div className="file-input-group">
          <label>
            <span className="file-type">Payments</span>
            <span className="file-name">{files.payments?.name || 'payments_output.csv'}</span>
            <input 
              type="file" 
              accept=".csv"
              onChange={handleFileChange('payments')}
            />
          </label>
          {files.payments && <span className="check">✓</span>}
        </div>

        <div className="file-input-group">
          <label>
            <span className="file-type">Config</span>
            <span className="file-name">{files.config?.name || 'cloth_input.txt'}</span>
            <input 
              type="file" 
              accept=".txt"
              onChange={handleFileChange('config')}
            />
          </label>
          {files.config && <span className="check">✓</span>}
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="loader-actions">
        <button 
          onClick={loadFiles}
          disabled={!isReady || loading}
          className="primary"
        >
          {loading ? '読み込み中...' : 'ファイルを読み込む'}
        </button>
        
        <button 
          onClick={loadSampleData}
          disabled={loading}
          className="secondary"
        >
          サンプルデータを使用
        </button>
      </div>

      <div className="loader-info">
        <h3>使い方</h3>
        <ol>
          <li>CLOTHシミュレータの出力ファイルを選択します</li>
          <li>「ファイルを読み込む」をクリックします</li>
          <li>グラフビューでネットワークを確認できます</li>
          <li>タイムラインコントロールで時系列を追跡できます</li>
        </ol>
        <p className="shortcuts">
          <strong>キーボードショートカット:</strong>
          <span>→ / Space: 次のステップ</span>
          <span>←: 前のステップ</span>
          <span>Home: 最初へ</span>
          <span>End: 最後へ</span>
        </p>
      </div>
    </div>
  );
}

