import * as React from "react"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

// Select nativo completamente personalizzato
const Select = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    value?: string
    onValueChange?: (value: string) => void
    children: React.ReactNode
  }
>(({ className, children, value, onValueChange, ...props }, ref) => {
  return (
    <div ref={ref} className={cn("relative", className)} {...props}>
      {children}
    </div>
  )
})
Select.displayName = "Select"

// Trigger del select nativo
const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    children: React.ReactNode
    onClick?: () => void
  }
>(({ className, children, onClick, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onClick}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-white text-black px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  >
    {children}
    <ChevronDown className="h-4 w-4 opacity-50" />
  </button>
))
SelectTrigger.displayName = "SelectTrigger"

// Contenuto del select nativo
const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    children: React.ReactNode
    isOpen: boolean
  }
>(({ className, children, isOpen, ...props }, ref) => {
  if (!isOpen) return null
  
  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-full left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg",
        className
      )}
      style={{
        backgroundColor: 'white',
        color: 'black',
        border: '1px solid #e5e7eb',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        zIndex: 9999
      }}
      {...props}
    >
      {children}
    </div>
  )
})
SelectContent.displayName = "SelectContent"

// Item del select nativo
const SelectItem = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    value: string
    children: React.ReactNode
    onSelect?: (value: string) => void
  }
>(({ className, children, value, onSelect, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={() => onSelect?.(value)}
    className={cn(
      "w-full px-3 py-2 text-left text-sm text-black hover:bg-gray-100 focus:bg-blue-50 focus:outline-none",
      className
    )}
    style={{
      backgroundColor: 'white',
      color: 'black'
    }}
    {...props}
  >
    {children}
  </button>
))
SelectItem.displayName = "SelectItem"

// Valore del select nativo
const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & {
    placeholder?: string
    children?: React.ReactNode
  }
>(({ className, placeholder, children, ...props }, ref) => (
  <span ref={ref} className={cn("truncate", className)} {...props}>
    {children || placeholder}
  </span>
))
SelectValue.displayName = "SelectValue"

// Componenti di supporto per compatibilità
const SelectGroup = ({ children }: { children: React.ReactNode }) => <>{children}</>
const SelectLabel = ({ children }: { children: React.ReactNode }) => <>{children}</>
const SelectSeparator = () => <hr className="my-1" />
const SelectScrollUpButton = () => null
const SelectScrollDownButton = () => null

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
