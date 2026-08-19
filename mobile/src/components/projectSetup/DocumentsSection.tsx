/**
 * DocumentsSection - pick files via expo-document-picker, edit title/category, remove.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { useTheme } from '../../lib/theme';
import { spacing, typography, fontWeights } from '../../lib/design-tokens';
import { getDocumentPicker } from '../../lib/document-picker';
import { copyToDurableLocation, removeDurableFileCopy } from '../../lib/pending-project-uploads';
import type { DocumentFile } from './types';
import { DOCUMENT_CATEGORIES } from './types';
import { sharedStyles } from './sharedStyles';

let _idCounter = 0;
function genId() { return `doc_${Date.now()}_${++_idCounter}`; }

interface Props {
  documents: DocumentFile[];
  onChange: (docs: DocumentFile[]) => void;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'file-text';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'file-text';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'grid';
  return 'file';
}

export function DocumentsSection({ documents, onChange }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => sharedStyles(colors), [colors]);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('Other');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const pickDocument = useCallback(async () => {
    const picker = getDocumentPicker();
    if (!picker) {
      Alert.alert('Not Available', 'Document picker is not available in this build. Please update the app.');
      return;
    }
    try {
      const result = await picker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return;
      const picked: DocumentFile = {
        clientId: genId(),
        uri: asset.uri,
        name: asset.name || 'document',
        mimeType: asset.mimeType || 'application/octet-stream',
        title: asset.name || 'document',
        category: 'Other',
      };
      // Copy the file out of the cache directory into a durable location so it
      // survives cache eviction if the upload needs to be retried later.
      const doc = await copyToDurableLocation(picked);
      onChange([...documents, doc]);
    } catch (err: any) {
      if (__DEV__) console.log('Document pick error:', err);
      Alert.alert('Error', 'Failed to pick document. Please try again.');
    }
  }, [documents, onChange]);

  const openEdit = useCallback((idx: number) => {
    const doc = documents[idx];
    setEditingIdx(idx);
    setEditTitle(doc.title);
    setEditCategory(doc.category);
    setShowEditModal(true);
  }, [documents]);

  const saveEdit = useCallback(() => {
    if (editingIdx === null) return;
    const updated = documents.map((d, i) =>
      i === editingIdx ? { ...d, title: editTitle.trim() || d.name, category: editCategory } : d
    );
    onChange(updated);
    setShowEditModal(false);
  }, [editingIdx, editTitle, editCategory, documents, onChange]);

  const removeDoc = useCallback((idx: number) => {
    Alert.alert('Remove Document', 'Remove this document?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await removeDurableFileCopy(documents[idx].uri);
          onChange(documents.filter((_, i) => i !== idx));
        },
      },
    ]);
  }, [documents, onChange]);

  return (
    <View>
      {documents.length === 0 ? (
        <Text style={s.empty}>No documents selected. Attach contracts, drawings, permits, or other files.</Text>
      ) : (
        <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
          {documents.map((doc, idx) => (
            <View key={doc.clientId} style={s.itemCard}>
              <Feather name={getFileIcon(doc.mimeType) as any} size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={s.itemTitle} numberOfLines={1}>{doc.title || doc.name}</Text>
                <Text style={s.itemMeta}>{doc.category}  {doc.name}</Text>
              </View>
              <TouchableOpacity onPress={() => openEdit(idx)} testID={`doc-edit-${idx}`}>
                <Feather name="edit-2" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => removeDoc(idx)} testID={`doc-remove-${idx}`}>
                <Feather name="trash-2" size={18} color={colors.destructive} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <TouchableOpacity style={s.addButton} onPress={pickDocument} testID="doc-pick-button">
        <Feather name="paperclip" size={16} color={colors.primary} />
        <Text style={s.addButtonText}>Attach Document</Text>
      </TouchableOpacity>

      {/* Edit modal */}
      <Modal visible={showEditModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
          <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowEditModal(false)} testID="doc-modal-cancel">
                <Text style={s.modalCancel}>Cancel</Text>
              </TouchableOpacity>
              <Text style={s.modalTitle}>Edit Document</Text>
              <TouchableOpacity onPress={saveEdit} testID="doc-modal-save">
                <Text style={s.modalSave}>Save</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={s.modalContent} keyboardShouldPersistTaps="handled">
              <View style={s.field}>
                <Text style={s.label}>Title</Text>
                <TextInput
                  style={s.input}
                  value={editTitle}
                  onChangeText={setEditTitle}
                  placeholder="Document title"
                  placeholderTextColor={colors.mutedForeground}
                  testID="doc-input-title"
                />
              </View>
              <View style={s.field}>
                <Text style={s.label}>Category</Text>
                <TouchableOpacity style={s.selector} onPress={() => setShowCategoryPicker(true)} testID="doc-category-picker">
                  <Text style={s.selectorValue}>{editCategory}</Text>
                  <Feather name="chevron-down" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>

        <Modal visible={showCategoryPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowCategoryPicker(false)}>
          <View style={[s.modalContainer, { backgroundColor: colors.background }]}>
            <View style={s.modalHeader}>
              <TouchableOpacity onPress={() => setShowCategoryPicker(false)}><Text style={s.modalCancel}>Cancel</Text></TouchableOpacity>
              <Text style={s.modalTitle}>Select Category</Text>
              <View style={{ width: 60 }} />
            </View>
            <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
              {DOCUMENT_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[s.itemCard, editCategory === cat && { borderColor: colors.primary }]}
                  onPress={() => { setEditCategory(cat); setShowCategoryPicker(false); }}
                >
                  <Text style={s.itemTitle}>{cat}</Text>
                  {editCategory === cat && <Feather name="check" size={16} color={colors.primary} />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </Modal>
      </Modal>
    </View>
  );
}
