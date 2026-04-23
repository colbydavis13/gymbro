import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useGetSchedule, useUpdateSchedule, getGetScheduleQueryKey } from "@workspace/api-client-react";
import { Clock, Calendar as CalendarIcon, Edit2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export default function Schedule() {
  const queryClient = useQueryClient();
  const { data: schedule, isLoading } = useGetSchedule();
  const updateMutation = useUpdateSchedule();
  
  const [isOpen, setIsOpen] = useState(false);
  const [timeValue, setTimeValue] = useState("");
  const [goalValue, setGoalValue] = useState("3");

  useEffect(() => {
    if (schedule) {
      setTimeValue(schedule.dailyTime);
      setGoalValue(schedule.weeklyGoal.toString());
    }
  }, [schedule]);

  const handleSave = () => {
    if (!timeValue) return;
    
    updateMutation.mutate({
      data: {
        dailyTime: timeValue,
        weeklyGoal: parseInt(goalValue, 10),
        targetEmail: schedule?.targetEmail
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetScheduleQueryKey() });
        setIsOpen(false);
        toast.success("Schedule updated!");
      },
      onError: () => {
        toast.error("Failed to update schedule");
      }
    });
  };

  const formatTime = (time24: string) => {
    if (!time24) return "";
    const [hours, minutes] = time24.split(":");
    let h = parseInt(hours, 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12;
    h = h ? h : 12;
    return `${h}:${minutes} ${ampm}`;
  };

  const getDayName = (daysOffset: number) => {
    const date = new Date();
    date.setDate(date.getDate() + daysOffset);
    return date.toLocaleDateString('en-US', { weekday: 'long' });
  };

  return (
    <Layout title="Your Schedule">
      <div className="flex flex-col gap-6 animate-in fade-in duration-500">
        
        {isLoading ? (
          <div className="h-32 flex items-center justify-center">Loading...</div>
        ) : schedule ? (
          <>
            <Card className="p-6 border-none shadow-sm relative overflow-hidden bg-primary/5">
              <div className="absolute -right-4 -top-4 text-primary/10 w-32 h-32">
                <Clock className="w-full h-full" />
              </div>
              
              <div className="relative z-10 space-y-4">
                <div>
                  <h3 className="text-muted-foreground font-medium text-sm mb-1">Daily Reminder Time</h3>
                  <div className="text-4xl font-bold text-foreground">{formatTime(schedule.dailyTime)}</div>
                </div>
                
                <div className="pt-2 border-t border-border/50">
                  <h3 className="text-muted-foreground font-medium text-sm mb-1">Weekly Goal</h3>
                  <div className="text-lg font-bold text-foreground">{schedule.weeklyGoal} days per week</div>
                </div>

                <Dialog open={isOpen} onOpenChange={setIsOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full mt-4 rounded-full border-primary/20 text-primary hover:bg-primary/10" aria-label="Edit Gym Schedule">
                      <Edit2 className="w-4 h-4 mr-2" />
                      Edit Gym Schedule
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Edit Schedule</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="time">Daily Reminder Time</Label>
                        <Input 
                          id="time" 
                          type="time" 
                          value={timeValue}
                          onChange={(e) => setTimeValue(e.target.value)}
                          className="h-12 rounded-xl text-lg px-4"
                          aria-label="Select reminder time"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="goal">Weekly Goal (days)</Label>
                        <Input 
                          id="goal" 
                          type="number" 
                          min="1" 
                          max="7" 
                          value={goalValue}
                          onChange={(e) => setGoalValue(e.target.value)}
                          className="h-12 rounded-xl text-lg px-4"
                          aria-label="Select weekly goal"
                        />
                      </div>
                    </div>
                    <Button 
                      onClick={handleSave} 
                      className="w-full h-12 rounded-full text-lg"
                      disabled={updateMutation.isPending}
                      aria-label="Save changes"
                    >
                      Save Changes
                    </Button>
                  </DialogContent>
                </Dialog>
              </div>
            </Card>

            <div className="space-y-3">
              <h3 className="font-bold text-lg px-1">Upcoming Workouts</h3>
              
              <div className="space-y-3">
                <Card className="p-5 border-none shadow-sm flex items-center gap-4">
                  <div className="bg-primary/20 w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-primary font-bold">
                    <span className="text-xs uppercase">{new Date().toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-lg leading-none">{new Date().getDate()}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">Today, {getDayName(0)}</h4>
                    <p className="text-sm text-muted-foreground">Scheduled for {formatTime(schedule.dailyTime)}</p>
                  </div>
                </Card>

                <Card className="p-5 border-none shadow-sm flex items-center gap-4 opacity-75">
                  <div className="bg-border w-12 h-12 rounded-2xl flex flex-col items-center justify-center text-muted-foreground font-bold">
                    <span className="text-xs uppercase">{new Date(Date.now() + 86400000).toLocaleDateString('en-US', { month: 'short' })}</span>
                    <span className="text-lg leading-none">{new Date(Date.now() + 86400000).getDate()}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-foreground">Tomorrow, {getDayName(1)}</h4>
                    <p className="text-sm text-muted-foreground">Scheduled for {formatTime(schedule.dailyTime)}</p>
                  </div>
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
}