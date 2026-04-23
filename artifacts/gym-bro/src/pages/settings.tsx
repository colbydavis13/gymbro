import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetSchedule, useUpdateSchedule, getGetScheduleQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { User, Bell, Save } from "lucide-react";

export default function Settings() {
  const queryClient = useQueryClient();
  const { data: schedule, isLoading } = useGetSchedule();
  const updateMutation = useUpdateSchedule();
  
  const [timeValue, setTimeValue] = useState("");
  const [goalValue, setGoalValue] = useState("3");
  const [emailValue, setEmailValue] = useState("");

  useEffect(() => {
    if (schedule) {
      setTimeValue(schedule.dailyTime);
      setGoalValue(schedule.weeklyGoal.toString());
      setEmailValue(schedule.targetEmail || "");
    }
  }, [schedule]);

  const handleSave = () => {
    if (!timeValue) return;
    
    updateMutation.mutate({
      data: {
        dailyTime: timeValue,
        weeklyGoal: parseInt(goalValue, 10),
        targetEmail: emailValue || null
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetScheduleQueryKey() });
        toast.success("Settings saved successfully!");
      },
      onError: () => {
        toast.error("Failed to save settings");
      }
    });
  };

  return (
    <Layout title="Settings">
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        
        <Card className="p-6 border-none shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary">
            <User className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-foreground">Colby Davis</h3>
            <p className="text-sm text-muted-foreground">Gym Bro Member</p>
          </div>
        </Card>

        {isLoading ? (
          <div className="h-32 flex items-center justify-center">Loading...</div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-bold text-lg px-1 flex items-center gap-2">
                <Bell className="w-5 h-5 text-primary" />
                Preferences
              </h3>
              
              <Card className="p-5 border-none shadow-sm space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="daily-time" className="text-foreground/80">Daily Reminder Time</Label>
                  <Input 
                    id="daily-time" 
                    type="time" 
                    value={timeValue}
                    onChange={(e) => setTimeValue(e.target.value)}
                    className="h-12 rounded-xl px-4 bg-background"
                    aria-label="Daily Reminder Time"
                  />
                  <p className="text-xs text-muted-foreground ml-1">We'll ask you if you're going to the gym at this time.</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="weekly-goal" className="text-foreground/80">Weekly Goal (days)</Label>
                  <Input 
                    id="weekly-goal" 
                    type="number" 
                    min="1" 
                    max="7" 
                    value={goalValue}
                    onChange={(e) => setGoalValue(e.target.value)}
                    className="h-12 rounded-xl px-4 bg-background"
                    aria-label="Weekly Goal"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground/80">Notification Email (Optional)</Label>
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="your@email.com"
                    value={emailValue}
                    onChange={(e) => setEmailValue(e.target.value)}
                    className="h-12 rounded-xl px-4 bg-background"
                    aria-label="Notification Email"
                  />
                </div>
              </Card>
            </div>

            <Button 
              onClick={handleSave} 
              className="w-full h-14 rounded-full text-lg shadow-sm"
              disabled={updateMutation.isPending}
              aria-label="Save Settings"
            >
              {updateMutation.isPending ? "Saving..." : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Settings
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}