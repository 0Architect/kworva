import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { logEvent } from '../../lib/events';
import { useAuth } from '../_layout';
import { colors, font, spacing, radius } from '../../constants/theme';
import type { CapacityTag, Category } from '../../lib/types';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuth();

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [bio, setBio] = useState('');
  const [saving, setSaving] = useState(false);

  // Capacity tags
  const [tags, setTags] = useState<CapacityTag[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [tagLabel, setTagLabel] = useState('');
  const [tagCatId, setTagCatId] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState(false);

  const fetchTags = useCallback(async () => {
    if (!session?.user) return;
    const { data } = await supabase
      .from('capacity_tags')
      .select('*')
      .eq('profile_id', session.user.id)
      .order('created_at', { ascending: true });
    if (data) setTags(data);
  }, [session?.user]);

  useEffect(() => {
    supabase.from('categories').select('*').eq('is_active', true).order('name')
      .then(({ data }) => { if (data) setCategories(data); });
    fetchTags();
  }, [fetchTags]);

  const startEdit = () => {
    if (!profile) return;
    setName(profile.display_name);
    setArea(profile.area);
    setBio(profile.bio_text ?? '');
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const saveProfile = async () => {
    if (!session?.user || !name.trim() || !area.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ display_name: name.trim(), area: area.trim(), bio_text: bio.trim() || null })
      .eq('id', session.user.id);
    if (error) {
      setSaving(false);
      Alert.alert('Save failed', error.message);
      return;
    }
    await logEvent('profile_updated', { fields: ['display_name', 'area', 'bio_text'] }, session.user.id);
    await refreshProfile();
    setSaving(false);
    setEditing(false);
  };

  const addTag = async () => {
    if (!tagLabel.trim() || !session?.user) return;
    setAddingTag(true);
    const { data, error } = await supabase
      .from('capacity_tags')
      .insert({ profile_id: session.user.id, label: tagLabel.trim(), category_id: tagCatId })
      .select('*')
      .single();
    if (error) {
      setAddingTag(false);
      Alert.alert('Could not add tag', error.message);
      return;
    }
    setTags(prev => [...prev, data]);
    setTagLabel('');
    setTagCatId(null);
    setAddingTag(false);
  };

  const deleteTag = (tag: CapacityTag) => {
    Alert.alert('Remove tag', `Remove "${tag.label}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          await supabase.from('capacity_tags').delete().eq('id', tag.id);
          setTags(prev => prev.filter(t => t.id !== tag.id));
        },
      },
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out', style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/auth/sign-in');
        },
      },
    ]);
  };

  if (!profile) return null;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 16 }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* Profile card */}
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{profile.display_name[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{profile.display_name}</Text>
        <Text style={styles.areaText}>📍 {profile.area} · {profile.campus}</Text>
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Text style={styles.statNum}>
              {profile.rating_avg > 0 ? Number(profile.rating_avg).toFixed(1) : '—'}
            </Text>
            <Text style={styles.statLbl}>rating</Text>
          </View>
          <View style={styles.statDiv} />
          <View style={styles.stat}>
            <Text style={styles.statNum}>{profile.deals_count}</Text>
            <Text style={styles.statLbl}>deals</Text>
          </View>
        </View>
      </View>

      {/* Edit / view toggle */}
      {!editing ? (
        <TouchableOpacity style={styles.editBtn} onPress={startEdit} activeOpacity={0.8}>
          <Text style={styles.editBtnText}>Edit profile</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.editForm}>
          <Text style={styles.fieldLabel}>Display name</Text>
          <TextInput
            style={styles.fieldInput}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor={colors.textMuted}
            editable={!saving}
          />

          <Text style={styles.fieldLabel}>Area</Text>
          <TextInput
            style={styles.fieldInput}
            value={area}
            onChangeText={setArea}
            placeholder="e.g. Faculty, Hall, Gate"
            placeholderTextColor={colors.textMuted}
            editable={!saving}
          />

          <Text style={styles.fieldLabel}>Bio (optional)</Text>
          <TextInput
            style={[styles.fieldInput, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            placeholder="What do you do? What can you help with?"
            placeholderTextColor={colors.textMuted}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!saving}
          />

          <View style={styles.editActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={cancelEdit} disabled={saving}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, (!name.trim() || !area.trim() || saving) && styles.saveBtnDisabled]}
              onPress={saveProfile}
              disabled={!name.trim() || !area.trim() || saving}
              activeOpacity={0.85}
            >
              {saving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.saveBtnText}>Save</Text>}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Bio display (view mode only) */}
      {!editing && profile.bio_text ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.bioBox}>
            <Text style={styles.bioText}>{profile.bio_text}</Text>
          </View>
        </View>
      ) : null}

      {/* Capacity tags */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>What you offer</Text>
        <Text style={styles.sectionHint}>
          These tags tell Kworva what you can supply — you'll show up when someone needs it.
        </Text>

        {/* Existing tags */}
        {tags.length > 0 && (
          <View style={styles.tagWrap}>
            {tags.map(t => (
              <TouchableOpacity
                key={t.id}
                style={styles.tagChip}
                onPress={() => deleteTag(t)}
                activeOpacity={0.7}
              >
                <Text style={styles.tagChipText}>{t.label}</Text>
                <Text style={styles.tagChipX}>×</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Add tag form */}
        <View style={styles.addTagRow}>
          <TextInput
            style={styles.tagInput}
            value={tagLabel}
            onChangeText={setTagLabel}
            placeholder="e.g. I fix phones, I sell food…"
            placeholderTextColor={colors.textMuted}
            editable={!addingTag}
            returnKeyType="done"
            onSubmitEditing={addTag}
          />
          <TouchableOpacity
            style={[styles.addTagBtn, (!tagLabel.trim() || addingTag) && styles.addTagBtnDisabled]}
            onPress={addTag}
            disabled={!tagLabel.trim() || addingTag}
            activeOpacity={0.8}
          >
            {addingTag
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={styles.addTagBtnText}>Add</Text>}
          </TouchableOpacity>
        </View>

        {/* Optional category for the new tag */}
        {tagLabel.trim().length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catRow}>
            <TouchableOpacity
              style={[styles.catChip, tagCatId === null && styles.catChipActive]}
              onPress={() => setTagCatId(null)}
            >
              <Text style={[styles.catChipText, tagCatId === null && styles.catChipTextActive]}>Any</Text>
            </TouchableOpacity>
            {categories.map(c => (
              <TouchableOpacity
                key={c.id}
                style={[styles.catChip, tagCatId === c.id && styles.catChipActive]}
                onPress={() => setTagCatId(tagCatId === c.id ? null : c.id)}
              >
                <Text style={[styles.catChipText, tagCatId === c.id && styles.catChipTextActive]}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      {/* Support links */}
      <View style={styles.supportSection}>
        <TouchableOpacity
          style={styles.supportRow}
          onPress={() => router.push('/feedback')}
          activeOpacity={0.7}
        >
          <Text style={styles.supportText}>Send feedback</Text>
          <Text style={styles.supportArrow}>→</Text>
        </TouchableOpacity>
        <View style={styles.supportDivider} />
        <TouchableOpacity
          style={styles.supportRow}
          onPress={() => router.push('/policy')}
          activeOpacity={0.7}
        >
          <Text style={styles.supportText}>Privacy Policy &amp; Community Rules</Text>
          <Text style={styles.supportArrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Sign out */}
      <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.7}>
        <Text style={styles.signOutText}>Sign out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.lg },

  card: {
    backgroundColor: colors.primary,
    borderRadius: 22, padding: spacing.lg,
    alignItems: 'center', marginBottom: spacing.md,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 18,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: font.heading, fontSize: 28, color: colors.primary },
  name: {
    fontFamily: font.heading, fontSize: 22, color: '#fff',
    marginTop: 12, letterSpacing: -0.3,
  },
  areaText: { fontFamily: font.bodySemi, fontSize: 13, color: colors.primaryMid, marginTop: 4 },
  stats: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.10)',
    borderRadius: 16, paddingVertical: 14, paddingHorizontal: 8,
    marginTop: 20, width: '100%', gap: 4,
  },
  stat: { flex: 1, alignItems: 'center' },
  statNum: { fontFamily: font.heading, fontSize: 22, color: '#fff' },
  statLbl: { fontFamily: font.bodySemi, fontSize: 11, color: colors.primaryMid, marginTop: 1 },
  statDiv: { width: 1, height: 30, backgroundColor: 'rgba(255,255,255,0.18)' },

  editBtn: {
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: 13,
    alignItems: 'center', backgroundColor: '#fff',
    marginBottom: spacing.xl,
  },
  editBtnText: { fontFamily: font.bodyBold, fontSize: 14, color: colors.textSecondary },

  editForm: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.md,
    gap: 10, marginBottom: spacing.xl,
  },
  fieldLabel: {
    fontFamily: font.bodyBold, fontSize: 11.5,
    color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4,
  },
  fieldInput: {
    backgroundColor: colors.bg,
    borderWidth: 1, borderColor: colors.borderInput,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    fontFamily: font.body, fontSize: 15, color: colors.textPrimary,
  },
  bioInput: { minHeight: 80, textAlignVertical: 'top' },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  cancelBtn: {
    flex: 1, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center',
  },
  cancelBtnText: { fontFamily: font.bodyBold, fontSize: 14, color: colors.textSecondary },
  saveBtn: {
    flex: 2, backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingVertical: 13, alignItems: 'center',
  },
  saveBtnDisabled: { opacity: 0.4 },
  saveBtnText: { fontFamily: font.bodyBold, fontSize: 14, color: '#fff' },

  section: { marginBottom: spacing.xl },
  sectionTitle: {
    fontFamily: font.bodyBold, fontSize: 13,
    color: colors.textSecondary, textTransform: 'uppercase',
    letterSpacing: 0.3, marginBottom: 6,
  },
  sectionHint: {
    fontFamily: font.body, fontSize: 13,
    color: colors.textMuted, lineHeight: 19, marginBottom: 14,
  },

  bioBox: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl, padding: spacing.md,
  },
  bioText: { fontFamily: font.body, fontSize: 14.5, color: colors.textPrimary, lineHeight: 21 },

  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.primaryLight,
    borderRadius: radius.pill,
    paddingHorizontal: 12, paddingVertical: 8,
  },
  tagChipText: { fontFamily: font.bodyBold, fontSize: 13, color: colors.primary },
  tagChipX: { fontFamily: font.bodyBold, fontSize: 15, color: colors.primary, lineHeight: 17 },

  addTagRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  tagInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.borderInput,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md, paddingVertical: 13,
    fontFamily: font.body, fontSize: 14.5, color: colors.textPrimary,
  },
  addTagBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 13,
  },
  addTagBtnDisabled: { opacity: 0.35 },
  addTagBtnText: { fontFamily: font.bodyBold, fontSize: 14, color: '#fff' },

  catRow: { gap: 8, paddingTop: 10, paddingBottom: 2 },
  catChip: {
    backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7,
  },
  catChipActive: { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary },
  catChipText: { fontFamily: font.bodyBold, fontSize: 12.5, color: colors.textSecondary },
  catChipTextActive: { color: '#fff' },

  supportSection: {
    backgroundColor: '#fff',
    borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.xl,
    marginBottom: spacing.xl,
    overflow: 'hidden',
  },
  supportRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing.md, paddingVertical: 16,
  },
  supportDivider: { height: 1, backgroundColor: colors.border },
  supportText: { fontFamily: font.bodySemi, fontSize: 14.5, color: colors.textSecondary },
  supportArrow: { fontFamily: font.bodyBold, fontSize: 14, color: colors.textMuted },

  signOutBtn: { alignItems: 'center', paddingVertical: 14 },
  signOutText: { fontFamily: font.bodySemi, fontSize: 14, color: colors.textMuted },
});
