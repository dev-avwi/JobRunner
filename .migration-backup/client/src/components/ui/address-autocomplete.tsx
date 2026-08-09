import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSessionToken } from "@/lib/queryClient";

// The address search endpoints require auth. On the deployed domain the app
// authenticates with the Bearer session token (cookies aren't reliably sent),
// so a bare fetch() 401s and no suggestions ever appear. Attach the token.
function authFetch(url: string): Promise<Response> {
  const token = getSessionToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return fetch(url, { headers, credentials: "include" });
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onAddressSelect?: (address: string, lat?: number, lng?: number) => void;
  onConfirmedChange?: (confirmed: boolean) => void;
  requireSelection?: boolean;
  placeholder?: string;
  className?: string;
  "data-testid"?: string;
  disabled?: boolean;
}

interface AddressResult {
  description: string;
  place_id?: string;
  lat?: string;
  lng?: string;
  provider: "google" | "nominatim";
}

export default function AddressAutocomplete({
  value,
  onChange,
  onAddressSelect,
  onConfirmedChange,
  requireSelection = true,
  placeholder,
  className,
  disabled,
  ...props
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<AddressResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [confirmedValue, setConfirmedValue] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFetchRef = useRef<number>(0);
  const userTypingRef = useRef(false);

  useEffect(() => {
    if (value && value.length > 5 && !userTypingRef.current && !isConfirmed) {
      setIsConfirmed(true);
      setConfirmedValue(value);
      onConfirmedChange?.(true);
    }
    userTypingRef.current = false;
  }, [value]);

  const updateConfirmed = useCallback((confirmed: boolean, val?: string) => {
    setIsConfirmed(confirmed);
    if (confirmed && val) setConfirmedValue(val);
    onConfirmedChange?.(confirmed);
  }, [onConfirmedChange]);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 3) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchRef.current;
    const delay = timeSinceLastFetch < 1000 ? 1000 - timeSinceLastFetch : 0;

    await new Promise((resolve) => setTimeout(resolve, delay));

    setIsLoading(true);
    try {
      const encoded = encodeURIComponent(query);
      const response = await authFetch(`/api/address-search?q=${encoded}`);
      lastFetchRef.current = Date.now();
      if (response.ok) {
        const data: AddressResult[] = await response.json();
        setSuggestions(data);
        setIsOpen(data.length > 0);
        setHighlightedIndex(-1);
      }
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    userTypingRef.current = true;
    onChange(newValue);

    if (requireSelection && newValue !== confirmedValue) {
      updateConfirmed(false);
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (newValue.length >= 3) {
      setIsLoading(true);
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(newValue);
      }, 300);
    } else {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
    }
  };

  const handleSelect = async (result: AddressResult) => {
    const address = result.description;
    onChange(address);
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    updateConfirmed(true, address);

    if (result.provider === "google" && result.place_id && onAddressSelect) {
      try {
        const res = await authFetch(
          `/api/address-search/details?place_id=${result.place_id}`
        );
        if (res.ok) {
          const details = await res.json();
          if (details.lat && details.lng) {
            onAddressSelect(address, details.lat, details.lng);
            return;
          }
        }
      } catch {}
    }

    if (result.lat && result.lng) {
      onAddressSelect?.(
        address,
        parseFloat(result.lat),
        parseFloat(result.lng)
      );
    } else {
      onAddressSelect?.(address);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < suggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : suggestions.length - 1
        );
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const showUnconfirmedWarning = requireSelection && !isConfirmed && value && value.length >= 3;
  const showConfirmedCheck = requireSelection && isConfirmed && value && value.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn(
            "pr-8",
            showUnconfirmedWarning && "border-orange-400 focus-visible:ring-orange-400",
            showConfirmedCheck && "border-green-500 focus-visible:ring-green-500",
            className
          )}
          disabled={disabled}
          autoComplete="off"
          data-testid={props["data-testid"]}
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : showConfirmedCheck ? (
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          ) : showUnconfirmedWarning ? (
            <AlertCircle className="h-4 w-4 text-orange-400" />
          ) : null}
        </div>
      </div>

      {showUnconfirmedWarning && !isOpen && !isLoading && (
        <div className="flex items-center gap-2 mt-1">
          <p className="text-xs text-orange-500">Select an address from suggestions or</p>
          <button
            type="button"
            className="text-xs text-primary hover:underline font-medium"
            onClick={() => {
              updateConfirmed(true, value);
              onAddressSelect?.(value);
            }}
          >
            use as entered
          </button>
        </div>
      )}

      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover text-popover-foreground shadow-md">
          {suggestions.map((result, index) => (
            <div
              key={`${result.place_id || result.lat}-${index}`}
              className={cn(
                "flex items-start gap-2 px-3 py-2 cursor-pointer text-sm",
                index === highlightedIndex && "bg-accent"
              )}
              onMouseEnter={() => setHighlightedIndex(index)}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(result);
              }}
            >
              <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{result.description}</span>
            </div>
          ))}
        </div>
      )}

      {isOpen && isLoading && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 border rounded-md bg-popover text-popover-foreground shadow-md">
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Searching...</span>
          </div>
        </div>
      )}
    </div>
  );
}
