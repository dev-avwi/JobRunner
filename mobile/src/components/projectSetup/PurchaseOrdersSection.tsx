/**
 * PurchaseOrdersSection - add/edit/remove POs with supplier, phase, line items.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { useTheme } from '../../lib/theme';
import { spacing, typography, fontWeights } from '../../lib/design-tokens';
import type { PurchaseOrder, POItem, ProjectPhase } from './types';
import { sharedStyles } from './sharedStyles';

let _idCounter = 0;
function genId() { return `po_${Date.now()}_${++_idCounter}`; }
function genItemId() { return `poi_${Date.now()}_${++_idCounter}`; }

const EMPTY_ITEM: POItem = { description: '', quantity: '1', unitPrice: '' };

interface Props {
  purchaseOrders: PurchaseOrder[];
  phases: ProjectPhase[];
  suppliers: any[];
  loadingSuppliers: boolean;
  onChange: (pos: PurchaseOrder[]) => void;
}

function emptyPO(sortOrder: number): PurchaseOrder {
  return {
    clientId: genId(),
    poNumber: `PO-${String(sortOrder + 1).padStart(3, '0')}`,
    supplierId: null,
    phaseClientId: null,
    requiredDate: '',
    terms: '',
    notes: '',
    items: [{ ...EMPTY_ITEM }],
  };
}

function validatePO(po: PurchaseOrder): string | null {
  if (!po.poNumber.trim()) return 'PO number is required';
  if (!po.supplierId) return 'Please select a supplier';
  if (po.items.length === 0) return 'Add at least one line item';
  for (let i = 0; i < po.items.length; i++) {
    const item = po.items[i];
    if (!item.description.trim()) return `Item ${i + 1}: description is required`;
    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0) return `Item ${i + 1}: quantity must be a positive whole number`;
    const unitPrice = Number(item.unitPrice);
    if (!item.unitPrice || !Number.isFinite(unitPrice) || unitPrice < 0) return `Item ${i + 1}: unit price must be a positive number`;
  }
  if (po.requiredDate && !/^\d{4}-\d{2}-\d{2}$/.test(po.requiredDate)) return 'Due date must be YYYY-MM-DD';
  return null;
}

function SupplierPickerModal({
  visible,
  suppliers,
  loading,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  suppliers: any[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => sharedStyles(colors), [colors]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
        <View style={s.modalHeader}>
          <TouchableOpacity onPress={onClose}><Text style={s.modalCancel}>Cancel</Text></TouchableOpacity>
          <Text style={s.modalTitle}>Select Supplier</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
          {loading && <ActivityIndicator size="small" color={colors.primary} style={{ marginVertical: spacing.lg }} />}
          {!loading && suppliers.length === 0 && (
            <Text style={s.empty}>No suppliers found. Add suppliers in the Suppliers section.</Text>
          )}
          {suppliers.map((sup) => {
            const isSelected = selectedId === String(sup.id);
            return (
              <TouchableOpacity
                key={sup.id}
                style={[s.itemCard, isSelected && { borderColor: colors.primary }]}
                onPress={() => { onSelect(String(sup.id)); onClose(); }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle}>{sup.name}</Text>
                  {sup.email && <Text style={s.itemMeta}>{sup.email}</Text>}
                </View>
                {isSelected && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

export function PurchaseOrdersSection({ purchaseOrders, phases, suppliers, loadingSuppliers, onChange }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => sharedStyles(colors), [colors]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<PurchaseOrder>(emptyPO(0));
  const [showSupplierPicker, setShowSupplierPicker] = useState(false);
  const [showPhasePicker, setShowPhasePicker] = useState(false);

  const openAdd = useCallback(() => {
    setEditingIdx(null);
    setForm(emptyPO(purchaseOrders.length));
    setShowModal(true);
  }, [purchaseOrders.length]);

  const openEdit = useCallback((idx: number) => {
    setEditingIdx(idx);
    setForm({ ...purchaseOrders[idx], items: purchaseOrders[idx].items.map((it) => ({ ...it })) });
    setShowModal(true);
  }, [purchaseOrders]);

  const closeModal = useCallback(() => {
    setShowModal(false);
    setShowSupplierPicker(false);
    setShowPhasePicker(false);
  }, []);

  const savePO = useCallback(() => {
    const err = validatePO(form);
    if (err) { Alert.alert('Validation', err); return; }
    if (editingIdx !== null) {
      const updated = [...purchaseOrders];
      updated[editingIdx] = { ...form };
      onChange(updated);
    } else {
      onChange([...purchaseOrders, { ...form }]);
    }
    setShowModal(false);
  }, [form, editingIdx, purchaseOrders, onChange]);

  const removePO = useCallback((idx: number) => {
    Alert.alert('Remove PO', 'Remove this purchase order?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(purchaseOrders.filter((_, i) => i !== idx)) },
    ]);
  }, [purchaseOrders, onChange]);

  const addItem = useCallback(() => {
    setForm((f) => ({ ...f, items: [...f.items, { ...EMPTY_ITEM }] }));
  }, []);

  const removeItem = useCallback((itemIdx: number) => {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== itemIdx) }));
  }, []);

  const updateItem = useCallback((itemIdx: number, key: keyof POItem, value: string) => {
    setForm((f) => {
      const items = f.items.map((it, i) => i === itemIdx ? { ...it, [key]: value } : it);
      return { ...f, items };
    });
  }, []);

  const selectedSupplier = suppliers.find((s) => String(s.id) === form.supplierId);
  const selectedPhase = phases.find((p) => p.clientId === form.phaseClientId);

  const poTotal = form.items.reduce((acc, it) => {
    const q = parseFloat(it.quantity) || 0;
    const p = parseFloat(it.unitPrice) || 0;
    return acc + q * p;
  }, 0);

  return (
    <View>
      {purchaseOrders.length === 0 ? (
        <Text style={s.empty}>No purchase orders yet. Add a PO to track supplier orders.</Text>
      ) : (
        <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          {purchaseOrders.map((po, idx) => {
            const sup = suppliers.find((s) => String(s.id) === po.supplierId);
            const total = po.items.reduce((acc, it) => acc + (parseFloat(it.quantity) || 0) * (parseFloat(it.unitPrice) || 0), 0);
            return (
              <View key={po.clientId} style={s.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemTitle} numberOfLines={1}>
                    {po.poNumber ? `${po.poNumber} ` : ''}{sup?.name || 'No supplier'}
                  </Text>
                  <Text style={s.itemMeta}>
                    {po.items.length} item{po.items.length !== 1 ? 's' : ''}{total > 0 ? `  $${total.toFixed(2)}` : ''}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => openEdit(idx)} testID={`po-edit-${idx}`}>
                  <Feather name="edit-2" size={18} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => removePO(idx)} testID={`po-remove-${idx}`}>
                  <Feather name="trash-2" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      <TouchableOpacity style={s.addButton} onPress={openAdd} testID="po-add-button">
        <Feather name="plus" size={16} color={colors.primary} />
        <Text style={s.addButtonText}>Add Purchase Order</Text>
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={closeModal} testID="po-modal-cancel">
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>{editingIdx !== null ? 'Edit PO' : 'Add PO'}</Text>
              <TouchableOpacity onPress={savePO} testID="po-modal-save">
                <Text style={s.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <View style={s.field}>
                <Text style={s.label}>Supplier *</Text>
                <TouchableOpacity style={s.selector} onPress={() => setShowSupplierPicker(true)} testID="po-supplier-picker">
                  <Text style={selectedSupplier ? s.selectorValue : s.selectorPlaceholder}>
                    {selectedSupplier ? selectedSupplier.name : 'Select supplier'}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <View style={s.field}>
                <Text style={s.label}>Phase (optional)</Text>
                <TouchableOpacity style={s.selector} onPress={() => setShowPhasePicker(true)} testID="po-phase-picker">
                  <Text style={selectedPhase ? s.selectorValue : s.selectorPlaceholder}>
                    {selectedPhase ? selectedPhase.name : 'Link to a phase (optional)'}
                  </Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <View style={s.row}>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>PO Number *</Text>
                  <TextInput
                    style={s.input}
                    value={form.poNumber}
                    onChangeText={(v) => setForm((f) => ({ ...f, poNumber: v }))}
                    placeholder="PO-001"
                    placeholderTextColor={colors.mutedForeground}
                    testID="po-input-number"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.label}>Due Date (YYYY-MM-DD)</Text>
                  <TextInput
                    style={s.input}
                    value={form.requiredDate}
                    onChangeText={(v) => setForm((f) => ({ ...f, requiredDate: v }))}
                    placeholder="2024-08-01"
                    placeholderTextColor={colors.mutedForeground}
                    testID="po-input-due-date"
                  />
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.label}>Description / Notes</Text>
                <TextInput
                  style={[s.input, s.textArea]}
                  value={form.notes}
                  onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                  placeholder="Notes about this PO..."
                  placeholderTextColor={colors.mutedForeground}
                  multiline
                  numberOfLines={2}
                  testID="po-input-notes"
                />
              </View>

              <View style={s.field}>
                <Text style={s.label}>Terms</Text>
                <TextInput
                  style={s.input}
                  value={form.terms}
                  onChangeText={(v) => setForm((f) => ({ ...f, terms: v }))}
                  placeholder="e.g. Net 30"
                  placeholderTextColor={colors.mutedForeground}
                  testID="po-input-terms"
                />
              </View>

              <View style={s.divider} />
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm }}>
                <Text style={s.sectionSubtitle}>Line Items *</Text>
                {poTotal > 0 && (
                  <Text style={{ fontSize: typography.button.fontSize, fontWeight: fontWeights.semibold, color: colors.foreground }}>
                    Total: ${poTotal.toFixed(2)}
                  </Text>
                )}
              </View>

              {form.items.map((item, itemIdx) => (
                <View key={itemIdx} style={{ backgroundColor: colors.muted + '40', borderRadius: 10, padding: spacing.md, gap: spacing.sm, marginBottom: spacing.sm }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Text style={s.label}>Item {itemIdx + 1}</Text>
                    {form.items.length > 1 && (
                      <TouchableOpacity onPress={() => removeItem(itemIdx)} testID={`po-remove-item-${itemIdx}`}>
                        <Feather name="x" size={16} color={colors.destructive} />
                      </TouchableOpacity>
                    )}
                  </View>
                  <TextInput
                    style={s.input}
                    value={item.description}
                    onChangeText={(v) => updateItem(itemIdx, 'description', v)}
                    placeholder="Description *"
                    placeholderTextColor={colors.mutedForeground}
                    testID={`po-item-desc-${itemIdx}`}
                  />
                  <View style={s.row}>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={s.input}
                        value={item.quantity}
                        onChangeText={(v) => updateItem(itemIdx, 'quantity', v)}
                        placeholder="Qty"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="number-pad"
                        testID={`po-item-qty-${itemIdx}`}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <TextInput
                        style={s.input}
                        value={item.unitPrice}
                        onChangeText={(v) => updateItem(itemIdx, 'unitPrice', v)}
                        placeholder="Unit Price ($)"
                        placeholderTextColor={colors.mutedForeground}
                        keyboardType="decimal-pad"
                        testID={`po-item-price-${itemIdx}`}
                      />
                    </View>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={s.addButton} onPress={addItem} testID="po-add-item">
                <Feather name="plus" size={14} color={colors.primary} />
                <Text style={s.addButtonText}>Add Line Item</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        <SupplierPickerModal
          visible={showSupplierPicker}
          suppliers={suppliers}
          loading={loadingSuppliers}
          selectedId={form.supplierId}
          onSelect={(id) => setForm((f) => ({ ...f, supplierId: id }))}
          onClose={() => setShowSupplierPicker(false)}
        />

        {/* Phase picker */}
        <Modal visible={showPhasePicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowPhasePicker(false)}>
          <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowPhasePicker(false)}><Text style={s.modalCancel}>Cancel</Text></TouchableOpacity>
              <Text style={s.modalTitle}>Link to Phase</Text>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              <TouchableOpacity
                style={[s.itemCard, !form.phaseClientId && { borderColor: colors.primary }]}
                onPress={() => { setForm((f) => ({ ...f, phaseClientId: null })); setShowPhasePicker(false); }}
              >
                <Text style={s.itemTitle}>No phase</Text>
                {!form.phaseClientId && <Feather name="check" size={16} color={colors.primary} />}
              </TouchableOpacity>
              {phases.map((ph) => {
                const isSel = form.phaseClientId === ph.clientId;
                return (
                  <TouchableOpacity
                    key={ph.clientId}
                    style={[s.itemCard, isSel && { borderColor: colors.primary }]}
                    onPress={() => { setForm((f) => ({ ...f, phaseClientId: ph.clientId })); setShowPhasePicker(false); }}
                  >
                    <Text style={s.itemTitle}>{ph.name}</Text>
                    {isSel && <Feather name="check" size={16} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Modal>
      </Modal>
    </View>
  );
}
