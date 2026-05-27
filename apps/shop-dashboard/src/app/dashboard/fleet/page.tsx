'use client';
import { useState, useEffect } from 'react';
import { Plus, Truck, Wrench, Trash2, Edit2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { fleetApi } from '@/lib/api';
import { useCurrency } from '@/components/providers/currency-provider';

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  maintenance: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  inactive: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

const FUEL_TYPES = ['petrol', 'diesel', 'electric', 'hybrid', 'lpg'];

const EMPTY_V = { name: '', make: '', model: '', year: '', plate_number: '', vin: '', fuel_type: 'petrol', mileage: '0', assigned_to: '', insurance_expiry: '', registration_expiry: '', notes: '' };
const EMPTY_S = { service_type: '', service_date: '', mileage_at_service: '', cost: '0', provider: '', notes: '' };

export default function FleetPage() {
  const [shopId, setShopId] = useState<string>('');
  const { fmt } = useCurrency();
  useEffect(() => { setShopId(localStorage.getItem('shop_id') || '1'); }, []);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState<number | null>(null);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [vehicleForm, setVehicleForm] = useState<any>(EMPTY_V);
  const [serviceForm, setServiceForm] = useState<any>(EMPTY_S);
  const [services, setServices] = useState<Record<number, any[]>>({});
  const [expandedVehicle, setExpandedVehicle] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!shopId) return;
    setLoading(true);
    try { const r = await fleetApi.getVehicles(shopId); setVehicles(r.data); }
    catch {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [shopId]);

  const loadServices = async (vid: number) => {
    try { const r = await fleetApi.getServices(shopId!, vid); setServices(s => ({ ...s, [vid]: r.data })); }
    catch {}
  };

  const toggleExpand = (vid: number) => {
    if (expandedVehicle === vid) { setExpandedVehicle(null); }
    else { setExpandedVehicle(vid); loadServices(vid); }
  };

  const openNewVehicle = () => { setEditingVehicle(null); setVehicleForm(EMPTY_V); setShowVehicleModal(true); };
  const openEditVehicle = (v: any) => {
    setEditingVehicle(v);
    setVehicleForm({
      name: v.name, make: v.make || '', model: v.model || '', year: v.year || '', plate_number: v.plate_number || '',
      vin: v.vin || '', fuel_type: v.fuel_type, mileage: v.mileage || '0', assigned_to: v.assigned_to || '',
      insurance_expiry: v.insurance_expiry || '', registration_expiry: v.registration_expiry || '', notes: v.notes || '',
    });
    setShowVehicleModal(true);
  };

  const saveVehicle = async () => {
    if (!vehicleForm.name.trim()) return;
    setSaving(true);
    try {
      const payload = { ...vehicleForm, year: vehicleForm.year ? parseInt(vehicleForm.year) : null, mileage: parseInt(vehicleForm.mileage) || 0 };
      if (editingVehicle) await fleetApi.updateVehicle(shopId!, editingVehicle.id, payload);
      else await fleetApi.createVehicle(shopId!, payload);
      setShowVehicleModal(false); load();
    } catch {} finally { setSaving(false); }
  };

  const delVehicle = async (v: any) => {
    if (!confirm(`Delete vehicle "${v.name}"?`)) return;
    try { await fleetApi.deleteVehicle(shopId!, v.id); load(); } catch {}
  };

  const addService = async () => {
    if (!serviceForm.service_type.trim() || !serviceForm.service_date) return;
    const vid = showServiceModal!;
    setSaving(true);
    try {
      await fleetApi.addService(shopId!, vid, { ...serviceForm, cost: parseFloat(serviceForm.cost) || 0, mileage_at_service: serviceForm.mileage_at_service ? parseInt(serviceForm.mileage_at_service) : null });
      setShowServiceModal(null); setServiceForm(EMPTY_S); loadServices(vid);
    } catch {} finally { setSaving(false); }
  };

  const vfld = (k: string, v: any) => setVehicleForm((f: any) => ({ ...f, [k]: v }));
  const sfld = (k: string, v: any) => setServiceForm((f: any) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fleet Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Track your vehicles and service records</p>
        </div>
        <button onClick={openNewVehicle} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium">
          <Plus className="w-4 h-4" /> Add Vehicle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Vehicles', value: vehicles.length },
          { label: 'Active', value: vehicles.filter(v => v.status === 'active').length },
          { label: 'In Maintenance', value: vehicles.filter(v => v.status === 'maintenance').length },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
            <p className="text-2xl font-bold mt-1 text-gray-900 dark:text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Vehicle Cards */}
      {loading ? <div className="p-8 text-center text-gray-500 dark:text-gray-400">Loading...</div>
        : vehicles.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-12 text-center">
            <Truck className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">No vehicles yet. Add your first vehicle.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicles.map(v => (
              <div key={v.id} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-gray-900 dark:text-white">{v.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.status]}`}>{v.status}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      {[v.year, v.make, v.model].filter(Boolean).join(' ')} {v.plate_number ? `· ${v.plate_number}` : ''} {v.fuel_type ? `· ${v.fuel_type}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <span>{(v.mileage || 0).toLocaleString()} km</span>
                    <span>·</span>
                    <span>{v.service_count} services</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => setShowServiceModal(v.id)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Add Service Record">
                      <Wrench className="w-4 h-4" />
                    </button>
                    <button onClick={() => openEditVehicle(v)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => delVehicle(v)} className="p-1.5 text-gray-400 hover:text-red-500 rounded"><Trash2 className="w-4 h-4" /></button>
                    <button onClick={() => toggleExpand(v.id)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded">
                      {expandedVehicle === v.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {expandedVehicle === v.id && (
                  <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-3">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Service History</h4>
                    {(services[v.id] || []).length === 0 ? (
                      <p className="text-sm text-gray-400 dark:text-gray-500 py-2">No service records yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {(services[v.id] || []).map((s: any) => (
                          <div key={s.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                            <div>
                              <span className="font-medium text-gray-900 dark:text-white">{s.service_type}</span>
                              {s.provider && <span className="text-gray-500 dark:text-gray-400 ml-2">@ {s.provider}</span>}
                            </div>
                            <div className="flex items-center gap-4 text-gray-500 dark:text-gray-400">
                              {s.mileage_at_service && <span>{s.mileage_at_service.toLocaleString()} km</span>}
                              <span>{fmt(s.cost)}</span>
                              <span>{s.service_date}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      {/* Vehicle Modal */}
      {showVehicleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{editingVehicle ? 'Edit Vehicle' : 'Add Vehicle'}</h2>
              <button onClick={() => setShowVehicleModal(false)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: 'Vehicle Name *', key: 'name', placeholder: 'Company Van 1' },
                  { label: 'Plate Number', key: 'plate_number', placeholder: 'DXB A 12345' },
                  { label: 'Make', key: 'make', placeholder: 'Toyota' },
                  { label: 'Model', key: 'model', placeholder: 'Hiace' },
                  { label: 'Year', key: 'year', placeholder: '2022', type: 'number' },
                  { label: 'Current Mileage (km)', key: 'mileage', placeholder: '0', type: 'number' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                    <input type={f.type || 'text'} value={vehicleForm[f.key]} onChange={e => vfld(f.key, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      placeholder={f.placeholder} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fuel Type</label>
                  <select value={vehicleForm.fuel_type} onChange={e => vfld('fuel_type', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm">
                    {FUEL_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned To</label>
                  <input value={vehicleForm.assigned_to} onChange={e => vfld('assigned_to', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder="Driver name" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Insurance Expiry</label>
                  <input type="date" value={vehicleForm.insurance_expiry} onChange={e => vfld('insurance_expiry', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registration Expiry</label>
                  <input type="date" value={vehicleForm.registration_expiry} onChange={e => vfld('registration_expiry', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowVehicleModal(false)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={saveVehicle} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : editingVehicle ? 'Save Changes' : 'Add Vehicle'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Service Modal */}
      {showServiceModal !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Add Service Record</h2>
              <button onClick={() => setShowServiceModal(null)} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {[
                { label: 'Service Type *', key: 'service_type', placeholder: 'Oil Change' },
                { label: 'Service Provider', key: 'provider', placeholder: 'Al Ghandi Auto' },
                { label: 'Notes', key: 'notes', placeholder: 'Optional details...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
                  <input value={serviceForm[f.key]} onChange={e => sfld(f.key, e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    placeholder={f.placeholder} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                  <input type="date" value={serviceForm.service_date} onChange={e => sfld('service_date', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost</label>
                  <input type="number" min="0" step="0.01" value={serviceForm.cost} onChange={e => sfld('cost', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mileage at Service</label>
                  <input type="number" min="0" value={serviceForm.mileage_at_service} onChange={e => sfld('mileage_at_service', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" placeholder="km" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setShowServiceModal(null)} className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700">Cancel</button>
              <button onClick={addService} disabled={saving} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">{saving ? 'Saving...' : 'Add Record'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
