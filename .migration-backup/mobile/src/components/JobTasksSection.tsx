import { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { api } from '../lib/api';
import { showToast } from '../lib/toast';

interface JobTask {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  source?: string | null;
}

interface JobTasksSectionProps {
  containerStyle?: any;
  jobId: string;
  readOnly?: boolean;
}

export function JobTasksSection({ jobId, readOnly, containerStyle }: JobTasksSectionProps) {
  const { colors } = useTheme();
  const [tasks, setTasks] = useState<JobTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get<JobTask[]>(`/api/jobs/${jobId}/tasks`);
    if (!res.error && Array.isArray(res.data)) {
      setTasks(res.data);
    }
    setLoading(false);
  }, [jobId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = async (task: JobTask) => {
    const nextStatus = task.status === 'done' ? 'open' : 'done';
    setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t)));
    const res = await api.patch(`/api/tasks/${task.id}`, { status: nextStatus });
    if (res.error) {
      showToast({ type: 'error', message: 'Could not update task' });
      load();
    }
  };

  const remove = async (task: JobTask) => {
    setTasks((prev) => prev.filter((t) => t.id !== task.id));
    const res = await api.delete(`/api/tasks/${task.id}`);
    if (res.error) {
      showToast({ type: 'error', message: 'Could not delete task' });
      load();
    }
  };

  const add = async () => {
    const title = newTitle.trim();
    if (!title) return;
    setAdding(true);
    const res = await api.post<JobTask>('/api/tasks', { title, jobId });
    setAdding(false);
    if (res.error) {
      showToast({ type: 'error', message: 'Could not add task' });
      return;
    }
    setNewTitle('');
    load();
  };

  if (loading) return null;
  if (tasks.length === 0 && readOnly) return null;

  const openCount = tasks.filter((t) => t.status !== 'done').length;

  const styles = StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    title: { fontSize: 16, fontWeight: '600', color: colors.foreground },
    badge: {
      backgroundColor: colors.muted,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 6,
    },
    badgeText: { fontSize: 12, color: colors.secondaryText, fontWeight: '600' },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    check: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 1,
    },
    taskTitle: { fontSize: 14, color: colors.foreground },
    taskTitleDone: { textDecorationLine: 'line-through', color: colors.secondaryText },
    taskDesc: { fontSize: 12, color: colors.secondaryText, marginTop: 2 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.foreground,
      fontSize: 14,
      letterSpacing: 0,
      textAlign: 'left',
    },
    addBtn: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

  return (
    <View style={containerStyle}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="check-square" size={18} color={colors.foreground} />
          <Text style={styles.title}>Follow-up Tasks</Text>
        </View>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{openCount} open</Text>
        </View>
      </View>

      {tasks.map((task) => {
        const done = task.status === 'done';
        return (
          <View key={task.id} style={styles.row}>
            <TouchableOpacity
              onPress={() => !readOnly && toggle(task)}
              disabled={readOnly}
              style={[
                styles.check,
                { borderColor: done ? colors.success : colors.border, backgroundColor: done ? colors.success : 'transparent' },
              ]}
            >
              {done && <Feather name="check" size={14} color={colors.primaryForeground} />}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={[styles.taskTitle, done && styles.taskTitleDone]}>{task.title}</Text>
              {!!task.description && <Text style={styles.taskDesc}>{task.description}</Text>}
            </View>
            {!readOnly && (
              <TouchableOpacity onPress={() => remove(task)} hitSlop={8}>
                <Feather name="trash-2" size={18} color={colors.secondaryText} />
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {!readOnly && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={newTitle}
            onChangeText={setNewTitle}
            placeholder="Add a task"
            placeholderTextColor={colors.secondaryText}
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <TouchableOpacity style={styles.addBtn} onPress={add} disabled={adding || !newTitle.trim()}>
            {adding ? (
              <ActivityIndicator size="small" color={colors.primaryForeground} />
            ) : (
              <Feather name="plus" size={20} color={colors.primaryForeground} />
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
