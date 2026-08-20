---
name: mobile-ui-conventions
description: Mobile UI component rules for this JobRunner app. Load before building any new mobile screen, bottom sheet, list row, or component that shows people, team members, or multi-select pickers. Covers TeamAvatar, bottom sheet structure, multi-select patterns, and other enforced conventions.
---

# Mobile UI Conventions

Rules that apply to every mobile screen in `mobile/`. Load this before building or editing any mobile component. Violating these is the #1 source of visual inconsistency.

---

## 1. People / Avatars — always use `TeamAvatar`

**Never** build a hand-rolled avatar circle. Not for team members, not for the current user, not for assignees on cards or in bottom sheets.

```tsx
import { TeamAvatar } from '../../src/components/TeamAvatar';

// Correct — works for any person
<TeamAvatar
  name={member.name}
  email={member.email}
  userId={String(member.memberId || member.id)}
  themeColor={member.themeColor}   // optional — drives colour
  profileImageUrl={member.photoUrl} // optional — shows real photo
  size={36}                         // default 40; use 20–52 as needed
/>
```

**Props available:** `name`, `firstName`, `lastName`, `email`, `userId`, `profileImageUrl`, `themeColor`, `size`.

`TeamAvatar` handles:
- Two-letter initials (first + last name initials, not just one letter)
- Stable deterministic colour per person (consistent across all screens)
- Real photo with graceful fallback
- Any size from tiny badge (20 px) to large profile (52 px)

### Stacked avatars (e.g. "3 workers assigned")

```tsx
<View style={{ flexDirection: 'row' }}>
  {members.slice(0, 4).map((m, i) => (
    <View key={m.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }}>
      <TeamAvatar name={m.name} userId={String(m.id)} themeColor={m.themeColor} size={32} />
    </View>
  ))}
  {members.length > 4 && (
    <View style={{ marginLeft: -8, width: 32, height: 32, borderRadius: 16,
                   backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 11, fontWeight: '600', color: colors.mutedForeground }}>
        +{members.length - 4}
      </Text>
    </View>
  )}
</View>
```

### Assignee badge on list row (compact, ≤ 24 px)

Use `TeamAvatar` even at small sizes — don't render a View + Text initial:

```tsx
<TeamAvatar name={phase.assignedUserName} userId={phase.assignedUserId} size={20} />
```

---

## 2. Team member picker bottom sheets — multi-select

When a bottom sheet lets the user assign/pick team members, it **must** be multi-select and match this structure. Check `mobile/app/job/[id].tsx` assign-workers sheet or `mobile/app/more/create-job.tsx` for the reference implementation.

### Structure checklist

- **"Unassigned" row first** — tapping it clears all selections; shows filled circle-check when nothing selected
- **Per-member row** — square checkbox (22×22, borderRadius 4) on the left, `TeamAvatar` size 36, name + email/subtitle
- **Selection banner** — appears above the list when ≥ 1 member selected: "2 workers selected" with a `check-circle` icon
- **Footer confirm button** — pinned via `AppBottomSheet`'s `footer` prop; label is `"Assign N Worker(s)"` or `"Done"` when count = 0
- **No auto-dismiss on row tap** — toggling a row does not close the sheet; only the confirm button closes it

```tsx
// Unassigned row
<TouchableOpacity
  style={[styles.clientItem, assignedToIds.size === 0 && styles.clientItemSelected,
          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}
  onPress={() => setAssignedToIds(new Set())}
>
  <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2,
                 borderColor: assignedToIds.size === 0 ? colors.primary : colors.border,
                 backgroundColor: assignedToIds.size === 0 ? colors.primary : 'transparent',
                 alignItems: 'center', justifyContent: 'center' }}>
    {assignedToIds.size === 0 && <Feather name="check" size={13} color={colors.primaryForeground} />}
  </View>
  <Text style={[styles.clientItemName, { flex: 1 }]}>Unassigned</Text>
</TouchableOpacity>

// Member row
<TouchableOpacity
  style={[styles.clientItem, isSelected && styles.clientItemSelected,
          { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }]}
  onPress={() => {
    const next = new Set(assignedToIds);
    next.has(memberId) ? next.delete(memberId) : next.add(memberId);
    setAssignedToIds(next);
  }}
>
  <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2,
                 borderColor: isSelected ? colors.primary : colors.border,
                 backgroundColor: isSelected ? colors.primary : 'transparent',
                 alignItems: 'center', justifyContent: 'center' }}>
    {isSelected && <Feather name="check" size={13} color={colors.primaryForeground} />}
  </View>
  <TeamAvatar name={member.name} email={member.email}
              userId={String(member.memberId || member.id)}
              themeColor={member.themeColor} size={36} />
  <View style={{ flex: 1 }}>
    <Text style={styles.clientItemName}>{member.name}</Text>
    <Text style={styles.clientItemEmail}>{member.email}</Text>
  </View>
</TouchableOpacity>
```

---

## 3. `AppBottomSheet` — required props and footer pattern

Always use `AppBottomSheet` from `mobile/src/components/ui/AppBottomSheet.tsx` for bottom sheets. Do not use `Modal` directly for sheets.

```tsx
<AppBottomSheet
  visible={showPicker}
  onDismiss={() => setShowPicker(false)}
  title="Sheet Title"
  scrollable={false}
  contentPadding={0}
  footer={
    <View style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingTop: spacing.sm }}>
      <TouchableOpacity
        style={{ backgroundColor: colors.primary, borderRadius: 10,
                 paddingVertical: spacing.md, alignItems: 'center' }}
        onPress={() => setShowPicker(false)}
        activeOpacity={0.8}
      >
        <Text style={{ fontSize: typography.button.fontSize,
                       fontWeight: fontWeights.semibold,
                       color: colors.primaryForeground }}>
          Confirm
        </Text>
      </TouchableOpacity>
    </View>
  }
>
  {/* content */}
</AppBottomSheet>
```

Key notes:
- Use `footer` prop for any action button pinned above the home indicator — never put buttons inside the scroll area
- Use `contentPadding={0}` when the content manages its own padding (lists, pickers)
- `scrollable={false}` + inner `ScrollView` gives better control over list height

---

## 4. Other enforced conventions

- **No em dashes (`—`) in UI copy.** Use commas, colons, or reword. This is a user preference.
- **`PressableRow`** for tappable rows that need the standard press-highlight — don't use raw `TouchableOpacity` for list rows unless the row needs a checkbox or complex layout.
- **Design tokens always** — use `spacing`, `typography`, `fontWeights`, `radius` from `mobile/src/lib/design-tokens.ts`. No magic numbers.
- **Theme colours always** — use `colors` from `useTheme()`. No hardcoded hex values in component code.
- **`useTheme()`** to get colours in every component, not imported static colour objects.
