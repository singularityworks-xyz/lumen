import { Check, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/src/components/ui/badge";
import {
  Command,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/src/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/src/components/ui/popover";
import { cn } from "@/src/lib/utils";

export interface TagInputProps {
  className?: string;
  onTagsChange: (tags: string[]) => void;
  placeholder?: string;
  suggestions: string[];
  tags: string[];
}

export function TagInput({
  placeholder = "Add tags...",
  tags,
  suggestions,
  onTagsChange,
  className,
}: TagInputProps) {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [triggerWidth, setTriggerWidth] = React.useState(0);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useLayoutEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, []);
  // Actually, ResizeObserver would be better, but simplified for now:
  React.useEffect(() => {
    if (!triggerRef.current) {
      return;
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setTriggerWidth(entry.contentRect.width);
      }
    });
    observer.observe(triggerRef.current);
    return () => observer.disconnect();
  }, []);

  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleUnselect = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  const handleSelect = (tag: string) => {
    // If tag is already selected, don't add it again (though UI should prevent this via filtering)
    if (tags.includes(tag)) {
      return;
    }
    onTagsChange([...tags, tag]);
    setInputValue("");
    // Keep open for multiple selections if desired, or close.
    // Let's keep it open but clear input for rapid selection.
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      e.preventDefault();
      // If the input value isn't in suggestions, add it as a new tag
      if (!tags.includes(inputValue.trim())) {
        handleSelect(inputValue.trim());
      }
    }
    if (e.key === "Backspace" && !inputValue && tags.length > 0) {
      // Remove last tag on backspace if input is empty
      handleUnselect(tags.at(-1) ?? "");
    }
  };

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger asChild>
        <button
          aria-expanded={open}
          aria-haspopup="dialog"
          className={cn(
            "flex min-h-10 w-full cursor-text flex-wrap gap-1.5 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm hover:bg-muted/50 dark:hover:bg-secondary/50",
            className
          )}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (e.key === " ") {
                e.preventDefault();
              }
              setOpen(true);
            }
          }}
          ref={triggerRef}
          type="button"
        >
          {tags.map((tag) => (
            <Badge
              className="gap-1 rounded-sm px-1.5 font-normal"
              key={tag}
              variant="secondary"
            >
              {tag}
              <button
                aria-label={`Remove ${tag}`}
                className="ml-1 rounded-full ring-offset-background hover:bg-destructive/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleUnselect(tag);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUnselect(tag);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                type="button"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
          <input
            className="min-w-[80px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ""}
            readOnly
            ref={inputRef}
            value={inputValue}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="p-0"
        style={{ width: triggerWidth }}
      >
        <Command>
          <CommandInput
            onValueChange={setInputValue}
            placeholder={placeholder}
            value={inputValue}
          />
          <CommandList>
            {/* If input has value but no matches, show "Create tag" option? */}
            {(() => {
              const trimmed = inputValue?.trim();
              if (
                !trimmed ||
                suggestions.includes(trimmed) ||
                tags.includes(trimmed)
              ) {
                return null;
              }
              return (
                <CommandItem
                  className="flex justify-between"
                  onSelect={() => handleSelect(inputValue)}
                >
                  Create "{trimmed}"
                  <span className="text-muted-foreground text-xs">New</span>
                </CommandItem>
              );
            })()}

            <CommandGroup
              className="[&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-wrap [&_[cmdk-group-items]]:gap-1 [&_[cmdk-group-items]]:p-1"
              heading="Suggestions"
            >
              {suggestions.map((suggestion) => (
                <CommandItem
                  className="flex w-auto justify-between rounded-full border bg-secondary/20 px-2.5 py-0.5 text-secondary-foreground text-xs aria-selected:bg-secondary aria-selected:text-secondary-foreground"
                  key={suggestion}
                  onSelect={() => handleSelect(suggestion)}
                >
                  {suggestion}
                  {tags.includes(suggestion) && (
                    <Check className="ml-1.5 h-3 w-3 opacity-100" />
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {suggestions.length === 0 && !inputValue && (
              <div className="py-6 text-center text-muted-foreground text-sm">
                No suggestions found.
              </div>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
