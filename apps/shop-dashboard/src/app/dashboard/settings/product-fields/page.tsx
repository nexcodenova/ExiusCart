'use client';

import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit, GripVertical, X, Check, ChevronDown, Type, Hash, Calendar, ToggleLeft, List, CheckSquare } from 'lucide-react';
import { fieldsApi } from '@/lib/api';

export type FieldType = 'text' | 'number' | 'dropdown' | 'date' | 'toggle' | 'multiselect';

export interface ShopField {
  id: number;
  label: string;
  field_key: string;
  field_type: FieldType;
  options: string[] | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
}

const FIELD_TYPES: { value: FieldType; label: string; icon: React.ReactNode; example: string }[] = [
  { value: 'text',        label: 'Text',        icon: <Type className="w-4 h-4" />,        example: 'Brand, Model, IMEI, Origin' },
  { value: 'number',      label: 'Number',      icon: <Hash className="w-4 h-4" />,        example: 'Weight, Warranty years, Carats' },
  { value: 'dropdown',    label: 'Dropdown',    icon: <List className="w-4 h-4" />,        example: 'Size (S/M/L), Color, Condition' },
  { value: 'multiselect', label: 'Multi-select',icon: <CheckSquare className="w-4 h-4" />, example: 'Colors available, Sizes in stock' },
  { value: 'date',        label: 'Date',        icon: <Calendar className="w-4 h-4" />,    example: 'Expiry Date, Manufacture Date' },
  { value: 'toggle',      label: 'Yes / No',    icon: <ToggleLeft className="w-4 h-4" />,  example: 'Is Halal, Has Warranty, Is Organic' },
];

function slugify(str: string) {
  return str.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
}

