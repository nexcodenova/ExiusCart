'use client';
import { useState, useEffect } from 'react';
import { ShoppingBag, Link, Link2Off, RefreshCw, Package, ShoppingCart, BarChart2, CheckCircle, XCircle, AlertCircle, Settings, X, ExternalLink, Zap } from 'lucide-react';
import { shopifyApi } from '@/lib/api';

function shopIdFromStorage() { return localStorage.getItem('shop_id') || '1'; }

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  partial: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  failed: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  running: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
};

export default function ShopifyIntegrationPage() {
  const [shopId, setShopId] = useState('');
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [connectForm, setConnectForm] = useState({ shopify_domain: '', access_token: '' });
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');

  useEffect(() => { setShopId(shopIdFromStorage()); }, []);

  const [backendDown, setBackendDown] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const r = await shopifyApi.getStatus(shopId);
      setStatus(r.data);
      setBackendDown(false);
    } catch (e: any) {
      if (!e?.response) setBackendDown(true);
    } finally { setLoading(false); }
  };

  useEffect(() => { if (shopId) load(); }, [shopId]);

  const connect = async () => {
    if (!connectForm.shopify_domain.trim() || !connectForm.access_token.trim()) return;
    setConnecting(true); setConnectError('');
    try {
      await shopifyApi.connect(shopId, connectForm);
      setShowConnectModal(false); load();
    } catch (e: any) {
      if (!e?.response) {
        setConnectError('Cannot reach the server. Make sure the backend is running on port 8000.');
      } else {
        setConnectError(e?.response?.data?.detail || 'Connection failed. Check your credentials.');
      }
    } finally { setConnecting(false); }
  };

  const disconnect = async () => {
    if (!confirm('Disconnect your Shopify store? Sync will stop but existing data remains.')) return;
    try { await shopifyApi.disconnect(shopId); load(); } catch {}
  };

  const sync = async (type: 'products' | 'orders' | 'inventory') => {
    setSyncing(type);
    try {
      if (type === 'products') await shopifyApi.syncProducts(shopId);
      else if (type === 'orders') await shopifyApi.syncOrders(shopId);
      else await shopifyApi.syncInventory(shopId);
      setTimeout(() => { load(); setSyncing(null); }, 2000);
    } catch { setSyncing(null); }
  };

  const updateSettings = async (settings: any) => {
    try { await shopifyApi.updateSettings(shopId, settings); setShowSettingsModal(false); load(); } catch {}
  };

  const store = status?.store;
  const isConnected = status?.connected;

  return (
    <div className="space-y-6">
      {backendDown && (
        <div className="rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 p-4 flex items-center gap-3 text-orange-700 dark:text-orange-300 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span><strong>Backend offline.</strong> Start the FastAPI server on port 8000 to use Shopify integration.</span>
        </div>
      )}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Shopify Integration</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Connect your Shopify store — sync products, orders and inventory automatically</p>
        </div>
        {isConnected ? (
          <div className="flex gap-2">
            <button onClick={() => setShowSettingsModal(true)} className="flex items-center gap-2 px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button onClick={disconnect} className="flex items-center gap-2 px-3 py-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400 hover:bg-red-100">
              <Link2Off className="w-4 h-4" /> Disconnect
            </button>
          </div>
        ) : (
          <button onClick={() => setShowConnectModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
            <Link className="w-4 h-4" /> Connect Shopify Store
          </button>
        )}
      </div>

      {/* Connection Status Banner */}
      {!loading && (
        <div className={`rounded-xl border p-5 flex items-center gap-4 ${isConnected ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${isConnected ? 'bg-green-100 dark:bg-green-900/40' : 'bg-gray-100 dark:bg-gray-700'}`}>
            <ShoppingBag className={`w-6 h-6 ${isConnected ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`} />
          </div>
          <div className="flex-1">
            {isConnected ? (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-green-800 dark:text-green-200">{store?.shop_name || 'Shopify Store'}</h3>
                  <CheckCircle className="w-4 h-4 text-green-500" />
                </div>
                <p className="text-sm text-green-700 dark:text-green-300 mt-0.5">{store?.shopify_domain} · {store?.plan_name} plan · {store?.currency}</p>
              </>
            ) : (
              <>
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">No Shopify Store Connected</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Connect your Shopify store to start syncing products, orders, and inventory.</p>
              </>
            )}
          </div>
          {isConnected && (
            <a href={`https://${store?.shopify_domain}/admin`} target="_blank" rel="noreferrer"
              className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 hover:underline">
              Open Shopify Admin <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
      )}

      {/* Sync Cards */}
      {isConnected && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { type: 'products', label: 'Products', icon: Package, desc: 'Push ExiusCart products to Shopify', count: store?.products_synced, last: store?.last_product_sync, color: 'blue', enabled: store?.sync_products },
              { type: 'orders', label: 'Orders', icon: ShoppingCart, desc: 'Pull Shopify orders into ExiusCart', count: store?.orders_synced, last: store?.last_order_sync, color: 'purple', enabled: store?.sync_orders },
              { type: 'inventory', label: 'Inventory', icon: BarChart2, desc: 'Push stock levels to Shopify', count: null, last: store?.last_product_sync, color: 'orange', enabled: store?.sync_inventory },
            ].map(s => (
              <div key={s.type} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-${s.color}-50 dark:bg-${s.color}-900/30`}>
                    <s.icon className={`w-5 h-5 text-${s.color}-600 dark:text-${s.color}-400`} />
                  </div>
                  {!s.enabled && <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">Disabled</span>}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{s.label}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 mb-3">{s.desc}</p>
                {s.count !== null && s.count !== undefined && (
                  <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{s.count}</p>
                )}
                {s.last && <p className="text-xs text-gray-400 mb-3">Last sync: {new Date(s.last).toLocaleString()}</p>}
                <button
                  onClick={() => sync(s.type as any)}
                  disabled={!s.enabled || syncing === s.type}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${s.enabled ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'}`}>
                  <RefreshCw className={`w-4 h-4 ${syncing === s.type ? 'animate-spin' : ''}`} />
                  {syncing === s.type ? 'Syncing...' : `Sync ${s.label}`}
                </button>
              </div>
            ))}
          </div>

          {/* How it works */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">Real-Time Webhook Sync</h3>
            </div>
            <p className="text-sm text-blue-700 dark:text-blue-300 mb-2">
              New orders placed on your Shopify store appear in ExiusCart automatically — no manual sync needed.
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Webhook URL: <code className="bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 rounded font-mono">{typeof window !== 'undefined' ? `${window.location.origin}/api/v1/shopify/webhook/${shopId}` : ''}</code>
            </p>
          </div>

          {/* Recent Sync Logs */}
          {status?.recent_logs?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Recent Sync Activity</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>{['Type', 'Direction', 'Status', 'Processed', 'Failed', 'Time'].map(h => (
                    <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">{h}</th>
                  ))}</tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {status.recent_logs.map((l: any) => (
                    <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-2.5 capitalize font-medium text-gray-900 dark:text-white">{l.sync_type}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300 capitalize">{l.direction}</td>
                      <td className="px-4 py-2.5"><span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[l.status] || ''}`}>{l.status}</span></td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{l.records_processed}</td>
                      <td className="px-4 py-2.5 text-gray-600 dark:text-gray-300">{l.records_failed}</td>
                      <td className="px-4 py-2.5 text-gray-500 dark:text-gray-400 text-xs">{new Date(l.started_at).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Connect Shopify Store</h2>
              </div>
              <button onClick={() => setShowConnectModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-sm text-amber-700 dark:text-amber-300">
                You need a <strong>Private App</strong> or <strong>Custom App</strong> access token from your Shopify admin. Go to: Settings → Apps → Develop apps.
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shopify Store Domain *</label>
                <input value={connectForm.shopify_domain} onChange={e => setConnectForm(f => ({ ...f, shopify_domain: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="mystore (or mystore.myshopify.com)" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Admin API Access Token *</label>
                <input type="password" value={connectForm.access_token} onChange={e => setConnectForm(f => ({ ...f, access_token: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="shpat_xxxxxxxxxxxxxxxx" />
              </div>
              {connectError && <p className="text-sm text-red-600 dark:text-red-400">{connectError}</p>}
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowConnectModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={connect} disabled={connecting} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">{connecting ? 'Connecting...' : 'Connect Store'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettingsModal && store && (
        <SyncSettingsModal store={store} onSave={updateSettings} onClose={() => setShowSettingsModal(false)} />
      )}
    </div>
  );
}

function SyncSettingsModal({ store, onSave, onClose }: { store: any; onSave: (s: any) => void; onClose: () => void }) {
  const [settings, setSettings] = useState({ sync_products: store.sync_products, sync_orders: store.sync_orders, sync_inventory: store.sync_inventory });
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Sync Settings</h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          {[
            { key: 'sync_products', label: 'Product Sync', desc: 'Push ExiusCart products to Shopify' },
            { key: 'sync_orders', label: 'Order Sync', desc: 'Pull Shopify orders into ExiusCart' },
            { key: 'sync_inventory', label: 'Inventory Sync', desc: 'Push stock levels to Shopify' },
          ].map(s => (
            <label key={s.key} className="flex items-center justify-between p-3 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">{s.label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.desc}</p>
              </div>
              <input type="checkbox" checked={settings[s.key as keyof typeof settings]} onChange={e => setSettings(v => ({ ...v, [s.key]: e.target.checked }))} className="w-4 h-4 text-blue-600 rounded" />
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg">Cancel</button>
          <button onClick={() => onSave(settings)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Settings</button>
        </div>
      </div>
    </div>
  );
}
