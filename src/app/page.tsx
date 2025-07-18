'use client';

import { useState, useEffect, useCallback } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface NetworkData {
  ping: number;
  loss: number;
  ping_dev: number;
  loss_dev: number;
}

interface ISP {
  value: string;
  label: string;
}

const TIME_RANGES = [
  { value: 5, label: '5 分鐘' },
  { value: 15, label: '15 分鐘' },
  { value: 30, label: '30 分鐘' },
  { value: 60, label: '1 小時' },
  { value: 180, label: '3 小時' },
  { value: 360, label: '6 小時' },
  { value: 1440, label: '24 小時' },
];

export default function Home() {
  const [selectedISP, setSelectedISP] = useState<string>('');
  const [selectedRange, setSelectedRange] = useState<number>(60);
  const [ispList, setISPList] = useState<ISP[]>([]);
  const [networkData, setNetworkData] = useState<NetworkData[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchISPList();
  }, []);

  const fetchNetworkData = useCallback(async () => {
    if (!selectedISP) return;
    
    setLoading(true);
    setError('');
    
    try {
      const encodedISP = encodeURIComponent(selectedISP);
      const response = await fetch(`https://lb.exptech.dev/api/v1/dpip/status/${encodedISP}/${selectedRange}`);
      if (!response.ok) throw new Error('Failed to fetch network data');
      const data = await response.json();
      
      const formattedData = data.map((item: NetworkData, index: number) => ({
        ...item,
        time: index + 1,
      }));
      
      setNetworkData(formattedData);
    } catch (err) {
      setError('無法取得網路數據');
      setNetworkData([]);
    } finally {
      setLoading(false);
    }
  }, [selectedISP, selectedRange]);

  useEffect(() => {
    if (selectedISP) {
      fetchNetworkData();
    } else {
      setNetworkData([]);
    }
  }, [selectedISP, selectedRange, fetchNetworkData]);

  const fetchISPList = async () => {
    try {
      const response = await fetch('https://lb.exptech.dev/api/v1/dpip/ispList');
      if (!response.ok) throw new Error('Failed to fetch ISP list');
      const data = await response.json();
      const formattedISPs = data.map((isp: string) => ({
        value: isp,
        label: isp
      }));
      setISPList(formattedISPs);
    } catch (err) {
      setError('無法取得 ISP 列表');
    }
  };

  const getColorByLoss = (loss: number) => {
    if (loss === -1) return '#9CA3AF'; // Gray for no data
    if (loss <= 0) return '#10B981'; // Green for 0% loss
    if (loss <= 33) return '#3B82F6'; // Blue for <=33% loss
    if (loss <= 66) return '#EF4444'; // Red for <=66% loss
    return '#8B5CF6'; // Purple for 99% loss
  };

  const getAllTimePoints = (rangeMinutes: number) => {
    const now = Date.now();
    let unitMs: number;
    let points: number;
    
    if (rangeMinutes <= 60) {
      unitMs = 30 * 1000;
      points = rangeMinutes * 2;
    } else if (rangeMinutes <= 1440) {
      unitMs = 60 * 1000;
      points = rangeMinutes;
    } else {
      unitMs = 60 * 60 * 1000;
      points = Math.ceil(rangeMinutes / 60);
    }
    
    return Array.from({ length: points }, (_, index) => {
      return new Date(now - ((points - 1 - index) * unitMs));
    });
  };

  const prepareScatterData = (data: NetworkData[], type: 'cloudflare' | 'origin') => {
    const allTimePoints = getAllTimePoints(selectedRange);
    
    return allTimePoints.map((timePoint, index) => {
      const dataItem = data[index];
      const ping = dataItem ? (type === 'cloudflare' ? dataItem.ping : dataItem.ping_dev) : -1;
      const loss = dataItem ? (type === 'cloudflare' ? dataItem.loss : dataItem.loss_dev) : -1;
      
      return {
        x: timePoint.getTime(),
        y: ping === -1 ? null : ping,
        loss: loss,
        color: ping === -1 ? 'rgba(156, 163, 175, 0.3)' : getColorByLoss(loss),
        timeLabel: timePoint.toLocaleTimeString('zh-TW', { 
          hour: '2-digit', 
          minute: '2-digit', 
          second: selectedRange <= 60 ? '2-digit' : undefined 
        }),
        hasData: ping !== -1
      };
    });
  };

  // 計算統計數據
  const getStats = (data: NetworkData[], type: 'cloudflare' | 'origin') => {
    const validData = data.filter(item => {
      const ping = type === 'cloudflare' ? item.ping : item.ping_dev;
      return ping !== -1;
    });

    if (validData.length === 0) return null;

    const pings = validData.map(item => type === 'cloudflare' ? item.ping : item.ping_dev);
    const losses = validData.map(item => type === 'cloudflare' ? item.loss : item.loss_dev);

    return {
      avgPing: Math.round(pings.reduce((a, b) => a + b, 0) / pings.length),
      minPing: Math.min(...pings),
      maxPing: Math.max(...pings),
      avgLoss: Math.round(losses.reduce((a, b) => a + b, 0) / losses.length * 100) / 100,
      maxLoss: Math.max(...losses),
      dataPoints: validData.length,
      totalPoints: data.length
    };
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full mb-4">
            <span className="text-3xl">🔍</span>
          </div>
          <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-3">
            DPIP 網路監控
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-2">
            即時網路延遲與丟包率監控
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            右邊為現在時間 • 經由散點圖分析網路品質
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                選擇 ISP
              </label>
              <select
                value={selectedISP}
                onChange={(e) => setSelectedISP(e.target.value)}
                disabled={loading || ispList.length === 0}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:border-blue-400"
              >
                <option value="">請選擇 ISP 進行監控</option>
                {ispList.map((isp) => (
                  <option key={isp.value} value={isp.value}>
                    {isp.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                時間範圍
              </label>
              <select
                value={selectedRange}
                onChange={(e) => setSelectedRange(Number(e.target.value))}
                disabled={loading || !selectedISP}
                className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:border-blue-400"
              >
                {TIME_RANGES.map((range) => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          {selectedISP && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                正在監控 <strong>{selectedISP}</strong> 的網路狀態，時間範圍：<strong>{TIME_RANGES.find(r => r.value === selectedRange)?.label}</strong>
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-100 dark:bg-red-900 border border-red-400 text-red-700 dark:text-red-300 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
              <p className="mt-2 text-gray-600 dark:text-gray-400">載入中...</p>
            </div>
          )}

          {!selectedISP && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📊</div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                選擇 ISP 開始監控
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                請在上方選擇一個 ISP 來查看網路延遲和丟包率數據
              </p>
            </div>
          )}

          {!loading && selectedISP && networkData.length === 0 && !error && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                沒有數據
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                目前沒有 {selectedISP} 的網路數據，請稍後再試
              </p>
            </div>
          )}

          {!loading && selectedISP && networkData.length > 0 && (
            <div className="space-y-10">
              {/* 統計摘要 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Cloudflare 統計 */}
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-2xl border border-blue-200 dark:border-blue-700">
                  <h4 className="text-lg font-bold text-blue-800 dark:text-blue-300 mb-4 flex items-center gap-2">
                  {selectedISP} 到 Cloudflare 統計
                  </h4>
                  {(() => {
                    const stats = getStats(networkData, 'cloudflare');
                    return stats ? (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-blue-600 dark:text-blue-400 font-medium">平均延遲</p>
                          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.avgPing}ms</p>
                        </div>
                        <div>
                          <p className="text-blue-600 dark:text-blue-400 font-medium">平均丟包率</p>
                          <p className="text-2xl font-bold text-blue-800 dark:text-blue-300">{stats.avgLoss}%</p>
                        </div>
                        <div>
                          <p className="text-blue-600 dark:text-blue-400 font-medium">延遲範圍</p>
                          <p className="text-lg font-semibold text-blue-800 dark:text-blue-300">{stats.minPing}-{stats.maxPing}ms</p>
                        </div>
                        <div>
                          <p className="text-blue-600 dark:text-blue-400 font-medium">數據完整度</p>
                          <p className="text-lg font-semibold text-blue-800 dark:text-blue-300">{Math.round(stats.dataPoints/stats.totalPoints*100)}%</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-blue-600 dark:text-blue-400">無可用數據</p>
                    );
                  })()}
                </div>

                {/* 原點統計 */}
                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-2xl border border-green-200 dark:border-green-700">
                  <h4 className="text-lg font-bold text-green-800 dark:text-green-300 mb-4 flex items-center gap-2">
                  {selectedISP} 到 ExpTech 統計
                  </h4>
                  {(() => {
                    const stats = getStats(networkData, 'origin');
                    return stats ? (
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-green-600 dark:text-green-400 font-medium">平均延遲</p>
                          <p className="text-2xl font-bold text-green-800 dark:text-green-300">{stats.avgPing}ms</p>
                        </div>
                        <div>
                          <p className="text-green-600 dark:text-green-400 font-medium">平均丟包率</p>
                          <p className="text-2xl font-bold text-green-800 dark:text-green-300">{stats.avgLoss}%</p>
                        </div>
                        <div>
                          <p className="text-green-600 dark:text-green-400 font-medium">延遲範圍</p>
                          <p className="text-lg font-semibold text-green-800 dark:text-green-300">{stats.minPing}-{stats.maxPing}ms</p>
                        </div>
                        <div>
                          <p className="text-green-600 dark:text-green-400 font-medium">數據完整度</p>
                          <p className="text-lg font-semibold text-green-800 dark:text-green-300">{Math.round(stats.dataPoints/stats.totalPoints*100)}%</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-green-600 dark:text-green-400">無可用數據</p>
                    );
                  })()}
                </div>
              </div>

              {/* Cloudflare 圖表 */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-600">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                  {selectedISP} 到 Cloudflare 延遲
                </h3>
                <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-gray-600 dark:text-gray-300">0% 丟包率</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-gray-600 dark:text-gray-300">33%≤ 丟包率</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-gray-600 dark:text-gray-300">66%≤ 丟包率</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span className="text-gray-600 dark:text-gray-300">99%≤ 丟包率</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border border-gray-400 bg-transparent"></div>
                      <span className="text-gray-600 dark:text-gray-300">無資料</span>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart data={prepareScatterData(networkData, 'cloudflare')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="x" 
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        if (selectedRange <= 60) {
                          return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        } else if (selectedRange <= 1440) {
                          return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                        } else {
                          return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit' });
                        }
                      }}
                      label=""
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      label={{ value: '延遲 (ms)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'y') return [`${value}ms`, '延遲時間'];
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length > 0) {
                          const data = payload[0].payload;
                          const timeLabel = data.timeLabel || new Date(label).toLocaleTimeString('zh-TW');
                          const loss = data.loss;
                          return `時間: ${timeLabel}, 丟包率: ${loss === -1 ? '無數據' : loss + '%'}`;
                        }
                        return `時間: ${new Date(label).toLocaleTimeString('zh-TW')}`;
                      }}
                    />
                    <Scatter dataKey="y" fill="#8884d8">
                      {prepareScatterData(networkData, 'cloudflare').map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          fillOpacity={entry.hasData ? 1 : 0.3}
                          stroke={entry.hasData ? entry.color : '#9CA3AF'}
                          strokeWidth={entry.hasData ? 0 : 1}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>

              {/* 原點伺服器圖表 */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-800 p-6 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-600">
                <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-6 flex items-center gap-2">
                  {selectedISP} 到 ExpTech 延遲
                </h3>
                <div className="mb-6 p-4 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-600">
                <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-gray-600 dark:text-gray-300">0% 丟包率</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                      <span className="text-gray-600 dark:text-gray-300">33%≤ 丟包率</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-gray-600 dark:text-gray-300">66%≤ 丟包率</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-purple-500"></div>
                      <span className="text-gray-600 dark:text-gray-300">99%≤ 丟包率</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full border border-gray-400 bg-transparent"></div>
                      <span className="text-gray-600 dark:text-gray-300">無資料</span>
                    </div>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={350}>
                  <ScatterChart data={prepareScatterData(networkData, 'origin')}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="x" 
                      type="number"
                      scale="time"
                      domain={['dataMin', 'dataMax']}
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => {
                        const date = new Date(value);
                        if (selectedRange <= 60) {
                          return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                        } else if (selectedRange <= 1440) {
                          return date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
                        } else {
                          return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit' });
                        }
                      }}
                      label=""
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      label={{ value: '延遲 (ms)', angle: -90, position: 'insideLeft' }}
                    />
                    <Tooltip 
                      formatter={(value, name) => {
                        if (name === 'y') return [`${value}ms`, '延遲時間'];
                        return [value, name];
                      }}
                      labelFormatter={(label, payload) => {
                        if (payload && payload.length > 0) {
                          const data = payload[0].payload;
                          const timeLabel = data.timeLabel || new Date(label).toLocaleTimeString('zh-TW');
                          const loss = data.loss;
                          return `時間: ${timeLabel}, 丟包率: ${loss === -1 ? '無數據' : loss + '%'}`;
                        }
                        return `時間: ${new Date(label).toLocaleTimeString('zh-TW')}`;
                      }}
                    />
                    <Scatter dataKey="y" fill="#8884d8">
                      {prepareScatterData(networkData, 'origin').map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.color}
                          fillOpacity={entry.hasData ? 1 : 0.3}
                          stroke={entry.hasData ? entry.color : '#9CA3AF'}
                          strokeWidth={entry.hasData ? 0 : 1}
                        />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>

        <footer className="text-center text-gray-600 dark:text-gray-400">
          <p>DPIP 網路監控系統 - 即時監控網路品質</p>
        </footer>
      </div>
    </div>
  );
}