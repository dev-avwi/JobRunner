import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  getAvatarColor,
  getInitials,
  composeName,
  STATUS_DOT_COLORS,
  type WorkStatus,
} from "@/lib/avatar";

export interface AvatarUser {
  id?: string | number | null;
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  photoUrl?: string | null;
  themeColor?: string | null;
  status?: WorkStatus | null;
}

interface UserAvatarProps {
  user: AvatarUser;
  className?: string;
  /** Pixel size of the optional status dot. Defaults scale with the avatar. */
  showStatus?: boolean;
  /** Override the status colour (e.g. a presence colour computed elsewhere). */
  statusColor?: string;
  fallbackClassName?: string;
  /** Applied to the avatar circle (e.g. a custom border colour). */
  style?: React.CSSProperties;
}

/**
 * One avatar used everywhere. Resolves photo -> initials + deterministic colour
 * so the same person always looks the same. Live work status shows as a small
 * corner dot rather than recolouring the whole circle.
 */
export function UserAvatar({
  user,
  className,
  showStatus = false,
  statusColor,
  fallbackClassName,
  style,
}: UserAvatarProps) {
  const name = user.name || composeName(user.firstName, user.lastName, user.email);
  const initials = getInitials(name, user.email);
  const bgColor = getAvatarColor(user.id, user.themeColor);
  const photo = user.photoUrl || undefined;

  const dotColor =
    statusColor ||
    (user.status ? STATUS_DOT_COLORS[user.status] : STATUS_DOT_COLORS.offline);

  return (
    <span className="relative inline-flex shrink-0">
      <Avatar className={className} style={style}>
        {photo && <AvatarImage src={photo} alt={name || "User"} />}
        <AvatarFallback
          className={cn("text-white font-semibold", fallbackClassName)}
          style={{ backgroundColor: bgColor }}
        >
          {initials}
        </AvatarFallback>
      </Avatar>
      {showStatus && (
        <span
          className="absolute bottom-0 right-0 block rounded-full border-2 border-background"
          style={{
            backgroundColor: dotColor,
            width: "30%",
            height: "30%",
            minWidth: 8,
            minHeight: 8,
          }}
          data-testid="avatar-status-dot"
        />
      )}
    </span>
  );
}