export default function ProductFieldsPage() {
  const [fields, setFields] = useState<ShopField[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingField, setEditingField] = useState<ShopField | null>(null);
  const shopId = typeof window !== 'undefined' ? localStorage.getItem('shop_id') ?? '' : '';

  const fetchFields = async () => {
    if (!shopId) return;
    try {
      const res = await fieldsApi.getAll(shopId);
      setFields(res.data ?? []);
    } catch {
      setFields([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFields(); }, [shopId]);

  const handleDelete = async (id: number) => {
    try {
      await fieldsApi.delete(shopId, String(id));
      setFields(prev => prev.filter(f => f.id !== id));
    } catch {}
  };

  const handleSave = async (data: Omit<ShopField, 'id' | 'is_active' | 'sort_order'>) => {
    try {
      if (editingField) {
        await fieldsApi.update(shopId, String(editingField.id), data);
      } else {
        await fieldsApi.create(shopId, { ...data, options: data.options ?? undefined, sort_order: fields.length });
      }
      fetchFields();
    } catch {}
    setShowModal(false);
    setEditingField(null);
  };

  const fieldTypeInfo = (type: FieldType) => FIELD_TYPES.find(t => t.value === type);

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Product Fields</h1>
          <p className="text-muted-foreground text-sm">
            Build custom fields for your products — works for any business type
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditingField(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition"
        >
          <Plus className="w-5 h-5" /> Add Field
        </button>
      </div>

      {/* Field Type Guide */}
      <div className="bg-card rounded-xl border border-border p-5">
        <h2 className="font-semibold text-foreground mb-3">Available Field Types</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FIELD_TYPES.map((t) => (
            <div key={t.value} className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
              <div className="mt-0.5 text-primary">{t.icon}</div>
              <div>
                <p className="text-sm font-medium text-foreground">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.example}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fields List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-foreground">Your Product Fields</h2>
          <span className="text-xs text-muted-foreground">{fields.length} fields</span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : fields.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Plus className="w-8 h-8 text-primary" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No custom fields yet</h3>
            <p className="text-sm text-muted-foreground mb-6 max-w-sm mx-auto">
              Add fields that match your business. Mobile shop? Add Brand, Storage, IMEI.
              Abaya shop? Add Size, Fabric, Color.
            </p>
            <div className="flex flex-wrap justify-center gap-2 mb-6">
              {['Brand', 'Size', 'Color', 'Storage', 'IMEI', 'Fabric', 'Expiry Date', 'Weight'].map(s => (
                <span key={s} className="text-xs px-3 py-1.5 bg-muted rounded-full text-muted-foreground">{s}</span>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition"
            >
              <Plus className="w-4 h-4" /> Add First Field
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {fields.map((field) => {
              const typeInfo = fieldTypeInfo(field.field_type);
              return (
                <div key={field.id} className="flex items-center gap-4 p-4 hover:bg-muted/30 transition group">
                  <GripVertical className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 cursor-grab flex-shrink-0" />
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    {typeInfo?.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{field.label}</p>
                      {field.is_required && (
                        <span className="text-xs px-1.5 py-0.5 bg-red-500/10 text-red-600 dark:text-red-400 rounded">required</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground font-mono">{field.field_key}</span>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground capitalize">{typeInfo?.label}</span>
                      {field.options && field.options.length > 0 && (
                        <>
                          <span className="text-xs text-muted-foreground">•</span>
                          <span className="text-xs text-muted-foreground">{field.options.join(', ')}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditingField(field); setShowModal(true); }}
                      aria-label={`Edit ${field.label}`}
                      className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(field.id)}
                      aria-label={`Delete ${field.label}`}
                      className="p-2 hover:bg-destructive/10 rounded-lg text-muted-foreground hover:text-destructive transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <FieldModal
          field={editingField}
          existingKeys={fields.filter(f => !editingField || f.id !== editingField.id).map(f => f.field_key)}
          onClose={() => { setShowModal(false); setEditingField(null); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function FieldModal({ field, existingKeys, onClose, onSave }: {
  field: ShopField | null;
  existingKeys: string[];
  onClose: () => void;
  onSave: (data: any) => void;
}) {
  const [label, setLabel] = useState(field?.label ?? '');
  const [fieldKey, setFieldKey] = useState(field?.field_key ?? '');
  const [fieldType, setFieldType] = useState<FieldType>(field?.field_type ?? 'text');
  const [isRequired, setIsRequired] = useState(field?.is_required ?? false);
  const [optionsInput, setOptionsInput] = useState(field?.options?.join(', ') ?? '');
  const [keyError, setKeyError] = useState('');

  const needsOptions = fieldType === 'dropdown' || fieldType === 'multiselect';

  const handleLabelChange = (val: string) => {
    setLabel(val);
    if (!field) setFieldKey(slugify(val));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (existingKeys.includes(fieldKey)) {
      setKeyError('This key already exists. Choose a different name.');
      return;
    }
    const options = needsOptions
      ? optionsInput.split(',').map(s => s.trim()).filter(Boolean)
      : null;
    onSave({ label, field_key: fieldKey, field_type: fieldType, options, is_required: isRequired });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-card">
          <h2 className="text-lg font-semibold text-foreground">{field ? 'Edit Field' : 'Add Custom Field'}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Field Label */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Field Name *</label>
            <input
              type="text"
              value={label}
              onChange={e => handleLabelChange(e.target.value)}
              required
              placeholder="e.g. Brand, Storage, Fabric, Expiry Date"
              className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
            />
          </div>

          {/* Field Key (auto) */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Field Key</label>
            <input
              type="text"
              value={fieldKey}
              onChange={e => { setFieldKey(slugify(e.target.value)); setKeyError(''); }}
              required
              placeholder="auto_generated"
              className={`w-full px-3 py-2.5 bg-muted border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground font-mono text-sm ${keyError ? 'border-destructive' : 'border-border'}`}
            />
            {keyError
              ? <p className="text-xs text-destructive mt-1">{keyError}</p>
              : <p className="text-xs text-muted-foreground mt-1">Auto-generated from field name. Used internally.</p>
            }
          </div>

          {/* Field Type */}
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Field Type *</label>
            <div className="grid grid-cols-2 gap-2">
              {FIELD_TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setFieldType(t.value)}
                  className={`flex items-center gap-2 p-3 rounded-lg border-2 text-left transition ${
                    fieldType === t.value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  <span className={fieldType === t.value ? 'text-primary' : 'text-muted-foreground'}>{t.icon}</span>
                  <div>
                    <p className={`text-sm font-medium ${fieldType === t.value ? 'text-primary' : 'text-foreground'}`}>{t.label}</p>
                    <p className="text-xs text-muted-foreground line-clamp-1">{t.example}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Options (for dropdown / multiselect) */}
          {needsOptions && (
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">
                Options * <span className="text-muted-foreground font-normal">(comma separated)</span>
              </label>
              <input
                type="text"
                value={optionsInput}
                onChange={e => setOptionsInput(e.target.value)}
                required
                placeholder={fieldType === 'dropdown' ? 'S, M, L, XL, XXL' : 'Red, Blue, Black, White'}
                className="w-full px-3 py-2.5 bg-muted border border-border rounded-lg focus:ring-2 focus:ring-primary outline-none text-foreground"
              />
              {optionsInput && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {optionsInput.split(',').map(s => s.trim()).filter(Boolean).map(opt => (
                    <span key={opt} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">{opt}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Required Toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <p className="text-sm font-medium text-foreground">Required Field</p>
              <p className="text-xs text-muted-foreground">Product cannot be saved without this field</p>
            </div>
            <button
              type="button"
              onClick={() => setIsRequired(!isRequired)}
              className={`relative w-12 h-6 rounded-full transition ${isRequired ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            >
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isRequired ? 'left-7' : 'left-1'}`} />
            </button>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-border rounded-lg text-foreground hover:bg-muted transition">Cancel</button>
            <button type="submit" className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition font-medium">
              {field ? 'Save Changes' : 'Add Field'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
