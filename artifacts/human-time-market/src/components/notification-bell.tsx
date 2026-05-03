import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetNotifications,
  useMarkNotificationsRead,
  getGetNotificationsQueryKey,
  type Notification,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell, Check } from "lucide-react";

export function notifLabel(type: Notification["type"], payload: Record<string, unknown>): string {
  const title = String(payload.listingTitle ?? payload.rfpTitle ?? "");
  switch (type) {
    case "new_bid": return `New bid received on "${title}"`;
    case "bid_accepted": return `Your bid was accepted for "${title}"`;
    case "delivery_logged": return `Delivery logged on "${title}" — ${payload.hoursLogged}h`;
    case "delivery_confirmed": return `Delivery confirmed on "${title}"`;
    case "payment_released": return `Payment released for "${title}"`;
    case "contract_expiring": return `Contract expiring soon: "${title}"`;
    case "dispute_opened": return `Dispute opened on "${title}"`;
    case "dispute_resolved": return `Dispute resolved on "${title}"`;
    case "listing_booked": return `Your listing was booked: "${title}"`;
    case "rfp_response_received": return `New response to your RFP: "${title}"`;
    default: return type;
  }
}

function fmtTs(d: string) {
  return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { data, isLoading } = useGetNotifications({
    query: { refetchInterval: 30_000 } as never,
  });
  const { mutate: markRead } = useMarkNotificationsRead();
  const unread = data?.unreadCount ?? 0;

  const handleMarkAll = () => {
    markRead({ data: { ids: [] } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
    });
  };

  const handleMarkOne = (id: number) => {
    markRead({ data: { ids: [id] } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getGetNotificationsQueryKey() }),
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          data-testid="btn-notifications-bell"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 text-[10px] flex items-center justify-center">
              {unread > 99 ? "99+" : unread}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="font-mono font-semibold text-sm">Notifications</span>
          <Button size="sm" variant="ghost" className="text-xs h-7" onClick={handleMarkAll}>Mark all read</Button>
        </div>
        <div className="max-h-[480px] overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : !data?.items.length ? (
            <div className="p-6 text-center text-muted-foreground text-sm">No notifications yet</div>
          ) : (
            data.items.map((n) => (
              <div
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 ${!n.read ? "bg-primary/5" : ""}`}
              >
                {!n.read ? <span className="mt-1 w-2 h-2 rounded-full bg-primary shrink-0" /> : <span className="mt-1 w-2 h-2 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs leading-snug">{notifLabel(n.type, n.payload as Record<string, unknown>)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{fmtTs(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <Button size="sm" variant="ghost" className="h-6 w-6 p-0 shrink-0" onClick={() => handleMarkOne(n.id)}>
                    <Check className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
