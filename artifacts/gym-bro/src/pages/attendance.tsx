import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  useGetTodayAttendance, 
  useRecordAttendance, 
  useGetWeeklyAttendance, 
  useGetAttendanceStreak,
  getGetTodayAttendanceQueryKey,
  getGetWeeklyAttendanceQueryKey,
  getGetAttendanceStreakQueryKey,
  useGetVapidPublicKey,
  getGetVapidPublicKeyQueryKey,
  useSubscribeNotifications
} from "@workspace/api-client-react";
import { Bell, Flame, Check, Moon } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Attendance() {
  const queryClient = useQueryClient();
  const { data: todayRes, isLoading: todayLoading } = useGetTodayAttendance();
  const { data: weeklyRes, isLoading: weeklyLoading } = useGetWeeklyAttendance();
  const { data: streakRes, isLoading: streakLoading } = useGetAttendanceStreak();
  const recordMutation = useRecordAttendance();

  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  const { data: vapidKeyRes } = useGetVapidPublicKey({ query: { enabled: notificationPermission === "default", queryKey: getGetVapidPublicKeyQueryKey() }});
  const subscribeMutation = useSubscribeNotifications();

  const handleEnableNotifications = async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      toast.error("Push notifications are not supported by your browser");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);

      if (permission === "granted" && vapidKeyRes?.publicKey) {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: vapidKeyRes.publicKey
        });

        const subObj = JSON.parse(JSON.stringify(subscription));
        
        subscribeMutation.mutate({
          data: {
            endpoint: subObj.endpoint,
            p256dh: subObj.keys.p256dh,
            auth: subObj.keys.auth
          }
        }, {
          onSuccess: () => {
            toast.success("Notifications enabled!");
          }
        });
      }
    } catch (error) {
      console.error("Error enabling notifications:", error);
      toast.error("Failed to enable notifications");
    }
  };

  const handleRecord = (choice: "attend" | "skip") => {
    recordMutation.mutate({
      data: { choice }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetTodayAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetWeeklyAttendanceQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetAttendanceStreakQueryKey() });
        
        if (choice === "attend") {
          toast.success("Great job! Keep up the momentum!");
        } else {
          toast.success("Rest days matter too. See you next time!");
        }
      }
    });
  };

  const todayRecord = todayRes?.record;
  const isLoading = todayLoading || weeklyLoading || streakLoading;

  return (
    <Layout title="Today's Check-in">
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        
        {notificationPermission === "default" && (
          <Card className="p-4 bg-primary/10 border-none shadow-none flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-full text-primary">
                <Bell className="w-5 h-5" />
              </div>
              <div className="text-sm font-medium">Turn on reminders</div>
            </div>
            <Button size="sm" onClick={handleEnableNotifications} className="rounded-full" aria-label="Enable Notifications">
              Enable
            </Button>
          </Card>
        )}

        <Card className="p-6 text-center border-none shadow-sm flex flex-col items-center gap-6">
          {isLoading ? (
            <div className="h-40 flex items-center justify-center">Loading...</div>
          ) : todayRecord ? (
            <div className="py-8 flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 duration-500">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
                {todayRecord.choice === "attend" ? <Check className="w-8 h-8" /> : <Moon className="w-8 h-8" />}
              </div>
              <h3 className="text-xl font-bold text-foreground">
                {todayRecord.choice === "attend" ? "You're going today!" : "Resting today."}
              </h3>
              <p className="text-muted-foreground">
                {todayRecord.choice === "attend" 
                  ? "Have a great workout. You've got this!" 
                  : "Enjoy your rest. Recovery is important."}
              </p>
            </div>
          ) : (
            <div className="py-4 flex flex-col items-center gap-6 w-full">
              <div className="text-center space-y-2">
                <h3 className="text-2xl font-bold text-foreground">Will you go to the gym today?</h3>
                <p className="text-muted-foreground text-sm">Be honest with yourself.</p>
              </div>
              
              <div className="flex flex-col w-full gap-3">
                <Button 
                  size="lg" 
                  className="w-full rounded-full text-lg h-14 bg-primary hover:bg-primary/90 text-white shadow-sm transition-transform active:scale-95"
                  onClick={() => handleRecord("attend")}
                  disabled={recordMutation.isPending}
                  aria-label="Attend gym today"
                >
                  Yes, let's go!
                </Button>
                <Button 
                  variant="outline" 
                  size="lg" 
                  className="w-full rounded-full text-lg h-14 border-2 border-border hover:bg-muted/50 text-muted-foreground transition-transform active:scale-95"
                  onClick={() => handleRecord("skip")}
                  disabled={recordMutation.isPending}
                  aria-label="Skip gym today"
                >
                  Skip today
                </Button>
              </div>
            </div>
          )}
        </Card>

        {!isLoading && weeklyRes && (
          <div className="space-y-3">
            <h3 className="font-bold text-lg px-1">This Week</h3>
            <Card className="p-5 border-none shadow-sm space-y-4">
              <div className="flex justify-between items-end">
                <div>
                  <span className="text-3xl font-bold text-foreground">{weeklyRes.attendCount}</span>
                  <span className="text-muted-foreground font-medium"> / {weeklyRes.weeklyGoal} days</span>
                </div>
                <div className="text-sm font-semibold text-primary bg-primary/10 px-3 py-1 rounded-full">
                  {weeklyRes.onTrack ? "On track!" : "Catching up"}
                </div>
              </div>
              
              <Progress 
                value={Math.min((weeklyRes.attendCount / Math.max(weeklyRes.weeklyGoal, 1)) * 100, 100)} 
                className="h-3 rounded-full bg-border" 
                aria-label="Weekly goal progress"
              />
              
              <div className="flex justify-between pt-2">
                {weeklyRes.days.slice(0, 7).map((day, i) => (
                  <div key={i} className="flex flex-col items-center gap-1.5">
                    <div className="text-xs text-muted-foreground font-medium">{day.dayName.substring(0, 1)}</div>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                      ${day.choice === 'attend' ? 'bg-primary text-white' : 
                        day.choice === 'skip' ? 'bg-border text-muted-foreground' : 
                        'bg-card-border/50 text-muted-foreground/50 border border-border border-dashed'}`}
                    >
                      {day.choice === 'attend' ? '✓' : day.choice === 'skip' ? '×' : '-'}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {!isLoading && streakRes && streakRes.currentStreak > 0 && (
          <div className="flex items-center justify-center gap-2 text-primary font-bold bg-primary/10 py-3 rounded-full mb-4">
            <Flame className="w-6 h-6" />
            <span>{streakRes.currentStreak} Day Streak! Keep it going!</span>
          </div>
        )}
      </div>
    </Layout>
  );
}