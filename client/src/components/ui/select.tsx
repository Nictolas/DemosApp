import * as React from "react"
import * as SelectPrimitive from "@radix-ui/react-select"
import { Check, ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

// Hook per recupero ultra-aggressivo su mobile
function useUltraMobileRecovery() {
  const [needsRecovery, setNeedsRecovery] = React.useState(false)
  const [recoveryCount, setRecoveryCount] = React.useState(0)
  const [lastEvent, setLastEvent] = React.useState<string>('')
  
  React.useEffect(() => {
    // Su mobile, monitora TUTTI gli eventi che potrebbero corrompere i Select
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      
      // Listener per TUTTI gli eventi che potrebbero corrompere i Select
      const handleAnyEvent = (eventType: string) => {
        console.log(`🚨 EVENTO CORRUTTORE RILEVATO: ${eventType}`)
        setLastEvent(eventType)
        setNeedsRecovery(true)
        setRecoveryCount(prev => prev + 1)
        
        // Recovery più aggressivo: riprova più volte
        setTimeout(() => setNeedsRecovery(false), 50)
        setTimeout(() => setNeedsRecovery(false), 100)
        setTimeout(() => setNeedsRecovery(false), 200)
        setTimeout(() => setNeedsRecovery(false), 500)
      }
      
      // TUTTI gli eventi che potrebbero causare problemi
      const events = [
        'orientationchange', 'resize', 'scroll', 'focus', 'blur',
        'input', 'change', 'click', 'touchstart', 'touchend', 'touchmove',
        'keydown', 'keyup', 'keypress', 'beforeinput', 'input',
        'compositionstart', 'compositionend', 'compositionupdate',
        'focusin', 'focusout', 'select', 'selectstart', 'selectionchange',
        'visibilitychange', 'pagehide', 'pageshow', 'beforeunload',
        'load', 'unload', 'abort', 'error', 'online', 'offline'
      ]
      
      // Aggiungi listener per TUTTI gli eventi
      events.forEach(eventType => {
        window.addEventListener(eventType, () => handleAnyEvent(eventType), { passive: true })
        document.addEventListener(eventType, () => handleAnyEvent(eventType), { passive: true })
      })
      
      // Monitora anche mutazioni del DOM
      const observer = new MutationObserver(() => {
        handleAnyEvent('DOM_MUTATION')
      })
      
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class']
      })
      
      // Cleanup
      return () => {
        events.forEach(eventType => {
          window.removeEventListener(eventType, () => handleAnyEvent(eventType))
          document.removeEventListener(eventType, () => handleAnyEvent(eventType))
        })
        observer.disconnect()
      }
    }
  }, [])
  
  return { needsRecovery, recoveryCount, lastEvent }
}

const Select = SelectPrimitive.Root

const SelectGroup = SelectPrimitive.Group

const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => {
  const { needsRecovery, recoveryCount, lastEvent } = useUltraMobileRecovery()
  
  return (
    <SelectPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
        className
      )}
      style={{
        backgroundColor: needsRecovery ? 'transparent' : 'white',
        color: needsRecovery ? 'transparent' : 'black',
        border: needsRecovery ? '1px solid transparent' : '1px solid #d1d5db',
        position: 'relative',
        zIndex: needsRecovery ? 0 : 1,
        // Recovery ultra-aggressivo: forza re-render completo
        transform: needsRecovery ? 'scale(0.98) rotate(0.1deg)' : 'scale(1) rotate(0deg)',
        transition: 'all 0.05s ease-in-out',
        // Debug info visibile
        outline: needsRecovery ? '2px solid red' : 'none'
      }}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown className="h-4 w-4 opacity-50" />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  )
})
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
))
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn(
      "flex cursor-default items-center justify-center py-1",
      className
    )}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
))
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => {
  const { needsRecovery, recoveryCount, lastEvent } = useUltraMobileRecovery()
  
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className
        )}
        style={{
          backgroundColor: needsRecovery ? 'transparent' : 'white',
          color: needsRecovery ? 'transparent' : 'black',
          border: needsRecovery ? '1px solid transparent' : '1px solid #d1d5db',
          zIndex: needsRecovery ? 0 : 99999,
          // Recovery ultra-aggressivo: forza re-render completo
          transform: needsRecovery ? 'scale(0.98) rotate(0.1deg)' : 'scale(1) rotate(0deg)',
          transition: 'all 0.05s ease-in-out',
          // Debug info visibile
          outline: needsRecovery ? '2px solid red' : 'none'
        }}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            "p-1",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  )
})
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)}
    {...props}
  />
))
SelectLabel.displayName = SelectPrimitive.Label.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  const { needsRecovery } = useUltraMobileRecovery()
  
  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className
      )}
      style={{
        backgroundColor: needsRecovery ? 'transparent' : 'white',
        color: needsRecovery ? 'transparent' : 'black',
        // Recovery ultra-aggressivo: forza re-render completo
        transform: needsRecovery ? 'scale(0.98) rotate(0.1deg)' : 'scale(1) rotate(0deg)',
        transition: 'all 0.05s ease-in-out',
        // Debug info visibile
        outline: needsRecovery ? '2px solid red' : 'none'
      }}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  )
})
SelectItem.displayName = SelectPrimitive.Item.displayName

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-muted", className)}
    {...props}
  />
))
SelectSeparator.displayName = SelectPrimitive.Separator.displayName

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
}
