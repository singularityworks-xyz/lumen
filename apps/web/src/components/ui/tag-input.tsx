"use strict";

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

export type TagInputProps = {
  placeholder?: string;
  tags: string[];
  suggestions: string[];
  onTagsChange: (tags: string[]) => void;
  className?: string;
};

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
  const triggerRef = React.useRef<HTMLDivElement>(null);

  React.useLayoutEffect(() => {
    if (triggerRef.current) {
      setTriggerWidth(triggerRef.current.offsetWidth);
    }
  }, [tags]);
  // Actually, ResizeObserver would be better, but simplified for now:
  React.useEffect(() => {
     if (!triggerRef.current) return;
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
    if (tags.includes(tag)) return;
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
      handleUnselect(tags[tags.length - 1] ?? "");
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          ref={triggerRef}
          className={cn(
            "flex min-h-10 w-full flex-wrap gap-1.5 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm hover:bg-muted/50 dark:hover:bg-secondary/50 cursor-text",
            className
)}
          onClick={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              if (e.key === " ") e.preventDefault();
              setOpen(true);
            }
          }}
          tabIndex={0}
          role="button"
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="gap-1 rounded-sm px-1.5 font-normal"
            >
              {tag}
              <button
                aria-label={`Remove ${tag}`}
                className="ml-1 rounded-full ring-offset-background hover:bg-destructive/20 focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleUnselect(tag);
                  }
                }}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleUnselect(tag);
                }}
                type="button"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-foreground" />
              </button>
            </Badge>
          ))}
          <input
            className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground min-w-[80px]"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={tags.length === 0 ? placeholder : ""}
            ref={inputRef}
            readOnly // Make readOnly to rely on CommandInput inside Popover for typing?
            // Actually, better UX: This "trigger" area just shows tags.
            // But we want to type here too?
            // Shadcn pattern: The trigger is just a button. The content has the command input.
            // BUT user wants typical "tag input" where you type inline.
            // Let's hide this input if we are relying on CommandInput inside.
            // OR we make this look like an input, and clicking opens the popover which contains the autocomplete list.
            // Let's try: render a fake cursor or placeholder. When clicked, open popover.
            // Actually, for "Tag Input", usually you type right there.
            // If I use Popover, the focus moves to Popover content.
            // Let's use `Command` directly inline? No, `Command` takes up space.
            // Let's stick to: Click box -> Popover opens with CommandInput auto-focused.
          />
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0" style={{ width: triggerWidth }} align="start">
        <Command>
          <CommandInput
            placeholder={placeholder}
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {/* If input has value but no matches, show "Create tag" option? */}
            {(() => {
              const trimmed = inputValue?.trim();
              if (!trimmed || suggestions.includes(trimmed) || tags.includes(trimmed))
                return null;
              return (
                <CommandItem
                  onSelect={() => handleSelect(inputValue)}
                  className="flex justify-between"
                >
                  Create "{trimmed}"
                  <span className="text-xs text-muted-foreground">New</span>
                </CommandItem>
              );
            })()}

            <CommandGroup 
              heading="Suggestions" 
              className="[&_[cmdk-group-items]]:flex [&_[cmdk-group-items]]:flex-wrap [&_[cmdk-group-items]]:gap-1 [&_[cmdk-group-items]]:p-1"
            >
              {suggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion}
                  onSelect={() => handleSelect(suggestion)}
                  className="flex justify-between w-auto rounded-full border bg-secondary/20 px-2.5 py-0.5 text-xs text-secondary-foreground aria-selected:bg-secondary aria-selected:text-secondary-foreground"
                >
                  {suggestion}
                  {tags.includes(suggestion) && <Check className="ml-1.5 h-3 w-3 opacity-100" />}
                </CommandItem>
              ))}
            </CommandGroup>
             {suggestions.length === 0 && !inputValue && (
               <div className="py-6 text-center text-sm text-muted-foreground">
                 No suggestions found.
               </div>
   )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
