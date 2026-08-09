import { useLayoutEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CalendarCheck, Clock, Loader2, CheckCircle2, ChevronLeft } from "lucide-react";

function useForceLight() {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTheme = root.classList.contains("dark") ? "dark" : "light";
    root.classList.remove("dark");
    root.style.setProperty("--background", "210 40% 98%");
    root.style.setProperty("--foreground", "222.2 84% 4.9%");
    root.style.setProperty("--card", "0 0% 100%");
    root.style.setProperty("--card-foreground", "222.2 84% 4.9%");
    root.style.setProperty("--muted", "210 40% 96.1%");
    root.style.setProperty("--muted-foreground", "215.4 16.3% 46.9%");
    root.style.setProperty("--border", "214.3 31.8% 91.4%");
    root.style.setProperty("color-scheme", "light");
    return () => {
      if (previousTheme === "dark") root.classList.add("dark");
      root.style.removeProperty("--background");
      root.style.removeProperty("--foreground");
      root.style.removeProperty("--card");
      root.style.removeProperty("--card-foreground");
      root.style.removeProperty("--muted");
      root.style.removeProperty("--muted-foreground");
      root.style.removeProperty("--border");
      root.style.removeProperty("color-scheme");
    };
  }, []);
}

interface BookingService {
  name: string;
  duration: number;
  description?: string | null;
}

interface BookingSlot {
  time: string;
  label: string;
}

interface BookingDay {
  date: string;
  label: string;
  slots: BookingSlot[];
}

interface BookingData {
  business: {
    name: string;
    description?: string | null;
    phone?: string | null;
    logoUrl?: string | null;
  };
  services: BookingService[];
  availability: BookingDay[];
}

export default function BookingPage({ slug }: { slug: string }) {
  useForceLight();
  const { toast } = useToast();

  const [selectedService, setSelectedService] = useState<BookingService | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, isError } = useQuery<BookingData>({
    queryKey: ["/api/public/booking", slug],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/public/booking/${slug}`);
      return res.json();
    },
    retry: false,
  });

  const selectedDay = data?.availability.find((d) => d.date === selectedDate) || null;

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      toast({ title: "Please add your name and phone number", variant: "destructive" });
      return;
    }
    if (!selectedDate || !selectedTime) {
      toast({ title: "Please pick a time", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest("POST", `/api/public/booking/${slug}/request`, {
        service: selectedService?.name || null,
        customerName: name.trim(),
        customerPhone: phone.trim(),
        customerEmail: email.trim() || null,
        customerAddress: address.trim() || null,
        date: selectedDate,
        time: selectedTime,
        notes: notes.trim() || null,
      });
      setSubmitted(true);
    } catch (err: any) {
      toast({
        title: "Could not submit",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center space-y-2">
            <h1 className="text-lg font-semibold">Booking page not available</h1>
            <p className="text-sm text-muted-foreground">
              This booking link is not active. Please contact the business directly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <h1 className="text-xl font-semibold">Request sent</h1>
            <p className="text-sm text-muted-foreground">
              Thanks {name.split(" ")[0]}. {data.business.name} will confirm your booking shortly.
              We'll be in touch by phone{email ? " or email" : ""}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-brand text-white">
        <div className="max-w-lg mx-auto px-4 py-6 flex items-center gap-3">
          {data.business.logoUrl ? (
            <img
              src={data.business.logoUrl}
              alt={data.business.name}
              className="h-12 w-12 rounded-md object-cover bg-white"
            />
          ) : null}
          <div>
            <h1 className="text-lg font-semibold leading-tight">{data.business.name}</h1>
            <p className="text-sm text-white/80">Book a time online</p>
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {data.business.description ? (
          <p className="text-sm text-muted-foreground">{data.business.description}</p>
        ) : null}

        {/* Step 1: Service */}
        {data.services.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">1. Choose a service</h2>
            <div className="space-y-2">
              {data.services.map((service) => {
                const active = selectedService?.name === service.name;
                return (
                  <button
                    key={service.name}
                    type="button"
                    onClick={() => setSelectedService(service)}
                    className={`w-full text-left rounded-md border p-3 hover-elevate ${
                      active ? "border-brand ring-1 ring-brand" : "border-border"
                    }`}
                    data-testid={`service-${service.name}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">{service.name}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="h-3 w-3" /> {service.duration} min
                      </span>
                    </div>
                    {service.description ? (
                      <p className="text-xs text-muted-foreground mt-1">{service.description}</p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Step 2: Day + time */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground">
            {data.services.length > 0 ? "2. " : ""}Pick a time
          </h2>
          {data.availability.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No times available right now. Please contact the business directly.
            </p>
          ) : !selectedDate ? (
            <div className="space-y-2">
              {data.availability.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  onClick={() => {
                    setSelectedDate(day.date);
                    setSelectedTime(null);
                  }}
                  className="w-full flex items-center justify-between gap-2 rounded-md border border-border p-3 hover-elevate"
                  data-testid={`day-${day.date}`}
                >
                  <span className="font-medium text-foreground">{day.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {day.slots.length} {day.slots.length === 1 ? "time" : "times"}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate(null);
                  setSelectedTime(null);
                }}
                className="flex items-center gap-1 text-sm text-muted-foreground"
                data-testid="button-change-day"
              >
                <ChevronLeft className="h-4 w-4" /> {selectedDay?.label}
              </button>
              <div className="grid grid-cols-3 gap-2">
                {selectedDay?.slots.map((slot) => {
                  const active = selectedTime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setSelectedTime(slot.time)}
                      className={`rounded-md border p-2 text-sm hover-elevate ${
                        active ? "border-brand ring-1 ring-brand text-foreground" : "border-border text-foreground"
                      }`}
                      data-testid={`slot-${slot.time}`}
                    >
                      {slot.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Step 3: Contact details */}
        {selectedDate && selectedTime && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-foreground">Your details</h2>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} data-testid="input-name" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="phone">Phone</Label>
                <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} data-testid="input-phone" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="email">Email (optional)</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} data-testid="input-email" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="address">Address (optional)</Label>
                <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} data-testid="input-address" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="input-notes" />
              </div>
            </div>
            <Button
              className="w-full"
              size="lg"
              onClick={handleSubmit}
              disabled={submitting}
              data-testid="button-submit-booking"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CalendarCheck className="h-4 w-4" /> Request this booking
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              This is a request. {data.business.name} will confirm with you before it's locked in.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
